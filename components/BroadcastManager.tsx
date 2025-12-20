
import React, { useState, useEffect } from 'react';
import { evolutionService } from '../services/evolutionService';
import { Contact } from '../types';

const BroadcastManager: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      const data = await evolutionService.getContacts();
      setContacts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleBroadcast = async () => {
    if (!message.trim() || contacts.length === 0) return;
    
    const confirm = window.confirm(`Send this message to ${contacts.length} customers?`);
    if (!confirm) return;

    setIsSending(true);
    try {
      await evolutionService.sendBroadcast(message);
      alert('Broadcast started on the server! It will process in the background.');
      setMessage('');
    } catch (e) {
      alert('Failed to start broadcast: ' + (e as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Broadcast Center</h2>
            <p className="text-slate-500 text-sm">Mass updates are processed securely on the server.</p>
          </div>
          <button 
            onClick={loadContacts}
            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
            title="Refresh Contact List"
          >
            <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-4">
                Server-Saved Contacts ({contacts.length})
              </label>
              <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                {contacts.map(c => (
                  <div key={c.jid} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center group hover:border-emerald-200 transition-all">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{c.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{c.jid.split('@')[0]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{c.messageCount} chats</p>
                      <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">
                        {new Date(c.lastInteraction).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                {contacts.length === 0 && !isLoading && (
                  <div className="text-center py-20">
                     <div className="text-3xl mb-2">🤫</div>
                     <p className="text-xs text-slate-400 italic">No one has chatted with the bot yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Broadcast Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Jambo! We are experiencing a brief outage in Rongai. Technicians are on site. Est. recovery: 11:30 AM."
                className="w-full h-[220px] bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none shadow-inner"
              />
              <p className="text-[10px] text-slate-400 text-right">Server will send one message every 1.5 seconds to avoid spam flags.</p>
            </div>

            <button
              onClick={handleBroadcast}
              disabled={isSending || !message.trim() || contacts.length === 0}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isSending ? 'Sending queued on server...' : `Broadcast to ${contacts.length} Customers`}
            </button>
            
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
               <span className="text-amber-600">⚠️</span>
               <p className="text-[10px] text-amber-800 leading-tight">
                 <b>Policy Notice:</b> Only send broadcasts for maintenance or service updates. Unsolicited marketing may lead to instance bans.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastManager;
