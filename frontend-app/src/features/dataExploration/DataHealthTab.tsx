import React, { useMemo } from 'react';
import type { SummaryStats, Alert } from './mockEDAData';
import { useEDAStore, detectMultimodality } from '../../store/useEDAStore';
import DataHealthAlerts from './DataHealthAlerts';
import {
  BarChart3,
  Database,
  AlertTriangle,
  Rows3,
  Columns3,
  Copy,
  Hash,
  ToggleLeft,
  Type,
} from 'lucide-react';

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}> = ({ icon, label, value, sub, accent = 'text-indigo-600' }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
    <div className={`p-2 rounded-lg bg-slate-50 border border-slate-100 ${accent}`}>
      {icon}
    </div>
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-xl font-bold text-slate-900 mt-0.5">{value}</span>
      {sub && <span className="text-xs text-slate-500 mt-0.5">{sub}</span>}
    </div>
  </div>
);

interface DataHealthTabProps {
  summary: SummaryStats;
  alerts: Alert[];
  columns: import('./mockEDAData').ColumnStats[];
  targetColumnName?: string;
}

const DataHealthTab: React.FC<DataHealthTabProps> = ({ summary, alerts, columns, targetColumnName }) => {
  const targetColumn =
    columns.find((column) => column.name === targetColumnName) ??
    columns[columns.length - 1];
  const targetDist = targetColumn?.distribution ?? [];
  const totalTargetCount = targetDist.reduce((s, d) => s + d.value, 0);

  // Compute advanced heuristic alerts dynamically on the frontend via useEDAStore
  const enrichedAlerts = useMemo(() => {
    let newAlerts = [...alerts];

    // 1. High Imbalance Detection
    if (targetColumn && targetColumn.type === 'Categorical' && targetDist.length > 0) {
      const highestClassCount = Math.max(...targetDist.map(d => d.value));
      const majorityPct = highestClassCount / totalTargetCount;
      if (majorityPct >= 0.9) {
        newAlerts.push({
          severity: 'severe',
          title: 'Extreme Class Imbalance',
          message: `The target variable '${targetColumn.name}' has a minority class of less than 10%. This will cause standard models to trivially guess the majority class and fail.`,
          icon: '⚖️'
        });
      }
    }

    // 2. Multimodal Form Detection
    const multimodalCols = columns.filter(col => detectMultimodality(col) === 'multimodal');
    if (multimodalCols.length > 0) {
      newAlerts.push({
        severity: 'warning',
        title: 'Multimodal Distributions Detected',
        message: `${multimodalCols.length} variables (e.g. ${multimodalCols[0].name}) have complex, multi-peaked distributions. Global linear models might struggle to fit this data effectively.`,
        icon: '📊'
      });
    }

    return newAlerts;
  }, [alerts, columns, targetColumn, targetDist, totalTargetCount]);

  const isClassImbalanceAlert = enrichedAlerts.some((a) => a.title.includes('Class Imbalance'));

  return (
    <div className="space-y-6">
      {/* Executive Summary Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Executive Summary
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard
            icon={<Columns3 size={18} />}
            label="Variables (Columns)"
            value={summary.numVariables}
          />
          <StatCard
            icon={<Rows3 size={18} />}
            label="Observations (Rows)"
            value={summary.numObservations.toLocaleString()}
          />
          <StatCard
            icon={<AlertTriangle size={18} />}
            label="Missing Cells"
            value={summary.missingCells.toLocaleString()}
            sub={`${summary.missingCellsPct}% of all data`}
            accent="text-amber-600"
          />
          <StatCard
            icon={<Copy size={18} />}
            label="Duplicate Rows"
            value={summary.duplicateRows}
            sub={`${summary.duplicateRowsPct}% of rows`}
          />
          <StatCard
            icon={<Database size={18} />}
            label="Total Data Source"
            value="Clean & Extracted"
            sub="Ready for pipeline"
          />
        </div>

        {/* Variable Types Breakdown Mini-Bars */}
        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
            Variable Type Breakdown
          </span>
          <div className="flex gap-2 h-3 rounded-full overflow-hidden bg-slate-100">
            <div
              className="bg-indigo-500 rounded-l-full transition-all"
              style={{ width: `${(summary.variableTypes.Numeric / summary.numVariables) * 100}%` }}
              title={`Numeric: ${summary.variableTypes.Numeric}`}
            />
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${(summary.variableTypes.Categorical / summary.numVariables) * 100}%` }}
              title={`Categorical: ${summary.variableTypes.Categorical}`}
            />
            <div
              className="bg-amber-500 rounded-r-full transition-all"
              style={{ width: `${(summary.variableTypes.Boolean / summary.numVariables) * 100}%` }}
              title={`Boolean: ${summary.variableTypes.Boolean}`}
            />
          </div>
          <div className="flex gap-5 mt-2.5 text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1.5">
              <Hash size={12} className="text-indigo-500" /> Numeric: {summary.variableTypes.Numeric}
            </span>
            <span className="flex items-center gap-1.5">
              <Type size={12} className="text-emerald-500" /> Categorical: {summary.variableTypes.Categorical}
            </span>
            <span className="flex items-center gap-1.5">
              <ToggleLeft size={12} className="text-amber-500" /> Boolean: {summary.variableTypes.Boolean}
            </span>
          </div>
        </div>
      </div>

      {/* ── Class Imbalance Panel ───────────────────────────────── */}
      {isClassImbalanceAlert && targetDist.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-orange-500" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Class Imbalance — Target Distribution
            </h3>
          </div>
          <div className="bg-white border border-orange-200 rounded-xl p-5 shadow-sm space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              Target variable <strong className="text-slate-800">{targetColumn.name}</strong> is imbalanced.
              Consider <strong>SMOTE</strong> or <strong>class-weight balancing</strong> in Step&nbsp;3.
            </p>
            <div className="space-y-2.5">
              {targetDist.map((cls) => {
                const pct = totalTargetCount > 0 ? Math.round((cls.value / totalTargetCount) * 100) : 0;
                const filled = Math.round(pct / 10);
                const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
                const isMajority = cls.value === Math.max(...targetDist.map((d) => d.value));
                return (
                  <div key={cls.label} className="flex items-center gap-3">
                    <span className={`text-[11px] font-bold min-w-[70px] truncate ${isMajority ? 'text-orange-700' : 'text-slate-600'}`}>
                      Class {cls.label}:
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isMajority ? 'bg-orange-400' : 'bg-indigo-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 min-w-[80px] shrink-0">
                      [{bar}] {pct}%
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">({cls.value.toLocaleString()})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Educational Alerts */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-amber-600" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Machine Learning Data Health Diagnostics
          </h3>
        </div>

        <DataHealthAlerts alerts={enrichedAlerts} />
      </div>
    </div>
  );
};

export default DataHealthTab;
