import React from 'react';
import {
  FeatureImportancePoint,
  ModelResult,
  ProjectionPoint,
} from '../../../store/useModelStore';
import InfoPopover from '../../../components/common/InfoPopover';

const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#be123c', '#4f46e5'];

function colorForLabel(label: string, labels: string[]): string {
  const index = Math.max(0, labels.indexOf(label));
  return PALETTE[index % PALETTE.length];
}

function formatPercent(value?: number | null): string {
  if (value == null) {
    return 'N/A';
  }
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(value?: number | null): string {
  if (value == null) {
    return 'N/A';
  }
  const signed = value >= 0 ? '+' : '';
  return `${signed}${(value * 100).toFixed(1)} pts`;
}

function formatParamValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value == null) {
    return 'none';
  }
  return String(value);
}

function riskTone(risk?: string): string {
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

const SectionTitle: React.FC<{ title: string; subtitle?: string; helpTitle?: string; helpBody?: React.ReactNode }> = ({
  title,
  subtitle,
  helpTitle,
  helpBody,
}) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      {helpTitle && helpBody ? (
        <InfoPopover title={helpTitle} panelWidthClassName="w-[24rem]">
          {helpBody}
        </InfoPopover>
      ) : null}
    </div>
    {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
  </div>
);

const InfoCard: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <div className={`rounded-2xl border p-4 ${tone ?? 'border-slate-200 bg-white text-slate-900'}`}>
    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-2 text-xl font-black">{value}</p>
  </div>
);

const EmptyPanel: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5">
    <p className="text-sm font-bold text-slate-700">{title}</p>
    <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
  </div>
);

