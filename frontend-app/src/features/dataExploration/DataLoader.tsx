import React, { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { useDomainStore } from '../../store/useDomainStore';
import { useEDAStore } from '../../store/useEDAStore';
import { BACKEND_URL_HINT, buildApiUrl } from '../../config/apiConfig';
import { checkBackendHealth } from '../../services/pipelineApi';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';

interface DataLoaderProps {
  onFileLoaded: (file: File) => void;
  isLoading?: boolean;
}

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const DataLoader: React.FC<DataLoaderProps> = ({ onFileLoaded, isLoading = false }) => {
  const selectedDomainId = useDomainStore((s) => s.selectedDomainId);
  const [dragOver, setDragOver] = useState(false);
  const [fetchingDefault, setFetchingDefault] = useState(false);
  const [error, setError] = useState('');
  const [loadedFile, setLoadedFile] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loading = isLoading || fetchingDefault;

  // Use the global store to hold the pending file and extracted headers
  const { setRawFileAndHeadersAndPreview, rawFile } = useEDAStore();

  // ─── Deliver file to Configurator ────────────────────────────────
  const deliverFile = useCallback(
    (file: File) => {
      setLoadedFile(file.name);
      setError('');
      
      // Parse the first 21 lines to get headers and 20 preview rows
      Papa.parse<any>(file, {
        preview: 21,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields && results.meta.fields.length > 0) {
            const headers = results.meta.fields.map((h: string) => h.trim());
            
            // Re-map keys if they had leading/trailing spaces
            const previewRows = results.data.map((row: any) => {
              const cleanRow: Record<string, string | number | null> = {};
              for (const [key, value] of Object.entries(row)) {
                
                // try to parsing numbers
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
        }
      });
    },
    [setRawFileAndHeadersAndPreview]
  );

  // ─── Default Dataset ────────────────────────────────────────────
  const handleLoadDefault = async () => {
    setFetchingDefault(true);
    setError('');
    setLoadedFile('');
    try {
      const fileName = `${selectedDomainId}.csv`;
      const res = await fetch(buildApiUrl(`/datasets/${fileName}`));
      if (!res.ok) throw new Error(`Failed to fetch dataset from backend (${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'text/csv' });
      deliverFile(file);
    } catch (err: any) {
      const health = await checkBackendHealth();
      setError(
        health.reachable
          ? err.message || 'Failed to load default dataset.'
          : `Could not reach the FastAPI backend. Start the backend at ${BACKEND_URL_HINT} and try again.`
      );
    } finally {
      setFetchingDefault(false);
    }
  };

  // ─── Drag & Drop ────────────────────────────────────────────────
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

  // ─── Already Loaded State ────────────────────────────────────────
  if (loadedFile && !loading && !rawFile) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
        <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-900">Dataset Loaded Successfully</p>
          <p className="text-xs text-emerald-700 truncate mt-0.5">
            <FileSpreadsheet size={12} className="inline mr-1" />
            {loadedFile}
          </p>
        </div>
        <button
          onClick={() => {
            setLoadedFile('');
            setError('');
          }}
          className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline shrink-0"
        >
          Change
        </button>
      </div>
    );
  }

  // Do not show the dropzone if a rawFile is pending configuration
  if (rawFile) return null;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowse}
        className={`flex-1 relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
          loading
            ? 'border-indigo-300 bg-indigo-50/50 pointer-events-none'
            : dragOver
            ? 'border-indigo-500 bg-indigo-50 shadow-lg scale-[1.01]'
            : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {loading ? (
          <>
            <Loader2 size={32} className="text-indigo-500 animate-spin" />
            <p className="text-sm font-semibold text-indigo-700">Processing dataset…</p>
            <p className="text-xs text-indigo-500">Analyzing structure &amp; computing statistics</p>
          </>
        ) : (
          <>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <Upload size={24} className="text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">
                Drag &amp; drop your <span className="text-indigo-600">.csv</span> file here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                or <span className="text-indigo-600 underline font-medium">browse files</span> · Max {MAX_SIZE_MB}MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Load Default Dataset Button */}
      <div className="flex flex-col gap-3 sm:w-56 shrink-0">
        <button
          onClick={handleLoadDefault}
          disabled={loading}
          className={`h-full flex flex-col items-center justify-center gap-2 px-5 py-6 rounded-xl border-2 font-semibold transition-all shadow-sm ${
            loading
              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]'
          }`}
        >
          <Database size={22} />
          <span className="text-sm">Load Default Dataset</span>
          <span className="text-[10px] opacity-75 font-medium tracking-wide">
            Pre-configured for this domain
          </span>
        </button>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataLoader;
