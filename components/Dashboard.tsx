
import React, { useState, useEffect } from 'react';
import { ReportedIssue, LogEntry } from '../types';
import { Link } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { evolutionService } from '../services/evolutionService';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ issuesCount: 0, maintenanceCount: 0 });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [connStatus, setConnStatus] = useState<'IDLE' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('IDLE');
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);

  const checkConn = async () => {
    try {
      const res = await evolutionService.getInstanceStatus();
      setConnStatus(res.status);
    } catch (e) {
      setConnStatus('ERROR');
    }
  };

  const loadLogs = async () => {
    const logs = await dataService.getLogs();
    setRecentLogs(logs.slice(0, 5));
  };

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/sync`);
    const loadData = async () => {
      const data = await dataService.getDashboardData();
      if (data) {
        setStats({
          issuesCount: data.issues?.length || 0,
          maintenanceCount: data.maintenance?.length || 0
        });
      }
      checkConn();
      loadLogs();
    };
    loadData();
    const interval = setInterval(() => {
      checkConn();
      loadLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl border border-white/5">
          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-6">
              <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
                <svg className="w-6 h-6 text-emerald-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight mb-1">EcoSpot Command</h1>
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${connStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></div>
                   <p className="text-emerald-400 font-bold text-[10px] uppercase tracking-[0.2em]">
                     {connStatus === 'CONNECTED' ? 'System Live' : 'System Offline'}
                   </p>
                </div>
              </div>
            </div>
            
            <p className="text-slate-400 max-w-xl mb-10 leading-relaxed text-sm font-medium">
              The AI agent monitors your Evolution API instance 24/7. Copy the Webhook URL below into your Evolution Dashboard to enable automation.
            </p>

            <div className="flex bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-inner group max-w-md">
              <div className="px-5 py-4 text-[10px] font-mono font-bold text-slate-400 group-hover:text-emerald-400 transition-colors truncate select-all">{webhookUrl}</div>
              <button 
                onClick={() => { navigator.clipboard.writeText(webhookUrl); alert('Copied!'); }}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-5 py-4 font-black text-[10px] uppercase tracking-widest transition-all"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-[20rem] h-[20rem] bg-emerald-500 rounded-full blur-[160px] opacity-10 pointer-events-none"></div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl flex flex-col justify-center space-y-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Critical Issues</p>
            <p className="text-2xl font-black text-rose-600 tracking-tight">{stats.issuesCount}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Outages</p>
            <p className="text-2xl font-black text-emerald-600 tracking-tight">{stats.maintenanceCount}</p>
          </div>
          <Link to="/settings" className="w-full py-4 bg-slate-900 text-white rounded-2xl text-center text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
            Manage Instance
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 text-lg uppercase tracking-wider">Live Agent Activity</h3>
            <Link to="/debug" className="text-[10px] font-bold text-emerald-600 uppercase hover:underline">View Full Logs</Link>
          </div>
          
          <div className="space-y-4">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 animate-in slide-in-from-bottom-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  log.type === 'SUCCESS' ? 'bg-emerald-500' :
                  log.type === 'ERROR' ? 'bg-rose-500' :
                  log.type === 'WEBHOOK' ? 'bg-blue-500' : 'bg-slate-300'
                }`}></div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[11px] font-bold text-slate-800">{log.message}</p>
                    <span className="text-[9px] font-bold text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  {log.type === 'ERROR' && log.details?.status && (
                    <p className="text-[9px] text-rose-600 font-bold mt-1 bg-rose-50 p-2 rounded-lg border border-rose-100">
                      Error {log.details.status}: {typeof log.details.responseBody === 'string' ? log.details.responseBody.substring(0, 80) : 'Check logs for details'}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-slate-400 text-sm italic">Waiting for incoming messages...</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-emerald-50 rounded-[2.5rem] p-8 border border-emerald-100 shadow-sm flex flex-col">
          <h4 className="font-black text-emerald-900 text-sm mb-6 uppercase tracking-wider">Troubleshooting</h4>
          <div className="space-y-6 flex-1">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">1. Webhook Status</p>
              <p className="text-[11px] text-emerald-700/70 leading-relaxed">
                If no "Message Received" logs appear, Evolution is not reaching this server. Check your <b>Instance Webhook settings</b>.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">2. API Credential Check</p>
              <p className="text-[11px] text-emerald-700/70 leading-relaxed">
                If logs show "Evolution API rejected", your <b>Global API Key</b> or <b>Base URL</b> is likely wrong.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">3. AI Service</p>
              <p className="text-[11px] text-emerald-700/70 leading-relaxed">
                If logs show "Gemini API Error", ensure <b>GEMINI_API_KEY</b> is correctly set in your environment.
              </p>
            </div>
          </div>
          <button 
            onClick={checkConn}
            className="mt-8 w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
          >
            Refresh Status
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