const SplitComparisonPanel: React.FC<{
  splitMetrics?: ModelResult['visualization']['split_metrics'];
  generalization?: ModelResult['visualization']['generalization'];
}> = ({ splitMetrics, generalization }) => {
  if (!splitMetrics) {
    return (
      <EmptyPanel
        title="Split comparison unavailable"
        body="Train, validation, and test metrics were not available together for this run."
      />
    );
  }

  const splits = [
    { key: 'train', label: 'Train', color: 'bg-slate-900' },
    { key: 'validation', label: 'Validation', color: 'bg-indigo-500' },
    { key: 'test', label: 'Test', color: 'bg-emerald-500' },
  ] as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <SectionTitle
        title="Split Comparison"
        subtitle="Train, validation, and test side by side to make overfitting easier to spot."
        helpTitle="Overfitting view"
        helpBody={
          <>
            <p>If train stays much higher than validation or test, the model is learning training patterns that do not generalize well.</p>
            <p>This panel keeps that gap visible right next to the projection view.</p>
          </>
        }
      />
      <div className="mt-4 space-y-4">
        {[
          { key: 'f1_score', label: 'F1 Score' },
          { key: 'accuracy', label: 'Accuracy' },
        ].map((metric) => (
          <div key={metric.key} className="space-y-2">
            <p className="text-sm font-bold text-slate-800">{metric.label}</p>
            <div className="space-y-2">
              {splits.map((split) => {
                const value = splitMetrics[split.key]?.[metric.key] ?? null;
                return (
                  <div key={`${metric.key}-${split.key}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">{split.label}</span>
                      <span className="font-bold text-slate-900">{formatPercent(value)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${split.color}`} style={{ width: `${(value ?? 0) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${riskTone(generalization?.risk)}`}>
        <p className="font-bold">Overfit signal</p>
        <p className="mt-1 leading-relaxed">
          Train vs selection gap: {formatDelta(generalization?.train_minus_selection_f1)} | Train vs test gap:{' '}
          {formatDelta(generalization?.train_minus_test_f1)}
        </p>
      </div>
    </div>
  );
};

const ScatterPlot: React.FC<{
  points: ProjectionPoint[];
  labels: string[];
  explainedVariance?: number[];
  method?: string;
}> = ({ points, labels, explainedVariance, method }) => {
  if (points.length === 0) {
    return (
      <EmptyPanel
        title="Projection not available"
        body="This view is rendered only when at least two post-preprocessing features survive and the evaluation split has enough rows. No placeholder projection is shown."
      />
    );
  }

  const width = 560;
  const height = 240;
  const padding = 22;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <SectionTitle
        title="Projection View"
        subtitle={`Train-fit PCA on the evaluation split${explainedVariance?.length ? ` | PC1 ${(explainedVariance[0] * 100).toFixed(1)}% | PC2 ${((explainedVariance[1] ?? 0) * 100).toFixed(1)}%` : ''}${method ? ` | ${method}` : ''}`}
        helpTitle="Projection view"
        helpBody={
          <>
            <p>This is a real 2D projection of the evaluation rows after the learned preprocessing has been applied.</p>
            <p>
              We use PCA only to visualize structure. It does not retrain the classifier and it is not a fake placeholder chart.
            </p>
          </>
        }
      />
      <div className="mt-4 max-w-3xl">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-2xl border border-slate-100 bg-slate-50">
        {points.map((point, index) => {
          const cx = padding + ((point.x - minX) / xRange) * (width - padding * 2);
          const cy = height - padding - ((point.y - minY) / yRange) * (height - padding * 2);
          const fill = colorForLabel(point.actual, labels);
          return (
            <circle
              key={`${point.actual}-${point.predicted}-${index}`}
              cx={cx}
              cy={cy}
              r={point.correct ? 4.5 : 6.5}
              fill={fill}
              fillOpacity={point.correct ? 0.9 : 0.32}
              stroke={point.correct ? 'none' : '#0f172a'}
              strokeWidth={point.correct ? 0 : 1.5}
            >
              <title>{`${point.actual} -> ${point.predicted}${point.confidence != null ? ` (${(point.confidence * 100).toFixed(1)}%)` : ''}`}</title>
            </circle>
          );
        })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {labels.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorForLabel(label, labels) }} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-slate-900 bg-white" />
          Misclassified
        </span>
      </div>
    </div>
  );
};

const FeatureBars: React.FC<{
  features: FeatureImportancePoint[];
  source?: string | null;
}> = ({ features, source }) => {
  if (features.length === 0) {
    return (
      <EmptyPanel
        title="Feature signal unavailable"
        body="This run did not expose native importance and permutation importance was not available for the chosen estimator or split."
      />
    );
  }

  const maxImportance = Math.max(...features.map((feature) => feature.importance), 0.000001);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <SectionTitle
        title="Feature Signal"
        subtitle={`Top features from the fitted estimator${source ? ` | source: ${source}` : ''}`}
        helpTitle="Feature signal"
        helpBody={
          <>
            <p>Feature signal summarizes which inputs influenced this fitted model the most.</p>
            <p>
              It is useful for diagnosis, not causality. A high score means the model relied on that feature, not that the feature truly causes the outcome.
            </p>
          </>
        }
      />
      <div className="mt-4 space-y-3">
        {features.map((feature) => (
          <div key={feature.feature} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-700">{feature.feature}</span>
              <span className="font-mono text-slate-500">{feature.importance.toFixed(4)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600"
                style={{ width: `${(feature.importance / maxImportance) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ModelDiagnosticsPanel: React.FC<{ result: ModelResult; runLabel?: string }> = ({ result, runLabel }) => {
  const visualization = result.visualization;
  const splitSummary = visualization?.split_summary;
  const generalization = visualization?.generalization;
  const splitMetrics = visualization?.split_metrics;
  const classLabels = visualization?.confusion_matrix_full?.labels ?? [];
  const projectionPoints = visualization?.projection?.points ?? [];
  const search = result.search;

  return (
    <div className="space-y-6">
      {runLabel ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Selected Run</p>
          <p className="mt-2 text-lg font-black tracking-tight text-slate-900">{runLabel}</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <InfoCard
          label="Selection Split"
          value={splitSummary?.selection_split ?? result.evaluation_split ?? 'N/A'}
        />
        <InfoCard
          label="Overfit Risk"
          value={generalization?.risk ?? 'unknown'}
          tone={riskTone(generalization?.risk)}
        />
        <InfoCard
          label="Train - Selection F1"
          value={formatDelta(generalization?.train_minus_selection_f1)}
        />
        <InfoCard
          label="Train - Test F1"
          value={formatDelta(generalization?.train_minus_test_f1)}
        />
      </div>

      {search ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Grid Search"
            subtitle={search.enabled ? 'Hyperparameters were selected by cross-validation on the training split only.' : 'This run used the manual hyperparameters shown below.'}
            helpTitle="Grid search"
            helpBody={
              <>
                <p>Grid search tries several hyperparameter combinations and scores each one with cross-validation on the training split only.</p>
                <p>
                  That means validation and test remain untouched while tuning happens, which keeps later evaluation more honest.
                </p>
              </>
            }
          />
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <InfoCard
              label="Mode"
              value={
                !search.enabled
                  ? 'manual'
                  : search.mode === 'custom'
                    ? 'custom grid'
                    : 'preset grid'
              }
              tone="border-slate-200 bg-slate-50 text-slate-900"
            />
            <InfoCard label="CV Folds" value={search.enabled ? String(search.cv_folds ?? 'N/A') : 'N/A'} tone="border-slate-200 bg-slate-50 text-slate-900" />
            <InfoCard label="Scoring" value={search.scoring ?? 'manual'} tone="border-slate-200 bg-slate-50 text-slate-900" />
            <InfoCard label="Best CV Score" value={search.enabled ? formatPercent(search.best_score) : 'N/A'} tone="border-slate-200 bg-slate-50 text-slate-900" />
          </div>

          {search.enabled && search.parameter_space && Object.keys(search.parameter_space).length > 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Candidate values tried</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(search.parameter_space).map(([key, values]) => (
                  <span key={key} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                    {key}: {Array.isArray(values) ? values.join(', ') : String(values)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {search.best_params && Object.keys(search.best_params).length > 0 ? (
            <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Best Parameters</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(search.best_params).map(([key, value]) => (
                  <span key={key} className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm">
                    {key}: {formatParamValue(value)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {search.enabled && (search.top_candidates?.length ?? 0) > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-bold uppercase tracking-[0.16em]">Rank</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-[0.16em]">CV Score</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-[0.16em]">Parameters</th>
                  </tr>
                </thead>
                <tbody>
                  {search.top_candidates?.map((candidate) => (
                    <tr key={`${candidate.rank}-${candidate.score}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-700">#{candidate.rank}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{formatPercent(candidate.score)}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {Object.entries(candidate.params).map(([key, value]) => `${key}=${formatParamValue(value)}`).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {splitSummary ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Split Integrity"
            subtitle="Row counts and class balance for the exact holdout structure used by this run."
            helpTitle="Split integrity"
            helpBody={
              <>
                <p>This section tells you how many rows landed in train, validation, and test for this exact run.</p>
                <p>If the split sizes or class balance look odd here, comparisons between runs can become misleading.</p>
              </>
            }
          />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoCard label="Train Rows" value={String(splitSummary.train_rows)} tone="border-indigo-100 bg-indigo-50 text-indigo-900" />
            <InfoCard label="Validation Rows" value={String(splitSummary.validation_rows)} tone="border-blue-100 bg-blue-50 text-blue-900" />
            <InfoCard label="Test Rows" value={String(splitSummary.test_rows)} tone="border-emerald-100 bg-emerald-50 text-emerald-900" />
          </div>

          {splitMetrics ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {[
                { key: 'train', label: 'Train' },
                { key: 'validation', label: 'Validation' },
                { key: 'test', label: 'Test' },
              ].map((item) => {
                const metrics = splitMetrics[item.key as keyof typeof splitMetrics];
                return (
                  <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">F1</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{formatPercent(metrics?.f1_score)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">Accuracy</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{formatPercent(metrics?.accuracy)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {Object.entries(splitSummary.class_distribution ?? {}).map(([splitName, items]) => (
              <div key={splitName} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{splitName} Class Balance</p>
                <div className="mt-3 space-y-2">
                  {(items ?? []).map((item) => (
                    <div key={`${splitName}-${item.label}`} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-700">{item.label}</span>
                        <span className="text-slate-500">
                          {item.count} | {(item.ratio * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white">
                        <div className="h-full rounded-full bg-slate-700" style={{ width: `${item.ratio * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <ScatterPlot
          points={projectionPoints}
          labels={classLabels}
          explainedVariance={visualization?.projection?.explained_variance}
          method={visualization?.projection?.method}
        />
        <SplitComparisonPanel splitMetrics={splitMetrics} generalization={generalization} />
      </div>
    </div>
  );
};

export default ModelDiagnosticsPanel;
