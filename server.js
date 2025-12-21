
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. BODY PARSERS ---
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { 
    req.rawBody = buf.toString(); 
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());

// --- 2. LOGGING HELPER ---
let webhookLogs = []; 
function addLog(type, message, details = null) {
  const log = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    type,
    message,
    details
  };
  webhookLogs.unshift(log);
  if (webhookLogs.length > 200) webhookLogs.pop(); 
  console.log(`[${type}] ${message}`);
}

// --- 3. REQUEST LOGGER ---
app.use(['/api/sync', '/messages-upsert', '/webhook'], (req, res, next) => {
  let bodyContent = 'Empty';
  if (req.body && Object.keys(req.body).length > 0) {
    bodyContent = JSON.stringify(req.body);
  } else if (req.rawBody) {
    bodyContent = `RAW: ${req.rawBody}`;
  }
  const preview = bodyContent.substring(0, 4000);
  addLog('INFO', `Request Received: ${req.path}`, {
    method: req.method,
    headers: { 'content-type': req.headers['content-type'] },
    body: preview + (bodyContent.length > 4000 ? '...' : '')
  });
  next();
});

// --- 4. SERVER STATE & AI LOGIC ---
let maintenance = [];
let issues = [];
let contacts = []; 
let evolutionConfig = null;
const userMemory = new Map(); 

const SYSTEM_PROMPT = `Role: EcoSpot Kenya. 
Rule: Max 1 sentence. No greetings/thanks. 
Fiber: 6Mbps-1500, 20Mbps-2000. 
Hotspot: 1hr-10, 24hr-60. 
Paybill: 400200 (Acc:Phone). 
Offline: LOS red light status? 
Slow: Restart router.
State: {MAINTENANCE_STATUS}`;

async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") return { text: "System Error: Missing API Key.", isSerious: false };
  
  const ai = new GoogleGenAI({ apiKey });
  const maintenanceText = maintenanceRecords.length > 0 
    ? maintenanceRecords.map(m => `${m.area} (${m.status})`).join(', ')
    : "Operational.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(h => ({
        role: h.role === 'agent' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { 
        systemInstruction: SYSTEM_PROMPT.replace('{MAINTENANCE_STATUS}', maintenanceText),
        temperature: 0.1, 
        maxOutputTokens: 100, 
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    return { text: (response.text || "").trim(), isSerious: false };
  } catch (e) {
    return { text: "Service temporarily delayed.", isSerious: false };
  }
}

async function callEvolution(endpoint, method, body) {
  if (!evolutionConfig) return null;
  let base = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
  if (!base.startsWith('http')) base = 'https://' + base;
  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json', 
        'apikey': evolutionConfig.apiKey.trim(),
        'Accept': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return res;
  } catch (e) {
    throw e;
  }
}

// --- 5. DASHBOARD ROUTES ---
app.get('/api/data', (req, res) => res.json({ maintenance, issues, contacts, config: evolutionConfig }));
app.get('/api/logs', (req, res) => res.json(webhookLogs));
app.post('/api/maintenance', (req, res) => { maintenance = req.body || []; res.json({ success: true }); });
app.post('/api/issues', (req, res) => { issues = req.body || []; res.json({ success: true }); });
app.post('/api/config', (req, res) => { evolutionConfig = req.body; res.json({ success: true }); });

app.get('/api/instance/status', async (req, res) => {
  try {
    if (!evolutionConfig?.instanceName) return res.json({ status: 'NOT_CONFIGURED' });
    const response = await callEvolution(`/instance/connectionState/${evolutionConfig.instanceName}`, 'GET');
    if (response && response.ok) {
      const data = await response.json();
      const state = data?.instance?.state || data?.state;
      const isConnected = ['open', 'connected'].includes(String(state).toLowerCase());
      return res.json({ status: isConnected ? 'CONNECTED' : 'DISCONNECTED', state: state });
    }
    res.json({ status: "ERROR", message: "Instance check failed." });
  } catch (e) { res.json({ status: "ERROR", message: e.message }); }
});

// --- 6. WEBHOOK HANDLER ---
app.post(['/api/sync', '/messages-upsert', '/webhook'], async (req, res) => {
  const payload = req.body || {};
  res.status(200).send('ACK'); // Immediate ACK

  // Log specific event detection
  const eventName = payload.event || 'none';
  addLog('INFO', `Processing Event: ${eventName}`);

  const isMsgEvent = eventName.toLowerCase().includes('messages.upsert') || req.path.includes('messages-upsert');
  if (!isMsgEvent) {
    if (eventName !== 'test') addLog('INFO', `Ignored non-message event: ${eventName}`);
    return;
  }

  // 1. Extract the core message object
  const messageData = payload.data || {};
  const messageObj = (messageData.messages ? messageData.messages[0] : messageData) || {};

  if (!messageObj.key) {
    addLog('ERROR', 'Payload structure mismatch: No "key" found in payload.data.');
    return;
  }

  // 2. Identify the User (remoteJidAlt is priority for phone number)
  const jid = messageObj.key.remoteJidAlt || messageObj.key.remoteJid;
  
  // 3. Extract Text (conversation is priority for simple messages)
  const msgContent = messageObj.message || {};
  const text = msgContent.conversation || 
               msgContent.extendedTextMessage?.text || 
               messageObj.conversation || 
               messageObj.text || 
               '';

  // DEBUG LOGS FOR USER
  addLog('WEBHOOK', `Extraction Debug`, {
    remoteJidAlt: messageObj.key.remoteJidAlt || 'MISSING',
    remoteJid: messageObj.key.remoteJid || 'MISSING',
    conversationField: msgContent.conversation || 'MISSING',
    finalJidToUse: jid,
    finalTextToProcess: text
  });

  if (!jid || !text || text.trim().length === 0) {
    addLog('INFO', 'Skipped: Missing identity (JID) or message content (Text).', { jid, textDetected: !!text });
    return;
  }

  // Handle status/outgoing
  if (messageObj.status && messageObj.status !== 'PENDING') return;
  if (messageObj.key.fromMe === true) return;

  if (!evolutionConfig) {
    addLog('ERROR', 'Reply Aborted: No Evolution Config found in system.');
    return;
  }

  // Manage Memory
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 6) history.shift();

  try {
    const targetNumber = jid.split('@')[0];
    addLog('INFO', `Routing response to target number: ${targetNumber}`);
    
    // Send Presence
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { 
      number: targetNumber, 
      presence: 'composing' 
    });

    // AI Response
    const { text: aiResponse } = await generateAIResponse(history, maintenance);
    history.push({ role: 'agent', content: aiResponse });

    // Send Message
    addLog('INFO', `Calling Evolution sendText for: ${targetNumber}`);
    const sendResult = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { 
      number: targetNumber, 
      text: aiResponse 
    });

    if (sendResult && sendResult.ok) {
      addLog('SUCCESS', `Replied to ${targetNumber} successfully.`);
    } else {
      const err = await sendResult?.text();
      addLog('ERROR', `Evolution API rejected sendText`, { status: sendResult?.status, error: err });
    }
  } catch (e) {
    addLog('ERROR', `Unexpected Exception during reply: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.listen(PORT, () => console.log(`EcoSpot Active on Port ${PORT}`));
