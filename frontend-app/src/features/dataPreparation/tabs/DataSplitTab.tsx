import React, { useState, useEffect } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { ShieldAlert, SplitSquareHorizontal, CheckCircle2, Info, ChevronRight } from 'lucide-react';

type SplitStrategy = '2-way' | '3-way';

const DataSplitTab: React.FC = () => {
  const { toggleStepComplete, addPipelineAction, completedSteps, setActiveTab } = useDataPrepStore();
  const mlTask = useEDAStore((s) => s.mlTask);

  const isComplete = completedSteps.includes('data_split');
  const isClassification = mlTask !== 'regression';

  // State
  const [strategy, setStrategy] = useState<SplitStrategy>('2-way');
  const [trainRatio, setTrainRatio] = useState(80);
  const [valRatio, setValRatio] = useState(0);
  const [testRatio, setTestRatio] = useState(20);
  const [stratify, setStratify] = useState(isClassification); // Default to true if classification

  // Handle Strategy Change
  const handleStrategyChange = (newStrategy: SplitStrategy) => {
    setStrategy(newStrategy);
    if (newStrategy === '2-way') {
      setTrainRatio(80);
      setValRatio(0);
      setTestRatio(20);
    } else {
      setTrainRatio(70);
      setValRatio(15);
      setTestRatio(15);
    }
  };

  // Drag logic for 3-way split
  const handleTrainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTrain = parseInt(e.target.value);
    if (strategy === '2-way') {
      setTrainRatio(newTrain);
      setTestRatio(100 - newTrain);
    } else {
      // For 3-way, keep val ratio same if possible, adjust test
      setTrainRatio(newTrain);
      const remaining = 100 - newTrain;
      if (valRatio > remaining) {
        setValRatio(remaining);
        setTestRatio(0);
      } else {
        setTestRatio(remaining - valRatio);
      }
    }
  };

  const handleValChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (strategy === '2-way') return;
    const newVal = parseInt(e.target.value);
    const maxVal = 100 - trainRatio;
    const clampedVal = Math.min(newVal, maxVal);
    
    setValRatio(clampedVal);
    setTestRatio(100 - trainRatio - clampedVal);
  };

  const handleConfirm = () => {
    addPipelineAction({
      step: 'data_split',
      action: 'split',
      strategy,
      train: trainRatio / 100,
      val: strategy === '3-way' ? valRatio / 100 : 0,
      test: testRatio / 100,
      stratify: isClassification ? stratify : false,
    });
    toggleStepComplete('data_split', true);
    setActiveTab('imputation');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <SplitSquareHorizontal className="text-indigo-600" size={24} />
          Step 3: Data Split
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Divide your dataset for training and evaluation.
        </p>
      </div>

      {/* Critical Leakage Barrier Warning */}
      <div className="border-l-4 border-red-500 bg-red-50 rounded-r-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-sm font-bold text-red-900 uppercase tracking-widest">
              Critical Barrier: Data Split
            </h3>
            <p className="text-sm text-red-800 mt-1 leading-relaxed">
              Once you split the data, all future transformations (like filling missing values or scaling) 
              will <span className="font-bold underline">ONLY learn patterns from the Training set</span> to prevent 
              Data Leakage into the Validation/Test sets.
            </p>
          </div>
        </div>
      </div>

      {/* Strategy Selector */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Split Strategy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => handleStrategyChange('2-way')}
            className={`p-4 text-left border-2 rounded-xl transition-all cursor-pointer ${
              strategy === '2-way' 
                ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' 
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-slate-800">Train / Test</span>
              {strategy === '2-way' && <CheckCircle2 size={18} className="text-indigo-600" />}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mt-2">
              <span className="font-semibold text-slate-700">Best for simple models.</span> You train on one set, and test final performance on the other.
            </p>
          </button>

          <button
            onClick={() => handleStrategyChange('3-way')}
            className={`p-4 text-left border-2 rounded-xl transition-all cursor-pointer ${
              strategy === '3-way' 
                ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' 
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-slate-800">Train / Validation / Test</span>
              {strategy === '3-way' && <CheckCircle2 size={18} className="text-indigo-600" />}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mt-2">
              <span className="font-semibold text-slate-700">Best for complex models (e.g., Deep Learning, XGBoost).</span> Use Validation to tune, Test for final unbiased evaluation.
            </p>
          </button>
        </div>
      </div>

      {/* Visual Draggable Slider */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Adjust Proportions</h3>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">
            Total: {trainRatio + valRatio + testRatio}%
          </span>
        </div>

        {/* Visual Bar */}
        <div className="h-10 w-full flex rounded-xl overflow-hidden shadow-inner border border-slate-300 mt-2">
          {trainRatio > 0 && (
            <div 
              style={{ width: `${trainRatio}%` }} 
              className="bg-blue-500 h-full flex items-center justify-center text-xs font-bold text-white transition-all bg-[length:20px_20px] bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)]"
            >
              Train ({trainRatio}%)
            </div>
          )}
          {strategy === '3-way' && valRatio > 0 && (
            <div 
              style={{ width: `${valRatio}%` }} 
              className="bg-amber-400 h-full flex items-center justify-center text-xs font-bold text-amber-900 transition-all"
            >
              Val ({valRatio}%)
            </div>
          )}
          {testRatio > 0 && (
            <div 
              style={{ width: `${testRatio}%` }} 
              className="bg-emerald-500 h-full flex items-center justify-center text-xs font-bold text-white transition-all"
            >
              Test ({testRatio}%)
            </div>
          )}
        </div>

        {/* Sliders */}
        <div className="space-y-4 pt-4">
          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-blue-700">Train Set Ratio</span>
              <span>{trainRatio}%</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="90" 
              value={trainRatio} 
              onChange={handleTrainChange}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {strategy === '3-way' && (
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-amber-700">Validation Set Ratio</span>
                <span>{valRatio}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={100 - trainRatio - 5}
                value={valRatio} 
                onChange={handleValChange}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Stratification */}
      <div className={`border rounded-xl p-5 ${isClassification ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-start gap-4">
          <div className="pt-1">
            <input
              type="checkbox"
              id="stratify-toggle"
              checked={stratify}
              onChange={(e) => setStratify(e.target.checked)}
              disabled={!isClassification}
              className={`w-5 h-5 rounded border-slate-300 ${isClassification ? 'text-indigo-600 focus:ring-indigo-600 cursor-pointer' : 'text-slate-400 cursor-not-allowed'}`}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="stratify-toggle" className={`text-sm font-bold ${isClassification ? 'text-slate-800 cursor-pointer' : 'text-slate-500'}`}>
              Stratify Split by Target Class
            </label>
            <p className={`text-xs mt-1 leading-relaxed ${isClassification ? 'text-slate-600' : 'text-slate-400'}`}>
              {isClassification 
                ? 'Ensures the ratio of your target categories (e.g., 70% Healthy, 30% Sick) remains identical across all splits.' 
                : 'Not applicable for Regression (continuous numerical targets).'}
            </p>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} />
            Split Confirmed
          </div>
        ) : (
          <div />
        )}

        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Confirm Data Split
          <ChevronRight size={18} />
        </button>
      </div>

    </div>
  );
};

export default DataSplitTab;
