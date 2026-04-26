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
    <div className="ha-step2-config-card animate-fade-in-up">
      <div className="mb-6 flex items-start gap-4">
        <div className="ha-step2-config-icon">
          <Database size={22} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--text)]">Pre-Analysis Configuration</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text2)]">
            We detected <strong className="text-[var(--text)]">{rawHeaders.length} columns</strong> in
            <strong className="text-[var(--text)]"> {rawFile.name}</strong>. Tag any identifier or non-clinical
            metadata columns to exclude them from correlation mapping.
          </p>
        </div>
      </div>

      <div className="ha-step2-config-grid-shell">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {rawHeaders.map((header) => {
            const isIgnored = ignoredColumns.includes(header);
            return (
              <button
                key={header}
                onClick={() => toggleIgnoreColumn(header)}
                className={`ha-step2-col-btn ${isIgnored ? 'is-ignored' : ''}`}
              >
                <span className="truncate pr-2" title={header}>
                  {header}
                </span>
                {isIgnored ? <EyeOff size={16} className="shrink-0" /> : <ShieldAlert size={16} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-5">
        <div className="text-sm text-[var(--text2)]">
          <strong className="text-[var(--text)]">{ignoredColumns.length}</strong> columns excluded from ML correlations.
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="ha-button-secondary px-5 py-2.5 text-sm font-semibold">
            Cancel
          </button>
          <button onClick={() => setPreviewAccepted(false)} className="ha-button-secondary px-5 py-2.5 text-sm font-semibold">
            Back
          </button>
          <button onClick={() => onConfirm(rawFile, ignoredColumns)} className="ha-button-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold">
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
