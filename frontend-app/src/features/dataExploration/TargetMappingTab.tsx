import React, { useState } from 'react';
import type { ColumnStats } from './mockEDAData';
import { useDomainStore } from '../../store/useDomainStore';
import { useEDAStore } from '../../store/useEDAStore';
import { Target, Save, CheckCircle2, ChevronDown, ActivitySquare } from 'lucide-react';

interface TargetMappingTabProps {
  columns: ColumnStats[];
  totalRows: number;
}

const TargetMappingTab: React.FC<TargetMappingTabProps> = ({ columns, totalRows }) => {

  const setSchemaValid = useDomainStore((s) => s.setSchemaValid);
  const setCurrentStep = useDomainStore((s) => s.setCurrentStep);
  const schemaValid = useDomainStore((s) => s.schemaValid);
  const setMlConfig = useEDAStore((s) => s.setMlConfig);

  const [targetColumn, setTargetColumn] = useState('');
  const [problemType, setProblemType] = useState('binary_classification');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    if (!targetColumn || !problemType) return;
    // Derive a simplified mlTask key and persist globally
    const mlTask = problemType === 'regression' ? 'regression'
      : problemType === 'multi_class_classification' ? 'multiclass'
      : 'classification';
    setMlConfig(mlTask, targetColumn, totalRows);
    setSchemaValid(true);
    setCurrentStep(3);
    setShowSuccess(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-full mb-3">
          <Target size={16} className="text-indigo-600" />
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
            Target Configuration
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-900">
          Map Your Target &amp; Identifier Columns
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-lg mx-auto leading-relaxed">
          Select the problem type and the column your model should predict. These configurations guide
          how the model optimizes and evaluates success during training.
        </p>
      </div>

      {/* Dropdowns */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
        {/* Target Column */}
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            <Target size={14} className="text-indigo-500" />
            Select Target Column (What are we predicting?)
          </label>
          <div className="relative">
            <select
              value={targetColumn}
              onChange={(e) => {
                setTargetColumn(e.target.value);
                setShowSuccess(false);
              }}
              className="w-full appearance-none border border-slate-300 rounded-lg px-4 py-3 pr-10 text-sm font-medium text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition cursor-pointer"
            >
              <option value="">— Choose a column —</option>
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Problem Type */}
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            <ActivitySquare size={14} className="text-emerald-500" />
            Machine Learning Problem Type
          </label>
          <div className="relative">
            <select
              value={problemType}
              onChange={(e) => {
                setProblemType(e.target.value);
                setShowSuccess(false);
              }}
              className="w-full appearance-none border border-slate-300 rounded-lg px-4 py-3 pr-10 text-sm font-medium text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition cursor-pointer"
            >
              <option value="binary_classification">Binary Classification (e.g., Target is 0/1, Yes/No, Benign/Malignant)</option>
              <option value="multi_class_classification">Multi-class Classification (e.g., Target is Category A/B/C)</option>
              <option value="regression">Regression (e.g., Target is a continuous number like Blood Pressure)</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!targetColumn || schemaValid}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all shadow-sm
            ${
              schemaValid
                ? 'bg-emerald-600 text-white cursor-default'
                : targetColumn
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md active:scale-[0.98] cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
        >
          {schemaValid ? (
            <>
              <CheckCircle2 size={18} />
              Mapping Saved — Step 3 Unlocked
            </>
          ) : (
            <>
              <Save size={18} />
              Save Mapping &amp; Unlock Step 3
            </>
          )}
        </button>
      </div>

      {/* Success Toast */}
      {showSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 shadow-sm animate-in">
          <div className="p-1.5 bg-emerald-100 rounded-lg">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-900">Target Mapping Saved Successfully</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Target: <strong>{targetColumn}</strong>
              {' '}· Type: <strong>
                {problemType === 'binary_classification' ? 'Binary Classification' : 
                 problemType === 'multi_class_classification' ? 'Multi-class Classification' : 'Regression'}
              </strong>
              {' '}— Step 3: Data Preparation is now available.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TargetMappingTab;
