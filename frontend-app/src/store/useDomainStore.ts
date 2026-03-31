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

function resolveMaxUnlockedStep(step1Confirmed: boolean, schemaValid: boolean): number {
  let maxUnlockedStep = 1;

  if (!step1Confirmed) {
    return maxUnlockedStep;
  }

  maxUnlockedStep = 2;

  if (schemaValid) {
    maxUnlockedStep = 3;
  }

  if (useDataPrepStore.getState().completedSteps.includes('preprocessing_review')) {
    maxUnlockedStep = 4;
  }

  if (Object.keys(useModelStore.getState().results).length > 0) {
    maxUnlockedStep = 5;
  }

  return maxUnlockedStep;
}

async function teardownSession(sessionId: string) {
  const taskIds = Object.values(useModelStore.getState().tasks)
    .filter((task) => ['queued', 'running', 'cancelling'].includes(task.status))
    .map((task) => task.taskId);

  if (taskIds.length > 0) {
    await cancelTrainingTasks({ session_id: sessionId, task_ids: taskIds });
  }

  await deleteSession(sessionId);
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
  currentStep: number;
  step1Confirmed: boolean;
  schemaValid: boolean;
  setDomain: (id: string) => Promise<void>;
  resetApp: () => Promise<void>;
  toggleHelp: () => void;
  setCurrentStep: (step: number) => void;
  confirmStep1: () => void;
  setSchemaValid: (valid: boolean) => void;
}

export const useDomainStore = create<DomainState>((set, get) => ({
  selectedDomainId: DEFAULT_DOMAIN_ID,
  workflowVersion: 1,
  sessionId: createSessionId(DEFAULT_DOMAIN_ID, 1),
  isHelpOpen: false,
  currentStep: 1,
  step1Confirmed: false,
  schemaValid: false,
  setDomain: async (id: string) => {
    if (id === get().selectedDomainId) return;

    const { sessionId, workflowVersion } = get();
    await teardownSession(sessionId);
    clearWorkflowState();

    const nextWorkflowVersion = workflowVersion + 1;
    set({
      selectedDomainId: id,
      workflowVersion: nextWorkflowVersion,
      sessionId: createSessionId(id, nextWorkflowVersion),
      currentStep: 1,
      step1Confirmed: false,
      schemaValid: false,
    });
  },
  resetApp: async () => {
    if (window.confirm("Are you sure you want to reset all progress? This will return you to Step 1.")) {
      const { sessionId, workflowVersion } = get();
      await teardownSession(sessionId);
      clearWorkflowState();
      const nextWorkflowVersion = workflowVersion + 1;
      set({
        selectedDomainId: DEFAULT_DOMAIN_ID,
        workflowVersion: nextWorkflowVersion,
        sessionId: createSessionId(DEFAULT_DOMAIN_ID, nextWorkflowVersion),
        isHelpOpen: false,
        currentStep: 1,
        step1Confirmed: false,
        schemaValid: false,
      });
    }
  },
  toggleHelp: () => set((state) => ({ isHelpOpen: !state.isHelpOpen })),
  setCurrentStep: (step: number) => {
    const { currentStep, step1Confirmed, schemaValid } = get();
    const maxUnlockedStep = resolveMaxUnlockedStep(step1Confirmed, schemaValid);
    const normalizedStep = Math.max(1, Math.min(7, step));
    const nextStep =
      normalizedStep <= currentStep
        ? normalizedStep
        : Math.min(normalizedStep, currentStep + 1, maxUnlockedStep);
    set({ currentStep: nextStep });
  },
  confirmStep1: () => set({ step1Confirmed: true, currentStep: 2 }),
  setSchemaValid: (valid: boolean) => set({ schemaValid: valid }),
}));
