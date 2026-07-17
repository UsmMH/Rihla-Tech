import { apiFetch } from "@/lib/api";

export interface PlaceSearchResult {
  label: string;
  latitude: number;
  longitude: number;
  kind?: "city" | "airport";
  iata_code?: string | null;
  city?: string | null;
}

export interface ActivityPlaceSearchResult extends PlaceSearchResult {
  mapbox_id: string | null;
}

export type PlaceSearchKind = "city" | "airport";

export async function searchPlaces(
  query: string,
  kind: PlaceSearchKind = "city",
): Promise<PlaceSearchResult[]> {
  if (query.trim().length < 2) {
    return [];
  }
  const params = new URLSearchParams({
    q: query.trim(),
    kind,
  });
  return apiFetch<PlaceSearchResult[]>(`/places/search?${params.toString()}`);
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
