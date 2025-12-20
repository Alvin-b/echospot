
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

// --- Helper: Evolution API Requester ---
async function evolutionRequest(endpoint, method = 'GET', body = null) {
  if (!evolutionConfig || !evolutionConfig.baseUrl || !evolutionConfig.apiKey) {
    throw new Error("Evolution API configuration is incomplete.");
  }
  
  // 1. Prepare and Clean the Base URL
  let baseUrl = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
  
  if (!baseUrl.startsWith('http')) {
    baseUrl = 'https://' + baseUrl;
  }

  // Ensure we don't have double slashes if the endpoint starts with /
  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${baseUrl}/${cleanEndpoint}`;

  console.log(`[Evolution Proxy] ${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.apiKey
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000)
    });

    const text = await response.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { rawResponse: text };
    }

    if (!response.ok) {
      const msg = data.message || (data.response && data.response.message ? data.response.message[0] : null) || data.error || `Evolution API returned ${response.status}`;
      const err = new Error(msg);
      err.status = response.status;
      err.attemptedUrl = url;
      err.rawResponse = text;
      throw err;
    }

    return data;
  } catch (e) {
    if (e.name === 'TimeoutError') {
      const err = new Error("Evolution API server timed out.");
      err.attemptedUrl = url;
      throw err;
    }
    if (!e.attemptedUrl) e.attemptedUrl = url;
    throw e;
  }
}

// --- AI Service Logic ---
const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent for EcoSpot Wifi ISP. 
TONE: Friendly, professional, and concise.
`;

async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { text: "AI Key missing on server.", isSerious: false };
  const ai = new GoogleGenAI({ apiKey });
  const maintenanceContext = maintenanceRecords.map(m => `- ${m.area}: ${m.status}`).join('\n') || "Operational.";
  const fullPrompt = SYSTEM_PROMPT + "\nContext:\n" + maintenanceContext;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(h => ({
        role: h.role === 'agent' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { systemInstruction: fullPrompt }
    });
    return { text: response.text || "", isSerious: response.text.includes("[SERIOUS_ISSUE_DETECTED]") };
  } catch (e) {
    return { text: "AI is busy. Pole.", isSerious: false };
  }
}

// --- API Routes ---

app.get('/api/data', (req, res) => {
  res.json({ maintenance, issues, contacts, config: evolutionConfig });
});

app.post('/api/maintenance', (req, res) => {
  maintenance = req.body || [];
  res.json({ success: true });
});

app.post('/api/issues', (req, res) => {
  issues = req.body || [];
  res.json({ success: true });
});

app.post('/api/config', (req, res) => {
  evolutionConfig = req.body;
  res.json({ success: true });
});

app.get('/api/instance/status', async (req, res) => {
  try {
    if (!evolutionConfig || !evolutionConfig.instanceName) {
      return res.status(200).json({ status: "NOT_CONFIGURED", message: "Missing instance name." });
    }
    
    const encodedName = encodeURIComponent(evolutionConfig.instanceName);
    
    // UPDATED: Using /instance/info/{instanceName} which is the standard for Evolution v2.3+
    const data = await evolutionRequest(`instance/info/${encodedName}`);
    
    // Check for state in various possible response structures
    const state = data.instance?.status || data.status || data.instance?.state || data.state;

    res.json({ 
      status: state === 'open' ? 'CONNECTED' : 'DISCONNECTED',
      message: state === 'open' ? 'Connected.' : `Instance status is: ${state || 'unknown'}`,
      raw: data 
    });
  } catch (e) {
    console.error("Proxy Error:", e.message);
    res.status(200).json({ 
      status: "ERROR", 
      message: e.message,
      url: e.attemptedUrl,
      raw: e.rawResponse
    });
  }
});

app.post('/api/broadcast', async (req, res) => {
  const { message } = req.body;
  if (!message || !evolutionConfig) return res.status(400).json({ error: "Missing data" });
  res.json({ status: "started", count: contacts.length });
  const encodedName = encodeURIComponent(evolutionConfig.instanceName);
  for (const contact of contacts) {
    try {
      await evolutionRequest(`message/sendText/${encodedName}`, 'POST', { 
        number: contact.jid.split('@')[0], 
        text: message 
      });
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {}
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    const { event, data } = req.body || {};
    if (event === 'messages.upsert') {
      const message = data.messages?.[0];
      if (message && !message.key.fromMe) {
        const sender = message.key.remoteJid;
        const pushName = message.pushName || "Customer";
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        const idx = contacts.findIndex(c => c.jid === sender);
        if (idx > -1) {
          contacts[idx].lastInteraction = new Date();
          contacts[idx].messageCount++;
        } else {
          contacts.unshift({ jid: sender, name: pushName, lastInteraction: new Date(), messageCount: 1 });
        }

        if (text && evolutionConfig) {
          const { text: aiResponse } = await generateAIResponse([{ role: 'user', content: text }], maintenance);
          try {
            await evolutionRequest(`message/sendText/${encodeURIComponent(evolutionConfig.instanceName)}`, 'POST', {
              number: sender.split('@')[0],
              text: aiResponse
            });
          } catch (err) {}
        }
      }
    }
    res.status(200).json({ status: 'success' });
  } catch (webhookErr) {
    res.status(500).json({ status: 'error' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`EcoSpot Server active on ${PORT}`));
