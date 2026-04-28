import { getModelCatalogEntry } from './modelCatalog';
import { ModelId, ProblemType } from '../../store/useModelStore';

function shortNumber(value: unknown, digits = 2): string {
  if (typeof value !== 'number') {
    return String(value);
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

export function summarizeRunParameters(
  model: ModelId,
  params: Record<string, unknown>,
  problemType: ProblemType = 'classification',
): string[] {
  if (problemType === 'regression') {
    if (model === 'lr') {
      return [String(params.fit_intercept ?? true) === 'true' ? 'intercept' : 'no intercept'];
    }
    if (model === 'nb') {
      return [`alpha=${shortNumber(params.alpha)}`];
    }
    if (model === 'svm') {
      return [String(params.kernel ?? 'rbf'), `C=${shortNumber(params.c)}`, `eps=${shortNumber(params.epsilon)}`];
    }
  }
  if (model === 'knn') {
    return [`k=${shortNumber(params.k)}`, String(params.weights ?? 'uniform')];
  }
  if (model === 'svm') {
    return [String(params.kernel ?? 'rbf'), `C=${shortNumber(params.c)}`];
  }
  if (model === 'dt') {
    return [`depth=${shortNumber(params.max_depth)}`, `leaf=${shortNumber(params.min_samples_leaf)}`];
  }
  if (model === 'rf' || model === 'et') {
    return [`trees=${shortNumber(params.n_estimators)}`, `depth=${shortNumber(params.max_depth)}`];
  }
  if (model === 'ada') {
    return [`rounds=${shortNumber(params.n_estimators)}`, `lr=${shortNumber(params.learning_rate)}`];
  }
  if (model === 'lr') {
    return [`C=${shortNumber(params.c)}`, `iter=${shortNumber(params.max_iter)}`];
  }
  if (model === 'nb') {
    return [`smooth=${shortNumber(params.var_smoothing, 4)}`];
  }
  if (model === 'xgb') {
    return [`trees=${shortNumber(params.n_estimators)}`, `depth=${shortNumber(params.max_depth)}`, `lr=${shortNumber(params.learning_rate)}`];
  }
  if (model === 'lgbm') {
    return [`trees=${shortNumber(params.n_estimators)}`, `leaves=${shortNumber(params.num_leaves)}`, `lr=${shortNumber(params.learning_rate)}`];
  }
  return [`iters=${shortNumber(params.iterations)}`, `depth=${shortNumber(params.depth)}`, `lr=${shortNumber(params.learning_rate)}`];
}

export function buildRunLabel(
  model: ModelId,
  params: Record<string, unknown>,
  occurrence: number,
  problemType: ProblemType = 'classification',
): string {
  const details = summarizeRunParameters(model, params, problemType).slice(0, 3).join(' | ');
  return `${getModelCatalogEntry(model, problemType).name} #${occurrence}${details ? ` | ${details}` : ''}`;
}
