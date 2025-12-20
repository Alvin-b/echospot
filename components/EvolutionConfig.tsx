
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
  const [status, setStatus] = useState<'IDLE' | 'CHECKING' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const checkConnection = async () => {
    setStatus('CHECKING');
    try {
      const result = await evolutionService.getInstanceStatus();
      if (result.status === 'CONNECTED') {
        setStatus('CONNECTED');
        setErrorMessage('');
      } else {
        setStatus('DISCONNECTED');
        setErrorMessage(result.error || 'Instance is not in "open" state.');
      }
    } catch (e: any) {
      setStatus('ERROR');
      setErrorMessage(e.message || 'Failed to reach Evolution API server.');
    }
  };

  useEffect(() => {
    const load = async () => {
      const data = await dataService.getDashboardData();
      if (data?.config) {
        setConfig(data.config);
        // Automatically check if config exists
        if (data.config.instanceName) {
           checkConnection();
        }
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
      setSaveMsg('Server Configuration Saved!');
      await checkConnection();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg('Failed to save to server.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl relative overflow-hidden">
        {/* Status Badge */}
        <div className="absolute top-10 right-10">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
            status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
            status === 'CHECKING' ? 'bg-slate-50 text-slate-500 border-slate-100' :
            status === 'IDLE' ? 'bg-slate-50 text-slate-400 border-slate-100' :
            'bg-rose-50 text-rose-600 border-rose-100'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' :
              status === 'CHECKING' ? 'bg-slate-400 animate-spin border-t-transparent border-2' :
              status === 'IDLE' ? 'bg-slate-300' :
              'bg-rose-500'
            }`}></span>
            {status}
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
              placeholder="https://your-evolution-server.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Evolution API Key</label>
            <input 
              type="password" 
              value={config.apiKey}
              onChange={(e) => setConfig({...config, apiKey: e.target.value})}
              placeholder="Evolution Global Key"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Instance Name</label>
            <input 
              type="text" 
              value={config.instanceName}
              onChange={(e) => setConfig({...config, instanceName: e.target.value})}
              placeholder="Instance Name (e.g. EcoSpot_Main)"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="pt-4 space-y-4">
            <button 
              onClick={handleSave}
              disabled={status === 'CHECKING'}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {status === 'CHECKING' ? 'Verifying...' : 'Test & Update Settings'}
            </button>
            
            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                <p className="text-xs font-bold text-rose-700 mb-1">Connection Failed</p>
                <p className="text-[10px] text-rose-600/80 leading-relaxed font-mono">{errorMessage}</p>
              </div>
            )}
            
            {saveMsg && <p className="text-center text-xs font-bold text-emerald-600">{saveMsg}</p>}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
        <h3 className="font-bold text-lg mb-4">Instance Tips</h3>
        <ul className="space-y-3 text-xs text-slate-400">
          <li className="flex gap-3">
             <span className="text-emerald-500">✔</span>
             <span>Ensure your instance state is <b>"open"</b> in the Evolution dashboard.</span>
          </li>
          <li className="flex gap-3">
             <span className="text-emerald-500">✔</span>
             <span>The Base URL should not include "/instance" at the end.</span>
          </li>
          <li className="flex gap-3">
             <span className="text-emerald-500">✔</span>
             <span>Double check your Global API key if you get 401 Unauthorized errors.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default EvolutionConfigComp;
