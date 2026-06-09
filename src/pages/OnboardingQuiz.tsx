import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import { useTheme } from "@/contexts/ThemeContext";
import { quizSteps } from "@/data/quizSteps";

// TODO: replace with API call — generateTrip(answers) on completion
type OnboardingQuizProps = {
  onComplete: () => void;
  onBack: () => void;
};

export default function OnboardingQuiz({ onComplete, onBack }: OnboardingQuizProps) {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [direction, setDirection] = useState(1);

  const step = quizSteps[currentStep];
  const selected = selections[currentStep] ?? [];
  const progress = ((currentStep + 1) / quizSteps.length) * 100;

  function toggle(optionId: string) {
    setSelections((prev) => {
      const cur = prev[currentStep] ?? [];
      if (step.multi) {
        return { ...prev, [currentStep]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId] };
      }
      return { ...prev, [currentStep]: [optionId] };
    });
  }

  function handleNext() {
    if (currentStep < quizSteps.length - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    } else {
      // TODO: replace with API call — generateTrip(selections)
      onComplete();
    }
  }

  function handleBack() {
    if (currentStep === 0) {
      onBack();
    } else {
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  }

  const canProceed = selected.length > 0;
  const isLastStep = currentStep === quizSteps.length - 1;

  return (
    <div style={{ background: theme.pageBg, minHeight: "100svh", transition: "background 0.3s" }}>
      <Navbar onHome={onBack} />

      <div className="flex flex-col items-center justify-start px-4" style={{ paddingTop: "72px", minHeight: "100svh", paddingBottom: "2rem" }}>
        <div className="w-full max-w-xl pt-6">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: theme.muted, fontSize: "0.78rem", fontFamily: "system-ui, sans-serif" }}>
              Step {currentStep + 1} of {quizSteps.length}
            </span>
            <span style={{ color: theme.accentSky, fontSize: "0.78rem", fontFamily: "system-ui, sans-serif" }}>
              {Math.round(progress)}% complete
            </span>
          </div>

          <div className="w-full h-1 rounded-full mb-5" style={{ background: theme.progressTrack }}>
            <motion.div
              className="h-1 rounded-full"
              style={{ background: `linear-gradient(90deg, ${theme.accentDeep}, ${theme.accentSky})` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="rounded-2xl p-5 md:p-8"
              style={{
                background: theme.cardBgGradient,
                border: `1px solid ${theme.cardBorder}`,
                backdropFilter: "blur(12px)",
                boxShadow: theme.cardShadow,
                transition: "background 0.3s, border-color 0.3s",
              }}
            >
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.3rem, 5vw, 1.9rem)", color: theme.heading, marginBottom: "0.35rem", lineHeight: 1.2 }}>
                {step.title}
              </h2>
              <p style={{ color: theme.muted, marginBottom: "1.25rem", fontSize: "0.88rem", fontFamily: "system-ui, sans-serif" }}>
                {step.subtitle}
              </p>

              <div className={`grid gap-2.5 ${step.options.length > 5 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
                {step.options.map((opt) => {
                  const isSelected = selected.includes(opt.id);
                  return (
                    <motion.button
                      key={opt.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => toggle(opt.id)}
                      className="flex items-center gap-3 rounded-xl text-left transition-all cursor-pointer w-full"
                      style={{
                        padding: "0.75rem 0.875rem",
                        background: isSelected ? theme.optionBgSelected : theme.optionBg,
                        border: `1.5px solid ${isSelected ? theme.optionBorderSelected : theme.optionBorder}`,
                        fontFamily: "system-ui, sans-serif",
                        minHeight: "52px",
                      }}
                    >
                      <span style={{ fontSize: "1.3rem", flexShrink: 0, lineHeight: 1 }}>{opt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontWeight: 500, fontSize: "0.9rem", color: isSelected ? theme.optionLabelSelected : theme.optionLabel, lineHeight: 1.2 }}>
                          {opt.label}
                        </div>
                        {opt.desc && (
                          <div style={{ fontSize: "0.72rem", color: isSelected ? theme.optionDescSelected : theme.optionDesc, marginTop: "0.1rem" }}>
                            {opt.desc}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: theme.accentSky }}>
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke={theme.isDark ? "#0A1628" : "#FFFFFF"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-4 gap-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-3 rounded-xl transition-all cursor-pointer flex-shrink-0"
              style={{
                background: theme.optionBg,
                border: `1px solid ${theme.border}`,
                color: theme.body,
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.9rem",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.accentMid)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.border)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>

            <motion.button
              whileHover={canProceed ? { scale: 1.02 } : {}}
              whileTap={canProceed ? { scale: 0.98 } : {}}
              onClick={canProceed ? handleNext : undefined}
              className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl font-medium transition-all"
              style={{
                background: canProceed ? `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})` : theme.progressTrack,
                border: canProceed ? `1px solid ${theme.border}` : `1px solid ${theme.borderFaint}`,
                color: canProceed ? "#FFFFFF" : theme.faint,
                cursor: canProceed ? "pointer" : "not-allowed",
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.95rem",
              }}
            >
              {isLastStep ? "Build My Trip" : "Next Step"}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-5">
            {quizSteps.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === currentStep ? "22px" : "7px",
                  height: "7px",
                  background: i === currentStep ? theme.accentSky : i < currentStep ? theme.accentDeep : theme.progressTrack,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
