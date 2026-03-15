import React from 'react';
import { AlertOctagon, CheckCircle2, ChevronRight } from 'lucide-react';
import { useDataPrepStore } from '../../store/useDataPrepStore';
import { PREP_TABS } from './DataPrepTabsConfig';
import BasicCleaningTab from './tabs/BasicCleaningTab';
import SamplingTab from './tabs/SamplingTab';
import DataSplitTab from './tabs/DataSplitTab';
import ImputationTab from './tabs/ImputationTab';
import OutliersTab from './tabs/OutliersTab';
import TransformationTab from './tabs/TransformationTab';
import EncodingTab from './tabs/EncodingTab';
import ScalingTab from './tabs/ScalingTab';
import DimensionalityTab from './tabs/DimensionalityTab';
import ImbalanceTab from './tabs/ImbalanceTab';

export const Step3_DataPreparation: React.FC = () => {
  const { activeTabId, completedSteps, setActiveTab } = useDataPrepStore();

  const renderActiveComponent = () => {
    switch (activeTabId) {
      case 'data_cleaning':
        return <BasicCleaningTab />;
      case 'sampling':
        return <SamplingTab />;
      case 'data_split':
        return <DataSplitTab />;
      case 'imputation':
        return <ImputationTab />;
      case 'outliers':
        return <OutliersTab />;
      case 'transformation':
        return <TransformationTab />;
      case 'encoding':
        return <EncodingTab />;
      case 'scaling':
        return <ScalingTab />;
      case 'dimensionality_reduction':
        return <DimensionalityTab />;
      case 'imbalance_handling':
        return <ImbalanceTab />;
      default:
        return (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 border border-slate-200 border-dashed rounded-xl animate-in fade-in">
            <p className="text-sm font-medium">Step integration pending...</p>
            <p className="text-xs mt-1">Select Data Cleaning to begin Step 3.</p>
          </div>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      
      {/* Two-Column Workspace */}
      <div className="flex gap-6 items-start">
        
        {/* Left Sidebar (1/4 Width) */}
        <div className="w-1/4 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[70vh]">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Data Prep Pipeline
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${(completedSteps.length / PREP_TABS.length) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-500 w-8 text-right">
                {completedSteps.length}/{PREP_TABS.length}
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200">
            <div className="space-y-1">
              {PREP_TABS.map((tab) => {
                const isActive = activeTabId === tab.id;
                const isComplete = completedSteps.includes(tab.id);

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center gap-3 group cursor-pointer
                      ${isActive 
                        ? 'bg-indigo-50 border-indigo-100 shadow-sm' 
                        : 'hover:bg-slate-50 border-transparent'}
                      border`}
                  >
                    {/* Status Icon */}
                    <div className={`shrink-0 transition-colors ${
                      isComplete ? 'text-emerald-500' : 
                      isActive ? 'text-indigo-400' : 'text-slate-300 group-hover:text-slate-400'
                    }`}>
                      <CheckCircle2 size={18} className={isComplete ? "fill-emerald-100" : ""} />
                    </div>

                    {/* Text Block */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate transition-colors ${
                        isActive ? 'text-indigo-900' : 
                        isComplete ? 'text-slate-700' : 'text-slate-600'
                      }`}>
                        {tab.title}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {tab.subtitle}
                      </p>
                    </div>

                    {/* Active Indicator Arrow */}
                    {isActive && (
                      <ChevronRight size={16} className="text-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Content Area (3/4 Width) */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm min-h-[70vh] p-6 lg:p-8">
          {renderActiveComponent()}
        </div>

      </div>
    </div>
  );
};
