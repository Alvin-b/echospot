
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
  const [saveMsg, setSaveMsg] = useState('');

  const checkConnection = async () => {
    setStatus('CHECKING');
    setErrorMessage('');
    setAttemptedUrl('');
    
    const result = await evolutionService.getInstanceStatus();
    
    if (result.status === 'CONNECTED') {
      setStatus('CONNECTED');
    } else if (result.status === 'NOT_CONFIGURED') {
      setStatus('NOT_CONFIGURED');
    } else if (result.status === 'DISCONNECTED') {
      setStatus('DISCONNECTED');
      setErrorMessage(result.message || 'Instance found but not connected (ensure it is "open").');
    } else {
      setStatus('ERROR');
      setErrorMessage(result.message || 'An unexpected error occurred.');
      if (result.url) setAttemptedUrl(result.url);
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
            status === 'IDLE' ? 'bg-slate-50 text-slate-400 border-slate-100' :
            'bg-rose-50 text-rose-600 border-rose-100'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' :
              status === 'CHECKING' ? 'bg-slate-400 animate-spin border-t-transparent border-2' :
              status === 'NOT_CONFIGURED' ? 'bg-slate-200' :
              status === 'IDLE' ? 'bg-slate-300' :
              'bg-rose-500'
            }`}></span>
            {status.replace('_', ' ')}
          </div>
        </div>

        <h2 className="text-3xl font-black text-slate-800 mb-2">Bridge Config</h2>
        <p className="text-slate-500 text-sm mb-10">Connect your server to the Evolution API instance.</p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Evolution Endpoint URL</label>
            <input 
              type="text" 
              value={config.baseUrl}
              onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
              placeholder="e.g. evolution.myserver.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Evolution API Key</label>
            <input 
              type="password" 
              value={config.apiKey}
              onChange={(e) => setConfig({...config, apiKey: e.target.value})}
              placeholder="Global API Key"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Instance Name</label>
            <input 
              type="text" 
              value={config.instanceName}
              onChange={(e) => setConfig({...config, instanceName: e.target.value})}
              placeholder="e.g. EcoSpot_Instance"
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
                <div className="flex items-center gap-2 text-rose-700 mb-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <p className="text-xs font-black uppercase tracking-wider">Connection Failure</p>
                </div>
                <p className="text-[11px] text-rose-600/90 leading-relaxed font-medium">{errorMessage}</p>
                {attemptedUrl && (
                  <div className="mt-3 p-2 bg-white/50 rounded-lg">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Attempted Backend URL:</p>
                    <p className="text-[10px] font-mono text-rose-700 break-all bg-white p-1 rounded border border-rose-100">{attemptedUrl}</p>
                  </div>
                )}
                <p className="text-[9px] text-rose-400 mt-2 italic font-mono uppercase tracking-tighter">If the URL above looks wrong, check your Base URL input.</p>
              </div>
            )}
            
            {saveMsg && <p className="text-center text-xs font-bold text-emerald-600 animate-pulse">{saveMsg}</p>}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
        <h3 className="font-bold text-lg mb-4">Instance Health Checklist</h3>
        <ul className="space-y-3 text-xs text-slate-400">
          <li className="flex gap-3">
             <span className="text-emerald-500">✔</span>
             <span>Evolution API URL must be reachable from your backend server.</span>
          </li>
          <li className="flex gap-3">
             <span className="text-emerald-500">✔</span>
             <span>Your WhatsApp session must be <b>Connected (Open)</b>.</span>
          </li>
          <li className="flex gap-3">
             <span className="text-emerald-500">✔</span>
             <span>Double check your Global API Key is correct.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default EvolutionConfigComp;
