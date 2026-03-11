import React from 'react';
import { useDomainStore } from '../store/useDomainStore';
import { domains } from '../config/domainConfig';

export const TopNavbar: React.FC = () => {
  const { selectedDomainId, resetApp, toggleHelp } = useDomainStore();
  const currentDomain = domains.find(d => d.id === selectedDomainId)?.domainName || "Unknown Domain";

  return (
    <nav className="bg-[#0D2340] text-white px-6 py-3 shadow-lg flex items-center justify-between sticky top-0 z-50">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center font-serif font-bold text-lg shadow-inner">
            H
          </div>
          <h1 className="font-semibold text-sm sm:text-base tracking-wide leading-tight whitespace-nowrap">
            HEALTH-AI · ML Learning Tool
          </h1>
        </div>
        <p className="hidden md:block text-xs text-slate-400 font-medium border-l border-slate-700 pl-4">
          For Healthcare Professionals
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_0_2px_rgba(45,212,191,0.2)]"></span>
          Domain: <b className="text-white ml-0.5">{currentDomain}</b> <span className="text-[10px] ml-1 opacity-60">▾</span>
        </div>
        
        <button 
          onClick={resetApp}
          className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-all font-sans"
        >
          ↺ Reset
        </button>
        
        <button 
          onClick={toggleHelp}
          className="px-3 py-1.5 rounded-lg border border-[#0E9E8E] bg-[#0E9E8E] text-white text-xs font-medium hover:bg-[#0b8a7c] hover:border-[#0b8a7c] transition-all font-sans drop-shadow-sm"
        >
          ? Help
        </button>
      </div>
    </nav>
  );
};
