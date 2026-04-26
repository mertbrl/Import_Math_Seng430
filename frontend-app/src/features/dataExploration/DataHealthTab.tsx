import React, { useMemo } from 'react';
import type { Alert, SummaryStats } from './mockEDAData';
import { detectMultimodality } from '../../store/useEDAStore';
import DataHealthAlerts from './DataHealthAlerts';
import { AlertTriangle, Columns3, Copy, Database, Hash, Rows3, ToggleLeft, Type } from 'lucide-react';
import { useDomainStore } from '../../store/useDomainStore';

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
}> = ({ label, value, subtext, icon }) => (
  <article className="rounded-[18px] border border-[rgba(190,201,193,0.42)] bg-[linear-gradient(180deg,#ffffff,#f7faf7)] px-4 py-4 shadow-[0_10px_26px_rgba(14,116,82,0.05)]">
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--surface2)] text-[var(--accent)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="ha-section-label">{label}</p>
        <p className="mt-2 font-[var(--font-display)] text-[24px] font-bold tracking-[-0.05em] text-[var(--text)]">
          {value}
        </p>
        {subtext ? <p className="mt-1 text-[13px] leading-6 text-[var(--text2)]">{subtext}</p> : null}
      </div>
    </div>
  </article>
);

interface DataHealthTabProps {
  summary: SummaryStats;
  alerts: Alert[];
  columns: import('./mockEDAData').ColumnStats[];
  targetColumnName?: string;
}

const DataHealthTab: React.FC<DataHealthTabProps> = ({ summary, alerts, columns, targetColumnName }) => {
  const userMode = useDomainStore((s) => s.userMode);
  const targetColumn =
    columns.find((column) => column.name === targetColumnName) ?? columns[columns.length - 1];
  const targetDist = targetColumn?.distribution ?? [];
  const totalTargetCount = targetDist.reduce((sum, entry) => sum + entry.value, 0);

  const enrichedAlerts = useMemo(() => {
    const nextAlerts = [...alerts];

    if (targetColumn && targetColumn.type === 'Categorical' && targetDist.length > 0) {
      const highestClassCount = Math.max(...targetDist.map((entry) => entry.value));
      const majorityPct = highestClassCount / totalTargetCount;
      if (majorityPct >= 0.9) {
        nextAlerts.push({
          severity: 'severe',
          title: 'Extreme Class Imbalance',
          message: `The target variable '${targetColumn.name}' has a minority class below 10%. This will bias standard training unless balancing is introduced.`,
          icon: 'warning',
        });
      }
    }

    const multimodalColumns = columns.filter((column) => detectMultimodality(column) === 'multimodal');
    if (multimodalColumns.length > 0) {
      nextAlerts.push({
        severity: 'warning',
        title: 'Multimodal Distributions Detected',
        message: `${multimodalColumns.length} variables, including ${multimodalColumns[0].name}, have multi-peaked distributions that may benefit from tree-based models or segmentation.`,
        icon: 'warning',
      });
    }

    return nextAlerts;
  }, [alerts, columns, targetColumn, targetDist, totalTargetCount]);

  const typeSegments = [
    { label: 'Numeric', value: summary.variableTypes.Numeric, color: '#00593e', icon: <Hash size={12} /> },
    { label: 'Categorical', value: summary.variableTypes.Categorical, color: '#4b7e67', icon: <Type size={12} /> },
    { label: 'Boolean', value: summary.variableTypes.Boolean, color: '#c27122', icon: <ToggleLeft size={12} /> },
  ];

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-5">
          <p className="ha-section-label">Executive Summary</p>
          <h3 className="mt-2 font-[var(--font-display)] text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">
            Clinical dataset health
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Variables" value={summary.numVariables} icon={<Columns3 size={18} />} />
          <MetricCard label="Observations" value={summary.numObservations.toLocaleString()} icon={<Rows3 size={18} />} />
          <MetricCard label="Missing Cells" value={summary.missingCells.toLocaleString()} subtext={`${summary.missingCellsPct}% of all cells`} icon={<AlertTriangle size={18} />} />
          <MetricCard label="Duplicate Rows" value={summary.duplicateRows} subtext={`${summary.duplicateRowsPct}% duplicated`} icon={<Copy size={18} />} />
          <MetricCard label="Source Status" value="Ready" subtext="Analysis completed" icon={<Database size={18} />} />
        </div>
      </section>

      <section className="ha-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="ha-section-label">Variable Type Breakdown</p>
            <h4 className="mt-2 text-[17px] font-bold text-[var(--text)]">Signal composition</h4>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[var(--text2)]">
            Numeric-heavy tables usually tolerate scaling and outlier handling well, while categorical breadth shapes encoding choices.
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-[999px] bg-[var(--surface2)]">
          <div className="flex h-3">
            {typeSegments.map((segment) => (
              <div
                key={segment.label}
                style={{ width: `${(segment.value / summary.numVariables) * 100}%`, backgroundColor: segment.color }}
                title={`${segment.label}: ${segment.value}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {typeSegments.map((segment) => (
            <span
              key={segment.label}
              className="ha-pill"
              style={{
                borderColor: `${segment.color}25`,
                color: segment.color,
                background: `${segment.color}12`,
              }}
            >
              {segment.icon}
              {segment.label}: {segment.value}
            </span>
          ))}
        </div>
      </section>

      {userMode !== 'clinical' && (
        <section>
          <div className="mb-5">
            <p className="ha-section-label">ML Health Diagnostics</p>
            <h4 className="mt-2 text-[17px] font-bold text-[var(--text)]">Warnings and recommendations</h4>
          </div>

          <DataHealthAlerts alerts={enrichedAlerts} />
        </section>
      )}
    </div>
  );
};

export default DataHealthTab;
