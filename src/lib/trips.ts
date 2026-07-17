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
  location_confirmed: boolean;
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
  is_shared?: boolean;
  share_caption?: string | null;
}

export interface TripListItem {
  id: number;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  itinerary_source: string | null;
  has_itinerary: boolean;
  created_at: string;
  updated_at: string;
}

export interface TripAlternative {
  title: string;
  tagline: string;
  highlights: string[];
  budget_note: string;
  match_percent: number;
}

export interface EditTripResult {
  alternatives: TripAlternative[];
  source: string;
  fallback_reason: string | null;
}

export interface StoredChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  proposes_edit: boolean;
  apply_instruction: string | null;
  created_at: string;
}

export interface ChatResponse {
  message: string;
  source: string;
  fallback_reason: string | null;
  proposes_edit: boolean;
  apply_instruction: string | null;
  assistant_message_id: number | null;
  itinerary_updated: boolean;
  trip: TripDetail | null;
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

export interface FlightSegment {
  origin: string;
  origin_code: string;
  destination: string;
  destination_code: string;
  departure_at: string | null;
  arrival_at: string | null;
  duration: string | null;
  airline: string;
  stops: number;
}

export interface FlightOffer {
  id: string;
  airline: string;
  price: string;
  price_note?: string | null;
  price_amount: number | null;
  currency: string;
  outbound: FlightSegment;
  inbound: FlightSegment | null;
  booking_url: string | null;
}

export interface FlightsResult {
  offers: FlightOffer[];
  search_url: string;
  source: string;
  fallback_reason: string | null;
  origin_code: string | null;
  destination_code: string | null;
}

export interface HotelOption {
  id: string;
  name: string;
  area: string;
  stars: number;
  price_per_night: string;
  price_note?: string | null;
  price_tier: string;
  amenities: string[];
  booking_url: string;
}

export interface HotelsResult {
  hotels: HotelOption[];
  search_url: string;
  source: string;
  check_in: string | null;
  check_out: string | null;
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
        location_confirmed: activity.location_confirmed ?? false,
      })),
    })),
  };
}

export function tripHasItineraryActivities(trip: TripDetail): boolean {
  return trip.itinerary.some((day) => day.activities.length > 0);
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

export async function getTripFlights(tripPlanId: number): Promise<FlightsResult> {
  return apiFetch<FlightsResult>(`/trips/${tripPlanId}/flights`);
}

export async function getTripHotels(tripPlanId: number): Promise<HotelsResult> {
  return apiFetch<HotelsResult>(`/trips/${tripPlanId}/hotels`);
}

export async function enrichTripPlaces(tripPlanId: number): Promise<TripDetail> {
  const result = await apiFetch<TripDetail>(`/trips/${tripPlanId}/enrich-places`, { method: "POST" });
  return normalizeTripDetail(result);
}

const LAST_TRIP_KEY = "rihlatech_last_trip_id";
const LAST_PAGE_KEY = "rihlatech_last_page";

export function saveLastTripId(tripPlanId: number): void {
  localStorage.setItem(LAST_TRIP_KEY, String(tripPlanId));
}

export function loadLastTripId(): number | null {
  const raw = localStorage.getItem(LAST_TRIP_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export function saveLastPage(page: string): void {
  localStorage.setItem(LAST_PAGE_KEY, page);
}

export function loadLastPage(): string | null {
  return localStorage.getItem(LAST_PAGE_KEY);
}

export function clearLastPage(): void {
  localStorage.removeItem(LAST_PAGE_KEY);
}

export function clearLastTripId(): void {
  localStorage.removeItem(LAST_TRIP_KEY);
  localStorage.removeItem(LAST_PAGE_KEY);
}

export async function listTrips(): Promise<TripListItem[]> {
  const result = await apiFetch<{ trips: TripListItem[] }>("/trips");
  return result.trips;
}

export async function editTrip(
  tripPlanId: number,
  prompt = "Suggest 3 alternative destinations similar to this trip.",
): Promise<EditTripResult> {
  return apiFetch<EditTripResult>(`/trips/${tripPlanId}/edit`, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export async function getChatMessages(tripPlanId: number): Promise<StoredChatMessage[]> {
  const result = await apiFetch<{ messages: StoredChatMessage[] }>(`/chat/${tripPlanId}/messages`);
  return result.messages;
}

export async function sendChatMessage(
  message: string,
  tripPlanId: number,
): Promise<ChatResponse> {
  const result = await apiFetch<ChatResponse>("/chat/message", {
    method: "POST",
    body: JSON.stringify({ trip_plan_id: tripPlanId, message }),
  });
  if (result.trip) {
    result.trip = normalizeTripDetail(result.trip);
  }
  return result;
}

export async function applyTripEdit(
  tripPlanId: number,
  instruction: string,
  chatMessageId?: number,
): Promise<TripDetail> {
  const result = await apiFetch<TripDetail>(`/trips/${tripPlanId}/apply-edit`, {
    method: "POST",
    body: JSON.stringify({
      instruction,
      chat_message_id: chatMessageId ?? null,
    }),
  });
  return normalizeTripDetail(result);
}

export async function sendConsultMessage(
  message: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<{ message: string; source: string; fallback_reason: string | null }> {
  return apiFetch("/chat/consult", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

export async function deleteTrip(tripPlanId: number): Promise<void> {
  await apiFetch<void>(`/trips/${tripPlanId}`, { method: "DELETE" });
}

export async function updatePlaceLocation(
  tripPlanId: number,
  placeId: number,
  payload: { label: string; latitude: number; longitude: number; mapbox_id?: string | null },
): Promise<TripDetail> {
  const result = await apiFetch<TripDetail>(`/trips/${tripPlanId}/places/${placeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeTripDetail(result);
}
