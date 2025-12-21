
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
// Robust JSON parsing for webhooks
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
  
  // URL NORMALIZATION (Crucial for Node fetch)
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
        // High-compatibility User Agent for Cloudflare Bypass
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
    
    // Check using fetchInstances as it's the most reliable fallback
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
    // Support both direct array and wrapped object responses
    const list = Array.isArray(instances) ? instances : (instances.instances || []);
    const mine = list.find(i => 
      (i.instanceName === evolutionConfig.instanceName) || 
      (i.name === evolutionConfig.instanceName)
    );

    if (mine) {
      const state = mine.status || mine.state;
      return res.json({ 
        status: state === 'open' ? 'CONNECTED' : 'DISCONNECTED', 
        state: state 
      });
    } else {
      return res.json({ 
        status: 'ERROR', 
        message: `Instance "${evolutionConfig.instanceName}" was not found in your Evolution account.` 
      });
    }
  } catch (e) { 
    res.json({ status: "ERROR", message: `Connection Failed: ${e.message}` }); 
  }
});

// --- WEBHOOK LISTENER ---
app.post(['/api/sync', '/messages-upsert', '/webhook'], async (req, res) => {
  // Acknowledge IMMEDIATELY
  res.status(200).send('ACK');

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const payload = req.body || {};

  // Handle Evolution "Test Webhook" button
  if (payload.event === 'test' || !payload.event) {
    addLog('SUCCESS', 'Received Webhook Test Event', { source: ip });
    return;
  }

  if (payload.event !== 'messages.upsert') return;

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
  if (history.length > 6) history.shift();

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
  const keyToUse = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!keyToUse) {
    console.error("WARNING: No GEMINI_API_KEY found in environment!");
  } else {
    console.log(`SUCCESS: AI Key detected (Ending: ...${keyToUse.slice(-4)})`);
  }
});
