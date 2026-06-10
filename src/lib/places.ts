import { apiFetch } from "@/lib/api";

export interface PlaceSearchResult {
  label: string;
  latitude: number;
  longitude: number;
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  if (query.trim().length < 2) {
    return [];
  }
  return apiFetch<PlaceSearchResult[]>(`/places/search?q=${encodeURIComponent(query.trim())}`);
}
