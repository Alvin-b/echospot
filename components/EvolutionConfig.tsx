
import React, { useState, useEffect } from 'react';
import { evolutionService } from '../services/evolutionService';
import { dataService } from '../services/dataService';
import { EvolutionConfig } from '../types';

const EvolutionConfigComp: React.FC = () => {
  const [config, setConfig] = useState<EvolutionConfig>({
    baseUrl: '',
    apiKey: '',
    instanceName: ''
  });
  const [status, setStatus] = useState<'IDLE' | 'CHECKING' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED' | 'NOT_CONFIGURED'>('IDLE');
  const [stateInfo, setStateInfo] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptedUrl, setAttemptedUrl] = useState('');
  const [rawResponse, setRawResponse] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const checkConnection = async () => {
    setStatus('CHECKING');
    setErrorMessage('');
    setAttemptedUrl('');
    setRawResponse('');
    setStateInfo('');
    
    try {
      const result = await evolutionService.getInstanceStatus();
      
      if (result.status === 'CONNECTED') {
        setStatus('CONNECTED');
        setStateInfo(result.state?.toUpperCase() || 'OPEN');
      } else if (result.status === 'NOT_CONFIGURED') {
        setStatus('NOT_CONFIGURED');
      } else if (result.status === 'DISCONNECTED') {
        setStatus('DISCONNECTED');
        setStateInfo(result.state?.toUpperCase() || 'OFFLINE');
        setErrorMessage(`Instance found but status is "${result.state || 'closed'}". Open Evolution Dashboard and scan the QR code.`);
      } else {
        setStatus('ERROR');
        setErrorMessage(result.message || 'API Unreachable. Verify URL and Global Key.');
        if (result.url) setAttemptedUrl(result.url);
        if (result.raw) setRawResponse(result.raw);
      }
    } catch (e: any) {
      setStatus('ERROR');
      setErrorMessage(`Network Failure: ${e.message}`);
    }
  };

  useEffect(() => {
    const load = async () => {
      const data = await dataService.getDashboardData();
      if (data?.config) {
        setConfig(data.config);
        if (data.config.instanceName) {
           checkConnection();
        }
      } else {
        setStatus('NOT_CONFIGURED');
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!config.baseUrl || !config.apiKey || !config.instanceName) {
      setSaveMsg('Please fill all fields.');
      return;
    }
    try {
      await dataService.saveConfig(config);
      evolutionService.setConfig(config);
      setSaveMsg('Settings Saved. Verifying...');
      await checkConnection();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg('Failed to save to server.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl relative overflow-hidden">
        <div className="absolute top-10 right-10">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
            status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
            status === 'CHECKING' ? 'bg-slate-50 text-slate-500 border-slate-100' :
            'bg-rose-50 text-rose-600 border-rose-100'
          }`}>
            <span className={`w-2 h-2 rounded-full ${status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : status === 'CHECKING' ? 'bg-slate-400 animate-spin' : 'bg-rose-500'}`}></span>
            {status.replace('_', ' ')} {stateInfo && `(${stateInfo})`}
          </div>
        </div>

        <h2 className="text-3xl font-black text-slate-800 mb-2">Bridge Config</h2>
        <p className="text-slate-500 text-sm mb-10">Connect your server to Evolution API.</p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Evolution Base URL</label>
            <input 
              type="text" 
              value={config.baseUrl}
              onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
              placeholder="https://evolution.example.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Global API Key (rnMjgA...)</label>
            <input 
              type="password" 
              value={config.apiKey}
              onChange={(e) => setConfig({...config, apiKey: e.target.value})}
              placeholder="Authentication API Key from .env"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Target Instance Name</label>
            <input 
              type="text" 
              value={config.instanceName}
              onChange={(e) => setConfig({...config, instanceName: e.target.value})}
              placeholder="e.g. echospo"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            <p className="text-[10px] text-slate-400 italic pl-1">Must match the instance name in your Evolution Dashboard.</p>
          </div>

          <div className="pt-4 space-y-4">
            <button 
              onClick={handleSave}
              disabled={status === 'CHECKING'}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-[0.98]"
            >
              {status === 'CHECKING' ? 'Connecting...' : 'Test & Save Config'}
            </button>
            
            {errorMessage && (
              <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-rose-700 mb-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <p className="text-xs font-black uppercase tracking-wider">Connection Failure</p>
                </div>
                <p className="text-[11px] text-rose-600 leading-relaxed font-bold mb-3">{errorMessage}</p>
                
                {rawResponse && (
                  <div className="mb-3">
                    <p className="text-[9px] text-rose-400 uppercase font-black tracking-widest mb-1">Raw API Response:</p>
                    <pre className="text-[9px] font-mono text-rose-700 break-all bg-white/50 p-2 rounded max-h-32 overflow-y-auto border border-rose-100">
                      {typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse, null, 2)}
                    </pre>
                  </div>
                )}

                {attemptedUrl && (
                  <div className="mt-2 pt-2 border-t border-rose-100">
                    <p className="text-[9px] text-rose-400 uppercase font-black tracking-widest mb-1">Attempted Endpoint:</p>
                    <p className="text-[9px] font-mono text-rose-700 break-all bg-white/50 p-2 rounded">{attemptedUrl}</p>
                  </div>
                )}
              </div>
            )}
            
            {saveMsg && <p className="text-center text-xs font-bold text-emerald-600">{saveMsg}</p>}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
        <h3 className="font-bold text-lg mb-4">Instance Check</h3>
        <ul className="space-y-4 text-xs text-slate-400">
          <li className="flex gap-3">
             <span className="text-emerald-500 font-bold">401/403:</span>
             <span>Your <b>Global API Key</b> is likely incorrect. Re-check your Evolution <code>.env</code> file.</span>
          </li>
          <li className="flex gap-3">
             <span className="text-emerald-500 font-bold">404:</span>
             <span>The <b>Base URL</b> is wrong or your Evolution version uses different routes. Ensure you use <code>https://</code>.</span>
          </li>
          <li className="flex gap-3">
             <span className="text-emerald-500 font-bold">Cloudflare:</span>
             <span>If you see "Just a moment..." in the raw response, Cloudflare is blocking the server. Try disabling the proxy on your Evolution subdomain.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default EvolutionConfigComp;
