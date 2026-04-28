import React from 'react';
import { Check, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { TopNavbar } from './TopNavbar';
import { HelpChatbotDrawer } from './HelpChatbotDrawer';
import { useDomainStore } from '../store/useDomainStore';
import { useDataPrepStore } from '../store/useDataPrepStore';
import { useModelStore } from '../store/useModelStore';

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
  hasTrainingActivity: boolean,
  step5Completed: boolean,
  step6Completed: boolean,
) {
  if (!step1Confirmed) return 1;
  if (!schemaValid) return 2;
  if (!prepReviewComplete) return 3;
  if (!hasTrainingActivity) return 4;
  if (!step5Completed) return 5;
  if (!step6Completed) return 6;
  return 7;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const {
    currentStep,
    setCurrentStep,
    confirmStep1,
    completeStep5,
    completeStep6,
    step1Confirmed,
    schemaValid,
    step5Completed,
    step6Completed,
    userMode,
    theme,
  } = useDomainStore();

  const { completedSteps } = useDataPrepStore();
  const tasksMap = useModelStore((state) => state.tasks);
  const resultsMap = useModelStore((state) => state.results);

  const prepReviewComplete = completedSteps.includes('preprocessing_review');
  const hasTrainingActivity = Object.keys(tasksMap).length > 0 || Object.keys(resultsMap).length > 0;
  const maxUnlockedStep = resolveMaxUnlockedStep(
    step1Confirmed,
    schemaValid,
    prepReviewComplete,
    hasTrainingActivity,
    step5Completed,
    step6Completed,
  );

  const canContinueByCompletingStep = currentStep === 5 || currentStep === 6;
  const continueDisabled =
    currentStep === TOTAL_STEPS || (!canContinueByCompletingStep && currentStep !== 1 && currentStep >= maxUnlockedStep);
  const isStep3 = currentStep === 3;

  return (
    <div
      className={`app-shell ha-animate-in ${currentStep === 1 ? 'ha-step1-theme' : ''} ${currentStep === 2 ? 'ha-step2-theme' : ''} ${isStep3 ? 'ha-step3-theme' : ''} ${currentStep === 4 ? 'ha-step4-theme' : ''} ${currentStep === 5 ? 'ha-step5-theme' : ''} ${currentStep === 6 ? 'ha-step6-theme' : ''} ${currentStep === 7 ? 'ha-step7-theme' : ''}`}
      data-mode={userMode}
      data-theme={theme}
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <TopNavbar />
      <HelpChatbotDrawer />

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="page-wrap-wide">
          <div className="ha-stepper-wrap">
            <section className="ha-stepper-shell">
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
                        <div className={`ha-stepper-caption ha-stepper-caption-${state}`}>
                          {state === 'complete'
                            ? 'Completed'
                            : state === 'active'
                              ? 'In Progress'
                              : state === 'locked'
                                ? 'Locked'
                                : 'Upcoming'}
                        </div>
                        <div className={`ha-stepper-title ha-stepper-title-${state}`}>{step.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="ha-content-grid">
            <main className="min-w-0">
              <div className="ha-animate-in">{children}</div>

              {!isStep3 && currentStep !== 7 && (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    disabled={currentStep === 1}
                    className={
                      currentStep === 1
                        ? 'ha-button-locked inline-flex items-center justify-center gap-2'
                        : 'ha-button-secondary inline-flex items-center justify-center gap-2'
                    }
                    title={currentStep === 1 ? 'Already at the first step.' : undefined}
                  >
                    <ChevronLeft size={16} />
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep === 1 && !step1Confirmed) {
                        confirmStep1();
                        return;
                      }
                      if (currentStep === 5) {
                        completeStep5();
                        return;
                      }
                      if (currentStep === 6) {
                        completeStep6();
                        return;
                      }
                      setCurrentStep(currentStep + 1);
                    }}
                    disabled={continueDisabled}
                    className={
                      continueDisabled
                        ? 'ha-button-locked inline-flex items-center justify-center gap-2'
                        : 'ha-button-primary inline-flex items-center justify-center gap-2'
                    }
                    title={continueDisabled && currentStep !== TOTAL_STEPS ? 'Finish this step to continue.' : undefined}
                  >
                    Continue
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};
