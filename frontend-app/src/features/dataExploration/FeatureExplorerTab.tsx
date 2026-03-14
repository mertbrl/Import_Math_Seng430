import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ColumnStats } from './mockEDAData';
import { Search, Hash, Type, ToggleLeft, AlertTriangle, AlertCircle, Tag } from 'lucide-react';

const typeIcon = (type: string) => {
  switch (type) {
    case 'Numeric': return <Hash size={12} className="text-indigo-500" />;
    case 'Categorical': return <Type size={12} className="text-emerald-500" />;
    case 'Boolean': return <ToggleLeft size={12} className="text-amber-500" />;
    default: return null;
  }
};

/** Determine smart indicator badges for a column */
function getColumnBadges(col: ColumnStats): { label: string; color: string; icon: React.ReactNode }[] {
  const badges: { label: string; color: string; icon: React.ReactNode }[] = [];

  // High missingness (≥10%)
  if (col.missingPct >= 10) {
    badges.push({
      label: 'Missing',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: <AlertTriangle size={10} />,
    });
  }

  // Class imbalance for boolean/target columns (>80/20 split)
  if (col.type === 'Boolean' && col.distribution.length === 2) {
    const total = col.distribution.reduce((s, d) => s + d.value, 0);
    const maxPct = Math.max(...col.distribution.map((d) => d.value / total));
    if (maxPct > 0.8) {
      badges.push({
        label: 'Imbalance',
        color: 'text-red-700 bg-red-50 border-red-200',
        icon: <AlertCircle size={10} />,
      });
    }
  }

  // High cardinality for categorical columns (>50 distinct)
  if (col.type === 'Categorical' && col.distinct > 50) {
    badges.push({
      label: 'High Card.',
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      icon: <Tag size={10} />,
    });
  }

  // High outliers
  if ((col.outliersCount ?? 0) > 0) {
    badges.push({
      label: `${col.outliersCount} Outliers`,
      color: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200',
      icon: <AlertCircle size={10} />,
    });
  }

  // Highly skewed (> |1|)
  if (col.skewness && Math.abs(col.skewness) > 1) {
    badges.push({
      label: 'Skewed',
      color: 'text-purple-700 bg-purple-50 border-purple-200',
      icon: <AlertTriangle size={10} />,
    });
  }

  return badges;
}

const BAR_COLORS = [
  '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe',
  '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe',
];

const MiniStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500 font-medium">{label}</span>
    <span className="text-xs font-bold text-slate-800 font-mono">{value}</span>
  </div>
);

interface FeatureExplorerTabProps {
  columns: ColumnStats[];
}

const FeatureExplorerTab: React.FC<FeatureExplorerTabProps> = ({ columns }) => {
  const [selectedCol, setSelectedCol] = useState<ColumnStats>(columns[0]);

  const [search, setSearch] = useState('');

  const filtered = columns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[480px]">
      {/* Left Sidebar — Column List */}
      <div className="w-full lg:w-64 shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[420px]">
          {filtered.map((col) => {
            const active = col.name === selectedCol.name;
            const badges = getColumnBadges(col);
            return (
              <button
                key={col.name}
                onClick={() => setSelectedCol(col)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-medium transition-colors border-b border-slate-50 ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 border-l-2 border-l-indigo-500'
                    : 'text-slate-700 hover:bg-slate-50 border-l-2 border-l-transparent'
                }`}
              >
                {typeIcon(col.type)}
                <span className="truncate flex-1 min-w-0">{col.name}</span>
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  {badges.map((b, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${b.color}`}
                    >
                      {b.icon} {b.label}
                    </span>
                  ))}
                  {col.missingPct > 0 && col.missingPct < 10 && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-semibold">
                      {col.missingPct}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Main Area — Distribution Chart + Stats */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-bold text-slate-900">{selectedCol.name}</h4>
              <span className="text-[11px] text-slate-500 font-medium">
                Distribution · {selectedCol.type} · {selectedCol.distribution.length} bins
              </span>
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                selectedCol.type === 'Numeric'
                  ? 'bg-indigo-50 text-indigo-600'
                  : selectedCol.type === 'Categorical'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              {selectedCol.type}
            </span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={selectedCol.distribution} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#f8fafc',
                  fontSize: '12px',
                  padding: '8px 12px',
                }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={600}>
                {selectedCol.distribution.map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Mini-Stats Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Column Statistics
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-0">
            {selectedCol.type === 'Numeric' ? (
              <>
                <MiniStat label="Min" value={selectedCol.min?.toLocaleString() ?? '—'} />
                <MiniStat label="Max" value={selectedCol.max?.toLocaleString() ?? '—'} />
                <MiniStat label="Mean" value={selectedCol.mean?.toFixed(2) ?? '—'} />
                <MiniStat label="Std Dev" value={selectedCol.stdDev?.toFixed(2) ?? '—'} />
                <MiniStat label="Skewness" value={selectedCol.skewness?.toFixed(2) ?? '—'} />
                <MiniStat label="Kurtosis" value={selectedCol.kurtosis?.toFixed(2) ?? '—'} />
                <MiniStat label="Outliers" value={selectedCol.outliersCount === undefined ? '—' : selectedCol.outliersCount.toLocaleString()} />
                <MiniStat label="Zeros (%)" value={`${selectedCol.zerosPct ?? 0}%`} />
                <MiniStat label="Negative (%)" value={`${selectedCol.negativePct ?? 0}%`} />
                <MiniStat label="Distinct" value={selectedCol.distinct.toLocaleString()} />
                <MiniStat label="Missing" value={`${selectedCol.missing} (${selectedCol.missingPct}%)`} />
              </>
            ) : (
              <>
                <MiniStat label="Distinct" value={selectedCol.distinct} />
                <MiniStat label="Missing" value={`${selectedCol.missing} (${selectedCol.missingPct}%)`} />
                <MiniStat label="Type" value={selectedCol.type} />
                <MiniStat label="Categories" value={selectedCol.distribution.length} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureExplorerTab;
