import React, { useEffect, useMemo, useState } from 'react';
import type { ColumnStats } from './mockEDAData';
import { AlertCircle, AlertTriangle, Hash, Search, Tag, ToggleLeft, Type, Waves } from 'lucide-react';
import { useDomainStore } from '../../store/useDomainStore';

const CHART_WIDTH = 760;
const CHART_HEIGHT = 280;
const PADDING = { top: 24, right: 18, bottom: 48, left: 48 };

const typeMeta: Record<ColumnStats['type'], { label: string; icon: React.ReactNode; tone: string }> = {
  Numeric: {
    label: 'Numeric',
    icon: <Hash size={12} />,
    tone: 'text-sky-700 bg-sky-100',
  },
  Categorical: {
    label: 'Categorical',
    icon: <Type size={12} />,
    tone: 'text-emerald-700 bg-emerald-100',
  },
  Boolean: {
    label: 'Boolean',
    icon: <ToggleLeft size={12} />,
    tone: 'text-amber-700 bg-amber-100',
  },
};

function getColumnBadges(column: ColumnStats) {
  const badges: Array<{ label: string; tone: string; icon: React.ReactNode }> = [];

  if (column.missingPct >= 10) {
    badges.push({
      label: `${column.missingPct}% Missing`,
      tone: 'text-amber-800 bg-amber-100',
      icon: <AlertTriangle size={10} />,
    });
  }

  if ((column.outliersCount ?? 0) > 0) {
    badges.push({
      label: `${column.outliersCount} Outliers`,
      tone: 'text-amber-800 bg-amber-100',
      icon: <AlertCircle size={10} />,
    });
  }

  if (column.skewness && Math.abs(column.skewness) > 1) {
    badges.push({
      label: 'Skewed',
      tone: 'text-orange-800 bg-orange-100',
      icon: <AlertTriangle size={10} />,
    });
  }

  if (column.type === 'Categorical' && column.distinct > 50) {
    badges.push({
      label: 'High Card.',
      tone: 'text-sky-800 bg-sky-100',
      icon: <Tag size={10} />,
    });
  }

  if (column.distributionShape === 'Bimodal' || column.distributionShape === 'Multimodal') {
    badges.push({
      label: column.distributionShape,
      tone: 'text-violet-800 bg-violet-100',
      icon: <Waves size={10} />,
    });
  }

  return badges;
}

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded-[16px] border border-[var(--border)] bg-white px-4 py-3 shadow-sm flex-1 min-w-[140px]">
    <p className="ha-section-label text-ellipsis whitespace-nowrap overflow-hidden">{label}</p> 
    <p className="mt-2 text-sm font-semibold text-[var(--text)]">{value}</p>
  </div>
);

interface FeatureExplorerTabProps {
  columns: ColumnStats[];
  showBadges?: boolean;
  selectedColumnName?: string;
  onSelectedColumnChange?: (columnName: string) => void;
  emptySelectionMessage?: string;
  compact?: boolean;
}

