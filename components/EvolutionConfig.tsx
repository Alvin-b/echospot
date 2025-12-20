
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
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptedUrl, setAttemptedUrl] = useState('');
  const [rawResponse, setRawResponse] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const checkConnection = async () => {
    setStatus('CHECKING');
    setErrorMessage('');
    setAttemptedUrl('');
    setRawResponse('');
    
    const result = await evolutionService.getInstanceStatus();
    
    if (result.status === 'CONNECTED') {
      setStatus('CONNECTED');
    } else if (result.status === 'NOT_CONFIGURED') {
      setStatus('NOT_CONFIGURED');
    } else if (result.status === 'DISCONNECTED') {
      setStatus('DISCONNECTED');
      setErrorMessage(result.message || 'Connected to API, but instance is not "open".');
    } else {
      setStatus('ERROR');
      setErrorMessage(result.message || 'An unexpected error occurred.');
      if (result.url) setAttemptedUrl(result.url);
      if (result.raw) setRawResponse(typeof result.raw === 'string' ? result.raw : JSON.stringify(result.raw, null, 2));
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
            status === 'NOT_CONFIGURED' ? 'bg-slate-50 text-slate-300 border-slate-100' :
            'bg-rose-50 text-rose-600 border-rose-100'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' :
              status === 'CHECKING' ? 'bg-slate-400 animate-spin border-t-transparent border-2' :
              status === 'NOT_CONFIGURED' ? 'bg-slate-200' :
              'bg-rose-500'
            }`}></span>
            {status.replace('_', ' ')}
          </div>
        </div>

        <h2 className="text-3xl font-black text-slate-800 mb-2">Bridge Config</h2>
        <p className="text-slate-500 text-sm mb-10">Connect your server to the Evolution API instance.</p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Evolution Base URL</label>
            <input 
              type="text" 
              value={config.baseUrl}
              onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
              placeholder="e.g. https://evolution.cloudfy.live"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
            />
            <p className="text-[9px] text-slate-400 pl-2">Do not add /instance/status to this field. Just the base domain.</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Global API Key</label>
            <input 
              type="password" 
              value={config.apiKey}
              onChange={(e) => setConfig({...config, apiKey: e.target.value})}
              placeholder="Your Global API Key (apikey)"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Instance Name</label>
            <input 
              type="text" 
              value={config.instanceName}
              onChange={(e) => setConfig({...config, instanceName: e.target.value})}
              placeholder="e.g. echospot"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="pt-4 space-y-4">
            <button 
              onClick={handleSave}
              disabled={status === 'CHECKING'}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {status === 'CHECKING' ? 'Verifying...' : 'Save & Connect'}
            </button>
            
            {errorMessage && (
              <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-rose-700 mb-3">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <p className="text-xs font-black uppercase tracking-wider">Connection Failure</p>
                </div>
                <p className="text-[11px] text-rose-600/90 leading-relaxed font-medium mb-3">{errorMessage}</p>
                
                {attemptedUrl && (
                  <div className="mb-3">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Attempted URL:</p>
                    <p className="text-[9px] font-mono text-rose-700 break-all bg-white/50 p-2 rounded border border-rose-100">{attemptedUrl}</p>
                  </div>
                )}

                {rawResponse && (
                  <div className="max-h-40 overflow-y-auto">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Raw Server Response:</p>
                    <pre className="text-[9px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-200 whitespace-pre-wrap">{rawResponse}</pre>
                  </div>
                )}
              </div>
            )}
            
            {saveMsg && <p className="text-center text-xs font-bold text-emerald-600 animate-pulse">{saveMsg}</p>}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
        <h3 className="font-bold text-lg mb-4">Connection Tips</h3>
        <ul className="space-y-4 text-xs text-slate-400">
          <li className="flex gap-3">
             <span className="text-emerald-500">1.</span>
             <span>Your instance <b>"{config.instanceName || 'echospot'}"</b> must be created first (as you did in your curl).</span>
          </li>
          <li className="flex gap-3">
             <span className="text-emerald-500">2.</span>
             <span>Visit the <b>Attempted URL</b> in your browser. If you see your Evolution dashboard instead of JSON data, your Base URL is incorrect.</span>
          </li>
          <li className="flex gap-3">
             <span className="text-emerald-500">3.</span>
             <span>The Global API Key is sensitive. Ensure no extra spaces are present.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default EvolutionConfigComp;
