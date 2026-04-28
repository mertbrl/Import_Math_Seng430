import React from 'react';
import { Check, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { TopNavbar } from './TopNavbar';
import { HelpChatbotDrawer } from './HelpChatbotDrawer';
import { TutorialOverlay, TutorialStep } from './TutorialOverlay';
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

const WORKFLOW_TUTORIAL_STEPS: TutorialStep[] = [
  {
    eyebrow: 'Workflow Guide',
    title: 'Follow the stepper from left to right.',
    body: 'The top stepper shows where you are. Locked steps open after the required earlier decisions are complete, so if Continue is disabled, finish the current review first.',
    targetSelector: '[data-tutorial="workflow-stepper"]',
    placement: 'bottom',
  },
  {
    eyebrow: 'Navigation',
    title: 'Use Continue and Back at the bottom.',
    body: 'Continue saves the current milestone and moves forward when the step is ready. Back lets you revise earlier choices without resetting the whole workflow.',
    targetSelector: '[data-tutorial="workflow-continue"]',
    placement: 'top',
  },
  {
    eyebrow: 'Mode Switch',
    title: 'Doctor Mode and Data Scientist mode show different detail levels.',
    body: 'Doctor Mode simplifies clinical review. Data Scientist mode exposes more model, metric, and simulator detail. The workflow data stays connected when you switch.',
    targetSelector: '[data-tutorial="mode-switch"]',
    placement: 'bottom',
  },
  {
    eyebrow: 'Domain Selection',
    title: 'Choose the clinical domain here.',
    body: 'This is where you select the patient problem and outcome. The rest of the workflow updates around this domain, so start here when you want a different clinical scenario.',
    targetSelector: '[data-tutorial="domain-picker"]',
    placement: 'bottom',
  },
  {
    eyebrow: 'AI Assistant',
    title: 'Use the floating assistant when terminology gets dense.',
    body: 'This animated AI button opens the help drawer. Ask about locked steps, metrics, confidence, feature importance, model selection, and explainability sliders.',
    targetSelector: '[data-tutorial="floating-ai-chat"]',
    placement: 'left',
  },
];

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
  const resultsMap = useModelStore((state) => state.results);

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

  const canContinueByCompletingStep = currentStep === 5 || currentStep === 6;
  const continueDisabled =
    currentStep === TOTAL_STEPS || (!canContinueByCompletingStep && currentStep !== 1 && currentStep >= maxUnlockedStep);
  const isClinicalStep3 = currentStep === 3 && userMode === 'clinical';

  return (
    <div
      className={`app-shell ha-animate-in ${currentStep === 1 ? 'ha-step1-theme' : ''} ${currentStep === 2 ? 'ha-step2-theme' : ''} ${isClinicalStep3 ? 'ha-step3-theme' : ''} ${currentStep === 4 ? 'ha-step4-theme' : ''}`}
      data-mode={userMode}
      data-theme={theme}
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <TopNavbar />
      <HelpChatbotDrawer />
      <TutorialOverlay
        steps={WORKFLOW_TUTORIAL_STEPS}
        storageKey="import-math-workflow-tutorial-v4"
        reopenEventName="import-math-open-workflow-tutorial"
      />

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="page-wrap-wide">
          <div className="ha-stepper-wrap">
            <section className="ha-stepper-shell" data-tutorial="workflow-stepper">
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
                          {state === 'complete'
                            ? 'Completed'
                            : state === 'active'
                              ? 'In Progress'
                              : state === 'locked'
                                ? 'Locked'
                                : 'Upcoming'}
                        </div>
                        <div className="ha-stepper-title">{step.name}</div>
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

              {!isClinicalStep3 && (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    data-tutorial={currentStep === 1 ? 'workflow-back' : undefined}
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
                    data-tutorial="workflow-continue"
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
