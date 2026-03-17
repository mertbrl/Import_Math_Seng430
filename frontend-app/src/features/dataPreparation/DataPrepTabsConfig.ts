export interface DataPrepTabSpec {
  id: string;
  title: string;
  subtitle: string;
  estimatedTime: string;
  suggestedTime?: string;
}

export const PREP_TABS: DataPrepTabSpec[] = [
  {
    id: 'data_cleaning',
    title: '1. Data Cleaning',
    subtitle: 'Drop duplicates, zero-variance, and metadata.',
    estimatedTime: '1-3 min',
  },
  {
    id: 'data_split',
    title: '2. Data Split (Train/Val/Test)',
    subtitle: 'Critical barrier — prevents data leakage.',
    estimatedTime: '1-2 min',
  },
  {
    id: 'outliers',
    title: '3. Outliers',
    subtitle: 'Z-Score, IQR, Isolation Forest, LOF, DBSCAN.',
    estimatedTime: '2-5 min',
    suggestedTime: '45-90 sec',
  },
  {
    id: 'imputation',
    title: '4. Missing Value Handling',
    subtitle: 'Imputation strategies (MCAR, MAR, MNAR)',
    estimatedTime: '2-5 min',
    suggestedTime: '45-90 sec',
  },
  {
    id: 'transformation',
    title: '5. Feature Transformation',
    subtitle: 'Log, Box-Cox, Yeo-Johnson — normalize distributions.',
    estimatedTime: '2-4 min',
    suggestedTime: '30-60 sec',
  },
  {
    id: 'encoding',
    title: '6. Categorical Encoding',
    subtitle: 'One-Hot, Label Encoding',
    estimatedTime: '1-3 min',
    suggestedTime: '20-45 sec',
  },
  {
    id: 'scaling',
    title: '7. Scaling',
    subtitle: 'StandardScaler, MinMaxScaler',
    estimatedTime: '1-2 min',
    suggestedTime: '15-30 sec',
  },
  {
    id: 'dimensionality_reduction',
    title: '8. Feature Redundancy & Multicollinearity',
    subtitle: 'VIF, PCA',
    estimatedTime: '2-4 min',
  },
  {
    id: 'feature_selection',
    title: '9. Feature Selection',
    subtitle: 'Reduce dimensionality before creating synthetic data.',
    estimatedTime: '2-6 min',
  },
  {
    id: 'imbalance_handling',
    title: '10. Imbalance Handling',
    subtitle: 'SMOTE — Applied to Train Set only.',
    estimatedTime: '1-2 min',
    suggestedTime: '10-20 sec',
  },
];

export function getPrepTabSpec(tabId: string): DataPrepTabSpec | undefined {
  return PREP_TABS.find((tab) => tab.id === tabId);
}
