import React from 'react';
import InfoPopover from '../../../../components/common/InfoPopover';

export interface FieldInfo {
  title: string;
  content: React.ReactNode;
}

const FieldLabel: React.FC<{ label: string; info?: FieldInfo }> = ({ label, info }) => (
  <div className="flex items-center gap-2">
    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</label>
    {info ? (
      <InfoPopover title={info.title} panelWidthClassName="w-[22rem]">
        {info.content}
      </InfoPopover>
    ) : null}
  </div>
);

export const ParamSlider: React.FC<{
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  info?: FieldInfo;
}> = ({ label, hint, value, min, max, step = 1, onChange, format, info }) => (
  <div className="ha-step4-param-slider space-y-1.5">
    <div className="flex items-center justify-between gap-3">
      <FieldLabel label={label} info={info} />
      <span className="ha-step4-slider-value rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-sm font-black text-indigo-600">
        {format ? format(value) : value}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="ha-step4-slider-input h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600"
    />
    <p className="ha-step4-field-hint text-[11px] leading-relaxed text-slate-400">{hint}</p>
  </div>
);

export const SelectField: React.FC<{
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  info?: FieldInfo;
}> = ({ label, hint, value, onChange, options, info }) => (
  <div className="ha-step4-select-wrap space-y-1.5">
    <FieldLabel label={label} info={info} />
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="ha-step4-select-field w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <p className="ha-step4-field-hint text-[11px] leading-relaxed text-slate-400">{hint}</p>
  </div>
);

export const ToggleField: React.FC<{
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  trueLabel: string;
  falseLabel: string;
  info?: FieldInfo;
}> = ({ label, hint, value, onChange, trueLabel, falseLabel, info }) => (
  <div className="ha-step4-toggle-wrap space-y-1.5">
    <div className="flex items-center justify-between gap-3">
      <FieldLabel label={label} info={info} />
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`ha-step4-toggle-pill rounded-full px-3 py-1 text-xs font-bold transition-colors ${
          value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {value ? trueLabel : falseLabel}
      </button>
    </div>
    <p className="ha-step4-field-hint text-[11px] leading-relaxed text-slate-400">{hint}</p>
  </div>
);

export const InfoBox: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="ha-step4-info-box rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
    <p className="font-bold">{title}</p>
    <p className="mt-1 leading-relaxed">{children}</p>
  </div>
);
