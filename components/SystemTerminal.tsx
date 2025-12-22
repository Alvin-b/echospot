
import React, { useState, useEffect, useRef } from 'react';
import { dataService } from '../services/dataService';
import { LogEntry } from '../types';

const SystemTerminal: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      const data = await dataService.getLogs();
      setLogs(data);
      setLastPing(new Date());
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full space-y-4 max-w-6xl mx-auto pb-10">
      <div className="flex justify-between items-center px-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">EcoSpot Core Terminal</h2>
          <p className="text-slate-500 text-sm font-medium">Monitoring server-side AI logic and Evolution Webhook packets.</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Server Uptime</p>
             <p className="text-[10px] font-mono text-slate-600 font-bold">{lastPing?.toLocaleTimeString() || 'Connecting...'}</p>
           </div>
           <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 flex items-center gap-3">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
            System Active
          </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-950 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden font-mono flex flex-col relative">
        <div className="bg-slate-900/80 backdrop-blur px-6 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-rose-500/50 rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-amber-500/50 rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-emerald-500/50 rounded-full"></div>
            <span className="ml-4 text-emerald-500/70 font-bold uppercase tracking-widest text-[10px]">ECOSPOT_v4_KERNEL_LOG</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-600 text-[9px] font-bold tracking-widest">DAEMON: RUNNING</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
          {logs.slice().reverse().map((log) => {
            const isWebhook = log.type === 'WEBHOOK';
            const isError = log.type === 'ERROR';
            const isSuccess = log.type === 'SUCCESS';
            const isInfo = log.type === 'INFO';
            
            const sender = log.details?.sender || log.details?.number || 'SYSTEM';
            const number = sender.split('@')[0];
            const text = log.details?.reply || log.details?.text || log.message || '';

            return (
              <div 
                key={log.id} 
                className={`flex flex-col space-y-1 animate-in slide-in-from-left-4 duration-300 ${
                  isError || isInfo ? 'w-full' : isWebhook ? 'items-start' : 'items-end'
                }`}
              >
                <div className={`flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest ${
                  isError ? 'text-rose-400' : 
                  isInfo ? 'text-slate-500' :
                  isWebhook ? 'text-blue-500' : 'text-emerald-500'
                }`}>
                  <span className="text-slate-800">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span>
                    {isError ? `! FAULT` : 
                     isInfo ? `* TRACE` :
                     isWebhook ? `<< WEBHOOK [${number}]` : 
                     `>> EVOLUTION [${number}]`}
                  </span>
                </div>
                
                <div className={`max-w-[90%] p-4 rounded-xl border transition-all ${
                  isError 
                    ? 'bg-rose-500/5 border-rose-500/20 text-rose-200 w-full' 
                    : isInfo
                      ? 'bg-slate-900/30 border-slate-800/50 text-slate-500 w-full text-[10px] font-bold py-2 px-4'
                      : isWebhook 
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
              <p className="text-slate-600 text-[10px] uppercase font-black tracking-[0.2em]">Awaiting Packets...</p>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};

export default SystemTerminal;
