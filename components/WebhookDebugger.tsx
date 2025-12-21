
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { LogEntry } from '../types';

const WebhookDebugger: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [testText, setTestText] = useState('hi');
  const [isTesting, setIsTesting] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/api/sync`);
    if (isPaused) return;
    const fetchLogs = async () => {
      const data = await dataService.getLogs();
      setLogs(data);
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const runSimulation = async () => {
    setIsTesting(true);
    await dataService.testWebhook(testText);
    setTimeout(() => setIsTesting(false), 1000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Webhook Debugger</h2>
          <p className="text-slate-500 text-sm">Monitor live communication between Evolution API and this server.</p>
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
            Clear Log View
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-emerald-900 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-900/20 border border-emerald-800">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Connectivity Diagnostic
          </h3>
          <p className="text-emerald-100/70 text-xs mb-6">
            If your WhatsApp messages aren't appearing below, copy the command below and run it in your computer's terminal (Command Prompt or Terminal).
          </p>
          <div className="bg-emerald-950/50 p-4 rounded-xl border border-emerald-700 font-mono text-[10px] mb-6 select-all break-all">
            curl -X POST "{publicUrl}" -H "Content-Type: application/json" -d '&#123;"event":"test"&#125;'
          </div>
          <div className="flex gap-3">
            <input 
              type="text" 
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="flex-1 bg-emerald-950/50 border border-emerald-700 rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-400"
              placeholder="Test message content..."
            />
            <button 
              onClick={runSimulation}
              disabled={isTesting}
              className="bg-white text-emerald-900 px-5 py-2 rounded-xl font-bold text-xs hover:bg-emerald-50 transition-all disabled:opacity-50"
            >
              {isTesting ? 'Sending...' : 'Simulate POST'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <h4 className="font-bold text-slate-800 text-sm mb-4">Instance Settings</h4>
          <div className="space-y-4">
             <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Target Webhook URL</p>
                <p className="text-[11px] font-mono text-emerald-600 truncate select-all">{publicUrl}</p>
             </div>
             <p className="text-[10px] text-slate-500 leading-relaxed italic">
               Note: This app is set to return "ACK" for every valid request to keep the API stable.
             </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-950 rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden font-mono text-[11px]">
        <div className="bg-slate-900 px-6 py-3 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="ml-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">ecospot-server-trace</span>
          </div>
          <div className="text-slate-500 text-[9px] uppercase font-bold flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Listening for Incoming Events
          </div>
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
                <pre className="mt-2 p-3 bg-white/5 rounded-lg text-slate-500 overflow-x-auto text-[10px] leading-relaxed">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-4 py-20">
              <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <p className="italic">No traffic detected yet. Use the diagnostic command or check Evolution API settings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebhookDebugger;
