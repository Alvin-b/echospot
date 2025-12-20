
import { EvolutionConfig, Contact } from "../types";

export class EvolutionService {
  private config: EvolutionConfig | null = null;
  private contacts: Map<string, Contact> = new Map();

  constructor() {
    this.loadContacts();
  }

  setConfig(config: EvolutionConfig) {
    this.config = config;
    localStorage.setItem('evolution_config', JSON.stringify(config));
  }

  getConfig(): EvolutionConfig | null {
    if (this.config) return this.config;
    const saved = localStorage.getItem('evolution_config');
    if (saved) {
      this.config = JSON.parse(saved);
      return this.config;
    }
    return null;
  }

  private loadContacts() {
    const saved = localStorage.getItem('ecospot_contacts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.contacts = new Map(Object.entries(parsed));
      } catch (e) {
        this.contacts = new Map();
      }
    }
  }

  private saveContacts() {
    localStorage.setItem('ecospot_contacts', JSON.stringify(Object.fromEntries(this.contacts)));
  }

  saveOrUpdateContact(jid: string, pushName: string = "Customer") {
    const cleanJid = jid.split(':')[0] + (jid.includes('@') ? '' : '@s.whatsapp.net');
    const existing = this.contacts.get(cleanJid);
    
    if (existing) {
      this.contacts.set(cleanJid, {
        ...existing,
        name: pushName !== "Customer" && pushName ? pushName : existing.name,
        lastInteraction: new Date(),
        messageCount: existing.messageCount + 1
      });
    } else {
      this.contacts.set(cleanJid, {
        jid: cleanJid,
        name: pushName || "Valued Client",
        lastInteraction: new Date(),
        messageCount: 1
      });
    }
    this.saveContacts();
  }

  getContacts(): Contact[] {
    return Array.from(this.contacts.values()).sort((a, b) => 
      new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime()
    );
  }

  private async request(endpoint: string, method: string = 'GET', body?: any) {
    const config = this.getConfig();
    if (!config) throw new Error("Evolution API not configured");

    const url = `${config.baseUrl}/${endpoint}`.replace(/([^:]\/)\/+/g, "$1");
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getInstanceStatus() {
    const config = this.getConfig();
    if (!config?.instanceName) return { instance: { state: 'offline' } };
    return this.request(`instance/connectionStatus/${config.instanceName}`);
  }

  async fetchMessages() {
    const config = this.getConfig();
    if (!config?.instanceName) return { messages: [] };
    // We poll for unread messages as a webhook substitute
    return this.request(`chat/findMessages/${config.instanceName}`, 'POST', {
      read: false
    });
  }

  async sendMessage(to: string, text: string) {
    const config = this.getConfig();
    if (!config?.instanceName) return;
    
    // Ensure the number is formatted correctly for Evolution
    const number = to.split('@')[0];

    return this.request(`message/sendText/${config.instanceName}`, 'POST', {
      number: number,
      options: {
        delay: 1500,
        presence: "composing",
        linkPreview: false
      },
      textMessage: {
        text: text
      }
    });
  }
}

export const evolutionService = new EvolutionService();
