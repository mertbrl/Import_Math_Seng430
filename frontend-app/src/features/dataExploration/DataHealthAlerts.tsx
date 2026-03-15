import React from 'react';
import { AlertTriangle, Lightbulb, BookOpen, Target } from 'lucide-react';
import type { Alert } from './mockEDAData';

interface DataHealthAlertsProps {
  alerts: Alert[];
}

const DataHealthAlerts: React.FC<DataHealthAlertsProps> = ({ alerts }) => {
  // Map severity to specific styling and icons
  const getAlertStyle = (severity: string) => {
    switch (severity) {
      case 'severe':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          titleColor: 'text-red-900',
          iconColor: 'text-red-600',
          badgeBg: 'bg-red-100/50 text-red-700',
          icon: <AlertTriangle size={22} className="text-red-600" />
        };
      case 'warning':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          titleColor: 'text-amber-900',
          iconColor: 'text-amber-600',
          badgeBg: 'bg-amber-100/50 text-amber-700',
          icon: <AlertTriangle size={22} className="text-amber-600" />
        };
      case 'info':
      default:
        return {
          bg: 'bg-indigo-50',
          border: 'border-indigo-200',
          titleColor: 'text-indigo-900',
          iconColor: 'text-indigo-600',
          badgeBg: 'bg-indigo-100/50 text-indigo-700',
          icon: <Lightbulb size={22} className="text-indigo-600" />
        };
    }
  };

  // Static knowledge base mapped to alert titles
  const getEducationalContent = (title: string) => {
    if (title.includes('Imbalance')) {
      return {
        what: "A dataset has a highly disproportionate ratio of observations in each class. For example, 90% Healthy and 10% Ill.",
        why: "Standard ML models try to maximize overall accuracy. If 90% of patients are healthy, the model can achieve 90% accuracy simply by guessing 'Healthy' every time, completely failing to detect the minority class.",
        action: "In Step 3 (Data Preparation), you must explicitly address this. We recommend selecting SMOTE (Synthetic Minority Over-sampling Technique) or enabling Class Weights to force the model to pay attention to the minority group."
      };
    }
    if (title.includes('Skewness')) {
      return {
        what: "The data distribution is not symmetrical. It has a 'long tail' stretching either to the left or right, separating the mean from the median.",
        why: "Many algorithms (like Logistic Regression and Neural Networks) assume data is normally distributed (bell-shaped). Extreme skewness can reduce their predictive accuracy on the 'tail' values.",
        action: "In Step 3, apply a Logarithmic (Log) or Power (Box-Cox) transformation to normalize this variable into a more Gaussian-like shape."
      };
    }
    if (title.includes('Multimodal')) {
      return {
        what: "The data distribution has multiple distinct 'peaks'. For instance, patients might cluster into two clear age groups (young adults and seniors), rather than following a single bell curve.",
        why: "A single global model might struggle to learn a rule that fits both populations simultaneously.",
        action: "Consider segmenting the data and training a separate model for each peak, or ensure you are using robust algorithms like Random Forests that handle complex splits naturally."
      };
    }
    if (title.includes('Missing')) {
      return {
        what: "Cells in the dataset row/column have no value recorded (NaN or Null).",
        why: "Most ML algorithms (except certain tree-based ones) cannot mathematically process empty values and will fail during training.",
        action: "In Step 3, choose an Imputation strategy. For small amounts of missing data, 'Median Imputation' is safe. If >30% is missing, consider dropping the column entirely."
      };
    }
    // Default fallback
    return {
      what: "A statistical anomaly detected in the dataset profile.",
      why: "It may skew the algorithm's mathematical approximations, leading to biased predictions or poor generalization to unseen data.",
      action: "Review this variable in the Feature Explorer and decide if it needs transformation or should be dropped."
    };
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center shadow-sm">
        <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center border border-emerald-100 shadow-sm mb-3">
          <BookOpen size={24} className="text-emerald-500" />
        </div>
        <h4 className="text-base font-bold text-emerald-900 mb-1">Data Looks Healthy</h4>
        <p className="text-sm text-emerald-700 max-w-md mx-auto">
          No severe statistical anomalies or imbalances were detected in the preliminary scan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert, i) => {
        const style = getAlertStyle(alert.severity);
        const edu = getEducationalContent(alert.title);

        return (
          <div key={i} className={`flex flex-col border ${style.border} ${style.bg} rounded-xl shadow-sm overflow-hidden`}>
            {/* Header / Summary Block */}
            <div className="flex items-start gap-4 p-5 border-b border-indigo-900/5">
              <div className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-sm shrink-0">
                {style.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <h4 className={`text-base font-bold ${style.titleColor}`}>
                    {alert.title}
                  </h4>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${style.badgeBg}`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-medium leading-relaxed">
                  {alert.message}
                </p>
              </div>
            </div>

            {/* Educational ML Expansion */}
            <div className="bg-white/60 p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border text-center md:text-left border-slate-200/60 rounded-lg p-4 shadow-sm hover:shadow transition-shadow">
                  <h5 className="flex items-center justify-center md:justify-start gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    <BookOpen size={14} className="text-indigo-400" />
                    What is it?
                  </h5>
                  <p className="text-[13px] text-slate-700 leading-relaxed">{edu.what}</p>
                </div>
                
                <div className="bg-white border text-center md:text-left border-slate-200/60 rounded-lg p-4 shadow-sm hover:shadow transition-shadow">
                  <h5 className="flex items-center justify-center md:justify-start gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    <AlertTriangle size={14} className="text-rose-400" />
                    Why is it a problem?
                  </h5>
                  <p className="text-[13px] text-slate-700 leading-relaxed">{edu.why}</p>
                </div>
              </div>

              {/* Actionable Step 3 Recommendation */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-lg p-4 shadow-sm">
                <h5 className="flex items-center gap-2 text-[12px] font-bold text-indigo-900 uppercase tracking-widest mb-1.5">
                  <Target size={16} className="text-indigo-500" />
                  Recommendation for Step 3
                </h5>
                <p className="text-sm text-indigo-800 font-medium leading-relaxed">
                  {edu.action}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DataHealthAlerts;
