
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
    throw new Error("Evolution API not fully configured on server.");
  }
  
  let baseUrl = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
  // Auto-prepend https if missing
  if (!baseUrl.startsWith('http')) {
    baseUrl = 'https://' + baseUrl;
  }

  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${baseUrl}/${cleanEndpoint}`;

  console.log(`Evolution Proxy Request: ${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.apiKey
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.message || data.error || `HTTP ${response.status}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.details = data;
      throw err;
    }

    return data;
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error("Connection to Evolution API timed out.");
    throw e;
  }
}

// --- AI Service Logic ---
const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent for EcoSpot Wifi ISP. 

TONE:
- Friendly, professional, and concise.
- Use 1-2 natural sentences. 
- Acknowledge greetings (Jambo, Hello) before assisting.

RULES:
1. Only provide pricing if the user asks about packages, costs, or plans.
2. Use "Pole" (sorry) when discussing outages or technical problems.
3. Keep instructions simple.
4. If an issue is serious or unresolvable, append [SERIOUS_ISSUE_DETECTED].
`;

async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { text: "AI Key missing on server. Pole.", isSerious: false };

  const ai = new GoogleGenAI({ apiKey });
  const maintenanceContext = maintenanceRecords.length > 0 
    ? maintenanceRecords.map(m => `- ${m.area}: ${m.status}`).join('\n')
    : "All systems operational.";

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

    const text = response.text || "";
    return { 
      text: text.replace("[SERIOUS_ISSUE_DETECTED]", "").trim(), 
      isSerious: text.includes("[SERIOUS_ISSUE_DETECTED]") 
    };
  } catch (e) {
    console.error("AI Error:", e);
    return { text: "EcoSpot AI is momentarily offline. Pole.", isSerious: false };
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
  console.log("Updated Evolution Config:", evolutionConfig);
  res.json({ success: true });
});

// Instance Status Proxy
app.get('/api/instance/status', async (req, res) => {
  try {
    if (!evolutionConfig || !evolutionConfig.instanceName) {
      return res.status(200).json({ status: "NOT_CONFIGURED", message: "Server configuration missing." });
    }
    
    const data = await evolutionRequest(`instance/connectionStatus/${evolutionConfig.instanceName}`);
    const state = data.instance?.state;

    res.json({ 
      status: state === 'open' ? 'CONNECTED' : 'DISCONNECTED',
      message: state === 'open' ? 'Instance is live and connected.' : `Instance state is "${state || 'unknown'}".`,
      raw: data 
    });
  } catch (e) {
    console.error("Status Check Error:", e.message);
    res.status(200).json({ 
      status: "ERROR", 
      message: e.message || "Failed to communicate with Evolution API." 
    });
  }
});

app.post('/api/broadcast', async (req, res) => {
  const { message } = req.body;
  if (!message || !evolutionConfig) return res.status(400).json({ error: "Missing data" });

  res.json({ status: "started", count: contacts.length });

  for (const contact of contacts) {
    try {
      await evolutionRequest(`message/sendText/${evolutionConfig.instanceName}`, 'POST', {
        number: contact.jid.split('@')[0],
        text: message
      });
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`Broadcast failed for ${contact.jid}:`, e.message);
    }
  }
});

// Webhook Sync
app.post('/api/sync', async (req, res) => {
  try {
    const payload = req.body || {};
    const { event, data } = payload;
    
    if (event === 'messages.upsert') {
      const message = data.messages?.[0];
      if (message && !message.key.fromMe) {
        const sender = message.key.remoteJid;
        const pushName = message.pushName || "Customer";
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        const existingIdx = contacts.findIndex(c => c.jid === sender);
        if (existingIdx > -1) {
          contacts[existingIdx].lastInteraction = new Date();
          contacts[existingIdx].messageCount++;
          if (pushName !== "Customer") contacts[existingIdx].name = pushName;
        } else {
          contacts.unshift({
            jid: sender,
            name: pushName,
            lastInteraction: new Date(),
            messageCount: 1
          });
        }

        if (text && evolutionConfig) {
          const { text: aiResponse, isSerious } = await generateAIResponse([{ role: 'user', content: text }], maintenance);
          
          if (isSerious) {
            issues.unshift({
              id: Date.now().toString(),
              customerPhone: sender.split('@')[0],
              description: text,
              severity: 'Critical',
              timestamp: new Date(),
              status: 'Pending',
              location: 'WhatsApp'
            });
          }

          try {
            await evolutionRequest(`message/sendText/${evolutionConfig.instanceName}`, 'POST', {
              number: sender.split('@')[0],
              text: aiResponse,
              linkPreview: true
            });
          } catch (err) {
            console.error(`Reply failed to ${sender}:`, err.message);
          }
        }
      }
    }
    res.status(200).json({ status: 'success' });
  } catch (webhookErr) {
    console.error("Webhook Error:", webhookErr);
    res.status(500).json({ status: 'error' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`EcoSpot Server active on port ${PORT}`);
});
