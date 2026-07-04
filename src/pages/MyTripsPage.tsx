import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, ChevronRight, Trash2 } from "lucide-react";
import AppBottomNav from "@/components/layout/AppBottomNav";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import type { AppTab } from "@/lib/navigation";
import { deleteTrip, listTrips, type TripListItem } from "@/lib/trips";

type MyTripsPageProps = {
  onSelectTrip: (tripPlanId: number) => void;
  onNewTrip: () => void;
  onHome: () => void;
  onNavigate: (tab: AppTab) => void;
  onTripDeleted?: (tripPlanId: number) => void;
};

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Dates not set";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const startStr = new Date(start + "T00:00:00").toLocaleDateString(undefined, opts);
  if (!end || end === start) return startStr;
  const endStr = new Date(end + "T00:00:00").toLocaleDateString(undefined, opts);
  return `${startStr} – ${endStr}`;
}

function statusLabel(trip: TripListItem): string {
  if (trip.has_itinerary) return "Itinerary ready";
  if (trip.destination) return "Ready to generate";
  return "In progress";
}

export default function MyTripsPage({ onSelectTrip, onNewTrip, onHome, onNavigate, onTripDeleted }: MyTripsPageProps) {
  const { theme } = useTheme();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    listTrips()
      .then(setTrips)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load trips");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(e: React.MouseEvent, tripId: number, label: string) {
    e.stopPropagation();
    if (deletingId !== null) return;
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

    setDeletingId(tripId);
    try {
      await deleteTrip(tripId);
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
      onTripDeleted?.(tripId);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Failed to delete trip");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", transition: "background 0.3s" }}>
      <Navbar variant="app" activePage="my-trips" onHome={onHome} onNavigate={onNavigate} />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-12" style={{ paddingTop: "80px" }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
                color: theme.heading,
                marginBottom: "0.25rem",
              }}
            >
              My Trips
            </h1>
            <p style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", fontSize: "0.9rem" }}>
              Pick up where you left off
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onNewTrip}
            className="w-full sm:w-auto px-5 py-3 rounded-xl cursor-pointer min-h-[44px]"
            style={{
              background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
              color: "#fff",
              border: "none",
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.88rem",
              fontWeight: 500,
            }}
          >
            + Plan New Trip
          </motion.button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: theme.accentSky, borderTopColor: "transparent" }}
            />
          </div>
        )}

        {error && (
          <p
            className="text-center py-12 rounded-xl"
            style={{
              color: theme.body,
              background: theme.optionBg,
              border: `1px solid ${theme.border}`,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {error}
          </p>
        )}

        {!loading && !error && trips.length === 0 && (
          <div
            className="text-center py-16 rounded-2xl"
            style={{ background: theme.optionBg, border: `1px solid ${theme.border}` }}
          >
            <MapPin size={32} color={theme.muted} className="mx-auto mb-4" />
            <p style={{ color: theme.body, fontFamily: "system-ui, sans-serif", marginBottom: "1rem" }}>
              No trips yet. Start planning your first adventure!
            </p>
            <button
              type="button"
              onClick={onNewTrip}
              className="px-5 py-2.5 rounded-xl cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
                color: "#fff",
                border: "none",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Plan My Trip
            </button>
          </div>
        )}

        {!loading && !error && trips.length > 0 && (
          <div className="space-y-3">
            {trips.map((trip, i) => (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl px-4 py-4 sm:px-5 flex items-center gap-3 sm:gap-4"
                style={{
                  background: theme.activityCardBg,
                  border: `1px solid ${theme.activityCardBorder}`,
                  boxShadow: theme.cardShadow,
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectTrip(trip.id)}
                  className="flex items-center gap-4 flex-1 min-w-0 text-left cursor-pointer"
                  style={{ background: "none", border: "none", padding: 0 }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: theme.dayHeaderBg }}
                  >
                    <MapPin size={20} color="#fff" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      style={{
                        fontFamily: "'DM Serif Display', serif",
                        color: theme.activityHeading,
                        fontSize: "1.05rem",
                        marginBottom: "0.2rem",
                      }}
                    >
                      {trip.destination ?? "Destination TBD"}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className="flex items-center gap-1"
                        style={{ color: theme.muted, fontSize: "0.78rem", fontFamily: "system-ui, sans-serif" }}
                      >
                        <Calendar size={12} />
                        {formatDateRange(trip.start_date, trip.end_date)}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full"
                        style={{
                          background: trip.has_itinerary ? "rgba(76,175,80,0.15)" : theme.badgeBg,
                          color: trip.has_itinerary ? "#4CAF50" : theme.badgeText,
                          fontSize: "0.7rem",
                          fontFamily: "system-ui, sans-serif",
                        }}
                      >
                        {statusLabel(trip)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} color={theme.muted} className="flex-shrink-0" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${trip.destination ?? "trip"}`}
                  disabled={deletingId === trip.id}
                  onClick={(e) => void handleDelete(e, trip.id, trip.destination ?? "this trip")}
                  className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors min-w-[44px]"
                  style={{
                    background: theme.optionBg,
                    border: `1px solid ${theme.border}`,
                    opacity: deletingId === trip.id ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#e57373";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.border;
                  }}
                >
                  <Trash2 size={16} color={deletingId === trip.id ? theme.muted : "#e57373"} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AppBottomNav active="my-trips" onNavigate={onNavigate} />

      <Footer />
    </div>
  );
}
