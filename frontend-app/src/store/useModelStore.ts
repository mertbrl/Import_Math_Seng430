import { create } from 'zustand';

export type ModelId =
  | 'knn'
  | 'svm'
  | 'dt'
  | 'rf'
  | 'et'
  | 'ada'
  | 'lr'
  | 'nb'
  | 'xgb'
  | 'lgbm'
  | 'catboost';
export type TaskStatus = 'queued' | 'running' | 'cancelling' | 'cancelled' | 'completed' | 'failed';
export type ModelPhase = 'selection' | 'training';
export type SvmKernel = 'linear' | 'rbf' | 'poly';
export type KNNWeights = 'uniform' | 'distance';
export type BinaryClassWeight = 'none' | 'balanced';
export type RFClassWeight = 'none' | 'balanced' | 'balanced_subsample';
export type TreeCriterion = 'gini' | 'entropy' | 'log_loss';
export type SvmGamma = 'scale' | 'auto';
export type RFMaxFeatures = 'sqrt' | 'log2' | 'all';
export type SearchScoring = 'auto' | 'accuracy' | 'f1' | 'precision' | 'recall' | 'roc_auc';
export type ProblemType = 'classification' | 'multiclass' | 'regression';
export type ChampionPreference = 'recall' | 'precision' | 'f1' | 'rmse';

