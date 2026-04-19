import React, { useEffect, useMemo, useState } from 'react';
import { useDataPrepStore } from '../../store/useDataPrepStore';
import { useDomainStore } from '../../store/useDomainStore';
import { useEDAStore } from '../../store/useEDAStore';
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  HeartPulse,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { buildPipelineConfig } from '../../store/pipelineConfig';
import { fetchPreprocessingReview } from '../../api/dataPrepAPI';

const LOADING_MESSAGES = [
  'Scanning missing values...',
  'Optimizing outlier handling...',
  'Ranking predictive features...',
  'Balancing rare clinical outcomes...',
  'Preparing the final training-ready dataset...',
];

export const ClinicalAutoPrepView: React.FC = () => {
  const { runAutoPrep, completedSteps, cleaningPipeline } = useDataPrepStore();
  const sessionId = useDomainStore((state) => state.sessionId);
  const setCurrentStep = useDomainStore((state) => state.setCurrentStep);
  const targetColumn = useEDAStore((state) => state.targetColumn);

  const [isLoading, setIsLoading] = useState(false);
  const [imbalanceEnabled, setImbalanceEnabled] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [review, setReview] = useState<PreprocessingReviewResponse | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const isComplete = completedSteps.includes('preprocessing_review');

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStep((current) => (current < LOADING_MESSAGES.length - 1 ? current + 1 : current));
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

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
      split: 'Training split prepared',
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

  const handleOptimize = async () => {
    setIsLoading(true);
    setLoadingStep(0);
    setErrorMsg(null);

    try {
      await runAutoPrep(sessionId, imbalanceEnabled);
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          'Optimization could not complete. The dataset may no longer be available or the backend session may need to be restarted.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isComplete) {
    return (
      <div className="space-y-6">
        <div className="ha-card-muted p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-white text-[var(--success)] shadow-sm">
                <ShieldCheck size={30} />
              </div>
              <div>
                <p className="ha-section-label" style={{ color: 'var(--success)' }}>
                  Optimization Complete
                </p>
                <h2 className="mt-2 font-[var(--font-display)] text-[32px] font-bold tracking-[-0.05em] text-[var(--text)]">
                  Clinical data checkup finished
                </h2>
                <p className="ha-body mt-3 max-w-2xl">
                  Review what changed before the model training step begins. The list on the left summarizes each automatic action, while the comparison panel shows the exact effect on the working dataset.
                </p>
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(4)}
              className="ha-button-primary inline-flex items-center justify-center gap-3"
            >
              Continue to Model Training
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        
      </div>
    );
  }

  return (
    <div className="flex justify-center px-2 py-4 sm:px-6 sm:py-8">
      <div className="ha-card max-w-3xl overflow-hidden">
        <div className="bg-[linear-gradient(90deg,var(--trust),var(--clinical))] px-8 py-1" />
        <div className="px-7 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] bg-[var(--trust-light)] text-[var(--trust)]">
              <HeartPulse size={38} />
            </div>

            <p className="ha-section-label mt-6">Doctor Mode</p>
            <h2 className="mt-3 font-[var(--font-display)] text-[36px] font-bold tracking-[-0.06em] text-[var(--text)]">
              Clinical Data Checkup & Optimization
            </h2>
            <p className="ha-body mt-4">
              The system reviews data quality, improves weak spots, balances the target if needed, and prepares a cleaner dataset for clinical prediction with no manual parameter tuning.
            </p>

            <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
              <div className="ha-card-muted p-5">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[var(--trust)]">
                  <Activity size={20} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[var(--text)]">Fully Automatic Improvement</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--text2)]">
                  Missing laboratory values, noisy inputs, and unstable features are handled automatically using pipeline defaults chosen for clinical tabular data.
                </p>
              </div>

              <div className="ha-card-muted p-5">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[var(--clinical)]">
                  <Sparkles size={20} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[var(--text)]">Prediction-Focused Selection</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--text2)]">
                  The workflow preserves the most informative clinical signals and removes low-value columns before model training starts.
                </p>
              </div>
            </div>

            <label className="mt-8 flex items-center gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface2)] px-5 py-4 text-left">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={imbalanceEnabled}
                  onChange={(event) => setImbalanceEnabled(event.target.checked)}
                  disabled={isLoading}
                />
                <span
                  className={`flex h-7 w-12 items-center rounded-full px-1 transition-colors ${
                    imbalanceEnabled ? 'bg-[var(--accent)]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      imbalanceEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </span>
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)]">
                  Apply synthetic patient generation (SMOTE)?
                </p>
                <p className="mt-1 text-sm text-[var(--text2)]">
                  Recommended when rare outcome classes need stronger representation during training.
                </p>
              </div>
            </label>

            {errorMsg ? (
              <div className="mt-6 rounded-[18px] border border-[var(--danger)]/20 bg-[var(--danger-light)] px-5 py-4 text-left text-sm text-[var(--text)]">
                <strong className="text-[var(--danger)]">Optimization failed:</strong> {errorMsg}
              </div>
            ) : null}

            <button
              onClick={handleOptimize}
              disabled={isLoading}
              className={isLoading ? 'ha-button-locked mt-8 inline-flex w-full items-center justify-center gap-3 py-4 text-base' : 'ha-button-primary mt-8 inline-flex w-full items-center justify-center gap-3 py-4 text-base'}
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {LOADING_MESSAGES[loadingStep]}
                </>
              ) : (
                'Optimize Dataset Automatically'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
