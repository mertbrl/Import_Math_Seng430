/**
 * dataPrepAPI.ts
 * Single-responsibility: All Data Preparation API calls for Step 3.
 * Components and Zustand stores import from here; never hit fetch() directly.
 */

import type { PipelineConfig } from '../store/pipelineConfig';
import type { MockEDADataset } from '../features/dataExploration/mockEDAData';
import { buildApiUrl } from '../config/apiConfig';

const BASE_URL = buildApiUrl();

// ── Types ───────────────────────────────────────────────────────────────────

export interface BasicCleaningStats {
  session_id: string;
  duplicates_count: number;
  zero_variance_columns: string[];
  excluded_columns_applied: number;
}

export interface TypeMismatchColumn {
  column: string;
  current_type: string;
  suggested_type: string;
  coerce_rate: number;
}

export interface TypeMismatchStats {
  session_id: string;
  mismatched_columns: TypeMismatchColumn[];
  total_mismatches: number;
}

export interface MissingColumnStat {
  column: string;
  missing_count: number;
  missing_percentage: number;
  type: string;
}

export interface OutlierColumnStat {
  column: string;
  type: string;
  distribution: string;
  outlier_count: number;
  outlier_percentage: number;
  recommendation: string;
  recommended_detector?: string;
  recommended_treatment?: string;
  suggestion_reason?: string;
}

export interface FeatureImportanceStat {
  feature: string;
  score: number;
}

export interface PreviewPipelineResponse {
  session_id: string;
  shape: number[];
  preview: Record<string, string | number | null>[];
}

export interface PreprocessingReviewResponse {
  before: MockEDADataset;
  after: MockEDADataset;
  beforeShape: number[];
  afterShape: number[];
  removedColumns: string[];
  addedColumns: string[];
}

interface TransformationCandidate {
  column: string;
  needs_transform: boolean;
  recommendation: string | null;
}

interface TransformationStatsResponse {
  columns: TransformationCandidate[];
}

interface EncodingCandidate {
  column: string;
  recommendation: string;
}

interface EncodingStatsResponse {
  columns: EncodingCandidate[];
}

interface ScalingCandidate {
  column: string;
  recommendation: string;
}

interface ScalingStatsResponse {
  columns: ScalingCandidate[];
}

interface ImbalanceStatsResponse {
  recommendation?: string | null;
  recommended_algorithm?: string;
  recommendation_tag?: string;
}

function chooseAutoPrepSplit(totalRows: number) {
  if (totalRows >= 1000) {
    return {
      strategy: '3-way',
      train: 0.7,
      val: 0.15,
      test: 0.15,
    } as const;
  }

  return {
    strategy: '2-way',
    train: 0.8,
    val: 0,
    test: 0.2,
  } as const;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read the backend error body and throw a descriptive Error. */
async function throwDetailedError(res: Response, label: string): Promise<never> {
  let detail = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    detail = body.error || body.detail || JSON.stringify(body);
  } catch {
    // body wasn't JSON — fall back to status text
    detail += ` ${res.statusText}`;
  }
  console.error(`[${label}] Backend error:`, detail);
  throw new Error(`${label} failed: ${detail}`);
}

async function postJson<T>(path: string, body: Record<string, unknown>, label: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwDetailedError(res, label);
  return res.json();
}

function buildAutoPrepPipelineConfig(
  base: PipelineConfig,
  actions: any[]
): PipelineConfig {
  const actionMap = new Map(actions.map((action) => [action.action, action]));

  return {
    ...base,
    basic_cleaning: {
      drop_duplicates: actionMap.has('drop_duplicates'),
      drop_zero_variance: actionMap.has('drop_zero_variance'),
      zero_variance_columns: actionMap.get('drop_zero_variance')?.columns ?? [],
      cast_to_numeric: actionMap.get('cast_to_numeric')?.columns ?? [],
    },
    sampling: {
      enabled: false,
      method: 'random',
      fraction: 1,
      target: base.target_column || undefined,
    },
    data_split: {
      enabled: actionMap.has('split'),
      strategy: actionMap.get('split')?.strategy ?? '2-way',
      train: actionMap.get('split')?.train ?? 0.8,
      val: actionMap.get('split')?.val ?? 0,
      test: actionMap.get('split')?.test ?? 0.2,
      stratify: Boolean(actionMap.get('split')?.stratify),
      force_resplit: false,
      target: actionMap.get('split')?.target ?? base.target_column ?? undefined,
    },
    imputation: {
      enabled: actionMap.has('impute_missing'),
      strategies: actionMap.get('impute_missing')?.strategies ?? {},
    },
    outliers: {
      enabled: actionMap.has('handle_outliers'),
      strategies: actionMap.get('handle_outliers')?.strategies ?? {},
    },
    transformation: {
      enabled: actionMap.has('apply_transformation'),
      strategies: actionMap.get('apply_transformation')?.strategies ?? {},
    },
    encoding: {
      enabled: actionMap.has('encode_categoricals'),
      strategies: actionMap.get('encode_categoricals')?.strategies ?? {},
    },
    scaling: {
      enabled: actionMap.has('apply_scaling'),
      strategies: actionMap.get('apply_scaling')?.strategies ?? {},
    },
    dimensionality_reduction: base.dimensionality_reduction,
    feature_selection: {
      enabled: actionMap.has('feature_selection'),
      method: actionMap.get('feature_selection')?.method ?? 'manual',
      top_k: actionMap.get('feature_selection')?.top_k,
      selected_features: actionMap.get('feature_selection')?.selected_features ?? [],
    },
    imbalance: {
      enabled: actionMap.has('handle_imbalance'),
      strategy: actionMap.get('handle_imbalance')?.strategy ?? 'none',
    },
  };
}

