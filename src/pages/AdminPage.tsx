import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Trash2 } from "lucide-react";
import AppBottomNav from "@/components/layout/AppBottomNav";
import Navbar from "@/components/layout/Navbar";
import { useTheme } from "@/contexts/ThemeContext";
import {
  deleteAdminTrip,
  fetchAdminStats,
  fetchAdminTrips,
  fetchAdminUsers,
  patchAdminUser,
  unshareAdminTrip,
  type AdminStats,
  type AdminTripRow,
  type AdminUserRow,
} from "@/lib/admin";
import { ApiError } from "@/lib/api";
import type { AppTab } from "@/lib/navigation";

type AdminPageProps = {
  onNavigate: (tab: AppTab) => void;
  onBack: () => void;
};

type Tab = "overview" | "users" | "trips";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminPage({ onNavigate, onBack }: AdminPageProps) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [trips, setTrips] = useState<AdminTripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes, tripsRes] = await Promise.all([
        fetchAdminStats(),
        fetchAdminUsers(),
        fetchAdminTrips(),
      ]);
      setStats(statsRes);
      setUsers(usersRes.items);
      setTrips(tripsRes.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAdmin(user: AdminUserRow) {
    setBusyId(`user-${user.id}`);
    try {
      const updated = await patchAdminUser(user.id, !user.is_admin);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteTrip(trip: AdminTripRow) {
    if (!window.confirm(`Delete trip #${trip.id} (${trip.destination ?? "no destination"})?`)) return;
    setBusyId(`trip-${trip.id}`);
    try {
      await deleteAdminTrip(trip.id);
      setTrips((prev) => prev.filter((t) => t.id !== trip.id));
      if (stats) setStats({ ...stats, trips: stats.trips - 1 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnshare(trip: AdminTripRow) {
    setBusyId(`unshare-${trip.id}`);
    try {
      await unshareAdminTrip(trip.id);
      setTrips((prev) =>
        prev.map((t) => (t.id === trip.id ? { ...t, is_shared: false } : t)),
      );
      if (stats) setStats({ ...stats, shared_trips: Math.max(0, stats.shared_trips - 1) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unshare failed");
    } finally {
      setBusyId(null);
    }
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
      style={{
        background: tab === id ? theme.badgeBg : "transparent",
        color: tab === id ? theme.accentSky : theme.muted,
        border: "none",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", transition: "background 0.3s" }}>
      <Navbar variant="app" activePage="profile" onNavigate={onNavigate} onHome={onBack} />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-12" style={{ paddingTop: "80px" }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 mb-4 cursor-pointer"
            style={{ background: "none", border: "none", color: theme.muted, fontSize: "0.875rem" }}
          >
            <ArrowLeft size={16} />
            Back to profile
          </button>

          <div className="flex items-center gap-2 mb-6">
            <Shield size={22} color={theme.accentSky} />
            <h1
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
                color: theme.heading,
              }}
            >
              Admin
            </h1>
          </div>

          <div className="flex gap-1 mb-6 flex-wrap">
            {tabBtn("overview", "Overview")}
            {tabBtn("users", "Users")}
            {tabBtn("trips", "Trips")}
          </div>

          {error && (
            <p
              className="mb-4 rounded-xl px-4 py-3 text-sm"
              style={{ background: "#fdecea", color: "#c62828", fontFamily: "system-ui, sans-serif" }}
            >
              {error}
            </p>
          )}

          {loading ? (
            <p style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>Loading...</p>
          ) : tab === "overview" && stats ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Users", value: stats.users },
                { label: "Trips", value: stats.trips },
                { label: "Shared", value: stats.shared_trips },
                { label: "Comments", value: stats.comments },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl p-4"
                  style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}` }}
                >
                  <p style={{ color: theme.muted, fontSize: "0.8rem", fontFamily: "system-ui, sans-serif" }}>
                    {card.label}
                  </p>
                  <p
                    style={{
                      color: theme.heading,
                      fontSize: "1.75rem",
                      fontFamily: "'DM Serif Display', serif",
                      marginTop: "0.25rem",
                    }}
                  >
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          ) : tab === "users" ? (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}` }}
                >
                  <div className="min-w-0">
                    <p style={{ color: theme.heading, fontSize: "0.9rem", fontFamily: "system-ui, sans-serif" }}>
                      {user.first_name} {user.last_name}
                      {user.is_admin && (
                        <span style={{ color: theme.accentSky, marginLeft: "0.5rem", fontSize: "0.75rem" }}>
                          admin
                        </span>
                      )}
                    </p>
                    <p className="truncate" style={{ color: theme.muted, fontSize: "0.8rem" }}>
                      {user.email} · {user.trip_count} trips · {formatDate(user.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === `user-${user.id}`}
                    onClick={() => toggleAdmin(user)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                    style={{
                      background: theme.toggleBg,
                      border: "none",
                      color: theme.body,
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    {user.is_admin ? "Revoke admin" : "Make admin"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {trips.map((trip) => (
                <div
                  key={trip.id}
                  className="rounded-xl px-4 py-3"
                  style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p style={{ color: theme.heading, fontSize: "0.9rem", fontFamily: "system-ui, sans-serif" }}>
                        #{trip.id} {trip.destination ?? "No destination"}
                      </p>
                      <p style={{ color: theme.muted, fontSize: "0.8rem" }}>
                        {trip.user_email} · {trip.status}
                        {trip.is_shared ? " · shared" : ""} · {formatDate(trip.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {trip.is_shared && (
                        <button
                          type="button"
                          disabled={busyId === `unshare-${trip.id}`}
                          onClick={() => handleUnshare(trip)}
                          className="px-2 py-1 rounded-lg text-xs cursor-pointer"
                          style={{ background: theme.toggleBg, border: "none", color: theme.body }}
                        >
                          Unshare
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === `trip-${trip.id}`}
                        onClick={() => handleDeleteTrip(trip)}
                        className="p-1.5 rounded-lg cursor-pointer"
                        style={{ background: "#fdecea", border: "none" }}
                        aria-label="Delete trip"
                      >
                        <Trash2 size={16} color="#c62828" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AppBottomNav active="profile" onNavigate={onNavigate} />
    </div>
  );
}
