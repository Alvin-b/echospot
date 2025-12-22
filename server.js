
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
    addLog('ERROR', 'AI Error: Missing API_KEY on server.');
    return { text: "Configuration Error: API Key missing.", isSerious: false };
  }
  
  const ai = new GoogleGenAI({ apiKey });
  const maintenanceText = maintenanceRecords.length > 0 
    ? maintenanceRecords.map(m => `${m.area}: ${m.status}`).join('\n')
    : "All systems operational.";

  const SYSTEM_PROMPT = `Role: EcoSpot Kenya ISP. Rule: Max 1 sentence. No greetings. Paybill: 400200. Network: ${maintenanceText}. If serious fault, add [SERIOUS_ISSUE].`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(h => ({
        role: h.role === 'agent' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.1, maxOutputTokens: 100 }
    });

    const rawText = response.text || "";
    return { 
      text: rawText.replace("[SERIOUS_ISSUE]", "").trim(), 
      isSerious: rawText.includes("[SERIOUS_ISSUE]") 
    };
  } catch (e) {
    addLog('ERROR', `AI Gen Error: ${e.message}`);
    return { text: "Service busy, try again.", isSerious: false };
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
      headers: { 'Content-Type': 'application/json', 'apikey': cfg.apiKey.trim() },
      body: body ? JSON.stringify(body) : undefined
    });
    return res;
  } catch (e) {
    addLog('ERROR', `Proxy Error`, { url, error: e.message });
    return null;
  }
}

// --- 6. ROUTES ---
app.get('/api/data', (req, res) => res.json({ maintenance, issues, contacts, config: evolutionConfig }));
app.get('/api/logs', (req, res) => res.json(webhookLogs.slice(0, 150)));
app.post('/api/maintenance', (req, res) => { maintenance = req.body || []; res.json({ success: true }); });
app.post('/api/issues', (req, res) => { issues = req.body || []; res.json({ success: true }); });
app.post('/api/config', (req, res) => { evolutionConfig = req.body; res.json({ success: true }); });

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
    const isConnected = ['open', 'connected'].includes(String(data?.instance?.state || data?.state).toLowerCase());
    return res.json({ status: isConnected ? 'CONNECTED' : 'DISCONNECTED' });
  }
  res.json({ status: "ERROR" });
});

// --- 7. WEBHOOK KERNEL ---
// Added specific sub-paths found in logs: /api/sync/messages-upsert
app.post(['/api/sync', '/webhook', '/api/webhook', '/sync', '/api/sync/messages-upsert', '/messages-upsert'], async (req, res) => {
  let payload = req.body;
  res.status(200).send('ACK');

  // Deep Parse: Handle cases where the JSON is stringified inside a 'body' property (common in some proxy setups)
  if (payload.body && typeof payload.body === 'string' && payload.body.includes('{')) {
    try {
      payload = JSON.parse(payload.body);
      addLog('INFO', 'Extracted JSON from body string');
    } catch (e) {}
  }

  const eventName = payload.event || 'none';
  addLog('INFO', `Packet Received at ${req.path}: ${eventName}`, { 
    keys: Object.keys(payload),
    event: eventName 
  });

  // Catch-all for Evolution API message events
  const isMessageUpsert = eventName.toLowerCase().includes('upsert') || 
                          (payload.data && payload.data.messages) ||
                          (payload.messages);

  if (!isMessageUpsert && !req.path.includes('sync')) {
    addLog('INFO', `Filtered non-message event: ${eventName}`);
    return;
  }

  // Multi-Version Data Extraction
  const data = payload.data || payload;
  const messageObj = (data.messages ? data.messages[0] : data) || {};
  
  if (!messageObj.key || messageObj.key.fromMe) {
    addLog('INFO', 'Filtering outgoing or system message');
    return;
  }

  const jid = messageObj.key.remoteJidAlt || messageObj.key.remoteJid;
  const content = messageObj.message || {};
  const text = content.conversation || content.extendedTextMessage?.text || messageObj.text || '';

  if (!jid || !text) {
    addLog('INFO', 'Message structure incomplete or empty text', { jid, hasText: !!text });
    return;
  }

  // Auto-Config Persistence from Metadata (if present)
  if (!evolutionConfig && payload.apikey && payload.server_url) {
    evolutionConfig = { 
      baseUrl: payload.server_url, 
      apiKey: payload.apikey, 
      instanceName: payload.instance || 'me' 
    };
    addLog('INFO', 'Auto-configured API from webhook metadata');
  }

  if (!evolutionConfig) {
    addLog('ERROR', 'Dropped: No API Config. Save settings in dashboard first.');
    return;
  }

  addLog('WEBHOOK', `Processing: "${text}"`, { from: jid });

  // Memory Management
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 10) history.shift();

  try {
    const target = jid.split('@')[0];
    
    // Send presence typing indicator
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { 
      number: target, 
      presence: 'composing' 
    });
    
    // AI Content Generation
    addLog('INFO', `Generating AI reply for ${target}...`);
    const { text: aiResponse, isSerious } = await generateAIResponse(history, maintenance);
    
    if (isSerious) {
      issues.push({ 
        id: Date.now().toString(), 
        customerPhone: target, 
        location: 'AI Detected', 
        description: text, 
        severity: 'Critical', 
        timestamp: new Date(), 
        status: 'Pending' 
      });
    }

    history.push({ role: 'agent', content: aiResponse });

    // Send the reply back to WhatsApp
    const result = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { 
      number: jid, 
      text: aiResponse 
    });

    if (result && result.ok) {
      addLog('SUCCESS', `Replied to ${target}`, { reply: aiResponse });
    } else {
      const errorText = await result?.text();
      addLog('ERROR', 'Evolution API Rejected Send', { status: result?.status, error: errorText });
    }
  } catch (e) {
    addLog('ERROR', `Kernel Exception: ${e.message}`);
  }
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n--- EcoSpot ISP Server Node ---`);
  console.log(`Status: Active`);
  console.log(`Port: ${PORT}`);
  console.log(`Webhook Endpoint: /api/sync`);
  console.log(`-------------------------------\n`);
});
