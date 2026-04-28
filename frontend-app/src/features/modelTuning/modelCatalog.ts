import { ModelId, ProblemType } from '../../store/useModelStore';

export interface ModelCatalogEntry {
  id: ModelId;
  name: string;
  short: string;
  family: 'classic' | 'ensemble' | 'boosting';
  description: string;
  tone: string;
  accent: string;
  soft: string;
}

export const MODEL_ORDER: ModelId[] = [
  'knn',
  'svm',
  'dt',
  'lr',
  'nb',
  'rf',
  'et',
  'ada',
  'xgb',
  'lgbm',
  'catboost',
];

export const DOCTOR_CLASSIFICATION_MODEL_ORDER: ModelId[] = [
  'knn',
  'svm',
  'dt',
  'lr',
  'rf',
  'et',
  'ada',
  'xgb',
  'lgbm',
  'catboost',
];

export const REGRESSION_MODEL_ORDER: ModelId[] = [
  'knn',
  'svm',
  'dt',
  'lr',
  'nb',
  'rf',
  'et',
  'ada',
  'xgb',
  'lgbm',
  'catboost',
];

export const MODEL_FAMILIES: Array<{ id: ModelCatalogEntry['family']; label: string; description: string }> = [
  { id: 'classic', label: 'Classic Models', description: 'Fast baselines and interpretable foundations.' },
  { id: 'ensemble', label: 'Ensemble Methods', description: 'Multiple weak learners combined for stronger performance.' },
  { id: 'boosting', label: 'Gradient Boosting', description: 'Modern boosted tree families for harder tabular problems.' },
];

export const MODEL_CATALOG: Record<ModelId, ModelCatalogEntry> = {
  knn: {
    id: 'knn',
    name: 'K-Nearest Neighbors',
    short: 'KNN',
    family: 'classic',
    description: 'Instance-based baseline that reacts to local neighborhoods.',
    tone: 'bg-sky-50 border-sky-200',
    accent: 'text-sky-700',
    soft: 'border-sky-200 bg-sky-50/70',
  },
  svm: {
    id: 'svm',
    name: 'Support Vector Machine',
    short: 'SVM',
    family: 'classic',
    description: 'Strong margin-based model that can fit both linear and curved boundaries.',
    tone: 'bg-amber-50 border-amber-200',
    accent: 'text-amber-700',
    soft: 'border-amber-200 bg-amber-50/70',
  },
  dt: {
    id: 'dt',
    name: 'Decision Tree',
    short: 'DT',
    family: 'classic',
    description: 'Readable rule-based model that is easy to inspect but can overfit quickly.',
    tone: 'bg-lime-50 border-lime-200',
    accent: 'text-lime-700',
    soft: 'border-lime-200 bg-lime-50/70',
  },
  lr: {
    id: 'lr',
    name: 'Logistic Regression',
    short: 'LR',
    family: 'classic',
    description: 'Reliable linear baseline and a good first sanity check for tabular classification.',
    tone: 'bg-blue-50 border-blue-200',
    accent: 'text-blue-700',
    soft: 'border-blue-200 bg-blue-50/70',
  },
  nb: {
    id: 'nb',
    name: 'Naive Bayes',
    short: 'NB',
    family: 'classic',
    description: 'Very fast probabilistic baseline that can surprise on simpler feature spaces.',
    tone: 'bg-rose-50 border-rose-200',
    accent: 'text-rose-700',
    soft: 'border-rose-200 bg-rose-50/70',
  },
  rf: {
    id: 'rf',
    name: 'Random Forest',
    short: 'RF',
    family: 'ensemble',
    description: 'Bagged decision trees with strong default performance and stable feature importance.',
    tone: 'bg-emerald-50 border-emerald-200',
    accent: 'text-emerald-700',
    soft: 'border-emerald-200 bg-emerald-50/70',
  },
  et: {
    id: 'et',
    name: 'Extra Trees',
    short: 'ET',
    family: 'ensemble',
    description: 'More randomized forest variant that can reduce variance and train quickly.',
    tone: 'bg-teal-50 border-teal-200',
    accent: 'text-teal-700',
    soft: 'border-teal-200 bg-teal-50/70',
  },
  ada: {
    id: 'ada',
    name: 'AdaBoost',
    short: 'ADA',
    family: 'ensemble',
    description: 'Sequential ensemble that focuses more on hard examples at each round.',
    tone: 'bg-orange-50 border-orange-200',
    accent: 'text-orange-700',
    soft: 'border-orange-200 bg-orange-50/70',
  },
  xgb: {
    id: 'xgb',
    name: 'XGBoost',
    short: 'XGB',
    family: 'boosting',
    description: 'High-performance gradient boosting for dense tabular problems.',
    tone: 'bg-cyan-50 border-cyan-200',
    accent: 'text-cyan-700',
    soft: 'border-cyan-200 bg-cyan-50/70',
  },
  lgbm: {
    id: 'lgbm',
    name: 'LightGBM',
    short: 'LGBM',
    family: 'boosting',
    description: 'Leaf-wise boosting that is often fast on larger feature spaces.',
    tone: 'bg-violet-50 border-violet-200',
    accent: 'text-violet-700',
    soft: 'border-violet-200 bg-violet-50/70',
  },
  catboost: {
    id: 'catboost',
    name: 'CatBoost',
    short: 'CAT',
    family: 'boosting',
    description: 'Boosted trees with strong defaults, especially when categorical structure matters.',
    tone: 'bg-fuchsia-50 border-fuchsia-200',
    accent: 'text-fuchsia-700',
    soft: 'border-fuchsia-200 bg-fuchsia-50/70',
  },
};

