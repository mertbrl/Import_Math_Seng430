// ─── Rich Mock EDA Data ─────────────────────────────────────────────
// This file provides a comprehensive, realistic mock dataset profile
// mimicking a Pandas Profiling / ydata-profiling report for a
// healthcare heart-failure clinical dataset.

export interface ColumnStats {
  name: string;
  type: 'Numeric' | 'Categorical' | 'Boolean';
  min?: number;
  max?: number;
  mean?: number;
  stdDev?: number;
  zerosPct?: number;
  negativePct?: number;
  outliersCount?: number;
  skewness?: number;
  kurtosis?: number;
  distinct: number;
  missing: number;
  missingPct: number;
  distribution: { label: string; value: number }[];
}

export interface Alert {
  severity: 'warning' | 'severe' | 'info';
  icon: string;
  title: string;
  message: string;
}

export interface SummaryStats {
  numVariables: number;
  numObservations: number;
  missingCells: number;
  missingCellsPct: number;
  duplicateRows: number;
  duplicateRowsPct: number;
  totalMemory: string;
  variableTypes: { Numeric: number; Categorical: number; Boolean: number };
}

export interface CorrelationEntry {
  row: string;
  col: string;
  value: number;
}

export interface MockEDADataset {
  summary: SummaryStats;
  alerts: Alert[];
  columns: ColumnStats[];
  correlationMatrix: CorrelationEntry[];
  numericColumnNames: string[];
}

// ─── Summary Stats ──────────────────────────────────────────────────
const summary: SummaryStats = {
  numVariables: 20,
  numObservations: 2847,
  missingCells: 412,
  missingCellsPct: 7.2,
  duplicateRows: 23,
  duplicateRowsPct: 0.8,
  totalMemory: '2.4 MiB',
  variableTypes: { Numeric: 15, Categorical: 4, Boolean: 1 },
};

// ─── Smart Alerts ───────────────────────────────────────────────────
const alerts: Alert[] = [
  {
    severity: 'warning',
    icon: '⚠️',
    title: 'Class Imbalance Detected',
    message:
      'Target variable is imbalanced (85/15 split). Consider using SMOTE oversampling in Step 3 to prevent the model from favoring the majority class.',
  },
  {
    severity: 'severe',
    icon: '⚠️',
    title: 'High Missingness',
    message:
      "Column 'BMI' has 40% missing data. Dropping or imputing this column is required before training. Median imputation is recommended for skewed distributions.",
  },
  {
    severity: 'info',
    icon: 'ℹ️',
    title: 'High Cardinality',
    message:
      "'Hospital_ID' has 150 unique values out of 2847 rows. Consider grouping into regional categories or using target encoding in Step 3.",
  },
];

