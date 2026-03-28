import { useMemo, useState } from "react";

import { STEP_KEYS } from "../store/pipelineStore";

export function usePipelineSteps() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = useMemo(() => STEP_KEYS[currentStepIndex], [currentStepIndex]);

  const nextStep = () => {
    setCurrentStepIndex((index) => Math.min(index + 1, STEP_KEYS.length - 1));
  };

  const prevStep = () => {
    setCurrentStepIndex((index) => Math.max(index - 1, 0));
  };

  const goToStep = (stepKey) => {
    const index = STEP_KEYS.indexOf(stepKey);
    if (index >= 0) {
      setCurrentStepIndex(index);
    }
  };

  return {
    currentStep,
    currentStepIndex,
    nextStep,
    prevStep,
    goToStep,
  };
}
