import { apiFetch } from "@/lib/api";

export type AdminStats = {
  users: number;
  trips: number;
  shared_trips: number;
  comments: number;
};

export type AdminUserRow = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  created_at: string;
  trip_count: number;
};

export type AdminTripRow = {
  id: number;
  user_id: number;
  user_email: string;
  destination: string | null;
  status: string;
  is_shared: boolean;
  created_at: string;
};

export function fetchAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/admin/stats");
}

export function fetchAdminUsers(limit = 50, offset = 0): Promise<{ items: AdminUserRow[]; total: number }> {
  return apiFetch(`/admin/users?limit=${limit}&offset=${offset}`);
}

export function fetchAdminTrips(limit = 50, offset = 0): Promise<{ items: AdminTripRow[]; total: number }> {
  return apiFetch(`/admin/trips?limit=${limit}&offset=${offset}`);
}

export function patchAdminUser(userId: number, is_admin: boolean): Promise<AdminUserRow> {
  return apiFetch(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_admin }),
  });
}

export function deleteAdminTrip(tripPlanId: number): Promise<void> {
  return apiFetch(`/admin/trips/${tripPlanId}`, { method: "DELETE" });
}

export function unshareAdminTrip(tripPlanId: number): Promise<void> {
  return apiFetch(`/admin/trips/${tripPlanId}/share`, { method: "DELETE" });
}
