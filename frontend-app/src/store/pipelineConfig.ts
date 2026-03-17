import { useEDAStore } from './useEDAStore';
import { useDataPrepStore } from './useDataPrepStore';

export interface PipelineConfig {
  session_id: string;
  target_column: string;
  problem_type: 'classification' | 'regression' | 'multiclass';
  excluded_columns: string[];
  basic_cleaning: {
    drop_duplicates: boolean;
    drop_zero_variance: boolean;
    zero_variance_columns: string[];
    cast_to_numeric: string[];
  };
  sampling: {
    enabled: boolean;
    method: string;
    fraction: number;
    target?: string;
  };
  data_split: {
    enabled: boolean;
    strategy: string;
    train: number;
    val: number;
    test: number;
    stratify: boolean;
    target?: string;
  };
  imputation: {
    enabled: boolean;
    strategies: Record<string, string>;
  };
  outliers: {
    enabled: boolean;
    strategies: Record<string, string>;
  };
  transformation: {
    enabled: boolean;
    strategies: Record<string, string>;
  };
  encoding: {
    enabled: boolean;
    strategies: Record<string, string>;
  };
  scaling: {
    enabled: boolean;
    strategies: Record<string, string>;
  };
  dimensionality_reduction: {
    enabled: boolean;
    actions: Record<string, string>;
    use_pca: boolean;
    pca_variance: number;
  };
  feature_selection: {
    enabled: boolean;
    method: string;
    top_k?: number;
    selected_features: string[];
  };
  imbalance: {
    enabled: boolean;
    strategy: string;
  };
}

export function getEffectiveExcludedColumns(
  ignoredColumns: string[] = [],
  targetColumn?: string
): string[] {
  return ignoredColumns.filter((column) => column && column !== targetColumn);
}

export function buildPipelineConfig(sessionId = 'demo-session'): PipelineConfig {
  const edaState = useEDAStore.getState();
  const prepState = useDataPrepStore.getState();
  const actionMap = new Map(
    prepState.cleaningPipeline.map((action) => [action.action, action])
  );

  const sampleAction = actionMap.get('sample');
  const splitAction = actionMap.get('split');
  const imputationAction = actionMap.get('impute_missing');
  const outlierAction = actionMap.get('handle_outliers');
  const transformationAction = actionMap.get('apply_transformation');
  const encodingAction = actionMap.get('encode_categoricals');
  const scalingAction = actionMap.get('apply_scaling');
  const dimensionalityAction = actionMap.get('reduce_features');
  const featureSelectionAction = actionMap.get('feature_selection');
  const imbalanceAction = actionMap.get('handle_imbalance');

  return {
    session_id: sessionId,
    target_column: edaState.targetColumn || '',
    problem_type: edaState.mlTask,
    excluded_columns: getEffectiveExcludedColumns(edaState.ignoredColumns, edaState.targetColumn),
    basic_cleaning: {
      drop_duplicates: actionMap.has('drop_duplicates'),
      drop_zero_variance: actionMap.has('drop_zero_variance'),
      zero_variance_columns: actionMap.get('drop_zero_variance')?.columns ?? [],
      cast_to_numeric: actionMap.get('cast_to_numeric')?.columns ?? [],
    },
    sampling: {
      enabled: Boolean(sampleAction),
      method: sampleAction?.method ?? 'random',
      fraction: sampleAction?.fraction ?? 1,
      target: sampleAction?.target ?? edaState.targetColumn ?? undefined,
    },
    data_split: {
      enabled: Boolean(splitAction),
      strategy: splitAction?.strategy ?? '2-way',
      train: splitAction?.train ?? 0.8,
      val: splitAction?.val ?? 0,
      test: splitAction?.test ?? 0.2,
      stratify: Boolean(splitAction?.stratify),
      target: splitAction?.target ?? edaState.targetColumn ?? undefined,
    },
    imputation: {
      enabled: Boolean(imputationAction),
      strategies: imputationAction?.strategies ?? {},
    },
    outliers: {
      enabled: Boolean(outlierAction),
      strategies: outlierAction?.strategies ?? {},
    },
    transformation: {
      enabled: Boolean(transformationAction),
      strategies: transformationAction?.strategies ?? {},
    },
    encoding: {
      enabled: Boolean(encodingAction),
      strategies: encodingAction?.strategies ?? {},
    },
    scaling: {
      enabled: Boolean(scalingAction),
      strategies: scalingAction?.strategies ?? {},
    },
    dimensionality_reduction: {
      enabled: Boolean(dimensionalityAction),
      actions: dimensionalityAction?.actions ?? {},
      use_pca: Boolean(dimensionalityAction?.use_pca),
      pca_variance: dimensionalityAction?.pca_variance ?? 95,
    },
    feature_selection: {
      enabled: Boolean(featureSelectionAction),
      method: featureSelectionAction?.method ?? 'manual',
      top_k: featureSelectionAction?.top_k,
      selected_features: featureSelectionAction?.selected_features ?? [],
    },
    imbalance: {
      enabled: Boolean(imbalanceAction),
      strategy: imbalanceAction?.strategy ?? 'none',
    },
  };
}
