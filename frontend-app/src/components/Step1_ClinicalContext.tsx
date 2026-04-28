import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, HeartPulse, Search, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { useDomainStore } from '../store/useDomainStore';
import { domains } from '../config/domainConfig';

export const Step1_ClinicalContext: React.FC = () => {
  const selectedDomainId = useDomainStore((state) => state.selectedDomainId);
  const setDomain = useDomainStore((state) => state.setDomain);
  const domain = domains.find((item) => item.id === selectedDomainId) ?? domains[0];

  const [isDomainOpen, setIsDomainOpen] = useState(false);
  const [domainQuery, setDomainQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDomainOpen) return;
    const onClickAway = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDomainOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [isDomainOpen]);

  const filteredDomains = useMemo(() => {
    const query = domainQuery.trim().toLowerCase();
    if (!query) return domains;
    return domains.filter((item) => item.domainName.toLowerCase().includes(query) || item.clinicalQuestion.toLowerCase().includes(query));
  }, [domainQuery]);

  const targetText = domain.targetVariable.includes('(')
    ? domain.targetVariable.split('(')[0].trim()
    : domain.targetVariable;

  return (
    <section className="ha-step1-shell" id="step-1" data-testid="step1-container">
      <div className="w-full">
        <h2 className="ha-step1-title">Frame the clinical problem before the model touches the data.</h2>
        <p className="ha-step1-intro">
          Start with a clear clinical objective, a known safety boundary, and the right domain framing. Everything
          downstream becomes easier to interpret once the question is sharp.
        </p>

        <div className="ha-step1-domain-picker mt-8" ref={dropdownRef} data-tutorial="domain-picker">
          <div className="ha-step1-domain-icon">
            <HeartPulse size={18} />
          </div>

          <div className="ha-step1-domain-copy">
            <p>Domain Selection</p>
            <span data-testid="step1-domain">{domain.domainName}</span>
          </div>

          <div className="ha-step1-domain-select-wrap">
            <button
              type="button"
              className="ha-step1-domain-trigger"
              onClick={() => setIsDomainOpen((current) => !current)}
              aria-expanded={isDomainOpen}
              aria-controls="step1-domain-list"
            >
              Change
              <ChevronDown size={16} />
            </button>

            {isDomainOpen && (
              <div id="step1-domain-list" className="ha-step1-domain-menu" role="listbox">
                <div className="ha-step1-domain-search">
                  <Search size={14} />
                  <input
                    type="text"
                    value={domainQuery}
                    onChange={(event) => setDomainQuery(event.target.value)}
                    placeholder="Search domain..."
                  />
                </div>

                <div className="ha-step1-domain-options">
                  {filteredDomains.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      role="option"
                      aria-selected={item.id === selectedDomainId}
                      data-active={item.id === selectedDomainId}
                      onClick={() => {
                        void setDomain(item.id);
                        setIsDomainOpen(false);
                        setDomainQuery('');
                      }}
                    >
                      <strong>{item.domainName}</strong>
                      <span>{item.clinicalQuestion}</span>
                    </button>
                  ))}

                  {filteredDomains.length === 0 && (
                    <div className="ha-step1-domain-empty">No matching domain found.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ha-step1-grid">
        <article className="ha-step1-card ha-step1-card-question">
          <p className="ha-step1-label">Core Clinical Question</p>
          <h3 className="ha-step1-question" data-testid="step1-question">
            {domain.clinicalQuestion}.
          </h3>
          <p className="ha-step1-copy">
            Defining this outcome clearly isolates the temporal window and target population required for feature
            engineering.
          </p>
          <p className="ha-step1-note">
            This framing anchors the full workflow so feature engineering, validation, and explainability all map to
            the same clinical objective.
          </p>
        </article>

        <article className="ha-step1-card ha-step1-card-target">
          <p className="ha-step1-label">Target Variable</p>
          <div className="ha-step1-target-row">
            <span className="ha-step1-target-icon">
              <AlertTriangle size={18} />
            </span>
            <strong>{targetText.toUpperCase()}</strong>
          </div>
          <span className="ha-step1-badge">Binary Classification</span>
        </article>

        <article className="ha-step1-card">
          <p className="ha-step1-label">Why It Matters</p>
          <div className="ha-step1-why-row">
            <Sparkles size={18} />
            <p>{domain.whyThisMatters}</p>
          </div>
        </article>

        <article className="ha-step1-card ha-step1-card-safety">
          <p className="ha-step1-label">Scope &amp; Safety Boundary</p>
          <ul className="ha-step1-safety-list">
            <li>
              <CheckCircle2 size={15} />
              <span>Primary dataset: {domain.dataSource}.</span>
            </li>
            <li>
              <ShieldCheck size={15} />
              <span>Focuses on {domain.domainName.toLowerCase()} decision support workflow.</span>
            </li>
            <li>
              <XCircle size={15} />
              <span>Outputs support clinician review and do not replace medical diagnosis.</span>
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
};
