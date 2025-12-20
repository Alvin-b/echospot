
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { MaintenanceRecord } from "../types";

export class GeminiService {
  // Removed instance-level ai property to ensure we always create a fresh client 
  // right before making an API call, as per GenAI SDK guidelines.

  async generateResponse(
    history: { role: string; content: string }[], 
    maintenanceRecords: MaintenanceRecord[]
  ): Promise<{ text: string; isSerious: boolean }> {
    try {
      // Initialize the GoogleGenAI client right before use to ensure the most up-to-date API key is used
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const maintenanceContext = maintenanceRecords.length > 0 
        ? maintenanceRecords.map(m => 
            `- ${m.area}: ${m.status} (${m.description}). Est. Resolution: ${m.estimatedResolution || 'TBD'}`
          ).join('\n')
        : "All systems currently operational. No scheduled maintenance.";

      const seriousIssueInstruction = `
      IMPORTANT: If the user is reporting a serious infrastructure issue (total outage, physical damage), 
      append the tag [SERIOUS_ISSUE_DETECTED] at the very end of your response.
      `;

      const fullSystemInstruction = SYSTEM_PROMPT.replace('{MAINTENANCE_CONTEXT}', maintenanceContext) + seriousIssueInstruction;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: history.map(h => ({
          role: h.role === 'agent' ? 'model' : 'user',
          parts: [{ text: h.content }]
        })),
        config: {
          systemInstruction: fullSystemInstruction,
          temperature: 0.7,
        }
      });

      // Extract text directly from the response.text property (not a method)
      const text = response.text || "";
      const isSerious = text.includes("[SERIOUS_ISSUE_DETECTED]");
      const cleanedText = text.replace("[SERIOUS_ISSUE_DETECTED]", "").trim();

      return { text: cleanedText, isSerious };
    } catch (error) {
      console.error("Gemini Error:", error);
      return { text: "EcoSpot AI is currently experiencing high latency. Please try again in a moment.", isSerious: false };
    }
  }
}

export const geminiService = new GeminiService();
