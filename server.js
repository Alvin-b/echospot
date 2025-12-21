
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// --- Log Helper ---
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
  if (webhookLogs.length > 100) webhookLogs.pop();
  console.log(`[${type}] ${message}`);
}

// Global Request Catcher
app.use(['/api/sync', '/messages-upsert', '/webhook'], (req, res, next) => {
  // Capture body for debugging
  const bodyPreview = req.body ? JSON.stringify(req.body).substring(0, 300) : 'No Body';
  addLog('INFO', `Request Received: ${req.path}`, {
    method: req.method,
    body: bodyPreview + (bodyPreview.length >= 300 ? '...' : '')
  });
  next();
});

// Permissive JSON Parsing
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf.toString(); }
}));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    addLog('ERROR', 'Malformed JSON payload.', { error: err.message });
    return res.status(200).send('ACK_PARSE_ERROR'); 
  }
  next();
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Server-Side State ---
let maintenance = [];
let issues = [];
let contacts = []; 
let evolutionConfig = null;
const userMemory = new Map(); 

const SYSTEM_PROMPT = `Role: EcoSpot Support (Kenya). 
Rule: Max one sentence. No fluff/pleasantries. 
Fiber: 6Mbps(1500), 20Mbps(2000). 
Hotspot: 1hr(10), 24hrs(60). 
Paybill: 400200 (Acc: Phone No). 
No Internet: Check if router LOS light is red. 
Slow: Restart router.
Status: {MAINTENANCE_STATUS}`;

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
  if (!evolutionConfig) {
    addLog('ERROR', 'Evolution Config missing in memory. Please re-save settings in Dashboard.');
    return null;
  }
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

// --- Dashboard API ---
app.get('/api/data', (req, res) => res.json({ maintenance, issues, contacts, config: evolutionConfig }));
app.get('/api/logs', (req, res) => res.json(webhookLogs));
app.post('/api/maintenance', (req, res) => { maintenance = req.body || []; res.json({ success: true }); });
app.post('/api/issues', (req, res) => { issues = req.body || []; res.json({ success: true }); });
app.post('/api/config', (req, res) => { evolutionConfig = req.body; res.json({ success: true }); });

app.get('/api/instance/status', async (req, res) => {
  try {
    if (!evolutionConfig?.instanceName) return res.json({ status: 'NOT_CONFIGURED' });
    
    const endpoints = [
      `/instance/connectionState/${evolutionConfig.instanceName}`,
      `/instance/connect/${evolutionConfig.instanceName}`,
      `/instance/connectionStatus/${evolutionConfig.instanceName}`
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await callEvolution(endpoint, 'GET');
        if (response && response.ok) {
          const data = await response.json();
          const state = data?.instance?.state || data?.instance?.status || data?.state || data?.status;
          if (state && typeof state === 'string') {
            const isConnected = ['open', 'connected', 'CONNECTED'].includes(state.toLowerCase());
            return res.json({ status: isConnected ? 'CONNECTED' : 'DISCONNECTED', state: state });
          }
        }
      } catch (e) {}
    }
    res.json({ status: "ERROR", message: "Could not verify status." });
  } catch (e) { 
    res.json({ status: "ERROR", message: e.message }); 
  }
});

// --- WEBHOOK HANDLER ---
app.post(['/api/sync', '/messages-upsert', '/webhook'], async (req, res) => {
  const payload = req.body || {};
  
  // 1. Instantly ACK to stop retries
  res.status(200).send('ACK');

  // 2. Identify Event
  const event = (payload.event || '').toLowerCase();
  const isMsgEvent = event.includes('messages.upsert') || 
                    event.includes('messages_upsert') || 
                    req.path.includes('messages-upsert');

  if (!isMsgEvent) {
    if (event !== 'test') addLog('INFO', `Ignored Non-Message Event: ${payload.event}`);
    return;
  }

  // 3. Extract Message Object
  // Evolution can send data in payload.data.messages[0] or payload.data directly
  const messageData = payload.data || {};
  const messageObj = (messageData.messages ? messageData.messages[0] : messageData) || {};

  if (!messageObj.key) {
    addLog('INFO', 'Skipped: No message key found in payload.');
    return;
  }

  if (messageObj.key.fromMe === true) {
    addLog('INFO', 'Skipped: Message is from the agent itself.');
    return;
  }

  const jid = messageObj.key.remoteJid;
  if (!jid) {
    addLog('INFO', 'Skipped: No remoteJid found.');
    return;
  }

  // 4. Extract Text Content (Thorough search)
  const text = messageObj.message?.conversation || 
               messageObj.message?.extendedTextMessage?.text || 
               messageObj.message?.imageMessage?.caption ||
               messageObj.message?.videoMessage?.caption ||
               messageObj.conversation || 
               messageObj.text ||
               '';

  if (!text || text.trim().length === 0) {
    addLog('INFO', 'Skipped: Message contains no text content.', { jid });
    return;
  }

  // 5. Check Config
  if (!evolutionConfig) {
    addLog('ERROR', 'Reply Aborted: evolutionConfig is null. Visit API Settings to re-save.');
    return;
  }

  addLog('WEBHOOK', `Processing: "${text.substring(0, 40)}..."`, { from: jid });

  // 6. Manage Context
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 8) history.shift();

  try {
    // 7. Typing Indicator
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { 
      number: jid.split('@')[0], 
      presence: 'composing' 
    });

    // 8. Generate AI Response
    const { text: aiResponse } = await generateAIResponse(history, maintenance);
    history.push({ role: 'agent', content: aiResponse });

    // 9. Send Reply
    const sendResult = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { 
      number: jid.split('@')[0], 
      text: aiResponse 
    });

    if (sendResult && sendResult.ok) {
      addLog('SUCCESS', `Replied to ${jid.split('@')[0]}`);
    } else {
      const errBody = await sendResult?.text();
      addLog('ERROR', `Evolution rejected send: ${sendResult?.status}`, { response: errBody });
    }
  } catch (e) {
    addLog('ERROR', `Processing error: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.listen(PORT, () => console.log(`EcoSpot Node Active on Port ${PORT}`));
