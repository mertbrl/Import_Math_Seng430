import React, { useState, useEffect } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { ScanSearch, Activity, AlertTriangle, CheckCircle2, ChevronRight, Settings2, Loader2, Sparkles } from 'lucide-react';

const OutliersTab: React.FC = () => {
  const { 
    toggleStepComplete, 
    addPipelineAction, 
    completedSteps, 
    setActiveTab,
    outlierColumns,
    isOutlierLoading,
    outlierError,
    fetchOutlierStats,
    outlierStrategies,
    setOutlierStrategy
  } = useDataPrepStore();
  
  const ignoredColumns = useEDAStore(s => s.ignoredColumns);

  const isComplete = completedSteps.includes('outliers');

  // Fetch missing stats when the component mounts
  useEffect(() => {
    // We assume the sessionId is 'demo-session' for this learning tool context unless we have a real one
    fetchOutlierStats('demo-session', ignoredColumns);
  }, [fetchOutlierStats, ignoredColumns]);

  // Sync initial strategies when live data arrives
  useEffect(() => {
    if (outlierColumns.length > 0) {
      outlierColumns.forEach(col => {
        // Only set default if not already selected by user
        if (!outlierStrategies[col.column]) {
          // If recommendation is isolation forest, we default to ignore for safety initially since its destructive, or default to the recommendation
          const safeDefault = col.recommendation === 'Isolation Forest' ? 'isolation_forest' : 
                              col.recommendation === 'IQR' ? 'iqr' : 'zscore';
          setOutlierStrategy(col.column, safeDefault);
        }
      });
    }
  }, [outlierColumns, outlierStrategies, setOutlierStrategy]);


  const handleConfirm = () => {
    // Log the unified action to the pipeline
    addPipelineAction({
      step: 'outliers',
      action: 'handle_outliers',
      strategies: outlierStrategies
    });
    toggleStepComplete('outliers', true);
    setActiveTab('feature_engineering'); // Move to next step
  };

  const handleSkip = () => {
    toggleStepComplete('outliers', true);
    setActiveTab('feature_engineering');
  };

  if (isOutlierLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 animate-in fade-in">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Analyzing feature distributions for statistical anomalies...</p>
      </div>
    );
  }

  if (outlierError) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
        <strong>Error analyzing outliers:</strong> {outlierError}
      </div>
    );
  }

  // ─── Empty State (Zero Outliers Detected) ──────────────────────────────
  if (outlierColumns.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ScanSearch className="text-indigo-600" size={24} />
            Step 5: Outlier Handling
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Identify and handle extreme values intelligently based on the statistical distribution shape of your data.
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-lg font-bold text-emerald-900">Great News! No extreme outliers detected.</h3>
          <p className="text-sm text-emerald-700 mt-2 max-w-md">
            All numerical features in your dataset fit neatly within expected statistical distributions (Normal, Skewed, or Multimodal). You can safely proceed to Feature Engineering without applying any clipping or dropping algorithms.
          </p>
          <button
            onClick={handleSkip}
            className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md transition-all active:scale-[0.98]"
          >
            Continue to Step 6
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // ─── Active Outlier Workspace ────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ScanSearch className="text-indigo-600" size={24} />
          Step 5: Outlier Handling
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Identify and handle extreme values intelligently based on the statistical distribution shape of your data.
        </p>
      </div>

      {/* Critical Leakage + Best Practice Banner */}
      <div className="border-l-4 border-amber-500 bg-amber-50 rounded-r-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-sm font-bold text-amber-900">
              Rule of Thumb: True Errors vs. Natural Extremes
            </h3>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              Outliers can carry critical clinical information. <strong>Do not drop them</strong> unless they are proven to be data entry errors (e.g., Age = 999). 
              For valid clinical extremes, consider <strong>Capping (Winsorization)</strong> or using robust models (like Isolation Forest) rather than raw Z-scores.
            </p>
          </div>
        </div>
      </div>

      {/* Columns List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Settings2 size={16} className="text-indigo-500" />
          Numerical Features ({outlierColumns.length} affected)
        </h3>

        {outlierColumns.map((col) => {
          
          const isNormal = col.distribution === 'Normal';
          const isSkewed = col.distribution === 'Highly Skewed';
          const isMultimodal = col.distribution === 'Multimodal';

          const currentStrategy = outlierStrategies[col.column] || 'ignore';

          return (
            <div key={col.column} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-indigo-200 transition-colors">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                
                {/* Info Block */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 text-base">{col.column}</span>
                    
                    <span className={`text-[10px] items-center gap-1 font-bold px-2 py-1 rounded flex ${
                      isNormal ? 'bg-sky-100 text-sky-700' : 
                      isSkewed ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      <Activity size={12} />
                      Distribution: {col.distribution}
                    </span>
                    
                    <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-1 rounded flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {col.outlier_count} Outliers ({col.outlier_percentage}%)
                    </span>
                  </div>

                  {/* AI Recommendation Box */}
                  <div className={`text-xs p-3 rounded-lg border leading-relaxed bg-slate-50 border-slate-200 text-slate-700`}>
                    <span className="font-bold block mb-1 tracking-wide uppercase text-[10px] text-indigo-600 flex items-center gap-1">
                      <Sparkles size={12} /> AI SUGGESTION
                    </span>
                    {isNormal ? (
                      <span>
                        Since this feature satisfies the Gaussian assumption (Low Skew), a standard <strong>Z-Score (Threshold=3)</strong> is statistically valid and recommended.
                      </span>
                    ) : isSkewed ? (
                      <span>
                        Since this data is <strong>Highly Skewed</strong>, standard Z-Score will fail because the mean is heavily distorted. We recommend using the robust <strong>IQR (Interquartile Range)</strong> method.
                      </span>
                    ) : isMultimodal ? (
                      <span>
                        This feature has multiple peaks (no single &quot;center&quot;). Both Z-Score and IQR are invalid here. We recommend using an advanced spatial algorithm like <strong>Isolation Forest</strong>.
                      </span>
                    ) : (
                      <span>We recommend carefully observing this feature.</span>
                    )}
                  </div>
                </div>

                {/* Strategy Selector */}
                <div className="md:w-64 shrink-0 mt-3 md:mt-0">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Handling Strategy
                  </label>
                  <select
                    value={currentStrategy}
                    onChange={(e) => setOutlierStrategy(col.column, e.target.value)}
                    className="w-full appearance-none border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer transition-all"
                  >
                    <option value="ignore">Ignore (Keep Outliers)</option>
                    <option value="drop_rows">Drop Outlier Rows</option>
                    <optgroup label="Capping (Winsorization)">
                      <option value="cap_1_99">Cap at 1st/99th Percentile</option>
                      <option value="cap_5_95">Cap at 5th/95th Percentile</option>
                    </optgroup>
                    <optgroup label="Detection Algorithms">
                      <option value="zscore">Apply Z-Score (±3)</option>
                      <option value="iqr">Apply IQR Method</option>
                      {/* Only effectively enable Isolation Forest if it's a good fit or multimodal */}
                      {isMultimodal ? (
                        <option value="isolation_forest">Apply Isolation Forest</option>
                      ) : (
                        <option value="isolation_forest" disabled>Apply Isolation Forest (Unnecessary)</option>
                      )}
                    </optgroup>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-2 text-right">
                    {currentStrategy === 'ignore' && 'Retains extreme values.'}
                    {currentStrategy === 'drop_rows' && 'Destroys rows across all columns.'}
                    {currentStrategy === 'zscore' && 'Best for perfectly normal curves.'}
                    {currentStrategy === 'iqr' && 'Best for skewed data distributions.'}
                    {currentStrategy === 'isolation_forest' && 'Advanced density-based isolation.'}
                    {currentStrategy.startsWith('cap') && 'Clips extremes to a fixed maximum ceiling.'}
                  </p>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} />
            Outlier Handling Confirmed
          </div>
        ) : (
          <div />
        )}

        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Confirm Outlier Strategies
          <ChevronRight size={18} />
        </button>
      </div>

    </div>
  );
};

export default OutliersTab;
