import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Navbar from "@/components/layout/Navbar";
import OriginCityInput from "@/components/trip/OriginCityInput";
import TripDateRangePicker from "@/components/trip/TripDateRangePicker";
import TripTravelersInput from "@/components/trip/TripTravelersInput";
import { useTheme } from "@/contexts/ThemeContext";
import type { AnswerValue, QuizQuestion } from "@/lib/quiz";

type QuestionFlowProps = {
  questions: QuizQuestion[];
  stepLabel: string;
  finalButtonLabel: string;
  onBack: () => void;
  onComplete: (answers: { question_id: number; value: AnswerValue }[]) => void;
  submitting?: boolean;
};

function isStepComplete(question: QuizQuestion, value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;

  switch (question.question_type) {
    case "choice":
      if (question.multi) return Array.isArray(value) && value.length > 0;
      return typeof value === "string" && value.length > 0;
    case "text":
      return typeof value === "string" && value.trim().length > 0;
    case "date_range": {
      const dates = value as { start: string; end: string };
      return Boolean(dates.start && dates.end && dates.end >= dates.start);
    }
    case "travelers": {
      const t = value as { adults: number; children: number };
      return t.adults >= 1 && t.children >= 0;
    }
    default:
      return false;
  }
}

export default function QuestionFlow({
  questions,
  stepLabel,
  finalButtonLabel,
  onBack,
  onComplete,
  submitting = false,
}: QuestionFlowProps) {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [direction, setDirection] = useState(1);

  const visibleQuestions = useMemo(() => {
    const destinationKnown = questions
      .filter((q) => q.key === "destination_known")
      .map((q) => answers[q.id])
      .find((v) => v !== undefined);

    return questions.filter((q) => {
      if (q.key === "destination" && destinationKnown === "not_sure") {
        return false;
      }
      return true;
    });
  }, [questions, answers]);

  const step = visibleQuestions[currentStep];
  const selected = step ? answers[step.id] : undefined;
  const progress = visibleQuestions.length ? ((currentStep + 1) / visibleQuestions.length) * 100 : 0;
  const canProceed = step ? isStepComplete(step, selected) : false;
  const isLastStep = currentStep === visibleQuestions.length - 1;

  useEffect(() => {
    if (!step || step.question_type !== "travelers") return;
    setAnswers((prev) => {
      if (prev[step.id] !== undefined) return prev;
      return { ...prev, [step.id]: { adults: 1, children: 0 } };
    });
  }, [step?.id, step?.question_type]);

  function setAnswer(value: AnswerValue) {
    if (!step) return;
    setAnswers((prev) => ({ ...prev, [step.id]: value }));
  }

  function toggleChoice(optionKey: string) {
    if (!step) return;
    if (step.multi) {
      const cur = (selected as string[] | undefined) ?? [];
      setAnswer(cur.includes(optionKey) ? cur.filter((x) => x !== optionKey) : [...cur, optionKey]);
    } else {
      setAnswer(optionKey);
    }
  }

  function handleNext() {
    if (!canProceed || submitting) return;
    if (currentStep < visibleQuestions.length - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    } else {
      const payload = visibleQuestions.map((q) => ({
        question_id: q.id,
        value: answers[q.id]!,
      }));
      onComplete(payload);
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

  if (!step) return null;

  const choiceSelected = step.question_type === "choice"
    ? step.multi
      ? ((selected as string[] | undefined) ?? [])
      : selected
        ? [selected as string]
        : []
    : [];

  return (
    <div style={{ background: theme.pageBg, minHeight: "100svh", transition: "background 0.3s" }}>
      <Navbar onHome={onBack} />

      <div className="flex flex-col items-center justify-start px-4" style={{ paddingTop: "72px", minHeight: "100svh", paddingBottom: "2rem" }}>
        <div className="w-full max-w-xl pt-6">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: theme.muted, fontSize: "0.78rem", fontFamily: "system-ui, sans-serif" }}>
              {stepLabel} · Step {currentStep + 1} of {visibleQuestions.length}
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
              key={step.id}
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
              }}
            >
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.3rem, 5vw, 1.9rem)", color: theme.heading, marginBottom: "0.35rem", lineHeight: 1.2 }}>
                {step.title}
              </h2>
              <p style={{ color: theme.muted, marginBottom: "1.25rem", fontSize: "0.88rem", fontFamily: "system-ui, sans-serif" }}>
                {step.subtitle}
              </p>

              {step.question_type === "choice" && (
                <div className={`grid gap-2.5 ${step.options.length > 5 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
                  {step.options.map((opt) => {
                    const isSelected = choiceSelected.includes(opt.option_key);
                    return (
                      <motion.button
                        key={opt.id}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => toggleChoice(opt.option_key)}
                        className="flex items-center gap-3 rounded-xl text-left transition-all cursor-pointer w-full"
                        style={{
                          padding: "0.75rem 0.875rem",
                          background: isSelected ? theme.optionBgSelected : theme.optionBg,
                          border: `1.5px solid ${isSelected ? theme.optionBorderSelected : theme.optionBorder}`,
                          fontFamily: "system-ui, sans-serif",
                          minHeight: "52px",
                        }}
                      >
                        {opt.icon && <span style={{ fontSize: "1.3rem", flexShrink: 0, lineHeight: 1 }}>{opt.icon}</span>}
                        <div className="flex-1 min-w-0">
                          <div style={{ fontWeight: 500, fontSize: "0.9rem", color: isSelected ? theme.optionLabelSelected : theme.optionLabel, lineHeight: 1.2 }}>
                            {opt.label}
                          </div>
                          {opt.description && (
                            <div style={{ fontSize: "0.72rem", color: isSelected ? theme.optionDescSelected : theme.optionDesc, marginTop: "0.1rem" }}>
                              {opt.description}
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
              )}

              {step.question_type === "text" && (step.key === "origin" || step.key === "destination") && (
                <OriginCityInput
                  value={(selected as string) ?? ""}
                  onChange={setAnswer}
                  placeholder={
                    step.key === "origin"
                      ? "Search your departure city..."
                      : "Search your destination..."
                  }
                  suggestionsTitle={
                    step.key === "origin" ? "SUGGESTED CITIES" : "SUGGESTED DESTINATIONS"
                  }
                />
              )}

              {step.question_type === "text" && step.key !== "origin" && step.key !== "destination" && (
                <input
                  type="text"
                  value={(selected as string) ?? ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full rounded-xl px-4 py-3 outline-none"
                  style={{
                    background: theme.optionBg,
                    border: `1.5px solid ${theme.optionBorder}`,
                    color: theme.body,
                    fontFamily: "system-ui, sans-serif",
                  }}
                />
              )}

              {step.question_type === "date_range" && (
                <TripDateRangePicker
                  value={(selected as { start: string; end: string } | undefined) ?? { start: "", end: "" }}
                  onChange={setAnswer}
                />
              )}

              {step.question_type === "travelers" && (
                <TripTravelersInput
                  value={(selected as { adults: number; children: number } | undefined) ?? { adults: 1, children: 0 }}
                  onChange={setAnswer}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-6 gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-3 rounded-xl transition-all cursor-pointer flex-shrink-0"
              style={{
                background: theme.optionBg,
                border: `1px solid ${theme.border}`,
                color: theme.body,
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.9rem",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>

            <motion.button
              type="button"
              whileHover={canProceed && !submitting ? { scale: 1.02 } : {}}
              whileTap={canProceed && !submitting ? { scale: 0.98 } : {}}
              onClick={handleNext}
              disabled={!canProceed || submitting}
              className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl font-medium transition-all"
              style={{
                background: canProceed && !submitting ? `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})` : theme.progressTrack,
                border: `1px solid ${canProceed && !submitting ? theme.border : theme.borderFaint}`,
                color: canProceed && !submitting ? "#FFFFFF" : theme.faint,
                cursor: canProceed && !submitting ? "pointer" : "not-allowed",
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.95rem",
              }}
            >
              {submitting ? "Saving..." : isLastStep ? finalButtonLabel : "Next Step"}
              {!submitting && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </motion.button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-5">
            {visibleQuestions.map((q, i) => (
              <div
                key={q.id}
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
