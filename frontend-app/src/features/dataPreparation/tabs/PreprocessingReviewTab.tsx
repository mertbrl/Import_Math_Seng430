import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Loader2,
  Search,
  Table,
  AlertCircle,
} from 'lucide-react';
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
import { buildPipelineConfig } from '../../../store/pipelineConfig';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { useDomainStore } from '../../../store/useDomainStore';
import {
  fetchPreprocessingReview,
  type PreprocessingReviewResponse,
} from '../../../api/dataPrepAPI';
import DataPreviewTab from '../../dataExploration/DataPreviewTab';
import CorrelationTab from '../../dataExploration/CorrelationTab';
import type { ColumnStats } from '../../dataExploration/mockEDAData';

type ReviewTabId = 'preview' | 'explorer' | 'correlation';

const REVIEW_TABS: { id: ReviewTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'preview', label: 'Data Preview', icon: <Table size={15} /> },
  { id: 'explorer', label: 'Feature Explorer', icon: <Search size={15} /> },
  { id: 'correlation', label: 'Correlations', icon: <GitBranch size={15} /> },
];

const BAR_COLORS = [
  '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe',
  '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe',
];

const PanelShell: React.FC<{ title: string; tone: string; children: React.ReactNode }> = ({ title, tone, children }) => (
  <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
      <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${tone}`}>{title}</p>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const DistributionCompareCard: React.FC<{
  title: string;
  tone: string;
  column: ColumnStats | null;
  emptyMessage: string;
}> = ({ title, tone, column, emptyMessage }) => {
  if (!column) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
        <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${tone}`}>{title}</p>
        <span className="text-xs font-semibold text-slate-500">
          {column.name} · {column.type}
        </span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={column.distribution} barCategoryGap="18%">
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
              width={48}
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
            <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={500}>
              {column.distribution.map((_, idx) => (
                <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const compactDelta = (before: number, after: number, unit: string) => {
  const delta = after - before;
  const sign = delta > 0 ? '+' : '';
  return `${before} -> ${after} ${unit} (${sign}${delta})`;
};

const PreprocessingReviewTab: React.FC = () => {
  const { completedSteps, toggleStepComplete, cleaningPipeline } = useDataPrepStore();
  const targetColumn = useEDAStore((state) => state.targetColumn);
  const sessionId = useDomainStore((state) => state.sessionId);

  const [activeTab, setActiveTab] = useState<ReviewTabId>('preview');
  const [review, setReview] = useState<PreprocessingReviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [selectedFeature, setSelectedFeature] = useState('');

  const isComplete = completedSteps.includes('preprocessing_review');

  useEffect(() => {
    let cancelled = false;

    const loadReview = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchPreprocessingReview(buildPipelineConfig(sessionId));
        if (!cancelled) {
          setReview(result);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? 'Failed to load before/after review');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadReview();
    return () => {
      cancelled = true;
    };
  }, [cleaningPipeline, sessionId]);

  const comparableFeatures = useMemo(() => {
    if (!review) return [];
    const beforeNames = new Set(review.before.columns.map((column) => column.name));
    return review.after.columns
      .map((column) => column.name)
      .filter((name) => name !== targetColumn && beforeNames.has(name));
  }, [review, targetColumn]);

  useEffect(() => {
    if (!comparableFeatures.length) {
      setSelectedFeature('');
      return;
    }
    if (!selectedFeature || !comparableFeatures.includes(selectedFeature)) {
      setSelectedFeature(comparableFeatures[0]);
    }
  }, [comparableFeatures, selectedFeature]);

  const removedFeaturePreview = useMemo(() => {
    if (!review) return '';
    if (!review.removedColumns.length) return 'No dropped columns';
    const visible = review.removedColumns.slice(0, 5).join(', ');
    const remaining = review.removedColumns.length - 5;
    return remaining > 0 ? `${visible} +${remaining}` : visible;
  }, [review]);

  const beforeSelectedColumn = useMemo(
    () => review?.before.columns.find((column) => column.name === selectedFeature) ?? null,
    [review, selectedFeature]
  );
  const afterSelectedColumn = useMemo(
    () => review?.after.columns.find((column) => column.name === selectedFeature) ?? null,
    [review, selectedFeature]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">
          Building before/after preprocessing diagnostics from the real pipeline...
        </p>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
        <AlertCircle size={18} />
        <div><strong>Error:</strong> {error ?? 'Review data is unavailable.'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-2.5 text-indigo-600 shadow-sm border border-indigo-100">
            <ArrowRightLeft size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">Step 11: Before / After Preprocessing Review</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              This screen now focuses only on what can be compared directly against the final exported dataset.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[auto_auto_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Rows</p>
          <p className="mt-1 text-sm font-bold text-slate-800">
            {compactDelta(review.beforeShape[0], review.afterShape[0], 'rows')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Columns</p>
          <p className="mt-1 text-sm font-bold text-slate-800">
            {compactDelta(review.beforeShape[1], review.afterShape[1], 'cols')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200">
              Removed: {removedFeaturePreview}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
              Comparable features: {comparableFeatures.length}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 flex gap-2 flex-wrap">
          {REVIEW_TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
                  active
                    ? 'bg-white text-indigo-700 border-indigo-200 shadow-sm'
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-700 hover:bg-white/60'
                }`}
              >
                <span className={active ? 'text-indigo-500' : 'text-slate-400'}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {activeTab === 'preview' && (
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <PanelShell title="Before" tone="text-slate-600">
                <DataPreviewTab
                  preview={review.before.preview}
                  page={previewPage}
                  onPageChange={setPreviewPage}
                  compact
                  targetColumn={targetColumn}
                />
              </PanelShell>
              <PanelShell title="After" tone="text-emerald-700">
                <DataPreviewTab
                  preview={review.after.preview}
                  page={previewPage}
                  onPageChange={setPreviewPage}
                  compact
                  targetColumn={targetColumn}
                />
              </PanelShell>
            </div>
          )}

          {activeTab === 'explorer' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Feature Slider</p>
                    <span className="text-xs font-semibold text-slate-500">
                      {comparableFeatures.length} comparable features
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto px-3 py-3">
                  <div className="flex min-w-max gap-2">
                    {comparableFeatures.map((feature) => {
                      const active = feature === selectedFeature;
                      return (
                        <button
                          key={feature}
                          onClick={() => setSelectedFeature(feature)}
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {feature}
                        </button>
                      );
                    })}
                    {comparableFeatures.length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-500">
                        No directly comparable feature remains after preprocessing.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <DistributionCompareCard
                  title="Before"
                  tone="text-slate-600"
                  column={beforeSelectedColumn}
                  emptyMessage="This feature does not exist in the source view."
                />
                <DistributionCompareCard
                  title="After"
                  tone="text-emerald-700"
                  column={afterSelectedColumn}
                  emptyMessage="This feature was removed before export."
                />
              </div>
            </div>
          )}

          {activeTab === 'correlation' && (
            <PanelShell title="Final Export Correlations" tone="text-emerald-700">
              <CorrelationTab
                numericColumnNames={review.after.numericColumnNames}
                correlationMatrix={review.after.correlationMatrix}
                showSuggestion={false}
                compact
              />
            </PanelShell>
          )}
        </div>
      </div>

      <div className="pt-4 mt-2 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} />
            Review completed
          </div>
        ) : (
          <div className="text-sm text-slate-500">
            This view now tracks the final exported feature space more closely.
          </div>
        )}

        {!isComplete && (
          <button
            onClick={() => toggleStepComplete('preprocessing_review', true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            Finish Review
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default PreprocessingReviewTab;
