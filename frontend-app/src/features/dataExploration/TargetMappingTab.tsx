import React, { useMemo, useState } from 'react';
import type { ColumnStats } from './mockEDAData';
import { useDomainStore } from '../../store/useDomainStore';
import { useEDAStore } from '../../store/useEDAStore';
import { ActivitySquare, CheckCircle2, ChevronDown, Save, Target } from 'lucide-react';

interface TargetMappingTabProps {
  columns: ColumnStats[];
  totalRows: number;
}

const PROBLEM_TYPES = [
  {
    value: 'binary_classification',
    label: 'Binary Classification',
    detail: 'For 0/1, yes/no, positive/negative outcomes.',
  },
  {
    value: 'multi_class_classification',
    label: 'Multi-class Classification',
    detail: 'For three or more category outcomes.',
  },
  {
    value: 'regression',
    label: 'Regression',
    detail: 'For continuous numeric outcomes.',
  },
] as const;

const TYPE_TONES: Record<ColumnStats['type'], string> = {
  Numeric: 'bg-emerald-100 text-emerald-800',
  Categorical: 'bg-lime-100 text-lime-800',
  Boolean: 'bg-amber-100 text-amber-800',
};

const TargetMappingTab: React.FC<TargetMappingTabProps> = ({ columns, totalRows }) => {
  const setSchemaValid = useDomainStore((s) => s.setSchemaValid);
  const setCurrentStep = useDomainStore((s) => s.setCurrentStep);
  const schemaValid = useDomainStore((s) => s.schemaValid);
  const persistedTargetColumn = useEDAStore((s) => s.targetColumn);
  const persistedTask = useEDAStore((s) => s.mlTask);
  const setMlConfig = useEDAStore((s) => s.setMlConfig);

  const initialProblemType =
    persistedTask === 'regression'
      ? 'regression'
      : persistedTask === 'multiclass'
        ? 'multi_class_classification'
        : 'binary_classification';

  const [targetColumn, setTargetColumn] = useState(persistedTargetColumn || '');
  const [problemType, setProblemType] = useState<
    'binary_classification' | 'multi_class_classification' | 'regression'
  >(initialProblemType);
  const [showSuccess, setShowSuccess] = useState(false);

  const selectedColumnMeta = useMemo(
    () => columns.find((column) => column.name === targetColumn) ?? null,
    [columns, targetColumn],
  );
  const persistedProblemType =
    persistedTask === 'regression'
      ? 'regression'
      : persistedTask === 'multiclass'
        ? 'multi_class_classification'
        : 'binary_classification';
  const hasMappingChanged = targetColumn !== (persistedTargetColumn || '') || problemType !== persistedProblemType;
  const isSaveDisabled = !targetColumn || (schemaValid && !hasMappingChanged);

  const handleSave = () => {
    if (!targetColumn || !problemType) return;
    const mlTask =
      problemType === 'regression'
        ? 'regression'
        : problemType === 'multi_class_classification'
          ? 'multiclass'
          : 'classification';

    setMlConfig(mlTask, targetColumn, totalRows);
    setSchemaValid(true);
    setCurrentStep(3);
    setShowSuccess(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="ha-card p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="ha-section-label">Target Configuration</p>
            <h3 className="mt-2 font-[var(--font-display)] text-[24px] font-bold tracking-[-0.05em] text-[var(--text)]">
              Define the prediction target before preprocessing
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--text2)]">
              Choose the outcome column and the learning objective. This mapping determines how later steps train,
              validate, and score the model.
            </p>
          </div>

          <div className="ha-target-map-scope rounded-[18px] border border-[rgba(190,201,193,0.5)] bg-[linear-gradient(180deg,#ffffff,#f5faf6)] px-5 py-4 shadow-[0_10px_26px_rgba(14,116,82,0.05)]">
            <p className="ha-section-label">Dataset Scope</p>
            <p className="mt-2 text-sm font-semibold text-[var(--text)]">
              {totalRows.toLocaleString()} rows · {columns.length} candidate columns
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
        <div className="ha-card space-y-5 p-6 sm:p-7">
          <div>
            <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text2)]">
              <Target size={14} className="text-[var(--accent)]" />
              Target Column
            </label>
            <div className="relative">
              <select
                value={targetColumn}
                onChange={(e) => {
                  setTargetColumn(e.target.value);
                  setShowSuccess(false);
                }}
                className="ha-target-map-select w-full appearance-none rounded-[16px] border border-[rgba(190,201,193,0.7)] bg-[linear-gradient(180deg,#ffffff,#f6faf6)] px-4 py-3.5 pr-11 text-[14px] font-semibold text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[rgba(0,89,62,0.08)]"
              >
                <option value="">Choose the outcome column</option>
                {columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name} ({column.type})
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text2)]">
              <ActivitySquare size={14} className="text-[var(--accent)]" />
              ML Problem Type
            </label>
            <div className="relative">
              <select
                value={problemType}
                onChange={(e) => {
                  setProblemType(e.target.value as typeof problemType);
                  setShowSuccess(false);
                }}
                className="ha-target-map-select w-full appearance-none rounded-[16px] border border-[rgba(190,201,193,0.7)] bg-[linear-gradient(180deg,#ffffff,#f6faf6)] px-4 py-3.5 pr-11 text-[14px] font-semibold text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[rgba(0,89,62,0.08)]"
              >
                {PROBLEM_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
            </div>
            <p className="mt-3 text-sm text-[var(--text2)]">
              {PROBLEM_TYPES.find((item) => item.value === problemType)?.detail}
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className={
              isSaveDisabled
                ? 'ha-button-locked inline-flex w-full items-center justify-center gap-2'
                : targetColumn
                  ? 'ha-button-primary inline-flex w-full items-center justify-center gap-2'
                  : 'ha-button-locked inline-flex w-full items-center justify-center gap-2'
            }
          >
            {schemaValid && !hasMappingChanged ? (
              <>
                <CheckCircle2 size={18} />
                Mapping Saved
              </>
            ) : (
              <>
                <Save size={18} />
                Save Mapping and Continue
              </>
            )}
          </button>
        </div>

        <div className="ha-card space-y-4 p-6">
          <p className="ha-section-label">Selection Summary</p>

          <div className="ha-target-map-summary-card rounded-[16px] border border-[rgba(190,201,193,0.48)] bg-[linear-gradient(180deg,#ffffff,#f6faf6)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text3)]">Target</p>
            <p className="mt-2 text-[16px] font-semibold text-[var(--text)]">
              {selectedColumnMeta?.name || 'No target selected yet'}
            </p>
            {selectedColumnMeta ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`ha-badge ${TYPE_TONES[selectedColumnMeta.type]}`}>{selectedColumnMeta.type}</span>
                <span className="ha-badge bg-slate-100 text-slate-700">
                  Distinct: {selectedColumnMeta.distinct}
                </span>
                <span className="ha-badge bg-slate-100 text-slate-700">
                  Missing: {selectedColumnMeta.missingPct}%
                </span>
              </div>
            ) : null}
          </div>

          <div className="ha-target-map-summary-card rounded-[16px] border border-[rgba(190,201,193,0.48)] bg-[linear-gradient(180deg,#ffffff,#f6faf6)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text3)]">Task</p>
            <p className="mt-2 text-[16px] font-semibold text-[var(--text)]">
              {PROBLEM_TYPES.find((item) => item.value === problemType)?.label}
            </p>
          </div>

          {showSuccess ? (
            <div className="ha-target-map-success rounded-[16px] border border-[rgba(14,116,82,0.24)] bg-[linear-gradient(180deg,#edf8f1,#e7f5ec)] p-4 text-sm text-[var(--text)]">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white text-[var(--accent)] shadow-sm">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="font-semibold">Target mapping saved successfully.</p>
                  <p className="mt-1 text-[13px] leading-6 text-[var(--text2)]">
                    Step 3 is now unlocked with <strong>{targetColumn}</strong> configured as the prediction target.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TargetMappingTab;
