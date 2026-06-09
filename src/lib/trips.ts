import { apiFetch } from "@/lib/api";
import type { TripPlan } from "@/lib/quiz";

export interface QuizAnswers {
  [stepIndex: number]: string[];
}

export interface GeneratedTrip {
  tripId: string;
  destination: string;
  duration: string;
  tags: string;
  stats: { label: string; value: string }[];
  itinerary: unknown[];
  alternatives: unknown[];
}

export interface ChatResponse {
  message: string;
  updatedItinerary?: unknown;
}

export interface DestinationSuggestion {
  city: string;
  country: string;
  blurb: string;
}

export interface SuggestDestinationsResult {
  suggestions: DestinationSuggestion[];
  source: string;
  fallback_reason: string | null;
}

export async function suggestDestinations(tripPlanId: number): Promise<SuggestDestinationsResult> {
  return apiFetch<SuggestDestinationsResult>("/trips/suggest-destinations", {
    method: "POST",
    body: JSON.stringify({ trip_plan_id: tripPlanId }),
  });
}

export async function selectDestination(tripPlanId: number, destination: string): Promise<TripPlan> {
  return apiFetch<TripPlan>(`/trips/${tripPlanId}/destination`, {
    method: "POST",
    body: JSON.stringify({ destination }),
  });
}

// Phase 3+ stubs

export async function generateTrip(_answers: QuizAnswers): Promise<GeneratedTrip> {
  throw new Error("generateTrip: not implemented");
}

export async function getItinerary(_tripId: string): Promise<GeneratedTrip> {
  throw new Error("getItinerary: not implemented");
}

export async function getAlternatives(_tripId: string): Promise<unknown[]> {
  throw new Error("getAlternatives: not implemented");
}

export async function sendChatMessage(
  _message: string,
  _tripId: string,
): Promise<ChatResponse> {
  throw new Error("sendChatMessage: not implemented");
}

export async function getChatHistory(_tripId: string): Promise<unknown[]> {
  throw new Error("getChatHistory: not implemented");
}

export async function getDestinations(): Promise<unknown[]> {
  throw new Error("getDestinations: not implemented");
}

export async function saveTrip(_tripId: string): Promise<void> {
  throw new Error("saveTrip: not implemented");
}

export async function shareTripLink(_tripId: string): Promise<{ url: string }> {
  throw new Error("shareTripLink: not implemented");
}

export async function downloadTripPDF(_tripId: string): Promise<Blob> {
  throw new Error("downloadTripPDF: not implemented");
}
