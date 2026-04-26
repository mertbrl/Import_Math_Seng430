import { create } from 'zustand';
import { domains } from '../config/domainConfig';
import { useEDAStore } from './useEDAStore';
import { useDataPrepStore } from './useDataPrepStore';
import { useModelStore } from './useModelStore';
import { cancelTrainingTasks, deleteSession } from '../services/pipelineApi';

const DEFAULT_DOMAIN_ID = domains[0].id;

function createSessionId(domainId: string, workflowVersion: number): string {
  return `workflow-${domainId}-${workflowVersion}`.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
}

function getInitialWorkflowState(hasChosenMode: boolean) {
  return hasChosenMode
    ? { currentStep: 1, step1Confirmed: false }
    : { currentStep: 1, step1Confirmed: false };
}

/**
 * Central gate resolver — single source of truth for step unlock logic.
 * Steps must be completed in strict linear order.
 */
function resolveMaxUnlockedStep(
  step1Confirmed: boolean,
  schemaValid: boolean,
  step5Completed: boolean,
  step6Completed: boolean,
): number {
  if (!step1Confirmed) return 1;

  let maxStep = 2;

  if (schemaValid) maxStep = 3;

  if (useDataPrepStore.getState().completedSteps.includes('preprocessing_review')) maxStep = 4;

  if (Object.keys(useModelStore.getState().results).length > 0) maxStep = 5;

  if (step5Completed) maxStep = 6;

  if (step6Completed) maxStep = 7;

  return maxStep;
}

async function teardownSession(sessionId: string) {
  try {
    const taskIds = Object.values(useModelStore.getState().tasks)
      .filter((task) => ['queued', 'running', 'cancelling'].includes(task.status))
      .map((task) => task.taskId);

    if (taskIds.length > 0) {
      await cancelTrainingTasks({ session_id: sessionId, task_ids: taskIds });
    }

    await deleteSession(sessionId);
  } catch {
    // Domain switching and reset must remain responsive even if the hosted API is waking up.
  }
}

function clearWorkflowState() {
  useEDAStore.getState().clearConfig();
  useDataPrepStore.getState().resetPrep();
  useModelStore.getState().resetAll();
}

export function getActiveSessionId(): string {
  return useDomainStore.getState().sessionId;
}

interface DomainState {
  selectedDomainId: string;
  workflowVersion: number;
  sessionId: string;
  isHelpOpen: boolean;
  hasChosenMode: boolean;
  currentStep: number;
  step1Confirmed: boolean;
  schemaValid: boolean;
  step5Completed: boolean;
  step6Completed: boolean;
  userMode: 'clinical' | 'data_scientist';
  theme: 'light' | 'dark';

  setDomain: (id: string) => Promise<void>;
  chooseMode: (mode: 'clinical' | 'data_scientist') => void;
  setUserMode: (mode: 'clinical' | 'data_scientist') => void;
  setTheme: (theme: 'light' | 'dark') => void;
  resetApp: () => Promise<void>;
  toggleHelp: () => void;
  setCurrentStep: (step: number) => void;
  confirmStep1: () => void;
  setSchemaValid: (valid: boolean) => void;
  completeStep5: () => void;
  completeStep6: () => void;
  /**
   * Cascade invalidation from `fromStep` onwards.
   * Clears all state that depends on steps >= fromStep.
   *
   * fromStep 3 or lower → clears training, step5Completed, step6Completed
   * fromStep 4          → clears training, step5Completed, step6Completed
   * fromStep 5          → clears step5Completed, step6Completed (keeps training data)
   * fromStep 6          → clears step6Completed only
   */
  invalidateFromStep: (fromStep: number) => void;
}

export const useDomainStore = create<DomainState>((set, get) => ({
  selectedDomainId: DEFAULT_DOMAIN_ID,
  workflowVersion: 1,
  sessionId: createSessionId(DEFAULT_DOMAIN_ID, 1),
  isHelpOpen: false,
  hasChosenMode: false,
  currentStep: 1,
  step1Confirmed: false,
  schemaValid: false,
  step5Completed: false,
  step6Completed: false,
  userMode: 'clinical',
  theme: 'light',

  setDomain: async (id: string) => {
    if (id === get().selectedDomainId) return;
    const { sessionId, workflowVersion, hasChosenMode } = get();
    clearWorkflowState();
    const nextWorkflowVersion = workflowVersion + 1;
    set({
      selectedDomainId: id,
      workflowVersion: nextWorkflowVersion,
      sessionId: createSessionId(id, nextWorkflowVersion),
      ...getInitialWorkflowState(hasChosenMode),
      schemaValid: false,
      step5Completed: false,
      step6Completed: false,
    });
    void teardownSession(sessionId);
  },

  chooseMode: (mode: 'clinical' | 'data_scientist') =>
    set({
      userMode: mode,
      hasChosenMode: true,
      currentStep: 1,
      step1Confirmed: false,
    }),

  setUserMode: (mode: 'clinical' | 'data_scientist') =>
    set({
      userMode: mode,
      hasChosenMode: true,
    }),

  setTheme: (theme: 'light' | 'dark') => set({ theme }),

  resetApp: async () => {
    if (window.confirm('Are you sure you want to reset all progress? This will restart the workflow from the beginning.')) {
      const { sessionId, workflowVersion, hasChosenMode } = get();
      clearWorkflowState();
      const nextWorkflowVersion = workflowVersion + 1;
      set({
        selectedDomainId: DEFAULT_DOMAIN_ID,
        workflowVersion: nextWorkflowVersion,
        sessionId: createSessionId(DEFAULT_DOMAIN_ID, nextWorkflowVersion),
        isHelpOpen: false,
        ...getInitialWorkflowState(hasChosenMode),
        schemaValid: false,
        step5Completed: false,
        step6Completed: false,
      });
      void teardownSession(sessionId);
    }
  },

  toggleHelp: () => set((state) => ({ isHelpOpen: !state.isHelpOpen })),

  setCurrentStep: (step: number) => {
    const { currentStep, step1Confirmed, schemaValid, step5Completed, step6Completed } = get();
    const maxUnlockedStep = resolveMaxUnlockedStep(step1Confirmed, schemaValid, step5Completed, step6Completed);
    const normalizedStep = Math.max(1, Math.min(7, step));
    const nextStep =
      normalizedStep <= currentStep
        ? normalizedStep
        : Math.min(normalizedStep, currentStep + 1, maxUnlockedStep);
    set({ currentStep: nextStep });
  },

  confirmStep1: () => set({ step1Confirmed: true, currentStep: 2 }),
  setSchemaValid: (valid: boolean) => set({ schemaValid: valid }),
  completeStep5: () => set({ step5Completed: true, currentStep: 6 }),
  completeStep6: () => set({ step6Completed: true, currentStep: 7 }),

  invalidateFromStep: (fromStep: number) => {
    // fromStep 3 or lower: full reset (model + flags)
    if (fromStep <= 4) {
      useModelStore.getState().resetAll();
      set({ step5Completed: false, step6Completed: false });
      return;
    }
    // fromStep 5: user modified something in Step 5 (e.g. picked different run)
    // Only Step 6 and beyond are stale; training results remain.
    if (fromStep === 5) {
      set({ step5Completed: false, step6Completed: false });
      return;
    }
    // fromStep 6: explainability re-run; Step 7 cache is stale
    if (fromStep === 6) {
      set({ step6Completed: false });
      return;
    }
  },
}));
