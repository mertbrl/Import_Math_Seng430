import { create } from 'zustand';
import { domains } from '../config/domainConfig';
import { useEDAStore } from './useEDAStore';
import { useModelStore } from './useModelStore';
import { cancelTrainingTasks } from '../services/pipelineApi';

interface DomainState {
  selectedDomainId: string;
  isHelpOpen: boolean;
  currentStep: number;
  schemaValid: boolean;
  setDomain: (id: string) => void;
  resetApp: () => void;
  toggleHelp: () => void;
  setCurrentStep: (step: number) => void;
  setSchemaValid: (valid: boolean) => void;
}

export const useDomainStore = create<DomainState>((set, get) => ({
  selectedDomainId: domains[0].id,
  isHelpOpen: false,
  currentStep: 1,
  schemaValid: false,
  setDomain: (id: string) => {
    const stopActiveTraining = async () => {
      const taskIds = Object.values(useModelStore.getState().tasks)
        .filter((task) => ['queued', 'running', 'cancelling'].includes(task.status))
        .map((task) => task.taskId);
      if (taskIds.length > 0) {
        await cancelTrainingTasks({ session_id: 'demo-session', task_ids: taskIds });
      }
    };

    if (id === get().selectedDomainId) return;
    if (get().currentStep > 1) {
      if (!window.confirm('Changing the domain will reset your entire progress. Are you sure?')) return;
      void stopActiveTraining();
      useEDAStore.getState().clearConfig();
      useModelStore.getState().resetAll();
      set({ selectedDomainId: id, currentStep: 1, schemaValid: false });
    } else {
      void stopActiveTraining();
      useEDAStore.getState().clearConfig();
      useModelStore.getState().resetAll();
      set({ selectedDomainId: id });
    }
  },
  resetApp: () => {
    const stopActiveTraining = async () => {
      const taskIds = Object.values(useModelStore.getState().tasks)
        .filter((task) => ['queued', 'running', 'cancelling'].includes(task.status))
        .map((task) => task.taskId);
      if (taskIds.length > 0) {
        await cancelTrainingTasks({ session_id: 'demo-session', task_ids: taskIds });
      }
    };

    if (window.confirm("Are you sure you want to reset all progress? This will return you to Step 1.")) {
      void stopActiveTraining();
      useEDAStore.getState().clearConfig();
      useModelStore.getState().resetAll();
      set({ selectedDomainId: domains[0].id, isHelpOpen: false, currentStep: 1, schemaValid: false });
    }
  },
  toggleHelp: () => set((state) => ({ isHelpOpen: !state.isHelpOpen })),
  setCurrentStep: (step: number) => set({ currentStep: step }),
  setSchemaValid: (valid: boolean) => set({ schemaValid: valid }),
}));
