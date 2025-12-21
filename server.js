
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
  addLog('INFO', `Incoming Request: ${req.method} ${req.path}`, {
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    contentType: req.headers['content-type']
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
    addLog('ERROR', 'Malformed JSON payload received.', { error: err.message });
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
    console.error("Evolution Config is missing in memory!");
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
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
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
            return res.json({ 
              status: isConnected ? 'CONNECTED' : 'DISCONNECTED', 
              state: state 
            });
          }
        }
      } catch (e) {
        console.warn(`Endpoint ${endpoint} failed, trying next...`);
      }
    }

    const listResponse = await callEvolution('/instance/fetchInstances', 'GET');
    if (listResponse && listResponse.ok) {
      const instances = await listResponse.json();
      const list = Array.isArray(instances) ? instances : (instances.instances || []);
      const mine = list.find(i => (i.instanceName === evolutionConfig.instanceName) || (i.name === evolutionConfig.instanceName));

      if (mine) {
        const state = mine.status || mine.state || mine.connectionStatus || 'Unknown';
        const isConnected = typeof state === 'string' && ['open', 'connected', 'CONNECTED'].includes(state.toLowerCase());
        return res.json({ 
          status: isConnected ? 'CONNECTED' : 'DISCONNECTED', 
          state: state
        });
      }
    }

    res.json({ status: "ERROR", message: `Could not verify status of "${evolutionConfig.instanceName}". Verify URL and Global Key.` });
  } catch (e) { 
    res.json({ status: "ERROR", message: `Connection Failed: ${e.message}` }); 
  }
});

// --- WEBHOOK HANDLER ---
app.post(['/api/sync', '/messages-upsert', '/webhook'], async (req, res) => {
  const payload = req.body || {};
  
  // Handle Test events
  if (payload.event === 'test' || payload.type === 'test' || Object.keys(payload).length === 0) {
    addLog('SUCCESS', 'Webhook verified (Test Event)');
    return res.status(200).send('ACK');
  }

  // Acknowledge Evolution API immediately to prevent retries
  res.status(200).send('ACK');

  // Determine if this is a message event
  const eventName = (payload.event || '').toLowerCase();
  const isMessageUpsert = eventName === 'messages.upsert' || 
                          eventName === 'messages_upsert' || 
                          req.path.includes('messages-upsert');

  if (!isMessageUpsert) {
    addLog('INFO', `Ignored Event: ${payload.event || 'Unknown'}`);
    return;
  }

  // Configuration check
  if (!evolutionConfig) {
    addLog('ERROR', 'Config Missing! Open Dashboard settings and click "Save & Test".');
    return;
  }

  // Extract message data
  const data = payload.data || {};
  const messageObj = (data.messages ? data.messages[0] : data) || {};
  
  if (!messageObj.key || messageObj.key.fromMe) return;

  const jid = messageObj.key.remoteJid;
  
  // Exhaustive search for text content
  const text = messageObj.message?.conversation || 
               messageObj.message?.extendedTextMessage?.text || 
               messageObj.message?.text ||
               messageObj.conversation ||
               '';

  if (!text || text.trim().length === 0) {
    addLog('INFO', 'Received non-text message (ignored).', { jid });
    return;
  }

  addLog('WEBHOOK', `Msg: "${text.substring(0, 30)}..."`, { from: jid });

  // History management
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 10) history.shift();

  try {
    // 1. Show 'typing' presence
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { 
      number: jid.split('@')[0], 
      presence: 'composing' 
    });

    // 2. AI Logic
    const { text: aiResponse } = await generateAIResponse(history, maintenance);
    history.push({ role: 'agent', content: aiResponse });

    // 3. Send Text
    const sendResult = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { 
      number: jid.split('@')[0], 
      text: aiResponse 
    });

    if (sendResult && sendResult.ok) {
      addLog('SUCCESS', `Replied to ${jid.split('@')[0]}`);
    } else {
      const errText = await sendResult?.text();
      addLog('ERROR', `Evolution rejected reply: ${sendResult?.status}`, { raw: errText });
    }
  } catch (e) {
    addLog('ERROR', `Processing error: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.listen(PORT, () => console.log(`EcoSpot Node Active on Port ${PORT}`));
