import React from 'react';
import { AlertTriangle, BookOpen, Lightbulb, Target } from 'lucide-react';
import type { Alert } from './mockEDAData';

interface DataHealthAlertsProps {
  alerts: Alert[];
}

const DataHealthAlerts: React.FC<DataHealthAlertsProps> = ({ alerts }) => {
  const getAlertStyle = (severity: string) => {
    switch (severity) {
      case 'severe':
        return {
          shell: 'border-[rgba(186,26,26,0.24)] bg-[linear-gradient(180deg,#fff5f3,#fffafb)]',
          title: 'text-red-900',
          badge: 'bg-red-100 text-red-700',
          icon: <AlertTriangle size={20} className="text-red-600" />,
        };
      case 'warning':
        return {
          shell: 'border-[rgba(194,113,34,0.24)] bg-[linear-gradient(180deg,#fff9ef,#fffdf9)]',
          title: 'text-amber-900',
          badge: 'bg-amber-100 text-amber-700',
          icon: <AlertTriangle size={20} className="text-amber-600" />,
        };
      default:
        return {
          shell: 'border-[rgba(0,89,62,0.18)] bg-[linear-gradient(180deg,#eef8f2,#fbfefc)]',
          title: 'text-[var(--text)]',
          badge: 'bg-emerald-100 text-emerald-700',
          icon: <Lightbulb size={20} className="text-[var(--accent)]" />,
        };
    }
  };

  const getEducationalContent = (title: string) => {
    if (title.includes('Imbalance')) {
      return {
        what: 'A dataset has a highly disproportionate class ratio, such as 90% healthy and 10% event-positive cases.',
        why: 'A standard model may optimize overall accuracy by overpredicting the majority class and ignoring clinically important minority outcomes.',
        action: 'In Step 3, enable SMOTE or class weighting so training pays attention to the minority class.',
      };
    }
    if (title.includes('Skewness')) {
      return {
        what: 'The feature distribution is asymmetric and pulled toward one tail rather than centered around a balanced bell shape.',
        why: 'Several algorithms behave better when numeric variables are closer to a normalized distribution, especially for stable coefficient learning.',
        action: 'In Step 3, apply log or power transformation if the skew materially affects downstream performance.',
      };
    }
    if (title.includes('Multimodal')) {
      return {
        what: 'The feature shows multiple peaks, which often indicates mixed subpopulations within the same variable.',
        why: 'A single global rule may struggle to represent separate patient patterns cleanly, especially when peaks reflect different cohorts.',
        action: 'Prefer robust nonlinear models or consider segment-based modeling if this variable strongly shapes outcomes.',
      };
    }
    if (title.includes('Missing')) {
      return {
        what: 'Some observations contain empty values in one or more columns.',
        why: 'Missing values can bias estimates, reduce sample efficiency, or break algorithms that do not accept incomplete numeric inputs.',
        action: 'Use imputation or remove the feature if missingness is too high to preserve reliable signal.',
      };
    }
    return {
      what: 'A statistical anomaly was detected during the scan.',
      why: 'If ignored, it may distort training behavior, weaken generalization, or reduce trust in model outputs.',
      action: 'Review the variable in Feature Explorer and decide whether to transform, keep, or exclude it.',
    };
  };

  if (alerts.length === 0) {
    return (
      <div className="rounded-[20px] border border-[rgba(14,116,82,0.18)] bg-[linear-gradient(180deg,#eef8f2,#fbfefc)] p-6 text-center shadow-[0_10px_26px_rgba(14,116,82,0.04)]">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-[rgba(14,116,82,0.12)] bg-white shadow-sm">
          <BookOpen size={22} className="text-[var(--accent)]" />
        </div>
        <h4 className="text-[16px] font-bold text-[var(--text)]">Data looks healthy</h4>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--text2)]">
          No severe statistical anomalies or major dataset risks were detected in the preliminary scan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert, index) => {
        const style = getAlertStyle(alert.severity);
        const edu = getEducationalContent(alert.title);

        return (
          <div
            key={index}
            className={`overflow-hidden rounded-[20px] border shadow-[0_10px_28px_rgba(14,116,82,0.05)] ${style.shell}`}
          >
            <div className="flex items-start gap-4 border-b border-[rgba(190,201,193,0.3)] px-5 py-5">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(190,201,193,0.34)] bg-white shadow-sm">
                {style.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-3">
                  <h4 className={`text-[16px] font-bold ${style.title}`}>{alert.title}</h4>
                  <span className={`ha-badge ${style.badge}`}>{alert.severity}</span>
                </div>
                <p className="text-sm leading-7 text-[var(--text2)]">{alert.message}</p>
              </div>
            </div>

            <div className="grid gap-4 bg-white/72 px-5 py-5 md:grid-cols-2">
              <div className="rounded-[16px] border border-[rgba(190,201,193,0.36)] bg-white p-4">
                <h5 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text3)]">
                  <BookOpen size={14} className="text-[var(--accent)]" />
                  What it means
                </h5>
                <p className="text-[13px] leading-6 text-[var(--text2)]">{edu.what}</p>
              </div>

              <div className="rounded-[16px] border border-[rgba(190,201,193,0.36)] bg-white p-4">
                <h5 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text3)]">
                  <AlertTriangle size={14} className="text-amber-500" />
                  Why it matters
                </h5>
                <p className="text-[13px] leading-6 text-[var(--text2)]">{edu.why}</p>
              </div>

              <div className="rounded-[16px] border border-[rgba(0,89,62,0.16)] bg-[linear-gradient(180deg,#eef8f2,#fbfefc)] p-4 md:col-span-2">
                <h5 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                  <Target size={14} />
                  Recommendation for Step 3
                </h5>
                <p className="text-sm leading-7 text-[var(--text)]">{edu.action}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DataHealthAlerts;
