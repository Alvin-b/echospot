
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
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf.toString(); }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Server-Side State ---
let maintenance = [];
let issues = [];
let contacts = []; 
let evolutionConfig = null;
let webhookLogs = []; 
const userMemory = new Map(); 

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

const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent for EcoSpot Wifi ISP in Kenya. 
COMMUNICATION STYLE: Ultra-concise, technical, and fast. No fluff.

EFFICIENCY PROTOCOL:
1. One-sentence limit for most replies.
2. After the first "Jambo!", stop using greetings.
3. "No internet": Ask if the router's "LOS" light is red.

PRICING:
- Fiber: 6Mbps (1,500/=), 20Mbps (2,000/=).
- Hotspot: 1hr (10/=), 24hrs (60/=).
- Paybill: 400200. Account: [Phone Number].

STATUS: {MAINTENANCE_STATUS}
`;

async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.length < 5) {
    addLog('ERROR', 'AI Key Missing. Set GEMINI_API_KEY in Render dashboard.');
    return { text: "System Error: Missing API Key.", isSerious: false };
  }
  
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
    addLog('ERROR', `AI Error: ${e.message}`);
    return { text: "Service temporarily delayed.", isSerious: false };
  }
}

async function callEvolution(endpoint, method, body) {
  if (!evolutionConfig) return null;
  
  // Clean Base URL: remove trailing slash, ensure https
  let base = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
  if (!base.startsWith('http')) base = 'https://' + base;
  
  // Clean Endpoint: ensure starts with slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${base}${cleanEndpoint}`;

  addLog('INFO', `Outbound to Evolution: ${method} ${cleanEndpoint}`, { url });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json', 
        'apikey': evolutionConfig.apiKey.trim() 
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    addLog('ERROR', `Network Failure calling Evolution: ${e.message}`, { url });
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
    
    const response = await callEvolution(`/instance/connectionStatus/${evolutionConfig.instanceName}`, 'GET');
    
    if (!response || !response.ok) {
        const errText = await response?.text();
        return res.json({ status: "ERROR", message: "API Unreachable", raw: errText, url: response?.url });
    }
    
    const statusData = await response.json();
    const state = statusData?.instance?.state || statusData?.state;
    
    if (state === 'open') {
        res.json({ status: 'CONNECTED', state });
    } else {
        res.json({ status: 'DISCONNECTED', state: state || 'unknown' });
    }
  } catch (e) { 
    res.json({ status: "ERROR", message: `Network: ${e.message}` }); 
  }
});

// --- WEBHOOK LISTENER ---
app.post(['/api/sync', '/messages-upsert', '/webhook'], async (req, res) => {
  // Acknowledge IMMEDIATELY to Evolution API (within < 2s)
  res.status(200).send('ACK');

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const payload = req.body || {};

  if (payload.event !== 'messages.upsert') {
    if (payload.event) addLog('INFO', `Event from ${ip}: ${payload.event}`);
    return;
  }

  const data = payload.data || {};
  const message = (data.messages ? data.messages[0] : data) || {};
  if (!message.key || message.key.fromMe) return;

  const jid = message.key.remoteJid;
  const text = message.message?.conversation || 
               message.message?.extendedTextMessage?.text || 
               message.conversation;

  if (!text) return;

  addLog('WEBHOOK', `Message from ${jid}: "${text.substring(0, 20)}..."`, { source: ip });

  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 6) history.shift();

  // Async processing after ACK
  try {
    await callEvolution(`/chat/sendPresence/${evolutionConfig?.instanceName}`, 'POST', {
      number: jid.split('@')[0],
      presence: 'composing'
    });

    const { text: aiResponse } = await generateAIResponse(history, maintenance);
    history.push({ role: 'agent', content: aiResponse });

    await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', {
      number: jid.split('@')[0],
      text: aiResponse
    });
    
    addLog('SUCCESS', `Replied to ${jid}`);
  } catch (e) {
    addLog('ERROR', `Webhook processing failed: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`EcoSpot Node Active on Port ${PORT}`);
  const keyToUse = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!keyToUse) {
    console.error("WARNING: No GEMINI_API_KEY found!");
  } else {
    console.log(`SUCCESS: AI Key detected (Ending: ...${keyToUse.slice(-4)})`);
  }
});
