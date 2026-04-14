import React from 'react';
import { TopNavbar } from './TopNavbar';
import { HelpChatbotDrawer } from './HelpChatbotDrawer';
import { useDomainStore } from '../store/useDomainStore';
import { useEDAStore } from '../store/useEDAStore';
import { useDataPrepStore } from '../store/useDataPrepStore';
import { useModelStore } from '../store/useModelStore';
import { domains } from '../config/domainConfig';
import { Check } from 'lucide-react';
import WarningModal from './common/WarningModal';
import { cancelTrainingTasks } from '../services/pipelineApi';

interface AppLayoutProps {
  children: React.ReactNode;
}

const STEPS = [
  { id: 1, name: 'Clinical Context', desc: 'Use case & goals' },
  { id: 2, name: 'Data Exploration', desc: 'Upload & understand' },
  { id: 3, name: 'Data Preparation', desc: 'Clean & split data' },
  { id: 4, name: 'Model Queue', desc: 'Tune & send runs' },
  { id: 5, name: 'Results', desc: 'Compare finished runs' },
  { id: 6, name: 'Explainability', desc: 'Why this prediction?' },
  { id: 7, name: 'Ethics & Bias', desc: 'Fairness check' },
];

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { selectedDomainId, setDomain, currentStep, setCurrentStep, schemaValid, sessionId, step1Confirmed, step5Completed, step6Completed, invalidateFromStep } = useDomainStore();
  const clearEDAConfig = useEDAStore((s) => s.clearConfig);
  const resetPrep = useDataPrepStore((s) => s.resetPrep);
  const prepReviewComplete = useDataPrepStore((s) => s.completedSteps.includes('preprocessing_review'));
  const resetModelFlow = useModelStore((s) => s.resetAll);
  const modelTasks = useModelStore((s) => s.tasks);
  const modelResults = useModelStore((s) => s.results);
  const hasModelResults = Object.keys(modelResults).length > 0;
  const maxUnlockedStep = React.useMemo(() => {
    let maxStep = 1;
    if (!step1Confirmed) {
      return maxStep;
    }
    maxStep = 2;
    if (schemaValid) {
      maxStep = 3;
    }
    if (prepReviewComplete) {
      maxStep = 4;
    }
    if (hasModelResults) {
      maxStep = 5;
    }
    if (step5Completed) {
      maxStep = 6;
    }
    if (step6Completed) {
      maxStep = 7;
    }
    return maxStep;
  }, [step1Confirmed, schemaValid, prepReviewComplete, hasModelResults, step5Completed, step6Completed]);
  const nextReachableStep = currentStep < maxUnlockedStep ? currentStep + 1 : currentStep;
  const activeTrainingTaskIds = Object.values(modelTasks)
    .filter((task) => ['queued', 'running', 'cancelling'].includes(task.status))
    .map((task) => task.taskId);

  // Modal State
  const [modalConfig, setModalConfig] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: undefined,
    cancelText: undefined,
  });

  // Dynamic step state driven by currentStep from Zustand
  const getStepState = (id: number): 'completed' | 'active' | 'locked' => {
    if (id < currentStep) return 'completed';
    if (id === currentStep) return 'active';
    if (id === nextReachableStep && id <= maxUnlockedStep) return 'active';
    return 'locked';
  };

  const handleStepClick = (targetStepId: number) => {
    const state = getStepState(targetStepId);
    if (state === 'locked' || targetStepId === currentStep) return;

    // Backward Navigation Guard
    if (targetStepId < currentStep) {
      const stepName = STEPS.find(s => s.id === targetStepId)?.name || `Step ${targetStepId}`;
      setModalConfig({
        isOpen: true,
        title: 'Loss of Downstream Progress',
        message: `Warning: Going back to "${stepName}" will erase all progress made in the subsequent steps (e.g., Data Preparation configurations). Do you want to proceed?`,
        onConfirm: () => {
          // Cascading State Invalidation via invalidateFromStep
          invalidateFromStep(targetStepId);
          if (targetStepId === 1) {
            clearEDAConfig();
            resetPrep();
          } else if (targetStepId === 2) {
            resetPrep();
          }
          setCurrentStep(targetStepId);
          closeModal();
        },
        confirmText: 'Yes, Erase Progress',
        cancelText: 'Cancel',
      });
      return;
    }

    if (targetStepId === 5 && activeTrainingTaskIds.length > 0 && hasModelResults) {
      setModalConfig({
        isOpen: true,
        title: 'Open Results Now?',
        message: 'Some training runs are still in progress. If you continue, the remaining queue will be stopped and Step 5 will open with the finished results you already have.',
        onConfirm: () => {
          void (async () => {
            await cancelTrainingTasks({ session_id: sessionId, task_ids: activeTrainingTaskIds });
            const tasks = useModelStore.getState().tasks;
            const setTask = useModelStore.getState().setTask;
            activeTrainingTaskIds.forEach((taskId) => {
              const task = tasks[taskId];
              if (!task) {
                return;
              }
              setTask(taskId, {
                taskId,
                model: task.model,
                status: task.status === 'queued' ? 'cancelled' : 'cancelling',
              });
            });
            setCurrentStep(targetStepId);
            closeModal();
          })();
        },
        confirmText: 'Stop And Open Results',
        cancelText: 'Keep Training',
      });
      return;
    }

    // Forward Navigation
    setCurrentStep(targetStepId);
  };

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <TopNavbar />
      <HelpChatbotDrawer />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-none px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 py-6 sm:py-8 flex flex-col gap-6">
        
        {/* Sticky Header Section for Domain + Stepper */}
        <div className="sticky top-[60px] z-40 bg-slate-50/95 backdrop-blur-sm pt-2 pb-4 border-b border-transparent space-y-5 shadow-[0_10px_20px_-15px_rgba(0,0,0,0.05)]">
          {/* Domain Selector Bar */}
          <section>
            <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2.5 pl-1">Select Clinical Domain</h2>
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {domains.map((d) => {
                const isActive = d.id === selectedDomainId;
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      void setDomain(d.id);
                    }}
                    className={`flex-none px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {d.domainName}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Visual Stepper */}
          <section className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-200 flex overflow-x-auto gap-2 scrollbar-hide">
            {STEPS.map((step) => {
               const state = getStepState(step.id);
               const isActive = state === 'active';
               const isCompleted = state === 'completed';
               const isLocked = state === 'locked';
               const isClickable = !isLocked;
               return (
                 <div 
                   key={step.id} 
                   onClick={() => handleStepClick(step.id)}
                   className={`min-w-[160px] flex-none xl:flex-1 xl:w-auto flex items-start gap-2.5 p-2 rounded-lg transition-all ${
                     isActive 
                       ? 'bg-indigo-50/50 border border-indigo-100' 
                       : isCompleted
                       ? 'bg-emerald-50/50 border border-emerald-100'
                       : 'bg-transparent border border-transparent opacity-60'
                   } ${isClickable ? 'cursor-pointer hover:shadow-sm' : 'cursor-not-allowed'}`}
                 >
                   <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                     isActive 
                       ? 'bg-indigo-600 text-white shadow-sm' 
                       : isCompleted
                       ? 'bg-emerald-500 text-white shadow-sm'
                       : 'bg-slate-100 text-slate-400 border border-slate-200'
                   }`}>
                     {isCompleted ? <Check size={14} /> : step.id}
                   </div>
                   <div className="flex flex-col flex-1 overflow-hidden">
                     <span className={`text-[13px] font-semibold truncate ${
                       isActive ? 'text-slate-900' : isCompleted ? 'text-emerald-800' : 'text-slate-600'
                     }`}>
                       {step.name}
                     </span>
                     <span className={`text-[11px] font-medium truncate mt-0.5 ${
                       isLocked ? 'text-slate-400' : 'text-slate-400'
                     }`}>
                       {step.desc}
                     </span>
                   </div>
                 </div>
               )
            })}
          </section>
        </div>

        {/* Dynamic Step Component Content */}
        <section className="animate-fade-in-up mt-2">
          {children}
        </section>

      </main>

      <WarningModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />
    </div>
  );
};
