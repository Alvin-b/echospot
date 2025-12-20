
import React, { useState, useEffect, useRef } from 'react';
import { ReportedIssue, MaintenanceRecord, ChatMessage, MessageRole } from '../types';
import { Link } from 'react-router-dom';
import { evolutionService } from '../services/evolutionService';
import { geminiService } from '../services/geminiService';
import { dataService } from '../services/dataService';

const Dashboard: React.FC = () => {
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState<'online' | 'offline' | 'error' | 'loading'>('offline');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [recentTraffic, setRecentTraffic] = useState<{from: string, text: string, time: Date}[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  const repliedMessageIds = useRef<Set<string>>(new Set());
  const conversationContexts = useRef<Map<string, {role: string, content: string}[]>>(new Map());

  useEffect(() => {
    const currentOrigin = window.location.origin;
    setWebhookUrl(`${currentOrigin}/api/sync`);

    let interval: any;
    if (isLive) {
      checkInstance();
      interval = setInterval(handleAutoReplyCycle, 6000);
    } else {
      setStatus('offline');
      setErrorMsg(null);
    }
    return () => clearInterval(interval);
  }, [isLive]);

  const checkInstance = async () => {
    setStatus('loading');
    try {
      const res = await evolutionService.getInstanceStatus();
      setStatus(res.instance.state === 'open' ? 'online' : 'offline');
      setErrorMsg(null);
    } catch (e: any) {
      console.error("Dashboard Status Check Error:", e);
      setStatus('error');
      setErrorMsg(e.message || "Unknown Connection Error");
    }
  };

  const handleAutoReplyCycle = async () => {
    setLastSync(new Date());
    try {
      const response = await evolutionService.fetchMessages();
      const messages = response.messages || [];
      
      const newIncoming = messages.filter((m: any) => 
        !m.key.fromMe && 
        (m.message?.conversation || m.message?.extendedTextMessage?.text) && 
        !repliedMessageIds.current.has(m.key.id)
      );

      if (newIncoming.length > 0 && status !== 'online') {
        setStatus('online');
      }

      for (const msg of newIncoming) {
        const sender = msg.key.remoteJid;
        const pushName = msg.pushName || "Customer";
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        const msgId = msg.key.id;

        repliedMessageIds.current.add(msgId);
        evolutionService.saveOrUpdateContact(sender, pushName);
        
        setRecentTraffic(prev => [{ from: pushName, text, time: new Date() }, ...prev].slice(0, 12));

        if (!conversationContexts.current.has(sender)) {
          conversationContexts.current.set(sender, []);
        }
        const history = conversationContexts.current.get(sender)!;
        history.push({ role: MessageRole.USER, content: text });
        if (history.length > 20) history.splice(0, 2);

        // Fetch real maintenance records for context
        const maintenance = dataService.getMaintenanceRecords();
        const { text: aiResponse, isSerious } = await geminiService.generateResponse(history, maintenance);
        history.push({ role: 'agent', content: aiResponse });

        // If AI flagged as serious, log the issue automatically
        if (isSerious) {
          dataService.addReportedIssue({
            id: Date.now().toString(),
            customerPhone: sender.split('@')[0],
            location: "Kenya (WhatsApp)",
            description: text,
            severity: 'Critical',
            timestamp: new Date(),
            status: 'Pending'
          });
        }

        await evolutionService.sendMessage(sender, aiResponse);
        setProcessedCount(prev => prev + 1);
      }
    } catch (e: any) {
      console.error("Evolution Sync Cycle Error:", e);
      if (e.message?.includes("CORS") || e.message?.includes("fetch")) {
        setStatus('error');
        setErrorMsg("Sync interrupted: Connection blocked by server CORS policy.");
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    alert('URL copied! Note: This is a simulated sync URL for your reference.');
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-black rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl border border-white/5">
          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-8">
              <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight mb-1">EcoSpot Command</h1>
                <p className="text-emerald-400 font-bold text-xs uppercase tracking-[0.2em]">Live Traffic Sync • AI Automation</p>
              </div>
            </div>
            
            <p className="text-slate-400 max-w-xl mb-12 leading-relaxed text-lg font-medium">
              Dashboard is active. When "Syncing" is enabled, the agent polls your Evolution instance for new customer messages and replies using the Gemini brain.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <button 
                onClick={() => setIsLive(!isLive)}
                className={`w-full sm:w-auto px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-4 group ${
                  isLive ? 'bg-emerald-500 text-emerald-950 scale-105 shadow-2xl shadow-emerald-400/40' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-950 animate-pulse' : 'bg-slate-500'}`}></span>
                {isLive ? 'Syncing Active' : 'Start Sync Engine'}
              </button>

              <div className="flex w-full sm:w-auto bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-inner group">
                <div className="px-6 py-5 text-xs font-mono font-bold text-slate-400 group-hover:text-emerald-400 transition-colors max-w-[240px] truncate select-all">{webhookUrl}</div>
                <button 
                  onClick={copyToClipboard}
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-5 font-black text-[10px] uppercase tracking-widest transition-all border-l border-white/10"
                >
                  Sync URL
                </button>
              </div>
            </div>
          </div>
          
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-[30rem] h-[30rem] bg-emerald-500 rounded-full blur-[160px] opacity-10 pointer-events-none"></div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-[11px]">System Status</h3>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm ${
                  status === 'online' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                  status === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                  status === 'loading' ? 'bg-slate-50 text-slate-400 border-slate-100 animate-pulse' :
                  'bg-slate-50 text-slate-400 border-slate-100'
                }`}>
                  {status}
                </span>
              </div>
              
              <div className="space-y-4">
                {status === 'error' && (
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 mb-2">
                    <p className="text-[9px] font-black text-rose-700 uppercase tracking-widest mb-1">CORS Block Detected</p>
                    <p className="text-[10px] text-rose-600 font-medium leading-tight">
                      {errorMsg}
                    </p>
                    <Link to="/settings" className="inline-block mt-3 text-[10px] font-black text-rose-800 underline uppercase tracking-widest hover:text-rose-900 transition-colors">Server Fix Guide →</Link>
                  </div>
                )}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Contacts</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">{evolutionService.getContacts().length}</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Automated Replies</p>
                  <p className="text-3xl font-black text-emerald-600 tracking-tight">{processedCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
          <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <div>
              <h3 className="font-black text-slate-800 text-xl tracking-tight">Live Message Feed</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {lastSync ? `Last Sync: ${lastSync.toLocaleTimeString()}` : 'Ready for first sync'}
              </p>
            </div>
            {isLive && (
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                 <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Polling Live</span>
              </div>
            )}
          </div>
          <div className="flex-1 p-8 overflow-y-auto max-h-[500px]">
            {recentTraffic.length > 0 ? (
              <div className="space-y-4">
                {recentTraffic.map((t, idx) => (
                  <div key={idx} className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 animate-in slide-in-from-bottom-3 duration-500">
                    <div className="flex justify-between items-center mb-3">
                       <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">{t.from}</span>
                       <span className="text-[10px] font-bold text-slate-400 tabular-nums">{t.time.toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">"{t.text}"</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-32 opacity-40">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                <p className="text-xs font-black uppercase tracking-[0.2em]">No traffic detected yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
             <div className="relative z-10">
               <h3 className="font-black text-xl mb-6">Real-Time Sync Notice</h3>
               <div className="space-y-6">
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center font-black shrink-0">1</div>
                     <p className="text-xs text-slate-400 leading-relaxed">
                       This dashboard uses <b>Short-PollingSync</b>. It checks your Evolution API instance every 6 seconds for new unread messages.
                     </p>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center font-black shrink-0">2</div>
                     <p className="text-xs text-slate-400 leading-relaxed">
                       Unread messages are automatically processed by Gemini and marked as read upon reply.
                     </p>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center font-black shrink-0">3</div>
                     <p className="text-xs text-slate-400 leading-relaxed">
                       If the sync fails, check your <b>CORS settings</b> in the API Settings tab.
                     </p>
                  </div>
               </div>
             </div>
             <div className="absolute bottom-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
             </div>
          </div>

          <div className="bg-emerald-50 rounded-[2.5rem] border border-emerald-100 shadow-sm p-10">
             <h3 className="font-black text-emerald-900 uppercase tracking-widest text-[11px] mb-8">AI Intelligence Hub</h3>
             <p className="text-xs text-emerald-800/70 mb-6 leading-relaxed font-medium">
               The agent uses real-time context from your "Network Health" and "Plans" sections. If you update an outage report, the agent will immediately begin informing affected customers.
             </p>
             <Link to="/maintenance" className="w-full py-4 bg-white text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center block shadow-sm border border-emerald-100 hover:bg-emerald-100 transition-all">
               Update Network Status
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
