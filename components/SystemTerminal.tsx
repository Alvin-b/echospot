
import React, { useState, useEffect, useRef } from 'react';
import { dataService } from '../services/dataService';
import { LogEntry } from '../types';

const SystemTerminal: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      const data = await dataService.getLogs();
      setLogs(data);
      setLastHeartbeat(new Date());
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full space-y-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center px-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Kernel Terminal</h2>
          <p className="text-slate-500 text-sm font-medium">Monitoring raw packet flow and agent logic processing.</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last Kernel Ping</p>
             <p className="text-[10px] font-mono text-slate-600">{lastHeartbeat?.toLocaleTimeString() || 'Connecting...'}</p>
           </div>
           <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 flex items-center gap-3">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
            System Live
          </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-950 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden font-mono flex flex-col relative">
        {/* Terminal Header */}
        <div className="bg-slate-900/80 backdrop-blur px-6 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-rose-500/50 rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-amber-500/50 rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-emerald-500/50 rounded-full"></div>
            <span className="ml-4 text-emerald-500/70 font-bold uppercase tracking-widest text-[10px]">ECOSPOT_V4_TRACE_DUMP</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-600 text-[9px] font-bold">TTY: /dev/pts/0</span>
            <div className="text-slate-500 text-[9px] uppercase font-bold">MODE: VERBOSE_DIAGNOSTIC</div>
          </div>
        </div>

        {/* Scrollable Terminal Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
          {logs.slice().reverse().map((log) => {
            const isIncoming = log.type === 'WEBHOOK';
            const isError = log.type === 'ERROR';
            const isInfo = log.type === 'INFO';
            
            const sender = log.details?.jid || log.details?.number || log.details?.target || 'SYS';
            const number = sender.split('@')[0];
            const text = log.details?.text || log.message || '';

            return (
              <div 
                key={log.id} 
                className={`flex flex-col space-y-1 animate-in slide-in-from-left-4 duration-300 ${
                  isError || isInfo ? 'w-full' : isIncoming ? 'items-start' : 'items-end'
                }`}
              >
                <div className={`flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest ${
                  isError ? 'text-rose-400' : 
                  isInfo ? 'text-slate-600' :
                  isIncoming ? 'text-blue-500' : 'text-emerald-500'
                }`}>
                  <span className="text-slate-800">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span>
                    {isError ? `! EXCEPTION` : 
                     isInfo ? `* TRACE` :
                     isIncoming ? `<< IN [${number}]` : 
                     `>> OUT [${number}]`}
                  </span>
                </div>
                
                <div className={`max-w-[90%] p-4 rounded-xl border transition-all ${
                  isError 
                    ? 'bg-rose-500/5 border-rose-500/20 text-rose-200 w-full' 
                    : isInfo
                      ? 'bg-slate-900/30 border-slate-800/50 text-slate-500 w-full text-[10px] font-bold py-2'
                      : isIncoming 
                        ? 'bg-blue-500/5 border-blue-500/10 text-blue-100 rounded-tl-none' 
                        : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-100 rounded-tr-none'
                }`}>
                  {isError ? (
                    <div className="space-y-2">
                      <p className="text-rose-400 font-black">{log.message}</p>
                      {log.details && (
                        <pre className="text-[9px] bg-black/40 p-2 rounded border border-rose-500/10 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ) : (
                    <p className="text-[12px] leading-relaxed">
                      {text}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          
          {logs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-30 py-32">
              <div className="w-12 h-12 border-2 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
              <div className="text-center">
                <p className="text-emerald-500 font-bold uppercase tracking-widest text-xs mb-1">Link Established</p>
                <p className="text-slate-600 text-[9px] uppercase font-black">Awaiting Handshake from Evolution API...</p>
              </div>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,128,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-2 pb-12">
        <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inbound</p>
            <p className="text-sm font-bold text-white">{logs.filter(l => l.type === 'WEBHOOK').length}</p>
          </div>
        </div>
        <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Outbound</p>
            <p className="text-sm font-bold text-white">{logs.filter(l => l.type === 'SUCCESS').length}</p>
          </div>
        </div>
        <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Exceptions</p>
            <p className="text-sm font-bold text-white">{logs.filter(l => l.type === 'ERROR').length}</p>
          </div>
        </div>
        <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Stability</p>
            <p className="text-sm font-bold text-white">HEALTHY</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemTerminal;
