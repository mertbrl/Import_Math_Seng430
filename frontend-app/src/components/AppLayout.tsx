import React, { useMemo } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock3, Lock } from 'lucide-react';
import { TopNavbar } from './TopNavbar';
import { useDomainStore } from '../store/useDomainStore';
import { useDataPrepStore } from '../store/useDataPrepStore';
import { useEDAStore } from '../store/useEDAStore';
import { useModelStore } from '../store/useModelStore';
import { domains } from '../config/domainConfig';
import { MODEL_CATALOG } from '../features/modelTuning/modelCatalog';

interface AppLayoutProps {
  children: React.ReactNode;
}

const STEPS = [
  { id: 1, name: 'Clinical Context', hint: 'Problem definition' },
  { id: 2, name: 'Data Exploration', hint: 'Data quality review' },
  { id: 3, name: 'Data Preparation', hint: 'Preprocessing plan' },
  { id: 4, name: 'Clinical Goal', hint: 'Training strategy' },
  { id: 5, name: 'Training Results', hint: 'Model comparison' },
  { id: 6, name: 'Explainability', hint: 'Why the model acts' },
  { id: 7, name: 'Final Results', hint: 'Export and audit' },
] as const;

const TOTAL_STEPS = STEPS.length;

function resolveMaxUnlockedStep(
  step1Confirmed: boolean,
  schemaValid: boolean,
  prepReviewComplete: boolean,
  hasModelResults: boolean,
  step5Completed: boolean,
  step6Completed: boolean,
) {
  if (!step1Confirmed) return 1;
  if (!schemaValid) return 2;
  if (!prepReviewComplete) return 3;
  if (!hasModelResults) return 4;
  if (!step5Completed) return 5;
  if (!step6Completed) return 6;
  return 7;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const {
    selectedDomainId,
    currentStep,
    setCurrentStep,
    step1Confirmed,
    schemaValid,
    step5Completed,
    step6Completed,
    userMode,
  } = useDomainStore();

  const { completedSteps, cleaningPipeline } = useDataPrepStore();
  const resultsMap = useModelStore((state) => state.results);
  const bestResultTaskId = useModelStore((state) => state.bestResultTaskId);

  const prepReviewComplete = completedSteps.includes('preprocessing_review');
  const hasModelResults = Object.keys(resultsMap).length > 0;
  const maxUnlockedStep = resolveMaxUnlockedStep(
    step1Confirmed,
    schemaValid,
    prepReviewComplete,
    hasModelResults,
    step5Completed,
    step6Completed,
  );

  return (
    <div className="app-shell ha-animate-in" data-mode={userMode}
         style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopNavbar />

      {/* Stepper — sticky, full-width constrained container */}
      <div style={{ flexShrink: 0 }}>
        <div className="page-wrap-wide">
          <section className="ha-stepper-shell" style={{ marginTop: '0.75rem', marginBottom: '0' }}>
            <div className="ha-stepper">
              {STEPS.map((step, index) => {
                const state =
                  step.id < currentStep
                    ? 'complete'
                    : step.id === currentStep
                    ? 'active'
                    : step.id <= maxUnlockedStep
                    ? 'upcoming'
                    : 'locked';

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setCurrentStep(step.id)}
                    className="ha-stepper-item"
                    data-state={state}
                    disabled={state === 'locked'}
                    title={state === 'locked' ? 'Complete earlier steps to unlock this stage.' : step.name}
                  >
                    {index < STEPS.length - 1 && (
                      <span
                         className="ha-stepper-connector"
                        style={{ ['--fill' as any]: step.id < currentStep ? '100%' : '0%' }}
                      />
                    )}

                    <span className="ha-stepper-circle">
                      {state === 'complete' ? <Check size={16} /> : state === 'locked' ? <Lock size={14} /> : step.id}
                    </span>

                    <div className="min-w-0">
                      <div className="ha-stepper-caption">
                        {state === 'complete' ? 'Completed' : state === 'active' ? 'In Progress' : state === 'locked' ? 'Locked' : 'Upcoming'}
                      </div>
                      <div className="ha-stepper-title">{step.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Scrollable content area */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="page-wrap-wide">
          <div className="ha-content-grid">
            <main className="min-w-0">
              <div className="ha-animate-in">{children}</div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={currentStep === 1}
                  className={currentStep === 1 ? 'ha-button-locked inline-flex items-center justify-center gap-2' : 'ha-button-secondary inline-flex items-center justify-center gap-2'}
                  title={currentStep === 1 ? 'Already at the first step.' : undefined}
                >
                  <ChevronLeft size={16} />
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={currentStep >= maxUnlockedStep || currentStep === TOTAL_STEPS}
                  className={currentStep >= maxUnlockedStep || currentStep === TOTAL_STEPS ? 'ha-button-locked inline-flex items-center justify-center gap-2' : 'ha-button-primary inline-flex items-center justify-center gap-2'}
                  title={currentStep >= maxUnlockedStep && currentStep !== TOTAL_STEPS ? 'Finish this step to continue.' : undefined}
                >
                  Continue
                  <ChevronRight size={16} />
                </button>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};
