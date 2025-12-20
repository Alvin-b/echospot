
import React from 'react';
import { MOCK_REPORTED_ISSUES } from '../constants';

const IssuesLog: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Escalated Customer Issues</h2>
          <p className="text-slate-500 text-sm">Review problems the AI flagged as serious or unresolvable.</p>
        </div>
        <div className="flex gap-2">
           <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">Export CSV</button>
           <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all">Mark All Read</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Issue Description</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Severity</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {MOCK_REPORTED_ISSUES.map((issue) => (
              <tr key={issue.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900 text-sm">{issue.customerPhone}</div>
                  <div className="text-[10px] text-slate-400">{issue.timestamp.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-600 font-medium">{issue.location}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-600 max-w-xs truncate" title={issue.description}>
                    {issue.description}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter ${
                    issue.severity === 'Critical' ? 'bg-red-50 text-red-600' : 
                    issue.severity === 'Warning' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {issue.severity}
                  </span>
                </td>
                <td className="px-6 py-4">
                   <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        issue.status === 'Pending' ? 'bg-amber-500' : 
                        issue.status === 'Acknowledged' ? 'bg-blue-500' : 'bg-emerald-500'
                      }`}></span>
                      <span className="text-xs font-semibold text-slate-700">{issue.status}</span>
                   </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-emerald-600 hover:text-emerald-700 text-sm font-bold">Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {MOCK_REPORTED_ISSUES.length === 0 && (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-lg font-bold text-slate-800">No issues to show</h3>
            <p className="text-slate-500 text-sm">Your AI agent is handling everything smoothly.</p>
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-900 rounded-3xl text-white flex flex-col md:flex-row items-center gap-6 justify-between">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">⚡</div>
           <div>
              <h4 className="font-bold">Automated Report Sync</h4>
              <p className="text-xs text-slate-400">Issues are piped directly from Evolution API webhooks as they happen.</p>
           </div>
        </div>
        <button className="w-full md:w-auto bg-emerald-500 px-6 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors">Setup Custom Webhooks</button>
      </div>
    </div>
  );
};

export default IssuesLog;
