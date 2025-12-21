
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

// Enhanced body parsing with raw body capture for deep debugging
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Server-Side State ---
let maintenance = [];
let issues = [];
let contacts = []; 
let evolutionConfig = null;
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
  if (webhookLogs.length > 100) webhookLogs.pop(); // Keep more logs for debugging
  console.log(`[${type}] ${message}`);
}

// Global request logger for all /api calls
app.use('/api', (req, res, next) => {
  if (req.path !== '/logs' && req.path !== '/data') {
    console.log(`[API REQUEST] ${req.method} ${req.path}`);
  }
  next();
});

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
  if (!apiKey) return { text: "AI Key missing in environment.", isSerious: false };
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
    return { text: "AI service interrupted. Please check back shortly.", isSerious: false };
  }
}

// --- API Routes ---

app.get('/api/data', (req, res) => res.json({ maintenance, issues, contacts, config: evolutionConfig }));
app.get('/api/logs', (req, res) => res.json(webhookLogs));

app.post('/api/maintenance', (req, res) => { maintenance = req.body || []; res.json({ success: true }); });
app.post('/api/issues', (req, res) => { issues = req.body || []; res.json({ success: true }); });
app.post('/api/config', (req, res) => { evolutionConfig = req.body; addLog('INFO', 'Configuration updated.'); res.json({ success: true }); });

app.get('/api/instance/status', async (req, res) => {
  try {
    if (!evolutionConfig?.instanceName) return res.json({ status: "NOT_CONFIGURED" });
    const baseUrl = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
    const url = `${baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl}/instance/fetchInstances`;
    const response = await fetch(url, { headers: { 'apikey': evolutionConfig.apiKey }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const instances = await response.json();
    const myInstance = Array.isArray(instances) ? instances.find(i => i.instanceName === evolutionConfig.instanceName || i.name === evolutionConfig.instanceName) : null;
    if (!myInstance) return res.json({ status: "ERROR", message: "Instance not found." });
    const state = myInstance.status || myInstance.connectionStatus || myInstance.state;
    res.json({ status: state === 'open' ? 'CONNECTED' : 'DISCONNECTED', message: `State: ${state}` });
  } catch (e) {
    res.json({ status: "ERROR", message: e.message });
  }
});

app.post('/api/test-webhook', async (req, res) => {
  const mockPayload = {
    event: "messages.upsert",
    instance: "me",
    data: {
      key: { remoteJid: "254700000000@s.whatsapp.net", fromMe: false, id: "SIMULATED_" + Date.now() },
      message: { conversation: req.body.text || "hi" }
    }
  };
  addLog('INFO', 'Local simulation started...');
  const response = await fetch(`http://localhost:${PORT}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mockPayload)
  });
  res.json({ success: response.ok, status: response.status });
});

// ROBUST WEBHOOK HANDLER
// We use a wildcard (*) to capture /api/sync, /api/sync/, /api/sync/messages-upsert, etc.
app.post(['/api/sync', '/api/sync/*'], async (req, res) => {
  const payload = req.body || {};
  const method = req.method;
  const path = req.path;

  // Immediate Trace
  addLog('WEBHOOK', `Request received: ${method} ${path}`, {
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    },
    payloadPreview: JSON.stringify(payload).substring(0, 200) + '...',
    body: payload
  });

  // Handle Evolution "Test"
  if (payload.event === 'test' || payload.type === 'test') {
    addLog('SUCCESS', 'Test connection verified!');
    return res.status(200).send('SUCCESS');
  }

  // Check Config
  if (!evolutionConfig) {
    addLog('ERROR', 'Webhook ignored: API settings not configured. Please save your Evolution API details first.');
    return res.status(200).send('PENDING_CONFIG');
  }

  // Process message
  if (payload.event === 'messages.upsert') {
    // Parser for the specific structure provided in your trace
    const data = payload.data || {};
    const message = (data.messages ? data.messages[0] : data) || {};
    
    if (!message.key) {
      addLog('ERROR', 'Webhook structure mismatch. Expected "data.key" or "data.messages[0].key"', payload);
      return res.status(200).send('INVALID_STRUCTURE');
    }

    if (message.key.fromMe) {
      addLog('INFO', 'Ignoring outgoing message (sent from bot).');
      return res.status(200).send('FROM_ME');
    }

    const sender = message.key.remoteJid;
    // Extract text from the specific "conversation" field seen in your trace
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || 
                 message.message?.imageMessage?.caption || 
                 message.conversation; // fallback for very flat payloads

    if (!text) {
      addLog('INFO', `Ignoring empty message from ${sender}. (Possibly status update or media without caption)`);
      return res.status(200).send('NO_CONTENT');
    }

    addLog('SUCCESS', `Message from ${sender}: "${text}"`);

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
        addLog('SUCCESS', `Reply sent to ${sender}.`);
      } else {
        const errText = await response.text();
        addLog('ERROR', `Evolution API rejected reply. Status: ${response.status}`, errText);
      }
    } catch (e) {
      addLog('ERROR', `Network failure replying to ${sender}: ${e.message}`);
    }
  }

  res.status(200).send('ACK');
});

// GET handler for browser pings
app.get(['/api/sync', '/api/sync/*'], (req, res) => {
  res.status(200).json({ status: 'Online', service: 'EcoSpot Webhook Listener', message: 'Send POST requests here.' });
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => addLog('INFO', `Server is live and listening on port ${PORT}`));
