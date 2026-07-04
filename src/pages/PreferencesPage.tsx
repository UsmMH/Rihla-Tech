import { useEffect, useState } from "react";

import QuestionFlow from "@/components/trip/QuestionFlow";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import type { AppTab } from "@/lib/navigation";
import type { AnswerValue, QuizQuestion } from "@/lib/quiz";
import { fetchQuestions, submitQuizAnswers } from "@/lib/quiz";

type PreferencesPageProps = {
  tripPlanId: number;
  onComplete: (tripPlanId: number, needsDestinationSuggestion: boolean) => void;
  onBack: () => void;
  onNavigate?: (tab: AppTab) => void;
};

export default function PreferencesPage({ tripPlanId, onComplete, onBack, onNavigate }: PreferencesPageProps) {
  const { theme } = useTheme();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestions("preferences")
      .then(setQuestions)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load preferences");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleComplete(answers: { question_id: number; value: AnswerValue }[]) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitQuizAnswers("preferences", answers, tripPlanId);
      onComplete(result.trip_plan.id, result.needs_destination_suggestion);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Failed to save preferences");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: theme.pageBg, color: theme.muted }}>
        Loading preferences...
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4" style={{ background: theme.pageBg }}>
        <p style={{ color: theme.body }}>{error}</p>
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg" style={{ background: theme.optionBg, border: `1px solid ${theme.border}`, color: theme.body }}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm" style={{ background: "#ef4444", color: "#fff" }}>
          {error}
        </div>
      )}
      <QuestionFlow
        questions={questions}
        stepLabel="Your preferences"
        finalButtonLabel="Find My Destination"
        onBack={onBack}
        onNavigate={onNavigate}
        onComplete={handleComplete}
        submitting={submitting}
      />
    </>
  );
}