export function getModelCatalogEntry(modelId: ModelId, problemType: ProblemType = 'classification'): ModelCatalogEntry {
  if (problemType !== 'regression') {
    return MODEL_CATALOG[modelId];
  }

  if (modelId === 'knn') {
    return { ...MODEL_CATALOG.knn, name: 'K-Nearest Neighbors Regressor', short: 'KNN-R', description: 'Distance-based regressor that captures local numeric patterns quickly.' };
  }
  if (modelId === 'svm') {
    return { ...MODEL_CATALOG.svm, name: 'Support Vector Regressor', short: 'SVR', description: 'Margin-based regressor with strong performance on compact tabular datasets.' };
  }
  if (modelId === 'dt') {
    return { ...MODEL_CATALOG.dt, name: 'Decision Tree Regressor', short: 'DT-R', description: 'Readable regression tree that captures non-linear rules with minimal setup.' };
  }
  if (modelId === 'lr') {
    return { ...MODEL_CATALOG.lr, name: 'Linear Regression', short: 'LIN', description: 'Fast linear baseline that gives a stable first reference for continuous targets.' };
  }
  if (modelId === 'nb') {
    return { ...MODEL_CATALOG.nb, name: 'Ridge Regression', short: 'RIDGE', description: 'Regularized linear regressor that stays stable when predictors are correlated.' };
  }
  if (modelId === 'rf') {
    return { ...MODEL_CATALOG.rf, name: 'Random Forest Regressor', short: 'RF-R', description: 'Robust bagged tree regressor with strong tabular defaults and low tuning overhead.' };
  }
  if (modelId === 'et') {
    return { ...MODEL_CATALOG.et, name: 'Extra Trees Regressor', short: 'ET-R', description: 'Fast randomized tree ensemble that often reduces variance for noisy numeric targets.' };
  }
  if (modelId === 'ada') {
    return { ...MODEL_CATALOG.ada, name: 'AdaBoost Regressor', short: 'ADA-R', description: 'Sequential regressor that can sharpen fit on harder residual regions.' };
  }
  if (modelId === 'xgb') {
    return { ...MODEL_CATALOG.xgb, name: 'XGBoost Regressor', short: 'XGB-R', description: 'High-capacity boosted tree regressor for structured numeric prediction.' };
  }
  if (modelId === 'lgbm') {
    return { ...MODEL_CATALOG.lgbm, name: 'LightGBM Regressor', short: 'LGBM-R', description: 'Efficient leaf-wise boosting that stays fast on wider feature sets.' };
  }
  return { ...MODEL_CATALOG.catboost, name: 'CatBoost Regressor', short: 'CAT-R', description: 'Boosted tree regressor with strong defaults and resilient handling of tabular structure.' };
}
