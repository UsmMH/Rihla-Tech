import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import PlanningBackHeader, { PLANNING_HEADER_HEIGHT_PX } from "@/components/layout/PlanningBackHeader";
import OriginCityInput, { type CityInputMeta } from "@/components/trip/OriginCityInput";
import TripDateRangePicker from "@/components/trip/TripDateRangePicker";
import TripTravelersInput from "@/components/trip/TripTravelersInput";
import { useTheme } from "@/contexts/ThemeContext";
import type { AnswerValue, QuizQuestion } from "@/lib/quiz";
import { validateCrossFields, isQuestionStepReady, validateQuestionStep } from "@/lib/quizValidation";

type QuestionFlowProps = {
  questions: QuizQuestion[];
  stepLabel: string;
  finalButtonLabel: string;
  onBack: () => void;
  onComplete: (answers: { question_id: number; value: AnswerValue }[]) => void;
  submitting?: boolean;
};

function stepValidationError(
  question: QuizQuestion,
  value: AnswerValue | undefined,
  cityMeta?: CityInputMeta,
): string | null {
  return validateQuestionStep(question, value, cityMeta);
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
  const [cityMetaByQuestion, setCityMetaByQuestion] = useState<Record<number, CityInputMeta>>({});
  const [direction, setDirection] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  const visibleQuestions = useMemo(() => {
    const destinationKnown = questions
      .filter((q) => q.key === "destination_known")
      .map((q) => answers[q.id])
      .find((v) => v !== undefined);

    const includeFlights = questions
      .filter((q) => q.key === "include_flights")
      .map((q) => answers[q.id])
      .find((v) => v !== undefined);

    return questions.filter((q) => {
      if (q.key === "destination" && destinationKnown === "not_sure") {
        return false;
      }
      if (q.key === "origin" && includeFlights !== "yes") {
        return false;
      }
      return true;
    });
  }, [questions, answers]);

  const step = visibleQuestions[currentStep];
  const selected = step ? answers[step.id] : undefined;
  const cityMeta = step ? cityMetaByQuestion[step.id] : undefined;

  const destinationAnswer = useMemo(() => {
    const destQ = questions.find((q) => q.key === "destination");
    if (!destQ) return undefined;
    const value = answers[destQ.id];
    return typeof value === "string" ? value : undefined;
  }, [questions, answers]);

  const crossFieldError =
    step?.key === "origin" ? validateCrossFields(questions, answers) : null;
  const progress = visibleQuestions.length ? ((currentStep + 1) / visibleQuestions.length) * 100 : 0;
  const currentError = step ? stepValidationError(step, selected, cityMeta) : null;
  const canProceed =
    step && !crossFieldError ? isQuestionStepReady(step, selected, cityMeta) : false;
  const isLastStep = currentStep === visibleQuestions.length - 1;

  const dateValue =
    step?.question_type === "date_range"
      ? (selected as { start: string; end: string } | undefined)
      : undefined;
  const showDateError = Boolean(dateValue?.start && dateValue?.end && currentError);

  useEffect(() => {
    setStepError(null);
  }, [currentStep, step?.id]);

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
    if (submitting || !step) return;

    const error = stepValidationError(step, selected, cityMeta);
    if (error) {
      setStepError(error);
      return;
    }

    const crossError =
      step.key === "origin" || isLastStep ? validateCrossFields(questions, answers) : null;
    if (crossError) {
      setStepError(crossError);
      return;
    }

    setStepError(null);

    if (currentStep < visibleQuestions.length - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    } else {
      const payload = visibleQuestions.map((q) => ({
        question_id: q.id,
        value: answers[q.id] ?? (q.key === "travel_extras" ? [] : answers[q.id]!),
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
    <div className="min-h-svh flex flex-col" style={{ background: theme.pageBg, transition: "background 0.3s" }}>
      <PlanningBackHeader onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4" style={{ paddingTop: PLANNING_HEADER_HEIGHT_PX + 16 }}>
        <div className="w-full max-w-xl mx-auto py-4 md:py-6">
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
                <div className={`grid gap-2.5 grid-cols-1 ${step.options.length > 4 ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
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
                          minWidth: "44px",
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
                  key={step.id}
                  value={(selected as string) ?? ""}
                  onChange={setAnswer}
                  showValidation={Boolean(stepError)}
                  searchKind={step.key === "origin" ? "airport" : "city"}
                  conflictWith={step.key === "origin" ? destinationAnswer : undefined}
                  onMetaChange={(meta) => {
                    setCityMetaByQuestion((prev) => ({ ...prev, [step.id]: meta }));
                  }}
                  placeholder={
                    step.key === "origin"
                      ? "Search departure airport..."
                      : "Search your destination..."
                  }
                />
              )}

              {step.question_type === "text" && step.key !== "origin" && step.key !== "destination" && (
                <input
                  type="text"
                  value={(selected as string) ?? ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full rounded-xl px-4 py-3.5 outline-none min-h-[48px] text-base"
                  style={{
                    background: theme.optionBg,
                    border: `1.5px solid ${theme.optionBorder}`,
                    color: theme.body,
                    fontFamily: "system-ui, sans-serif",
                  }}
                />
              )}

              {step.question_type === "date_range" && (
                <>
                  <TripDateRangePicker
                    value={dateValue ?? { start: "", end: "" }}
                    onChange={setAnswer}
                  />
                  {showDateError && (
                    <p className="mt-3 text-xs" style={{ color: "#ef4444", fontFamily: "system-ui, sans-serif" }}>
                      {currentError}
                    </p>
                  )}
                </>
              )}

              {step.question_type === "travelers" && (
                <>
                  <TripTravelersInput
                    value={(selected as { adults: number; children: number } | undefined) ?? { adults: 1, children: 0 }}
                    onChange={setAnswer}
                  />
                  {currentError && (
                    <p className="mt-3 text-xs" style={{ color: "#ef4444", fontFamily: "system-ui, sans-serif" }}>
                      {currentError}
                    </p>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {stepError && (
            <p
              className="mt-3 rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: theme.body,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {stepError}
            </p>
          )}

          {crossFieldError && !stepError && step.key === "origin" && (
            <p
              className="mt-3 rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: theme.body,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {crossFieldError}
            </p>
          )}

          <div className="flex items-center justify-center gap-2 mt-5 mb-2">
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

      <div
        className="flex-shrink-0 px-4 pt-3 border-t"
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))",
          background: theme.pageBg,
          borderColor: theme.border,
        }}
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-4 rounded-xl transition-all cursor-pointer flex-shrink-0 h-12 w-[88px]"
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

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || submitting}
            className="flex items-center justify-center gap-2 flex-1 rounded-xl font-medium transition-all h-12"
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
          </button>
        </div>
      </div>
    </div>
  );
}
