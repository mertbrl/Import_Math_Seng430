import React, { useEffect, useMemo, useState } from 'react';
import { useDataPrepStore } from '../../store/useDataPrepStore';
import { useDomainStore } from '../../store/useDomainStore';
import { useEDAStore } from '../../store/useEDAStore';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { buildPipelineConfig } from '../../store/pipelineConfig';
import { fetchPreprocessingReview, type PreprocessingReviewResponse } from '../../api/dataPrepAPI';
import { PREP_TABS } from './DataPrepTabsConfig';

const LOADING_MESSAGES = [
  'Reviewing data quality signals...',
  'Applying system-suggested preprocessing...',
  'Completing the recommended clinical pipeline...',
  'Validating the training-ready dataset...',
];

const VISUAL_STEP_DURATION_MS = 850;
const STATUS_ROW_HEIGHT = 62;

type AutoPipelineStep = {
  key: string;
  label: string;
  detail: string;
};

const parseImbalanceSplit = (message: string): string | null => {
  const match = message.match(/(\d+\s*\/\s*\d+)/);
  return match ? match[1].replace(/\s+/g, '') : null;
};

const normalizePipelineLabel = (label: string) => label.replace(/^\d+\.\s*/, '');

export const ClinicalAutoPrepView: React.FC = () => {
  const { runAutoPrep, completedSteps, cleaningPipeline } = useDataPrepStore();
  const sessionId = useDomainStore((state) => state.sessionId);
  const setCurrentStep = useDomainStore((state) => state.setCurrentStep);
  const targetColumn = useEDAStore((state) => state.targetColumn);
  const edaData = useEDAStore((state) => state.edaData);

  const imbalanceSignal = useMemo(() => {
    const alert = edaData?.alerts.find((item) => item.title.toLowerCase().includes('imbalance'));
    if (!alert) {
      return {
        detected: false,
        split: null as string | null,
        message: 'No material target imbalance was flagged during dataset exploration.',
      };
    }

    return {
      detected: true,
      split: parseImbalanceSplit(alert.message),
      message: alert.message,
    };
  }, [edaData]);

  const prepTitleMap = useMemo(
    () => new Map(PREP_TABS.map((tab) => [tab.id, normalizePipelineLabel(tab.title)])),
    [],
  );

  const pipelineSteps = useMemo<AutoPipelineStep[]>(
    () => [
      {
        key: 'data_cleaning',
        label: prepTitleMap.get('data_cleaning') ?? 'Data Cleaning',
        detail: 'Duplicate rows, zero-variance fields, and type inconsistencies are corrected first.',
      },
      {
        key: 'data_split',
        label: prepTitleMap.get('data_split') ?? 'Data Split',
        detail: 'The system creates a leakage-safe split before any transformations are learned.',
      },
      {
        key: 'imputation',
        label: prepTitleMap.get('imputation') ?? 'Missing Value Handling',
        detail: 'Clinical gaps are imputed with strategies matched to variable type and pattern.',
      },
      {
        key: 'outliers',
        label: prepTitleMap.get('outliers') ?? 'Outliers',
        detail: 'Abnormal numeric ranges are reviewed and softened without discarding useful cases.',
      },
      {
        key: 'transformation',
        label: prepTitleMap.get('transformation') ?? 'Feature Transformation',
        detail: 'Skewed distributions are normalized when the model benefits from smoother inputs.',
      },
      {
        key: 'encoding',
        label: prepTitleMap.get('encoding') ?? 'Categorical Encoding',
        detail: 'Categorical values are encoded into a training-friendly format.',
      },
      {
        key: 'scaling',
        label: prepTitleMap.get('scaling') ?? 'Scaling',
        detail: 'Numeric features are normalized so models compare signals on the same scale.',
      },
      {
        key: 'feature_selection',
        label: prepTitleMap.get('feature_selection') ?? 'Feature Selection',
        detail: 'Lower-value predictors are filtered so the model focuses on stronger clinical signals.',
      },
      {
        key: 'imbalance_handling',
        label: prepTitleMap.get('imbalance_handling') ?? 'Imbalance Handling',
        detail: imbalanceSignal.detected
          ? `The target distribution shows imbalance${imbalanceSignal.split ? ` (${imbalanceSignal.split})` : ''}, so SMOTE can be added to the training pipeline.`
          : 'No imbalance signal was detected, so synthetic balancing can remain off unless you want to force it.',
      },
      {
        key: 'preprocessing_review',
        label: prepTitleMap.get('preprocessing_review') ?? 'Before / After Review',
        detail: 'A final check summarizes the cleaned training-ready dataset before modeling.',
      },
    ],
    [imbalanceSignal.detected, imbalanceSignal.split, prepTitleMap],
  );

  const [isLoading, setIsLoading] = useState(false);
  const [imbalanceEnabled, setImbalanceEnabled] = useState<boolean>(imbalanceSignal.detected);

  const statusSteps = useMemo(
    () =>
      PREP_TABS.filter((tab) => (tab.id === 'imbalance_handling' ? imbalanceEnabled : true)).map((tab) => ({
        key: tab.id,
        label: normalizePipelineLabel(tab.title),
      })),
    [imbalanceEnabled],
  );

  const minVisualRunMs = statusSteps.length * VISUAL_STEP_DURATION_MS;

  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(8);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [review, setReview] = useState<PreprocessingReviewResponse | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const isComplete = completedSteps.includes('preprocessing_review');
  const showCompletionState = isComplete && !isLoading;

  useEffect(() => {
    setImbalanceEnabled(imbalanceSignal.detected);
  }, [imbalanceSignal.detected]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStep((current) => (current < statusSteps.length - 1 ? current + 1 : current));
      }, VISUAL_STEP_DURATION_MS);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, statusSteps.length]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingProgress(8);
      return;
    }

    setLoadingProgress(8);
    const startedAt = Date.now();
    const isFinalVisualStep = loadingStep >= statusSteps.length - 1;
    const ceiling = isFinalVisualStep ? 96 : 94;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(elapsed / VISUAL_STEP_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - ratio, 2);
      const next = Math.round(8 + eased * (ceiling - 8));
      setLoadingProgress(next);
    }, 40);

    return () => clearInterval(interval);
  }, [isLoading, loadingStep, statusSteps.length]);

  useEffect(() => {
    let cancelled = false;

    if (!isComplete) {
      setReview(null);
      setReviewError(null);
      setIsReviewLoading(false);
      return;
    }

    const loadReview = async () => {
      setIsReviewLoading(true);
      setReviewError(null);
      try {
        const result = await fetchPreprocessingReview(buildPipelineConfig(sessionId));
        if (!cancelled) setReview(result);
      } catch (err: any) {
        if (!cancelled) {
          setReviewError(err.message ?? 'Unable to load the before and after review.');
        }
      } finally {
        if (!cancelled) setIsReviewLoading(false);
      }
    };

    void loadReview();
    return () => {
      cancelled = true;
    };
  }, [cleaningPipeline, isComplete, sessionId]);

  const summaryItems = useMemo(() => {
    const labels: Record<string, string> = {
      drop_duplicates: 'Duplicate clinical rows removed',
      drop_zero_variance: 'Low-signal columns removed',
      cast_to_numeric: 'Numeric inconsistencies corrected',
      split: 'Train / validation / test split configured',
      impute_missing: 'Missing values imputed',
      handle_outliers: 'Outliers adjusted',
      apply_transformation: 'Distributions normalized',
      encode_categoricals: 'Categorical values encoded',
      apply_scaling: 'Numeric features scaled',
      feature_selection: 'Predictive features selected',
      handle_imbalance: 'Minority class balanced with SMOTE',
    };

    const details = cleaningPipeline
      .map((action) => {
        if (action.action === 'split') {
          const train = Math.round((action.train ?? 0) * 100);
          const val = Math.round((action.val ?? 0) * 100);
          const test = Math.round((action.test ?? 0) * 100);
          return action.strategy === '3-way'
            ? `Train / validation / test split configured (${train}% / ${val}% / ${test}%)`
            : `Train / test split configured (${train}% / ${test}%)`;
        }
        return labels[action.action] ?? null;
      })
      .filter(Boolean) as string[];

    return details.length ? details : ['Dataset prepared for model training'];
  }, [cleaningPipeline]);

  const loadingMessage = LOADING_MESSAGES[Math.min(loadingStep, LOADING_MESSAGES.length - 1)];
  const activeStepIndex = isLoading ? loadingStep : -1;
  const activePhase = isLoading ? Math.min(activeStepIndex + 1, statusSteps.length) : 0;
  const currentAnimatedStep = isLoading ? statusSteps[Math.min(activeStepIndex, statusSteps.length - 1)] : null;
  const visualStatusIndex = isLoading ? Math.min(activeStepIndex, statusSteps.length - 1) : -1;
  const statusScrollOffset = Math.max(0, visualStatusIndex - 3) * STATUS_ROW_HEIGHT;

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleOptimize = async () => {
    setIsLoading(true);
    setLoadingStep(0);
    setErrorMsg(null);

    try {
      await Promise.all([runAutoPrep(sessionId, imbalanceEnabled), delay(minVisualRunMs)]);
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          'Optimization could not complete. The dataset may no longer be available or the backend session may need to be restarted.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (showCompletionState) {
    return (
      <div className="space-y-6">
        <div className="ha-card overflow-hidden">
          <div className="bg-[linear-gradient(90deg,var(--primary),var(--secondary))] px-8 py-1" />
          <div className="grid gap-6 px-7 py-8 sm:px-10 sm:py-10 xl:grid-cols-[minmax(0,1.25fr)_360px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                <ShieldCheck size={14} />
                Clinical Optimization Complete
              </div>
              <h2 className="mt-4 font-[var(--font-display)] text-[32px] font-bold tracking-[-0.05em] text-[var(--text)]">
                The doctor-mode pipeline is ready for model training.
              </h2>
              <p className="ha-body mt-4 max-w-3xl">
                The system applied its recommended preprocessing sequence, validated the dataset shape, and prepared the training set around the selected clinical outcome.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {summaryItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-[18px] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff,rgba(241,245,240,0.9))] px-4 py-4 shadow-[0_18px_40px_rgba(0,89,62,0.08)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-emerald-50 p-1 text-emerald-700">
                        <CheckCircle2 size={14} />
                      </div>
                      <p className="text-sm font-medium leading-6 text-[var(--text)]">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(235,239,234,0.92))] p-5 shadow-[0_24px_55px_rgba(0,89,62,0.08)]">
              <div>
                <p className="ha-section-label">Selected Target</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">{targetColumn || 'Clinical outcome'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-[var(--border)] bg-white/92 px-4 py-4">
                  <p className="ha-section-label">Rows</p>
                  <p className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[var(--text)]">
                    {review?.afterShape?.[0] ?? '--'}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--border)] bg-white/92 px-4 py-4">
                  <p className="ha-section-label">Columns</p>
                  <p className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[var(--text)]">
                    {review?.afterShape?.[1] ?? '--'}
                  </p>
                </div>
              </div>

              <div className="rounded-[18px] border border-[var(--border)] bg-white/90 px-4 py-4">
                <p className="ha-section-label">Imbalance Handling</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text2)]">
                  {cleaningPipeline.some((action) => action.action === 'handle_imbalance')
                    ? 'SMOTE was included because the target distribution needed support for the minority class.'
                    : 'No synthetic balancing step was applied in the final pipeline.'}
                </p>
              </div>

              {reviewError ? (
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  {reviewError}
                </div>
              ) : null}

              {isReviewLoading ? (
                <div className="rounded-[18px] border border-[var(--border)] bg-white/90 px-4 py-4 text-sm text-[var(--text2)]">
                  Loading before / after review...
                </div>
              ) : null}

              <button
                onClick={() => setCurrentStep(4)}
                className="ha-button-primary inline-flex w-full items-center justify-center gap-3 py-4"
              >
                Continue to Model Training
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="px-2 pt-2 text-center">
        <h1 className="mt-6 font-[var(--font-display)] text-[clamp(3.2rem,5vw,4.8rem)] font-bold tracking-[-0.065em] text-[var(--primary)]">
          Data Preparation
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-[18px] leading-8 text-[var(--text2)]">
          Sanitizing and structuring clinical records for optimal AI model training.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_0.92fr] xl:auto-rows-auto xl:items-stretch">
        <div className="ha-card overflow-hidden xl:col-start-1 xl:row-start-1 xl:row-span-2 min-h-[610px]">
          <div className="border-b border-[var(--border)] px-7 py-6">
            <p className="font-[var(--font-mono)] text-[12px] font-bold uppercase tracking-[0.28em] text-[var(--primary)]">
              Pipeline Status
            </p>
          </div>

          <div className="ha-step3-status-window relative h-[540px] overflow-hidden px-7 py-7">
            <div className="absolute bottom-7 left-[2.05rem] top-7 w-px bg-[linear-gradient(180deg,rgba(0,89,62,0.14),rgba(0,89,62,0.04))]" />
            <div
              className="relative space-y-2 transition-transform duration-700 ease-out"
              style={{ transform: `translateY(-${statusScrollOffset}px)` }}
            >
              {statusSteps.map((step, index) => {
                const isDone = showCompletionState || index < visualStatusIndex;
                const isCurrent = isLoading && index === visualStatusIndex;
                const percent = isDone ? 100 : isCurrent ? loadingProgress : 0;

                return (
                  <div key={step.key} className="relative flex h-[54px] items-center gap-4">
                    <div className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-white shadow-[0_10px_24px_rgba(0,89,62,0.08)] transition-all duration-500">
                      <div
                        className={`${
                          isDone
                            ? 'border-[rgba(0,89,62,0.14)] text-[var(--primary)]'
                            : isCurrent
                              ? 'border-[rgba(0,89,62,0.24)] text-[var(--primary)] shadow-[0_0_0_8px_rgba(195,236,215,0.38)]'
                              : 'border-[rgba(111,122,114,0.22)] text-[var(--outline)]'
                        } absolute inset-0 rounded-full border bg-white`}
                      />
                      <div className="relative z-10">
                        {isDone ? (
                          <CheckCircle2 size={18} className="fill-[rgba(195,236,215,0.86)]" />
                        ) : isCurrent ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Circle size={18} />
                        )}
                      </div>
                    </div>

                    <div
                      className={`flex min-w-0 flex-1 items-center justify-between rounded-[14px] border px-4 py-3 transition-all duration-500 ${
                        isCurrent
                          ? 'border-[rgba(0,89,62,0.22)] bg-[rgba(239,248,244,0.95)] shadow-[0_18px_36px_rgba(0,89,62,0.08)]'
                          : isDone
                            ? 'border-[rgba(0,89,62,0.08)] bg-[rgba(242,247,241,0.98)]'
                            : 'border-transparent bg-[rgba(243,246,242,0.92)]'
                      }`}
                    >
                      <p className={`truncate text-[14px] font-medium ${isDone || isCurrent ? 'text-[var(--text)]' : 'text-[var(--text3)]'}`}>
                        {step.label}
                      </p>

                      <div className={`ml-3 shrink-0 text-[14px] font-medium ${isDone || isCurrent ? 'text-[var(--primary)]' : 'text-[var(--text3)]'}`}>
                        {percent}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={`ha-card overflow-hidden xl:col-start-2 xl:row-start-1 min-h-[290px] xl:min-h-[320px] ${imbalanceSignal.detected ? 'border-[rgba(186,26,26,0.16)]' : 'border-[rgba(0,89,62,0.12)]'}`}>
          <div className="grid h-full gap-4 px-7 py-7 md:grid-cols-[48px_minmax(0,1fr)]">
            <div className="flex items-center justify-center md:justify-center">
              <div
                className={`grid h-11 w-11 place-items-center rounded-full border border-white/70 shadow-[0_10px_24px_rgba(0,89,62,0.08)] ${
                  imbalanceSignal.detected
                    ? 'bg-[rgba(255,218,214,0.92)] text-[var(--error)]'
                    : 'bg-[rgba(195,236,215,0.72)] text-[var(--primary)]'
                }`}
              >
                {imbalanceSignal.detected ? <AlertTriangle size={24} /> : <ShieldCheck size={22} strokeWidth={2} />}
              </div>
            </div>

            <div className={`flex h-full flex-col justify-center border-l-[3px] pl-5 ${imbalanceSignal.detected ? 'border-[var(--error)]' : 'border-[var(--primary)]'}`}>
              <h3 className="font-[var(--font-display)] text-[clamp(1.85rem,2.3vw,2.35rem)] font-bold tracking-[-0.045em] text-[var(--text)]">
                {imbalanceSignal.detected ? 'Class Imbalance Detected' : 'Target Distribution Looks Stable'}
              </h3>
              <p className="mt-3 max-w-none text-[15px] leading-7 text-[var(--text2)]">
                {imbalanceSignal.detected
                  ? `The target variable${targetColumn ? ` (${targetColumn})` : ''} is skewed${imbalanceSignal.split ? ` at roughly ${imbalanceSignal.split}` : ''}. Proceeding without correction may bias the model toward the majority class.`
                  : `No strong imbalance warning was raised for${targetColumn ? ` ${targetColumn}` : ' the selected target'}. You can leave SMOTE disabled unless you want extra support for rare cases.`}
              </p>
            </div>
          </div>
        </div>

        <div className="ha-card overflow-hidden xl:col-start-2 xl:row-start-2 min-h-[290px] xl:min-h-[320px]">
          <div className="relative flex h-full flex-col px-6 py-6">
            <div className="absolute right-6 top-6 text-[rgba(0,89,62,0.08)]">
              <Activity size={64} strokeWidth={1.2} />
            </div>
            <h3 className="font-[var(--font-display)] text-[clamp(1.8rem,2.2vw,2.2rem)] font-bold tracking-[-0.045em] text-[var(--text)]">
              Enhanced Data Balancing
            </h3>
            <p className="mt-4 max-w-none text-[15px] leading-7 text-[var(--text2)]">
              {imbalanceSignal.detected
                ? 'Would you like to enable Synthetic Minority Over-sampling Technique (SMOTE) for better clinical precision on minority events?'
                : 'Would you like to enable SMOTE balancing to add extra support for rare outcome learning during training?'}
            </p>

            <div className="mt-8 rounded-[18px] border border-[var(--border)] bg-white/92 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <button
                type="button"
                role="switch"
                aria-checked={imbalanceEnabled}
                onClick={() => setImbalanceEnabled((current) => !current)}
                className="flex w-full items-center gap-4 text-left"
              >
                <span
                  className={`relative inline-flex h-9 w-[72px] items-center rounded-full transition-colors ${
                    imbalanceEnabled ? 'bg-[var(--primary)]' : 'bg-[rgba(223,228,223,0.95)]'
                  }`}
                >
                  <span
                    className={`h-7 w-7 rounded-full bg-white shadow-[0_6px_18px_rgba(0,0,0,0.12)] transition-transform ${
                      imbalanceEnabled ? 'translate-x-[38px]' : 'translate-x-[6px]'
                    }`}
                  />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-[var(--text)]">Apply SMOTE balancing</span>
                  <span className="mt-1 block text-[13px] text-[var(--text2)]">
                    {imbalanceSignal.detected ? 'Recommended for this dataset.' : 'Optional for this dataset.'}
                  </span>
                </span>
              </button>
            </div>

            <button
              onClick={handleOptimize}
              disabled={isLoading}
              className="ha-button-primary mt-auto inline-flex w-full items-center justify-center gap-3 py-4 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {isLoading ? loadingMessage : 'Apply & Continue to Training'}
            </button>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-[18px] border border-[var(--danger)]/20 bg-[var(--danger-light)] px-4 py-4 text-sm text-[var(--text)]">
          <strong className="text-[var(--danger)]">Optimization failed:</strong> {errorMsg}
        </div>
      ) : null}
    </div>
  );
};
