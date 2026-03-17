import React from 'react';
import { useEDAStore } from '../../store/useEDAStore';
import { Database, ArrowRight, X } from 'lucide-react';
import DataPreviewTab from './DataPreviewTab';

const PreAnalysisPreview: React.FC = () => {
  const { rawFile, rawHeaders, rawPreviewRows, setPreviewAccepted, clearConfig } = useEDAStore();

  if (!rawFile || rawHeaders.length === 0) return null;

  return (
    <div className="bg-white border-2 border-indigo-100 rounded-2xl p-6 shadow-md animate-fade-in-up">
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
          <Database size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Data Preview</h3>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            We successfully loaded <strong className="text-slate-800">{rawFile.name}</strong>. 
            Below is a preview of the first {rawPreviewRows.length} rows. Please verify that the data looks correct before proceeding to configuration.
          </p>
        </div>
      </div>

      <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="p-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <DataPreviewTab preview={{ headers: rawHeaders, rows: rawPreviewRows }} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-5">
        <div className="text-sm text-slate-500">
          Showing {rawPreviewRows.length} rows for preview.
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => clearConfig()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <X size={16} />
            Cancel
          </button>
          <button
            onClick={() => setPreviewAccepted(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm active:scale-95 transition"
          >
            Next: Configure Columns
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreAnalysisPreview;
