
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

  // Debugging helpers for the user
  const detectedKey = process.env.API_KEY || '';
  const maskedKey = detectedKey 
    ? `${detectedKey.substring(0, 4)}••••${detectedKey.substring(detectedKey.length - 4)}` 
    : 'NOT FOUND';

  useEffect(() => {
    const saved = evolutionService.getConfig();
    if (saved) {
      setConfig(saved);
      checkStatus();
    } else {
      setStatus('disconnected');
    }

    const isKeySet = detectedKey && detectedKey !== "" && detectedKey !== "undefined";
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
      const isFailed = response.text.includes("System Configuration Error") || response.text.includes("offline");
      
      setTestResult({ 
        success: !isFailed, 
        message: response.text 
      });
      setGeminiStatus(!isFailed ? 'active' : 'missing');
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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500 pb-20">
      
      {/* 1. BUILD SYSTEM INSPECTOR - Helping verify Render Env Vars */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-emerald-400 font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Build Manifest
            </h3>
            <span className="text-[9px] text-slate-500 font-mono">APP_VERSION: 1.0.4-stable</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Detected AI Engine Key</p>
              <div className="flex items-center justify-between">
                <code className={`font-mono text-sm ${geminiStatus === 'active' ? 'text-emerald-300' : 'text-rose-400'}`}>
                  {maskedKey}
                </code>
                <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                  geminiStatus === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {geminiStatus === 'active' ? 'Injected' : 'Empty'}
                </div>
              </div>
              {!detectedKey && (
                <p className="text-[9px] text-rose-300 mt-3 leading-relaxed">
                  ⚠️ <b>Variable Missing:</b> If you set this in Render recently, you must trigger a <b>Manual Deploy &rarr; Clear Cache</b> to inject it into the static build.
                </p>
              )}
            </div>

            <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Build Environment</p>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Target Origin:</span>
                  <span className="text-slate-300 font-mono">{window.location.origin}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Protocol:</span>
                  <span className={`font-mono ${window.location.protocol === 'https:' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {window.location.protocol.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none"></div>
      </div>

      {/* 2. GEMINI HEALTH CHECK */}
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
                Gemini AI Engine: {geminiStatus === 'active' ? 'ONLINE' : 'OFFLINE'}
              </h3>
              <p className={`text-sm font-medium ${geminiStatus === 'active' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {geminiStatus === 'active' 
                  ? 'Key detected and builds verified.' 
                  : 'The AI brain is missing. Check the Live Build Manifest above.'}
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
            {geminiStatus === 'testing' ? 'Testing...' : 'Run Live Test'}
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

      {/* 3. EVOLUTION CONFIGURATION */}
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Evolution Bridge</h2>
            <p className="text-slate-500 text-sm mt-1">Direct link to your WhatsApp Instance.</p>
          </div>
          <div className={`px-5 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border flex items-center gap-2 ${
            status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
            status === 'loading' ? 'bg-slate-50 text-slate-400 border-slate-200 animate-pulse' : 
            status === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
            'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-slate-300'}`}></span>
            {status === 'connected' ? 'Connected' : status === 'loading' ? 'Checking...' : status === 'error' ? 'CORS Blocked' : 'Disconnected'}
          </div>
        </div>

        {status === 'error' && (
          <div className="mb-8 p-8 bg-rose-50 border border-rose-100 rounded-[2.5rem] shadow-sm animate-in zoom-in-95 duration-300">
            <div className="flex items-start gap-5">
              <div className="bg-rose-500 p-3 rounded-2xl text-white shadow-lg shadow-rose-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-rose-900 uppercase tracking-widest mb-3">Evolution Server Action Required</h4>
                <p className="text-xs text-rose-800 font-medium mb-6 leading-relaxed">
                  Your browser is blocking the request to <span className="font-mono bg-rose-100 px-1 rounded">{config.baseUrl}</span>. 
                  This is nearly always because the Evolution API server has a restrictive security policy.
                </p>
                
                <div className="bg-white/60 p-6 rounded-3xl border border-rose-200 space-y-4">
                  <p className="text-[10px] font-black text-rose-900 uppercase tracking-widest">Update Evolution Environment (.env or Docker):</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-rose-100">
                      <code className="text-[10.5px] font-mono text-rose-700">CORS_ORIGIN</code>
                      <code className="text-[10.5px] font-mono font-black text-emerald-600">*</code>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-rose-100">
                      <code className="text-[10.5px] font-mono text-rose-700">CORS_METHODS</code>
                      <code className="text-[10.5px] font-mono font-black text-emerald-600">GET,POST,PUT,DELETE,PATCH,OPTIONS</code>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-rose-100">
                      <code className="text-[10.5px] font-mono text-rose-700">CORS_HEADERS</code>
                      <code className="text-[10.5px] font-mono font-black text-emerald-600">Content-Type,Authorization,apikey</code>
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-[10px] text-amber-900 font-bold mb-1 uppercase tracking-tight">Mixed Content Warning:</p>
                    <p className="text-[10px] text-amber-800 leading-tight">
                      Since your dashboard is on <b>HTTPS</b>, you <b>must</b> use an <code className="font-bold">https://</code> Evolution URL. 
                      Browsers block calls from Secure to Insecure (HTTP) sites automatically.
                    </p>
                  </div>
                </div>
              </div>
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
                      <p className="text-xs text-slate-900 font-bold mb-1">CORS & Preflight</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">Browsers send an OPTIONS request before the real one. If your server isn't configured for it, it fails.</p>
                   </div>
                </li>
                <li className="flex gap-4">
                   <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 text-xs font-black shrink-0">2</div>
                   <div>
                      <p className="text-xs text-slate-900 font-bold mb-1">Global Key vs Instance Key</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">Ensure you use the <b>Global API Key</b> found in your Evolution dashboard for status checks.</p>
                   </div>
                </li>
             </ul>
             
             <div className="mt-8 p-6 bg-emerald-900 rounded-3xl text-white">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  Success Tip
                </p>
                <p className="text-[10px] text-emerald-100/70 leading-relaxed font-medium">
                  If CORS settings are correct but still failing, try opening your Evolution URL in a new browser tab. 
                  If it asks for a certificate or security bypass, you must accept it before the dashboard can connect.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvolutionConfigComp;
