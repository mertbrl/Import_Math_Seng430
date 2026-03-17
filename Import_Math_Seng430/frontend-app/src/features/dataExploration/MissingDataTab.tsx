import React from 'react';
import { ShieldAlert, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import type { MissingColumnAnalysis } from './mockEDAData';

interface MissingDataTabProps {
  missingAnalysis: MissingColumnAnalysis[];
  totalRows: number;
}

const MECHANISM_META = {
  MCAR: {
    label: 'MCAR',
    full: 'Missing Completely At Random',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: <CheckCircle size={14} className="text-emerald-600" />,
  },
  MAR: {
    label: 'MAR',
    full: 'Missing At Random',
    color: 'bg-amber-50 border-amber-200 text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
    icon: <Info size={14} className="text-amber-500" />,
  },
  MNAR: {
    label: 'MNAR',
    full: 'Missing Not At Random',
    color: 'bg-red-50 border-red-200 text-red-800',
    badge: 'bg-red-100 text-red-700',
    icon: <AlertTriangle size={14} className="text-red-500" />,
  },
};

interface MissingDataTabProps {
  missingAnalysis: MissingColumnAnalysis[];
  totalRows: number;
  allColumns: string[];
}

const MissingDataTab: React.FC<MissingDataTabProps> = ({
  missingAnalysis,
  totalRows,
  allColumns,
}) => {
  if (missingAnalysis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <CheckCircle size={44} className="text-emerald-400" />
        <div className="text-center">
          <p className="text-sm font-bold text-slate-700">No Missing Data</p>
          <p className="text-xs text-slate-500 mt-1">
            Every cell in this dataset has a value — no imputation required.
          </p>
        </div>
      </div>
    );
  }

  const missingColNames = new Set(missingAnalysis.map((m) => m.column));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-amber-600" />
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Missing Value &amp; Mechanism Analysis
        </h3>
        <span className="ml-2 text-[11px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2.5 py-0.5 font-semibold">
          {missingAnalysis.length} column{missingAnalysis.length > 1 ? 's' : ''} affected
        </span>
      </div>

      {/* Mechanism legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {Object.entries(MECHANISM_META).map(([key, m]) => (
          <div
            key={key}
            className={`flex items-start gap-2 p-3 rounded-xl border ${m.color}`}
          >
            {m.icon}
            <div>
              <span className="font-bold">{m.label}</span> — {m.full}
            </div>
          </div>
        ))}
      </div>

      {/* Per-column cards */}
      <div className="space-y-4">
        {missingAnalysis.map((col) => {
          const meta = MECHANISM_META[col.mechanism] ?? MECHANISM_META.MCAR;
          const barWidth = Math.min(100, col.missingPct);

          return (
            <div
              key={col.column}
              className={`rounded-xl border p-4 space-y-3 ${meta.color} bg-white border-slate-200`}
            >
              {/* Top row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800">{col.column}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-semibold">
                    {col.type}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${meta.badge}`}>
                    {meta.label}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {col.missingCount.toLocaleString()} missing ({col.missingPct}%)
                </span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      col.mechanism === 'MCAR'
                        ? 'bg-emerald-400'
                        : col.mechanism === 'MAR'
                        ? 'bg-amber-400'
                        : 'bg-red-400'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Mechanism detail */}
              <p className="text-xs text-slate-600 leading-relaxed">
                {col.mechanismDetail}
              </p>

              {/* Recommendation */}
              <div className="text-[11px] bg-white/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-600">
                {col.mechanism === 'MCAR' && (
                  <><strong>Recommendation:</strong> Safe to apply <strong>mean/median imputation</strong> or drop rows — missing data is random and unbiased.</>
                )}
                {col.mechanism === 'MAR' && (
                  <><strong>Recommendation:</strong> Use <strong>multiple imputation</strong> or model-based imputation (e.g., MICE) — missingness is related to other observed features.</>
                )}
                {col.mechanism === 'MNAR' && (
                  <><strong>Recommendation:</strong> <strong>Do not impute blindly</strong> — missingness is informative. Consider adding a binary indicator feature for this column.</>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Missingness matrix */}
      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Missingness Pattern Matrix
          </span>
          <span className="text-[10px] text-slate-400">(first 50 rows)</span>
        </div>
        <div className="p-4 overflow-x-auto">
          {/* Header row */}
          <div className="flex gap-px mb-1">
            <div className="w-8 shrink-0" />
            {allColumns.map((col) => (
              <div
                key={col}
                className={`flex-1 text-center text-[8px] font-bold uppercase tracking-wide rotate-0 pb-1 truncate ${
                  missingColNames.has(col) ? 'text-amber-600' : 'text-slate-400'
                }`}
                title={col}
              >
                {col.length > 5 ? col.slice(0, 5) + '…' : col}
              </div>
            ))}
          </div>

          {/* Rows: each row = one observation index */}
          {Array.from({ length: Math.min(50, totalRows) }, (_, rowIdx) => (
            <div key={rowIdx} className="flex gap-px mb-px">
              {rowIdx % 10 === 0 && (
                <div className="w-8 shrink-0 text-[8px] text-slate-300 font-mono leading-3 text-right pr-1 pt-0.5">
                  {rowIdx}
                </div>
              )}
              {rowIdx % 10 !== 0 && <div className="w-8 shrink-0" />}
              {allColumns.map((col) => {
                const analysis = missingAnalysis.find((m) => m.column === col);
                const isMissing = analysis?.missingRows.includes(rowIdx) ?? false;
                return (
                  <div
                    key={col}
                    className={`flex-1 h-2.5 rounded-[1px] transition-colors ${
                      isMissing ? 'bg-amber-400' : 'bg-indigo-200'
                    }`}
                    title={isMissing ? `${col}: MISSING (row ${rowIdx + 1})` : `${col}: present`}
                  />
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-5 mt-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-[1px] bg-indigo-200 inline-block" />
              Present value
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-[1px] bg-amber-400 inline-block" />
              Missing value
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissingDataTab;
