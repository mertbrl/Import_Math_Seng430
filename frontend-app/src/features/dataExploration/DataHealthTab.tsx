import React from 'react';
import type { SummaryStats, Alert } from './mockEDAData';
import {
  BarChart3,
  Database,
  AlertTriangle,
  Rows3,
  Columns3,
  HardDrive,
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
}

const DataHealthTab: React.FC<DataHealthTabProps> = ({ summary, alerts }) => {


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
            icon={<HardDrive size={18} />}
            label="Total Size in Memory"
            value={summary.totalMemory}
          />
          <StatCard
            icon={<Database size={18} />}
            label="Variable Types"
            value=""
            sub={`Numeric: ${summary.variableTypes.Numeric} · Categorical: ${summary.variableTypes.Categorical} · Boolean: ${summary.variableTypes.Boolean}`}
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

      {/* Smart Alerts */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-amber-600" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Smart Alerts &amp; Red Flags
          </h3>
        </div>

        <div className="space-y-3">
          {alerts.map((alert, i) => {
            const bgMap = {
              warning: 'bg-yellow-50 border-yellow-200',
              severe: 'bg-red-50 border-red-200',
              info: 'bg-blue-50 border-blue-200',
            };
            const textMap = {
              warning: 'text-yellow-900',
              severe: 'text-red-900',
              info: 'text-blue-900',
            };
            const titleMap = {
              warning: 'text-yellow-950',
              severe: 'text-red-950',
              info: 'text-blue-950',
            };

            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-4 rounded-xl border ${bgMap[alert.severity]} shadow-sm`}
              >
                <span className="text-lg leading-none mt-0.5 shrink-0">{alert.icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${titleMap[alert.severity]} mb-0.5`}>
                    {alert.title}
                  </p>
                  <p className={`text-[13px] ${textMap[alert.severity]} leading-relaxed`}>
                    {alert.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DataHealthTab;
