import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, Download, Loader2 } from 'lucide-react';
import { useDataPrepStore } from '../../store/useDataPrepStore';
import { buildPipelineConfig } from '../../store/pipelineConfig';
import { downloadPreprocessedCSV } from '../../api/dataPrepAPI';
import { PREP_TABS } from './DataPrepTabsConfig';
import PrepTimingHint from './PrepTimingHint';
import BasicCleaningTab from './tabs/BasicCleaningTab';
import DataSplitTab from './tabs/DataSplitTab';
import ImputationTab from './tabs/ImputationTab';
import OutliersTab from './tabs/OutliersTab';
import TransformationTab from './tabs/TransformationTab';
import EncodingTab from './tabs/EncodingTab';
import ScalingTab from './tabs/ScalingTab';
import DimensionalityTab from './tabs/DimensionalityTab';
import FeatureSelectionTab from './tabs/FeatureSelectionTab';
import ImbalanceTab from './tabs/ImbalanceTab';
import PreprocessingReviewTab from './tabs/PreprocessingReviewTab';

export const Step3_DataPreparation: React.FC = () => {
  const { activeTabId, completedSteps, setActiveTab } = useDataPrepStore();

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const pipelineConfig = buildPipelineConfig('demo-session');
      await downloadPreprocessedCSV(pipelineConfig);
    } catch (e: any) {
      setDownloadError(e.message ?? 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const renderActiveComponent = () => {
    switch (activeTabId) {
      case 'data_cleaning':
        return <BasicCleaningTab />;
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
      case 'feature_selection':
        return <FeatureSelectionTab />;
      case 'imbalance_handling':
        return <ImbalanceTab />;
      case 'preprocessing_review':
        return <PreprocessingReviewTab />;
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
    <div className="w-full space-y-6">
      
      {/* Two-Column Workspace */}
      <div className="grid grid-cols-1 gap-6 items-start xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
        
        {/* Left Sidebar (1/4 Width) */}
        <div className="w-full shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[68vh] xl:h-[75vh]">
          <div className="min-h-[92px] p-4 border-b border-slate-100 bg-slate-50 flex flex-col justify-center">
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
                      <PrepTimingHint tabId={tab.id} compact />
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

        <div className="min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm min-h-[70vh] p-5 lg:p-6 xl:p-8 2xl:p-10">
          {renderActiveComponent()}
        </div>

      </div>

      {/* Success Banner with Download Button */}
      {completedSteps.includes('preprocessing_review') && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 shadow-lg text-white flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <CheckCircle2 size={32} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Data Preparation Complete!</h3>
              <p className="text-emerald-50 mt-1">
                Data is clean, scaled, selected, and balanced. Download your preprocessed dataset.
              </p>
              {downloadError && (
                <p className="text-red-200 text-xs mt-1">⚠ {downloadError}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full justify-center lg:w-auto flex items-center gap-2 bg-white text-emerald-700 px-6 py-3 rounded-xl font-bold hover:bg-emerald-50 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <><Loader2 size={18} className="animate-spin" /> Preparing CSV...</>
            ) : (
              <><Download size={18} /> Download Preprocessed CSV</>
            )}
          </button>
        </div>
      )}

    </div>
  );
};
