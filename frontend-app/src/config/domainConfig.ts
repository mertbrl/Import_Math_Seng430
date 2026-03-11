export interface DomainConfig {
  id: string;
  domainName: string;
  clinicalQuestion: string;
  dataSource: string;
  targetVariable: string;
  whyThisMatters: string;
}

export const domains: DomainConfig[] = [
  {
    id: "cardiology-readmission",
    domainName: "Cardiology",
    clinicalQuestion: "30-day readmission risk after heart failure discharge",
    dataSource: "Heart Failure Clinical Records",
    targetVariable: "DEATH_EVENT (binary)",
    whyThisMatters: "30% of heart failure patients return to the hospital within 30 days. Early prediction allows nursing staff to arrange home care follow-ups, preventing complications and saving approximately $15k per readmission."
  },
  {
    id: "radiology-pneumonia",
    domainName: "Radiology",
    clinicalQuestion: "Normal vs. pneumonia from clinical features",
    dataSource: "NIH Chest X-Ray metadata",
    targetVariable: "Finding Label (binary/multi)",
    whyThisMatters: "Pneumonia can progress into life-threatening sepsis rapidly. Fast, automated flagging of high-suspect cases prioritizes these for immediate radiologist review, ensuring faster antibiotic administration."
  },
  {
    id: "nephrology-ckd",
    domainName: "Nephrology",
    clinicalQuestion: "Chronic kidney disease stage from routine lab values",
    dataSource: "UCI CKD Dataset (400 patients)",
    targetVariable: "classification (CKD / not CKD)",
    whyThisMatters: "Early stage CKD often presents asynchronously with zero symptoms. Identifying covert deterioration allows nephrologists to adjust medication before irreversible kidney scarring leads to dialysis."
  },
  {
    id: "oncology-breast",
    domainName: "Oncology — Breast",
    clinicalQuestion: "Malignancy of a breast biopsy from cell measurements",
    dataSource: "Wisconsin Breast Cancer Dataset",
    targetVariable: "diagnosis (M/B)",
    whyThisMatters: "Differentiating between benign lumps and aggressive malignancies precisely minimizes both unnecessary surgical excisions and delayed oncological treatments for false negatives."
  },
  {
    id: "neurology-parkinsons",
    domainName: "Neurology — Parkinson's",
    clinicalQuestion: "Parkinson's disease from voice biomarkers",
    dataSource: "UCI Parkinson's Dataset",
    targetVariable: "status (0/1)",
    whyThisMatters: "Motor symptoms of Parkinson's appear late in the disease lifecycle. Voice anomalies correlate highly with early dopaminergic decline, enabling neuroprotective therapies years before trembling begins."
  },
  {
    id: "endocrinology-diabetes",
    domainName: "Endocrinology — Diabetes",
    clinicalQuestion: "Diabetes onset within 5 years from metabolic markers",
    dataSource: "Pima Indians Diabetes Dataset",
    targetVariable: "Outcome (0/1)",
    whyThisMatters: "Prediabetes is reversible, but type 2 diabetes escalates into severe systemic damage. Projecting 5-year onset probability motivates immediate lifestyle, dietary, and early pharmacological interventions."
  },
  {
    id: "hepatology-liver",
    domainName: "Hepatology — Liver",
    clinicalQuestion: "Liver disease from blood test results",
    dataSource: "Indian Liver Patient Dataset",
    targetVariable: "Dataset (liver disease y/n)",
    whyThisMatters: "The liver compensates for damage until late-stage cirrhosis occurs. ML detection of subtle multi-enzyme abnormalities catches silently advancing liver failure long before jaundice surfaces."
  },
  {
    id: "cardiology-stroke",
    domainName: "Cardiology — Stroke",
    clinicalQuestion: "Stroke risk from demographics and comorbidities",
    dataSource: "Kaggle Stroke Prediction Dataset",
    targetVariable: "stroke (0/1)",
    whyThisMatters: "Strokes are heavily preventable if vascular risk factors are aggressively managed. Profiling composite stroke risk allows neurologists to prescribe decisive prophylactic anticoagulation."
  },
  {
    id: "mental-health-depression",
    domainName: "Mental Health",
    clinicalQuestion: "Depression severity from PHQ-9 survey responses",
    dataSource: "Kaggle Depression/Anxiety Dataset",
    targetVariable: "severity class",
    whyThisMatters: "Standardized grading of subjective depressive symptoms prevents under-treatment and flags crucial, subtle markers indicating when a patient is shifting into high suicide-risk trajectories."
  },
  {
    id: "pulmonology-copd",
    domainName: "Pulmonology — COPD",
    clinicalQuestion: "COPD exacerbation risk from spirometry data",
    dataSource: "Kaggle / PhysioNet COPD Dataset",
    targetVariable: "exacerbation (y/n)",
    whyThisMatters: "COPD exacerbations permanently reduce lung capacity and heavily drive ICU admissions. Predicting the tipping point empowers physicians to deploy corticosteroid interventions preemptively."
  },
  {
    id: "haematology-anaemia",
    domainName: "Haematology — Anaemia",
    clinicalQuestion: "Type of anaemia from full blood count results",
    dataSource: "Kaggle Anaemia Classification Dataset",
    targetVariable: "anemia_type (multi-class)",
    whyThisMatters: "Treating B12-deficiency with iron supplements is medically futile. Multi-class classification automates precise anemia-type diagnoses from standard blood draws, ensuring the right nutrient replacement."
  },
  {
    id: "dermatology-skin-lesion",
    domainName: "Dermatology",
    clinicalQuestion: "Benign vs. malignant skin lesion from dermoscopy features",
    dataSource: "HAM10000 metadata (Kaggle)",
    targetVariable: "dx_type (benign / malignant)",
    whyThisMatters: "Melanoma survival drops remarkably if excision is delayed. Distinguishing complex moles from early malignant lesions provides a crucial safety net for general practitioners performing skin checks."
  },
  {
    id: "ophthalmology-retinopathy",
    domainName: "Ophthalmology",
    clinicalQuestion: "Diabetic retinopathy severity from clinical findings",
    dataSource: "UCI / Kaggle Retinopathy Dataset",
    targetVariable: "severity grade",
    whyThisMatters: "Retinopathy is a leading cause of preventable blindness. Automatically grading retinal damage guarantees that high-risk visual-loss patients are expedited for critical laser surgery."
  },
  {
    id: "orthopaedics-spine",
    domainName: "Orthopaedics — Spine",
    clinicalQuestion: "Normal vs. disc herniation from biomechanical measures",
    dataSource: "UCI Vertebral Column Dataset",
    targetVariable: "class (Normal / Abnormal)",
    whyThisMatters: "Persistent back pain often lacks clear structural answers. Categorizing precise pelvic incidence metrics can definitively flag cases requiring spinal fusion versus simple physical therapy."
  },
  {
    id: "icu-sepsis",
    domainName: "ICU / Sepsis",
    clinicalQuestion: "Sepsis onset from vital signs and lab results",
    dataSource: "PhysioNet / Kaggle Sepsis Dataset",
    targetVariable: "SepsisLabel (0/1)",
    whyThisMatters: "Sepsis mortality increases by 8% for every hour antibiotics are delayed. Continuous ML vital-sign monitoring predicts impending septic shock up to 6 hours before physicians traditionally recognize the physiological crash."
  },
  {
    id: "obstetrics-fetal-health",
    domainName: "Obstetrics — Fetal Health",
    clinicalQuestion: "Fetal cardiotocography classification",
    dataSource: "UCI Fetal Health Dataset",
    targetVariable: "fetal_health (1/2/3)",
    whyThisMatters: "Fetal distress during labor requires instant obstetrical decisions. Automating tracing classifications reduces human fatigue errors, confidently dictating whether to initiate an emergency Cesarean section."
  },
  {
    id: "cardiology-arrhythmia",
    domainName: "Cardiology — Arrhythmia",
    clinicalQuestion: "Cardiac arrhythmia presence from ECG features",
    dataSource: "UCI Arrhythmia Dataset",
    targetVariable: "arrhythmia (0/1)",
    whyThisMatters: "Asymptomatic arrhythmias (like AFib) massively elevate stroke risks. Catching subtle electrical irregularities algorithmically ensures pacemakers and beta-blockers are utilized before a catastrophic event."
  },
  {
    id: "oncology-cervical",
    domainName: "Oncology — Cervical",
    clinicalQuestion: "Cervical cancer risk from demographic and behavioural data",
    dataSource: "UCI Cervical Cancer Dataset",
    targetVariable: "Biopsy (0/1)",
    whyThisMatters: "Triaging patients into discrete risk categories using lifestyle and historical factors optimizes resource allocations for expensive Pap smears and colposcopies in overloaded gynecology clinics."
  },
  {
    id: "thyroid-endocrinology",
    domainName: "Thyroid / Endocrinology",
    clinicalQuestion: "Thyroid function classification",
    dataSource: "UCI Thyroid Disease Dataset",
    targetVariable: "class (3 types)",
    whyThisMatters: "Hyper- and hypothyroidism present with confusing, overlapping systemic symptoms. Classifying precise endocrine dysfunction accelerates the timeline to establish stable hormonal regulation."
  },
  {
    id: "pharmacy-readmission",
    domainName: "Pharmacy — Readmission",
    clinicalQuestion: "Hospital readmission risk for diabetic patients on medication",
    dataSource: "UCI Diabetes 130-US Hospitals Dataset",
    targetVariable: "readmitted (<30 / >30 / NO)",
    whyThisMatters: "Polypharmacy in severely diabetic patients creates rampant contraindication risks. Predicting readmissions specifically tied to pharmacological regimens identifies patients requiring intense clinical pharmacist oversight."
  }
];
