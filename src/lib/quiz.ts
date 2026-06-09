import { apiFetch } from "@/lib/api";

export interface QuizOption {
  id: number;
  option_key: string;
  label: string;
  icon: string | null;
  description: string | null;
}

export interface QuizQuestion {
  id: number;
  phase: string;
  key: string;
  title: string;
  subtitle: string;
  question_type: "choice" | "text" | "date_range" | "travelers";
  multi: boolean;
  sort_order: number;
  options: QuizOption[];
}

export type AnswerValue = string | string[] | { start: string; end: string } | { adults: number; children: number };

export interface TripPlan {
  id: number;
  destination: string | null;
  destination_known: boolean;
  start_date: string | null;
  end_date: string | null;
  num_adults: number;
  num_children: number;
  origin: string | null;
  trip_purpose: string | null;
  theme: string | null;
  budget_tier: string | null;
  include_flights: boolean;
  include_hotels: boolean;
  status: string;
}

export interface QuizSubmitResponse {
  trip_plan: TripPlan;
  needs_destination_suggestion: boolean;
}

function dedupeQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const byKey = new Map<string, QuizQuestion>();
  for (const q of questions) {
    if (!byKey.has(q.key)) {
      byKey.set(q.key, q);
    }
  }
  return [...byKey.values()].sort((a, b) => a.sort_order - b.sort_order);
}

export async function fetchQuestions(phase: "quiz" | "preferences"): Promise<QuizQuestion[]> {
  const questions = await apiFetch<QuizQuestion[]>(`/quiz/questions?phase=${phase}`);
  return dedupeQuestions(questions);
}

export async function submitQuizAnswers(
  phase: "quiz" | "preferences",
  answers: { question_id: number; value: AnswerValue }[],
  tripPlanId?: number,
): Promise<QuizSubmitResponse> {
  return apiFetch<QuizSubmitResponse>("/quiz/submit", {
    method: "POST",
    body: JSON.stringify({
      phase,
      answers,
      trip_plan_id: tripPlanId ?? null,
    }),
  });
}