async function buildAutoPrepFallback(
  sessionId: string,
  imbalanceEnabled: boolean,
  pipelineConfig: PipelineConfig,
  totalRows: number
): Promise<any[]> {
  const excludedColumns = pipelineConfig.excluded_columns ?? [];
  const targetColumn = pipelineConfig.target_column;
  const actions: any[] = [];
  const splitPlan = chooseAutoPrepSplit(totalRows);

  const basicCleaning = await fetchBasicCleaningStats(sessionId, excludedColumns);
  if (basicCleaning.duplicates_count > 0) {
    actions.push({ step: 'data_cleaning', action: 'drop_duplicates', count: basicCleaning.duplicates_count });
  }
  if (basicCleaning.zero_variance_columns.length > 0) {
    actions.push({
      step: 'data_cleaning',
      action: 'drop_zero_variance',
      columns: basicCleaning.zero_variance_columns,
    });
  }

  const typeMismatches = await fetchTypeMismatchStats(sessionId, excludedColumns);
  if (typeMismatches.mismatched_columns.length > 0) {
    actions.push({
      step: 'data_cleaning',
      action: 'cast_to_numeric',
      columns: typeMismatches.mismatched_columns.map((column) => column.column),
    });
  }

  actions.push({
    step: 'data_split',
    action: 'split',
    train: splitPlan.train,
    test: splitPlan.test,
    val: splitPlan.val,
    strategy: splitPlan.strategy,
    stratify: true,
    target: targetColumn,
  });

  const missingStats = await fetchMissingStats(sessionId, excludedColumns);
  const missingStrategies = Object.fromEntries(
    missingStats
      .filter((column) => column.missing_count > 0)
      .map((column) => [column.column, column.type.toLowerCase() === 'categorical' ? 'mode' : 'median'])
  );
  if (Object.keys(missingStrategies).length > 0) {
    actions.push({ step: 'imputation', action: 'impute_missing', strategies: missingStrategies });
  }

  const outlierStats = await fetchOutlierStats(sessionId, excludedColumns);
  const outlierStrategies = Object.fromEntries(
    outlierStats
      .filter((column) => column.outlier_count > 0)
      .map((column) => {
        const normalizedDetector = String(column.recommended_detector ?? 'iqr')
          .trim()
          .toLowerCase()
          .replace(/[- ]+/g, '_');
        return [
          column.column,
          {
            detector: normalizedDetector === 'isolation' ? 'isolation_forest' : normalizedDetector,
            treatment: column.recommended_treatment ?? 'cap_1_99',
          },
        ];
      })
  );
  if (Object.keys(outlierStrategies).length > 0) {
    actions.push({ step: 'outliers', action: 'handle_outliers', strategies: outlierStrategies });
  }

  const transformationStats = await postJson<TransformationStatsResponse>(
    '/transformation-stats',
    { session_id: sessionId, excluded_columns: excludedColumns },
    'transformation-stats'
  );
  const transformationStrategies = Object.fromEntries(
    (transformationStats.columns ?? [])
      .filter((column) => column.needs_transform && column.recommendation)
      .map((column) => [column.column, column.recommendation as string])
  );
  if (Object.keys(transformationStrategies).length > 0) {
    actions.push({
      step: 'transformation',
      action: 'apply_transformation',
      strategies: transformationStrategies,
    });
  }

  const encodingStats = await postJson<EncodingStatsResponse>(
    '/encoding-stats',
    { session_id: sessionId, excluded_columns: excludedColumns, target_column: targetColumn },
    'encoding-stats'
  );
  const encodingStrategies = Object.fromEntries(
    (encodingStats.columns ?? [])
      .filter((column) => column.recommendation)
      .map((column) => [column.column, column.recommendation])
  );
  if (Object.keys(encodingStrategies).length > 0) {
    actions.push({
      step: 'encoding',
      action: 'encode_categoricals',
      strategies: encodingStrategies,
    });
  }

  const scalingStats = await postJson<ScalingStatsResponse>(
    '/scaling-stats',
    { session_id: sessionId, excluded_columns: excludedColumns },
    'scaling-stats'
  );
  const scalingStrategies = Object.fromEntries(
    (scalingStats.columns ?? [])
      .filter((column) => column.recommendation)
      .map((column) => [column.column, column.recommendation])
  );
  if (Object.keys(scalingStrategies).length > 0) {
    actions.push({
      step: 'scaling',
      action: 'apply_scaling',
      strategies: scalingStrategies,
    });
  }

  const rankingConfig = buildAutoPrepPipelineConfig(pipelineConfig, actions);
  const importances = await fetchFeatureImportances(rankingConfig);
  if (importances.length > 0) {
    const targetK = Math.min(10, Math.max(5, importances.length));
    const selectedFeatures = importances.slice(0, targetK).map((item) => item.feature);
    if (selectedFeatures.length < importances.length) {
      actions.push({
        step: 'feature_selection',
        action: 'feature_selection',
        method: 'manual',
        selected_features: selectedFeatures,
      });
    }
  }

  if (imbalanceEnabled) {
    const imbalanceConfig = buildAutoPrepPipelineConfig(pipelineConfig, actions);
    const imbalanceStats = await postJson<ImbalanceStatsResponse>(
      '/imbalance-stats',
      {
        session_id: sessionId,
        target_column: targetColumn,
        excluded_columns: excludedColumns,
        pipeline_config: {
          ...imbalanceConfig,
          imbalance: { enabled: false, strategy: 'none' },
        },
      },
      'imbalance-stats'
    );
    const recommendation = String(
      imbalanceStats.recommendation_tag ??
        imbalanceStats.recommended_algorithm ??
        imbalanceStats.recommendation ??
        ''
    ).toLowerCase();
    if (recommendation.includes('smote') && !recommendation.includes('smotenc')) {
      actions.push({
        step: 'imbalance_handling',
        action: 'handle_imbalance',
        strategy: 'smote',
      });
    }
  }

  return actions;
}

