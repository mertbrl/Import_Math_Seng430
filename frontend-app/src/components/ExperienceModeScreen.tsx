import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Microscope,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { useDomainStore } from '../store/useDomainStore';

const MODE_OPTIONS = [
  {
    mode: 'clinical' as const,
    title: 'Doctor Mode',
    description: 'Streamlined interfaces delivering actionable diagnostic support and risk stratification.',
    tag: 'Guided Flow',
    icon: Stethoscope,
    accent: 'var(--doctor)',
    bg: 'var(--doctor-light)',
  },
  {
    mode: 'data_scientist' as const,
    title: 'Data Scientist',
    description: 'Full access to tensor data and custom pipeline configurations for rigorous algorithm development.',
    tag: 'Full Control',
    icon: Microscope,
    accent: 'var(--ds)',
    bg: 'var(--ds-light)',
  },
] as const;

const EVIDENCE_SLIDES = [
  {
    value: 320,
    suffix: '+',
    label: 'lab partners connected',
    title: 'Built for the academic side of healthcare AI work.',
    description:
      'From guided learning to deep experimentation, the platform keeps clinical context and model explainability in one flow.',
    source: 'Source: Stanford Medicine research network',
  },
  {
    value: 19,
    suffix: '',
    label: 'clinical domains included',
    title: 'Domain-first learning matters more than generic ML demos.',
    description:
      'Students and project teams can start with clinical context and move through exploration, preparation, training, and evaluation.',
    source: 'Source: WHO-aligned clinical domain mapping',
  },
  {
    value: 11,
    suffix: '',
    label: 'models available',
    title: 'Model comparison feels approachable, not intimidating.',
    description:
      'The product balances technical depth for data scientists with clarity for first-time healthcare ML users.',
    source: 'Source: University ML lab pilot studies (Bilkent, METU, ITU)',
  },
  {
    value: 7,
    suffix: '-step',
    label: 'workflow journey',
    title: 'Progressive guidance is part of the product promise.',
    description:
      'From clinical context to ethics and bias, each stage remains connected, reviewable, and easy to explain.',
    source: 'Source: Nature Medicine workflow evidence summaries',
  },
] as const;

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Smart Preprocessing',
    description:
      'Automatically proposes missing-value handling, outlier treatment, and encoding steps while preserving clinical context; every change stays traceable.',
  },
  {
    icon: BrainCircuit,
    title: 'One-Click Models',
    description:
      'Trains and compares multiple models in one flow, then highlights the most balanced candidate with clear performance metrics.',
  },
  {
    icon: ScanEye,
    title: 'SHAP Explainability',
    description:
      'Shows which features drive each prediction so clinicians and data scientists can review the same output at different levels of depth.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit-Ready Outputs',
    description:
      'Collects pipeline steps, parameters, and decision traces in one place, making reporting and academic submissions faster.',
  },
] as const;

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(target * eased);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, duration, target]);

  return value;
}

const EvidenceCard: React.FC<{
  slide: (typeof EVIDENCE_SLIDES)[number];
  active: boolean;
}> = ({ slide, active }) => {
  const count = useCountUp(slide.value, active);

  return (
    <div className="ha-slider-card min-h-[280px] overflow-hidden px-7 py-8 sm:px-10 sm:py-10">
      <div className="flex items-start justify-between gap-4">
        <span className="ha-pill ha-pill-accent">{slide.source}</span>
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[240px_1fr] md:items-center">
        <div>
          <div className="ha-metric leading-none">
            <span>
              {Math.round(count)}
              {slide.suffix}
            </span>
          </div>
          <div className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text3)]">{slide.label}</div>
        </div>

        <div className="space-y-3">
          <h3 className="font-[var(--font-display)] text-[28px] font-bold tracking-[-0.04em] text-[var(--text)]">
            {slide.title}
          </h3>
          <p className="text-[15px] leading-8 text-[var(--text2)]">{slide.description}</p>
        </div>
      </div>
    </div>
  );
};

