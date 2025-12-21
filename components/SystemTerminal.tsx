
import React, { useState, useEffect, useRef } from 'react';
import { dataService } from '../services/dataService';
import { LogEntry } from '../types';

const SystemTerminal: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      const data = await dataService.getLogs();
      // Filter for incoming (WEBHOOK), outgoing (SUCCESS), and errors (ERROR)
      const filtered = data.filter(log => 
        (log.type === 'WEBHOOK' && log.details?.text) || 
        (log.type === 'SUCCESS' && log.details?.text) ||
        (log.type === 'ERROR')
      );
      setLogs(filtered);
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full space-y-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center px-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">System Monitor & Terminal</h2>
          <p className="text-slate-500 text-sm font-medium">Real-time trace of conversations and system exceptions.</p>
        </div>
        <div className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200">
          <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block mr-2 animate-pulse"></span>
          Diagnostic Stream Active
        </div>
      </div>

      <div className="flex-1 bg-slate-950 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden font-mono flex flex-col relative">
        {/* Terminal Header */}
        <div className="bg-slate-900/80 backdrop-blur px-6 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-rose-500/50 rounded-full"></div>
            <div className="w-3 h-3 bg-amber-500/50 rounded-full"></div>
            <div className="w-3 h-3 bg-emerald-500/50 rounded-full"></div>
            <span className="ml-4 text-emerald-500/70 font-bold uppercase tracking-widest text-[10px]">ECOSPOT_V4_CORE_TRACE</span>
          </div>
          <div className="text-slate-500 text-[9px] uppercase font-bold">
            Root Access / Debug Mode
          </div>
        </div>

        {/* Scrollable Terminal Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
          {logs.slice().reverse().map((log) => {
            const isIncoming = log.type === 'WEBHOOK';
            const isError = log.type === 'ERROR';
            const isSuccess = log.type === 'SUCCESS';
            
            const sender = log.details?.jid || log.details?.attemptedNumber || 'System';
            const number = sender.split('@')[0];
            const text = log.details?.text || log.message || '';

            return (
              <div 
                key={log.id} 
                className={`flex flex-col space-y-2 animate-in slide-in-from-left-4 duration-300 ${
                  isError ? 'items-center w-full' : isIncoming ? 'items-start' : 'items-end'
                }`}
              >
                <div className={`flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest ${
                  isError ? 'text-rose-400' : isIncoming ? 'text-blue-400' : 'text-emerald-400'
                }`}>
                  <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span>
                    {isError ? `!!! CRITICAL ERROR [CORE]` : 
                     isIncoming ? `<<< INBOUND FROM [${number}]` : 
                     `>>> OUTBOUND TO [${number}]`}
                  </span>
                </div>
                
                <div className={`max-w-[85%] p-4 rounded-2xl border ${
                  isError 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-100 w-full font-mono' 
                    : isIncoming 
                      ? 'bg-blue-500/5 border-blue-500/20 text-blue-100 rounded-tl-none' 
                      : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-100 rounded-tr-none'
                }`}>
                  {isError ? (
                    <div className="space-y-2">
                      <p className="text-rose-400 font-black">EXCEPTION DETECTED:</p>
                      <p className="text-[12px]">{log.message}</p>
                      {log.details && (
                        <pre className="text-[10px] bg-black/40 p-3 rounded-lg border border-rose-500/20 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ) : (
                    <p className="text-[13px] leading-relaxed font-medium">
                      {text}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          
          {logs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30 py-20">
              <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
              <p className="text-emerald-500 font-bold uppercase tracking-widest text-sm">Initializing Protocol...</p>
              <p className="text-slate-500 text-[10px] max-w-xs text-center">Waiting for communication packets or system exceptions to hit the kernel.</p>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Scanline Effect Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,128,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-2">
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Incoming</p>
            <p className="text-sm font-bold text-white">{logs.filter(l => l.type === 'WEBHOOK').length}</p>
          </div>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Outgoing</p>
            <p className="text-sm font-bold text-white">{logs.filter(l => l.type === 'SUCCESS').length}</p>
          </div>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Exceptions</p>
            <p className="text-sm font-bold text-white">{logs.filter(l => l.type === 'ERROR').length}</p>
          </div>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Health</p>
            <p className="text-sm font-bold text-white">
              {logs.filter(l => l.type === 'ERROR').length > 0 ? 'WARNING' : 'STABLE'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemTerminal;
