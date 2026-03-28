import React from 'react';
import { useEDAStore } from '../../store/useEDAStore';
import { Database, EyeOff, Play, ShieldAlert, ArrowRight } from 'lucide-react';

interface ColumnConfiguratorProps {
  onConfirm: (file: File, ignoredColumns: string[]) => void;
  onCancel: () => void;
}

const ColumnConfigurator: React.FC<ColumnConfiguratorProps> = ({ onConfirm, onCancel }) => {
  const { rawFile, rawHeaders, ignoredColumns, toggleIgnoreColumn, setPreviewAccepted } = useEDAStore();

  if (!rawFile || rawHeaders.length === 0) return null;

  return (
    <div className="bg-white border-2 border-indigo-100 rounded-2xl p-6 shadow-md animate-fade-in-up">
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
          <Database size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Pre-Analysis Configuration</h3>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            We detected <strong className="text-slate-800">{rawHeaders.length} columns</strong> in 
            <strong className="text-slate-800"> {rawFile.name}</strong>. Before running the heavy EDA, 
            please <span className="font-semibold text-indigo-700">tag any Identifier (ID)</span> or 
            <span className="font-semibold text-indigo-700"> non-clinical Metadata columns</span>. 
            These will be explicitly excluded from the correlation mapping to prevent false insights.
          </p>
        </div>
      </div>

      {/* Columns Grid */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[300px] overflow-y-auto mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {rawHeaders.map((header) => {
            const isIgnored = ignoredColumns.includes(header);
            return (
              <button
                key={header}
                onClick={() => toggleIgnoreColumn(header)}
                className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all text-sm font-medium ${
                  isIgnored 
                    ? 'bg-slate-200 border-slate-300 text-slate-500 shadow-inner' 
                    : 'bg-white border-indigo-200 text-slate-800 hover:border-indigo-400 hover:shadow-sm'
                }`}
              >
                <span className="truncate pr-2" title={header}>{header}</span>
                {isIgnored ? (
                  <EyeOff size={16} className="text-slate-400 shrink-0" />
                ) : (
                  <ShieldAlert size={16} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-5">
        <div className="text-sm text-slate-500">
          <strong className="text-slate-700">{ignoredColumns.length}</strong> columns excluded from ML correlations.
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={() => setPreviewAccepted(false)}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition"
          >
            Back
          </button>
          <button
            onClick={() => onConfirm(rawFile, ignoredColumns)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm active:scale-95 transition"
          >
            <Play size={16} className="fill-current" />
            Run Full EDA
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnConfigurator;
