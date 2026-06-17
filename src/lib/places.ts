import { apiFetch } from "@/lib/api";

export interface PlaceSearchResult {
  label: string;
  latitude: number;
  longitude: number;
}

export interface ActivityPlaceSearchResult extends PlaceSearchResult {
  mapbox_id: string | null;
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  if (query.trim().length < 2) {
    return [];
  }
  return apiFetch<PlaceSearchResult[]>(`/places/search?q=${encodeURIComponent(query.trim())}`);
}

export async function searchActivityPlaces(
  query: string,
  tripPlanId: number,
): Promise<ActivityPlaceSearchResult[]> {
  if (query.trim().length < 2) {
    return [];
  }
  const params = new URLSearchParams({
    q: query.trim(),
    trip_plan_id: String(tripPlanId),
  });
  return apiFetch<ActivityPlaceSearchResult[]>(`/places/search-poi?${params.toString()}`);
}
