import React from 'react';
import { ModelResult, RocCurveLine } from '../../../store/useModelStore';
import InfoPopover from '../../../components/common/InfoPopover';

const CURVE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#be123c', '#0f766e'];

const PanelHeader: React.FC<{
  title: string;
  subtitle?: string;
  helpTitle?: string;
  helpBody?: React.ReactNode;
}> = ({ title, subtitle, helpTitle, helpBody }) => (
  <div>
    <div className="flex items-center gap-2">
      <h3 className="text-lg font-black tracking-tight text-slate-900">{title}</h3>
      {helpTitle && helpBody ? (
        <InfoPopover title={helpTitle} panelWidthClassName="w-[24rem]">
          {helpBody}
        </InfoPopover>
      ) : null}
    </div>
    {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
  </div>
);

export function percent(value?: number | null): string {
  if (value == null) {
    return 'N/A';
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function riskTone(risk?: string): string {
  if (risk === 'high') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }
  if (risk === 'moderate') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (risk === 'low') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export const NumericRocChart: React.FC<{ curves: RocCurveLine[] }> = ({ curves }) => {
  const width = 640;
  const height = 360;
  const padding = 38;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <PanelHeader
        title="ROC Space"
        subtitle="True positive rate against false positive rate across thresholds."
        helpTitle="ROC curve"
        helpBody={
          <>
            <p>ROC curves show how recall changes as the decision threshold moves, while also tracking false alarms.</p>
            <p>
              Curves closer to the top-left are generally better. AUC summarizes that curve into one score, but class imbalance and calibration still matter.
            </p>
          </>
        }
      />
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-2xl bg-slate-50">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <React.Fragment key={tick}>
            <line
              x1={padding}
              y1={height - padding - tick * plotHeight}
              x2={width - padding}
              y2={height - padding - tick * plotHeight}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <line
              x1={padding + tick * plotWidth}
              y1={padding}
              x2={padding + tick * plotWidth}
              y2={height - padding}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          </React.Fragment>
        ))}

        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#0f172a" strokeWidth="2" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#0f172a" strokeWidth="2" />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={padding}
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="8 6"
        />

        {curves.map((curve, curveIndex) => {
          const points = curve.fpr
            .map((x, index) => {
              const chartX = padding + x * plotWidth;
              const chartY = height - padding - (curve.tpr[index] ?? 0) * plotHeight;
              return `${chartX},${chartY}`;
            })
            .join(' ');

          return (
            <polyline
              key={curve.label}
              points={points}
              fill="none"
              stroke={CURVE_COLORS[curveIndex % CURVE_COLORS.length]}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        <text x={width / 2} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[12px] font-semibold">
          False Positive Rate
        </text>
        <text
          x={16}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${height / 2})`}
          className="fill-slate-500 text-[12px] font-semibold"
        >
          True Positive Rate
        </text>
      </svg>
    </div>
  );
};

export const SplitMetricBars: React.FC<{ result: ModelResult }> = ({ result }) => {
  const splitMetrics = result.visualization?.split_metrics;
  const metricRows = [
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'f1_score', label: 'F1 Score' },
    { key: 'precision', label: 'Precision' },
    { key: 'recall', label: 'Recall' },
  ] as const;
  const splitOrder = [
    { key: 'train', label: 'Train', color: 'bg-slate-900' },
    { key: 'validation', label: 'Validation', color: 'bg-indigo-500' },
    { key: 'test', label: 'Test', color: 'bg-emerald-500' },
  ] as const;

  if (!splitMetrics) {
    return null;
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <PanelHeader
        title="Split Performance"
        subtitle="Train, validation, and test metrics side by side to spot overfitting."
        helpTitle="Split performance"
        helpBody={
          <>
            <p>These bars compare the same metric across train, validation, and test for one run.</p>
            <p>If train is much higher than validation or test, the model is likely memorizing more than it generalizes.</p>
          </>
        }
      />
      <div className="mt-5 space-y-6">
        {metricRows.map((metric) => (
          <div key={metric.key} className="space-y-2">
            <p className="text-sm font-bold text-slate-700">{metric.label}</p>
            <div className="grid gap-3 md:grid-cols-3">
              {splitOrder.map((split) => {
                const value = splitMetrics[split.key]?.[metric.key] ?? null;
                return (
                  <div key={split.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{split.label}</span>
                      <span className="text-sm font-black text-slate-800">{value != null ? percent(value) : 'N/A'}</span>
                    </div>
                    <div className="mt-3 h-3 rounded-full bg-white">
                      <div className={`h-full rounded-full ${split.color}`} style={{ width: `${(value ?? 0) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ConfusionHeatmap: React.FC<{ result: ModelResult }> = ({ result }) => {
  const matrix = result.visualization?.confusion_matrix_full;
  if (!matrix) {
    return null;
  }

  const maxValue = Math.max(...matrix.matrix.flat(), 1);
  return (
    <div className="overflow-auto rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <PanelHeader
        title="Full Confusion Matrix"
        subtitle="Rows are actual classes, columns are predicted classes."
        helpTitle="Confusion matrix"
        helpBody={
          <>
            <p>This table shows exactly where predictions land for every class.</p>
            <p>Diagonal cells are correct predictions. Off-diagonal cells reveal the specific confusions the model is making.</p>
          </>
        }
      />
      <table className="mt-5 min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-left font-bold text-slate-500">Actual / Pred</th>
            {matrix.labels.map((label) => (
              <th key={label} className="border border-slate-200 bg-slate-50 px-4 py-3 text-left font-bold text-slate-500">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.matrix.map((row, rowIndex) => (
            <tr key={matrix.labels[rowIndex] ?? rowIndex}>
              <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-left font-bold text-slate-500">
                {matrix.labels[rowIndex]}
              </th>
              {row.map((value, colIndex) => {
                const diagonal = rowIndex === colIndex;
                const opacity = Math.max(0.12, value / maxValue);
                return (
                  <td
                    key={`${rowIndex}-${colIndex}`}
                    className={`border border-slate-200 px-4 py-3 text-center font-bold ${diagonal ? 'text-emerald-900' : 'text-slate-700'}`}
                    style={{ backgroundColor: diagonal ? `rgba(16,185,129,${opacity})` : `rgba(15,23,42,${opacity * 0.18})` }}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const RocLegend: React.FC<{ curves: RocCurveLine[] }> = ({ curves }) => {
  const rankedCurves = [...curves].sort((left, right) => (right.auc ?? 0) - (left.auc ?? 0));
  const bestCurve = rankedCurves[0];
  const worstCurve = rankedCurves[rankedCurves.length - 1];
  const aucSpread =
    bestCurve && worstCurve && bestCurve !== worstCurve && bestCurve.auc != null && worstCurve.auc != null
      ? bestCurve.auc - worstCurve.auc
      : 0;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <PanelHeader
        title="ROC Comparison"
        subtitle="Which class curves are strongest on this run."
        helpTitle="ROC comparison"
        helpBody={
          <>
            <p>This panel ranks the ROC curves by AUC so you can see which classes separate more cleanly.</p>
            <p>Large spread between the best and worst curves often means some classes are much easier than others.</p>
          </>
        }
      />

      {bestCurve ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Best Separation</p>
            <p className="mt-2 text-base font-black text-emerald-950">{bestCurve.label}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-800">{percent(bestCurve.auc)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">AUC Spread</p>
            <p className="mt-2 text-base font-black text-slate-900">{percent(aucSpread)}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Bigger spread means curve quality changes a lot between classes.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {rankedCurves.map((curve) => {
          const curveIndex = curves.findIndex((item) => item.label === curve.label);
          const aucValue = curve.auc ?? 0;
          return (
            <div key={curve.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: CURVE_COLORS[curveIndex % CURVE_COLORS.length] }}
                  />
                  <span className="truncate font-bold text-slate-800">{curve.label}</span>
                </div>
                <span className="text-sm font-black text-slate-900">{percent(curve.auc)}</span>
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-white">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, aucValue * 100))}%`,
                    backgroundColor: CURVE_COLORS[curveIndex % CURVE_COLORS.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
