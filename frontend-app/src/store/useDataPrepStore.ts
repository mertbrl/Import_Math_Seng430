import { create } from 'zustand';
import {
  fetchBasicCleaningStats as apiFetchBasicCleaningStats,
  fetchTypeMismatchStats as apiFetchTypeMismatchStats,
  fetchMissingStats as apiFetchMissingStats,
  fetchOutlierStats as apiFetchOutlierStats,
  type BasicCleaningStats,
  type TypeMismatchColumn,
  type MissingColumnStat,
  type OutlierColumnStat,
} from '../api/dataPrepAPI';

interface DataPrepState {
  activeTabId: string;
  completedSteps: string[];
  cleaningPipeline: any[];
  previewData: any[] | null;
  previewShape: number[] | null;
  isPreviewLoading: boolean;
  previewError: string | null;

  // Step 01 – Basic Cleaning (duplicates + zero-variance)
  basicCleaningStats: BasicCleaningStats | null;
  isStatsLoading: boolean;
  statsError: string | null;

  // Step 01b – Type Casting (dynamic mismatch detection)
  typeMismatchColumns: TypeMismatchColumn[];
  isTypeMismatchLoading: boolean;
  typeMismatchError: string | null;

  // Step 04 - Missing Value Handling (Imputation)
  missingColumns: MissingColumnStat[];
  isMissingLoading: boolean;
  missingError: string | null;

  // Step 05 - Outlier Handling
  outlierColumns: OutlierColumnStat[];
  isOutlierLoading: boolean;
  outlierError: string | null;
  outlierStrategies: Record<string, string>; // Maps column name to chosen strategy
  setOutlierStrategy: (column: string, strategy: string) => void;

  setActiveTab: (id: string) => void;
  toggleStepComplete: (id: string, isComplete?: boolean) => void;
  addPipelineAction: (actionConfig: any) => void;
  fetchPreviewData: (sessionId: string) => Promise<void>;
  fetchBasicCleaningStats: (sessionId: string, excludedColumns: string[]) => Promise<void>;
  fetchTypeMismatchStats: (sessionId: string, excludedColumns: string[]) => Promise<void>;
  fetchMissingStats: (sessionId: string, excludedColumns: string[]) => Promise<void>;
  fetchOutlierStats: (sessionId: string, excludedColumns: string[]) => Promise<void>;
  clearSubsequentProgress: (invalidStepIds: string[]) => void;
  resetPrep: () => void;
}

export const useDataPrepStore = create<DataPrepState>((set, get) => ({
  activeTabId: 'data_cleaning',
  completedSteps: [],
  cleaningPipeline: [],
  previewData: null,
  previewShape: null,
  isPreviewLoading: false,
  previewError: null,

  basicCleaningStats: null,
  isStatsLoading: false,
  statsError: null,

  typeMismatchColumns: [],
  isTypeMismatchLoading: false,
  typeMismatchError: null,

  missingColumns: [],
  isMissingLoading: false,
  missingError: null,

  outlierColumns: [],
  isOutlierLoading: false,
  outlierError: null,
  outlierStrategies: {},

  setOutlierStrategy: (column: string, strategy: string) => set((state) => ({
    outlierStrategies: { ...state.outlierStrategies, [column]: strategy },
  })),

  setActiveTab: (id) => set({ activeTabId: id }),

  toggleStepComplete: (id, isComplete) => set((state) => {
    const already = state.completedSteps.includes(id);
    if (isComplete !== undefined) {
      if (isComplete && !already) return { completedSteps: [...state.completedSteps, id] };
      if (!isComplete && already) return { completedSteps: state.completedSteps.filter(s => s !== id) };
      return {};
    }
    return already
      ? { completedSteps: state.completedSteps.filter(s => s !== id) }
      : { completedSteps: [...state.completedSteps, id] };
  }),

  addPipelineAction: (actionConfig) => set((state) => ({
    cleaningPipeline: [...state.cleaningPipeline, actionConfig],
  })),

  clearSubsequentProgress: (invalidStepIds) => set((state) => {
    const newCompleted = state.completedSteps.filter(id => !invalidStepIds.includes(id));
    const newPipeline = state.cleaningPipeline.filter(action => !invalidStepIds.includes(action.step));
    
    // Also reset specific state fields if their step is invalidated
    const resetState: Partial<DataPrepState> = {
      completedSteps: newCompleted,
      cleaningPipeline: newPipeline,
    };

    if (invalidStepIds.includes('imputation')) {
      resetState.missingColumns = [];
    }
    if (invalidStepIds.includes('outliers')) {
      resetState.outlierColumns = [];
      resetState.outlierStrategies = {};
    }

    return resetState;
  }),

  fetchPreviewData: async (sessionId) => {
    set({ isPreviewLoading: true, previewError: null });
    try {
      const { cleaningPipeline } = get();
      const res = await fetch('http://localhost:8000/api/v1/preview-cleaned-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, pipeline: cleaningPipeline }),
      });
      if (!res.ok) throw new Error('Failed to fetch preview data');
      const data = await res.json();
      set({ previewData: data.preview, previewShape: data.shape, isPreviewLoading: false });
    } catch (err: any) {
      set({ previewError: err.message, isPreviewLoading: false });
    }
  },

  // ── Now delegates to dataPrepAPI.ts ─────────────────────────────────────
  fetchBasicCleaningStats: async (sessionId, excludedColumns) => {
    set({ isStatsLoading: true, statsError: null });
    try {
      const data = await apiFetchBasicCleaningStats(sessionId, excludedColumns);
      set({ basicCleaningStats: data, isStatsLoading: false });
    } catch (err: any) {
      set({ statsError: err.message, isStatsLoading: false });
    }
  },

  fetchTypeMismatchStats: async (sessionId, excludedColumns) => {
    set({ isTypeMismatchLoading: true, typeMismatchError: null });
    try {
      const data = await apiFetchTypeMismatchStats(sessionId, excludedColumns);
      set({ typeMismatchColumns: data.mismatched_columns, isTypeMismatchLoading: false });
    } catch (err: any) {
      set({ typeMismatchError: err.message, isTypeMismatchLoading: false });
    }
  },

  fetchMissingStats: async (sessionId, excludedColumns) => {
    set({ isMissingLoading: true, missingError: null });
    try {
      const data = await apiFetchMissingStats(sessionId, excludedColumns);
      set({ missingColumns: data, isMissingLoading: false });
    } catch (err: any) {
      set({ missingError: err.message, isMissingLoading: false });
    }
  },

  fetchOutlierStats: async (sessionId, excludedColumns) => {
    set({ isOutlierLoading: true, outlierError: null });
    try {
      const data = await apiFetchOutlierStats(sessionId, excludedColumns);
      set({ outlierColumns: data, isOutlierLoading: false });
    } catch (err: any) {
      set({ outlierError: err.message, isOutlierLoading: false });
    }
  },

  resetPrep: () => set({
    activeTabId: 'data_cleaning',
    completedSteps: [],
    cleaningPipeline: [],
    previewData: null,
    previewShape: null,
    previewError: null,
    basicCleaningStats: null,
    isStatsLoading: false,
    statsError: null,
    typeMismatchColumns: [],
    isTypeMismatchLoading: false,
    typeMismatchError: null,
    missingColumns: [],
    isMissingLoading: false,
    missingError: null,
    outlierColumns: [],
    isOutlierLoading: false,
    outlierError: null,
    outlierStrategies: {},
  }),
}));
