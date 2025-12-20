
import { MaintenanceRecord, ReportedIssue } from '../types';

export class DataService {
  private maintenanceKey = 'ecospot_maintenance';
  private issuesKey = 'ecospot_issues';

  getMaintenanceRecords(): MaintenanceRecord[] {
    const saved = localStorage.getItem(this.maintenanceKey);
    return saved ? JSON.parse(saved) : [];
  }

  saveMaintenanceRecord(record: MaintenanceRecord) {
    const records = this.getMaintenanceRecords();
    const index = records.findIndex(r => r.id === record.id);
    if (index >= 0) {
      records[index] = record;
    } else {
      records.push(record);
    }
    localStorage.setItem(this.maintenanceKey, JSON.stringify(records));
  }

  deleteMaintenanceRecord(id: string) {
    const records = this.getMaintenanceRecords().filter(r => r.id !== id);
    localStorage.setItem(this.maintenanceKey, JSON.stringify(records));
  }

  getReportedIssues(): ReportedIssue[] {
    const saved = localStorage.getItem(this.issuesKey);
    return saved ? JSON.parse(saved) : [];
  }

  addReportedIssue(issue: ReportedIssue) {
    const issues = this.getReportedIssues();
    issues.unshift(issue); // Newest first
    localStorage.setItem(this.issuesKey, JSON.stringify(issues));
  }

  updateIssueStatus(id: string, status: ReportedIssue['status']) {
    const issues = this.getReportedIssues();
    const index = issues.findIndex(i => i.id === id);
    if (index >= 0) {
      issues[index].status = status;
      localStorage.setItem(this.issuesKey, JSON.stringify(issues));
    }
  }

  deleteIssue(id: string) {
    const issues = this.getReportedIssues().filter(i => i.id !== id);
    localStorage.setItem(this.issuesKey, JSON.stringify(issues));
  }
}

export const dataService = new DataService();
