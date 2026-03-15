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
    id: 'sampling',
    title: '2. Sampling & Volume',
    subtitle: 'Reduce dataset size for faster training.',
  },
  {
    id: 'data_split',
    title: '3. Data Split (Train/Val/Test)',
    subtitle: 'The critical barrier step',
  },
  {
    id: 'imputation',
    title: '4. Missing Value Handling',
    subtitle: 'Imputation strategies (MCAR, MAR, MNAR)',
  },
  {
    id: 'outliers',
    title: '5. Outliers',
    subtitle: 'Z-Score, IQR, Isolation Forest',
  },
  {
    id: 'feature_engineering',
    title: '6. Feature Engineering',
    subtitle: 'Aggregations, Rolling Means',
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
    title: '9. Dimensionality Reduction',
    subtitle: 'VIF, PCA',
  },
  {
    id: 'imbalance_handling',
    title: '10. Imbalance Handling',
    subtitle: 'SMOTE (Strictly applied to Train set only)',
  },
];
