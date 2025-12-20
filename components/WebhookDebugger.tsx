
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { LogEntry } from '../types';

const WebhookDebugger: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [testText, setTestText] = useState('How much is the 6mbps plan?');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
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
          <p className="text-slate-500 text-sm">Real-time inspection of server-to-server communication.</p>
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

      <div className="bg-emerald-900 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-900/20 border border-emerald-800">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86 1.417l-1.606 1.606a2 2 0 01-2.112.376M15.428 4.572a2 2 0 00-.547 1.022l-.477 2.387a6 6 0 001.417 3.86l1.606 1.606a2 2 0 01.376 2.112M12 8V4m0 0L8 8m4-4l4 4m-4 11h.01M4.572 4.572l14.856 14.856"/></svg>
          Simulate Incoming Message
        </h3>
        <p className="text-emerald-100/70 text-xs mb-6">
          Manually trigger the server's webhook handler to verify if your config is working correctly. This bypasses WhatsApp but tests the AI + Evolution API logic.
        </p>
        <div className="flex gap-3">
          <input 
            type="text" 
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="flex-1 bg-emerald-950/50 border border-emerald-700 rounded-xl px-5 py-3 text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
            placeholder="Type a test message..."
          />
          <button 
            onClick={runSimulation}
            disabled={isTesting}
            className="bg-white text-emerald-900 px-6 py-3 rounded-xl font-bold text-sm hover:bg-emerald-50 active:scale-95 transition-all disabled:opacity-50"
          >
            {isTesting ? 'Processing...' : 'Simulate Event'}
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
          <div className="text-slate-500 text-[9px] uppercase font-bold flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Watcher Active
          </div>
        </div>

        <div className="h-[500px] overflow-y-auto p-6 space-y-4">
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
            <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-4">
              <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <p className="italic">The console is empty. Use "Simulate Event" above to test.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-sm">1</span>
            Verification Checklist
          </h3>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <input type="checkbox" readOnly checked className="mt-1 accent-emerald-500" />
              <span>Evolution Instance is <b>Connected/Open</b></span>
            </li>
            <li className="flex gap-3">
              <input type="checkbox" readOnly checked className="mt-1 accent-emerald-500" />
              <span>URL ends in <code className="text-rose-600">/api/sync</code></span>
            </li>
            <li className="flex gap-3">
              <input type="checkbox" readOnly checked className="mt-1 accent-emerald-500" />
              <span>Event <code className="text-rose-600">MESSAGES_UPSERT</code> is active</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-sm">?</span>
            Common Issues
          </h3>
          <div className="space-y-4 text-xs">
            <div>
              <p className="font-bold text-slate-900 mb-1">Payload Error: Malformed</p>
              <p className="text-slate-500">The server received data but it doesn't look like an Evolution message. Check your "Webhook Type" in Evolution (set to Instance).</p>
            </div>
            <div>
              <p className="font-bold text-slate-900 mb-1">No Log Entry on Message</p>
              <p className="text-slate-500">Your server isn't being reached. Ensure your Render URL is public and not behind a firewall or restricted by IP.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookDebugger;
