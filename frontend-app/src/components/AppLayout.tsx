import React from 'react';
import { TopNavbar } from './TopNavbar';
import { HelpChatbotDrawer } from './HelpChatbotDrawer';
import { useDomainStore } from '../store/useDomainStore';
import { domains } from '../config/domainConfig';

interface AppLayoutProps {
  children: React.ReactNode;
}

const STEPS = [
  { id: 1, name: 'Clinical Context', desc: 'Use case & goals' },
  { id: 2, name: 'Data Exploration', desc: 'Upload & understand' },
  { id: 3, name: 'Data Preparation', desc: 'Clean & split data' },
  { id: 4, name: 'Model & Parameters', desc: 'Select & tune' },
  { id: 5, name: 'Results', desc: 'Metrics & matrix' },
  { id: 6, name: 'Explainability', desc: 'Why this prediction?' },
  { id: 7, name: 'Ethics & Bias', desc: 'Fairness check' },
];

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { selectedDomainId, setDomain } = useDomainStore();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <TopNavbar />
      <HelpChatbotDrawer />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        
        {/* Sticky Header Section for Domain + Stepper */}
        <div className="sticky top-[60px] z-40 bg-slate-50/95 backdrop-blur-sm pt-2 pb-4 border-b border-transparent space-y-5 shadow-[0_10px_20px_-15px_rgba(0,0,0,0.05)]">
          {/* Domain Selector Bar */}
          <section>
            <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2.5 pl-1">Select Clinical Domain</h2>
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {domains.map((d) => {
                const isActive = d.id === selectedDomainId;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDomain(d.id)}
                    className={`flex-none px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {d.domainName}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Visual Stepper */}
          <section className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-200 flex overflow-x-auto gap-2 scrollbar-hide">
            {STEPS.map((step) => {
               // Only Step 1 is active for now
               const isActive = step.id === 1;
               return (
                 <div 
                   key={step.id} 
                   className={`flex-none w-[160px] flex items-start gap-2.5 p-2 rounded-lg transition-all ${
                     isActive 
                       ? 'bg-indigo-50/50 border border-indigo-100' 
                       : 'bg-transparent border border-transparent opacity-60'
                   }`}
                 >
                   <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                     isActive 
                       ? 'bg-indigo-600 text-white shadow-sm' 
                       : 'bg-slate-100 text-slate-400 border border-slate-200'
                   }`}>
                     {step.id}
                   </div>
                   <div className="flex flex-col flex-1 overflow-hidden">
                     <span className={`text-[13px] font-semibold truncate ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                       {step.name}
                     </span>
                     <span className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                       {step.desc}
                     </span>
                   </div>
                 </div>
               )
            })}
          </section>
        </div>

        {/* Dynamic Step Component Content */}
        <section className="animate-fade-in-up mt-2">
          {children}
        </section>

      </main>
    </div>
  );
};
