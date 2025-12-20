
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
    // Detect hosting URL
    const currentOrigin = window.location.origin;
    // We provide this URL for the Evolution API Webhook field
    setWebhookUrl(`${currentOrigin}/api/sync`);

    let interval: any;
    if (isLive) {
      checkInstance();
      // Polling every 4 seconds to act as a real-time webhook receiver
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

        // Immediately mark as seen internally to prevent double processing
        repliedMessageIds.current.add(msgId);
        
        // Save contact to inbuilt memory for broadcasting later
        evolutionService.saveOrUpdateContact(sender, pushName);
        
        setRecentTraffic(prev => [{ from: pushName, text, time: new Date() }, ...prev].slice(0, 8));

        if (!conversationContexts.current.has(sender)) {
          conversationContexts.current.set(sender, []);
        }
        const history = conversationContexts.current.get(sender)!;
        history.push({ role: MessageRole.USER, content: text });
        if (history.length > 20) history.splice(0, 2);

        // Call Gemini for an empathetic response
        const { text: aiResponse, isSerious } = await geminiService.generateResponse(history, MOCK_MAINTENANCE);
        history.push({ role: 'agent', content: aiResponse });

        // Send back to WhatsApp
        await evolutionService.sendMessage(sender, aiResponse);
        setProcessedCount(prev => prev + 1);
      }
    } catch (e) {
      console.error("Evolution Sync Error:", e);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    alert('URL copied! Paste this in your Evolution API instance Webhook field.');
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl border border-emerald-800">
          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-8">
              <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight mb-1">EcoSpot AI Engine</h1>
                <p className="text-emerald-400 font-bold text-xs uppercase tracking-[0.2em]">Ready for Render • Webhook Sync Mode</p>
              </div>
            </div>
            
            <p className="text-emerald-100/70 max-w-xl mb-12 leading-relaxed text-lg font-medium">
              Copy the URL below and paste it into your <b>Evolution API Webhook Settings</b>. This allows the dashboard to sync events even without a dedicated backend server.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <button 
                onClick={() => setIsLive(!isLive)}
                className={`w-full sm:w-auto px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-4 group ${
                  isLive ? 'bg-emerald-400 text-emerald-950 scale-105 shadow-2xl shadow-emerald-400/40' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-950 animate-pulse' : 'bg-slate-500'}`}></span>
                {isLive ? 'Syncing Active' : 'Start Agent'}
              </button>

              <div className="flex w-full sm:w-auto bg-black/30 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-inner">
                <div className="px-6 py-5 text-xs font-mono font-bold text-emerald-300 max-w-[240px] truncate select-all">{webhookUrl}</div>
                <button 
                  onClick={copyToClipboard}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-6 py-5 font-black text-[10px] uppercase tracking-widest transition-all border-l border-white/10 flex items-center gap-2"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
          
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-[30rem] h-[30rem] bg-emerald-500 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-[11px]">Instance Status</h3>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm ${status === 'online' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {status}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contacts in Memory</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">{evolutionService.getContacts().length}</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Replies Sent</p>
                  <p className="text-3xl font-black text-emerald-600 tracking-tight">{processedCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
            <div>
              <h3 className="font-black text-slate-800 text-xl tracking-tight">Live Traffic Feed</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time sync active</p>
            </div>
          </div>
          <div className="flex-1 p-8 overflow-y-auto">
            {recentTraffic.length > 0 ? (
              <div className="space-y-4">
                {recentTraffic.map((t, idx) => (
                  <div key={idx} className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 animate-in slide-in-from-bottom-5">
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
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Waiting for messages...</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl">
             <h3 className="font-black text-xl mb-6">Webhook Configuration</h3>
             <div className="space-y-6">
                <div className="flex gap-4">
                   <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0">1</div>
                   <p className="text-xs text-slate-400 leading-relaxed">
                     Go to your <b>Evolution Manager</b> → Instances → (Your Instance) → <b>Webhook</b>.
                   </p>
                </div>
                <div className="flex gap-4">
                   <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0">2</div>
                   <p className="text-xs text-slate-400 leading-relaxed">
                     Enable Webhooks and paste the <b>Sync URL</b> from this dashboard into the target field.
                   </p>
                </div>
                <div className="flex gap-4">
                   <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0">3</div>
                   <p className="text-xs text-slate-400 leading-relaxed">
                     Select events like <code className="text-emerald-400">MESSAGES_UPSERT</code> to ensure Evolution API stays in sync with this dashboard.
                   </p>
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-10">
             <h3 className="font-black text-slate-800 uppercase tracking-widest text-[11px] mb-8">Memory Health</h3>
             <p className="text-xs text-slate-500 mb-6 leading-relaxed">
               All customer contacts are stored in your browser's persistent storage. You can access them in the <b>Broadcast</b> tab to send mass updates.
             </p>
             <Link to="/broadcast" className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest text-center block shadow-lg shadow-emerald-600/20">
               Access Broadcast Center
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