export interface ModelTask {
  taskId: string;
  model: ModelId;
  status: TaskStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface ModelMetrics {
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  sensitivity?: number | null;
  specificity?: number | null;
  f1_score?: number | null;
  auc?: number | null;
  mae?: number | null;
  rmse?: number | null;
  r2?: number | null;
  mape?: number | null;
}

export interface RocCurveLine {
  label: string;
  auc?: number | null;
  fpr: number[];
  tpr: number[];
}

export interface RocCurve {
  mode?: 'binary' | 'multiclass';
  fpr?: number[];
  tpr?: number[];
  curves?: RocCurveLine[];
}

export interface ConfusionMatrix {
  tn?: number;
  fp?: number;
  fn?: number;
  tp?: number;
}

export interface FeatureImportancePoint {
  feature: string;
  importance: number;
}

export interface GridSearchConfig {
  enabled: boolean;
  cv_folds: number;
  scoring: SearchScoring;
  parameter_space: Record<string, string>;
}

export interface SearchCandidate {
  rank: number;
  score: number;
  params: Record<string, unknown>;
}

export interface SearchSummary {
  enabled: boolean;
  mode?: 'manual' | 'preset' | 'custom';
  scope?: string;
  cv_folds?: number;
  scoring?: string | null;
  best_score?: number | null;
  best_params?: Record<string, unknown>;
  candidate_count?: number;
  top_candidates?: SearchCandidate[];
  parameter_space?: Record<string, unknown[]>;
}

export interface ClassDistributionPoint {
  label: string;
  count: number;
  ratio: number;
}

export interface PerClassMetric {
  label: string;
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
}

export interface ConfidenceHistogramBin {
  start: number;
  end: number;
  count: number;
  accuracy?: number | null;
}

export interface ProjectionPoint {
  x: number;
  y: number;
  actual: string;
  predicted: string;
  correct: boolean;
  confidence?: number | null;
}

export interface FullConfusionMatrix {
  labels: string[];
  matrix: number[][];
}

export interface GeneralizationSummary {
  risk?: 'low' | 'moderate' | 'high';
  selection_split?: 'validation' | 'test';
  train_minus_selection_f1?: number;
  train_minus_test_f1?: number;
  primary_metric_name?: 'f1_score' | 'rmse';
  primary_metric_direction?: 'higher_is_better' | 'lower_is_better';
  train_minus_selection?: number | null;
  train_minus_test?: number | null;
  notes?: string[];
}

export interface SplitMetricMap {
  train?: ModelMetrics;
  validation?: ModelMetrics;
  test?: ModelMetrics;
}

export interface ModelVisualization {
  split_summary?: {
    selection_split: 'validation' | 'test';
    train_rows: number;
    validation_rows: number;
    test_rows: number;
    class_distribution?: {
      train?: ClassDistributionPoint[];
      validation?: ClassDistributionPoint[];
      test?: ClassDistributionPoint[];
    };
  };
  split_metrics?: SplitMetricMap;
  generalization?: GeneralizationSummary;
  feature_signal_source?: string | null;
  per_class_metrics?: PerClassMetric[];
  confusion_matrix_full?: FullConfusionMatrix;
  confidence_histogram?: ConfidenceHistogramBin[];
  projection?: {
    method?: string;
    explained_variance?: number[];
    points?: ProjectionPoint[];
    sample_size?: number;
  };
}

export interface ModelResult {
  runId?: string;
  modelId?: string;
  model: ModelId;
  taskId: string;
  problem_type?: ProblemType;
  metrics: ModelMetrics;
  confusion_matrix: ConfusionMatrix;
  evaluation_split?: 'validation' | 'test';
  search?: SearchSummary;
  visualization?: ModelVisualization;
  train_metrics?: ModelMetrics;
  test_metrics?: ModelMetrics;
  test_confusion_matrix?: ConfusionMatrix;
  test_roc_curve?: RocCurve;
  test_visualization?: ModelVisualization;
  roc_curve?: RocCurve;
  feature_importance?: FeatureImportancePoint[];
  feature_importance_source?: string;
  parameters: Record<string, unknown>;
}

export interface ModelParamsById {
  knn: { k: number; weights: KNNWeights; p: 1 | 2 };
  svm: { c: number; kernel: SvmKernel; gamma: SvmGamma; degree: number; class_weight: BinaryClassWeight };
  dt: { criterion: TreeCriterion; max_depth: number; min_samples_split: number; min_samples_leaf: number; class_weight: BinaryClassWeight };
  rf: {
    criterion: TreeCriterion;
    n_estimators: number;
    max_depth: number;
    min_samples_split: number;
    min_samples_leaf: number;
    max_features: RFMaxFeatures;
    bootstrap: boolean;
    class_weight: RFClassWeight;
  };
  et: {
    criterion: TreeCriterion;
    n_estimators: number;
    max_depth: number;
    min_samples_split: number;
    min_samples_leaf: number;
    max_features: RFMaxFeatures;
    bootstrap: boolean;
    class_weight: RFClassWeight;
  };
  ada: { n_estimators: number; learning_rate: number; estimator_depth: number };
  lr: { c: number; max_iter: number; class_weight: BinaryClassWeight };
  nb: { var_smoothing: number };
  xgb: {
    n_estimators: number;
    max_depth: number;
    learning_rate: number;
    subsample: number;
    colsample_bytree: number;
    reg_lambda: number;
  };
  lgbm: {
    n_estimators: number;
    max_depth: number;
    learning_rate: number;
    num_leaves: number;
    subsample: number;
    colsample_bytree: number;
  };
  catboost: {
    iterations: number;
    depth: number;
    learning_rate: number;
    l2_leaf_reg: number;
  };
}

interface ModelState {
  phase: ModelPhase;
  activeVizModel: ModelId;
  modelParams: ModelParamsById;
  searchConfigs: Record<ModelId, GridSearchConfig>;
  tasks: Record<string, ModelTask>;
  results: Record<string, ModelResult>;
  bestResultTaskId: string | null;
  championPreference: ChampionPreference;
  setActiveVizModel: (model: ModelId) => void;
  setPhase: (phase: ModelPhase) => void;
  setChampionPreference: (preference: ChampionPreference) => void;
  setModelParam: <T extends ModelId>(model: T, patch: Partial<ModelParamsById[T]>) => void;
  setSearchConfig: (model: ModelId, patch: Partial<GridSearchConfig>) => void;
  setTask: (taskId: string, task: Partial<ModelTask> & Pick<ModelTask, 'taskId' | 'model'>) => void;
  setResult: (taskId: string, result: ModelResult) => void;
  clearFinishedHistory: () => void;
  reset: () => void;
  resetAll: () => void;
}

const DEFAULT_MODEL_PARAMS: ModelParamsById = {
  knn: { k: 5, weights: 'uniform', p: 2 },
  svm: { c: 1, kernel: 'rbf', gamma: 'scale', degree: 3, class_weight: 'none' },
  dt: { criterion: 'gini', max_depth: 5, min_samples_split: 2, min_samples_leaf: 1, class_weight: 'none' },
  rf: {
    criterion: 'gini',
    n_estimators: 100,
    max_depth: 10,
    min_samples_split: 2,
    min_samples_leaf: 1,
    max_features: 'sqrt',
    bootstrap: true,
    class_weight: 'none',
  },
  et: {
    criterion: 'gini',
    n_estimators: 150,
    max_depth: 10,
    min_samples_split: 2,
    min_samples_leaf: 1,
    max_features: 'sqrt',
    bootstrap: false,
    class_weight: 'none',
  },
  ada: { n_estimators: 100, learning_rate: 0.5, estimator_depth: 1 },
  lr: { c: 1, max_iter: 1000, class_weight: 'none' },
  nb: { var_smoothing: 1e-9 },
  xgb: {
    n_estimators: 200,
    max_depth: 6,
    learning_rate: 0.1,
    subsample: 1,
    colsample_bytree: 1,
    reg_lambda: 1,
  },
  lgbm: {
    n_estimators: 200,
    max_depth: -1,
    learning_rate: 0.1,
    num_leaves: 31,
    subsample: 1,
    colsample_bytree: 1,
  },
  catboost: {
    iterations: 200,
    depth: 6,
    learning_rate: 0.1,
    l2_leaf_reg: 3,
  },
};

const DEFAULT_SEARCH_CONFIGS: Record<ModelId, GridSearchConfig> = {
  knn: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
  svm: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
  dt: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
  rf: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
  et: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
  ada: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
  lr: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
  nb: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
  xgb: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
  lgbm: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
  catboost: { enabled: false, cv_folds: 5, scoring: 'auto', parameter_space: {} },
};

function cloneDefaultModelParams(): ModelParamsById {
  return {
    knn: { ...DEFAULT_MODEL_PARAMS.knn },
    svm: { ...DEFAULT_MODEL_PARAMS.svm },
    dt: { ...DEFAULT_MODEL_PARAMS.dt },
    rf: { ...DEFAULT_MODEL_PARAMS.rf },
    et: { ...DEFAULT_MODEL_PARAMS.et },
    ada: { ...DEFAULT_MODEL_PARAMS.ada },
    lr: { ...DEFAULT_MODEL_PARAMS.lr },
    nb: { ...DEFAULT_MODEL_PARAMS.nb },
    xgb: { ...DEFAULT_MODEL_PARAMS.xgb },
    lgbm: { ...DEFAULT_MODEL_PARAMS.lgbm },
    catboost: { ...DEFAULT_MODEL_PARAMS.catboost },
  };
}

function cloneDefaultSearchConfigs(): Record<ModelId, GridSearchConfig> {
  return {
    knn: { ...DEFAULT_SEARCH_CONFIGS.knn, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.knn.parameter_space } },
    svm: { ...DEFAULT_SEARCH_CONFIGS.svm, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.svm.parameter_space } },
    dt: { ...DEFAULT_SEARCH_CONFIGS.dt, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.dt.parameter_space } },
    rf: { ...DEFAULT_SEARCH_CONFIGS.rf, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.rf.parameter_space } },
    et: { ...DEFAULT_SEARCH_CONFIGS.et, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.et.parameter_space } },
    ada: { ...DEFAULT_SEARCH_CONFIGS.ada, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.ada.parameter_space } },
    lr: { ...DEFAULT_SEARCH_CONFIGS.lr, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.lr.parameter_space } },
    nb: { ...DEFAULT_SEARCH_CONFIGS.nb, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.nb.parameter_space } },
    xgb: { ...DEFAULT_SEARCH_CONFIGS.xgb, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.xgb.parameter_space } },
    lgbm: { ...DEFAULT_SEARCH_CONFIGS.lgbm, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.lgbm.parameter_space } },
    catboost: { ...DEFAULT_SEARCH_CONFIGS.catboost, parameter_space: { ...DEFAULT_SEARCH_CONFIGS.catboost.parameter_space } },
  };
}

