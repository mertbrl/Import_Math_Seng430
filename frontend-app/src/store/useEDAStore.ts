import { create } from 'zustand';
import type { MockEDADataset, ColumnStats } from '../features/dataExploration/mockEDAData';

interface EDAState {
  // Pre-Analysis Phase
  rawFile: File | null;
  rawHeaders: string[];
  rawPreviewRows: Record<string, string | number | null>[];
  ignoredColumns: string[];
  previewAccepted: boolean;

  // Persisted EDA Result — stays alive when user navigates back to Step 2
  edaData: MockEDADataset | null;
  setEdaData: (data: MockEDADataset | null) => void;

  // ML Task Config
  mlTask: 'classification' | 'regression' | 'multiclass';
  targetColumn: string;
  totalRows: number;

  // Actions
  setRawFileAndHeadersAndPreview: (file: File, headers: string[], previewRows: Record<string, string | number | null>[]) => void;
  setPreviewAccepted: (accepted: boolean) => void;
  toggleIgnoreColumn: (col: string) => void;
  setMlConfig: (mlTask: EDAState['mlTask'], targetColumn: string, totalRows: number) => void;
  clearConfig: () => void;
}

export const useEDAStore = create<EDAState>((set) => ({
  rawFile: null,
  rawHeaders: [],
  rawPreviewRows: [],
  ignoredColumns: [],
  previewAccepted: false,
  edaData: null,
  mlTask: 'classification',
  targetColumn: '',
  totalRows: 0,

  setEdaData: (data) => set({ edaData: data }),

  setRawFileAndHeadersAndPreview: (file, headers, previewRows) =>
    set({ rawFile: file, rawHeaders: headers, rawPreviewRows: previewRows, ignoredColumns: [], previewAccepted: false }),

  setPreviewAccepted: (accepted) => set({ previewAccepted: accepted }),

  toggleIgnoreColumn: (col) =>
    set((state) => ({
      ignoredColumns: state.ignoredColumns.includes(col)
        ? state.ignoredColumns.filter((c) => c !== col)
        : [...state.ignoredColumns, col],
    })),

  setMlConfig: (mlTask, targetColumn, totalRows) => set({ mlTask, targetColumn, totalRows }),

  clearConfig: () =>
    set({
      rawFile: null,
      rawHeaders: [],
      rawPreviewRows: [],
      ignoredColumns: [],
      previewAccepted: false,
      edaData: null,
      mlTask: 'classification',
      targetColumn: '',
      totalRows: 0,
    }),
}));

/**
 * Advanced Distribution Heuristics
 */

// Simple peak detection from histogram bins
export function detectMultimodality(col: ColumnStats): 'unimodal' | 'bimodal' | 'multimodal' {
  if (col.type !== 'Numeric' || col.distribution.length < 5) return 'unimodal';

  const values = col.distribution.map((d) => d.value);
  let peaks = 0;

  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1];
    const curr = values[i];
    const next = values[i + 1];
    if (curr > prev && curr > next) {
      const maxVal = Math.max(...values);
      if (curr > maxVal * 0.1) peaks++;
    }
  }

  if (peaks === 2) return 'bimodal';
  if (peaks > 2) return 'multimodal';
  return 'unimodal';
}
