
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
      if (!process.env.API_KEY || process.env.API_KEY === "undefined") {
        console.error("Gemini API Key is missing. Ensure API_KEY is set in your hosting provider's environment variables.");
        return { 
          text: "My AI connection is currently offline. Administrator: Please verify the API_KEY environment variable.", 
          isSerious: false 
        };
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      // We map our local roles to the API roles ('user' and 'model').
      const formattedContents = history.map(h => ({
        role: h.role === 'agent' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));

      // Find the first index where role is 'user' to ensure valid sequence
      const firstUserIndex = formattedContents.findIndex(c => c.role === 'user');
      const validHistory = firstUserIndex !== -1 
        ? formattedContents.slice(firstUserIndex) 
        : formattedContents;

      // Debugging: Log request details (excluding sensitive data)
      console.debug("EcoSpot AI Request:", { 
        model: 'gemini-3-flash-preview', 
        historyLength: validHistory.length,
        hasKey: !!process.env.API_KEY 
      });

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
      // Enhanced error reporting for the developer console
      console.error("Gemini AI Engine Error:", error);
      
      let errorMessage = "EcoSpot AI is currently experiencing high latency. Please try again in a moment.";
      
      if (error?.message?.includes("API key not valid")) {
        errorMessage = "System Error: The API Key configured in the environment is invalid.";
      } else if (error?.message?.includes("quota")) {
        errorMessage = "System Error: API rate limit reached. Please try again later.";
      }

      return { text: errorMessage, isSerious: false };
    }
  }
}

export const geminiService = new GeminiService();
