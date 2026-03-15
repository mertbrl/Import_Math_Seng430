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
    id: 'sampling',
    title: '3. Sampling & Volume',
    subtitle: 'Applied strictly to Train Set only.',
  },
  {
    id: 'outliers',
    title: '4. Outliers',
    subtitle: 'Z-Score, IQR, Isolation Forest, LOF, DBSCAN.',
  },
  {
    id: 'imputation',
    title: '5. Missing Value Handling',
    subtitle: 'Imputation strategies (MCAR, MAR, MNAR)',
  },
  {
    id: 'transformation',
    title: '6. Feature Transformation',
    subtitle: 'Log, Box-Cox, Yeo-Johnson — normalize distributions.',
  },
  {
    id: 'encoding',
    title: '7. Categorical Encoding',
    subtitle: 'One-Hot, Label Encoding',
  },
  {
    id: 'scaling',
    title: '8. Scaling',
    subtitle: 'StandardScaler, MinMaxScaler',
  },
  {
    id: 'dimensionality_reduction',
    title: '9. Feature Redundancy & Multicollinearity',
    subtitle: 'VIF, PCA',
  },
  {
    id: 'imbalance_handling',
    title: '10. Imbalance Handling',
    subtitle: 'SMOTE — Applied to Train Set only.',
  },
];
