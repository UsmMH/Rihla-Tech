import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, ChevronRight, MapPin, MessageCircle, Sparkles } from "lucide-react";
import AppBottomNav from "@/components/layout/AppBottomNav";
import Navbar from "@/components/layout/Navbar";
import ChatbotSidebar from "@/components/trip/ChatbotSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { AppTab } from "@/lib/navigation";
import { listTrips, loadLastTripId, type TripListItem } from "@/lib/trips";

type AppDashboardPageProps = {
  onNavigate: (tab: AppTab) => void;
  onPlanTrip: () => void;
  onOpenTrip: (tripPlanId: number) => void;
};

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Dates not set";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = new Date(start + "T00:00:00").toLocaleDateString(undefined, opts);
  if (!end || end === start) return startStr;
  const endStr = new Date(end + "T00:00:00").toLocaleDateString(undefined, opts);
  return `${startStr} – ${endStr}`;
}

function greetingForHour(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function AppDashboardPage({ onNavigate, onPlanTrip, onOpenTrip }: AppDashboardPageProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialInput, setChatInitialInput] = useState("");

  const lastTripId = loadLastTripId();
  const recentTrips = trips.slice(0, 3);
  const resumeTrip = lastTripId ? trips.find((t) => t.id === lastTripId) : undefined;

  useEffect(() => {
    listTrips()
      .then(setTrips)
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, []);

  function openAskAi(initialInput = "") {
    setChatInitialInput(initialInput);
    setIsChatOpen(true);
  }

  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", transition: "background 0.3s" }}>
      <Navbar variant="app" activePage="home" onNavigate={onNavigate} onHome={() => onNavigate("home")} />

      <div
        className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-12"
        style={{ paddingTop: "80px" }}
      >
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", fontSize: "0.9rem", marginBottom: "0.25rem" }}>
            {greetingForHour()},
          </p>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(1.8rem, 6vw, 2.4rem)",
              color: theme.heading,
              lineHeight: 1.15,
            }}
          >
            {user?.first_name ?? "Traveler"}
          </h1>
          <p style={{ color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.95rem", marginTop: "0.5rem" }}>
            Where will your next adventure take you?
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onPlanTrip}
            className="rounded-2xl p-5 text-left cursor-pointer min-h-[120px] flex flex-col justify-between"
            style={{
              background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
              border: "none",
              boxShadow: theme.cardShadow,
            }}
          >
            <Sparkles size={24} color="#fff" />
            <div>
              <p style={{ color: "#fff", fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", marginBottom: "0.25rem" }}>
                Plan a new trip
              </p>
              <p style={{ color: "rgba(255,255,255,0.85)", fontFamily: "system-ui, sans-serif", fontSize: "0.82rem" }}>
                Answer a few questions for a personalized itinerary
              </p>
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => openAskAi()}
            className="rounded-2xl p-5 text-left cursor-pointer min-h-[120px] flex flex-col justify-between"
            style={{
              background: theme.activityCardBg,
              border: `1px solid ${theme.activityCardBorder}`,
              boxShadow: theme.cardShadow,
            }}
          >
            <MessageCircle size={24} color={theme.accentSky} />
            <div>
              <p style={{ color: theme.heading, fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", marginBottom: "0.25rem" }}>
                Ask AI
              </p>
              <p style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", fontSize: "0.82rem" }}>
                Get travel tips, ideas, and destination advice
              </p>
            </div>
          </motion.button>
        </div>

        {resumeTrip && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-2xl px-4 py-4 flex items-center gap-3"
            style={{ background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: theme.dayHeaderBg }}
            >
              <MapPin size={18} color="#fff" />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: theme.muted, fontSize: "0.72rem", fontFamily: "system-ui, sans-serif", marginBottom: "0.15rem" }}>
                Continue planning
              </p>
              <p style={{ color: theme.heading, fontFamily: "'DM Serif Display', serif", fontSize: "1rem" }}>
                {resumeTrip.destination ?? "Your trip"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenTrip(resumeTrip.id)}
              className="px-4 py-2 rounded-xl text-sm cursor-pointer min-h-[40px]"
              style={{
                background: theme.accentDeep,
                color: "#fff",
                border: "none",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Resume
            </button>
          </motion.div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.25rem", color: theme.heading }}>
            Recent trips
          </h2>
          {trips.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate("my-trips")}
              className="text-sm cursor-pointer"
              style={{ color: theme.accentSky, background: "none", border: "none", fontFamily: "system-ui, sans-serif" }}
            >
              View all
            </button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div
              className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: theme.accentSky, borderTopColor: "transparent" }}
            />
          </div>
        )}

        {!loading && recentTrips.length === 0 && (
          <div
            className="text-center py-12 rounded-2xl"
            style={{ background: theme.optionBg, border: `1px solid ${theme.border}` }}
          >
            <MapPin size={28} color={theme.muted} className="mx-auto mb-3" />
            <p style={{ color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.9rem" }}>
              No trips yet — start with Plan a new trip above.
            </p>
          </div>
        )}

        {!loading && recentTrips.length > 0 && (
          <div className="space-y-3">
            {recentTrips.map((trip, i) => (
              <motion.button
                key={trip.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onOpenTrip(trip.id)}
                className="w-full rounded-2xl px-4 py-4 flex items-center gap-3 text-left cursor-pointer"
                style={{
                  background: theme.activityCardBg,
                  border: `1px solid ${theme.activityCardBorder}`,
                  boxShadow: theme.cardShadow,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: theme.dayHeaderBg }}
                >
                  <MapPin size={18} color="#fff" />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: "'DM Serif Display', serif", color: theme.activityHeading, fontSize: "1rem" }}>
                    {trip.destination ?? "Destination TBD"}
                  </p>
                  <span
                    className="flex items-center gap-1 mt-0.5"
                    style={{ color: theme.muted, fontSize: "0.78rem", fontFamily: "system-ui, sans-serif" }}
                  >
                    <Calendar size={12} />
                    {formatDateRange(trip.start_date, trip.end_date)}
                  </span>
                </div>
                <ChevronRight size={18} color={theme.muted} />
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <AppBottomNav active="home" onNavigate={onNavigate} />

      <ChatbotSidebar
        mode="consult"
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialInput={chatInitialInput}
        onPlanTrip={onPlanTrip}
      />
    </div>
  );
}
