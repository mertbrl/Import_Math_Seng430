import React, { useMemo, useState } from 'react';
import { ArrowRight, ClipboardList, ShieldCheck, Stethoscope } from 'lucide-react';
import { useDomainStore } from '../store/useDomainStore';
import { domains } from '../config/domainConfig';

export const Step1_ClinicalContext: React.FC = () => {
  const selectedDomainId = useDomainStore((state) => state.selectedDomainId);
  const userMode = useDomainStore((state) => state.userMode);
  const confirmStep1 = useDomainStore((state) => state.confirmStep1);
  const setDomain = useDomainStore((state) => state.setDomain);
  const domain = domains.find((item) => item.id === selectedDomainId) ?? domains[0];

  const [objective, setObjective] = useState(domain.clinicalQuestion);

  const focusBullets = useMemo(
    () => [
      {
        title: 'Clinical question',
        text: domain.clinicalQuestion,
      },
      {
        title: 'Why it matters',
        text: domain.whyThisMatters,
      },
      {
        title: 'Target variable',
        text: domain.targetVariable,
      },
    ],
    [domain],
  );

  return (
    <div className="ha-card overflow-hidden" id="step-1" data-testid="step1-container">
      <div className="border-b border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(26,86,219,0.14),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(13,148,136,0.12),_transparent_35%),linear-gradient(180deg,_#ffffff,_#f8fafc)] px-7 py-8 sm:px-10 sm:py-10">
        <div className="flex flex-wrap gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl flex-1 min-w-[280px]"> 
            <span className="ha-pill ha-pill-accent">
              <Stethoscope size={14} />
              Step 1 · Clinical Context & Problem Definition
            </span>
            <h2 className="ha-display mt-5">Frame the clinical problem before the model touches the data.</h2>
            <p className="ha-body mt-4 max-w-2xl break-words min-w-0"> 
              Start with a clear clinical objective, a known safety boundary, and the right domain framing. Everything downstream becomes easier to interpret once the question is sharp.
            </p>
          </div>

          <div className="rounded-[20px] border border-[var(--border)] bg-white/80 px-5 py-4 backdrop-blur-md flex-1 min-w-[280px]">
            <p className="ha-section-label">Current Domain</p>
            <div className="relative mt-2">
              <select
                id="global-domain-select"
                value={selectedDomainId}
                onChange={(event) => {
                  setObjective(domains.find((item) => item.id === event.target.value)?.clinicalQuestion ?? objective);
                  void setDomain(event.target.value);
                }}
                className="w-full appearance-none rounded-[16px] border border-[var(--border)] bg-[var(--surface2)] px-5 py-3 pr-12 font-[var(--font-display)] text-[22px] font-bold tracking-[-0.04em] text-[var(--text)] outline-none cursor-pointer transition-all hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:border-[var(--accent)] focus:border-[var(--accent)] focus:bg-white focus:text-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_20%,transparent)]"
              >
                {domains.map((item) => (
                  <option key={item.id} value={item.id} className="text-base font-sans font-medium text-[var(--text)]">
                    {item.domainName}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-[var(--accent)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 px-7 py-8 sm:px-10 sm:py-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="space-y-6">
            <>
              <div className="ha-card-muted p-6">
                <p className="ha-section-label">Core Clinical Question</p>
                <h3 className="mt-3 font-[var(--font-display)] text-[28px] font-bold tracking-[-0.05em] text-[var(--text)] break-words min-w-0"> 
                  {domain.clinicalQuestion}
                </h3>
                <p className="ha-body mt-4">{domain.whyThisMatters}</p>
              </div>

              <div className="flex flex-wrap gap-4"> 
                {focusBullets.map((item) => (
                  <article key={item.title} className="ha-card p-5 flex-1 min-w-[200px]"> 
                    <p className="ha-section-label">{item.title}</p>
                    <p className="mt-3 text-sm font-semibold leading-7 text-[var(--text)] break-words min-w-0"> 
                      {item.title === 'Target variable' ? <span className="ha-code">{item.text}</span> : item.text}
                    </p>
                  </article>
                ))}
              </div>
            </>
        </section>

        <section className="flex flex-wrap gap-4"> 
          <div className="ha-card p-6 flex-1 min-w-[220px]"> 
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--trust-light)] text-[var(--trust)] shrink-0"> 
                <ClipboardList size={22} />
              </div>
              <div className="min-w-0 flex-1"> 
                <p className="ha-section-label text-ellipsis whitespace-nowrap overflow-hidden">Scope Summary</p> 
                <p className="mt-3 text-sm leading-7 text-[var(--text2)] break-words"> 
                  The workflow will use <strong className="text-[var(--text)]">{domain.dataSource}</strong> to answer a clinically framed question around <strong className="text-[var(--text)]">{domain.targetVariable}</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-[var(--warning)]/18 bg-[var(--warning-light)] p-6 flex-1 min-w-[220px]"> 
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[var(--warning)] shrink-0"> 
                <ShieldCheck size={22} />
              </div>
              <div className="min-w-0 flex-1"> 
                <p className="ha-section-label text-ellipsis whitespace-nowrap overflow-hidden" style={{ color: 'var(--warning)' }}> 
                  Safety Boundary
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--text)] break-words"> 
                  Model outputs support review and prioritization. They do not replace diagnosis, treatment planning, or clinician oversight.
                </p>
              </div>
            </div>
          </div>

          <div className="ha-card p-6 flex-1 min-w-[220px]"> 
            <p className="ha-section-label text-ellipsis whitespace-nowrap overflow-hidden">Next Step</p> 
            <p className="ha-body mt-3 break-words min-w-0"> 
              Continue into data exploration to upload the working dataset, inspect variable health, map the target, and validate that the pipeline can safely proceed.
            </p>

            <button
              onClick={confirmStep1}
              className="ha-button-primary mt-6 inline-flex w-full items-center justify-center gap-3"
            >
              Proceed to Data Exploration
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
