
export enum MessageRole {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  senderName?: string;
  senderId?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'ERROR' | 'WEBHOOK';
  message: string;
  details?: any;
}

export interface WifiPlan {
  name: string;
  speed: string;
  price: string;
  type: 'Monthly' | 'Portal';
  duration?: string;
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  area: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Outage';
  description: string;
  estimatedResolution?: string;
}

export interface ReportedIssue {
  id: string;
  customerPhone: string;
  location: string;
  description: string;
  severity: 'Critical' | 'Warning' | 'Low';
  timestamp: Date;
  status: 'Pending' | 'Acknowledged' | 'Resolved';
}

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

export interface Contact {
  jid: string;
  name: string;
  lastInteraction: Date;
  messageCount: number;
}
