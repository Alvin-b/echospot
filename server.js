
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

// --- 2. LOGGING SYSTEM ---
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
  addLog('INFO', `Webhook Inbound: ${req.path}`, {
    method: req.method,
    body: preview + (bodyContent.length > 4000 ? '...' : '')
  });
  next();
});

// --- 4. SERVER STATE ---
let maintenance = [];
let issues = [];
let contacts = []; 
let evolutionConfig = null;
const userMemory = new Map(); 

async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    addLog('ERROR', 'AI Error: Missing API Key in environment variables.');
    return { text: "System Configuration Error.", isSerious: false };
  }
  
  const ai = new GoogleGenAI({ apiKey });
  const maintenanceText = maintenanceRecords.length > 0 
    ? maintenanceRecords.map(m => `${m.area} (${m.status})`).join(', ')
    : "Operational.";

  const SYSTEM_PROMPT = `Role: EcoSpot Kenya. Rule: Max 1 sentence. No greetings. Paybill: 400200. State: ${maintenanceText}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(h => ({
        role: h.role === 'agent' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { 
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1, 
        maxOutputTokens: 100
      }
    });
    return { text: (response.text || "").trim(), isSerious: false };
  } catch (e) {
    addLog('ERROR', `Gemini API Error: ${e.message}`);
    return { text: "Service temporarily delayed.", isSerious: false };
  }
}

async function callEvolution(endpoint, method, body) {
  if (!evolutionConfig) {
    addLog('ERROR', 'Evolution Call Failed: No configuration found.');
    return null;
  }
  let base = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
  if (!base.startsWith('http')) base = 'https://' + base;
  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    addLog('INFO', `Attempting Evolution API Request`, { url, method, endpoint });
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
    addLog('ERROR', `Network Error calling Evolution API`, { url, error: e.message });
    throw e;
  }
}

// --- 5. ROUTES ---
app.get('/api/data', (req, res) => res.json({ maintenance, issues, contacts, config: evolutionConfig }));
app.get('/api/logs', (req, res) => res.json(webhookLogs.slice(0, 50)));
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
    const err = await response?.text();
    res.json({ status: "ERROR", message: "API Check Failed", details: err });
  } catch (e) { res.json({ status: "ERROR", message: e.message }); }
});

// --- 6. WEBHOOK LOGIC ---
app.post(['/api/sync', '/messages-upsert', '/webhook'], async (req, res) => {
  const payload = req.body || {};
  res.status(200).send('ACK');

  const eventName = payload.event || 'none';
  const isMsgEvent = eventName.toLowerCase().includes('messages.upsert') || req.path.includes('messages-upsert');
  if (!isMsgEvent) return;

  const messageData = payload.data || {};
  const messageObj = (messageData.messages ? messageData.messages[0] : messageData) || {};

  if (!messageObj.key) {
    addLog('ERROR', 'Malformed Webhook: No message key found.');
    return;
  }

  const jid = messageObj.key.remoteJidAlt || messageObj.key.remoteJid;
  const msgContent = messageObj.message || {};
  const text = msgContent.conversation || msgContent.extendedTextMessage?.text || messageObj.text || '';

  if (!jid || !text) {
    addLog('INFO', 'Incomplete message data, skipping processing.');
    return;
  }

  // Filter Outgoing
  if (messageObj.key.fromMe === true) return;

  if (!evolutionConfig) {
    addLog('ERROR', 'Cannot process message: Evolution API settings missing.');
    return;
  }

  addLog('WEBHOOK', `Message Received from ${jid}`, { text });

  // History Management
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 4) history.shift();

  try {
    const targetNumber = jid.split('@')[0];
    
    // Typing indicator
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { 
      number: targetNumber, presence: 'composing' 
    });

    // AI Generation
    addLog('INFO', `Requesting Gemini Response for ${targetNumber}`);
    const { text: aiResponse } = await generateAIResponse(history, maintenance);
    history.push({ role: 'agent', content: aiResponse });

    // Send Result
    addLog('INFO', `Sending AI Response to Evolution...`);
    const sendResult = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { 
      number: targetNumber, 
      text: aiResponse 
    });

    if (sendResult && sendResult.ok) {
      addLog('SUCCESS', `Message sent to ${targetNumber} successfully.`);
    } else {
      const errText = await sendResult?.text();
      addLog('ERROR', `Evolution API rejected the message!`, { 
        status: sendResult?.status, 
        responseBody: errText,
        attemptedNumber: targetNumber
      });
    }
  } catch (e) {
    addLog('ERROR', `Critical processing exception: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.listen(PORT, () => console.log(`EcoSpot Server Ready on Port ${PORT}`));
