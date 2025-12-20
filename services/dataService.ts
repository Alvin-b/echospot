
import { MaintenanceRecord, ReportedIssue, EvolutionConfig, LogEntry } from '../types';

export class DataService {
  private async request(endpoint: string, method: string = 'GET', body?: any) {
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) return null;

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async getDashboardData() { return this.request('/api/data'); }
  async getLogs(): Promise<LogEntry[]> { return await this.request('/api/logs') || []; }
  
  async testWebhook(text: string) {
    return this.request('/api/test-webhook', 'POST', { text });
  }

  async saveMaintenanceRecord(record: MaintenanceRecord) {
    const records = await this.getMaintenanceRecords();
    records.push(record);
    return this.request('/api/maintenance', 'POST', records);
  }
  async getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
    const data = await this.getDashboardData();
    return data?.maintenance || [];
  }
  async deleteMaintenanceRecord(id: string) {
    const records = (await this.getMaintenanceRecords()).filter(r => r.id !== id);
    return this.request('/api/maintenance', 'POST', records);
  }
  async getReportedIssues(): Promise<ReportedIssue[]> {
    const data = await this.getDashboardData();
    return data?.issues || [];
  }
  async updateIssueStatus(id: string, status: ReportedIssue['status']) {
    const issues = await this.getReportedIssues();
    const index = issues.findIndex(i => i.id === id);
    if (index >= 0) {
      issues[index].status = status;
      return this.request('/api/issues', 'POST', issues);
    }
  }
  async deleteIssue(id: string) {
    const issues = (await this.getReportedIssues()).filter(i => i.id !== id);
    return this.request('/api/issues', 'POST', issues);
  }
  async saveConfig(config: EvolutionConfig) { return this.request('/api/config', 'POST', config); }
}

export const dataService = new DataService();
