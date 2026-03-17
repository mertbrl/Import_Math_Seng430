export interface DataPrepTabSpec {
  id: string;
  title: string;
  subtitle: string;
}

export const PREP_TABS: DataPrepTabSpec[] = [
  {
    id: 'data_cleaning',
    title: '1. Data Cleaning',
    subtitle: 'Drop duplicates, zero-variance, and metadata.',
  },
  {
    id: 'data_split',
    title: '2. Data Split (Train/Val/Test)',
    subtitle: 'Critical barrier — prevents data leakage.',
  },
  {
    id: 'outliers',
    title: '3. Outliers',
    subtitle: 'Z-Score, IQR, Isolation Forest, LOF, DBSCAN.',
  },
  {
    id: 'imputation',
    title: '4. Missing Value Handling',
    subtitle: 'Imputation strategies (MCAR, MAR, MNAR)',
  },
  {
    id: 'transformation',
    title: '5. Feature Transformation',
    subtitle: 'Log, Box-Cox, Yeo-Johnson — normalize distributions.',
  },
  {
    id: 'encoding',
    title: '6. Categorical Encoding',
    subtitle: 'One-Hot, Label Encoding',
  },
  {
    id: 'scaling',
    title: '7. Scaling',
    subtitle: 'StandardScaler, MinMaxScaler',
  },
  {
    id: 'dimensionality_reduction',
    title: '8. Feature Redundancy & Multicollinearity',
    subtitle: 'VIF, PCA',
  },
  {
    id: 'feature_selection',
    title: '9. Feature Selection',
    subtitle: 'Reduce dimensionality before creating synthetic data.',
  },
  {
    id: 'imbalance_handling',
    title: '10. Imbalance Handling',
    subtitle: 'SMOTE — Applied to Train Set only.',
  },
];
