
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

// --- EcoSpot ISP System Prompt (Ultra Efficient) ---
const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent for EcoSpot Wifi ISP in Kenya. 
COMMUNICATION STYLE: Ultra-concise, technical, and fast. No fluff.

EFFICIENCY PROTOCOL:
1. One-sentence limit for most replies.
2. Never repeat info. 
3. After the first "Jambo!", stop using greetings.
4. "No internet": Ask if the router's "LOS" light is red.
5. "Slow speeds": Tell them to restart the router and test via cable.

PRICING (DON'T EXPLAIN):
- Fiber: 6Mbps (1,500/=), 20Mbps (2,000/=).
- Hotspot: 1hr (10/=), 24hrs (60/=), Week (280/=).
- M-Pesa: Paybill 400200. Account: [Phone Number].

OUTAGE STATUS: {MAINTENANCE_STATUS}
`;

async function generateAIResponse(history, maintenanceRecords) {
  // Check both standard names for the API Key
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.length < 5) {
    addLog('ERROR', 'CRITICAL: No AI Key found in GEMINI_API_KEY. Check your hosting environment variables.');
    return { text: "System Error: Missing API Key. Admin must set GEMINI_API_KEY correctly.", isSerious: false };
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const maintenanceText = maintenanceRecords.length > 0 
    ? maintenanceRecords.map(m => `${m.area} (${m.status})`).join(', ')
    : "All systems operational.";

  const finalInstruction = SYSTEM_PROMPT.replace('{MAINTENANCE_STATUS}', maintenanceText);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(h => ({
        role: h.role === 'agent' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { 
        systemInstruction: finalInstruction,
        temperature: 0.1, 
        maxOutputTokens: 100, 
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    
    const text = response.text || "";
    return { 
      text: text.replace("[SERIOUS_ISSUE_DETECTED]", "").trim(), 
      isSerious: text.includes("[SERIOUS_ISSUE_DETECTED]") 
    };
  } catch (e) {
    addLog('ERROR', `AI Error: ${e.message}`);
    return { text: "Pole, I am currently facing a small delay. Please try again.", isSerious: false };
  }
}

async function callEvolution(endpoint, method, body) {
  if (!evolutionConfig) return null;
  const baseUrl = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
  const url = `${baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl}${endpoint}`;
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'apikey': evolutionConfig.apiKey },
    body: body ? JSON.stringify(body) : undefined
  });
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
    
    // More robust connection status check using specific instance endpoint
    const response = await callEvolution(`/instance/connectionStatus/${evolutionConfig.instanceName}`, 'GET');
    
    if (!response || !response.ok) {
        const errText = await response?.text();
        return res.json({ status: "ERROR", message: "API Unreachable", raw: errText });
    }
    
    const statusData = await response.json();
    const state = statusData?.instance?.state || statusData?.state;
    
    if (state === 'open') {
        res.json({ status: 'CONNECTED', state });
    } else {
        res.json({ 
            status: 'DISCONNECTED', 
            state: state || 'unknown',
            message: `Evolution reports state is "${state || 'unknown'}". You may need to scan the QR code.`
        });
    }
  } catch (e) { res.json({ status: "ERROR", message: e.message }); }
});

// --- ENHANCED WEBHOOK LISTENER ---
app.post(['/api/sync', '/messages-upsert', '/webhook'], async (req, res) => {
  // 1. Instant Acknowledge
  res.status(200).send('ACK');

  const payload = req.body || {};
  if (payload.event !== 'messages.upsert') {
    if (payload.event) addLog('INFO', `Received non-message event: ${payload.event}`);
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

  // Memory & Context
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 4) history.shift();

  addLog('WEBHOOK', `Inbound: ${text.substring(0, 30)}...`, { from: jid });

  // 2. Typing indicator
  callEvolution(`/chat/sendPresence/${evolutionConfig?.instanceName}`, 'POST', {
    number: jid.split('@')[0],
    presence: 'composing'
  }).catch(() => {});

  // 3. AI Intelligence
  const { text: aiResponse } = await generateAIResponse(history, maintenance);
  history.push({ role: 'agent', content: aiResponse });

  // 4. Send Reply
  try {
    const replyRes = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', {
      number: jid.split('@')[0],
      text: aiResponse
    });
    
    if (replyRes && replyRes.ok) {
      addLog('SUCCESS', `Replied to ${jid}`);
    } else {
      const err = await replyRes?.text();
      addLog('ERROR', `Evolution API Error: ${err}`);
    }
  } catch (e) {
    addLog('ERROR', `Network error sending reply: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`EcoSpot Node Active on Port ${PORT}`);
  const keyToUse = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!keyToUse) {
    console.error("WARNING: No API Key (API_KEY or GEMINI_API_KEY) found in environment variables!");
  } else {
    console.log(`SUCCESS: AI Key detected (Starts with: ${keyToUse.substring(0, 4)}...)`);
  }
});