function getInitialState() {
  return {
    phase: 'selection' as ModelPhase,
    activeVizModel: 'knn' as ModelId,
    modelParams: cloneDefaultModelParams(),
    searchConfigs: cloneDefaultSearchConfigs(),
    tasks: {} as Record<string, ModelTask>,
    results: {} as Record<string, ModelResult>,
    bestResultTaskId: null as string | null,
    championPreference: 'f1' as ChampionPreference,
  };
}

function getEffectiveMetrics(result: ModelResult): ModelMetrics {
  return result.test_metrics ?? result.metrics;
}

function getGeneralizationGap(result: ModelResult): number {
  const generalization = result.test_visualization?.generalization ?? result.visualization?.generalization;
  const directGap = generalization?.train_minus_test ?? generalization?.train_minus_selection;
  if (typeof directGap === 'number') {
    return Math.max(0, directGap);
  }
  const fallbackGap = generalization?.train_minus_test_f1 ?? generalization?.train_minus_selection_f1 ?? 0;
  return Math.max(0, fallbackGap);
}

function getOverfitPenalty(result: ModelResult): number {
  const generalization = result.test_visualization?.generalization ?? result.visualization?.generalization;
  const riskPenalty =
    generalization?.risk === 'high'
      ? 0.08
      : generalization?.risk === 'moderate'
        ? 0.035
        : 0;
  return riskPenalty + getGeneralizationGap(result) * 0.6;
}

