import React from 'react';
import { useEDAStore } from '../../store/useEDAStore';
import { ArrowRight, Search, SlidersHorizontal, Table, X } from 'lucide-react';
import DataPreviewTab from './DataPreviewTab';

const PreAnalysisPreview: React.FC = () => {
  const { rawFile, rawHeaders, rawPreviewRows, setPreviewAccepted, clearConfig } = useEDAStore();

  const hasPreview = !!rawFile && rawHeaders.length > 0;

  return (
    <div className="ha-step2-preview-panel animate-fade-in-up">
      <div className="ha-step2-preview-head">
        <div>
          <p className="ha-step2-panel-label">Data Preview</p>
          <h3>{hasPreview ? `Preview of ${rawFile.name}` : 'Data table preview'}</h3>
        </div>
        <div className="ha-step2-preview-actions" aria-hidden="true">
          <button type="button">
            <SlidersHorizontal size={14} />
          </button>
          <button type="button">
            <Search size={14} />
          </button>
        </div>
      </div>

      <div className="ha-step2-preview-content">
        {hasPreview ? (
          <DataPreviewTab preview={{ headers: rawHeaders, rows: rawPreviewRows }} compact />
        ) : (
          <div className="ha-step2-preview-empty">
            <Table size={26} />
            <p>Upload a dataset to display preview rows.</p>
          </div>
        )}
      </div>

      <div className="ha-step2-preview-footer">
        <span>{hasPreview ? `Showing ${rawPreviewRows.length} rows for pre-check.` : 'No dataset selected yet.'}</span>
        <div className="flex items-center gap-3">
          <button onClick={() => clearConfig()} className="ha-button-secondary inline-flex items-center justify-center gap-2">
            <X size={15} />
            Cancel
          </button>
          <button
            onClick={() => setPreviewAccepted(true)}
            disabled={!hasPreview}
            className={hasPreview ? 'ha-button-primary inline-flex items-center justify-center gap-2' : 'ha-button-locked inline-flex items-center justify-center gap-2'}
          >
            Next: Configure Columns
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreAnalysisPreview;
