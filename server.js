
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

// --- AI Service Logic ---
const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent. Serve clients of EcoSpot Wifi ISP via WhatsApp.
BE EXTREMELY BRIEF. Maximum 1 short sentence. No greetings. No fluff. 
If issues are serious, append [SERIOUS_ISSUE_DETECTED].
`;

async function generateAIResponse(history, maintenanceRecords) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("AI Server Error: API_KEY missing from environment.");
    return { text: "AI Configuration Missing. Pole.", isSerious: false };
  }

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
    console.error("AI Error generating response:", e);
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
  res.json({ success: true });
});

app.post('/api/sync', async (req, res) => {
  try {
    const { event, data } = req.body || {};
    console.log(`Webhook Event: ${event}`);

    if (event === 'messages.upsert') {
      const message = data.messages?.[0];
      if (message && !message.key.fromMe) {
        const sender = message.key.remoteJid;
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        if (text && evolutionConfig) {
          const { text: aiResponse, isSerious } = await generateAIResponse([{ role: 'user', content: text }], maintenance);
          
          if (isSerious) {
            issues.unshift({
              id: Date.now().toString(),
              customerPhone: sender.split('@')[0],
              description: text,
              severity: 'Critical',
              timestamp: new Date(),
              status: 'Pending'
            });
          }

          try {
            const replyResponse = await fetch(`${evolutionConfig.baseUrl}/message/sendText/${evolutionConfig.instanceName}`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                'apikey': evolutionConfig.apiKey 
              },
              body: JSON.stringify({ number: sender.split('@')[0], text: aiResponse })
            });
            if (!replyResponse.ok) {
                console.error(`Evolution API reply failed with status ${replyResponse.status}`);
            }
          } catch (err) {
            console.error("Failed to fetch Evolution API for reply:", err.message);
          }
        }
      }
    }
    res.status(200).json({ status: 'success' });
  } catch (webhookErr) {
    console.error("Critical Webhook Error:", webhookErr);
    res.status(500).json({ status: 'error' });
  }
});

// --- Static and Catch-all ---
// Important: Serve static files AFTER API routes
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  // If we reach here for an /api/ route, it truly doesn't exist
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // Otherwise, serve the SPA index.html
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(indexPath);
});

app.listen(PORT, () => console.log(`EcoSpot Backend Server active on port ${PORT}`));
