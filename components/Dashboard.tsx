
import React, { useState, useEffect, useRef } from 'react';
import { ReportedIssue, MaintenanceRecord, ChatMessage, MessageRole } from '../types';
import { MOCK_REPORTED_ISSUES, MOCK_MAINTENANCE } from '../constants';
import { Link } from 'react-router-dom';
import { evolutionService } from '../services/evolutionService';
import { geminiService } from '../services/geminiService';

const Dashboard: React.FC = () => {
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState<'online' | 'offline' | 'error'>('offline');
  const [processedCount, setProcessedCount] = useState(0);
  const [recentTraffic, setRecentTraffic] = useState<{from: string, text: string, time: Date}[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  
  const repliedMessageIds = useRef<Set<string>>(new Set());
  const conversationContexts = useRef<Map<string, {role: string, content: string}[]>>(new Map());

  useEffect(() => {
    // Dynamically detect the actual hosting URL
    const currentOrigin = window.location.origin;
    // We append /webhook for the user to paste, even though we use polling logic locally
    setWebhookUrl(`${currentOrigin}/webhook`);

    let interval: any;
    if (isLive) {
      checkInstance();
      interval = setInterval(handleAutoReplyCycle, 4000);
    } else {
      setStatus('offline');
    }
    return () => clearInterval(interval);
  }, [isLive]);

  const checkInstance = async () => {
    try {
      const res = await evolutionService.getInstanceStatus();
      setStatus(res.instance.state === 'open' ? 'online' : 'offline');
    } catch (e) {
      setStatus('error');
    }
  };

  const handleAutoReplyCycle = async () => {
    try {
      const response = await evolutionService.fetchMessages();
      const messages = response.messages || [];
      
      const newIncoming = messages.filter((m: any) => 
        !m.key.fromMe && 
        (m.message?.conversation || m.message?.extendedTextMessage?.text) && 
        !repliedMessageIds.current.has(m.key.id)
      );

      for (const msg of newIncoming) {
        const sender = msg.key.remoteJid;
        const pushName = msg.pushName || "Customer";
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        const msgId = msg.key.id;

        repliedMessageIds.current.add(msgId);
        evolutionService.saveOrUpdateContact(sender, pushName);
        
        setRecentTraffic(prev => [{ from: pushName, text, time: new Date() }, ...prev].slice(0, 8));

        if (!conversationContexts.current.has(sender)) {
          conversationContexts.current.set(sender, []);
        }
        const history = conversationContexts.current.get(sender)!;
        history.push({ role: MessageRole.USER, content: text });
        if (history.length > 20) history.splice(0, 2);

        const { text: aiResponse, isSerious } = await geminiService.generateResponse(history, MOCK_MAINTENANCE);
        history.push({ role: 'agent', content: aiResponse });

        await evolutionService.sendMessage(sender, aiResponse);
        setProcessedCount(prev => prev + 1);
      }
    } catch (e) {
      console.error("Polling error:", e);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    alert('Webhook URL copied! Paste this in your Evolution API instance settings.');
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
      {/* Top Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-emerald-950/40 border border-emerald-800">
          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-8">
              <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight mb-1">EcoSpot AI Engine</h1>
                <p className="text-emerald-400 font-bold text-xs uppercase tracking-[0.2em]">Deployment Ready • Render.com</p>
              </div>
            </div>
            
            <p className="text-emerald-100/70 max-w-xl mb-12 leading-relaxed text-lg font-medium">
              Your intelligent agent is currently monitoring WhatsApp traffic. Use the <b>Webhook URL</b> below to link your Evolution API instance to this hosted dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <button 
                onClick={() => setIsLive(!isLive)}
                className={`w-full sm:w-auto px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-4 group ${
                  isLive ? 'bg-emerald-400 text-emerald-950 scale-105 shadow-2xl shadow-emerald-400/40' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-950 animate-pulse' : 'bg-slate-500'}`}></span>
                {isLive ? 'Live Engine Active' : 'Start Agent Logic'}
                <svg className={`w-5 h-5 transition-transform duration-300 ${isLive ? 'rotate-90' : 'group-hover:translate-x-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </button>

              <div className="flex w-full sm:w-auto bg-black/30 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-inner">
                <div className="px-6 py-5 text-xs font-mono font-bold text-emerald-300 max-w-[240px] truncate select-all">{webhookUrl}</div>
                <button 
                  onClick={copyToClipboard}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-6 py-5 font-black text-[10px] uppercase tracking-widest transition-all border-l border-white/10 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                  Copy URL
                </button>
              </div>
            </div>
          </div>
          
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-[30rem] h-[30rem] bg-emerald-500 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-80 h-80 bg-emerald-400 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
        </div>

        {/* Stats Column */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-[11px]">System Health</h3>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm ${status === 'online' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {status}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 transition-hover hover:border-emerald-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contacts Captured</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">{evolutionService.getContacts().length}</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 transition-hover hover:border-emerald-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Auto-Replies</p>
                  <p className="text-3xl font-black text-emerald-600 tracking-tight">{processedCount}</p>
                </div>
              </div>
            </div>
          </div>
          
          <Link to="/broadcast" className="group bg-slate-900 rounded-[2rem] p-6 text-white flex items-center justify-between hover:bg-black transition-all shadow-xl shadow-slate-900/20">
            <div>
              <p className="font-black text-xs uppercase tracking-widest text-emerald-400 mb-1">Marketing</p>
              <p className="font-bold text-sm">Send Broadcast</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-emerald-950 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
            </div>
          </Link>
        </div>
      </div>

      {/* Traffic & Config Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Traffic */}
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
            <div>
              <h3 className="font-black text-slate-800 text-xl tracking-tight">Live Traffic Feed</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time engagement capture</p>
            </div>
            <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Tunnel</span>
            </div>
          </div>
          <div className="flex-1 p-8 overflow-y-auto">
            {recentTraffic.length > 0 ? (
              <div className="space-y-4">
                {recentTraffic.map((t, idx) => (
                  <div key={idx} className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 animate-in slide-in-from-bottom-5 duration-500 hover:border-emerald-200 hover:bg-white transition-all shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                       <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">{t.from}</span>
                       <span className="text-[10px] font-bold text-slate-400 tabular-nums">{t.time.toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">"{t.text}"</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-32">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
                  <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                </div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Waiting for WhatsApp events...</p>
              </div>
            )}
          </div>
        </div>

        {/* Hosted Config */}
        <div className="space-y-8">
          <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl shadow-slate-900/30 flex flex-col justify-between">
             <div>
                <h3 className="font-black text-xl mb-6">Cloud Setup Instructions</h3>
                <div className="space-y-6">
                   <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 border border-emerald-500/20">1</div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        In Render dashboard, go to <b>Environment Variables</b> and add <code className="text-emerald-400 bg-white/5 px-2 py-1 rounded">API_KEY</code> with your Gemini Pro key.
                      </p>
                   </div>
                   <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 border border-emerald-500/20">2</div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Copy the Webhook URL above and paste it into Evolution API to enable real-time message routing to this hosted instance.
                      </p>
                   </div>
                   <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 border border-emerald-500/20">3</div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Keep this tab pinned or open. The agent uses high-performance polling to handle requests without a traditional backend.
                      </p>
                   </div>
                </div>
             </div>
             
             <div className="mt-12 pt-8 border-t border-white/5">
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                   <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-emerald-950 text-xl font-black">💾</div>
                   <div>
                      <p className="text-[10px] font-black uppercase text-emerald-400 mb-0.5">Contact Memory</p>
                      <p className="text-[10px] text-slate-500">Storing {evolutionService.getContacts().length} customers locally.</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-10">
             <h3 className="font-black text-slate-800 uppercase tracking-widest text-[11px] mb-8">Instance Monitoring</h3>
             <div className="space-y-6">
                <div className="flex items-center justify-between group">
                   <span className="text-xs font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Evolution Instance</span>
                   <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{evolutionService.getConfig()?.instanceName || 'Not Linked'}</span>
                </div>
                <div className="flex items-center justify-between group">
                   <span className="text-xs font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Webhook Tunnel</span>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">Synchronized</span>
                </div>
                <div className="flex items-center justify-between group">
                   <span className="text-xs font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Session Memory</span>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">Persistent (Local)</span>
                </div>
             </div>
             <button 
              onClick={() => {
                if(confirm("Are you sure you want to clear memory? This will delete all saved contacts.")) {
                  localStorage.removeItem('ecospot_contacts');
                  window.location.reload();
                }
              }}
              className="w-full mt-10 py-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100"
             >
                Wipe Local Memory
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
