import { apiFetch } from "@/lib/api";
import type { TripDetail } from "@/lib/trips";

export interface CommunityAuthor {
  id: number;
  display_name: string;
}

export interface CommunityTripItem {
  id: number;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  theme: string | null;
  trip_purpose: string | null;
  num_days: number;
  activity_count: number;
  share_caption: string | null;
  shared_at: string;
  author: CommunityAuthor;
  vote_count: number;
  comment_count: number;
  save_count: number;
  viewer_voted: boolean;
  viewer_saved: boolean;
  is_owner: boolean;
}

export interface CommunityTripDetail {
  trip: TripDetail;
  share_caption: string | null;
  shared_at: string;
  author: CommunityAuthor;
  vote_count: number;
  comment_count: number;
  save_count: number;
  viewer_voted: boolean;
  viewer_saved: boolean;
  is_owner: boolean;
}

export interface CommunityComment {
  id: number;
  body: string;
  created_at: string;
  author: CommunityAuthor;
  is_mine: boolean;
}

export interface ShareTripResult {
  trip_plan_id: number;
  is_shared: boolean;
  share_caption: string | null;
  shared_at: string | null;
}

export async function getCommunityFeed(): Promise<CommunityTripItem[]> {
  const result = await apiFetch<{ trips: CommunityTripItem[] }>("/community/feed");
  return result.trips;
}

export async function getSavedTrips(): Promise<CommunityTripItem[]> {
  const result = await apiFetch<{ trips: CommunityTripItem[] }>("/community/saved");
  return result.trips;
}

export async function getCommunityTrip(tripPlanId: number): Promise<CommunityTripDetail> {
  return apiFetch<CommunityTripDetail>(`/community/trips/${tripPlanId}`);
}

export async function shareTrip(tripPlanId: number, caption?: string): Promise<ShareTripResult> {
  return apiFetch<ShareTripResult>(`/community/trips/${tripPlanId}/share`, {
    method: "POST",
    body: JSON.stringify({ caption: caption ?? null }),
  });
}

export async function unshareTrip(tripPlanId: number): Promise<ShareTripResult> {
  return apiFetch<ShareTripResult>(`/community/trips/${tripPlanId}/share`, {
    method: "DELETE",
  });
}

export async function toggleVote(tripPlanId: number): Promise<{ voted: boolean; vote_count: number }> {
  return apiFetch(`/community/trips/${tripPlanId}/vote`, { method: "POST" });
}

export async function toggleSave(tripPlanId: number): Promise<{ saved: boolean; save_count: number }> {
  return apiFetch(`/community/trips/${tripPlanId}/save`, { method: "POST" });
}

export async function getComments(tripPlanId: number): Promise<CommunityComment[]> {
  const result = await apiFetch<{ comments: CommunityComment[] }>(
    `/community/trips/${tripPlanId}/comments`,
  );
  return result.comments;
}

export async function addComment(tripPlanId: number, body: string): Promise<CommunityComment> {
  return apiFetch<CommunityComment>(`/community/trips/${tripPlanId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function deleteComment(commentId: number): Promise<void> {
  await apiFetch<void>(`/community/comments/${commentId}`, { method: "DELETE" });
}
