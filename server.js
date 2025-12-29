
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());

let webhookLogs = []; 
function addLog(type, message, details = null) {
  const log = { id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString(), type, message, details };
  webhookLogs.unshift(log);
  if (webhookLogs.length > 200) webhookLogs.pop();
}

let maintenance = [];
let issues = [];
let evolutionConfig = null;
const userMemory = new Map(); 

// --- AI KERNEL (Optimized for lowest cost/token usage) ---
async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return { text: "Service temporarily offline. Call 0700000000.", escalationReason: null };
  
  const ai = new GoogleGenAI({ apiKey });
  const activeOutages = maintenanceRecords.filter(m => m.status !== 'Completed').map(m => `${m.area}: ${m.description}`).join('; ');

  const PROMPT = `Role: EcoSpot AI (ISP Support Kenya). 
Tone: Helpful, human, local. 
Rules: 
- No repetitive "Jambo". Greet only if needed. 
- Answer directly.
- Fiber: 6Mbps(1.5k), 20Mbps(2k). Install: 4.5k.
- Vouchers: 1Hr(10), 24h(60), 1Wk(280), 1Mo(750).
- Coverage: Kutus only. NO Murang'a.
- Outages: ${activeOutages || 'None'}.
- Escalate: If troubleshooting fails or problem is "constant". 
Format: Text... [ESCALATE: <reason>] if applicable.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest', // Lowest cost/highest free quota model
      contents: history.map(h => ({
        role: h.role === 'agent' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { 
        systemInstruction: PROMPT,
        temperature: 0.6,
        maxOutputTokens: 400 // Reduced to save cost
      }
    });

    const rawText = response.text || "Checking that for you...";
    const escalationMatch = rawText.match(/\[ESCALATE: (.*?)\]/);
    return { 
      text: rawText.replace(/\[ESCALATE: .*?\]/g, "").trim(), 
      escalationReason: escalationMatch ? escalationMatch[1] : null 
    };
  } catch (e) {
    addLog('ERROR', `AI Error: ${e.message}`);
    return { text: "Small technical hitch. Try again in a minute. Asante.", escalationReason: null };
  }
}

async function callEvolution(endpoint, method, body) {
  if (!evolutionConfig) return null;
  const url = `${evolutionConfig.baseUrl.replace(/\/$/, '')}${endpoint}`;
  try {
    return await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'apikey': evolutionConfig.apiKey },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) { return null; }
}

app.get('/api/data', (req, res) => res.json({ maintenance, issues, config: evolutionConfig }));
app.get('/api/logs', (req, res) => res.json(webhookLogs));
app.post('/api/maintenance', (req, res) => { maintenance = req.body; res.json({ success: true }); });
app.post('/api/issues', (req, res) => { issues = req.body; res.json({ success: true }); });
app.post('/api/config', (req, res) => { evolutionConfig = req.body; res.json({ success: true }); });

app.post('/api/ai/simulate', async (req, res) => {
  const result = await generateAIResponse((req.body.history || []).slice(-6), maintenance);
  res.json(result);
});

app.get('/api/instance/status', async (req, res) => {
  if (!evolutionConfig) return res.json({ status: 'NOT_CONFIGURED' });
  const resApi = await callEvolution(`/instance/connectionState/${evolutionConfig.instanceName}`, 'GET');
  if (resApi?.ok) {
    const d = await resApi.json();
    return res.json({ status: ['open','connected'].includes(String(d.instance?.state || d.state).toLowerCase()) ? 'CONNECTED' : 'DISCONNECTED' });
  }
  res.json({ status: "ERROR" });
});

app.post(['/api/sync', '/api/sync/messages-upsert'], async (req, res) => {
  res.status(200).send('ACK');
  const data = req.body.data || req.body;
  const msg = (data.messages ? data.messages[0] : data) || {};
  if (!msg.key || msg.key.fromMe) return;

  const jid = msg.key.remoteJidAlt || msg.key.remoteJid;
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.text || '';
  if (!jid || !text || !evolutionConfig) return;

  addLog('WEBHOOK', `Message: "${text}"`);

  // Aggressive memory management (Last 4 exchanges to save tokens)
  if (!userMemory.has(jid)) userMemory.set(jid, []);
  const history = userMemory.get(jid);
  history.push({ role: 'user', content: text });
  if (history.length > 8) history.shift(); 

  try {
    const target = jid.split('@')[0];
    await callEvolution(`/chat/sendPresence/${evolutionConfig.instanceName}`, 'POST', { number: target, presence: 'composing' });
    
    const { text: reply, escalationReason } = await generateAIResponse(history, maintenance);
    
    if (escalationReason) {
      issues.unshift({ id: Date.now().toString(), customerPhone: target, location: 'Auto', description: escalationReason, severity: 'Warning', timestamp: new Date(), status: 'Pending' });
    }

    history.push({ role: 'agent', content: reply });
    await callEvolution(`/message/sendText/${evolutionConfig.instanceName}`, 'POST', { number: jid, text: reply });
    addLog('SUCCESS', `Replied to ${target}`);
  } catch (e) { addLog('ERROR', e.message); }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`EcoSpot Lite AI active on ${PORT}`));
