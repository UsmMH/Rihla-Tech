import { apiFetch } from "@/lib/api";
import type { TripPlan } from "@/lib/quiz";

export interface TripStat {
  label: string;
  value: string;
}

export interface TripActivity {
  place_id: number;
  name: string;
  time: string;
  time_slot: string;
  type: string;
  desc: string;
  duration: string;
  latitude: number | null;
  longitude: number | null;
}

export interface MapPin {
  place_id: number;
  name: string;
  day_number: number;
  time_slot: string;
  activity_type: string | null;
  latitude: number;
  longitude: number;
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
  map_pins: MapPin[];
  geocoding_configured: boolean;
  places_geocoded: number;
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

function normalizeTripDetail(raw: TripDetail): TripDetail {
  return {
    ...raw,
    map_pins: raw.map_pins ?? [],
    stats: raw.stats ?? [],
    geocoding_configured: raw.geocoding_configured ?? false,
    places_geocoded: raw.places_geocoded ?? 0,
    itinerary: (raw.itinerary ?? []).map((day) => ({
      ...day,
      activities: (day.activities ?? []).map((activity, index) => ({
        place_id: activity.place_id ?? index,
        name: activity.name ?? "Activity",
        time: activity.time ?? "",
        time_slot: activity.time_slot ?? "morning",
        type: activity.type ?? "Activity",
        desc: activity.desc ?? "",
        duration: activity.duration ?? "1 hr",
        latitude: activity.latitude ?? null,
        longitude: activity.longitude ?? null,
      })),
    })),
  };
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
  const result = await apiFetch<TripDetail>("/trips/generate", {
    method: "POST",
    body: JSON.stringify({ trip_plan_id: tripPlanId }),
  });
  return normalizeTripDetail(result);
}

export async function getTrip(tripPlanId: number): Promise<TripDetail> {
  const result = await apiFetch<TripDetail>(`/trips/${tripPlanId}`);
  return normalizeTripDetail(result);
}

export async function enrichTripPlaces(tripPlanId: number): Promise<TripDetail> {
  const result = await apiFetch<TripDetail>(`/trips/${tripPlanId}/enrich-places`, { method: "POST" });
  return normalizeTripDetail(result);
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
