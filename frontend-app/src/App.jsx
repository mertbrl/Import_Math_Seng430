import { useEffect } from "react";
import { Step1_ClinicalContext } from "./components/Step1_ClinicalContext.tsx";
import { Step2_DataExploration } from "./features/dataExploration/Step2_DataExploration.tsx";
import { Step3_DataPreparation } from "./features/dataPreparation/Step3_DataPreparation.tsx";
import Step4ModelTraining from "./features/modelTuning/step4/Step4ModelTraining.tsx";
import Step5Results from "./features/evaluation/step5/Step5Results.tsx";
import Step6Explainability from "./features/explainability/step6/Step6Explainability.tsx";
import { Step7EthicsBias } from "./features/ethics/step7/Step7EthicsBias.tsx";
import { AppLayout } from "./components/AppLayout.tsx";
import { ExperienceModeScreen } from "./components/ExperienceModeScreen.tsx";
import { useDomainStore } from "./store/useDomainStore.ts";

function App() {
  const currentStep = useDomainStore((s) => s.currentStep);
  const hasChosenMode = useDomainStore((s) => s.hasChosenMode);
  const theme = useDomainStore((s) => s.theme);

  // Apply data-theme to <html> so dark CSS vars work everywhere including landing page
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  if (!hasChosenMode) {
    return <ExperienceModeScreen />;
  }

  return (
    <AppLayout>
      {currentStep === 1 && <Step1_ClinicalContext />}
      {currentStep === 2 && <Step2_DataExploration />}
      {currentStep === 3 && <Step3_DataPreparation />}
      {currentStep === 4 && <Step4ModelTraining />}
      {currentStep === 5 && <Step5Results />}
      {currentStep === 6 && <Step6Explainability />}
      {currentStep === 7 && <Step7EthicsBias />}
    </AppLayout>
  );
}

export default App;
