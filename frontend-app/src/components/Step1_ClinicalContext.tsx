import React from 'react';
import { useDomainStore } from '../store/useDomainStore';
import { domains } from '../config/domainConfig';

export const Step1_ClinicalContext: React.FC = () => {
  const selectedDomainId = useDomainStore((state) => state.selectedDomainId);
  const domain = domains.find((d) => d.id === selectedDomainId) || domains[0];

  return (
    <div 
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" 
      id="step-1" 
      data-testid="step1-container"
    >
      {/* Component Header */}
      <div className="bg-slate-50 px-6 sm:px-8 py-6 border-b border-slate-200 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <span className="inline-block px-2.5 py-1 bg-indigo-100/80 text-indigo-700 text-[10px] font-bold tracking-widest rounded-full mb-3 border border-indigo-200/50">
            STEP 1 OF 7
          </span>
          <h2 className="text-2xl font-bold font-serif text-slate-900 tracking-tight">
            Clinical Context &amp; Problem Definition
          </h2>
          <p className="text-[14px] text-slate-600 mt-2 max-w-3xl leading-relaxed">
            Before looking at data, we must clearly define our clinical objective. For <strong className="text-slate-800 font-semibold">{domain.domainName}</strong>, our algorithm will attempt to predict: <span className="text-indigo-700 font-medium">{domain.clinicalQuestion}</span>. This frames how we evaluate model success later.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold tracking-wide bg-slate-200/50 px-3 py-1.5 rounded-md border border-slate-200">
            <span>⏱</span> Estimated Time: 3 mins
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98] w-full md:w-auto">
            Proceed to Data Exploration →
          </button>
        </div>
      </div>

      {/* Grid Layout Body */}
      <div className="p-6 sm:px-8 sm:py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white focus:outline-none">
        
        {/* Column 1: Core Scenario Details */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Objective Parameters
            </h3>
            
            <div className="group">
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Selected Domain</label>
              <div className="text-xl font-bold text-slate-900 transition-colors" data-testid="step1-domain">
                {domain.domainName}
              </div>
            </div>
            
            <div className="group">
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 mt-2">Core Clinical Question</label>
              <div className="text-[15px] font-medium text-slate-800 leading-relaxed p-4 bg-slate-50 rounded-xl border border-slate-200 border-l-4 border-l-indigo-500 shadow-sm" data-testid="step1-question">
                {domain.clinicalQuestion}
              </div>
            </div>
            
            <div className="group">
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 mt-2">Why This Matters (Clinical Impact)</label>
              <div className="text-[14px] text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-xl p-4 shadow-sm" data-testid="step1-why">
                {domain.whyThisMatters}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Data & Workflow Context */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Dataset & Target Metrics
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Source Dataset</span>
                <span className="font-semibold text-slate-700 text-sm">{domain.dataSource}</span>
              </div>
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Variable</span>
                <span className="inline-block bg-slate-800 text-white font-mono text-xs px-2 py-1 rounded shadow-inner">
                  {domain.targetVariable}
                </span>
              </div>
            </div>

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mt-4">
              Safety & Boundaries
            </h3>

            <div className="flex flex-col gap-3">
              <div className="flex bg-amber-50/80 border border-amber-200/80 p-4 rounded-xl items-start gap-3 shadow-sm">
                <span className="text-lg leading-none mt-0.5">⚠️</span>
                <p className="text-[13px] text-amber-900 leading-relaxed">
                  <b className="font-semibold text-amber-950 block mb-0.5">Clinical Finality</b>
                  ML algorithms establish statistical probabilities. They <span className="underline decoration-amber-300">do not</span> replace human intuition or comprehensive clinical assessments.
                </p>
              </div>

              <div className="flex bg-emerald-50/80 border border-emerald-200/80 p-4 rounded-xl items-start gap-3 shadow-sm">
                <span className="text-lg leading-none mt-0.5">✅</span>
                <p className="text-[13px] text-emerald-900 leading-relaxed">
                  <b className="font-semibold text-emerald-950 block mb-0.5">Decision Support Tool</b>
                  Treat the incoming model as an assistive peer designed to flag high-risk anomalies for mandatory human review.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
