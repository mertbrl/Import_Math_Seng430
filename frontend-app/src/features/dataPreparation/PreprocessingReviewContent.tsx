import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, GitBranch } from 'lucide-react';
import type { PreprocessingReviewResponse } from '../../api/dataPrepAPI';
import DataPreviewTab from '../dataExploration/DataPreviewTab';
import CorrelationTab from '../dataExploration/CorrelationTab';

function useAnimatedNumber(target: number, duration = 1000) {
  const [value, setValue] = useState(target);

  useEffect(() => {
    const start = performance.now();
    const origin = value;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(origin + (target - origin) * eased);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

const DeltaCard: React.FC<{
  label: string;
  before: number;
  after: number;
}> = ({ label, before, after }) => {
  const animated = useAnimatedNumber(after);
  const delta = after - before;
  const negative = delta < 0;

  return (
    <div className="ha-card p-5">
      <p className="ha-section-label">{label}</p>
      <div className="mt-4 flex items-end gap-3">
        <span className="font-[var(--font-display)] text-[30px] font-bold tracking-[-0.05em] text-[var(--text)]">
          {before}
        </span>
        <span className="text-xl text-[var(--text3)]">→</span>
        <span className="font-[var(--font-display)] text-[34px] font-bold tracking-[-0.05em] text-[var(--accent)]">
          {Math.round(animated)}
        </span>
      </div>
      <p className={`mt-3 text-sm font-semibold ${negative ? 'text-rose-700' : 'text-emerald-700'}`}>
        {negative ? '' : '+'}
        {delta} {label.toLowerCase()}
      </p>
    </div>
  );
};

interface PreprocessingReviewContentProps {
  review: PreprocessingReviewResponse;
  targetColumn: string;
  title?: string;
  description?: string;
}

export const PreprocessingReviewContent: React.FC<PreprocessingReviewContentProps> = ({
  review,
  targetColumn,
  title,
  description,
}) => {
  const [page, setPage] = useState(0);

  const keptColumns = useMemo(() => {
    const beforeSet = new Set(review.before.columns.map((column) => column.name));
    return review.after.columns
      .map((column) => column.name)
      .filter((columnName) => beforeSet.has(columnName))
      .slice(0, 8);
  }, [review.after.columns, review.before.columns]);

  const removedColumns = review.removedColumns.slice(0, 10);
  const extraRemoved = review.removedColumns.length - removedColumns.length;

  return (
    <div className="space-y-6">
      {(title || description) && (
        <div className="ha-card-muted p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[var(--accent)] shadow-sm">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              {title ? (
                <h3 className="font-[var(--font-display)] text-[26px] font-bold tracking-[-0.04em] text-[var(--text)]">
                  {title}
                </h3>
              ) : null}
              {description ? <p className="ha-body mt-2">{description}</p> : null}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <DeltaCard label="Rows" before={review.beforeShape[0]} after={review.afterShape[0]} />
        <DeltaCard label="Columns" before={review.beforeShape[1]} after={review.afterShape[1]} />
        <div className="ha-card p-5">
          <p className="ha-section-label">Target Column</p>
          <div className="mt-4 inline-flex rounded-[12px] border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-sm font-semibold text-[var(--text)]">
            {targetColumn}
          </div>
          <p className="mt-4 text-sm text-[var(--text2)]">
            Review confirms the final export keeps the prediction target aligned with the cleaned feature space.
          </p>
        </div>
      </div>

      <div className="ha-card p-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="ha-section-label">Column Diff</p>
            <h4 className="mt-2 text-lg font-bold text-[var(--text)]">Removed versus retained features</h4>
          </div>

          <div className="flex flex-wrap gap-2">
            {removedColumns.map((column) => (
              <span
                key={column}
                className="ha-badge border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700"
                style={{ textDecoration: 'line-through' }}
              >
                {column}
              </span>
            ))}
            {extraRemoved > 0 ? (
              <span className="ha-badge border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                +{extraRemoved} more removed
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {keptColumns.map((column) => (
              <span key={column} className="ha-badge border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                {column}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_84px_minmax(0,1fr)]">
        <div className="ha-card overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--surface2)] px-5 py-4">
            <p className="ha-section-label">Before</p>
          </div>
          <div className="p-5">
            <DataPreviewTab
              preview={review.before.preview}
              columns={review.before.columns}
              page={page}
              onPageChange={setPage}
              compact
              targetColumn={targetColumn}
            />
          </div>
        </div>

        <div className="hidden items-center justify-center xl:flex">
          <div className="grid h-16 w-16 place-items-center rounded-full border border-[var(--border)] bg-white shadow-sm">
            <ArrowRightLeft size={22} className="text-[var(--accent)]" />
          </div>
        </div>

        <div className="ha-card overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--surface2)] px-5 py-4">
            <p className="ha-section-label" style={{ color: 'var(--success)' }}>
              After
            </p>
          </div>
          <div className="p-5">
            <DataPreviewTab
              preview={review.after.preview}
              columns={review.after.columns}
              page={page}
              onPageChange={setPage}
              compact
              targetColumn={targetColumn}
            />
          </div>
        </div>
      </div>

      <div className="ha-card overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface2)] px-5 py-4">
          <div className="flex items-center gap-3">
            <GitBranch size={16} className="text-[var(--accent)]" />
            <div>
              <p className="ha-section-label">Correlation Review</p>
              <h4 className="mt-1 text-lg font-bold text-[var(--text)]">Final export correlations</h4>
            </div>
          </div>
        </div>
        <div className="p-5">
          <CorrelationTab
            numericColumnNames={review.after.numericColumnNames}
            correlationMatrix={review.after.correlationMatrix}
            showSuggestion={false}
            compact
          />
        </div>
      </div>
    </div>
  );
};
