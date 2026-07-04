import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, Calendar, ChevronRight, Heart, MapPin, MessageCircle, Users } from "lucide-react";
import AppBottomNav from "@/components/layout/AppBottomNav";
import Navbar from "@/components/layout/Navbar";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import {
  getCommunityFeed,
  getSavedTrips,
  toggleSave,
  toggleVote,
  type CommunityTripItem,
} from "@/lib/community";
import type { AppTab } from "@/lib/navigation";

type CommunityPageProps = {
  onNavigate: (tab: AppTab) => void;
  onOpenTrip: (tripPlanId: number) => void;
};

type FeedTab = "discover" | "saved";

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Flexible dates";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = new Date(start + "T00:00:00").toLocaleDateString(undefined, opts);
  if (!end || end === start) return startStr;
  const endStr = new Date(end + "T00:00:00").toLocaleDateString(undefined, opts);
  return `${startStr} – ${endStr}`;
}

function tripTags(trip: CommunityTripItem): string {
  const parts: string[] = [];
  if (trip.trip_purpose) parts.push(trip.trip_purpose);
  if (trip.theme) parts.push(trip.theme);
  return parts.join(" · ") || "Shared itinerary";
}

type TripCardProps = {
  trip: CommunityTripItem;
  onOpen: () => void;
  onVote: () => void;
  onSave: () => void;
  voting: boolean;
  saving: boolean;
};

