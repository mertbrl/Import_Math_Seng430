import { create } from 'zustand';
import { domains } from '../config/domainConfig';

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
    if (id === get().selectedDomainId) return;
    if (get().currentStep > 1) {
      if (!window.confirm('Changing the domain will reset your entire progress. Are you sure?')) return;
      set({ selectedDomainId: id, currentStep: 1, schemaValid: false });
    } else {
      set({ selectedDomainId: id });
    }
  },
  resetApp: () => {
    if (window.confirm("Are you sure you want to reset all progress? This will return you to Step 1.")) {
      set({ selectedDomainId: domains[0].id, isHelpOpen: false, currentStep: 1, schemaValid: false });
    }
  },
  toggleHelp: () => set((state) => ({ isHelpOpen: !state.isHelpOpen })),
  setCurrentStep: (step: number) => set({ currentStep: step }),
  setSchemaValid: (valid: boolean) => set({ schemaValid: valid }),
}));
