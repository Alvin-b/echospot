
import { MaintenanceRecord, ReportedIssue, EvolutionConfig } from '../types';

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

      if (!response.ok) {
        // If we get a 404 or other error, log it and return null instead of trying to parse JSON
        console.warn(`DataService: Request to ${endpoint} failed with status ${response.status}`);
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return null;
    } catch (e) {
      console.error(`DataService Error on ${endpoint}:`, e);
      return null;
    }
  }

  async getDashboardData() {
    return this.request('/api/data');
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

  async addReportedIssue(issue: ReportedIssue) {
    const issues = await this.getReportedIssues();
    issues.unshift(issue);
    return this.request('/api/issues', 'POST', issues);
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

  async saveConfig(config: EvolutionConfig) {
    return this.request('/api/config', 'POST', config);
  }
}

export const dataService = new DataService();
