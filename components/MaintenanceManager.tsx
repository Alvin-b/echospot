
import React from 'react';
import { MOCK_MAINTENANCE } from '../constants';

const MaintenanceManager: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Maintenance & Outages</h2>
          <p className="text-slate-500">Manage network health and customer notifications.</p>
        </div>
        <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          Report Outage
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_MAINTENANCE.map((record) => (
          <div key={record.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 right-0 px-4 py-1 text-[10px] font-bold uppercase tracking-widest ${
              record.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {record.status}
            </div>
            
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${record.status === 'In Progress' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{record.area}</h3>
                <p className="text-sm text-slate-500 mb-4">{record.description}</p>
                
                <div className="flex flex-wrap gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    {record.date}
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Est: {record.estimatedResolution}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex gap-2">
              <button className="flex-1 py-2 bg-slate-50 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100">Edit Details</button>
              <button className="flex-1 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100">Broadcast Update</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-emerald-900 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center text-4xl">📢</div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold mb-2">Automated Outage Detection</h3>
            <p className="text-emerald-200 text-sm max-w-xl">
              Our AI agent automatically notifies users in affected regions when a ticket is created. 
              Currently, customers in <b>Syokimau</b> are being updated in real-time about the cable repair.
            </p>
          </div>
          <button className="bg-white text-emerald-900 px-6 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors">
            Configure Alerts
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceManager;
