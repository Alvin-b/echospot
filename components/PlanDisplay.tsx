
import React from 'react';
import { ECO_SPOT_INFO } from '../constants';

const PlanDisplay: React.FC = () => {
  return (
    <div className="space-y-12 pb-12">
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Service Knowledge Base</h2>
          <p className="text-slate-500 text-sm">This is the core information your AI agent provides to customers. Any changes here should be synced with the agent's logic.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
              Residential Fiber
            </h3>
            <div className="space-y-4">
              {ECO_SPOT_INFO.monthlyPlans.map((plan) => (
                <div key={plan.name} className="p-4 rounded-2xl border border-slate-50 bg-slate-50/50 flex justify-between items-center">
                   <div>
                      <p className="text-sm font-bold text-slate-900">{plan.name} ({plan.speed})</p>
                      <p className="text-xs text-slate-500">Fixed Monthly Billing</p>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-black text-emerald-600">{plan.price}</p>
                      <button className="text-[10px] font-bold text-slate-400 hover:text-emerald-600 uppercase">Edit</button>
                   </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
              Hotspot Packages
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {ECO_SPOT_INFO.portalPlans.map((plan) => (
                <div key={plan.duration} className="p-3 rounded-xl border border-slate-50 bg-slate-50/50 text-center">
                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{plan.duration}</p>
                   <p className="text-sm font-black text-slate-800">{plan.price}/=</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-12 p-6 border-t border-slate-100">
           <div className="flex items-center justify-between">
              <div>
                 <p className="text-sm font-bold text-slate-900">Standard Installation Fee</p>
                 <p className="text-xs text-slate-500">Applies to all new fiber connections</p>
              </div>
              <p className="text-lg font-black text-emerald-600">{ECO_SPOT_INFO.installationFee}</p>
           </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-3xl p-8 text-white">
        <h3 className="text-xl font-bold mb-4">Agent Interaction Guidelines</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-emerald-400 mb-2 font-bold">1. Empathy First</div>
              <p className="text-xs text-slate-400">Always acknowledge connectivity issues as frustrating before moving to troubleshooting.</p>
           </div>
           <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-emerald-400 mb-2 font-bold">2. Technical Clarity</div>
              <p className="text-xs text-slate-400">Use simple terms: "unplug the router" instead of "power cycle the terminal device".</p>
           </div>
           <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-emerald-400 mb-2 font-bold">3. Escalate Properly</div>
              <p className="text-xs text-slate-400">If signal strength is good but speeds are low, log it for technician review.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default PlanDisplay;
