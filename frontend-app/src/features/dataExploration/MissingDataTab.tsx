import React from 'react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';
import type { MissingColumnAnalysis } from './mockEDAData';

const MECHANISM_META = {
  MCAR: {
    label: 'MCAR',
    full: 'Missing Completely At Random',
    shell: 'border-[rgba(14,116,82,0.18)] bg-[linear-gradient(180deg,#eef8f2,#fbfefc)]',
    badge: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
    icon: <CheckCircle size={14} className="text-emerald-600" />,
  },
  MAR: {
    label: 'MAR',
    full: 'Missing At Random',
    shell: 'border-[rgba(194,113,34,0.18)] bg-[linear-gradient(180deg,#fff9ef,#fffdf9)]',
    badge: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500',
    icon: <Info size={14} className="text-amber-500" />,
  },
  MNAR: {
    label: 'MNAR',
    full: 'Missing Not At Random',
    shell: 'border-[rgba(186,26,26,0.18)] bg-[linear-gradient(180deg,#fff5f3,#fffafb)]',
    badge: 'bg-red-100 text-red-700',
    bar: 'bg-red-500',
    icon: <AlertTriangle size={14} className="text-red-500" />,
  },
} as const;

interface MissingDataTabProps {
  missingAnalysis: MissingColumnAnalysis[];
  totalRows: number;
  allColumns: string[];
}

const MissingDataTab: React.FC<MissingDataTabProps> = ({ missingAnalysis, totalRows, allColumns }) => {
  if (missingAnalysis.length === 0) {
    return (
      <div className="rounded-[20px] border border-[rgba(14,116,82,0.18)] bg-[linear-gradient(180deg,#eef8f2,#fbfefc)] py-20 text-center shadow-[0_10px_26px_rgba(14,116,82,0.04)]">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-[rgba(14,116,82,0.14)] bg-white shadow-sm">
          <CheckCircle size={22} className="text-[var(--accent)]" />
        </div>
        <p className="text-[16px] font-bold text-[var(--text)]">No missing data detected</p>
        <p className="mt-2 text-sm leading-7 text-[var(--text2)]">
          Every cell in this dataset has a value. No imputation is required.
        </p>
      </div>
    );
  }

  const missingColNames = new Set(missingAnalysis.map((m) => m.column));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--surface2)] text-[var(--accent)]">
          <ShieldAlert size={18} />
        </div>
        <div>
          <p className="ha-section-label">Missing Value Analysis</p>
          <h3 className="mt-1 text-[18px] font-bold text-[var(--text)]">
            {missingAnalysis.length} affected column{missingAnalysis.length > 1 ? 's' : ''}
          </h3>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(MECHANISM_META).map(([key, meta]) => (
          <div key={key} className={`rounded-[18px] border p-4 shadow-sm ${meta.shell}`}>
            <div className="flex items-start gap-2.5">
              {meta.icon}
              <div>
                <p className="text-[12px] font-bold tracking-[0.02em] text-[var(--text)]">{meta.label}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--text2)]">{meta.full}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {missingAnalysis.map((column) => {
          const meta = MECHANISM_META[column.mechanism] ?? MECHANISM_META.MCAR;
          const barWidth = Math.min(100, column.missingPct);

          return (
            <div
              key={column.column}
              className={`rounded-[20px] border bg-white p-5 shadow-[0_10px_26px_rgba(14,116,82,0.05)] ${meta.shell}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold text-[var(--text)]">{column.column}</span>
                    <span className="ha-badge bg-slate-100 text-slate-700">{column.type}</span>
                    <span className={`ha-badge ${meta.badge}`}>{meta.label}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text2)]">{column.mechanismDetail}</p>
                </div>

                <div className="rounded-[14px] border border-[rgba(190,201,193,0.42)] bg-white/80 px-4 py-3 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text3)]">Missing</p>
                  <p className="mt-1 text-[15px] font-semibold text-[var(--text)]">
                    {column.missingCount.toLocaleString()} ({column.missingPct}%)
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface2)]">
                  <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${barWidth}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-[var(--text3)]">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="mt-4 rounded-[16px] border border-[rgba(190,201,193,0.34)] bg-white/72 px-4 py-3 text-[13px] leading-6 text-[var(--text2)]">
                {column.mechanism === 'MCAR' && (
                  <>
                    <strong className="text-[var(--text)]">Recommendation:</strong> Mean or median imputation is usually safe here because the missing pattern appears random.
                  </>
                )}
                {column.mechanism === 'MAR' && (
                  <>
                    <strong className="text-[var(--text)]">Recommendation:</strong> Use stronger imputation logic such as model-based or multiple imputation because missingness is associated with other observed variables.
                  </>
                )}
                {column.mechanism === 'MNAR' && (
                  <>
                    <strong className="text-[var(--text)]">Recommendation:</strong> Do not impute blindly. Missingness may carry signal, so consider using an explicit missing-indicator feature.
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[rgba(190,201,193,0.42)] bg-white shadow-[0_10px_26px_rgba(14,116,82,0.04)]">
        <div className="border-b border-[rgba(190,201,193,0.42)] bg-[linear-gradient(180deg,#f7faf7,#f1f5f1)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ha-section-label">Missingness Pattern Matrix</span>
            <span className="text-[10px] text-[var(--text3)]">(first 50 rows)</span>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <div className="mb-1 flex gap-px">
            <div className="w-8 shrink-0" />
            {allColumns.map((column) => (
              <div
                key={column}
                className={`flex-1 truncate pb-1 text-center text-[8px] font-bold uppercase tracking-wide ${
                  missingColNames.has(column) ? 'text-amber-700' : 'text-[var(--text3)]'
                }`}
                title={column}
              >
                {column.length > 5 ? `${column.slice(0, 5)}…` : column}
              </div>
            ))}
          </div>

          {Array.from({ length: Math.min(50, totalRows) }, (_, rowIdx) => (
            <div key={rowIdx} className="mb-px flex gap-px">
              {rowIdx % 10 === 0 ? (
                <div className="w-8 shrink-0 pr-1 pt-0.5 text-right font-mono text-[8px] leading-3 text-[var(--text3)]">
                  {rowIdx}
                </div>
              ) : (
                <div className="w-8 shrink-0" />
              )}
              {allColumns.map((column) => {
                const analysis = missingAnalysis.find((item) => item.column === column);
                const isMissing = analysis?.missingRows.includes(rowIdx) ?? false;
                return (
                  <div
                    key={`${column}-${rowIdx}`}
                    className={`h-2.5 flex-1 rounded-[2px] ${isMissing ? 'bg-amber-400' : 'bg-emerald-100'}`}
                    title={isMissing ? `${column}: missing (row ${rowIdx + 1})` : `${column}: present`}
                  />
                );
              })}
            </div>
          ))}

          <div className="mt-3 flex items-center gap-5 text-[10px] text-[var(--text3)]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-3 rounded-[2px] bg-emerald-100" />
              Present value
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-3 rounded-[2px] bg-amber-400" />
              Missing value
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissingDataTab;
