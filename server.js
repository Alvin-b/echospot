
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. CRITICAL: BODY PARSERS MUST BE FIRST ---
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
  if (webhookLogs.length > 200) webhookLogs.pop(); // Increased log history
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

  // INCREASED PREVIEW TO 4000 chars to avoid truncation
  const preview = bodyContent.substring(0, 4000);
  
  addLog('INFO', `Request Received: ${req.path}`, {
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    },
    body: preview + (bodyContent.length > 4000 ? '...' : '')
  });
  next();
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    addLog('ERROR', 'Payload is not valid JSON.', { error: err.message, raw: req.rawBody });
    return res.status(200).send('ACK_PARSE_ERROR'); 
  }
  next();
});

// --- 4. SERVER STATE & AI LOGIC ---
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

// --- 5. DASHBOARD ROUTES ---
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

// --- 6. WEBHOOK HANDLER ---
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
    if (event !== 'test' && event !== '') addLog('INFO', `Ignored Event Type: ${payload.event}`);
    return;
  }

  // 3. Extract Message Object
  const messageData = payload.data || {};
  const messageObj = (messageData.messages ? messageData.messages[0] : messageData) || {};

  if (!messageObj.key) {
    addLog('INFO', 'Skipped: Payload has no message key.');
    return;
  }

  // Handle status updates which are not messages
  if (messageObj.status && messageObj.status !== 'PENDING') {
    addLog('INFO', `Skipped: Event is a status update (${messageObj.status})`);
    return;
  }

  if (messageObj.key.fromMe === true) {
    addLog('INFO', 'Skipped: Outgoing message.');
    return;
  }

  const jid = messageObj.key.remoteJid;
  if (!jid) {
    addLog('INFO', 'Skipped: remoteJid is missing.');
    return;
  }

  // 4. Robust Text Content Search
  let text = '';
  const msg = messageObj.message || {};
  
  text = msg.conversation || 
         msg.extendedTextMessage?.text || 
         msg.imageMessage?.caption ||
         msg.videoMessage?.caption ||
         messageObj.conversation || 
         messageObj.text ||
         '';

  // Some versions put the message content inside a 'text' property directly in messageObj
  if (!text && messageObj.message?.text) text = messageObj.message.text;

  if (!text || text.trim().length === 0) {
    addLog('INFO', 'Skipped: No text content found in message structure.', { 
      hasMessage: !!messageObj.message,
      messageKeys: messageObj.message ? Object.keys(messageObj.message) : []
    });
    return;
  }

  // 5. Check Config
  if (!evolutionConfig) {
    addLog('ERROR', 'Reply Aborted: No Evolution Config in memory.');
    return;
  }

  addLog('WEBHOOK', `Processing: "${text.substring(0, 50)}..."`, { from: jid });

  // 6. Manage Context
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 8) history.shift();

  try {
    // 7. Presence
    const cleanNumber = jid.split('@')[0];
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { 
      number: cleanNumber, 
      presence: 'composing' 
    });

    // 8. Generate AI Response
    const { text: aiResponse } = await generateAIResponse(history, maintenance);
    history.push({ role: 'agent', content: aiResponse });

    // 9. Send Reply
    const sendResult = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { 
      number: cleanNumber, 
      text: aiResponse 
    });

    if (sendResult && sendResult.ok) {
      addLog('SUCCESS', `Replied to ${cleanNumber}`);
    } else {
      const errBody = await sendResult?.text();
      addLog('ERROR', `Evolution Send Error: ${sendResult?.status}`, { response: errBody });
    }
  } catch (e) {
    addLog('ERROR', `AI/Send Exception: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.listen(PORT, () => console.log(`EcoSpot Node Active on Port ${PORT}`));
