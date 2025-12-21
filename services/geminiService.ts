
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { MaintenanceRecord } from "../types";

export class GeminiService {
  /**
   * Generates a conversational response using Gemini.
   */
  async generateResponse(
    history: { role: string; content: string }[], 
    maintenanceRecords: MaintenanceRecord[]
  ): Promise<{ text: string; isSerious: boolean }> {
    try {
      // Robust key check for frontend simulator
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "undefined" || apiKey.length < 5) {
        console.error("Gemini API Key is missing or invalid.");
        return { 
          text: "System Configuration Error: The GEMINI_API_KEY environment variable is not set. Please check your hosting settings.", 
          isSerious: false 
        };
      }

      const ai = new GoogleGenAI({ apiKey });

      const maintenanceContext = maintenanceRecords.length > 0 
        ? maintenanceRecords.map(m => 
            `- ${m.area}: ${m.status} (${m.description})`
          ).join('\n')
        : "All systems currently operational.";

      const seriousIssueInstruction = `
      IMPORTANT: If it's a critical physical outage, append [SERIOUS_ISSUE_DETECTED].
      `;

      const fullSystemInstruction = SYSTEM_PROMPT.replace('{MAINTENANCE_CONTEXT}', maintenanceContext) + seriousIssueInstruction;

      const formattedContents = history.map(h => ({
        role: h.role === 'agent' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));

      const firstUserIndex = formattedContents.findIndex(c => c.role === 'user');
      const validHistory = firstUserIndex !== -1 
        ? formattedContents.slice(firstUserIndex) 
        : formattedContents;

      if (validHistory.length === 0) {
        return { text: "No input provided.", isSerious: false };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: validHistory,
        config: {
          systemInstruction: fullSystemInstruction,
          temperature: 0.1,
          maxOutputTokens: 150,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      const text = response.text || "";
      const isSerious = text.includes("[SERIOUS_ISSUE_DETECTED]");
      const cleanedText = text.replace("[SERIOUS_ISSUE_DETECTED]", "").trim();

      return { text: cleanedText, isSerious };
    } catch (error: any) {
      console.error("Gemini Engine Error:", error);
      return { text: "AI is busy. Please retry.", isSerious: false };
    }
  }
}

export const geminiService = new GeminiService();