// ─── Column-Level Feature Data ──────────────────────────────────────
const columns: ColumnStats[] = [
  {
    name: 'Age',
    type: 'Numeric',
    min: 18,
    max: 95,
    mean: 58.3,
    stdDev: 14.7,
    zerosPct: 0,
    negativePct: 0,
    distinct: 72,
    missing: 0,
    missingPct: 0,
    distribution: [
      { label: '18-25', value: 89 },
      { label: '26-35', value: 214 },
      { label: '36-45', value: 387 },
      { label: '46-55', value: 612 },
      { label: '56-65', value: 724 },
      { label: '66-75', value: 498 },
      { label: '76-85', value: 247 },
      { label: '86-95', value: 76 },
    ],
  },
  {
    name: 'Blood_Pressure',
    type: 'Numeric',
    min: 80,
    max: 200,
    mean: 131.4,
    stdDev: 22.8,
    zerosPct: 0,
    negativePct: 0,
    distinct: 98,
    missing: 34,
    missingPct: 1.2,
    distribution: [
      { label: '80-100', value: 198 },
      { label: '101-120', value: 567 },
      { label: '121-140', value: 892 },
      { label: '141-160', value: 643 },
      { label: '161-180', value: 378 },
      { label: '181-200', value: 135 },
    ],
  },
  {
    name: 'Cholesterol',
    type: 'Numeric',
    min: 120,
    max: 420,
    mean: 238.7,
    stdDev: 54.2,
    zerosPct: 0,
    negativePct: 0,
    distinct: 187,
    missing: 18,
    missingPct: 0.6,
    distribution: [
      { label: '120-170', value: 312 },
      { label: '171-220', value: 689 },
      { label: '221-270', value: 834 },
      { label: '271-320', value: 578 },
      { label: '321-370', value: 298 },
      { label: '371-420', value: 118 },
    ],
  },
  {
    name: 'BMI',
    type: 'Numeric',
    min: 15.2,
    max: 52.8,
    mean: 28.9,
    stdDev: 6.3,
    zerosPct: 0,
    negativePct: 0,
    distinct: 234,
    missing: 1139,
    missingPct: 40.0,
    distribution: [
      { label: '15-20', value: 124 },
      { label: '21-25', value: 389 },
      { label: '26-30', value: 512 },
      { label: '31-35', value: 367 },
      { label: '36-40', value: 198 },
      { label: '41-53', value: 118 },
    ],
  },
  {
    name: 'Heart_Rate',
    type: 'Numeric',
    min: 48,
    max: 178,
    mean: 82.6,
    stdDev: 18.4,
    zerosPct: 0,
    negativePct: 0,
    distinct: 112,
    missing: 5,
    missingPct: 0.2,
    distribution: [
      { label: '48-65', value: 287 },
      { label: '66-80', value: 798 },
      { label: '81-95', value: 892 },
      { label: '96-110', value: 534 },
      { label: '111-130', value: 256 },
      { label: '131-178', value: 75 },
    ],
  },
  {
    name: 'Blood_Glucose',
    type: 'Numeric',
    min: 55,
    max: 380,
    mean: 126.8,
    stdDev: 42.1,
    zerosPct: 0,
    negativePct: 0,
    distinct: 178,
    missing: 67,
    missingPct: 2.4,
    distribution: [
      { label: '55-90', value: 412 },
      { label: '91-120', value: 834 },
      { label: '121-150', value: 678 },
      { label: '151-200', value: 489 },
      { label: '201-280', value: 298 },
      { label: '281-380', value: 69 },
    ],
  },
  {
    name: 'Creatinine',
    type: 'Numeric',
    min: 0.4,
    max: 9.8,
    mean: 1.39,
    stdDev: 1.12,
    zerosPct: 0,
    negativePct: 0,
    distinct: 67,
    missing: 12,
    missingPct: 0.4,
    distribution: [
      { label: '0.4-1.0', value: 934 },
      { label: '1.1-1.5', value: 789 },
      { label: '1.6-2.5', value: 567 },
      { label: '2.6-4.0', value: 312 },
      { label: '4.1-6.0', value: 156 },
      { label: '6.1-9.8', value: 77 },
    ],
  },
  {
    name: 'Hemoglobin',
    type: 'Numeric',
    min: 7.2,
    max: 18.4,
    mean: 13.1,
    stdDev: 2.1,
    zerosPct: 0,
    negativePct: 0,
    distinct: 89,
    missing: 9,
    missingPct: 0.3,
    distribution: [
      { label: '7-9', value: 134 },
      { label: '10-11', value: 312 },
      { label: '12-13', value: 789 },
      { label: '14-15', value: 923 },
      { label: '16-17', value: 498 },
      { label: '17-18.4', value: 182 },
    ],
  },
  {
    name: 'Platelets',
    type: 'Numeric',
    min: 25100,
    max: 850000,
    mean: 263358,
    stdDev: 97804,
    zerosPct: 0,
    negativePct: 0,
    distinct: 2340,
    missing: 3,
    missingPct: 0.1,
    distribution: [
      { label: '25K-100K', value: 178 },
      { label: '100K-200K', value: 623 },
      { label: '200K-300K', value: 912 },
      { label: '300K-400K', value: 678 },
      { label: '400K-600K', value: 334 },
      { label: '600K-850K', value: 119 },
    ],
  },
  {
    name: 'Ejection_Fraction',
    type: 'Numeric',
    min: 14,
    max: 80,
    mean: 38.2,
    stdDev: 11.8,
    zerosPct: 0,
    negativePct: 0,
    distinct: 56,
    missing: 0,
    missingPct: 0,
    distribution: [
      { label: '14-20', value: 198 },
      { label: '21-30', value: 534 },
      { label: '31-40', value: 823 },
      { label: '41-50', value: 678 },
      { label: '51-60', value: 412 },
      { label: '61-80', value: 202 },
    ],
  },
  {
    name: 'Sodium',
    type: 'Numeric',
    min: 113,
    max: 152,
    mean: 136.8,
    stdDev: 4.4,
    zerosPct: 0,
    negativePct: 0,
    distinct: 37,
    missing: 2,
    missingPct: 0.1,
    distribution: [
      { label: '113-125', value: 89 },
      { label: '126-132', value: 312 },
      { label: '133-137', value: 978 },
      { label: '138-142', value: 1045 },
      { label: '143-148', value: 367 },
      { label: '149-152', value: 54 },
    ],
  },
  {
    name: 'Potassium',
    type: 'Numeric',
    min: 2.8,
    max: 6.2,
    mean: 4.1,
    stdDev: 0.6,
    zerosPct: 0,
    negativePct: 0,
    distinct: 31,
    missing: 8,
    missingPct: 0.3,
    distribution: [
      { label: '2.8-3.3', value: 134 },
      { label: '3.4-3.8', value: 489 },
      { label: '3.9-4.2', value: 912 },
      { label: '4.3-4.7', value: 734 },
      { label: '4.8-5.3', value: 412 },
      { label: '5.4-6.2', value: 158 },
    ],
  },
  {
    name: 'WBC_Count',
    type: 'Numeric',
    min: 2100,
    max: 24800,
    mean: 7823,
    stdDev: 3214,
    zerosPct: 0,
    negativePct: 0,
    distinct: 1678,
    missing: 14,
    missingPct: 0.5,
    distribution: [
      { label: '2K-4K', value: 234 },
      { label: '4K-6K', value: 612 },
      { label: '6K-8K', value: 834 },
      { label: '8K-10K', value: 567 },
      { label: '10K-15K', value: 398 },
      { label: '15K-25K', value: 188 },
    ],
  },
  {
    name: 'CRP_Level',
    type: 'Numeric',
    min: 0.1,
    max: 28.4,
    mean: 4.2,
    stdDev: 5.1,
    zerosPct: 2.3,
    negativePct: 0,
    distinct: 198,
    missing: 89,
    missingPct: 3.1,
    distribution: [
      { label: '0-2', value: 912 },
      { label: '2.1-5', value: 734 },
      { label: '5.1-10', value: 523 },
      { label: '10.1-15', value: 312 },
      { label: '15.1-20', value: 198 },
      { label: '20.1-28', value: 79 },
    ],
  },
  {
    name: 'Length_of_Stay',
    type: 'Numeric',
    min: 1,
    max: 42,
    mean: 6.8,
    stdDev: 5.2,
    zerosPct: 0,
    negativePct: 0,
    distinct: 38,
    missing: 0,
    missingPct: 0,
    distribution: [
      { label: '1-3', value: 678 },
      { label: '4-6', value: 823 },
      { label: '7-10', value: 612 },
      { label: '11-15', value: 398 },
      { label: '16-25', value: 234 },
      { label: '26-42', value: 102 },
    ],
  },
  {
    name: 'Gender',
    type: 'Categorical',
    distinct: 3,
    missing: 0,
    missingPct: 0,
    distribution: [
      { label: 'Male', value: 1534 },
      { label: 'Female', value: 1289 },
      { label: 'Other', value: 24 },
    ],
  },
  {
    name: 'Smoking_Status',
    type: 'Categorical',
    distinct: 4,
    missing: 12,
    missingPct: 0.4,
    distribution: [
      { label: 'Never', value: 1089 },
      { label: 'Former', value: 823 },
      { label: 'Current', value: 678 },
      { label: 'Unknown', value: 245 },
    ],
  },
  {
    name: 'Hospital_ID',
    type: 'Categorical',
    distinct: 150,
    missing: 0,
    missingPct: 0,
    distribution: [
      { label: 'H001-H025', value: 567 },
      { label: 'H026-H050', value: 489 },
      { label: 'H051-H075', value: 534 },
      { label: 'H076-H100', value: 456 },
      { label: 'H101-H125', value: 412 },
      { label: 'H126-H150', value: 389 },
    ],
  },
  {
    name: 'Admission_Type',
    type: 'Categorical',
    distinct: 3,
    missing: 0,
    missingPct: 0,
    distribution: [
      { label: 'Emergency', value: 1234 },
      { label: 'Elective', value: 989 },
      { label: 'Urgent', value: 624 },
    ],
  },
  {
    name: 'Target_Disease',
    type: 'Boolean',
    distinct: 2,
    missing: 0,
    missingPct: 0,
    distribution: [
      { label: 'Negative (0)', value: 2420 },
      { label: 'Positive (1)', value: 427 },
    ],
  },
];

