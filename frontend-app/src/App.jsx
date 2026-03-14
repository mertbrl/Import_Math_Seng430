import { Step1_ClinicalContext } from "./components/Step1_ClinicalContext.tsx";
import { Step2_DataExploration } from "./features/dataExploration/Step2_DataExploration.tsx";
import { AppLayout } from "./components/AppLayout.tsx";
import { useDomainStore } from "./store/useDomainStore.ts";

function App() {
  const currentStep = useDomainStore((s) => s.currentStep);

  return (
    <AppLayout>
      {currentStep === 1 && <Step1_ClinicalContext />}
      {currentStep === 2 && <Step2_DataExploration />}
    </AppLayout>
  );
}

export default App;
