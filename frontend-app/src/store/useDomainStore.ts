import { create } from 'zustand';
import { domains } from '../config/domainConfig';

interface DomainState {
  selectedDomainId: string;
  isHelpOpen: boolean;
  setDomain: (id: string) => void;
  resetApp: () => void;
  toggleHelp: () => void;
}

export const useDomainStore = create<DomainState>((set) => ({
  selectedDomainId: domains[0].id,
  isHelpOpen: false,
  setDomain: (id: string) => set({ selectedDomainId: id }),
  resetApp: () => {
    if (window.confirm("Are you sure you want to reset all progress? This will return you to Step 1.")) {
      set({ selectedDomainId: domains[0].id, isHelpOpen: false });
    }
  },
  toggleHelp: () => set((state) => ({ isHelpOpen: !state.isHelpOpen })),
}));
