import React, { useState, useEffect } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { Trash2, CopyX, Equal, Type, CheckCircle2, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

const BasicCleaningTab: React.FC = () => {
  const { 
    toggleStepComplete, 
    addPipelineAction, 
    completedSteps, 
    setActiveTab,
    fetchBasicCleaningStats,
    basicCleaningStats,
    isStatsLoading,
    fetchTypeMismatchStats,
    typeMismatchColumns,
    isTypeMismatchLoading,
  } = useDataPrepStore();
  
  const { ignoredColumns } = useEDAStore();
  
  const isComplete = completedSteps.includes('data_cleaning');

  // Interactive UI State for the 3 Cards
  const [droppedDuplicates, setDroppedDuplicates] = useState(false);
  const [droppedZeroVar, setDroppedZeroVar] = useState(false);
  const [castNumeric, setCastNumeric] = useState(false);

  // Dynamic Data Logic
  useEffect(() => {
    fetchBasicCleaningStats('demo-session', ignoredColumns);
    fetchTypeMismatchStats('demo-session', ignoredColumns);
  }, [fetchBasicCleaningStats, fetchTypeMismatchStats, ignoredColumns]);

  const duplicateCount = basicCleaningStats?.duplicates_count ?? 0;
  const zeroVarCols = basicCleaningStats?.zero_variance_columns ?? [];
  // typeMismatchColumns is now 100% dynamic from the backend — NO hardcoded values.

  const hasNoDuplicates = duplicateCount === 0;
  const hasNoZeroVar = zeroVarCols.length === 0;
  const hasNoTypeMismatches = typeMismatchColumns.length === 0;

  const handleDropDuplicates = () => {
    addPipelineAction({ step: 'data_cleaning', action: 'drop_duplicates', count: duplicateCount });
    setDroppedDuplicates(true);
  };

  const handleDropZeroVar = () => {
    addPipelineAction({ step: 'data_cleaning', action: 'drop_zero_variance', columns: zeroVarCols });
    setDroppedZeroVar(true);
  };

  const handleCastNumeric = () => {
    // Column names pulled from the dynamically detected backend result
    const columnNames = typeMismatchColumns.map(c => c.column);
    addPipelineAction({ step: 'data_cleaning', action: 'cast_to_numeric', columns: columnNames });
    setCastNumeric(true);
  };

  const handleMarkCompleteAndContinue = () => {
    toggleStepComplete('data_cleaning', true);
    setActiveTab('sampling');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Trash2 className="text-indigo-600" size={24} />
          Step 1: Basic Data Cleaning
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Perform strict structural cleanup before statistical transformations. Ensure your data consists only of unique, mathematically viable rows and columns.
        </p>
      </div>

      {isStatsLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p className="text-sm font-medium text-slate-600">Calculating precise structural statistics. Applying exclusion mask...</p>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Card 1: Duplicate Rows */}
        <div className={`bg-white border rounded-xl p-5 shadow-sm transition-colors ${droppedDuplicates ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
          <div className="flex justify-between items-start gap-4">
            <div className="flex gap-4">
              <div className={`p-2 rounded-lg shrink-0 ${droppedDuplicates ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                <CopyX size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">1. Duplicate Rows (Tekrarlayan Satırlar)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                  <strong>Educational Note:</strong> Exact duplicate rows can cause the model to overfit to specific patterns 
                  and artificially inflate performance metrics if split across train/test sets. They hold redundant information.
                </p>
                {!droppedDuplicates && (
                  <div className={`mt-3 inline-flex items-center gap-2 text-xs font-bold px-2 py-1 rounded border ${hasNoDuplicates ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>
                    {hasNoDuplicates ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {hasNoDuplicates ? '0 Duplicate Rows Detected (Clean)' : `${duplicateCount} Duplicate Rows Detected`}
                  </div>
                )}
              </div>
            </div>
            
            <button 
              onClick={handleDropDuplicates}
              disabled={droppedDuplicates || hasNoDuplicates}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shrink-0 cursor-pointer ${
                droppedDuplicates || hasNoDuplicates
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                  : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              {droppedDuplicates ? `${duplicateCount} Rows Dropped` : 'Drop Duplicates'}
            </button>
          </div>
        </div>

        {/* Card 2: Zero-Variance Columns */}
        <div className={`bg-white border rounded-xl p-5 shadow-sm transition-colors ${droppedZeroVar ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
          <div className="flex justify-between items-start gap-4">
            <div className="flex gap-4">
              <div className={`p-2 rounded-lg shrink-0 ${droppedZeroVar ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                <Equal size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">2. Zero-Variance Columns (Sıfır Varyanslı Kolonlar)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                  <strong>Educational Note:</strong> Features with zero variance contain no discriminative information. 
                  If every patient has the exact same value, the ML model cannot use this feature to learn boundaries.
                </p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {hasNoZeroVar ? (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-2">
                       <CheckCircle2 size={14} /> No zero-variance columns detected.
                    </span>
                  ) : (
                    zeroVarCols.map(col => (
                      <span key={col} className={`text-xs px-2 py-1 rounded border ${droppedZeroVar ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' : 'bg-amber-50 text-amber-700 border-amber-200 font-medium'}`}>
                        {col}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <button 
              onClick={handleDropZeroVar}
              disabled={droppedZeroVar || hasNoZeroVar}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shrink-0 cursor-pointer ${
                droppedZeroVar || hasNoZeroVar
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              {droppedZeroVar ? 'Columns Dropped' : 'Drop Constant Columns'}
            </button>
          </div>
        </div>

        {/* Card 3: Data Type Mismatches — fully dynamic, zero hardcoded column names */}
        <div className={`bg-white border rounded-xl p-5 shadow-sm transition-colors ${castNumeric ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
          <div className="flex justify-between items-start gap-4">
            <div className="flex gap-4">
              <div className={`p-2 rounded-lg shrink-0 ${castNumeric ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                <Type size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800">3. Data Type Mismatches (Veri Tipi Düzeltmeleri)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                  <strong>Educational Note:</strong> Some numerical values are read as text due to formatting
                  (e.g., commas or currency symbols). They must be cast to numeric types before mathematical operations.
                </p>

                {isTypeMismatchLoading ? (
                  <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                    <Loader2 size={12} className="animate-spin" /> Scanning for type mismatches...
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {hasNoTypeMismatches ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-2">
                        <CheckCircle2 size={14} /> No type mismatches detected.
                      </span>
                    ) : (
                      typeMismatchColumns.map(col => (
                        <span
                          key={col.column}
                          title={`Coerce confidence: ${(col.coerce_rate * 100).toFixed(0)}%`}
                          className={`text-xs px-2 py-1 rounded border ${
                            castNumeric
                              ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 font-medium'
                          }`}
                        >
                          {col.column}{' '}
                          <span className="opacity-50">({col.current_type} → {col.suggested_type})</span>
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleCastNumeric}
              disabled={castNumeric || hasNoTypeMismatches || isTypeMismatchLoading}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shrink-0 cursor-pointer ${
                castNumeric || hasNoTypeMismatches || isTypeMismatchLoading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-700'
              }`}
            >
              {castNumeric ? 'Cast Successful' : 'Cast to Numeric'}
            </button>
          </div>
        </div>

      </div>
      )}

      {/* Bottom Action Bar */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-center">
        {isComplete ? (
           <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
             <CheckCircle2 size={16} />
             Basic Cleaning Formally Verified
           </div>
        ) : (
          <div className="text-sm text-slate-500 font-medium">
            Review the operations above before continuing.
          </div>
        )}
        
        <button
          onClick={handleMarkCompleteAndContinue}
          className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
        >
          {isComplete ? 'Continue to Sampling' : 'Mark as Completed & Continue'}
          <ChevronRight size={18} />
        </button>
      </div>

    </div>
  );
};

export default BasicCleaningTab;
