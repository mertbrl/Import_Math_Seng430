import React, { useState, useEffect } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { CheckCircle2, FlaskConical, AlertTriangle, ChevronRight, Settings2, Loader2 } from 'lucide-react';

type ImputationStrategy = 'drop_rows' | 'drop_column' | 'mean' | 'median' | 'mode' | 'knn';

const ImputationTab: React.FC = () => {
  const { 
    toggleStepComplete, 
    addPipelineAction, 
    completedSteps,
    setActiveTab,
    missingColumns,
    isMissingLoading,
    missingError,
    fetchMissingStats,
    confirmAndInvalidateLaterSteps
  } = useDataPrepStore();
  
  const ignoredColumns = useEDAStore(s => s.ignoredColumns);

  const isComplete = completedSteps.includes('imputation');

  // Fetch missing stats when the component mounts
  useEffect(() => {
    // We assume the sessionId is 'demo-session' for this learning tool context unless we have a real one
    fetchMissingStats('demo-session', ignoredColumns);
  }, [fetchMissingStats, ignoredColumns]);

  // Strategy State maps ColumnName -> Strategy
  const [strategies, setStrategies] = useState<Record<string, ImputationStrategy>>({});

  // Sync initial strategies when live data arrives
  useEffect(() => {
    if (missingColumns.length > 0) {
      const initialState: Record<string, ImputationStrategy> = {};
      missingColumns.forEach(col => {
        if (col.missing_percentage < 5) initialState[col.column] = 'drop_rows';
        else if (col.missing_percentage > 30) initialState[col.column] = 'drop_column';
        else initialState[col.column] = 'knn';
      });
      setStrategies(initialState);
    }
  }, [missingColumns]);

  const handleStrategyChange = (column: string, strategy: ImputationStrategy) => {
    setStrategies(prev => ({ ...prev, [column]: strategy }));
  };

  const handleConfirm = () => {
    if (!confirmAndInvalidateLaterSteps('imputation', 'Changing missing-value handling will remove all accepted work in the later steps. Do you want to continue?')) {
      return;
    }

    // Log the unified action to the pipeline
    addPipelineAction({
      step: 'imputation',
      action: 'impute_missing',
      strategies
    });
    toggleStepComplete('imputation', true);
    setActiveTab('transformation'); // Step 6 is Feature Transformation
  };

  const handleSkip = () => {
    if (!confirmAndInvalidateLaterSteps('imputation', 'Skipping this step now will remove all accepted work in the later steps. Do you want to continue?')) {
      return;
    }
    toggleStepComplete('imputation', true);
    setActiveTab('transformation'); // Step 6 is Feature Transformation
  };

  if (isMissingLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 animate-in fade-in">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Scanning dataset for missing values...</p>
      </div>
    );
  }

  if (missingError) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
        <strong>Error analyzing missing data:</strong> {missingError}
      </div>
    );
  }

  // ─── Empty State (Zero Missing Values) ──────────────────────────────
  if (missingColumns.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FlaskConical className="text-indigo-600" size={24} />
            Step 4: Missing Value Handling
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Resolve empty cells to ensure mathematical models can process your data.
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-lg font-bold text-emerald-900">Great News! Your dataset has no missing values.</h3>
          <p className="text-sm text-emerald-700 mt-2 max-w-md">
            All structural gaps have been validated. You can safely proceed to the next step without applying any imputation algorithms.
          </p>
          <button
            onClick={handleSkip}
            className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md transition-all active:scale-[0.98]"
          >
            Continue to Step 5
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // ─── Active Imputation Workspace ────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FlaskConical className="text-indigo-600" size={24} />
          Step 4: Missing Value Handling
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Resolve empty cells using statistical filling methods (Imputation) or structural deletion.
        </p>
      </div>

      {/* Critical Leakage Reminder */}
      <div className="border-l-4 border-rose-500 bg-rose-50 rounded-r-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-sm font-bold text-rose-900">
              CRITICAL RULE: Fit on Train, Transform on Test
            </h3>
            <p className="text-sm text-rose-800 mt-1 leading-relaxed">
              Any mathematical imputation (like Mean, Median, or KNN) <strong>MUST be learned ONLY from the Training set</strong> to prevent Data Leakage. The application will automatically handle this separation in the backend pipeline.
            </p>
          </div>
        </div>
      </div>

      {/* Columns List */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Settings2 size={16} className="text-indigo-500" />
            Column Strategies ({missingColumns.length} affected)
          </h3>
          <button
            onClick={() => {
              const suggestions: Record<string, ImputationStrategy> = {};
              missingColumns.forEach(col => {
                const suggestion = col.missing_percentage < 5 ? 'drop_rows' : col.missing_percentage > 30 ? 'drop_column' : 'knn';
                suggestions[col.column] = suggestion;
              });
              setStrategies(suggestions);
              // Apply suggestions and advance
              if (!confirmAndInvalidateLaterSteps('imputation', 'Applying these system suggestions will remove all accepted work in the later steps. Do you want to continue?')) return;
              addPipelineAction({ step: 'imputation', action: 'impute_missing', strategies: suggestions });
              toggleStepComplete('imputation', true);
              setActiveTab('transformation');
            }}
            className="flex flex-col items-end gap-0.5 cursor-pointer"
          >
            <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
              <Settings2 size={14} /> Use System Suggestions
            </span>
            <span className="text-[10px] text-slate-400 pr-1">Applies suggestions &amp; advances to Feature Transformation →</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {missingColumns.map((col) => {
            const systemSuggestion: string = col.missing_percentage < 5 ? 'drop_rows' : col.missing_percentage > 30 ? 'drop_column' : 'knn';
            const isMCAR = col.missing_percentage < 5;
            const isMAR = col.missing_percentage >= 5 && col.missing_percentage <= 30;
            const isMNAR = col.missing_percentage > 30;

            return (
              <div key={col.column} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-indigo-200 transition-colors h-full">
                <div className="flex h-full flex-col gap-4">
                  
                  {/* Info Block */}
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-base break-all">{col.column}</span>
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">
                        {col.type} TYPE
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                        isMCAR ? 'bg-emerald-100 text-emerald-700' : 
                        isMAR ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {col.missing_percentage}% MISSING
                      </span>
                    </div>

                    {/* System Recommendation Box */}
                    <div className={`text-xs p-3 rounded-lg border leading-relaxed ${
                      isMCAR ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                      isMAR ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-red-50 border-red-100 text-red-800'
                    }`}>
                      <span className="font-bold block mb-1 tracking-wide uppercase text-[10px] flex items-center gap-1">
                        <Settings2 size={12} /> SYSTEM SUGGESTION
                      </span>
                      <span className="font-bold block mb-1 tracking-wide uppercase text-[10px]">
                        {isMCAR ? 'MCAR (Missing Completely at Random)' : 
                         isMAR ? 'MAR (Missing at Random)' : 'MNAR (Missing Not at Random)'}
                      </span>
                      {isMCAR && 'Recommendation: Since the missing rate is very low, Dropping Rows is the safest and simplest option.'}
                      {isMAR && 'Recommendation: Missingness likely depends on other variables. Use KNN Imputer or Mean/Median to predict values.'}
                      {isMNAR && <span className="font-semibold">CRITICAL: High missing rate. The missingness itself might hold clinical meaning. Recommendation: Use Drop Column, or add a Missing Indicator.</span>}
                    </div>
                  </div>

                  {/* Strategy Selector */}
                  <div className="border-t border-slate-100 pt-4">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Action to Apply
                    </label>
                    <select
                      value={strategies[col.column]}
                      onChange={(e) => handleStrategyChange(col.column, e.target.value as ImputationStrategy)}
                      className="w-full appearance-none border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer transition-all"
                    >
                      <optgroup label="Structural Deletion">
                        <option value="drop_rows">
                          Drop Affected Rows {systemSuggestion === 'drop_rows' ? '(System Suggestion)' : ''}
                        </option>
                        <option value="drop_column">
                          Drop Entire Column {systemSuggestion === 'drop_column' ? '(System Suggestion)' : ''}
                        </option>
                      </optgroup>
                      <optgroup label="Statistical Imputation">
                        <option value="mean">
                          Mean Imputer {systemSuggestion === 'mean' ? '(System Suggestion)' : ''}
                        </option>
                        <option value="median">
                          Median Imputer {systemSuggestion === 'median' ? '(System Suggestion)' : ''}
                        </option>
                        <option value="mode">
                          Mode (Most Frequent) {systemSuggestion === 'mode' ? '(System Suggestion)' : ''}
                        </option>
                        <option value="knn">
                          KNN Imputer (Advanced) {systemSuggestion === 'knn' ? '(System Suggestion)' : ''}
                        </option>
                      </optgroup>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-2">
                      {strategies[col.column] === 'drop_rows' && 'Destroys rows across all columns.'}
                      {strategies[col.column] === 'drop_column' && 'Removes feature entirely.'}
                      {strategies[col.column] === 'knn' && 'Uses K-Nearest Neighbors to guess value.'}
                    </p>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} />
            Imputation Confirmed
          </div>
        ) : (
          <div />
        )}

        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Confirm Imputation Strategies
          <ChevronRight size={18} />
        </button>
      </div>

    </div>
  );
};

export default ImputationTab;
