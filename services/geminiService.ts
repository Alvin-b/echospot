
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { MaintenanceRecord } from "../types";

export class GeminiService {
  /**
   * Generates a conversational response using Gemini.
   * Ensures the payload strictly follows the required user-model-user sequence.
   */
  async generateResponse(
    history: { role: string; content: string }[], 
    maintenanceRecords: MaintenanceRecord[]
  ): Promise<{ text: string; isSerious: boolean }> {
    try {
      // Check for API Key presence
      const apiKey = process.env.API_KEY;
      if (!apiKey || apiKey === "undefined" || apiKey.length < 5) {
        console.error("Gemini API Key is missing or invalid.");
        return { 
          text: "System Configuration Error: The API_KEY environment variable is not set. Please go to Settings to see the setup guide.", 
          isSerious: false 
        };
      }

      const ai = new GoogleGenAI({ apiKey });

      // Construct maintenance context for the agent
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

      // Formatting: Gemini API requires the first part of the contents to be from the 'user' role.
      const formattedContents = history.map(h => ({
        role: h.role === 'agent' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));

      // Ensure valid sequence: first message must be 'user'
      const firstUserIndex = formattedContents.findIndex(c => c.role === 'user');
      const validHistory = firstUserIndex !== -1 
        ? formattedContents.slice(firstUserIndex) 
        : formattedContents;

      if (validHistory.length === 0) {
        return { text: "No input provided to the AI engine.", isSerious: false };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: validHistory,
        config: {
          systemInstruction: fullSystemInstruction,
          temperature: 0.7,
        }
      });

      const text = response.text || "";
      const isSerious = text.includes("[SERIOUS_ISSUE_DETECTED]");
      const cleanedText = text.replace("[SERIOUS_ISSUE_DETECTED]", "").trim();

      return { text: cleanedText, isSerious };
    } catch (error: any) {
      console.error("Gemini AI Engine Error:", error);
      
      let errorMessage = "EcoSpot AI is currently experiencing high latency. Please try again in a moment.";
      
      if (error?.message?.includes("API key not valid")) {
        errorMessage = "Configuration Error: The provided API Key is invalid or expired.";
      } else if (error?.message?.includes("quota")) {
        errorMessage = "System Notice: API rate limit reached. Please wait a minute.";
      }

      return { text: errorMessage, isSerious: false };
    }
  }
}

export const geminiService = new GeminiService();
