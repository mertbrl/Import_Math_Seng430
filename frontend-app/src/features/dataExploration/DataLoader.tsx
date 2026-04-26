import React, { useState, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { useDomainStore } from '../../store/useDomainStore';
import { useEDAStore } from '../../store/useEDAStore';
import { BACKEND_URL_HINT, buildApiUrl } from '../../config/apiConfig';
import { checkBackendHealth } from '../../services/pipelineApi';
import { Upload, Loader2, AlertCircle, Database, HeartPulse, ShieldCheck } from 'lucide-react';

interface DataLoaderProps {
  onFileLoaded: (file: File) => void;
  isLoading?: boolean;
}

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const DEFAULT_DATASET_TIMEOUT_MS = 90000;

const DataLoader: React.FC<DataLoaderProps> = ({ isLoading = false }) => {
  const selectedDomainId = useDomainStore((s) => s.selectedDomainId);
  const [dragOver, setDragOver] = useState(false);
  const [fetchingDefault, setFetchingDefault] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loading = isLoading || fetchingDefault;

  const { setRawFileAndHeadersAndPreview, rawFile, rawHeaders, rawPreviewRows, edaData } = useEDAStore();

  const healthMetrics = useMemo(() => {
    if (edaData) {
      return {
        rows: edaData.summary.numObservations.toLocaleString(),
        cols: String(edaData.summary.numVariables),
      };
    }

    if (rawFile) {
      return {
        rows: `${rawPreviewRows.length}+`,
        cols: String(rawHeaders.length),
      };
    }

    return {
      rows: '--',
      cols: '--',
    };
  }, [edaData, rawFile, rawHeaders.length, rawPreviewRows.length]);

  const deliverFile = useCallback(
    (file: File) => {
      setError('');

      Papa.parse<any>(file, {
        preview: 21,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields && results.meta.fields.length > 0) {
            const headers = results.meta.fields.map((h: string) => h.trim());

            const previewRows = results.data.map((row: any) => {
              const cleanRow: Record<string, string | number | null> = {};
              for (const [key, value] of Object.entries(row)) {
                let val: string | number | null = value as string;
                if (val === '' || val === null || val === undefined) {
                  val = null;
                } else if (!isNaN(Number(val))) {
                  val = Number(val);
                }
                cleanRow[key.trim()] = val;
              }
              return cleanRow;
            });

            setRawFileAndHeadersAndPreview(file, headers, previewRows);
          } else {
            setError('Could not extract headers from the CSV file.');
          }
        },
        error: (err: any) => {
          setError(`Error parsing CSV headers: ${err.message}`);
        },
      });
    },
    [setRawFileAndHeadersAndPreview],
  );

  const handleLoadDefault = async () => {
    setFetchingDefault(true);
    setError('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), DEFAULT_DATASET_TIMEOUT_MS);
    try {
      const fileName = `${selectedDomainId}.csv`;
      const res = await fetch(buildApiUrl(`/datasets/${fileName}`), {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Failed to fetch dataset from backend (${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'text/csv' });
      deliverFile(file);
    } catch (err: any) {
      const health = await checkBackendHealth();
      setError(
        health.reachable
          ? err.message || 'Failed to load default dataset.'
          : `Could not reach the FastAPI backend at ${BACKEND_URL_HINT}. Redeploy the Render backend and try again.`,
      );
    } finally {
      window.clearTimeout(timeoutId);
      setFetchingDefault(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    validateAndLoad(file);
  };

  const handleBrowse = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndLoad(file);
  };

  const validateAndLoad = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Only .csv files are accepted. Please select a valid CSV file.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File exceeds ${MAX_SIZE_MB}MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }
    deliverFile(file);
  };

  return (
    <div className="space-y-4">
      <div className="ha-step2-panel">
        <div className="ha-step2-panel-head">
          <span className="ha-step2-panel-label">Source Data</span>
          <Upload size={15} />
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowse}
          className={`ha-step2-dropzone ${loading ? 'is-loading' : ''} ${dragOver ? 'is-dragover' : ''}`}
        >
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />

          {loading ? (
            <>
              <Loader2 size={30} className="animate-spin text-[var(--primary-container)]" />
              <p className="text-sm font-semibold text-[var(--on-surface)]">Processing dataset...</p>
              <p className="text-xs text-[var(--on-surface-variant)]">Analyzing structure and computing statistics</p>
            </>
          ) : (
            <>
              <div className="ha-step2-drop-icon">
                <Upload size={22} className="text-[var(--primary-container)]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--on-surface)]">Drag and drop CSV</p>
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">or click to browse</p>
              </div>
            </>
          )}
        </div>

        <div className="ha-step2-divider">
          <span>OR LOAD SAMPLE</span>
        </div>

        <button onClick={handleLoadDefault} disabled={loading} className={`ha-step2-default-btn ${loading ? 'is-disabled' : ''}`}>
          <HeartPulse size={18} />
          <span>Heart Failure Dataset</span>
          <small>Pre-configured for this domain</small>
        </button>

        {rawFile ? (
          <div className="ha-step2-file-pill">
            <Database size={14} />
            <span className="truncate" title={rawFile.name}>{rawFile.name}</span>
          </div>
        ) : null}

        {error ? (
          <div className="ha-step2-error-box">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}
      </div>

      <div className="ha-step2-panel">
        <div className="ha-step2-panel-head">
          <span className="ha-step2-panel-label">Dataset Health</span>
          <ShieldCheck size={15} />
        </div>

        <div className="ha-step2-health-grid">
          <div>
            <span>Rows</span>
            <strong>{healthMetrics.rows}</strong>
          </div>
          <div>
            <span>Columns</span>
            <strong>{healthMetrics.cols}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataLoader;
