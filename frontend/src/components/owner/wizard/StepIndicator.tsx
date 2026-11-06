import React from 'react'

export interface StepIndicatorProps {
  currentStep: number
  steps: { number: number; title: string; subtitle: string }[]
  onStepClick?: (stepNumber: number) => void
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  steps,
  onStepClick,
}) => {
  return (
    <nav aria-label="Wizard Steps Progress" className="w-full">
      <ol className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {steps.map((step) => {
          const isCurrent = step.number === currentStep
          const isCompleted = step.number < currentStep
          const isClickable = isCompleted && onStepClick

          return (
            <li
              key={step.number}
              onClick={() => isClickable && onStepClick(step.number)}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-150 ${
                isCurrent
                  ? 'border-[#408A71] bg-[#408A71]/5 shadow-2xs'
                  : isCompleted
                  ? 'border-emerald-200 bg-white hover:border-[#408A71]/40 cursor-pointer'
                  : 'border-[#E5E7EB] bg-white opacity-60 cursor-not-allowed'
              }`}
            >
              {/* Step Number Circle */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                  isCurrent
                    ? 'bg-[#408A71] text-white shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-100 text-[#15803D]'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="3"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>

              {/* Step Labels */}
              <div className="flex flex-col min-w-0">
                <span
                  className={`text-xs font-bold truncate ${
                    isCurrent ? 'text-[#408A71]' : isCompleted ? 'text-[#111827]' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </span>
                <span className="text-[11px] text-[#6B7280] truncate">
                  {step.subtitle}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default StepIndicator

