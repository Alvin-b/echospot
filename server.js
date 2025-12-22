
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

// --- 4. AI CORE (Optimized Human-Like Support Kernel) ---
async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    addLog('ERROR', 'AI Error: Missing API_KEY on server.');
    return { text: "Jambo! Our automated systems are currently restarting. Please contact our support team at 0700 000 000 if you need urgent help.", escalationReason: null };
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const activeOutages = maintenanceRecords
    .filter(m => m.status === 'Outage' || m.status === 'In Progress')
    .map(m => `- ${m.area}: ${m.description} (Resolution: ${m.estimatedResolution || 'TBD'})`)
    .join('\n');

  const maintenanceContext = activeOutages.length > 0 
    ? `KNOWN NETWORK ISSUES:\n${activeOutages}`
    : "No widespread outages are currently reported. The network backbone is operational.";

  const SYSTEM_PROMPT = `You are "EcoSpot AI", a senior customer support engineer for EcoSpot Wifi ISP in Kenya. 

CONVERSATIONAL RULES (IMPORTANT):
1. **Human-like Tone**: Do NOT start every message with "Jambo!". It sounds robotic. Greet naturally. If you already said hello in the conversation history, don't repeat it. Use variations like "Habari", "Mambo", "Sasa", or simply acknowledge their request directly (e.g., "Asante for asking about that...").
2. **NO TRUNCATION**: Never stop mid-sentence. Ensure every thought is completed. If you provide a price or a location, finish the full sentence.
3. **Local Flavor**: Be warm and empathetic. Use "Pole sana" for trouble and "Karibu" for thanks. 

ECOSPOT DATA:
- Fiber Plans: Eco Basic (6Mbps - 1,500 KES), Eco Pro (20Mbps - 2,000 KES). Installation: 4,500 KES.
- Hotspot Vouchers: 1Hr (10/-), 24Hrs (60/-), 1Wk (280/-), 1Mo (750/-).
- Payments: M-Pesa Paybill 400200. Account: Customer Phone Number.
- Coverage: Primary coverage is currently in Kutus and surrounding areas. We are expanding soon!

DIAGNOSTICS & ESCALATION:
Check the history carefully. 
- If the user says they ALREADY restarted the router or tried your advice and it failed, ESCALATE.
- If the problem is "every day", "constantly", or "always slow", it is a persistent fault. ESCALATE.
- If physical damage (cut cables) is reported, ESCALATE.

ESCALATION FORMAT:
If a rule is met, append: "[ESCALATE: <One sentence specific reason>]" to the end of your message. 
Example: "I'm sorry that the restart didn't fix your 6Mbps speed. I've logged this for a senior technician to check your line immediately. [ESCALATE: Troubleshooting failed - Router restart ineffective]"

CURRENT NETWORK STATE:
${maintenanceContext}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: history.map(h => ({
        role: h.role === 'agent' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { 
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7, // Higher for more natural variety
        maxOutputTokens: 1024
      }
    });

    const rawText = response.text || "Jambo! I am here to help. Could you tell me more about your connection issues?";
    
    // Parse Escalation
    const escalationMatch = rawText.match(/\[ESCALATE: (.*?)\]/);
    const escalationReason = escalationMatch ? escalationMatch[1] : null;
    const cleanText = rawText.replace(/\[ESCALATE: .*?\]/g, "").trim();
    
    return { text: cleanText, escalationReason };
  } catch (e) {
    addLog('ERROR', `AI Core Error: ${e.message}`);
    return { text: "Jambo! I'm having a small technical hitch responding to that. Please ask again in a moment. Asante.", escalationReason: null };
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
    addLog('ERROR', `Proxy Link Failure`, { url, error: e.message });
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

  // Memory Persistence
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 30) history.shift();

  try {
    const target = jid.split('@')[0];
    
    // Typing Visual
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { 
      number: target, 
      presence: 'composing' 
    });
    
    // AI Kernel Call
    const { text: aiResponse, escalationReason } = await generateAIResponse(history, maintenance);
    
    // Escalation Logging
    if (escalationReason) {
      const newIssue = { 
        id: Date.now().toString(), 
        customerPhone: target, 
        location: 'In-Chat Detection', 
        description: `${escalationReason}. Context: "${text}"`, 
        severity: escalationReason.toLowerCase().includes('outage') ? 'Critical' : 'Warning', 
        timestamp: new Date(), 
        status: 'Pending' 
      };
      
      issues.unshift(newIssue);
      if (issues.length > 500) issues.pop();
      addLog('INFO', `Escalation Auto-Logged: ${escalationReason}`);
    }

    history.push({ role: 'agent', content: aiResponse });

    // Send WhatsApp Response
    const result = await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { 
      number: jid, 
      text: aiResponse 
    });

    if (result && result.ok) {
      addLog('SUCCESS', `AI Response Delivered`, { reply: aiResponse, escalated: !!escalationReason });
    } else {
      addLog('ERROR', 'Evolution API rejected the response message.');
    }
  } catch (e) {
    addLog('ERROR', `Kernel Execution Error: ${e.message}`);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`EcoSpot AI Support Server active on port ${PORT}`);
});
