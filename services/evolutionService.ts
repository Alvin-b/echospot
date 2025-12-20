
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
    const response = await fetch('/api/instance/status');
    if (!response.ok) throw new Error("Failed to fetch instance status");
    return response.json();
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

  // Frontend manual send (proxied through a new server endpoint if needed, but usually not used for auto-agent)
  async sendMessage(to: string, text: string) {
     // For manual testing we use the same logic as the bot
     const config = await this.getConfig();
     if (!config) throw new Error("Not configured");
     
     // Note: We'd need an endpoint for manual sending if we wanted to support it fully from UI
     console.log("Manual send would go through server proxy to avoid CORS.");
  }
}

export const evolutionService = new EvolutionService();
