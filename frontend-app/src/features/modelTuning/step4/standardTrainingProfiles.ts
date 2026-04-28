import { DOCTOR_CLASSIFICATION_MODEL_ORDER, REGRESSION_MODEL_ORDER } from '../modelCatalog';
import { ChampionPreference, ModelId, ProblemType } from '../../../store/useModelStore';

type ClassificationFocus = Exclude<ChampionPreference, 'rmse'>;

export interface AutoTrainingPlanItem {
  model: ModelId;
  parameters: Record<string, unknown>;
  search_config: Record<string, unknown>;
}

export interface StandardSettingNote {
  label: string;
  value: string;
}

function rowsAwareK(totalRows: number): number {
  if (totalRows >= 4000) return 11;
  if (totalRows >= 2000) return 9;
  if (totalRows >= 800) return 7;
  return 5;
}

function rowsAwareSvmKernel(totalRows: number): 'linear' | 'rbf' {
  return totalRows >= 2500 ? 'linear' : 'rbf';
}

export function buildClassificationAutoPlan(
  focus: ClassificationFocus,
  totalRows: number,
): AutoTrainingPlanItem[] {
  const classWeight = focus === 'precision' ? 'none' : 'balanced';
  const forestClassWeight = focus === 'precision' ? 'none' : 'balanced_subsample';
  const kernel = rowsAwareSvmKernel(totalRows);
  const k = rowsAwareK(totalRows);

  const profiles: Record<ModelId, Record<string, unknown>> = {
    knn: { k, weights: 'distance', p: 2 },
    svm: { c: 1.2, kernel, gamma: 'scale', degree: 3, class_weight: classWeight },
    dt: { criterion: 'gini', max_depth: 8, min_samples_split: 6, min_samples_leaf: 2, class_weight: classWeight },
    lr: { c: 1.0, max_iter: 1200, class_weight: classWeight },
    nb: { var_smoothing: 1e-9 },
    rf: {
      criterion: 'gini',
      n_estimators: 180,
      max_depth: 12,
      min_samples_split: 4,
      min_samples_leaf: 2,
      max_features: 'sqrt',
      bootstrap: true,
      class_weight: forestClassWeight,
    },
    et: {
      criterion: 'gini',
      n_estimators: 220,
      max_depth: 12,
      min_samples_split: 4,
      min_samples_leaf: 2,
      max_features: 'sqrt',
      bootstrap: false,
      class_weight: forestClassWeight,
    },
    ada: { n_estimators: 120, learning_rate: 0.5, estimator_depth: 2 },
    xgb: { n_estimators: 220, max_depth: 5, learning_rate: 0.08, subsample: 0.9, colsample_bytree: 0.8, reg_lambda: 1.5 },
    lgbm: { n_estimators: 220, max_depth: -1, learning_rate: 0.08, num_leaves: 31, subsample: 0.9, colsample_bytree: 0.8 },
    catboost: { iterations: 220, depth: 6, learning_rate: 0.08, l2_leaf_reg: 4 },
  };

  return DOCTOR_CLASSIFICATION_MODEL_ORDER.map((model) => ({
    model,
    parameters: profiles[model],
    search_config: { enabled: false },
  }));
}

export function buildRegressionAutoPlan(totalRows: number): AutoTrainingPlanItem[] {
  const kernel = rowsAwareSvmKernel(totalRows);
  const k = rowsAwareK(totalRows);

  const profiles: Record<ModelId, Record<string, unknown>> = {
    knn: { k, weights: 'distance', p: 2 },
    svm: { c: 2.0, kernel, gamma: 'scale', degree: 3, epsilon: 0.1 },
    dt: { criterion: 'squared_error', max_depth: 10, min_samples_split: 6, min_samples_leaf: 2 },
    lr: { fit_intercept: true },
    nb: { alpha: 1.0 },
    rf: { n_estimators: 220, max_depth: 14, min_samples_split: 4, min_samples_leaf: 2, max_features: 'sqrt', bootstrap: true },
    et: { n_estimators: 260, max_depth: 14, min_samples_split: 4, min_samples_leaf: 2, max_features: 'sqrt', bootstrap: false },
    ada: { n_estimators: 180, learning_rate: 0.05, estimator_depth: 4 },
    xgb: { n_estimators: 260, max_depth: 6, learning_rate: 0.05, subsample: 0.85, colsample_bytree: 0.85, reg_lambda: 1.5 },
    lgbm: { n_estimators: 260, max_depth: -1, learning_rate: 0.05, num_leaves: 31, subsample: 0.85, colsample_bytree: 0.85 },
    catboost: { iterations: 260, depth: 6, learning_rate: 0.05, l2_leaf_reg: 4 },
  };

  return REGRESSION_MODEL_ORDER.map((model) => ({
    model,
    parameters: profiles[model],
    search_config: { enabled: false },
  }));
}

export function buildStandardSettingNotes(
  problemType: ProblemType,
  focus: ClassificationFocus,
  totalRows: number,
): StandardSettingNote[] {
  if (problemType === 'regression') {
    return [
      { label: 'Model pack', value: '11 regressors with fixed standard settings' },
      { label: 'Champion rule', value: 'Lowest prediction error first, then lower overfit risk' },
      { label: 'Linear baseline', value: 'Linear Regression + Ridge Regression' },
      { label: 'Boosting depth', value: 'Tree boosters kept at depth 6 for speed/stability' },
      { label: 'SVM kernel', value: rowsAwareSvmKernel(totalRows) === 'linear' ? 'Linear on larger tables' : 'RBF on compact tables' },
    ];
  }

  return [
    { label: 'Model pack', value: '10 classification models from the data scientist catalog' },
    {
      label: 'Champion rule',
      value:
        focus === 'recall'
          ? 'Catch as many real patients as possible, then prefer lower overfit risk'
          : focus === 'precision'
            ? 'Raise alerts only when likely correct, then prefer lower overfit risk'
            : 'Balance missed cases and false alarms, then prefer lower overfit risk',
    },
    { label: 'Imbalance handling', value: focus === 'precision' ? 'Balanced weights disabled by default' : 'Balanced class weights enabled where supported' },
    { label: 'KNN baseline', value: `k=${rowsAwareK(totalRows)} with distance weighting` },
    { label: 'SVM kernel', value: rowsAwareSvmKernel(totalRows) === 'linear' ? 'Linear on larger tables' : 'RBF on compact tables' },
  ];
}
