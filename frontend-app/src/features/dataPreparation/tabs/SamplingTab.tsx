import React, { useState, useEffect, useRef } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { PREP_TABS } from '../DataPrepTabsConfig';
import { Filter, AlertTriangle, CheckCircle2, ChevronDown, ListFilter, Scissors, Shuffle } from 'lucide-react';

const SamplingTab: React.FC = () => {
  const { toggleStepComplete, addPipelineAction, completedSteps, setActiveTab, previewShape, clearSubsequentProgress, cleaningPipeline } = useDataPrepStore();

  // ── Global context: read ML task, target column, and total rows already configured by the user ──
  const mlTask = useEDAStore((s) => s.mlTask);
  const globalTargetColumn = useEDAStore((s) => s.targetColumn);
  const totalRows = useEDAStore((s) => s.totalRows);

  const isComplete = completedSteps.includes('sampling');

  // Derive dynamic row count from the globally stored total dataset size
  const rowCount = totalRows || (previewShape ? previewShape[0] : 0);
  const isLargeDataset = rowCount > 50000;

  const isClassification = mlTask !== 'regression'; // covers 'classification' and 'multiclass'

  // Load saved sample fraction from pipeline store so it persists on navigation
  const savedSample = cleaningPipeline.find(a => a.action === 'sample');
  const [sampleFraction, setSampleFraction] = useState<number>(savedSample ? Math.round(savedSample.fraction * 100) : (isLargeDataset ? 15 : 100));

  const hasWarnedRef = useRef(false);

  // Re-sync when pipeline changes (e.g. clearSubsequentProgress removes the saved sample)
  useEffect(() => {
    const current = cleaningPipeline.find(a => a.action === 'sample');
    if (!current) {
      setSampleFraction(isLargeDataset ? 15 : 100);
      hasWarnedRef.current = false;
    }
  }, [cleaningPipeline, isLargeDataset]);

  // Helper: warn once if trying to edit a completed step that has downstream completed steps
  const guardChange = (): boolean => {
    if (!isComplete || hasWarnedRef.current) return true;
    const currentIndex = PREP_TABS.findIndex(t => t.id === 'sampling');
    const stepsToReset = PREP_TABS.slice(currentIndex + 1).map(t => t.id);
    const hasCompletedAhead = stepsToReset.some(id => completedSteps.includes(id));
    if (!hasCompletedAhead) return true;
    if (!window.confirm("Changing the sampling settings will reset your progress in all later steps. Are you sure?")) {
      return false;
    }
    clearSubsequentProgress(stepsToReset);
    hasWarnedRef.current = true;
    return true;
  };

  const handleApply = () => {
    if (isClassification && !globalTargetColumn) {
      alert('Missing target column! Please ensure a target column was selected in the EDA step.');
      return;
    }
    // Guard runs the warning only if downstream steps are complete
    const currentIndex = PREP_TABS.findIndex(t => t.id === 'sampling');
    const stepsToReset = PREP_TABS.slice(currentIndex + 1).map(t => t.id);
    const hasCompletedAhead = stepsToReset.some(id => completedSteps.includes(id));
    if (hasCompletedAhead && !hasWarnedRef.current) {
      if (!window.confirm("Applying these changes will reset your progress in all later steps. Are you sure?")) return;
      clearSubsequentProgress(stepsToReset);
    }

    addPipelineAction({
      step: 'sampling',
      action: 'sample',
      method: isClassification ? 'stratified' : 'random',
      fraction: sampleFraction / 100,
      target: isClassification ? globalTargetColumn : undefined,
    });
    toggleStepComplete('sampling', true);
    setActiveTab('outliers'); // Step 4 is now Outliers
  };

  const handleSkip = () => {
    toggleStepComplete('sampling', true);
    setActiveTab('outliers'); // Step 4 is now Outliers
  };

  // Human-readable label for the active task
  const taskLabel = mlTask === 'regression' ? 'Regression'
    : mlTask === 'multiclass' ? 'Multi-class Classification'
    : 'Binary Classification';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Filter className="text-indigo-600" size={24} />
          Step 2: Sampling &amp; Volume Management
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Reduce dataset size for faster model training.{' '}
          <span className="font-semibold text-slate-700">Active ML Task: {taskLabel}</span>
          {isClassification
            ? ' — Stratified Sampling is applied automatically to preserve class ratios.'
            : ' — Random Sampling is applied (no class ratio to preserve for regression).'}
        </p>
      </div>

      {/* Smart Dataset Alert */}
      {isLargeDataset ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4 shadow-sm">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900">
              Large dataset detected: {rowCount.toLocaleString()} rows
            </h4>
            <p className="text-xs text-amber-700 mt-1 max-w-2xl leading-relaxed">
              We recommend sampling down to <strong>10%–20%</strong> for faster training and lower memory usage.
              Statistical metrics remain highly accurate at this scale.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-4 shadow-sm">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-900">
              {rowCount > 0
                ? `Optimal dataset size: ${rowCount.toLocaleString()} rows`
                : 'Dataset size not yet calculated'}
            </h4>
            <p className="text-xs text-emerald-700 mt-1 max-w-2xl leading-relaxed">
              {rowCount > 0
                ? 'Your dataset is a manageable size. You can safely skip this step.'
                : 'Load a dataset in Step 1 EDA to see live row count here.'}
            </p>
          </div>
        </div>
      )}

      {/* Educational Panel — auto-adapts to mlTask, no user input required */}
      <div className={`border-2 rounded-xl p-5 ${isClassification ? 'border-indigo-200 bg-indigo-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-lg shrink-0 ${isClassification ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {isClassification ? <ListFilter size={20} /> : <Shuffle size={20} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {isClassification ? 'Stratified Sampling (auto-selected)' : 'Random Sampling (auto-selected)'}
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
              {isClassification
                ? 'Because your project is a Classification task, stratified sampling is mandatory. It preserves the exact ratio of your target classes (e.g., 70% Healthy / 30% Sick) in the sampled subset. This is critical for biased medical datasets.'
                : 'Because your project is a Regression task, rows are sampled completely at random. Since the target is a continuous value (e.g., blood pressure, age), there are no class ratios to preserve.'}
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Parameters */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-6">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sampling Parameters</h3>

        {/* Sample Fraction Slider */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Scissors size={14} className="text-slate-500" />
              Keep Data Fraction
            </label>
            <span className="text-lg font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md">
              {sampleFraction}%
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={sampleFraction}
            onChange={(e) => { if (!guardChange()) return; setSampleFraction(parseInt(e.target.value)); }}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-[10px] font-medium text-slate-400 mt-2 px-1">
            <span>1% (Aggressive)</span>
            <span>100% (Keep All)</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} />
            Step Verified
          </div>
        ) : (
          <div />
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 border-2 border-transparent transition-colors cursor-pointer"
          >
            Skip This Step
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            Apply Sampling
          </button>
        </div>
      </div>

    </div>
  );
};

export default SamplingTab;
