import { Step1_ClinicalContext } from "./components/Step1_ClinicalContext.tsx";
import { Step2_DataExploration } from "./features/dataExploration/Step2_DataExploration.tsx";
import { Step3_DataPreparation } from "./features/dataPreparation/Step3_DataPreparation.tsx";
import Step4ModelTraining from "./features/modelTuning/step4/Step4ModelTraining.tsx";
import Step5Results from "./features/evaluation/step5/Step5Results.tsx";
import { AppLayout } from "./components/AppLayout.tsx";
import { useDomainStore } from "./store/useDomainStore.ts";

function App() {
  const currentStep = useDomainStore((s) => s.currentStep);

  return (
    <AppLayout>
      {currentStep === 1 && <Step1_ClinicalContext />}
      {currentStep === 2 && <Step2_DataExploration />}
      {currentStep === 3 && <Step3_DataPreparation />}
      {currentStep === 4 && <Step4ModelTraining />}
      {currentStep === 5 && <Step5Results />}
    </AppLayout>
  );
}

export default App;
