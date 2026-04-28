import React, { useState } from 'react';
import { AlertCircle, Loader2, UploadCloud } from 'lucide-react';
import DataLoader from './DataLoader';
import SmartEDA from './SmartEDA';
import { useDomainStore } from '../../store/useDomainStore';
import { useEDAStore } from '../../store/useEDAStore';
import { domains } from '../../config/domainConfig';
import { BACKEND_URL_HINT } from '../../config/apiConfig';
import { checkBackendHealth, exploreDataset } from '../../services/pipelineApi';
import ColumnConfigurator from './ColumnConfigurator';
import PreAnalysisPreview from './PreAnalysisPreview';


export const Step2_DataExploration: React.FC = () => {
  const selectedDomainId = useDomainStore((state) => state.selectedDomainId);
  const sessionId = useDomainStore((state) => state.sessionId);
  const domain = domains.find((item) => item.id === selectedDomainId) ?? domains[0];
  const { clearConfig, previewAccepted, edaData, setEdaData, prepareForAnalysis } = useEDAStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileLoaded = async (file: File, ignoredColumns: string[] = []) => {
    setIsLoading(true);
    setError('');
    setEdaData(null);
    prepareForAnalysis(ignoredColumns);

    try {
      const data = await exploreDataset(file, ignoredColumns, sessionId);
      setEdaData(data);
    } catch (err: any) {
      const health = await checkBackendHealth();
      const message =
        err?.response?.data?.error ||
        (!health.reachable
          ? `Could not reach the FastAPI backend at ${BACKEND_URL_HINT}. Start the backend server and try again.`
          : err?.message) ||
        'Failed to analyze dataset. Is the backend running?';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const showWorkbench = !previewAccepted && !edaData && !isLoading;

  return (
    <div className="ha-step2-shell space-y-6" id="step-2">
      <div className="ha-card overflow-hidden border-[rgba(190,201,193,0.38)] bg-white/85 shadow-[0_14px_40px_rgba(14,116,82,0.06)]">
        <div className="border-b border-[rgba(190,201,193,0.42)] bg-[linear-gradient(180deg,#f8fbf8,#f2f7f3)] px-7 py-8 sm:px-10">
          <div className="flex flex-wrap gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl min-w-[280px] flex-1">
              <span className="ha-pill ha-pill-accent">
                <UploadCloud size={14} />
                Step 2 - Data Exploration
              </span>
              <h2 className="ha-display mt-5">Explore the dataset before you transform it.</h2>
              <p className="ha-body mt-4 min-w-0 w-full break-words">
                Upload or load the working file for <strong className="text-[var(--text)]">{domain.domainName}</strong>. This
                step surfaces data preview, quality signals, missingness, correlation structure, and target mapping
                before preprocessing.
              </p>
            </div>

            <div className="min-w-[280px] flex-1 rounded-[16px] border border-[rgba(190,201,193,0.45)] bg-white/88 px-5 py-4 backdrop-blur-md">
              <p className="ha-section-label">Clinical Focus</p>
              <p className="mt-2 w-full break-words text-[15px] font-semibold leading-7 text-[var(--text)]">{domain.clinicalQuestion}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-7 py-8 sm:px-10 sm:py-10">
          {showWorkbench ? (
            <div className="ha-step2-workbench" data-tutorial="step2-upload">
              <DataLoader onFileLoaded={handleFileLoaded} isLoading={isLoading} />
              <PreAnalysisPreview />
            </div>
          ) : null}

          {previewAccepted && !edaData && !isLoading ? (
            <ColumnConfigurator onConfirm={handleFileLoaded} onCancel={() => clearConfig()} />
          ) : null}

          {isLoading ? (
            <div className="ha-card-muted flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full border border-[var(--border)] bg-white shadow-sm">
                <Loader2 size={30} className="animate-spin text-[var(--primary-container)]" />
              </div>
              <div>
                <p className="font-[var(--font-display)] text-[26px] font-bold tracking-[-0.04em] text-[var(--text)]">
                  Running exploratory analysis
                </p>
                <p className="mt-2 text-sm text-[var(--text2)]">
                  Computing distributions, schema diagnostics, correlations, and target candidates.
                </p>
              </div>
            </div>
          ) : null}

          {error && !isLoading ? (
            <div className="rounded-[20px] border border-[var(--danger)]/20 bg-[var(--danger-light)] px-5 py-5">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="mt-1 shrink-0 text-[var(--danger)]" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--danger)]">Analysis Failed</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--text)]">{error}</p>
                  <p className="mt-3 text-sm text-[var(--text2)]">
                    Backend endpoint: <code className="ha-code">{BACKEND_URL_HINT}</code>
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {edaData && !isLoading ? (
            <div className="ha-animate-in" data-tutorial="step2-tabs">
              <SmartEDA data={edaData} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
