interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

const OnboardingProgress = ({ currentStep, totalSteps }: OnboardingProgressProps) => {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-[#7A746C] px-0.5">
        <span className="uppercase tracking-wider">Step {currentStep} of {totalSteps}</span>
        <span className="text-[#FF5436] font-extrabold">{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-[#EFE8DD] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FF5436] rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default OnboardingProgress;
