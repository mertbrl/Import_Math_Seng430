import React from 'react';
import type { CorrelationEntry } from './mockEDAData';
import { Lightbulb, Info } from 'lucide-react';

/** Map a correlation value in [-1, 1] to a CSS colour string. */
function corrColor(val: number): string {
  if (val >= 0.85) return '#991b1b';   // deep red
  if (val >= 0.6) return '#dc2626';
  if (val >= 0.3) return '#f87171';
  if (val >= 0.1) return '#fecaca';
  if (val > -0.1) return '#f8fafc';    // near white
  if (val > -0.3) return '#bfdbfe';
  if (val > -0.6) return '#60a5fa';
  if (val > -0.85) return '#2563eb';
  return '#1e3a8a';                    // deep blue
}

function corrTextColor(val: number): string {
  const absVal = Math.abs(val);
  return absVal >= 0.6 ? '#ffffff' : '#1e293b';
}

interface CorrelationTabProps {
  numericColumnNames: string[];
  correlationMatrix: CorrelationEntry[];
}

const CorrelationTab: React.FC<CorrelationTabProps> = ({ numericColumnNames, correlationMatrix }) => {
  const n = numericColumnNames.length;


  const getValue = (row: string, col: string): number => {
    return correlationMatrix.find((e) => e.row === row && e.col === col)?.value ?? 0;
  };

  return (
    <div className="space-y-6">
      {/* Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm overflow-x-auto">
        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Info size={16} className="text-indigo-500" />
          Pearson Correlation Matrix
        </h4>

        <div className="inline-block">
          {/* Header row */}
          <div className="flex">
            <div className="w-28 shrink-0" />
            {numericColumnNames.map((col) => (
              <div
                key={col}
                className="w-20 shrink-0 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wide pb-2 px-0.5"
                style={{ writingMode: 'vertical-rl', height: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
              >
                <span style={{ transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>{col}</span>
              </div>
            ))}
          </div>

          {/* Data rows */}
          {numericColumnNames.map((row) => (
            <div key={row} className="flex items-center">
              <div className="w-28 shrink-0 text-[11px] font-semibold text-slate-700 pr-2 text-right truncate">
                {row}
              </div>
              {numericColumnNames.map((col) => {
                const val = getValue(row, col);
                return (
                  <div
                    key={`${row}-${col}`}
                    className="w-20 h-10 shrink-0 flex items-center justify-center text-[10px] font-bold border border-white/50 rounded-sm transition-transform hover:scale-110 hover:z-10 cursor-default"
                    style={{
                      backgroundColor: corrColor(val),
                      color: corrTextColor(val),
                    }}
                    title={`${row} ↔ ${col}: ${val.toFixed(2)}`}
                  >
                    {val.toFixed(2)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-5 flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Legend</span>
          <div className="flex h-4 rounded overflow-hidden border border-slate-200">
            {[
              '#1e3a8a', '#2563eb', '#60a5fa', '#bfdbfe',
              '#f8fafc',
              '#fecaca', '#f87171', '#dc2626', '#991b1b',
            ].map((c, i) => (
              <div key={i} className="w-9 h-full" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-medium gap-4">
            <span>−1.0 (Strong Negative)</span>
            <span>0 (None)</span>
            <span>+1.0 (Strong Positive)</span>
          </div>
        </div>
      </div>

      {/* AI Insight Callout */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5 shadow-sm flex items-start gap-4">
        <div className="p-2.5 bg-white rounded-lg border border-indigo-100 shadow-sm shrink-0">
          <Lightbulb size={20} className="text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-indigo-900 mb-1">💡 AI Insight: Multicollinearity Check</p>
          <p className="text-[13px] text-indigo-800 leading-relaxed">
            Variables with <strong>&gt;85% correlation</strong> (dark red/blue cells) can cause{' '}
            <strong>Multicollinearity</strong>, confusing non-tree-based models like Logistic Regression.
            {(() => {
              const highestCorr = correlationMatrix
                .filter(e => e.row !== e.col)
                .reduce((max, e) => Math.abs(e.value) > Math.abs(max.value) ? e : max, { row: '', col: '', value: 0 });
                
              if (Math.abs(highestCorr.value) > 0.85) {
                return (
                  <span>
                    {' '}In this dataset, <strong>{highestCorr.row} ↔ {highestCorr.col} ({highestCorr.value.toFixed(2)})</strong> is
                    flagged. Consider dropping one of these highly correlated features in <strong>Step 3</strong>.
                  </span>
                );
              }
              return (
                <span>
                  {' '}Great news: The highest correlation is <strong>{highestCorr.row} ↔ {highestCorr.col} ({highestCorr.value.toFixed(2)})</strong>,
                  meaning no severe multicollinearity was detected!
                </span>
              );
            })()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CorrelationTab;
