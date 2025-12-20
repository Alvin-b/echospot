
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { LogEntry } from '../types';

const WebhookDebugger: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const fetchLogs = async () => {
      const data = await dataService.getLogs();
      setLogs(data);
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Webhook Debugger</h2>
          <p className="text-slate-500 text-sm">Real-time server logs for incoming WhatsApp events.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
              isPaused ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {isPaused ? '▶ Resume Updates' : '⏸ Pause Updates'}
          </button>
          <button 
            onClick={() => setLogs([])}
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50"
          >
            Clear View
          </button>
        </div>
      </div>

      <div className="bg-slate-950 rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden font-mono text-[11px]">
        <div className="bg-slate-900 px-6 py-3 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="ml-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">ecospot-server-logs</span>
          </div>
          <div className="text-slate-500 text-[9px] uppercase font-bold">WebSocket Proxy Active</div>
        </div>

        <div className="h-[600px] overflow-y-auto p-6 space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="border-l-2 border-slate-800 pl-4 py-1 animate-in slide-in-from-left-2">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-slate-600 font-bold">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className={`font-black px-1.5 py-0.5 rounded text-[9px] ${
                  log.type === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' :
                  log.type === 'ERROR' ? 'bg-rose-500/10 text-rose-400' :
                  log.type === 'WEBHOOK' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-slate-500/10 text-slate-400'
                }`}>
                  {log.type}
                </span>
                <span className="text-slate-300 font-medium">{log.message}</span>
              </div>
              {log.details && (
                <pre className="mt-2 p-3 bg-white/5 rounded-lg text-slate-500 overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-4">
              <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <p className="italic">Waiting for incoming events...</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Troubleshooting Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
          <div className="space-y-3">
            <h4 className="text-emerald-600 font-bold">1. URL Mismatch</h4>
            <p className="text-slate-500">Ensure your Evolution Webhook URL is exactly: <br/><code className="bg-slate-100 px-1 rounded text-rose-600 select-all font-mono">{window.location.origin}/api/sync</code></p>
          </div>
          <div className="space-y-3">
            <h4 className="text-emerald-600 font-bold">2. Event Not Selected</h4>
            <p className="text-slate-500">In Evolution API, check the <b>MESSAGES_UPSERT</b> checkbox. Without this, the server receives nothing when you text the bot.</p>
          </div>
          <div className="space-y-3">
            <h4 className="text-emerald-600 font-bold">3. API Key Scope</h4>
            <p className="text-slate-500">Use your <b>Global API Key</b> (the one from your environment variables or initial setup) for the backend to correctly authenticate.</p>
          </div>
          <div className="space-y-3">
            <h4 className="text-emerald-600 font-bold">4. Status Not "Open"</h4>
            <p className="text-slate-500">The instance must show "CONNECTED" in Settings. If it's "Connecting" or "Closed", WhatsApp messages won't trigger the API.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookDebugger;
