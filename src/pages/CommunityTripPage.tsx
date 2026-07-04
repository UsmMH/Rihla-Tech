import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, ChevronDown, ChevronLeft, ExternalLink, Heart, MapPin, Send, Trash2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import {
  addComment,
  deleteComment,
  getComments,
  getCommunityTrip,
  toggleSave,
  toggleVote,
  type CommunityComment,
  type CommunityTripDetail,
} from "@/lib/community";
import { getActivityTypeStyle } from "@/lib/activityType";
import {
  dayRouteExceedsWaypointLimit,
  googleMapsDayRouteUrl,
  googleMapsLegUrl,
  googleMapsSearchUrl,
} from "@/lib/mapDirections";
import type { AppTab } from "@/lib/navigation";
import type { DayItinerary, TripActivity } from "@/lib/trips";

type CommunityTripPageProps = {
  tripPlanId: number;
  onBack: () => void;
  onNavigate?: (tab: AppTab) => void;
};

function daySummary(dayPlan: DayItinerary): string {
  const count = dayPlan.activities.length;
  return `${dayPlan.theme} · ${count === 1 ? "1 activity" : `${count} activities`}`;
}

type DayPanelProps = {
  dayPlan: DayItinerary;
  destination: string;
  defaultOpen?: boolean;
};

function DayPanel({ dayPlan, destination, defaultOpen = false }: DayPanelProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const dayActivityNames = dayPlan.activities.map((a) => a.name);
  const dayGoogleRoute = googleMapsDayRouteUrl(dayActivityNames, destination);
  const routeTruncated = dayRouteExceedsWaypointLimit(dayActivityNames.length);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}` }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 cursor-pointer text-left"
        style={{ background: "transparent", border: "none" }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
          style={{ background: theme.dayHeaderBg, color: "#fff", fontFamily: "'DM Serif Display', serif" }}
        >
          {dayPlan.day}
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ color: theme.heading, fontFamily: "'DM Serif Display', serif", fontSize: "1rem" }}>
            Day {dayPlan.day}
          </p>
          <p className="truncate" style={{ color: theme.muted, fontSize: "0.8rem", fontFamily: "system-ui, sans-serif" }}>
            {daySummary(dayPlan)}
          </p>
        </div>
        <ChevronDown
          size={20}
          color={theme.faint}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {dayGoogleRoute && (
                <a
                  href={dayGoogleRoute}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs"
                  style={{ color: theme.accentSky, fontFamily: "system-ui, sans-serif", textDecoration: "none" }}
                >
                  <MapPin size={12} />
                  {routeTruncated ? "Day route (first 11 stops)" : "Day route in Google Maps"}
                  <ExternalLink size={10} />
                </a>
              )}
              {dayPlan.activities.map((activity, aIdx) => (
                <ActivityRow
                  key={`${dayPlan.day}-${activity.place_id}`}
                  activity={activity}
                  destination={destination}
                  previous={aIdx > 0 ? dayPlan.activities[aIdx - 1] : null}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActivityRow({
  activity,
  destination,
  previous,
}: {
  activity: TripActivity;
  destination: string;
  previous: TripActivity | null;
}) {
  const { theme } = useTheme();
  const typeStyle = getActivityTypeStyle(activity.type, theme);
  const mapsUrl =
    activity.latitude != null && activity.longitude != null
      ? previous
        ? googleMapsLegUrl(previous.name, activity.name, destination)
        : googleMapsSearchUrl(activity.name, destination)
      : googleMapsSearchUrl(activity.name, destination);

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: theme.optionBg, border: `1px solid ${theme.border}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span style={{ color: theme.faint, fontSize: "0.75rem", fontFamily: "system-ui, sans-serif" }}>
          {activity.time}
        </span>
        <span
          className="px-2 py-0.5 rounded-full text-xs"
          style={{ background: typeStyle.bg, color: typeStyle.text, fontFamily: "system-ui, sans-serif" }}
        >
          {activity.type}
        </span>
      </div>
      <h3 style={{ color: theme.activityHeading, fontFamily: "'DM Serif Display', serif", fontSize: "0.95rem" }}>
        {activity.name}
      </h3>
      {activity.desc && (
        <p className="mt-1 line-clamp-2" style={{ color: theme.body, fontSize: "0.82rem", fontFamily: "system-ui, sans-serif" }}>
          {activity.desc}
        </p>
      )}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs"
          style={{ color: theme.accentSky, fontFamily: "system-ui, sans-serif", textDecoration: "none" }}
        >
          Open in Maps
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

