
import { EvolutionConfig, Contact } from "../types";

export class EvolutionService {
  private config: EvolutionConfig | null = null;

  setConfig(config: EvolutionConfig) {
    this.config = config;
  }

  async getConfig(): Promise<EvolutionConfig | null> {
    if (this.config) return this.config;
    const response = await fetch('/api/data');
    if (response.ok) {
      const data = await response.json();
      this.config = data.config;
      return this.config;
    }
    return null;
  }

  async getContacts(): Promise<Contact[]> {
    const response = await fetch('/api/data');
    if (response.ok) {
      const data = await response.json();
      return data.contacts || [];
    }
    return [];
  }

  async getInstanceStatus() {
    try {
      const response = await fetch('/api/instance/status');
      // We expect the server to return 200 even on API errors so we can parse the JSON error
      if (!response.ok) {
         return { status: 'ERROR', message: `Server error: ${response.status}` };
      }
      return await response.json();
    } catch (e) {
      return { status: 'ERROR', message: "Dashboard could not reach the backend server." };
    }
  }

  async sendBroadcast(message: string) {
    const response = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    if (!response.ok) throw new Error("Broadcast request failed");
    return response.json();
  }

  async sendMessage(to: string, text: string) {
     const config = await this.getConfig();
     if (!config) throw new Error("Not configured");
     console.log("Manual send would go through server proxy to avoid CORS.");
  }
}

export const evolutionService = new EvolutionService();
