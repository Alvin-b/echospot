
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
app.use(express.json());

// --- Server-Side State ---
let maintenance = [];
let issues = [];
let contacts = []; 
let evolutionConfig = null;
let webhookLogs = []; // Stores the last 50 events

function addLog(type, message, details = null) {
  const log = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    type,
    message,
    details
  };
  webhookLogs.unshift(log);
  if (webhookLogs.length > 50) webhookLogs.pop();
  console.log(`[${type}] ${message}`);
}

// --- EcoSpot ISP Constants ---
const ECO_SPOT_INFO = {
  monthlyPlans: "Fiber: 6Mbps (1,500/=), 20Mbps (2,000/=).",
  hotspotPlans: "Vouchers: 1hr (10/=), 12hrs (30/=), 24hrs (60/=), 3 days (150/=), 1 week (280/=), 1 month (750/=).",
  installation: "Standard Installation: KES 4,500."
};

const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent for EcoSpot Wifi ISP in Kenya.
TONE: Friendly, professional, and concise.
`;

async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { text: "AI Key missing.", isSerious: false };
  const ai = new GoogleGenAI({ apiKey });
  const maintenanceContext = maintenanceRecords.length > 0 ? maintenanceRecords.map(m => `- ${m.area}: ${m.status}`).join('\n') : "Operational.";
  const fullPrompt = SYSTEM_PROMPT + "\nStatus:\n" + maintenanceContext;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(h => ({
        role: h.role === 'agent' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { systemInstruction: fullPrompt }
    });
    const text = response.text || "";
    return { text: text.replace("[SERIOUS_ISSUE_DETECTED]", "").trim(), isSerious: text.includes("[SERIOUS_ISSUE_DETECTED]") };
  } catch (e) {
    return { text: "AI is busy. Please try in 1 minute.", isSerious: false };
  }
}

// --- API Routes ---

app.get('/api/data', (req, res) => res.json({ maintenance, issues, contacts, config: evolutionConfig }));
app.get('/api/logs', (req, res) => res.json(webhookLogs));

app.post('/api/maintenance', (req, res) => { maintenance = req.body || []; res.json({ success: true }); });
app.post('/api/issues', (req, res) => { issues = req.body || []; res.json({ success: true }); });
app.post('/api/config', (req, res) => { evolutionConfig = req.body; addLog('INFO', 'Configuration updated in dashboard.'); res.json({ success: true }); });

app.get('/api/instance/status', async (req, res) => {
  try {
    if (!evolutionConfig?.instanceName) return res.json({ status: "NOT_CONFIGURED" });
    const baseUrl = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
    const url = `${baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl}/instance/fetchInstances`;
    const response = await fetch(url, { headers: { 'apikey': evolutionConfig.apiKey }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const instances = await response.json();
    const myInstance = Array.isArray(instances) ? instances.find(i => i.instanceName === evolutionConfig.instanceName || i.name === evolutionConfig.instanceName) : null;
    if (!myInstance) return res.json({ status: "ERROR", message: "Instance not found on server." });
    const state = myInstance.status || myInstance.connectionStatus || myInstance.state;
    res.json({ status: state === 'open' ? 'CONNECTED' : 'DISCONNECTED', message: `State: ${state}` });
  } catch (e) {
    res.json({ status: "ERROR", message: e.message });
  }
});

// Endpoint to simulate a webhook event for testing purposes
app.post('/api/test-webhook', async (req, res) => {
  const mockPayload = {
    event: "messages.upsert",
    instance: evolutionConfig?.instanceName || "test-instance",
    data: {
      key: {
        remoteJid: "254700000000@s.whatsapp.net",
        fromMe: false,
        id: "SIMULATED_" + Date.now()
      },
      pushName: "Test User",
      message: {
        conversation: req.body.text || "Hello EcoSpot"
      },
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  };
  
  addLog('INFO', 'Simulating webhook event...');
  // We call our own sync endpoint
  const response = await fetch(`http://localhost:${PORT}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mockPayload)
  });
  
  res.json({ success: response.ok, status: response.status });
});

app.post('/api/sync', async (req, res) => {
  const payload = req.body || {};
  const contentType = req.headers['content-type'];
  
  addLog('WEBHOOK', `Event: ${payload.event || 'Unknown'} | Content-Type: ${contentType}`, {
    headers: req.headers,
    body: payload
  });

  if (!evolutionConfig) {
    addLog('ERROR', 'Discarded webhook: Evolution API not configured on server.');
    return res.status(200).send('NOT_CONFIGURED');
  }

  if (payload.event === 'messages.upsert') {
    // Try both nested and flat message structures used by different Evolution versions
    const message = (payload.data?.messages ? payload.data.messages[0] : payload.data) || {};
    
    if (!message.key) {
      addLog('ERROR', 'Malformed payload: Missing "key" object in message data.', payload);
      return res.status(200).send('MALFORMED');
    }

    if (message.key.fromMe) {
      addLog('INFO', 'Skipped: Message sent from the bot itself.');
      return res.status(200).send('SKIPPED');
    }

    const sender = message.key.remoteJid;
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || 
                 message.message?.imageMessage?.caption;

    if (!text) {
      addLog('INFO', `Skipped: No readable text content from ${sender}. (Media message without caption?)`);
      return res.status(200).send('NO_TEXT');
    }

    addLog('SUCCESS', `Processing message from ${sender}: "${text}"`);

    const { text: aiResponse } = await generateAIResponse([{ role: 'user', content: text }], maintenance);
    
    try {
      const baseUrl = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
      const sendUrl = `${baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl}/message/sendText/${encodeURIComponent(evolutionConfig.instanceName)}`;
      
      const response = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionConfig.apiKey },
        body: JSON.stringify({ number: sender.split('@')[0], text: aiResponse })
      });

      if (response.ok) {
        addLog('SUCCESS', `Replied to ${sender} successfully.`);
      } else {
        const errData = await response.text();
        addLog('ERROR', `Failed to reply. Evolution API status: ${response.status}`, errData);
      }
    } catch (e) {
      addLog('ERROR', `Network error while replying to ${sender}: ${e.message}`);
    }
  }
  res.status(200).send('OK');
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => addLog('INFO', `Server logic initialized. Monitoring port ${PORT}...`));