export default function CommunityTripPage({ tripPlanId, onBack, onNavigate }: CommunityTripPageProps) {
  const { theme } = useTheme();
  const [data, setData] = useState<CommunityTripDetail | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [actionBusy, setActionBusy] = useState<"vote" | "save" | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getCommunityTrip(tripPlanId), getComments(tripPlanId)])
      .then(([trip, commentList]) => {
        setData(trip);
        setComments(commentList);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load trip");
      })
      .finally(() => setLoading(false));
  }, [tripPlanId]);

  async function handleVote() {
    if (!data || actionBusy) return;
    setActionBusy("vote");
    try {
      const result = await toggleVote(tripPlanId);
      setData({ ...data, viewer_voted: result.voted, vote_count: result.vote_count });
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Could not update vote");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSave() {
    if (!data || actionBusy) return;
    setActionBusy("save");
    try {
      const result = await toggleSave(tripPlanId);
      setData({ ...data, viewer_saved: result.saved, save_count: result.save_count });
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Could not update save");
    } finally {
      setActionBusy(null);
    }
  }

  async function handlePostComment() {
    const body = commentText.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const comment = await addComment(tripPlanId, body);
      setComments((prev) => [...prev, comment]);
      setCommentText("");
      if (data) setData({ ...data, comment_count: data.comment_count + 1 });
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Could not post comment");
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteComment(commentId: number) {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (data) setData({ ...data, comment_count: Math.max(0, data.comment_count - 1) });
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Could not delete comment");
    }
  }

  if (loading) {
    return (
      <div style={{ background: theme.pageBg, minHeight: "100vh" }}>
        <Navbar variant="app" onHome={onBack} onNavigate={onNavigate} />
        <p className="text-center py-24" style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>
          Loading itinerary…
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ background: theme.pageBg, minHeight: "100vh" }}>
        <Navbar variant="app" onHome={onBack} onNavigate={onNavigate} />
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <p style={{ color: theme.body, marginBottom: "1rem" }}>{error}</p>
          <button type="button" onClick={onBack} className="px-4 py-2 rounded-xl cursor-pointer" style={{ background: theme.optionBg, border: `1px solid ${theme.border}`, color: theme.body }}>
            Back to Community
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const trip = data.trip;

  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", transition: "background 0.3s" }}>
      <Navbar variant="app" onHome={onBack} onNavigate={onNavigate} />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-12" style={{ paddingTop: "72px" }}>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 mb-5 cursor-pointer min-h-[40px]"
          style={{ background: "none", border: "none", color: theme.accentSky, fontFamily: "system-ui, sans-serif", fontSize: "0.88rem", fontWeight: 500, padding: 0 }}
        >
          <ChevronLeft size={18} />
          Community
        </button>

        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.6rem, 6vw, 2.4rem)", color: theme.heading, marginBottom: "0.35rem" }}>
          {trip.destination}
        </h1>
        <p style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", fontSize: "0.88rem", marginBottom: "0.5rem" }}>
          Shared by {data.author.display_name} · {trip.duration}
        </p>
        {data.share_caption && (
          <p className="mb-4" style={{ color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.95rem", lineHeight: 1.55 }}>
            {data.share_caption}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-8">
          <button
            type="button"
            disabled={actionBusy === "vote"}
            onClick={handleVote}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl cursor-pointer min-h-[44px] disabled:opacity-60"
            style={{
              background: data.viewer_voted ? "rgba(239, 68, 68, 0.12)" : theme.optionBg,
              border: `1px solid ${data.viewer_voted ? "rgba(239, 68, 68, 0.35)" : theme.border}`,
              color: data.viewer_voted ? "#ef4444" : theme.body,
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.88rem",
            }}
          >
            <Heart size={18} fill={data.viewer_voted ? "currentColor" : "none"} />
            {data.vote_count}
          </button>
          <button
            type="button"
            disabled={actionBusy === "save"}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl cursor-pointer min-h-[44px] disabled:opacity-60"
            style={{
              background: data.viewer_saved ? "rgba(88, 171, 212, 0.12)" : theme.optionBg,
              border: `1px solid ${data.viewer_saved ? theme.accentSky : theme.border}`,
              color: data.viewer_saved ? theme.accentSky : theme.body,
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.88rem",
            }}
          >
            <Bookmark size={18} fill={data.viewer_saved ? "currentColor" : "none"} />
            Save
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: theme.body }}>
            {error}
          </p>
        )}

        <h2 className="mb-4" style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.2rem" }}>
          Itinerary
        </h2>
        <div className="space-y-3 mb-10">
          {trip.itinerary.map((day) => (
            <DayPanel key={day.day} dayPlan={day} destination={trip.destination} defaultOpen={day.day === 1} />
          ))}
        </div>

        <h2 className="mb-4" style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.2rem" }}>
          Comments ({data.comment_count})
        </h2>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
            placeholder="Add a comment…"
            className="flex-1 px-4 py-3 rounded-xl min-h-[48px]"
            style={{
              background: theme.optionBg,
              border: `1px solid ${theme.border}`,
              color: theme.body,
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.9rem",
            }}
          />
          <button
            type="button"
            disabled={posting || !commentText.trim()}
            onClick={handlePostComment}
            className="px-4 rounded-xl cursor-pointer min-h-[48px] min-w-[48px] disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
              border: "none",
              color: "#fff",
            }}
            aria-label="Post comment"
          >
            <Send size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {comments.length === 0 ? (
            <p style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", fontSize: "0.88rem" }}>
              No comments yet. Be the first!
            </p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="rounded-xl p-4"
                style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}` }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p style={{ color: theme.heading, fontFamily: "system-ui, sans-serif", fontSize: "0.85rem", fontWeight: 600 }}>
                    {c.author.display_name}
                  </p>
                  {c.is_mine && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(c.id)}
                      className="p-1 cursor-pointer"
                      style={{ background: "none", border: "none", color: theme.muted }}
                      aria-label="Delete comment"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p style={{ color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  {c.body}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