// ─── Correlation Matrix ─────────────────────────────────────────────
const numericColumnNames = [
  'Age', 'Blood_Pressure', 'Cholesterol', 'BMI', 'Heart_Rate',
  'Blood_Glucose', 'Creatinine', 'Hemoglobin', 'Ejection_Fraction', 'Sodium',
];

function generateCorrelationMatrix(): CorrelationEntry[] {
  const fixed: Record<string, Record<string, number>> = {
    Age:               { Blood_Pressure: 0.62, Cholesterol: 0.35, BMI: -0.12, Heart_Rate: -0.28, Blood_Glucose: 0.41, Creatinine: 0.54, Hemoglobin: -0.31, Ejection_Fraction: -0.45, Sodium: -0.18 },
    Blood_Pressure:    { Cholesterol: 0.48, BMI: 0.56, Heart_Rate: 0.22, Blood_Glucose: 0.39, Creatinine: 0.33, Hemoglobin: -0.14, Ejection_Fraction: -0.37, Sodium: -0.09 },
    Cholesterol:       { BMI: 0.67, Heart_Rate: 0.11, Blood_Glucose: 0.72, Creatinine: 0.19, Hemoglobin: 0.08, Ejection_Fraction: -0.21, Sodium: 0.05 },
    BMI:               { Heart_Rate: 0.18, Blood_Glucose: 0.88, Creatinine: 0.14, Hemoglobin: -0.06, Ejection_Fraction: -0.31, Sodium: -0.03 },
    Heart_Rate:        { Blood_Glucose: 0.15, Creatinine: 0.09, Hemoglobin: 0.24, Ejection_Fraction: 0.42, Sodium: 0.11 },
    Blood_Glucose:     { Creatinine: 0.27, Hemoglobin: -0.19, Ejection_Fraction: -0.34, Sodium: -0.07 },
    Creatinine:        { Hemoglobin: -0.52, Ejection_Fraction: -0.61, Sodium: -0.38 },
    Hemoglobin:        { Ejection_Fraction: 0.44, Sodium: 0.29 },
    Ejection_Fraction: { Sodium: 0.33 },
  };

  const entries: CorrelationEntry[] = [];
  for (const r of numericColumnNames) {
    for (const c of numericColumnNames) {
      if (r === c) {
        entries.push({ row: r, col: c, value: 1.0 });
      } else {
        const val = fixed[r]?.[c] ?? fixed[c]?.[r] ?? 0;
        entries.push({ row: r, col: c, value: val });
      }
    }
  }
  return entries;
}

const correlationMatrix = generateCorrelationMatrix();

// ─── Exported Dataset ───────────────────────────────────────────────
export const mockEDA: MockEDADataset = {
  summary,
  alerts,
  columns,
  correlationMatrix,
  numericColumnNames,
};
