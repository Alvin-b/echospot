
import React, { useState, useEffect } from 'react';
import { evolutionService } from '../services/evolutionService';
import { geminiService } from '../services/geminiService';
import { EvolutionConfig } from '../types';

const EvolutionConfigComp: React.FC = () => {
  const [config, setConfig] = useState<EvolutionConfig>({
    baseUrl: '',
    apiKey: '',
    instanceName: ''
  });
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'loading' | 'error'>('loading');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<'active' | 'missing' | 'testing'>('missing');
  const [saveMsg, setSaveMsg] = useState('');
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);

  useEffect(() => {
    const saved = evolutionService.getConfig();
    if (saved) {
      setConfig(saved);
      checkStatus();
    } else {
      setStatus('disconnected');
    }

    const isKeySet = process.env.API_KEY && process.env.API_KEY !== "undefined";
    setGeminiStatus(isKeySet ? 'active' : 'missing');
  }, []);

  const checkStatus = async () => {
    setStatus('loading');
    setErrorDetails(null);
    try {
      const res = await evolutionService.getInstanceStatus();
      if (res.instance.state === 'open') {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch (e: any) {
      console.error("Evolution Config Status Error:", e);
      setStatus('error');
      setErrorDetails(e.message);
    }
  };

  const testGemini = async () => {
    setGeminiStatus('testing');
    try {
      const response = await geminiService.generateResponse(
        [{ role: 'user', content: 'Say "Connection Successful"' }],
        []
      );
      setTestResult({ 
        success: !response.text.includes("offline") && !response.text.includes("Error"), 
        message: response.text 
      });
      setGeminiStatus('active');
    } catch (e) {
      setTestResult({ success: false, message: "Connection failed. Check your API Key." });
      setGeminiStatus('missing');
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
      {/* System Health Diagnostic */}
      <div className={`rounded-[2.5rem] p-8 border ${
        geminiStatus === 'active' 
          ? 'bg-emerald-50 border-emerald-100' 
          : 'bg-rose-50 border-rose-100'
      }`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
              geminiStatus === 'active' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white animate-pulse'
            }`}>
              {geminiStatus === 'active' ? '✓' : '!'}
            </div>
            <div>
              <h3 className={`text-lg font-black tracking-tight ${geminiStatus === 'active' ? 'text-emerald-900' : 'text-rose-900'}`}>
                Gemini AI Engine Status: {geminiStatus === 'active' ? 'READY' : 'ACTION REQUIRED'}
              </h3>
              <p className={`text-sm font-medium ${geminiStatus === 'active' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {geminiStatus === 'active' 
                  ? 'Your system is fully connected to Google Generative AI.' 
                  : 'The API_KEY environment variable is missing from the system.'}
              </p>
            </div>
          </div>
          <button 
            onClick={testGemini}
            disabled={geminiStatus === 'testing'}
            className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              geminiStatus === 'active' 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                : 'bg-rose-600 text-white hover:bg-rose-700'
            }`}
          >
            {geminiStatus === 'testing' ? 'Testing...' : 'Run Connection Test'}
          </button>
        </div>
        {testResult && (
          <div className={`mt-6 p-4 rounded-xl text-xs font-mono border ${
            testResult.success ? 'bg-white/50 border-emerald-200 text-emerald-800' : 'bg-white/50 border-rose-200 text-rose-800'
          }`}>
            <span className="font-black mr-2">[LOG]:</span> {testResult.message}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">API Infrastructure</h2>
            <p className="text-slate-500 text-sm mt-1">Connect your Evolution instance to the EcoSpot AI Engine.</p>
          </div>
          <div className={`px-5 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border flex items-center gap-2 ${
            status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
            status === 'loading' ? 'bg-slate-50 text-slate-400 border-slate-200 animate-pulse' : 
            status === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
            'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : status === 'error' ? 'bg-red-500' : 'bg-slate-300'}`}></span>
            {status === 'connected' ? 'Evolution Linked' : status === 'loading' ? 'Syncing...' : status === 'error' ? 'Sync Failed' : 'Disconnected'}
          </div>
        </div>

        {status === 'error' && (
          <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-3xl">
            <h4 className="text-xs font-black text-red-800 uppercase tracking-widest mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              Connection Diagnostics
            </h4>
            <p className="text-xs text-red-700 font-medium mb-4">{errorDetails}</p>
            <div className="bg-white/50 p-4 rounded-xl border border-red-100 text-[10px] text-red-900 font-mono">
              PRO TIP: Most "Failed to fetch" errors are caused by CORS. Ensure your Evolution API has <b>CORS_ORIGIN=*</b> or <b>CORS_ORIGIN={window.location.origin}</b> set in its environment variables.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Evolution Endpoint URL</label>
              <input 
                type="text" 
                value={config.baseUrl}
                onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                placeholder="https://your-evolution-server.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Evolution API Key</label>
              <input 
                type="password" 
                value={config.apiKey}
                onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                placeholder="Enter Evolution Global Key"
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
                Save & Link Evolution
              </button>
              {saveMsg && <p className="text-center mt-4 text-xs font-bold text-emerald-600 animate-bounce">{saveMsg}</p>}
            </div>
          </div>

          <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200/50 flex flex-col">
             <h4 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-6">Setup Guidance</h4>
             <ul className="space-y-6">
                <li className="flex gap-4">
                   <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 text-xs font-black shrink-0">1</div>
                   <div>
                      <p className="text-xs text-slate-900 font-bold mb-1">Evolution API</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">This handles WhatsApp connections. Paste your server URL and API key above.</p>
                   </div>
                </li>
                <li className="flex gap-4">
                   <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 text-xs font-black shrink-0">2</div>
                   <div>
                      <p className="text-xs text-slate-900 font-bold mb-1">Gemini AI Engine</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">This handles the actual brain of the bot. It requires a system environment variable named <b>API_KEY</b>.</p>
                   </div>
                </li>
             </ul>
             
             <div className="mt-8 p-5 bg-amber-50 border border-amber-100 rounded-2xl">
                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Critical: Troubleshooting Error Status</p>
                <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                  If status shows "Sync Failed", ensure your Evolution API server has:
                  <br/><code className="bg-white/50 px-1 rounded">CORS_ORIGIN=*</code>
                  <br/><code className="bg-white/50 px-1 rounded">CORS_METHODS=GET,POST,OPTIONS</code>
                  <br/>set in the <code className="italic">.env</code> or Docker config.
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* Deep Dive Setup Guide */}
      <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl">
        <h3 className="text-3xl font-black mb-8 tracking-tight">How to Set Your Gemini API Key</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
          <div className="space-y-8">
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
              <h4 className="text-emerald-400 font-black text-xs uppercase tracking-widest mb-4">Option 1: For Render.com</h4>
              <ol className="text-xs space-y-3 text-slate-300">
                <li>1. Open your <b>Static Site</b> dashboard on Render.</li>
                <li>2. Go to the <b>Environment</b> tab in the sidebar.</li>
                <li>3. Click <b>Add Environment Variable</b>.</li>
                <li>4. Key: <code className="bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 font-mono">API_KEY</code></li>
                <li>5. Value: <span className="text-slate-500 italic">Your Gemini API Secret</span></li>
                <li>6. <b>Save</b> and trigger a <b>Manual Deploy</b>.</li>
              </ol>
            </div>
            
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
              <h4 className="text-emerald-400 font-black text-xs uppercase tracking-widest mb-4">Option 2: Local Development</h4>
              <p className="text-xs text-slate-300 mb-4">Create a file named <code className="text-emerald-300">.env</code> in your project root:</p>
              <div className="bg-black/40 p-3 rounded font-mono text-[10px] text-emerald-500 border border-white/5">
                API_KEY=your_secret_key_here
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center">
             <div className="bg-emerald-600 rounded-3xl p-8 shadow-2xl shadow-emerald-600/20">
                <h4 className="font-black mb-4">Why is this required?</h4>
                <p className="text-sm text-emerald-50 font-medium leading-relaxed mb-6">
                  To keep your ISP data secure, the EcoSpot Engine does not store keys in the browser's database. 
                  Instead, it pulls them from the secure server environment where the app is hosted.
                </p>
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block bg-white text-emerald-900 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all"
                >
                  Get New Gemini Key →
                </a>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvolutionConfigComp;
