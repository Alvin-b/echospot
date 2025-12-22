
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
  if (webhookLogs.length > 500) webhookLogs.pop(); 
  console.log(`[${type}] ${message}`);
}

// --- 3. SERVER STATE ---
let maintenance = [];
let issues = [];
let contacts = []; 
let evolutionConfig = null;
const userMemory = new Map(); 

// --- 4. AI CORE (Server Side Only) ---
async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    addLog('ERROR', 'AI Error: Missing API_KEY environment variable on server.');
    return { text: "System Configuration Error: Missing Server API Key.", isSerious: false };
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const maintenanceText = maintenanceRecords.length > 0 
    ? maintenanceRecords.map(m => `${m.area}: ${m.status} (${m.description})`).join('\n')
    : "All systems operational.";

  const SYSTEM_PROMPT = `Role: EcoSpot Kenya ISP. 
Rule: Max 1-2 sentences. No greetings. 
Fiber: 6Mbps (1500), 20Mbps (2000). 
Paybill: 400200. 
Current Network State: ${maintenanceText}
If a serious hardware failure is described, append [SERIOUS_ISSUE].`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(h => ({
        role: h.role === 'agent' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { 
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1, 
        maxOutputTokens: 150
      }
    });

    const rawText = response.text || "";
    const isSerious = rawText.includes("[SERIOUS_ISSUE]");
    const cleanText = rawText.replace("[SERIOUS_ISSUE]", "").trim();
    
    return { text: cleanText, isSerious };
  } catch (e) {
    addLog('ERROR', `Gemini API Error: ${e.message}`);
    return { text: "Service temporarily delayed. Please try again in a moment.", isSerious: false };
  }
}

// --- 5. EVOLUTION PROXY ---
async function callEvolution(endpoint, method, body, customConfig = null) {
  const cfg = customConfig || evolutionConfig;
  if (!cfg) return null;

  let base = cfg.baseUrl.trim().replace(/\/$/, '');
  if (!base.startsWith('http')) base = 'https://' + base;
  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json', 
        'apikey': cfg.apiKey.trim()
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return res;
  } catch (e) {
    addLog('ERROR', `Evolution Network Error`, { url, error: e.message });
    return null;
  }
}

// --- 6. ROUTES ---
app.get('/api/data', (req, res) => res.json({ maintenance, issues, contacts, config: evolutionConfig }));
app.get('/api/logs', (req, res) => res.json(webhookLogs.slice(0, 150)));
app.post('/api/maintenance', (req, res) => { maintenance = req.body || []; res.json({ success: true }); });
app.post('/api/issues', (req, res) => { issues = req.body || []; res.json({ success: true }); });
app.post('/api/config', (req, res) => { evolutionConfig = req.body; res.json({ success: true }); });

// Proxy for the frontend simulator to avoid browser Gemini errors
app.post('/api/ai/simulate', async (req, res) => {
  const { history } = req.body;
  const result = await generateAIResponse(history || [], maintenance);
  res.json(result);
});

app.get('/api/instance/status', async (req, res) => {
  if (!evolutionConfig?.instanceName) return res.json({ status: 'NOT_CONFIGURED' });
  const response = await callEvolution(`/instance/connectionState/${evolutionConfig.instanceName}`, 'GET');
  if (response && response.ok) {
    const data = await response.json();
    const state = data?.instance?.state || data?.state;
    const isConnected = ['open', 'connected'].includes(String(state).toLowerCase());
    return res.json({ status: isConnected ? 'CONNECTED' : 'DISCONNECTED', state });
  }
  res.json({ status: "ERROR" });
});

// --- 7. WEBHOOK KERNEL ---
app.post(['/api/sync', '/webhook'], async (req, res) => {
  let payload = req.body;
  res.status(200).send('ACK');

  // Deep Parse: Handle cases where the JSON is stringified inside a 'body' property
  if (payload.body && typeof payload.body === 'string' && payload.body.includes('{')) {
    try {
      addLog('INFO', 'Deep Parsing Wrapped Webhook Payload...');
      payload = JSON.parse(payload.body);
    } catch (e) {
      addLog('ERROR', 'Failed to parse wrapped payload body', { error: e.message });
    }
  }

  const eventName = payload.event || 'none';
  if (!eventName.toLowerCase().includes('messages.upsert')) {
    addLog('INFO', `Ignored Event: ${eventName}`);
    return;
  }

  const messageData = payload.data || {};
  const messageObj = (messageData.messages ? messageData.messages[0] : messageData) || {};

  if (!messageObj.key || messageObj.key.fromMe) {
    addLog('INFO', 'Skipping outgoing or system message.');
    return;
  }

  const jid = messageObj.key.remoteJidAlt || messageObj.key.remoteJid;
  const msgContent = messageObj.message || {};
  const text = msgContent.conversation || msgContent.extendedTextMessage?.text || messageObj.text || '';

  if (!jid || !text) {
    addLog('INFO', 'Incomplete message data received.', { jid, hasText: !!text });
    return;
  }

  // Auto-Persist Config from Webhook
  if (!evolutionConfig && payload.apikey && payload.server_url) {
    addLog('INFO', 'Hot-Configuring Evolution settings from Webhook payload.');
    evolutionConfig = {
      baseUrl: payload.server_url,
      apiKey: payload.apikey,
      instanceName: payload.instance || 'me'
    };
  }

  if (!evolutionConfig) {
    addLog('ERROR', 'Message dropped: No API configuration found.');
    return;
  }

  addLog('WEBHOOK', `Inbound: "${text}"`, { sender: jid });

  // Manage Memory
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 10) history.shift();

  try {
    const targetNumber = jid.split('@')[0];
    
    // 1. Presence
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { 
      number: targetNumber, presence: 'composing' 
    });

    // 2. AI Generate
    addLog('INFO', `Generating AI response for ${targetNumber}...`);
    const { text: aiResponse, isSerious } = await generateAIResponse(history, maintenance);
    
    // 3. Log Serious Issues
    if (isSerious) {
      issues.push({
        id: Date.now().toString(),
        customerPhone: targetNumber,
        location: 'Detected via AI',
        description: text,
        severity: 'Critical',
        timestamp: new Date(),
        status: 'Pending'
      });
      addLog('INFO', `Critical issue flagged and logged to dashboard for ${targetNumber}`);
    }

    history.push({ role: 'agent', content: aiResponse });

    // 4. Send
    const sendResult = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { 
      number: jid, 
      text: aiResponse 
    });

    if (sendResult && sendResult.ok) {
      addLog('SUCCESS', `Replied to ${targetNumber}`, { reply: aiResponse });
    } else {
      const err = await sendResult?.text();
      addLog('ERROR', 'Evolution API Rejected Reply', { status: sendResult?.status, error: err });
    }
  } catch (e) {
    addLog('ERROR', `Kernel Panic: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.listen(PORT, () => console.log(`EcoSpot ISP Server Node Active on Port ${PORT}`));
