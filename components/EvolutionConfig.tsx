
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
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      const data = await dataService.getDashboardData();
      if (data?.config) setConfig(data.config);
    };
    load();
  }, []);

  const handleSave = async () => {
    await dataService.saveConfig(config);
    evolutionService.setConfig(config); // Keep local copy too
    setSaveMsg('Server Configuration Updated!');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl">
        <h2 className="text-3xl font-black text-slate-800 mb-2">Bridge Config</h2>
        <p className="text-slate-500 text-sm mb-10">Configure the server connection to Evolution API.</p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Evolution Endpoint URL</label>
            <input 
              type="text" 
              value={config.baseUrl}
              onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
              placeholder="https://your-evolution-server.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Evolution API Key</label>
            <input 
              type="password" 
              value={config.apiKey}
              onChange={(e) => setConfig({...config, apiKey: e.target.value})}
              placeholder="Evolution Global Key"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Instance Name</label>
            <input 
              type="text" 
              value={config.instanceName}
              onChange={(e) => setConfig({...config, instanceName: e.target.value})}
              placeholder="Instance Name"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none"
            />
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-600/20"
          >
            Update Server Settings
          </button>
          {saveMsg && <p className="text-center mt-4 text-xs font-bold text-emerald-600">{saveMsg}</p>}
        </div>
      </div>
    </div>
  );
};

export default EvolutionConfigComp;
