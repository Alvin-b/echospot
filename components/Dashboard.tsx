
import React, { useState, useEffect } from 'react';
import { ReportedIssue, MaintenanceRecord } from '../types';
import { Link } from 'react-router-dom';
import { dataService } from '../services/dataService';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ issuesCount: 0, maintenanceCount: 0 });
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/sync`);
    const loadData = async () => {
      const data = await dataService.getDashboardData();
      if (data) {
        setStats({
          issuesCount: data.issues?.length || 0,
          maintenanceCount: data.maintenance?.length || 0
        });
      }
    };
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl border border-white/5">
          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-8">
              <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
                <svg className="w-8 h-8 text-emerald-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight mb-1">EcoSpot Server Hub</h1>
                <p className="text-emerald-400 font-bold text-xs uppercase tracking-[0.2em]">Backend Powered • Webhook Active</p>
              </div>
            </div>
            
            <p className="text-slate-400 max-w-xl mb-12 leading-relaxed text-lg font-medium">
              Copy the Webhook URL below and paste it into Evolution API. The server will now handle all messages 24/7 without needing this tab open.
            </p>

            <div className="flex bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-inner group max-w-md">
              <div className="px-6 py-5 text-xs font-mono font-bold text-slate-400 group-hover:text-emerald-400 transition-colors truncate select-all">{webhookUrl}</div>
              <button 
                onClick={() => { navigator.clipboard.writeText(webhookUrl); alert('Copied!'); }}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-6 py-5 font-black text-[10px] uppercase tracking-widest transition-all"
              >
                Copy URL
              </button>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-[30rem] h-[30rem] bg-emerald-500 rounded-full blur-[160px] opacity-10 pointer-events-none"></div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl flex flex-col justify-center space-y-6">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Critical Issues</p>
            <p className="text-3xl font-black text-rose-600 tracking-tight">{stats.issuesCount}</p>
          </div>
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Outages</p>
            <p className="text-3xl font-black text-emerald-600 tracking-tight">{stats.maintenanceCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl">
        <h3 className="font-black text-slate-800 text-xl mb-6">Backend Webhook Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Your server is now a <b>Web Service</b>. This means Render provides a real URL that is always listening for events from WhatsApp.
            </p>
            <ul className="text-xs space-y-2 text-slate-500">
              <li>• Paste the URL in Evolution Instance Webhook settings</li>
              <li>• Select <code className="bg-slate-100 px-1 font-mono">MESSAGES_UPSERT</code> event</li>
              <li>• AI will respond instantly even if your laptop is off</li>
            </ul>
          </div>
          <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
            <h4 className="font-bold text-emerald-900 mb-2">Automation Status</h4>
            <p className="text-xs text-emerald-800/70">
              Backend logic is processing your knowledge base. Go to <b>Settings</b> to ensure your Evolution Global API Key and Instance Name are saved on the server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
