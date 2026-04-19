import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  HeartPulse,
  Microscope,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { useDomainStore } from '../store/useDomainStore';

const MODE_OPTIONS = [
  {
    mode: 'clinical' as const,
    title: 'Doctor Mode',
    description: 'One-click AI decisions. The system applies recommendations automatically.',
    tag: 'Auto-Apply',
    icon: Stethoscope,
    accent: 'var(--doctor)',
    bg: 'var(--doctor-light)',
  },
  {
    mode: 'data_scientist' as const,
    title: 'Data Scientist',
    description: 'Full control. Fine-tune each step, model, and parameter.',
    tag: 'Manual Control',
    icon: Microscope,
    accent: 'var(--ds)',
    bg: 'var(--ds-light)',
  },
] as const;

const STATS = [
  {
    value: 73,
    prefix: '',
    suffix: '',
    unit: 'days',
    description:
      'Healthcare data doubles every 73 days. Are you ready to harness the wave of clinical intelligence?',
    source: 'Source: Stanford Medicine',
  },
  {
    value: 422,
    prefix: '',
    suffix: 'M',
    unit: 'people',
    description:
      'Over 422 million people worldwide live with diabetes. Predictive AI models are critical for early intervention.',
    source: 'Source: WHO',
  },
  {
    value: 80,
    prefix: '',
    suffix: '%',
    unit: 'of health data',
    description:
      '80% of health data is unstructured. Clinical notes, images, and reports become usable when NLP opens them up.',
    source: 'Source: HIMSS',
  },
  {
    value: 150,
    prefix: '$',
    suffix: 'B',
    unit: 'annually',
    description:
      'AI implementation could save up to $150 billion annually in the US healthcare economy by 2026.',
    source: 'Source: Harvard Business Review',
  },
  {
    value: 48,
    prefix: '',
    suffix: 'h',
    unit: 'earlier',
    description:
      'ML models predict sepsis onset up to 48 hours earlier than traditional clinical methods.',
    source: 'Source: Nature Medicine',
  },
  {
    value: 94,
    prefix: '',
    suffix: '%',
    unit: 'accuracy',
    description:
      'AI-assisted tools match expert physician accuracy in specialized imaging diagnostics.',
    source: 'Source: Nature',
  },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Smart Preprocessing',
    description: 'Automated imputation, normalization, and encoding with every change kept explainable and reversible.',
  },
  {
    icon: BrainCircuit,
    title: 'One-Click Models',
    description: 'Train RF, XGBoost, and Logistic Regression with intelligent hyperparameter tuning.',
  },
  {
    icon: Activity,
    title: 'SHAP Explainability',
    description: 'Understand every prediction with feature importance views shaped for clinical review.',
  },
  {
    icon: Stethoscope,
    title: 'Doctor Mode',
    description: 'Auto-apply AI decisions with a single confirmation when speed matters more than tuning.',
  },
  {
    icon: HeartPulse,
    title: 'Clinical Metrics',
    description: 'AUC-ROC, sensitivity, specificity, and confusion matrices framed in clinical language.',
  },
  {
    icon: ShieldCheck,
    title: 'HIPAA-Ready',
    description: 'Data stays in your environment with an audit-friendly workflow from upload to final review.',
  },
];

function useCountUp(target: number, active: boolean, duration = 1500) {
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

const StatsCard: React.FC<{
  stat: (typeof STATS)[number];
  active: boolean;
}> = ({ stat, active }) => {
  const count = useCountUp(stat.value, active);
  const rendered = stat.suffix === 'M' || stat.suffix === 'B'
    ? Math.round(count)
    : count < 10
    ? count.toFixed(1)
    : Math.round(count);

  return (
    <div className="ha-slider-card relative min-h-[340px] overflow-hidden px-7 py-8 sm:px-10 sm:py-10">
      <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_center,_rgba(26,86,219,0.12),_transparent_70%)]" />
      <div className="relative flex h-full flex-col justify-between gap-8">
        <div>
          <div className="ha-metric">
            {stat.prefix}
            {rendered}
            {stat.suffix}
          </div>
          <div className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
            {stat.unit}
          </div>
        </div>

        <div className="space-y-4">
          <p className="max-w-2xl text-lg leading-8 text-[var(--text2)]">{stat.description}</p>
          <p className="text-sm text-[var(--text3)]">{stat.source}</p>
        </div>
      </div>
    </div>
  );
};

