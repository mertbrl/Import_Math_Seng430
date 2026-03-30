import { ModelId } from '../../store/useModelStore';

export interface ModelCatalogEntry {
  id: ModelId;
  name: string;
  short: string;
  family: 'classic' | 'ensemble' | 'boosting';
  description: string;
  tone: string;
  accent: string;
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
  },
  svm: {
    id: 'svm',
    name: 'Support Vector Machine',
    short: 'SVM',
    family: 'classic',
    description: 'Strong margin-based model that can fit both linear and curved boundaries.',
    tone: 'bg-amber-50 border-amber-200',
    accent: 'text-amber-700',
  },
  dt: {
    id: 'dt',
    name: 'Decision Tree',
    short: 'DT',
    family: 'classic',
    description: 'Readable rule-based model that is easy to inspect but can overfit quickly.',
    tone: 'bg-lime-50 border-lime-200',
    accent: 'text-lime-700',
  },
  lr: {
    id: 'lr',
    name: 'Logistic Regression',
    short: 'LR',
    family: 'classic',
    description: 'Reliable linear baseline and a good first sanity check for tabular classification.',
    tone: 'bg-blue-50 border-blue-200',
    accent: 'text-blue-700',
  },
  nb: {
    id: 'nb',
    name: 'Naive Bayes',
    short: 'NB',
    family: 'classic',
    description: 'Very fast probabilistic baseline that can surprise on simpler feature spaces.',
    tone: 'bg-rose-50 border-rose-200',
    accent: 'text-rose-700',
  },
  rf: {
    id: 'rf',
    name: 'Random Forest',
    short: 'RF',
    family: 'ensemble',
    description: 'Bagged decision trees with strong default performance and stable feature importance.',
    tone: 'bg-emerald-50 border-emerald-200',
    accent: 'text-emerald-700',
  },
  et: {
    id: 'et',
    name: 'Extra Trees',
    short: 'ET',
    family: 'ensemble',
    description: 'More randomized forest variant that can reduce variance and train quickly.',
    tone: 'bg-teal-50 border-teal-200',
    accent: 'text-teal-700',
  },
  ada: {
    id: 'ada',
    name: 'AdaBoost',
    short: 'ADA',
    family: 'ensemble',
    description: 'Sequential ensemble that focuses more on hard examples at each round.',
    tone: 'bg-orange-50 border-orange-200',
    accent: 'text-orange-700',
  },
  xgb: {
    id: 'xgb',
    name: 'XGBoost',
    short: 'XGB',
    family: 'boosting',
    description: 'High-performance gradient boosting for dense tabular problems.',
    tone: 'bg-cyan-50 border-cyan-200',
    accent: 'text-cyan-700',
  },
  lgbm: {
    id: 'lgbm',
    name: 'LightGBM',
    short: 'LGBM',
    family: 'boosting',
    description: 'Leaf-wise boosting that is often fast on larger feature spaces.',
    tone: 'bg-violet-50 border-violet-200',
    accent: 'text-violet-700',
  },
  catboost: {
    id: 'catboost',
    name: 'CatBoost',
    short: 'CAT',
    family: 'boosting',
    description: 'Boosted trees with strong defaults, especially when categorical structure matters.',
    tone: 'bg-fuchsia-50 border-fuchsia-200',
    accent: 'text-fuchsia-700',
  },
};
