
import { MaintenanceRecord } from "../types";

export class GeminiService {
  /**
   * Proxies AI generation to the server to avoid browser XHR/CORS errors.
   */
  async generateResponse(
    history: { role: string; content: string }[], 
    maintenanceRecords: MaintenanceRecord[]
  ): Promise<{ text: string; isSerious: boolean }> {
    try {
      const response = await fetch('/api/ai/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error("AI Proxy Error:", error);
      return { text: "The AI server is unreachable. Please check your internet connection.", isSerious: false };
    }
  }
}

export const geminiService = new GeminiService();
