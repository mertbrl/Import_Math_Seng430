export const STEP_KEYS = [
  "context",
  "dataExploration",
  "columnMapper",
  "dataPrep",
  "modelTuning",
  "evaluation",
  "explainability",
  "ethics",
  "certificate",
];

export const STEP_LABELS = {
  context: "Clinical Context",
  dataExploration: "Data Exploration",
  columnMapper: "Column Mapper",
  dataPrep: "Data Preparation",
  modelTuning: "Model & Parameters",
  evaluation: "Results",
  explainability: "Explainability",
  ethics: "Ethics & Bias",
  certificate: "Certificate",
};

export const INITIAL_PIPELINE_STATE = {
  sessionId: "demo-session",
  context: { domain: "Cardiology", use_case: "Predict 30-day readmission risk." },
  dataExploration: { source: "default", target_column: "DEATH_EVENT" },
  columnMapper: { targetColumn: "DEATH_EVENT", schemaValidated: false },
  dataPrep: {
    train_split: 80,
    missing_strategy: "median",
    normalization: "zscore",
    imbalance_strategy: "smote",
  },
  modelTuning: { algorithm: "knn", parameters: { k: 5 } },
  evaluation: {},
  explainability: { patient_id: "patient-47" },
  ethics: {},
  certificate: { participant: "Demo User", organization: "Demo Hospital" },
};
