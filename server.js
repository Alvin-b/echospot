
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

// --- EcoSpot ISP Constants ---
const ECO_SPOT_INFO = {
  monthlyPlans: "Fiber: 6Mbps (1,500/=), 20Mbps (2,000/=).",
  hotspotPlans: "Vouchers: 1hr (10/=), 12hrs (30/=), 24hrs (60/=), 3 days (150/=), 1 week (280/=), 1 month (750/=).",
  installation: "Standard Installation: KES 4,500."
};

const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent for EcoSpot Wifi ISP in Kenya.
TONE: Friendly, professional, and concise (1-2 sentences).

BUSINESS INFO:
- ${ECO_SPOT_INFO.monthlyPlans}
- ${ECO_SPOT_INFO.hotspotPlans}
- ${ECO_SPOT_INFO.installation}

GUIDELINES:
1. If user says hi/hello, greet warmly.
2. Only provide pricing if asked.
3. For "no internet": Suggest 30-sec router restart for Fiber, or "forget network" for Hotspot.
4. IMPORTANT: If user reports infrastructure damage or total system failure, append [SERIOUS_ISSUE_DETECTED] to your response.

CURRENT NETWORK STATUS:
{MAINTENANCE_CONTEXT}
`;

// --- Helper: Evolution API Requester ---
async function evolutionRequest(endpoint, method = 'GET', body = null) {
  if (!evolutionConfig || !evolutionConfig.baseUrl || !evolutionConfig.apiKey) {
    throw new Error("Evolution API configuration is incomplete.");
  }
  
  let baseUrl = evolutionConfig.baseUrl.trim().replace(/\/$/, '');
  if (!baseUrl.startsWith('http')) {
    baseUrl = 'https://' + baseUrl;
  }

  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${baseUrl}/${cleanEndpoint}`;

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
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (e) {
    console.error(`[Evolution Request Error] ${method} ${endpoint}: ${e.message}`);
    throw e;
  }
}

// --- AI Service Logic ---
async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { text: "AI Key missing on server.", isSerious: false };
  
  const ai = new GoogleGenAI({ apiKey });
  
  const maintenanceContext = maintenanceRecords.length > 0 
    ? maintenanceRecords.map(m => `- ${m.area}: ${m.status} (${m.description})`).join('\n')
    : "All systems operational.";
    
  const fullPrompt = SYSTEM_PROMPT.replace('{MAINTENANCE_CONTEXT}', maintenanceContext);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history.map(h => ({
        role: h.role === 'agent' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      config: { systemInstruction: fullPrompt }
    });

    const rawText = response.text || "";
    const isSerious = rawText.includes("[SERIOUS_ISSUE_DETECTED]");
    const cleanText = rawText.replace("[SERIOUS_ISSUE_DETECTED]", "").trim();
    
    return { text: cleanText, isSerious };
  } catch (e) {
    console.error("[AI Generation Error]", e);
    return { text: "Pole! Our AI assistant is taking a short break. Please try again.", isSerious: false };
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
  console.log("[Config] Server configuration updated.");
  res.json({ success: true });
});

app.get('/api/instance/status', async (req, res) => {
  try {
    if (!evolutionConfig || !evolutionConfig.instanceName) {
      return res.status(200).json({ status: "NOT_CONFIGURED", message: "Missing configuration." });
    }
    const instances = await evolutionRequest('instance/fetchInstances');
    const myInstance = Array.isArray(instances) 
      ? instances.find(i => i.instanceName === evolutionConfig.instanceName || i.name === evolutionConfig.instanceName)
      : null;

    if (!myInstance) {
      return res.json({ status: "ERROR", message: `Instance "${evolutionConfig.instanceName}" not found.` });
    }

    const state = myInstance.status || myInstance.connectionStatus || myInstance.state;
    res.json({ 
      status: state === 'open' ? 'CONNECTED' : 'DISCONNECTED',
      message: state === 'open' ? 'Connected.' : `Status: ${state || 'Closed'}`,
      raw: myInstance 
    });
  } catch (e) {
    res.status(200).json({ status: "ERROR", message: e.message });
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

/**
 * WEBHOOK HANDLER
 */
app.post('/api/sync', async (req, res) => {
  try {
    const payload = req.body || {};
    console.log(`[Webhook] Event Received: ${payload.event || 'Unknown'}`);
    
    // Check if configuration exists
    if (!evolutionConfig) {
      console.warn("[Webhook] Warning: Received message but server has NO Evolution configuration. Did the server restart?");
      return res.status(200).send('NOT_CONFIGURED');
    }

    if (payload.event === 'messages.upsert') {
      // Support different Evolution API payload formats
      const messageObj = (payload.data?.messages ? payload.data.messages[0] : payload.data) || {};
      
      // Ignore if message is missing or from ourselves
      if (!messageObj.key || messageObj.key.fromMe) {
        return res.status(200).send('SKIPPED');
      }

      const senderJid = messageObj.key.remoteJid;
      const pushName = messageObj.pushName || "Customer";
      const messageText = messageObj.message?.conversation || 
                         messageObj.message?.extendedTextMessage?.text || 
                         messageObj.message?.imageMessage?.caption;

      if (!messageText) {
        console.log(`[Webhook] Skipped message from ${senderJid} (No text content)`);
        return res.status(200).send('NO_TEXT');
      }

      console.log(`[Webhook] Message from ${pushName} (${senderJid}): ${messageText}`);

      // Update Contact List
      const idx = contacts.findIndex(c => c.jid === senderJid);
      if (idx > -1) {
        contacts[idx].lastInteraction = new Date();
        contacts[idx].messageCount++;
      } else {
        contacts.unshift({ jid: senderJid, name: pushName, lastInteraction: new Date(), messageCount: 1 });
      }

      // Generate AI Response
      const { text: aiResponse, isSerious } = await generateAIResponse(
        [{ role: 'user', content: messageText }], 
        maintenance
      );

      // Auto-Ticket if serious
      if (isSerious) {
        issues.unshift({
          id: Date.now().toString(),
          customerPhone: senderJid.split('@')[0],
          location: "WhatsApp",
          description: messageText,
          severity: 'Critical',
          timestamp: new Date(),
          status: 'Pending'
        });
      }

      // Send Response
      try {
        const targetNumber = senderJid.split('@')[0];
        console.log(`[Webhook] Attempting to reply to ${targetNumber}...`);
        
        await evolutionRequest(`message/sendText/${encodeURIComponent(evolutionConfig.instanceName)}`, 'POST', {
          number: targetNumber,
          text: aiResponse
        });
        
        console.log(`[Webhook] Reply sent successfully to ${targetNumber}`);
      } catch (sendErr) {
        console.error(`[Webhook] Failed to send reply: ${sendErr.message}`);
      }
    }
    
    res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error("[Webhook Critical Error]", err);
    res.status(200).json({ status: 'error', message: err.message }); // Always return 200 to Evolution to prevent retries
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`EcoSpot AI Agent Server Active`);
  console.log(`PORT: ${PORT}`);
  console.log(`Webhook URL: /api/sync`);
  console.log(`=========================================`);
});