// ── API Calls ────────────────────────────────────────────────────────────────

export async function fetchBasicCleaningStats(
  sessionId: string,
  excludedColumns: string[]
): Promise<BasicCleaningStats> {
  const res = await fetch(`${BASE_URL}/basic-cleaning-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, excluded_columns: excludedColumns }),
  });
  if (!res.ok) await throwDetailedError(res, 'basic-cleaning-stats');
  return res.json();
}

export async function fetchTypeMismatchStats(
  sessionId: string,
  excludedColumns: string[]
): Promise<TypeMismatchStats> {
  const res = await fetch(`${BASE_URL}/type-mismatch-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, excluded_columns: excludedColumns }),
  });
  if (!res.ok) await throwDetailedError(res, 'type-mismatch-stats');
  return res.json();
}

export async function fetchMissingStats(
  sessionId: string,
  excludedColumns: string[]
): Promise<MissingColumnStat[]> {
  const res = await fetch(`${BASE_URL}/missing-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, excluded_columns: excludedColumns }),
  });
  if (!res.ok) await throwDetailedError(res, 'missing-stats');
  return res.json();
}

export async function fetchOutlierStats(
  sessionId: string,
  excludedColumns: string[]
): Promise<OutlierColumnStat[]> {
  const res = await fetch(`${BASE_URL}/outliers-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, excluded_columns: excludedColumns }),
  });
  if (!res.ok) await throwDetailedError(res, 'outliers-stats');
  return res.json();
}

export async function fetchFeatureImportances(
  pipelineConfig: PipelineConfig
): Promise<FeatureImportanceStat[]> {
  const res = await fetch(`${BASE_URL}/feature-importance-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: pipelineConfig.session_id,
      target_column: pipelineConfig.target_column,
      excluded_columns: pipelineConfig.excluded_columns,
      pipeline_config: pipelineConfig,
    }),
  });
  if (!res.ok) await throwDetailedError(res, 'feature-importance-stats');
  return res.json();
}

export async function previewPreprocessedData(
  pipelineConfig: PipelineConfig
): Promise<PreviewPipelineResponse> {
  const res = await fetch(`${BASE_URL}/preview-cleaned-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pipeline_config: pipelineConfig }),
  });
  if (!res.ok) await throwDetailedError(res, 'preview-cleaned-data');
  return res.json();
}

export async function fetchPreprocessingReview(
  pipelineConfig: PipelineConfig
): Promise<PreprocessingReviewResponse> {
  const res = await fetch(`${BASE_URL}/preprocessing-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pipeline_config: pipelineConfig }),
  });
  if (!res.ok) await throwDetailedError(res, 'preprocessing-review');
  return res.json();
}

export async function downloadPreprocessedCSV(
  pipelineConfig: PipelineConfig
): Promise<void> {
  const res = await fetch(`${BASE_URL}/download-preprocessed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pipeline_config: pipelineConfig }),
  });
  if (!res.ok) await throwDetailedError(res, 'download-preprocessed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'preprocessed_data.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


export async function requestAutoPrep(
  sessionId: string,
  imbalanceEnabled: boolean,
  pipelineConfig: PipelineConfig,
  totalRows: number
): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/auto-prep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, imbalance_enabled: imbalanceEnabled }),
  });
  if (res.ok) {
    return res.json();
  }
  if (res.status === 404) {
    return buildAutoPrepFallback(sessionId, imbalanceEnabled, pipelineConfig, totalRows);
  }
  await throwDetailedError(res, 'auto-prep');
}
