
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

// --- 3. SERVER STATE (Mock Database) ---
let maintenance = [];
let issues = [];
let contacts = []; 
let evolutionConfig = null;
const userMemory = new Map(); 

// --- 4. AI CORE (Optimized for Quota & Human-Like Flow) ---
async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    addLog('ERROR', 'AI Error: Missing API_KEY on server.');
    return { text: "Our systems are currently under maintenance. Please call 0700 000 000 for urgent support. Asante.", escalationReason: null };
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const activeOutages = maintenanceRecords
    .filter(m => m.status === 'Outage' || m.status === 'In Progress')
    .map(m => `- ${m.area}: ${m.description} (Resolution: ${m.estimatedResolution || 'TBD'})`)
    .join('\n');

  const maintenanceContext = activeOutages.length > 0 
    ? `KNOWN NETWORK ISSUES:\n${activeOutages}`
    : "The network backbone is healthy. No widespread outages reported.";

  const SYSTEM_PROMPT = `You are "EcoSpot AI", the senior support agent for EcoSpot Wifi ISP, Kenya. 

CONVERSATIONAL RULES:
1. **NO REPETITIVE GREETINGS**: Do NOT start every reply with "Jambo!". If the user says "Hi", say "Jambo" or "Habari". If the user asks a question after that, answer it DIRECTLY without a greeting. 
2. **STAY CONCISE**: Use simple, natural Kenyan English. Don't be too robotic.
3. **COMPLETE THOUGHTS**: Finish every sentence. If quoting a price (e.g. 1,500 KES), explain what it buys.
4. **COVERAGE**: We are in Kutus. Murang'a is NOT covered yet.

DIAGNOSTICS:
- If troubleshooting (restarts, cables) fails or user says they already tried it, ESCALATE.
- If the problem is "constant" or "every day", ESCALATE.

ESCALATE FORMAT: Append "[ESCALATE: <Reason>]" only if needed.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // CHANGED: Flash has MUCH higher free-tier quotas than Pro
      contents: history.map(h => ({
        role: h.role === 'agent' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { 
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 800
      }
    });

    const rawText = response.text || "I'm checking that for you. What exactly is the issue with your connection?";
    
    // Parse Escalation
    const escalationMatch = rawText.match(/\[ESCALATE: (.*?)\]/);
    const escalationReason = escalationMatch ? escalationMatch[1] : null;
    const cleanText = rawText.replace(/\[ESCALATE: .*?\]/g, "").trim();
    
    return { text: cleanText, escalationReason };
  } catch (e) {
    const isQuotaError = e.message?.includes('429') || e.message?.includes('quota');
    if (isQuotaError) {
      addLog('ERROR', 'Gemini Quota Exceeded (429). Switch to paid or wait for reset.');
      return { text: "Pole sana, my response engine is a bit busy right now. Please try again in 1 minute or call our office directly for immediate help. Asante.", escalationReason: null };
    }
    addLog('ERROR', `AI Core Error: ${e.message}`);
    return { text: "I'm having a slight hitch. Could you repeat that? Asante.", escalationReason: null };
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
    addLog('ERROR', `Evolution Link Failure`, { url, error: e.message });
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
  // Trim history for simulator to save tokens
  const trimmedHistory = (history || []).slice(-10);
  const result = await generateAIResponse(trimmedHistory, maintenance);
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

  if (payload.body && typeof payload.body === 'string' && payload.body.includes('{')) {
    try { payload = JSON.parse(payload.body); } catch (e) {}
  }

  const eventName = payload.event || 'none';
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

  if (!evolutionConfig && payload.apikey && payload.server_url) {
    evolutionConfig = { 
      baseUrl: payload.server_url, 
      apiKey: payload.apikey, 
      instanceName: payload.instance || 'me' 
    };
    addLog('INFO', 'Evolution Bridge Confirmed');
  }

  if (!evolutionConfig) return;

  addLog('WEBHOOK', `Message from ${jid.split('@')[0]}: "${text}"`);

  // Token-Saving Memory (Limit to last 8 exchanges)
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 16) history.shift(); // 16 entries = 8 exchanges

  try {
    const target = jid.split('@')[0];
    
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { 
      number: target, 
      presence: 'composing' 
    });
    
    const { text: aiResponse, escalationReason } = await generateAIResponse(history, maintenance);
    
    if (escalationReason) {
      const newIssue = { 
        id: Date.now().toString(), 
        customerPhone: target, 
        location: 'Auto-Detected', 
        description: `${escalationReason}. Triggered by message: "${text}"`, 
        severity: 'Warning', 
        timestamp: new Date(), 
        status: 'Pending' 
      };
      issues.unshift(newIssue);
      if (issues.length > 500) issues.pop();
    }

    history.push({ role: 'agent', content: aiResponse });

    const result = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { 
      number: jid, 
      text: aiResponse 
    });

    if (result && result.ok) {
      addLog('SUCCESS', `Response Sent to ${target}`);
    } else {
      addLog('ERROR', 'Evolution API failed to send response.');
    }
  } catch (e) {
    addLog('ERROR', `Webhook Processing Error: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`EcoSpot AI Server running on port ${PORT}`);
});
