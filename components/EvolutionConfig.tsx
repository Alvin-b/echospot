
import React, { useState, useEffect } from 'react';
import { evolutionService } from '../services/evolutionService';
import { EvolutionConfig } from '../types';

const EvolutionConfigComp: React.FC = () => {
  const [config, setConfig] = useState<EvolutionConfig>({
    baseUrl: '',
    apiKey: '',
    instanceName: ''
  });
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    const saved = evolutionService.getConfig();
    if (saved) {
      setConfig(saved);
      checkStatus();
    } else {
      setStatus('disconnected');
    }
  }, []);

  const checkStatus = async () => {
    setStatus('loading');
    try {
      const res = await evolutionService.getInstanceStatus();
      if (res.instance.state === 'open') {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch (e) {
      setStatus('disconnected');
    }
  };

  const handleSave = () => {
    evolutionService.setConfig(config);
    setSaveMsg('Configuration saved successfully!');
    checkStatus();
    setTimeout(() => setSaveMsg(''), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">API Infrastructure</h2>
            <p className="text-slate-500 text-sm mt-1">Connect your Evolution instance to the EcoSpot AI Engine.</p>
          </div>
          <div className={`px-5 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border ${
            status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
            status === 'loading' ? 'bg-slate-50 text-slate-400 border-slate-200 animate-pulse' : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {status === 'connected' ? '● Linked' : status === 'loading' ? 'Syncing...' : '● Disconnected'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">API Endpoint URL</label>
              <input 
                type="text" 
                value={config.baseUrl}
                onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                placeholder="https://your-evolution-server.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Global API Key</label>
              <input 
                type="password" 
                value={config.apiKey}
                onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                placeholder="Enter Evolution API Secret Key"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Instance Name</label>
              <input 
                type="text" 
                value={config.instanceName}
                onChange={(e) => setConfig({...config, instanceName: e.target.value})}
                placeholder="e.g. EcoSpot_Instance"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
              />
            </div>

            <div className="pt-4">
              <button 
                onClick={handleSave}
                className="w-full bg-emerald-600 text-white px-8 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 active:scale-95"
              >
                Save & Initialize
              </button>
              {saveMsg && <p className="text-center mt-4 text-xs font-bold text-emerald-600 animate-bounce">{saveMsg}</p>}
            </div>
          </div>

          <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200/50 flex flex-col">
             <h4 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-6">Connection Tips</h4>
             <ul className="space-y-6">
                <li className="flex gap-4">
                   <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 text-xs font-black shrink-0">1</div>
                   <p className="text-xs text-slate-500 leading-relaxed font-medium">Ensure your Evolution instance has <b>Global API</b> enabled in environment variables.</p>
                </li>
                <li className="flex gap-4">
                   <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 text-xs font-black shrink-0">2</div>
                   <p className="text-xs text-slate-500 leading-relaxed font-medium">Instance state must be <span className="text-emerald-600 font-black">"open"</span> for the bot to read/send messages.</p>
                </li>
                <li className="flex gap-4">
                   <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 text-xs font-black shrink-0">3</div>
                   <p className="text-xs text-slate-500 leading-relaxed font-medium">If connection fails, check CORS settings on your Evolution API server.</p>
                </li>
             </ul>
             
             <div className="mt-auto pt-8 border-t border-slate-200/50">
                <div className="bg-slate-900 rounded-[1.5rem] p-5 text-white flex items-center gap-4">
                   <div className="text-2xl">☁️</div>
                   <div>
                      <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Render Support</p>
                      <p className="text-[9px] text-slate-400 font-medium">Use static site hosting for zero-cost deployment.</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Render Hosting Guide */}
      <div className="bg-emerald-950 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-emerald-950/40 border border-emerald-800">
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
             <h3 className="text-3xl font-black mb-4 tracking-tight">Deploying to Render.com</h3>
             <p className="text-emerald-100/60 text-sm leading-relaxed mb-8 font-medium">
               This app is optimized for Render's <b>Static Site</b> hosting. Follow these steps to go live in minutes.
             </p>
             <div className="space-y-4">
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 transition-hover hover:bg-white/10">
                   <div className="text-emerald-400 font-black text-sm">A</div>
                   <p className="text-xs font-medium text-slate-200">Connect your GitHub repository to Render.</p>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 transition-hover hover:bg-white/10">
                   <div className="text-emerald-400 font-black text-sm">B</div>
                   <p className="text-xs font-medium text-slate-200">Set Build Command to <code className="bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 italic font-mono">clear</code> (no build needed).</p>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 transition-hover hover:bg-white/10">
                   <div className="text-emerald-400 font-black text-sm">C</div>
                   <p className="text-xs font-medium text-slate-200">Set Publish Directory to <code className="bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 italic font-mono">.</code> (root).</p>
                </div>
             </div>
          </div>
          <div className="bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-8 border border-white/10">
             <h4 className="font-black text-xs uppercase tracking-widest text-emerald-400 mb-6">Environment Variable Required</h4>
             <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
                   <span className="text-[10px] font-mono font-bold text-slate-400">KEY</span>
                   <span className="text-[10px] font-mono font-bold text-emerald-300">API_KEY</span>
                </div>
                <div className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
                   <span className="text-[10px] font-mono font-bold text-slate-400">VALUE</span>
                   <span className="text-[10px] font-mono font-bold text-emerald-300 italic">Your Gemini Pro Key</span>
                </div>
             </div>
             <p className="text-[10px] text-slate-400 leading-relaxed font-medium italic">
               Note: The app will not process AI responses until the <code className="text-emerald-400">API_KEY</code> is correctly configured in your hosting dashboard.
             </p>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500 rounded-full blur-[100px] opacity-10 -mr-32 -mt-32"></div>
      </div>
    </div>
  );
};

export default EvolutionConfigComp;