function TripCard({ trip, onOpen, onVote, onSave, voting, saving }: TripCardProps) {
  const { theme } = useTheme();

  return (
    <motion.article
      layout
      className="rounded-2xl p-4 cursor-pointer"
      style={{
        background: theme.activityCardBg,
        border: `1px solid ${theme.activityCardBorder}`,
        boxShadow: theme.cardShadow,
      }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2
            className="truncate"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "1.25rem",
              color: theme.heading,
            }}
          >
            {trip.destination ?? "Untitled trip"}
          </h2>
          <p style={{ color: theme.muted, fontSize: "0.82rem", fontFamily: "system-ui, sans-serif" }}>
            by {trip.author.display_name}
            {trip.is_owner ? " · yours" : ""}
          </p>
        </div>
        <ChevronRight size={20} color={theme.faint} className="flex-shrink-0 mt-1" />
      </div>

      {trip.share_caption && (
        <p
          className="mb-3 line-clamp-2"
          style={{ color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.9rem", lineHeight: 1.5 }}
        >
          {trip.share_caption}
        </p>
      )}

      <div className="flex flex-wrap gap-3 mb-4" style={{ color: theme.muted, fontSize: "0.8rem", fontFamily: "system-ui, sans-serif" }}>
        <span className="inline-flex items-center gap-1">
          <Calendar size={14} />
          {formatDateRange(trip.start_date, trip.end_date)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin size={14} />
          {trip.num_days} day{trip.num_days !== 1 ? "s" : ""} · {trip.activity_count} stops
        </span>
      </div>

      <p className="mb-4" style={{ color: theme.accentLabel, fontSize: "0.82rem", fontFamily: "system-ui, sans-serif", fontStyle: "italic" }}>
        {tripTags(trip)}
      </p>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          disabled={voting}
          onClick={onVote}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl min-h-[40px] cursor-pointer disabled:opacity-60"
          style={{
            background: trip.viewer_voted ? "rgba(239, 68, 68, 0.12)" : theme.optionBg,
            border: `1px solid ${trip.viewer_voted ? "rgba(239, 68, 68, 0.35)" : theme.border}`,
            color: trip.viewer_voted ? "#ef4444" : theme.body,
            fontFamily: "system-ui, sans-serif",
            fontSize: "0.82rem",
          }}
        >
          <Heart size={16} fill={trip.viewer_voted ? "currentColor" : "none"} />
          {trip.vote_count}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl min-h-[40px] cursor-pointer disabled:opacity-60"
          style={{
            background: trip.viewer_saved ? "rgba(88, 171, 212, 0.12)" : theme.optionBg,
            border: `1px solid ${trip.viewer_saved ? theme.accentSky : theme.border}`,
            color: trip.viewer_saved ? theme.accentSky : theme.body,
            fontFamily: "system-ui, sans-serif",
            fontSize: "0.82rem",
          }}
        >
          <Bookmark size={16} fill={trip.viewer_saved ? "currentColor" : "none"} />
          {trip.save_count}
        </button>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-2"
          style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", fontSize: "0.82rem" }}
        >
          <MessageCircle size={16} />
          {trip.comment_count}
        </span>
      </div>
    </motion.article>
  );
}

export default function CommunityPage({ onNavigate, onOpenTrip }: CommunityPageProps) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<FeedTab>("discover");
  const [trips, setTrips] = useState<CommunityTripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTripId, setBusyTripId] = useState<{ id: number; action: "vote" | "save" } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const loader = tab === "discover" ? getCommunityFeed : getSavedTrips;
    loader()
      .then(setTrips)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load community trips");
        setTrips([]);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  function updateTrip(id: number, patch: Partial<CommunityTripItem>) {
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function handleVote(trip: CommunityTripItem) {
    if (busyTripId) return;
    setBusyTripId({ id: trip.id, action: "vote" });
    try {
      const result = await toggleVote(trip.id);
      updateTrip(trip.id, { viewer_voted: result.voted, vote_count: result.vote_count });
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Could not update vote");
    } finally {
      setBusyTripId(null);
    }
  }

  async function handleSave(trip: CommunityTripItem) {
    if (busyTripId) return;
    setBusyTripId({ id: trip.id, action: "save" });
    try {
      const result = await toggleSave(trip.id);
      updateTrip(trip.id, { viewer_saved: result.saved, save_count: result.save_count });
      if (tab === "saved" && !result.saved) {
        setTrips((prev) => prev.filter((t) => t.id !== trip.id));
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Could not update save");
    } finally {
      setBusyTripId(null);
    }
  }

  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", transition: "background 0.3s" }}>
      <Navbar variant="app" activePage="community" onNavigate={onNavigate} onHome={() => onNavigate("home")} />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-12" style={{ paddingTop: "80px" }}>
        <div className="mb-6">
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
              color: theme.heading,
              marginBottom: "0.25rem",
            }}
          >
            Community
          </h1>
          <p style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", fontSize: "0.9rem" }}>
            Discover itineraries shared by other travelers
          </p>
        </div>

        <div
          className="flex gap-1 p-1 rounded-xl mb-6"
          style={{ background: theme.optionBg, border: `1px solid ${theme.border}` }}
        >
          {(["discover", "saved"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="flex-1 py-2.5 rounded-lg cursor-pointer min-h-[44px] capitalize"
              style={{
                background: tab === id ? theme.activityCardBg : "transparent",
                color: tab === id ? theme.heading : theme.muted,
                border: tab === id ? `1px solid ${theme.activityCardBorder}` : "1px solid transparent",
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.88rem",
                fontWeight: tab === id ? 600 : 400,
              }}
            >
              {id === "discover" ? "Discover" : "Saved"}
            </button>
          ))}
        </div>

        {error && (
          <p
            className="mb-4 rounded-xl px-4 py-3"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: theme.body,
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.88rem",
            }}
          >
            {error}
          </p>
        )}

        {loading ? (
          <p style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "2rem 0" }}>
            Loading trips…
          </p>
        ) : trips.length === 0 ? (
          <div className="text-center py-12">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}` }}
            >
              <Users size={28} color={theme.accentSky} />
            </div>
            <p style={{ color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.95rem" }}>
              {tab === "saved"
                ? "No saved trips yet. Heart a trip on Discover to bookmark it here."
                : "No shared trips yet. Share one of your itineraries from the trip result page."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onOpen={() => onOpenTrip(trip.id)}
                onVote={() => handleVote(trip)}
                onSave={() => handleSave(trip)}
                voting={busyTripId?.id === trip.id && busyTripId.action === "vote"}
                saving={busyTripId?.id === trip.id && busyTripId.action === "save"}
              />
            ))}
          </div>
        )}
      </div>

      <AppBottomNav active="community" onNavigate={onNavigate} />
    </div>
  );
}
