import { apiFetch } from "@/lib/api";
import type { TripPlan } from "@/lib/quiz";

export interface QuizAnswers {
  [stepIndex: number]: string[];
}

export interface TripStat {
  label: string;
  value: string;
}

export interface TripActivity {
  name: string;
  time: string;
  time_slot: string;
  type: string;
  desc: string;
  duration: string;
}

export interface DayItinerary {
  day: number;
  theme: string;
  date: string | null;
  activities: TripActivity[];
}

export interface TripDetail {
  trip_plan: TripPlan;
  destination: string;
  duration: string;
  tags: string;
  stats: TripStat[];
  itinerary: DayItinerary[];
  source: string;
  fallback_reason: string | null;
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

export async function generateTrip(tripPlanId: number): Promise<TripDetail> {
  return apiFetch<TripDetail>("/trips/generate", {
    method: "POST",
    body: JSON.stringify({ trip_plan_id: tripPlanId }),
  });
}

export async function getTrip(tripPlanId: number): Promise<TripDetail> {
  return apiFetch<TripDetail>(`/trips/${tripPlanId}`);
}

// Phase 5+ stubs

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
