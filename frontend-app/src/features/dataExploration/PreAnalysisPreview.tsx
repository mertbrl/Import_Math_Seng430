import React from 'react';
import { useEDAStore } from '../../store/useEDAStore';
import { Database, ArrowRight, X } from 'lucide-react';
import DataPreviewTab from './DataPreviewTab';

const PreAnalysisPreview: React.FC = () => {
  const { rawFile, rawHeaders, rawPreviewRows, setPreviewAccepted, clearConfig } = useEDAStore();

  if (!rawFile || rawHeaders.length === 0) return null;

  return (
    <div className="ha-card p-6 sm:p-8 animate-fade-in-up">
      <div className="flex items-start gap-4 mb-6">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface2)] text-[var(--accent)] shrink-0">
          <Database size={24} />
        </div>
        <div>
          <p className="ha-section-label">Data Preview</p>
          <h3 className="mt-2 font-[var(--font-display)] text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">
            We successfully loaded <strong className="text-[var(--text)]">{rawFile.name}</strong>.
          </h3>
          <p className="ha-body mt-2 max-w-2xl">
            Below is a preview of the first {rawPreviewRows.length} rows. Please verify that the data looks correct before proceeding to configuration.
          </p>
        </div>
      </div>

      <div className="mb-6 -mx-2 sm:mx-0">
        <DataPreviewTab preview={{ headers: rawHeaders, rows: rawPreviewRows }} compact />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[var(--border)] pt-5">
        <div className="text-sm font-semibold text-[var(--text2)]">
          Showing {rawPreviewRows.length} rows for preview.
        </div>
        <div className="flex w-full sm:w-auto items-center gap-3">
          <button
            onClick={() => clearConfig()}
            className="ha-button-secondary flex-1 sm:flex-none inline-flex items-center justify-center gap-2"
          >
            <X size={16} />
            Cancel
          </button>
          <button
            onClick={() => setPreviewAccepted(true)}
            className="ha-button-primary flex-1 sm:flex-none inline-flex items-center justify-center gap-2"
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
