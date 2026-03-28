import React, { useState, useMemo } from 'react';
import { useDomainStore } from '../store/useDomainStore';

const GLOSSARY_TERMS = [
  { term: "Algorithm", def: "A set of step-by-step instructions a computer follows to find patterns in patient data and make predictions — like a fast, data-driven decision checklist." },
  { term: "Training Data", def: "Historical patient records the model learns from. Similar to a doctor reviewing past cases before seeing new patients." },
  { term: "Test Data", def: "Patients the model has never seen, used to measure how well the AI performs. If a model only works on training data, it has memorised rather than learned." },
  { term: "Features", def: "The input measurements (columns in your data) used to make predictions — for example, age, blood pressure, creatinine level, smoking status." },
  { term: "Target Variable", def: "The outcome the model is trying to predict — for example, readmission, diagnosis, survival, or disease stage." },
  { term: "Overfitting", def: "When a model memorises the training cases so precisely that it fails on new patients. Like a student who memorises exam answers but cannot apply the knowledge." },
  { term: "Underfitting", def: "When a model is too simple to learn anything useful. Like a clinician who gives the same diagnosis regardless of symptoms." },
  { term: "Normalisation", def: "Adjusting all measurements to the same scale so no single measurement dominates because of its units. Age (0–100) and a troponin level (0–50,000) must be rescaled before they can be compared fairly." },
  { term: "Class Imbalance", def: "When one outcome is much rarer than the other in the training data. A model trained on 95% negative cases may simply predict negative for everyone and appear 95% accurate — but miss all real cases." },
  { term: "SMOTE", def: "Synthetic Minority Over-sampling Technique. Creates artificial examples of the rare outcome to balance the training data. Applied to training data only — never to test patients." },
  { term: "Sensitivity", def: "Of all patients who truly have the condition, what fraction did the model correctly identify? Low sensitivity means the model misses real cases. Critical in any screening application." },
  { term: "Specificity", def: "Of all patients who truly do not have the condition, what fraction did the model correctly call healthy? Low specificity means too many false alarms." },
  { term: "Precision", def: "Of all patients the model flagged as positive, what fraction actually were? Low precision means many unnecessary referrals or treatments." },
  { term: "F1 Score", def: "A single number that balances Sensitivity and Precision. Useful when both false negatives and false positives have real clinical costs." },
  { term: "AUC-ROC", def: "A score from 0.5 (random guessing) to 1.0 (perfect separation) summarising how well the model distinguishes between positive and negative patients. Above 0.8 is considered good." },
  { term: "Confusion Matrix", def: "A 2x2 table showing: correctly identified sick patients, correctly identified healthy patients, healthy patients incorrectly flagged as sick, and sick patients incorrectly called safe." },
  { term: "Feature Importance", def: "A ranking of which patient measurements the model relied on most. Helps confirm whether the AI is using clinically meaningful signals." },
  { term: "Hyperparameter", def: "A setting chosen before training that controls model behaviour — for example, K in KNN or tree depth in Decision Tree. Not learned from data; set by the user via sliders." },
  { term: "Bias (AI)", def: "When a model performs significantly worse for certain patient subgroups (for example, older patients, women, or ethnic minorities) because they were under-represented in the training data." },
  { term: "Cross-Validation", def: "Splitting the data multiple times and averaging results to get a more reliable performance estimate than a single train/test split." },
];

export const HelpGlossary: React.FC = () => {
  const { isHelpOpen, toggleHelp } = useDomainStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTerms = useMemo(() => {
    if (!searchQuery.trim()) return GLOSSARY_TERMS;
    const lowerQuery = searchQuery.toLowerCase();
    return GLOSSARY_TERMS.filter(
      (item) => 
        item.term.toLowerCase().includes(lowerQuery) || 
        item.def.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery]);

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        onClick={toggleHelp}
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isHelpOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Slide-over Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isHelpOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded bg-teal-100 text-teal-700 flex items-center justify-center font-serif text-lg font-bold">?</span>
            <h2 className="text-lg font-bold text-slate-800">ML Glossary</h2>
          </div>
          <button 
            onClick={toggleHelp}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
            aria-label="Close Help"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-white shrink-0 shadow-sm relative z-10">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search terms (e.g. Sensitivity, SMOTE)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-800 placeholder-slate-400"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          </div>
        </div>

        {/* Scrollable Terms List */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 scrollbar-hide">
          {filteredTerms.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              No matching terms found for <b className="text-slate-700">"{searchQuery}"</b>.
            </div>
          ) : (
            filteredTerms.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1.5 pb-5 border-b border-slate-100 last:border-0 last:pb-0">
                <span className="font-bold text-[15px] text-indigo-900 tracking-tight">{item.term}</span>
                <span className="text-[13px] text-slate-600 leading-relaxed">{item.def}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
