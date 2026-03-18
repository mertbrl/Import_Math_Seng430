import { create } from 'zustand';
import {
  fetchBasicCleaningStats as apiFetchBasicCleaningStats,
  fetchTypeMismatchStats as apiFetchTypeMismatchStats,
  fetchMissingStats as apiFetchMissingStats,
  fetchOutlierStats as apiFetchOutlierStats,
  fetchFeatureImportances as apiFetchFeatureImportances,
  previewPreprocessedData as apiPreviewPreprocessedData,
  type BasicCleaningStats,
  type TypeMismatchColumn,
  type MissingColumnStat,
  type OutlierColumnStat,
  type FeatureImportanceStat,
} from '../api/dataPrepAPI';
import type { PipelineConfig } from './pipelineConfig';
import { PREP_TABS } from '../features/dataPreparation/DataPrepTabsConfig';

export interface OutlierStrategyPlan {
  detector: string;
  treatment: string;
}

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
  outlierStrategies: Record<string, OutlierStrategyPlan>;
  setOutlierStrategy: (column: string, strategy: Partial<OutlierStrategyPlan>) => void;

  // Step 09 - Feature Selection (Before SMOTE)
  featureImportances: FeatureImportanceStat[];
  isFeatureImportancesLoading: boolean;
  featureImportancesError: string | null;
  featureSelection: { method: string; top_k?: number; selected_features?: string[] } | null;
  setFeatureSelection: (selection: { method: string; top_k?: number; selected_features?: string[] }) => void;

  setActiveTab: (id: string) => void;
  toggleStepComplete: (id: string, isComplete?: boolean) => void;
  addPipelineAction: (actionConfig: any) => void;
  fetchPreviewData: (sessionId: string, pipelineConfig: PipelineConfig) => Promise<void>;
  fetchBasicCleaningStats: (sessionId: string, excludedColumns: string[]) => Promise<void>;
  fetchTypeMismatchStats: (sessionId: string, excludedColumns: string[]) => Promise<void>;
  fetchMissingStats: (sessionId: string, excludedColumns: string[]) => Promise<void>;
  fetchOutlierStats: (sessionId: string, excludedColumns: string[]) => Promise<void>;
  fetchFeatureImportances: (pipelineConfig: PipelineConfig) => Promise<void>;
  clearSubsequentProgress: (invalidStepIds: string[]) => void;
  confirmAndInvalidateLaterSteps: (stepId: string, warningMessage?: string) => boolean;
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

  setOutlierStrategy: (column: string, strategy: Partial<OutlierStrategyPlan>) => set((state) => ({
    outlierStrategies: {
      ...state.outlierStrategies,
      [column]: {
        detector: state.outlierStrategies[column]?.detector ?? 'iqr',
        treatment: state.outlierStrategies[column]?.treatment ?? 'ignore',
        ...strategy,
      },
    },
  })),

  featureImportances: [],
  isFeatureImportancesLoading: false,
  featureImportancesError: null,
  featureSelection: null,
  setFeatureSelection: (selection) => set({ featureSelection: selection }),

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
    cleaningPipeline: [
      ...state.cleaningPipeline.filter((action) => action.action !== actionConfig.action),
      actionConfig,
    ],
  })),

  clearSubsequentProgress: (invalidStepIds) => set((state) => {
    const newCompleted = state.completedSteps.filter(id => !invalidStepIds.includes(id));
    const newPipeline = state.cleaningPipeline.filter(action => !invalidStepIds.includes(action.step));
    
    // Also reset specific state fields if their step is invalidated
    const resetState: Partial<DataPrepState> = {
      completedSteps: newCompleted,
      cleaningPipeline: newPipeline,
      previewData: null,
      previewShape: null,
      previewError: null,
    };

    if (invalidStepIds.includes('imputation')) {
      resetState.missingColumns = [];
    }
    if (invalidStepIds.includes('outliers')) {
      resetState.outlierColumns = [];
      resetState.outlierStrategies = {};
    }
    if (invalidStepIds.includes('feature_selection')) {
      resetState.featureSelection = null;
      resetState.featureImportances = [];
    }

    return resetState;
  }),

  confirmAndInvalidateLaterSteps: (stepId, warningMessage) => {
    const currentIndex = PREP_TABS.findIndex((tab) => tab.id === stepId);
    if (currentIndex === -1) return true;

    const stepsToReset = PREP_TABS.slice(currentIndex + 1).map((tab) => tab.id);
    if (stepsToReset.length === 0) return true;

    const { completedSteps, clearSubsequentProgress } = get();
    const hasCompletedAhead = stepsToReset.some((id) => completedSteps.includes(id));
    if (!hasCompletedAhead) return true;

    const confirmed = window.confirm(
      warningMessage ?? 'Applying this change will remove all completed work in the later steps. Do you want to continue?'
    );
    if (!confirmed) return false;

    clearSubsequentProgress(stepsToReset);
    return true;
  },

  fetchPreviewData: async (_sessionId, pipelineConfig) => {
    set({ isPreviewLoading: true, previewError: null });
    try {
      const data = await apiPreviewPreprocessedData(pipelineConfig);
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

  fetchFeatureImportances: async (pipelineConfig) => {
    set({ isFeatureImportancesLoading: true, featureImportancesError: null });
    try {
      const data = await apiFetchFeatureImportances(pipelineConfig);
      set({ featureImportances: data, isFeatureImportancesLoading: false });
    } catch (err: any) {
      set({ featureImportancesError: err.message, isFeatureImportancesLoading: false });
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
    featureImportances: [],
    isFeatureImportancesLoading: false,
    featureImportancesError: null,
    featureSelection: null,
  }),
}));
