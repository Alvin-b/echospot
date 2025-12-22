
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

// --- 4. AI CORE (Conversational Kernel) ---
async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    addLog('ERROR', 'AI Error: Missing API_KEY on server.');
    return { text: "Our AI service is currently unavailable. Please contact our support team directly.", isSerious: false };
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const maintenanceText = maintenanceRecords.length > 0 
    ? maintenanceRecords.map(m => `Location: ${m.area}, Status: ${m.status}, Details: ${m.description}`).join('\n')
    : "The network is currently stable with no reported outages.";

  // UPDATED: High-fidelity system prompt for a better conversational agent
  const SYSTEM_PROMPT = `You are "EcoSpot AI", a friendly and highly skilled customer support agent for EcoSpot Kenya, a Wifi ISP. 

PERSONALITY:
- Professional, empathetic, and localized (use words like 'Jambo', 'Asante', or 'Pole').
- You represent a local Kenyan business.

KNOWLEDGE BASE:
1. Fiber Monthly Plans: 
   - Eco Basic: 6 Mbps @ KES 1,500
   - Eco Pro: 20 Mbps @ KES 2,000
   - Installation Fee: KES 4,500 (one-time).
2. Hotspot Vouchers:
   - 1 Hour: 10/-
   - 12 Hours: 30/-
   - 24 Hours: 60/-
   - 1 Week: 280/-
   - 1 Month: 750/-
3. Payments:
   - Paybill: 400200
   - Account Number: Use your Mobile Phone Number.
4. Troubleshooting:
   - "LOS Red Light": This means a fiber signal break. Ask if the cable is bent or damaged.
   - "Slow Internet": Advise to restart the router by unplugging for 30 seconds.
   - "Not connecting": Check if the subscription is still active or expired.

CURRENT NETWORK STATUS:
${maintenanceText}

CONVERSATION RULES:
- Greet the user naturally if it's the start of the chat.
- Provide clear, actionable advice.
- Keep responses concise (2-4 sentences max).
- If the customer mentions a physical break or "LOS Red Light", add [CRITICAL_FAULT] to your response.
- Do NOT say "As an AI model". You ARE EcoSpot Support.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(h => ({
        role: h.role === 'agent' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { 
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3, // Slightly higher for more natural variety
        maxOutputTokens: 300
      }
    });

    const rawText = response.text || "Jambo! EcoSpot Support here. How can I assist you with your internet today?";
    const isSerious = rawText.includes("[CRITICAL_FAULT]");
    const cleanText = rawText.replace("[CRITICAL_FAULT]", "").trim();
    
    return { text: cleanText, isSerious };
  } catch (e) {
    addLog('ERROR', `AI Engine Failure: ${e.message}`);
    return { text: "I'm having a bit of trouble accessing our systems. Please try again in a few moments, Asante!", isSerious: false };
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
    addLog('ERROR', `Proxy Connection Refused`, { url, error: e.message });
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
app.post(['/api/sync', '/webhook', '/api/webhook', '/sync', '/api/sync/messages-upsert', '/messages-upsert'], async (req, res) => {
  let payload = req.body;
  res.status(200).send('ACK');

  // Handle nested/stringified payloads
  if (payload.body && typeof payload.body === 'string' && payload.body.includes('{')) {
    try { payload = JSON.parse(payload.body); } catch (e) {}
  }

  const eventName = payload.event || 'none';
  addLog('INFO', `Traffic: ${eventName} on ${req.path}`);

  // Filtering logic
  const isMessageUpsert = eventName.toLowerCase().includes('upsert') || 
                          (payload.data && payload.data.messages) ||
                          (payload.messages);

  if (!isMessageUpsert && !req.path.includes('sync')) return;

  const data = payload.data || payload;
  const messageObj = (data.messages ? data.messages[0] : data) || {};
  
  if (!messageObj.key || messageObj.key.fromMe) return;

  const jid = messageObj.key.remoteJidAlt || messageObj.key.remoteJid;
  const content = messageObj.message || {};
  const text = content.conversation || content.extendedTextMessage?.text || messageObj.text || '';

  if (!jid || !text) return;

  // Auto-config from incoming packets if possible
  if (!evolutionConfig && payload.apikey && payload.server_url) {
    evolutionConfig = { 
      baseUrl: payload.server_url, 
      apiKey: payload.apikey, 
      instanceName: payload.instance || 'me' 
    };
    addLog('INFO', 'Auto-discovery: API config updated from webhook.');
  }

  if (!evolutionConfig) {
    addLog('ERROR', 'No configuration found. Please visit /settings and save your API details.');
    return;
  }

  addLog('WEBHOOK', `Chat From ${jid.split('@')[0]}: "${text}"`);

  // Memory Persistence
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 15) history.shift(); // Slightly longer memory

  try {
    const target = jid.split('@')[0];
    
    // Set WhatsApp Presence to "Typing"
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { 
      number: target, 
      presence: 'composing' 
    });
    
    // AI Reasoning
    addLog('INFO', `AI Kernel thinking for ${target}...`);
    const { text: aiResponse, isSerious } = await generateAIResponse(history, maintenance);
    
    if (isSerious) {
      issues.push({ 
        id: Date.now().toString(), 
        customerPhone: target, 
        location: 'Auto-Flagged', 
        description: text, 
        severity: 'Critical', 
        timestamp: new Date(), 
        status: 'Pending' 
      });
      addLog('INFO', `Alert: Serious fault logged for customer ${target}`);
    }

    history.push({ role: 'agent', content: aiResponse });

    // Dispatch WhatsApp Reply
    const result = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { 
      number: jid, 
      text: aiResponse 
    });

    if (result && result.ok) {
      addLog('SUCCESS', `Response Sent to ${target}`, { reply: aiResponse });
    } else {
      const errorData = await result?.text();
      addLog('ERROR', 'Evolution API refused to send message.', { status: result?.status, error: errorData });
    }
  } catch (e) {
    addLog('ERROR', `Kernel Panic: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n================================`);
  console.log(` EcoSpot ISP AI Node - ONLINE `);
  console.log(` Port: ${PORT} `);
  console.log(`================================\n`);
});
