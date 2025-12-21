
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

// Simple In-Memory Conversation Storage for Context/Memory
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

// --- EcoSpot ISP System Prompt (Highly Efficient) ---
const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent for EcoSpot Wifi ISP in Kenya. 

EFFICIENCY RULES:
1. Never repeat the same info twice in one chat.
2. Use bullet points for pricing.
3. If they ask about Fiber, list BOTH plans (6Mbps/1500, 20Mbps/2000).
4. If they ask about Hotspot, list the most popular vouchers (1hr/10, 24hrs/60, Weekly/280).
5. Start with "Jambo!".

TECHNICAL PROTOCOL:
- "No Internet": Check the "LOS" red light. If red, it's a fiber cut. If no lights, check power.
- "Slow Speeds": Ask if they are on 2.4G or 5G wifi. 

M-PESA:
- Paybill: 400200. Account: Use your mobile number.

{MAINTENANCE_STATUS}
`;

async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { text: "AI Key missing.", isSerious: false };
  
  const ai = new GoogleGenAI({ apiKey });
  
  const maintenanceText = maintenanceRecords.length > 0 
    ? "ACTIVE OUTAGES: " + maintenanceRecords.map(m => `${m.area} (${m.status})`).join(', ')
    : "STATUS: All systems operational.";

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
        temperature: 0.2, // Lower temperature = more precise/efficient responses
        maxOutputTokens: 250,
        thinkingConfig: { thinkingBudget: 0 } // No delay for thinking, immediate response
      }
    });
    
    const text = response.text || "";
    return { 
      text: text.replace("[SERIOUS_ISSUE_DETECTED]", "").trim(), 
      isSerious: text.includes("[SERIOUS_ISSUE_DETECTED]") 
    };
  } catch (e) {
    return { text: "Pole, I'm having a brief technical hitch. One moment.", isSerious: false };
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

// --- THE WEBHOOK LISTENER (Handles all common Evolution paths) ---
app.post(['/api/sync', '/api/sync/*', '/messages-upsert', '/webhook'], async (req, res) => {
  const payload = req.body || {};
  
  // 1. ALWAYS ACK IMMEDIATELY to free the Evolution connection
  res.status(200).send('ACK');

  // 2. LOG THE REQUEST
  addLog('WEBHOOK', `Inbound: ${payload.event || 'Unknown Event'}`, { path: req.path });

  if (payload.event === 'messages.upsert') {
    const data = payload.data || {};
    // Support both array and flat structure
    const message = (data.messages ? data.messages[0] : data) || {};
    
    if (!message.key || message.key.fromMe) return;

    const jid = message.key.remoteJid;
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || 
                 message.conversation;

    if (!text) return;

    // A. Update Memory
    if (!userMemory.has(jid)) userMemory.set(jid, []);
    const history = userMemory.get(jid);
    history.push({ role: 'user', content: text });
    if (history.length > 6) history.shift(); // Keep last 3 turns (6 messages)

    addLog('INFO', `Processing message from ${jid}: "${text}"`);

    // B. Presence Signal
    callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', {
      number: jid.split('@')[0],
      presence: 'composing'
    }).catch(() => {});

    // C. AI Intelligence
    const { text: aiResponse } = await generateAIResponse(history, maintenance);
    history.push({ role: 'agent', content: aiResponse });

    // D. Final Reply
    try {
      await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', {
        number: jid.split('@')[0],
        text: aiResponse
      });
      addLog('SUCCESS', `Sent efficient response to ${jid}`);
    } catch (e) {
      addLog('ERROR', `Failed to send WhatsApp message: ${e.message}`);
    }
  }
});

// GET health check
app.get(['/api/sync', '/messages-upsert'], (req, res) => {
  res.json({ status: "EcoSpot Webhook Listener Active", advice: "Ensure you use POST in Evolution API." });
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`EcoSpot Node is active on port ${PORT}`));
