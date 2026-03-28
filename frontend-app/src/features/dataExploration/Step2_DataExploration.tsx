import React, { useState } from 'react';
import DataLoader from './DataLoader';
import SmartEDA from './SmartEDA';
import { useDomainStore } from '../../store/useDomainStore';
import { useEDAStore } from '../../store/useEDAStore';
import { domains } from '../../config/domainConfig';
import { exploreDataset } from '../../services/pipelineApi';
import { Loader2, AlertCircle } from 'lucide-react';
import ColumnConfigurator from './ColumnConfigurator';
import PreAnalysisPreview from './PreAnalysisPreview';

export const Step2_DataExploration: React.FC = () => {
  const selectedDomainId = useDomainStore((s) => s.selectedDomainId);
  const domain = domains.find((d) => d.id === selectedDomainId) || domains[0];
  const { clearConfig, previewAccepted, edaData, setEdaData, prepareForAnalysis } = useEDAStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileLoaded = async (file: File, ignoredColumns: string[] = []) => {
    setIsLoading(true);
    setError('');
    setEdaData(null);
    prepareForAnalysis(ignoredColumns);

    try {
      const data = await exploreDataset(file, ignoredColumns);
      setEdaData(data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to analyse dataset. Is the backend running?';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
      id="step-2"
    >
      {/* Component Header */}
      <div className="bg-slate-50 px-6 sm:px-8 py-6 border-b border-slate-200">
        <div>
          <span className="inline-block px-2.5 py-1 bg-indigo-100/80 text-indigo-700 text-[10px] font-bold tracking-widest rounded-full mb-3 border border-indigo-200/50">
            STEP 2 OF 7
          </span>
          <h2 className="text-2xl font-bold font-serif text-slate-900 tracking-tight">
            Smart Data Exploration &amp; EDA
          </h2>
          <p className="text-[14px] text-slate-600 mt-2 max-w-3xl leading-relaxed">
            Upload or load the dataset for{' '}
            <strong className="text-slate-800 font-semibold">{domain.domainName}</strong>. We'll
            generate an intelligent exploratory analysis including data health checks, feature
            distributions, correlations, and target mapping.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 sm:px-8 sm:py-8 space-y-6">
        {/* Data Loader */}
        <DataLoader onFileLoaded={handleFileLoaded} isLoading={isLoading} />

        {/* Pre-Analysis Data Preview (Step 2.1) */}
        {!previewAccepted && !edaData && (
          <PreAnalysisPreview />
        )}

        {/* Pre-Analysis Column Configurator (Step 2.2) */}
        {previewAccepted && !edaData && (
          <ColumnConfigurator
            onConfirm={handleFileLoaded}
            onCancel={() => clearConfig()}
          />
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in-up">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-400/20 rounded-full animate-ping" />
              <div className="relative p-4 bg-white rounded-full border border-indigo-200 shadow-lg">
                <Loader2 size={32} className="text-indigo-600 animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800">Running Exploratory Analysis…</p>
              <p className="text-xs text-slate-500 mt-1">
                Computing statistics, distributions, correlations &amp; alerts
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && !isLoading && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm animate-fade-in-up">
            <div className="p-2 bg-red-100 rounded-lg shrink-0">
              <AlertCircle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-900">Analysis Failed</p>
              <p className="text-[13px] text-red-700 mt-1 leading-relaxed">{error}</p>
              <p className="text-xs text-red-500 mt-2">
                Ensure the FastAPI backend is running at{' '}
                <code className="bg-red-100 px-1.5 py-0.5 rounded text-red-800 font-mono">
                  http://localhost:8000
                </code>
              </p>
            </div>
          </div>
        )}

        {/* EDA Interface — persists across navigation, shown when edaData exists */}
        {edaData && !isLoading && (
          <div className="animate-fade-in-up">
            <SmartEDA data={edaData} />
          </div>
        )}
      </div>
    </div>
  );
};
