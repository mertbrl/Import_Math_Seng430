import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { buildPipelineConfig } from '../../../store/pipelineConfig';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { useDomainStore } from '../../../store/useDomainStore';
import {
  fetchPreprocessingReview,
  type PreprocessingReviewResponse,
} from '../../../api/dataPrepAPI';
import { PreprocessingReviewContent } from '../PreprocessingReviewContent';

const PreprocessingReviewTab: React.FC = () => {
  const { completedSteps, toggleStepComplete, cleaningPipeline } = useDataPrepStore();
  const targetColumn = useEDAStore((state) => state.targetColumn);
  const sessionId = useDomainStore((state) => state.sessionId);

  const [review, setReview] = useState<PreprocessingReviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <PreprocessingReviewContent
        review={review}
        targetColumn={targetColumn}
        title="Step 11: Before / After Preprocessing Review"
        description="This screen now focuses only on what can be compared directly against the final exported dataset."
      />

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