function compareResultsForPreference(
  left: ModelResult,
  right: ModelResult,
  preference: ChampionPreference,
): number {
  const leftMetrics = getEffectiveMetrics(left);
  const rightMetrics = getEffectiveMetrics(right);
  const leftPenalty = getOverfitPenalty(left);
  const rightPenalty = getOverfitPenalty(right);

  if (preference === 'rmse') {
    const leftScore = (leftMetrics.rmse ?? Number.POSITIVE_INFINITY) + leftPenalty;
    const rightScore = (rightMetrics.rmse ?? Number.POSITIVE_INFINITY) + rightPenalty;
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }
    return (rightMetrics.r2 ?? Number.NEGATIVE_INFINITY) - (leftMetrics.r2 ?? Number.NEGATIVE_INFINITY);
  }

  const metricKey = preference === 'recall' ? 'recall' : preference === 'precision' ? 'precision' : 'f1_score';
  const leftScore = (leftMetrics[metricKey] ?? 0) - leftPenalty;
  const rightScore = (rightMetrics[metricKey] ?? 0) - rightPenalty;
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }
  const fallbackF1 = (rightMetrics.f1_score ?? 0) - (leftMetrics.f1_score ?? 0);
  if (fallbackF1 !== 0) {
    return fallbackF1;
  }
  return (rightMetrics.accuracy ?? 0) - (leftMetrics.accuracy ?? 0);
}

function pickBestResultTaskId(
  results: Record<string, ModelResult>,
  preference: ChampionPreference,
): string | null {
  const entries = Object.entries(results);
  if (entries.length === 0) {
    return null;
  }

  entries.sort(([, left], [, right]) => compareResultsForPreference(left, right, preference));

  return entries[0][0];
}

export const useModelStore = create<ModelState>((set) => ({
  ...getInitialState(),

  setActiveVizModel: (model) => set({ activeVizModel: model }),
  setPhase: (phase) => set({ phase }),
  setChampionPreference: (preference) =>
    set((state) => ({
      championPreference: preference,
      bestResultTaskId: pickBestResultTaskId(state.results, preference),
    })),

  setModelParam: (model, patch) =>
    set((state) => ({
      modelParams: {
        ...state.modelParams,
        [model]: {
          ...state.modelParams[model],
          ...patch,
        },
      },
    })),

  setSearchConfig: (model, patch) =>
    set((state) => ({
      searchConfigs: {
        ...state.searchConfigs,
        [model]: {
          ...state.searchConfigs[model],
          ...patch,
        },
      },
    })),

  setTask: (taskId, task) =>
    set((state) => ({
      tasks: {
        ...state.tasks,
        [taskId]: {
          ...state.tasks[taskId],
          ...task,
        } as ModelTask,
      },
    })),

  setResult: (taskId, result) =>
    set((state) => {
      const nextResults = {
        ...state.results,
        [taskId]: result,
      };

      return {
        results: nextResults,
        bestResultTaskId: pickBestResultTaskId(nextResults, state.championPreference),
      };
    }),

  clearFinishedHistory: () =>
    set((state) => {
      const nextTasks = Object.fromEntries(
        Object.entries(state.tasks).filter(([, task]) => !['completed', 'failed', 'cancelled'].includes(task.status))
      );
      const nextResults = Object.fromEntries(Object.entries(state.results).filter(([taskId]) => nextTasks[taskId]));

      return {
        tasks: nextTasks,
        results: nextResults,
        bestResultTaskId: pickBestResultTaskId(nextResults, state.championPreference),
      };
    }),

  reset: () =>
    set((state) => ({
      phase: 'selection',
      activeVizModel: state.activeVizModel,
    })),

  resetAll: () => set(getInitialState()),
}));
