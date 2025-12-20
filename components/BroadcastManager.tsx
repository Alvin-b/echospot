
import React, { useState, useEffect } from 'react';
import { evolutionService } from '../services/evolutionService';
import { Contact } from '../types';

const BroadcastManager: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setContacts(evolutionService.getContacts());
  }, []);

  const handleBroadcast = async () => {
    if (!message.trim() || contacts.length === 0) return;
    setIsSending(true);
    setProgress(0);

    for (let i = 0; i < contacts.length; i++) {
      try {
        await evolutionService.sendMessage(contacts[i].jid, message);
        setProgress(Math.round(((i + 1) / contacts.length) * 100));
        // Small delay between messages to prevent spam detection
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error("Failed to send to", contacts[i].jid, e);
      }
    }

    setIsSending(false);
    setMessage('');
    alert('Broadcast completed successfully!');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Broadcast Center</h2>
        <p className="text-slate-500 text-sm mb-8">Send mass updates to all customers who have interacted with the EcoSpot AI.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-4">Saved Contacts ({contacts.length})</label>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {contacts.map(c => (
                  <div key={c.jid} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{c.name}</p>
                      <p className="text-[10px] text-slate-400">{c.jid.split('@')[0]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-emerald-600">{c.messageCount} msgs</p>
                    </div>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-10 italic">No contacts stored yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Message Content</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Scheduled maintenance tomorrow in Kutus area from 9 AM..."
                className="w-full h-[180px] bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
              />
            </div>

            {isSending && (
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                  <span>Sending Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleBroadcast}
              disabled={isSending || !message.trim() || contacts.length === 0}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {isSending ? 'Sending in progress...' : `Send to ${contacts.length} Contacts`}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-3xl p-8 text-white flex items-center gap-6">
        <div className="text-4xl">💡</div>
        <div>
          <h3 className="font-bold mb-1">Inbuild Memory Active</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every customer who chats with the bot is automatically saved to the local memory. 
            You can use this to broadcast important announcements without manually collecting numbers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BroadcastManager;
