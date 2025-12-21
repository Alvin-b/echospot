
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

// --- EcoSpot ISP System Prompt (Optimized for Efficiency) ---
const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent for EcoSpot Wifi ISP in Kenya. 
GOAL: Resolve customer issues with MINIMUM words. Be fast, be helpful.

EFFICIENCY RULES:
1. First reply must be under 20 words.
2. If they ask for plans, list ONLY the price and speed. Do not explain them.
3. Use Kenyan local terms: "Jambo!", "Pole sana", "M-Pesa".
4. If they have "No internet", ask: "Is the LOS light red on your router?"

PRICING:
- Fiber: 6Mbps (1,500/=), 20Mbps (2,000/=).
- Hotspot: 1hr (10/=), 24hrs (60/=), Week (280/=).
- M-Pesa: Paybill 400200.

OUTAGE STATUS: {MAINTENANCE_STATUS}
`;

async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    addLog('ERROR', 'CRITICAL: Server-side API_KEY is missing. Please add it to your environment variables.');
    return { text: "System Error: The AI Agent's server key is not configured. Please contact EcoSpot Admin.", isSerious: false };
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const maintenanceText = maintenanceRecords.length > 0 
    ? maintenanceRecords.map(m => `${m.area} (${m.status})`).join(', ')
    : "All regions operational.";

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
        temperature: 0.1, // Near-zero for extreme efficiency and consistency
        maxOutputTokens: 150,
        thinkingConfig: { thinkingBudget: 0 } // No reasoning delay
      }
    });
    
    const text = response.text || "";
    return { 
      text: text.replace("[SERIOUS_ISSUE_DETECTED]", "").trim(), 
      isSerious: text.includes("[SERIOUS_ISSUE_DETECTED]") 
    };
  } catch (e) {
    addLog('ERROR', `AI Generation Error: ${e.message}`);
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
    body: JSON.stringify(body)
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
    const response = await callEvolution('/instance/fetchInstances', 'GET');
    if (!response || !response.ok) return res.json({ status: "ERROR", message: "API Unreachable" });
    const instances = await response.json();
    const myInstance = Array.isArray(instances) ? instances.find(i => i.instanceName === evolutionConfig.instanceName || i.name === evolutionConfig.instanceName) : null;
    res.json({ status: myInstance?.status === 'open' ? 'CONNECTED' : 'DISCONNECTED' });
  } catch (e) { res.json({ status: "ERROR", message: e.message }); }
});

// --- ENHANCED WEBHOOK LISTENER ---
app.post(['/api/sync', '/messages-upsert', '/webhook'], async (req, res) => {
  // 1. Instant Acknowledge (Speed Priority)
  res.status(200).send('ACK');

  const payload = req.body || {};
  if (payload.event !== 'messages.upsert') return;

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

  addLog('WEBHOOK', `Processing: ${text.substring(0, 30)}...`, { from: jid });

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
  if (!process.env.API_KEY) {
    console.error("WARNING: API_KEY is missing from environment variables!");
  }
});
