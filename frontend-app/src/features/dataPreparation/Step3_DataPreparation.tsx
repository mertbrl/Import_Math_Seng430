import React from 'react';
import { CheckCircle2, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useDataPrepStore } from '../../store/useDataPrepStore';
import { useDomainStore } from '../../store/useDomainStore';
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
import { ClinicalAutoPrepView } from './ClinicalAutoPrepView';


export const Step3_DataPreparation: React.FC = () => {
  const sessionId = useDomainStore((s) => s.sessionId);
  const userMode = useDomainStore((s) => s.userMode);
  const setCurrentStep = useDomainStore((s) => s.setCurrentStep);
  const { activeTabId, completedSteps, setActiveTab } = useDataPrepStore();

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

  if (userMode === 'clinical') {
    return <ClinicalAutoPrepView />;
  }

  return (
    <div className="ha-step3-manual-shell w-full space-y-6">
      <div className="ha-card overflow-hidden">
        <div className="ha-step3-hero-shell mx-4 mb-4 mt-4 rounded-[28px] border border-[rgba(190,201,193,0.4)] bg-[radial-gradient(circle_at_top_left,_rgba(195,236,215,0.5),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(156,245,202,0.42),_transparent_35%),linear-gradient(180deg,_#fcfefd,_#eef7f1)] px-7 py-8 shadow-[0_18px_42px_rgba(0,89,62,0.06)] sm:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="ha-pill ha-pill-accent">
                <SlidersHorizontal size={14} />
                Step 3 · Data Preparation
              </span>
              <h2 className="ha-display mt-5">Tune preprocessing with full manual control.</h2>
              <p className="ha-body mt-4">
                Configure cleaning, splitting, imputation, outlier handling, encoding, scaling, and feature selection before you move into model training.
              </p>
            </div>

            <div className="ha-step3-hero-scope rounded-[20px] border border-[var(--border)] bg-white/82 px-5 py-4 backdrop-blur-md">
              <p className="ha-section-label">Advanced Workspace</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                {completedSteps.length} of {PREP_TABS.length} prep stages reviewed
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Workspace */}
      <div className="grid grid-cols-1 gap-6 items-start xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
        
        {/* Left Sidebar (1/4 Width) */}
        <div className="ha-card w-full shrink-0 overflow-hidden flex flex-col h-[68vh] xl:h-[75vh]" data-tutorial="step3-sidebar">
          <div className="min-h-[92px] p-4 border-b border-[var(--border)] bg-[var(--surface2)] flex flex-col justify-center">
            <h3 className="text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1">
              Data Prep Pipeline
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500 bg-[linear-gradient(90deg,var(--trust),var(--clinical))]" 
                  style={{ width: `${(completedSteps.length / PREP_TABS.length) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-[var(--text3)] w-8 text-right">
                {completedSteps.length}/{PREP_TABS.length}
              </span>
            </div>
          </div>
          
          <div className="ha-scrollbar-thin flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {PREP_TABS.map((tab) => {
                const isActive = activeTabId === tab.id;
                const isComplete = completedSteps.includes(tab.id);

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (userMode === 'clinical') return;
                      setActiveTab(tab.id);
                    }}
                    style={isActive ? { borderColor: 'color-mix(in srgb, var(--accent) 16%, transparent)' } : undefined}
                    className={`w-full text-left px-3 py-3 rounded-[16px] transition-all flex items-center gap-3 group
                      ${userMode === 'clinical' ? 'cursor-default opacity-80' : 'cursor-pointer'}
                      ${isActive 
                        ? 'bg-[var(--accent-soft)] shadow-sm' 
                        : (userMode !== 'clinical' ? 'hover:bg-[var(--surface2)] border-transparent' : 'border-transparent')}
                      border`}
                  >
                    {/* Status Icon */}
                    <div className={`shrink-0 transition-colors ${
                      isComplete ? 'text-emerald-500' : 
                      isActive ? 'text-[var(--accent)]' : 'text-[var(--text3)] group-hover:text-[var(--text2)]'
                    }`}>
                      <CheckCircle2 size={18} className={isComplete ? "fill-emerald-100" : ""} />
                    </div>

                    {/* Text Block */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate transition-colors ${
                        isActive ? 'text-[var(--accent-ink)]' : 
                        isComplete ? 'text-[var(--text)]' : 'text-[var(--text2)]'
                      }`}>
                        {tab.title}
                      </p>
                      <p className="text-[10px] text-[var(--text3)] truncate mt-0.5">
                        {tab.subtitle}
                      </p>
                      <PrepTimingHint tabId={tab.id} compact />
                    </div>

                    {/* Active Indicator Arrow */}
                    {isActive && (
                      <ChevronRight size={16} className="text-[var(--accent)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="ha-card min-w-0 min-h-[70vh] p-5 lg:p-6 xl:p-8 2xl:p-10" data-tutorial="step3-content">
          {renderActiveComponent()}
          {activeTabId === 'preprocessing_review' && completedSteps.includes('preprocessing_review') ? (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="ha-button-primary inline-flex items-center justify-center gap-2"
              >
                Next Step
                <ChevronRight size={16} />
              </button>
            </div>
          ) : null}
        </div>

      </div>

    </div>
  );
};
