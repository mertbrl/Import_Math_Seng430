import React, { useState, useEffect } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { buildPipelineConfig } from '../../../store/pipelineConfig';
import { ShieldCheck, Filter, ChevronRight, CheckCircle2, Loader2, AlertCircle, TrendingUp } from 'lucide-react';

const FeatureSelectionTab: React.FC = () => {
  const { 
    toggleStepComplete, 
    addPipelineAction, 
    cleaningPipeline,
    completedSteps, 
    setActiveTab, 
    featureSelection, 
    setFeatureSelection, 
    fetchFeatureImportances,
    featureImportances,
    isFeatureImportancesLoading,
    featureImportancesError,
    confirmAndInvalidateLaterSteps
  } = useDataPrepStore();
  const isComplete = completedSteps.includes('feature_selection');

  // Load feature importances when the tab opens
  useEffect(() => {
    fetchFeatureImportances(buildPipelineConfig('demo-session'));
  }, [fetchFeatureImportances, cleaningPipeline]);

  const totalFeatures = Math.max(1, featureImportances.length);

  // Default value: Floor of (totalFeatures/2) capped between 1 and totalFeatures
  const [topK, setTopK] = useState<number>(featureSelection?.top_k || Math.max(1, Math.floor(totalFeatures / 2)));
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(featureSelection?.selected_features || []);

  // When importances arrive, if we have no selections yet, automatically pick the top K
  useEffect(() => {
    if (featureImportances.length > 0 && selectedFeatures.length === 0 && !featureSelection?.selected_features) {
      const topFeatures = featureImportances.slice(0, topK).map(f => f.feature);
      setSelectedFeatures(topFeatures);
    }
  }, [featureImportances, topK, selectedFeatures.length, featureSelection]);

  // Adjust selected features automatically when the "Smart Select" slider changes
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const k = parseInt(e.target.value);
    setTopK(k);
    if (featureImportances.length > 0) {
      const topFeatures = featureImportances.slice(0, k).map(f => f.feature);
      setSelectedFeatures(topFeatures);
    }
  };

  const toggleFeature = (featureName: string) => {
    setSelectedFeatures(prev => {
      if (prev.includes(featureName)) {
        return prev.filter(f => f !== featureName);
      } else {
        return [...prev, featureName];
      }
    });
  };

  // Sync to store when it mounts or changes
  useEffect(() => {
    setFeatureSelection({ method: 'manual', top_k: topK, selected_features: selectedFeatures });
  }, [topK, selectedFeatures, setFeatureSelection]);

  const handleConfirm = () => {
    if (!confirmAndInvalidateLaterSteps('feature_selection', 'Changing feature selection will remove all accepted work in the later steps. Do you want to continue?')) {
      return;
    }
    addPipelineAction({
      step: 'feature_selection',
      action: 'feature_selection',
      method: 'manual',
      selected_features: selectedFeatures
    });
    toggleStepComplete('feature_selection', true);
    setActiveTab('imbalance_handling'); // Move to Step 10
  };

  if (isFeatureImportancesLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Calculating Random Forest Feature Importances...</p>
      </div>
    );
  }

  if (featureImportancesError) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
        <AlertCircle size={18} /><div><strong>Error:</strong> {featureImportancesError}</div>
      </div>
    );
  }

  // Find the max score to normalize the progress bars visually
  const maxScore = featureImportances.length > 0 ? Math.max(...featureImportances.map(f => f.score)) : 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Filter className="text-indigo-600" size={24} />
            Step 9: Feature Selection
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Reduce high-dimensional data by visually ranking and selecting the most predictive features.
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-lg text-right">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none mb-1">Total Available Features</p>
          <p className="text-xl font-black text-indigo-700 leading-none">
            {totalFeatures}
          </p>
        </div>
      </div>

      {/* Educational Banner */}
      <div className="border-l-4 border-purple-500 bg-purple-50 rounded-r-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="text-purple-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-sm font-bold text-purple-900 uppercase tracking-widest">
              Why do this before SMOTE?
            </h3>
            <p className="text-sm text-purple-800 mt-1 leading-relaxed">
              Generating synthetic data (SMOTE) in high dimensions creates noise. Selecting the most predictive features first ensures that SMOTE generates high-quality, relevant synthetic samples.
            </p>
          </div>
        </div>
      </div>

      {/* Smart Select Slider */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Smart Select Top K</h3>
          </div>
          <span className="text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full text-sm">
            Top {topK} Features
          </span>
        </div>
        
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-2 font-medium">
            <span>Aggressive (1)</span>
            <span>All Features ({totalFeatures})</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max={totalFeatures} 
            value={topK} 
            onChange={handleSliderChange}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
        <p className="text-xs text-slate-500">
          Slide to automatically select the highest-ranking features, or manually toggle them below.
        </p>
      </div>

      {/* Visual Ranked List */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Feature Importance Ranking</h3>
          <span className="text-xs font-semibold text-slate-500">{selectedFeatures.length} selected</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {featureImportances.map((f, i) => {
            const isSelected = selectedFeatures.includes(f.feature);
            const percentage = maxScore > 0 ? (f.score / maxScore) * 100 : 0;
            
            return (
              <label 
                key={f.feature} 
                className={`flex items-center gap-4 p-4 transition-colors cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-indigo-50/30' : ''}`}
              >
                <div className="flex items-center justify-center shrink-0 w-6">
                  <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                </div>
                
                <div className="shrink-0 flex items-center">
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                    {isSelected && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={isSelected}
                    onChange={() => toggleFeature(f.feature)}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {f.feature}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {f.score.toFixed(4)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${isSelected ? 'bg-indigo-500' : 'bg-slate-300'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>



      {/* Action Footer */}
      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} />
            Selection Applied
          </div>
        ) : (
          <div />
        )}

        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Confirm Feature Selection
          <ChevronRight size={18} />
        </button>
      </div>

    </div>
  );
};

export default FeatureSelectionTab;
