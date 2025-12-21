
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

// 1. GLOBAL REQUEST CATCHER
// This catches every hit to the sync endpoint BEFORE parsing to verify connectivity
app.use(['/api/sync', '/messages-upsert', '/webhook'], (req, res, next) => {
  addLog('INFO', `Incoming Request: ${req.method} ${req.path}`, {
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    contentType: req.headers['content-type'],
    userAgent: req.headers['user-agent']
  });
  next();
});

// 2. PERMISSIVE JSON PARSING
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf.toString(); }
}));

// Error handler for JSON parsing errors (prevents 400 crashes)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    addLog('ERROR', 'Malformed JSON payload received. Parsing failed.', { error: err.message });
    return res.status(200).send('ACK_PARSE_ERROR'); 
  }
  next();
});

// 3. FORM-DATA / URL-ENCODED SUPPORT
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
  
  let base = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
  if (!base.startsWith('http')) base = 'https://' + base;
  
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${base}${cleanEndpoint}`;

  addLog('INFO', `Evolution API Request: ${method} ${cleanEndpoint}`);

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
    addLog('ERROR', `Physical Network Error: ${e.message}`, { url });
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
    
    const listResponse = await callEvolution('/instance/fetchInstances', 'GET');
    
    if (!listResponse || !listResponse.ok) {
       const errCode = listResponse?.status || 'No Response';
       const errBody = await listResponse?.text();
       return res.json({ 
         status: "ERROR", 
         message: `Server returned HTTP ${errCode}`, 
         raw: errBody,
         url: listResponse?.url 
       });
    }
    
    const instances = await listResponse.json();
    const list = Array.isArray(instances) ? instances : (instances.instances || []);
    const mine = list.find(i => 
      (i.instanceName === evolutionConfig.instanceName) || 
      (i.name === evolutionConfig.instanceName)
    );

    if (mine) {
      const state = mine.status || mine.state;
      return res.json({ 
        status: (state === 'open' || state === 'connected') ? 'CONNECTED' : 'DISCONNECTED', 
        state: state 
      });
    } else {
      return res.json({ 
        status: 'ERROR', 
        message: `Instance "${evolutionConfig.instanceName}" not found.` 
      });
    }
  } catch (e) { 
    res.json({ status: "ERROR", message: `Connection Failed: ${e.message}` }); 
  }
});

// --- WEBHOOK LISTENER ---
app.post(['/api/sync', '/messages-upsert', '/webhook'], async (req, res) => {
  // 4. EXPLICIT TEST EVENT HANDLING
  const payload = req.body || {};
  
  if (payload.event === 'test' || payload.type === 'test' || Object.keys(payload).length === 0) {
    addLog('SUCCESS', 'Webhook verified successfully (Test Event)');
    return res.status(200).send('ACK');
  }

  // Acknowledge Evolution API immediately
  res.status(200).send('ACK');

  if (payload.event !== 'messages.upsert') {
    addLog('INFO', `Ignored Event: ${payload.event || 'Unknown'}`);
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

  addLog('WEBHOOK', `Message: "${text.substring(0, 25)}..."`, { from: jid });

  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 10) history.shift();

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
    
    addLog('SUCCESS', `AI Replied to ${jid}`);
  } catch (e) {
    addLog('ERROR', `Failed to process reply: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`EcoSpot Node Active on Port ${PORT}`);
});