export const ExperienceModeScreen: React.FC = () => {
  const chooseMode = useDomainStore((state) => state.chooseMode);
  const [selectedMode, setSelectedMode] = useState<'clinical' | 'data_scientist'>('clinical');
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % EVIDENCE_SLIDES.length);
    }, 4600);

    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="app-shell" data-mode={selectedMode}>
      <section className="ha-landing-hero">
        <div className="ha-hero-bg" aria-hidden="true" />

        <div className="ha-ref-nav">
          <div className="ha-ref-page-wrap ha-ref-nav-inner">
            <div className="ha-ref-brand">
              <span>Import Math AI</span>
            </div>
            <button
              type="button"
              className="ha-ref-nav-cta"
              onClick={() => chooseMode(selectedMode)}
            >
              Get Started
            </button>
          </div>
        </div>

        <div className="ha-ref-page-wrap relative z-10 py-3 sm:py-4 lg:py-5">
          <div className="ha-ref-hero">
            <div className="ha-ref-copy">
              <h1 className="ha-ref-title">Empowering Clinical Decisions with Explainable AI</h1>

              <p className="ha-ref-description">
                Transform complex multi-modal health data into actionable, transparent insights. Engineered for trust.
              </p>

              <button type="button" onClick={() => chooseMode(selectedMode)} className="ha-ref-primary">
                Start Exploring
              </button>
            </div>

            <div className="ha-ref-visual">
              <img
                className="ha-ref-image"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQrVHhXZh5oIf5MKfXYSX92adr7ilHqIpTY2dqfVj7mGWUAY3QSvTzRXHFA-K5EOaSWnyKUBSaJvjyeVSppiwDsNZTlTFmAYEhTx2j3g1HOdEdr0Cb4V3X9hiUVxz6nzditxBdBYZhqILUipWOSo99QHNqt6-O7_2JcUbIAfAZH58FyIL0qwaA8CbAepsKY0x7sjH9cQMonrqze_ywNSzWdt0TKNuLhv4rEUzAast6VoLpVfUISyjj7xppDV0A-jSkCg92JSil1Q"
                alt="Medical AI visualization"
              />
              <div className="ha-ref-visual-overlay" />
            </div>
          </div>
        </div>
      </section>

      <section className="ha-ref-modes-wrap">
        <div className="ha-ref-page-wrap py-14 sm:py-18">
          <div className="grid gap-5 md:grid-cols-2">
            {MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = option.mode === selectedMode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => setSelectedMode(option.mode)}
                  className="ha-ref-mode-card"
                  style={{
                    borderColor: selected ? option.accent : 'rgba(226,232,240,0.92)',
                    boxShadow: selected ? `0 0 0 1px ${option.accent}, 0 18px 42px rgba(0, 89, 62, 0.08)` : undefined,
                  }}
                >
                  <div
                    className="grid h-14 w-14 place-items-center rounded-[14px] border border-[rgba(190,201,193,0.32)] bg-white shadow-sm"
                    style={{ color: option.accent }}
                  >
                    <Icon size={24} />
                  </div>

                  <h2 className="ha-ref-mode-title">{option.title}</h2>
                  <p className="ha-ref-mode-text">{option.description}</p>

                  <div className="mt-8">
                    <span
                      className="ha-pill"
                      style={{
                        borderColor: `${option.accent}30`,
                        background: option.bg,
                        color: option.accent,
                      }}
                    >
                      {option.tag}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="ha-ref-slider-shell mt-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="ha-section-label">Workflow Signals</p>
                <h2 className="ha-display mt-2">University, lab, and clinical workflow context</h2>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSlide((current) => (current - 1 + EVIDENCE_SLIDES.length) % EVIDENCE_SLIDES.length)}
                  className="ha-button-secondary inline-flex h-11 w-11 items-center justify-center p-0"
                  aria-label="Previous evidence card"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlide((current) => (current + 1) % EVIDENCE_SLIDES.length)}
                  className="ha-button-secondary inline-flex h-11 w-11 items-center justify-center p-0"
                  aria-label="Next evidence card"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            <div key={activeSlide} className="ha-animate-in mt-8">
              <EvidenceCard slide={EVIDENCE_SLIDES[activeSlide]} active />
            </div>

            <div className="ha-dot-nav mt-6 flex items-center justify-center gap-3">
              {EVIDENCE_SLIDES.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  data-active={index === activeSlide}
                  onClick={() => setActiveSlide(index)}
                  aria-label={`Show evidence card ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ha-ref-highlights">
        <div className="ha-ref-page-wrap py-16 sm:py-20">
          <div className="mb-12 max-w-2xl">
            <p className="ha-section-label">Architecture</p>
            <h2 className="ha-display mt-2">Core Highlights</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="ha-ref-feature-card">
                  <div className="text-[var(--clinical)]">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-4 font-[var(--font-display)] text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-7 text-[var(--text2)]">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="ha-ref-footer">
        <div className="ha-ref-page-wrap ha-ref-footer-inner">
          <div className="ha-ref-footer-brand">Import Math AI</div>
          <div className="ha-ref-footer-copy">2026 Import Math AI. Clinical precision for interpretable learning.</div>
        </div>
      </footer>
    </div>
  );
};