function buildHelixNodes() {
  return Array.from({ length: 16 }, (_, index) => {
    const progress = index / 15;
    const angle = progress * Math.PI * 5;
    const offset = Math.sin(angle) * 105;
    const width = Math.abs(Math.cos(angle)) * 95 + 90;
    const top = progress * 100;
    const scale = 0.78 + Math.abs(Math.cos(angle)) * 0.48;

    return {
      index,
      top,
      leftA: 50 + offset / 3.4,
      leftB: 50 - offset / 3.4,
      width,
      scale,
      delay: `${progress * 1.2}s`,
    };
  });
}

export const ExperienceModeScreen: React.FC = () => {
  const chooseMode = useDomainStore((state) => state.chooseMode);
  const [selectedMode, setSelectedMode] = useState<'clinical' | 'data_scientist'>('clinical');
  const [activeSlide, setActiveSlide] = useState(0);
  const particlesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const helixNodes = useMemo(buildHelixNodes, []);

  useEffect(() => {
    const canvas = particlesCanvasRef.current;
    const container = heroRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const particleCount = 76;
    const particles = Array.from({ length: particleCount }, () => ({
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.9 + 1.1,
    }));

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      particles.forEach((particle) => {
        particle.x = Math.random() * width;
        particle.y = Math.random() * height;
      });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.02)';
      ctx.fillRect(0, 0, width, height);

      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -20) particle.x = width + 20;
        if (particle.x > width + 20) particle.x = -20;
        if (particle.y < -20) particle.y = height + 20;
        if (particle.y > height + 20) particle.y = -20;
      });

      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 120) continue;

          ctx.strokeStyle = `rgba(26, 86, 219, ${0.08 - distance / 1800})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      particles.forEach((particle, index) => {
        const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.radius * 6);
        gradient.addColorStop(0, index % 2 === 0 ? 'rgba(26, 86, 219, 0.72)' : 'rgba(13, 148, 136, 0.68)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = index % 2 === 0 ? 'rgba(26, 86, 219, 0.85)' : 'rgba(13, 148, 136, 0.85)';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = ecgCanvasRef.current;
    const container = heroRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      width = container.clientWidth;
      height = 120;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let raf = 0;
    const start = performance.now();
    const render = (now: number) => {
      const t = (now - start) * 0.001;
      ctx.clearRect(0, 0, width, height);

      const baseY = 78;
      ctx.strokeStyle = 'rgba(13, 148, 136, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      ctx.lineTo(width, baseY);
      ctx.stroke();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(13, 148, 136, 0.9)';
      ctx.shadowColor = 'rgba(13, 148, 136, 0.5)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const wave = ((x + t * 180) % 280) / 280;
        let y = baseY;
        if (wave > 0.18 && wave < 0.22) y -= 10 * ((wave - 0.18) / 0.04);
        else if (wave >= 0.22 && wave < 0.24) y -= 10 - 12 * ((wave - 0.22) / 0.02);
        else if (wave >= 0.46 && wave < 0.5) y += 10 * ((wave - 0.46) / 0.04);
        else if (wave >= 0.5 && wave < 0.53) y -= 40 * ((wave - 0.5) / 0.03);
        else if (wave >= 0.53 && wave < 0.56) y += 48 * ((wave - 0.53) / 0.03) - 40;
        else if (wave >= 0.56 && wave < 0.62) y -= 10 - 10 * ((wave - 0.56) / 0.06);
        else if (wave >= 0.76 && wave < 0.85) y -= 14 * Math.sin(((wave - 0.76) / 0.09) * Math.PI);

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const activeOption = MODE_OPTIONS.find((option) => option.mode === selectedMode) ?? MODE_OPTIONS[0];

  return (
    <div className="app-shell" data-mode={selectedMode}>
      <div className="ha-landing-hero" ref={heroRef}>
        <canvas ref={particlesCanvasRef} className="ha-hero-canvas" />
        <div className="ha-dna-layer">
          <div className="ha-dna-helix">
            {helixNodes.map((node) => (
              <React.Fragment key={node.index}>
                <span
                  className="ha-dna-rung"
                  style={{
                    top: `${node.top}%`,
                    width: `${node.width}px`,
                    marginLeft: `${-node.width / 2}px`,
                    opacity: 0.24 + node.scale * 0.24,
                  }}
                />
                <span
                  className="ha-dna-node"
                  style={{
                    top: `${node.top}%`,
                    left: `${node.leftA}%`,
                    transform: `translate(-50%, -50%) scale(${node.scale})`,
                    animationDelay: node.delay,
                  }}
                />
                <span
                  className="ha-dna-node"
                  style={{
                    top: `${node.top}%`,
                    left: `${node.leftB}%`,
                    transform: `translate(-50%, -50%) scale(${Math.max(0.82, 1.2 - node.scale / 2)})`,
                    animationDelay: node.delay,
                  }}
                />
              </React.Fragment>
            ))}
          </div>
        </div>
        <canvas ref={ecgCanvasRef} className="ha-ecg-canvas" />

        <section className="page-wrap-wide relative z-10 py-10 sm:py-14 lg:py-20">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <span className="ha-pill ha-pill-accent">
              <ShieldCheck size={14} />
              Explainable AI · Clinical Grade
            </span>

            <h1 className="ha-hero-display mt-7 max-w-4xl">
              Empowering Clinical Decisions with <span className="ha-gradient-text">Explainable AI</span>.
            </h1>

            <p className="ha-body mt-6 max-w-2xl text-lg text-slate-500">
              Combine your medical expertise with advanced machine learning to explore data-driven diagnostics. No coding required.
            </p>

            <div className="mt-10 grid w-full max-w-4xl gap-5 md:grid-cols-2">
              {MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = option.mode === selectedMode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => setSelectedMode(option.mode)}
                    className="ha-floating-card rounded-[20px] border bg-white/88 p-6 text-left shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all"
                    style={{
                      borderColor: selected ? option.accent : 'rgba(226,232,240,0.92)',
                      boxShadow: selected ? `0 0 0 1px ${option.accent}, 0 24px 50px rgba(15, 23, 42, 0.12)` : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className="grid h-12 w-12 place-items-center rounded-2xl"
                        style={{ background: option.bg, color: option.accent }}
                      >
                        <Icon size={22} />
                      </div>
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

                    <h2 className="mt-6 font-[var(--font-display)] text-[26px] font-bold tracking-[-0.04em] text-[var(--text)]">
                      {option.title}
                    </h2>
                    <p className="mt-3 text-[15px] leading-7 text-[var(--text2)]">{option.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-10 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => chooseMode(selectedMode)}
                className="ha-button-primary inline-flex min-w-[260px] items-center justify-center gap-3 px-8 py-4 text-base"
              >
                Start Exploring 🚀
                <ArrowRight size={18} />
              </button>
              <span className="text-sm text-[var(--text3)]">
                Selected experience: <strong style={{ color: activeOption.accent }}>{activeOption.title}</strong>
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="page-wrap-wide py-20">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="ha-section-label">Clinical Intelligence</p>
              <h2 className="ha-display mt-2">AI is reshaping healthcare</h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSlide((current) => (current - 1 + STATS.length) % STATS.length)}
                className="ha-button-secondary inline-flex h-11 w-11 items-center justify-center p-0"
                aria-label="Previous statistic"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setActiveSlide((current) => (current + 1) % STATS.length)}
                className="ha-button-secondary inline-flex h-11 w-11 items-center justify-center p-0"
                aria-label="Next statistic"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div key={activeSlide} className="ha-animate-in mt-8">
            <StatsCard stat={STATS[activeSlide]} active />
          </div>

          <div className="ha-dot-nav mt-6 flex items-center justify-center gap-3">
            {STATS.map((_, index) => (
              <button
                key={index}
                type="button"
                data-active={index === activeSlide}
                onClick={() => setActiveSlide(index)}
                aria-label={`Show statistic ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="page-wrap-wide py-10 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="ha-section-label">Platform Highlights</p>
            <h2 className="ha-display mt-2">Everything you need, nothing you don&apos;t</h2>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="ha-feature-card p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--trust-light)] text-[var(--trust)]">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 font-[var(--font-display)] text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-7 text-[var(--text2)]">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="page-wrap-wide pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,var(--trust),var(--clinical))] px-8 py-10 text-white shadow-[0_30px_80px_rgba(26,86,219,0.25)] sm:px-12 sm:py-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-[var(--font-display)] text-[clamp(2rem,4vw,2.6rem)] font-bold tracking-[-0.05em]">
                  Ready to transform your diagnostics?
                </h2>
                <p className="mt-3 text-[17px] leading-8 text-white/82">
                  Move from raw clinical data to an explainable model pipeline that respects both speed and clinical judgment.
                </p>
              </div>

              <button
                type="button"
                onClick={() => chooseMode(selectedMode)}
                className="inline-flex items-center justify-center gap-3 rounded-[999px] bg-white px-7 py-4 font-semibold text-[var(--trust)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                Launch the App
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
