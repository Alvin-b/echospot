
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MessageRole, MaintenanceRecord } from '../types';
import { geminiService } from '../services/geminiService';
import { dataService } from '../services/dataService';

const ChatInterface: React.FC = () => {
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: MessageRole.AGENT,
      content: "Jambo! EcoSpot Support here. I'm connected to the live knowledge base. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setMaintenance(dataService.getMaintenanceRecords());
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.concat(userMsg).map(m => ({
        role: m.role,
        content: m.content
      }));
      
      const { text: responseText } = await geminiService.generateResponse(history, maintenance);
      
      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.AGENT,
        content: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
      <div className="bg-emerald-600 p-5 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">AI</div>
          <div>
            <h3 className="font-bold leading-tight">EcoSpot Agent Simulator</h3>
            <p className="text-[10px] uppercase tracking-widest opacity-70">Knowledge Base: Real-time</p>
          </div>
        </div>
        <div className="bg-emerald-500/50 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-400/30">
          ADMIN PREVIEW
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        <div className="flex justify-center">
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-tighter">
            System: Connected using current Admin knowledge base
          </span>
        </div>
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-5 py-3 rounded-2xl shadow-sm ${
                msg.role === MessageRole.USER
                  ? 'bg-emerald-600 text-white rounded-tr-none'
                  : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed font-medium">{msg.content}</p>
              <div className={`text-[9px] mt-2 flex items-center gap-1 ${msg.role === MessageRole.USER ? 'text-emerald-100' : 'text-slate-400'}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-150"></div>
                <span className="text-[10px] font-bold text-slate-400 ml-2">AGENT THINKING...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-5 bg-white border-t border-slate-100">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Test current Knowledge Base rules..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="bg-emerald-600 text-white p-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