const FeatureExplorerTab: React.FC<FeatureExplorerTabProps> = ({
  columns,
  showBadges = true,
  selectedColumnName,
  onSelectedColumnChange,
  emptySelectionMessage = 'Select a feature to inspect its distribution.',
}) => {
  const [internalSelected, setInternalSelected] = useState(columns[0]?.name ?? '');
  const [search, setSearch] = useState('');
  const [hoveredBin, setHoveredBin] = useState<{ x: number; y: number; label: string; value: number } | null>(null);
  const userMode = useDomainStore((s) => s.userMode);
  const activeName = selectedColumnName ?? internalSelected;
  const selectedColumn = columns.find((column) => column.name === activeName) ?? null;

  useEffect(() => {
    if (selectedColumnName !== undefined) return;
    if (!columns.length) {
      setInternalSelected('');
      return;
    }
    if (!columns.some((column) => column.name === internalSelected)) {
      setInternalSelected(columns[0].name);
    }
  }, [columns, internalSelected, selectedColumnName]);

  const filteredColumns = useMemo(
    () => columns.filter((column) => column.name.toLowerCase().includes(search.toLowerCase())),
    [columns, search],
  );

  const handleSelectColumn = (columnName: string) => {
    if (selectedColumnName === undefined) {
      setInternalSelected(columnName);
    }
    onSelectedColumnChange?.(columnName);
  };

  const chart = useMemo(() => {
    if (!selectedColumn) return [];
    const maxValue = Math.max(...selectedColumn.distribution.map((entry) => entry.value), 1);
    const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
    const barGap = 12;
    const count = selectedColumn.distribution.length;
    const barWidth = Math.max(18, (plotWidth - barGap * (count - 1)) / count);

    return selectedColumn.distribution.map((entry, index) => {
      const x = PADDING.left + index * (barWidth + barGap);
      const barHeight = (entry.value / maxValue) * plotHeight;
      const y = CHART_HEIGHT - PADDING.bottom - barHeight;
      const opacity = 0.4 + (entry.value / maxValue) * 0.6;
      return { ...entry, x, y, width: barWidth, height: barHeight, opacity };
    });
  }, [selectedColumn]);

  const stats = useMemo(() => {
    if (!selectedColumn) return [];
    return [
      ['Min', selectedColumn.min?.toLocaleString() ?? '—'],
      ['Max', selectedColumn.max?.toLocaleString() ?? '—'],
      ['Mean', selectedColumn.mean?.toFixed(2) ?? '—'],
      ['Std Dev', selectedColumn.stdDev?.toFixed(2) ?? '—'],
      ['Skewness', selectedColumn.skewness?.toFixed(2) ?? '—'],
      ['Kurtosis', selectedColumn.kurtosis?.toFixed(2) ?? '—'],
      ['Outliers', selectedColumn.outliersCount?.toLocaleString() ?? '—'],
      ['Zeros %', `${selectedColumn.zerosPct ?? 0}%`],
      ['Negative %', `${selectedColumn.negativePct ?? 0}%`],
      ['Distinct', selectedColumn.distinct.toLocaleString()],
      ['Missing', `${selectedColumn.missing} (${selectedColumn.missingPct}%)`],
      ['Shape', selectedColumn.distributionShape ?? 'Unimodal'],
    ];
  }, [selectedColumn]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
      <aside className="ha-card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-4">
          <label className="relative block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search columns..."
              className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface2)] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[var(--accent)]"
            />
          </label>
        </div>

        <div className="ha-scrollbar-thin max-h-[620px] overflow-y-auto p-3">
          <div className="space-y-2">
            {filteredColumns.map((column) => {
              const active = column.name === activeName;
              const badges = getColumnBadges(column);
              return (
                <button
                  key={column.name}
                  type="button"
                  onClick={() => handleSelectColumn(column.name)}
                  className={`w-full rounded-[16px] border-l-[4px] px-4 py-4 text-left transition-all ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-sm'
                      : 'border-transparent bg-white hover:bg-[var(--surface2)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`ha-badge ${typeMeta[column.type].tone}`}>{typeMeta[column.type].icon}{typeMeta[column.type].label}</span>
                      </div>
                      <p className="mt-3 truncate font-[var(--font-display)] text-[18px] font-bold tracking-[-0.03em] text-[var(--text)]">
                        {column.name}
                      </p>
                    </div>
                  </div>

                  {showBadges && badges.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {badges.map((badge) => (
                        <span key={`${column.name}-${badge.label}`} className={`ha-badge ${badge.tone}`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="space-y-5">
        {!selectedColumn ? (
          <div className="ha-card flex min-h-[380px] items-center justify-center px-6 text-center text-sm text-[var(--text3)]">
            {emptySelectionMessage}
          </div>
        ) : (
          <>
            <div className="ha-card p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="ha-section-label">Distribution Profile</p>
                  <h3 className="mt-2 font-[var(--font-display)] text-[28px] font-bold tracking-[-0.05em] text-[var(--text)]">
                    {selectedColumn.name}
                  </h3>
                </div>
                <span className={`ha-badge ${typeMeta[selectedColumn.type].tone}`}>
                  {typeMeta[selectedColumn.type].icon}
                  {typeMeta[selectedColumn.type].label}
                </span>
              </div>

              <div className="relative mt-6 overflow-x-auto">
                <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full min-w-[620px]">
                  <line x1={PADDING.left} y1={CHART_HEIGHT - PADDING.bottom} x2={CHART_WIDTH - PADDING.right} y2={CHART_HEIGHT - PADDING.bottom} stroke="#cbd5e1" />
                  <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={CHART_HEIGHT - PADDING.bottom} stroke="#cbd5e1" />

                  {Array.from({ length: 4 }, (_, index) => {
                    const y = PADDING.top + ((CHART_HEIGHT - PADDING.top - PADDING.bottom) / 3) * index;
                    return (
                      <line
                        key={index}
                        x1={PADDING.left}
                        y1={y}
                        x2={CHART_WIDTH - PADDING.right}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray="4 6"
                      />
                    );
                  })}

                  {chart.map((bar) => (
                    <g key={bar.label}>
                      <rect
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        rx={8}
                        fill={`rgba(26, 86, 219, ${bar.opacity})`}
                        onMouseEnter={() =>
                          setHoveredBin({
                            x: bar.x + bar.width / 2,
                            y: bar.y,
                            label: bar.label,
                            value: bar.value,
                          })
                        }
                        onMouseLeave={() => setHoveredBin(null)}
                      />
                      <text
                        x={bar.x + bar.width / 2}
                        y={CHART_HEIGHT - 18}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#64748b"
                      >
                        {bar.label}
                      </text>
                    </g>
                  ))}
                </svg>

                {hoveredBin ? (
                  <div
                    className="pointer-events-none absolute z-10 rounded-[14px] border border-[var(--border)] bg-slate-950 px-3 py-2 text-xs text-white shadow-xl"
                    style={{ left: hoveredBin.x, top: hoveredBin.y - 18, transform: 'translate(-50%, -100%)' }}
                  >
                    <div className="font-semibold">{hoveredBin.label}</div>
                    <div className="mt-1 text-slate-300">Count: {hoveredBin.value.toLocaleString()}</div>
                  </div>
                ) : null}
              </div>
            </div>

            {userMode !== 'clinical' && (
              <div className="ha-card p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="ha-section-label">Column Statistics</p>
                    <h4 className="mt-2 text-lg font-bold text-[var(--text)]">Quick metrics</h4>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-4"> 
                  {stats.map(([label, value]) => (
                    <StatCard key={label} label={label} value={value} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default FeatureExplorerTab;
