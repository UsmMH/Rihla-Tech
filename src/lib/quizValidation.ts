import { differenceInCalendarDays, format, parseISO } from "date-fns";

import type { AnswerValue, QuizQuestion } from "@/lib/quiz";

export const MAX_TRIP_NIGHTS = 14;
export const MAX_TRAVELERS_TOTAL = 20;
export const MIN_CITY_LENGTH = 2;
export const MAX_CITY_LENGTH = 120;

const CITY_PATTERN = /^[\p{L}\p{M}0-9\s,'.\-()]+$/u;

function normalizeCityToken(name: string): string {
  let token = name.trim().toLowerCase();
  if (token.startsWith("al-")) {
    token = token.slice(3);
  }
  return token;
}

export function cityComparableKey(label: string): string {
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length >= 3 && parts[0].includes("(")) {
    return normalizeCityToken(parts[1]);
  }
  return normalizeCityToken(parts[0]);
}

export function citiesConflict(origin: string, destination: string): boolean {
  const originClean = origin.trim();
  const destClean = destination.trim();
  if (!originClean || !destClean) return false;

  const originKey = cityComparableKey(originClean);
  const destKey = cityComparableKey(destClean);
  if (originKey && destKey) return originKey === destKey;

  return originClean.toLowerCase() === destClean.toLowerCase();
}

export function isValidCityFormat(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= MIN_CITY_LENGTH &&
    trimmed.length <= MAX_CITY_LENGTH &&
    CITY_PATTERN.test(trimmed)
  );
}

export function validateDateRange(value: { start: string; end: string }): string | null {
  if (!value.start || !value.end) {
    return "Select both departure and return dates.";
  }
  if (value.end < value.start) {
    return "Return date must be on or after departure.";
  }

  const today = format(new Date(), "yyyy-MM-dd");
  if (value.start < today) {
    return "Departure cannot be in the past.";
  }

  const nights = differenceInCalendarDays(parseISO(value.end), parseISO(value.start));
  if (nights > MAX_TRIP_NIGHTS) {
    return `Trips can be up to ${MAX_TRIP_NIGHTS} nights (${MAX_TRIP_NIGHTS + 1} days).`;
  }

  return null;
}

export function validateTravelers(value: { adults: number; children: number }): string | null {
  if (value.adults < 1) return "At least one adult is required.";
  if (value.children < 0) return "Children count cannot be negative.";
  if (value.adults > 20) return "Maximum 20 adults per trip.";
  if (value.children > 10) return "Maximum 10 children per trip.";
  if (value.adults + value.children > MAX_TRAVELERS_TOTAL) {
    return `Maximum ${MAX_TRAVELERS_TOTAL} travelers per trip.`;
  }
  return null;
}

export function validateChoice(question: QuizQuestion, value: AnswerValue | undefined): string | null {
  if (value === undefined) return "Please select an option.";

  const allowed = new Set(question.options.map((o) => o.option_key));

  if (question.multi) {
    if (!Array.isArray(value)) return "Invalid selection.";
    if (question.key !== "travel_extras" && value.length === 0) return "Select at least one option.";
    if (question.key === "theme" && value.length > 2) return "Pick up to 2 interests.";
    if (value.some((v) => !allowed.has(v))) return "Invalid selection.";
    return null;
  }

  if (typeof value !== "string" || !allowed.has(value)) return "Please select an option.";
  return null;
}

export function validateCityField(
  value: string | undefined,
  options: { confirmedFromList: boolean; searchSettled: boolean; hasSuggestions: boolean },
): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "Enter a city name.";

  if (!isValidCityFormat(trimmed)) {
    return "Use letters and basic punctuation only (2–120 characters).";
  }

  if (options.confirmedFromList) return null;

  if (!options.searchSettled) return null;

  if (options.hasSuggestions) {
    return "Pick a city from the suggestions for accurate results.";
  }

  if (trimmed.length < 3) {
    return "Enter at least 3 characters or pick from suggestions.";
  }

  return null;
}

export function validateQuestionStep(
  question: QuizQuestion,
  value: AnswerValue | undefined,
  cityMeta?: { confirmedFromList: boolean; searchSettled: boolean; hasSuggestions: boolean },
): string | null {
  if (value === undefined) return null;

  switch (question.question_type) {
    case "choice":
      return validateChoice(question, value);
    case "date_range": {
      const dates = value as { start: string; end: string };
      if (!dates.start || !dates.end) return null;
      return validateDateRange(dates);
    }
    case "travelers":
      return validateTravelers(value as { adults: number; children: number });
    case "text":
      if (question.key === "origin" || question.key === "destination") {
        return validateCityField(typeof value === "string" ? value : undefined, cityMeta ?? {
          confirmedFromList: false,
          searchSettled: false,
          hasSuggestions: false,
        });
      }
      if (typeof value !== "string" || value.trim().length < 2) {
        return "Enter at least 2 characters.";
      }
      return null;
    default:
      return null;
  }
}

export function isQuestionStepReady(
  question: QuizQuestion,
  value: AnswerValue | undefined,
  cityMeta?: { confirmedFromList: boolean; searchSettled: boolean; hasSuggestions: boolean },
): boolean {
  if (value === undefined) return false;

  switch (question.question_type) {
    case "choice":
      if (question.key === "travel_extras" && value === undefined) return true;
      return validateChoice(question, value) === null;
    case "date_range": {
      const dates = value as { start: string; end: string };
      if (!dates.start || !dates.end) return false;
      return validateDateRange(dates) === null;
    }
    case "travelers":
      return validateTravelers(value as { adults: number; children: number }) === null;
    case "text":
      if (question.key === "origin" || question.key === "destination") {
        if (typeof value !== "string" || !value.trim()) return false;
        return (
          validateCityField(value, cityMeta ?? {
            confirmedFromList: false,
            searchSettled: false,
            hasSuggestions: false,
          }) === null
        );
      }
      return typeof value === "string" && value.trim().length >= 2;
    default:
      return false;
  }
}

export function validateCrossFields(
  questions: QuizQuestion[],
  answers: Record<number, AnswerValue>,
): string | null {
  const byKey = new Map(questions.map((q) => [q.key, q]));
  const originQ = byKey.get("origin");
  const destQ = byKey.get("destination");
  const destKnownQ = byKey.get("destination_known");
  const includeFlightsQ = byKey.get("include_flights");

  const destKnown = destKnownQ ? answers[destKnownQ.id] : "yes";
  if (destKnown === "not_sure") return null;

  const wantsFlights = includeFlightsQ ? answers[includeFlightsQ.id] === "yes" : false;
  if (!wantsFlights) return null;

  if (!originQ || !destQ) return null;

  const origin = answers[originQ.id];
  const destination = answers[destQ.id];
  if (typeof origin !== "string" || typeof destination !== "string") return null;

  if (citiesConflict(origin, destination)) {
    return "Departure airport must serve a different city than your destination.";
  }

  return null;
}
