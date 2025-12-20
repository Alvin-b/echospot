
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { MaintenanceRecord } from '../types';

const MaintenanceManager: React.FC = () => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newRecord, setNewRecord] = useState<Partial<MaintenanceRecord>>({
    area: '',
    description: '',
    status: 'Scheduled',
    estimatedResolution: ''
  });

  useEffect(() => {
    setRecords(dataService.getMaintenanceRecords());
  }, []);

  const handleAdd = () => {
    const record: MaintenanceRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      area: newRecord.area || 'Unknown',
      description: newRecord.description || '',
      status: (newRecord.status as any) || 'Scheduled',
      estimatedResolution: newRecord.estimatedResolution || 'TBD'
    };
    dataService.saveMaintenanceRecord(record);
    setRecords(dataService.getMaintenanceRecords());
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    dataService.deleteMaintenanceRecord(id);
    setRecords(dataService.getMaintenanceRecords());
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Maintenance & Outages</h2>
          <p className="text-slate-500">Manage network health and customer notifications.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          Report Outage
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-6">Log Network Outage</h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Affected Area (e.g. Rongai)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                value={newRecord.area}
                onChange={e => setNewRecord({...newRecord, area: e.target.value})}
              />
              <textarea 
                placeholder="Description of the issue"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm h-24"
                value={newRecord.description}
                onChange={e => setNewRecord({...newRecord, description: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="Est. Resolution Time (e.g. 2 Hours)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                value={newRecord.estimatedResolution}
                onChange={e => setNewRecord({...newRecord, estimatedResolution: e.target.value})}
              />
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                value={newRecord.status}
                onChange={e => setNewRecord({...newRecord, status: e.target.value as any})}
              >
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Outage">Critical Outage</option>
              </select>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl">Cancel</button>
              <button onClick={handleAdd} className="flex-1 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/20">Save & Broadcast</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {records.map((record) => (
          <div key={record.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 right-0 px-4 py-1 text-[10px] font-bold uppercase tracking-widest ${
              record.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 
              record.status === 'Outage' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {record.status}
            </div>
            
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${record.status === 'In Progress' ? 'bg-amber-50 text-amber-600' : record.status === 'Outage' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
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
              <button onClick={() => handleDelete(record.id)} className="flex-1 py-2 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-100">Delete</button>
              <button className="flex-1 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100">Sync with AI</button>
            </div>
          </div>
        ))}
        {records.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <p className="text-slate-400 text-sm font-medium">No active maintenance records. All systems operational.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintenanceManager;
