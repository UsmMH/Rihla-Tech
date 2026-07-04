import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, MapPin, Route } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import ChatbotSidebar from "@/components/trip/ChatbotSidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import {
  dayRouteExceedsWaypointLimit,
  googleMapsDayRouteUrl,
  googleMapsLegUrl,
  googleMapsSearchUrl,
} from "@/lib/mapDirections";
import { dayPinColor, getActivityTypeStyle } from "@/lib/activityType";
import { generateTrip, getTrip, saveLastTripId, type TripDetail } from "@/lib/trips";
import type { AppTab } from "@/lib/navigation";

type TripResultProps = {
  tripPlanId: number;
  onHome: () => void;
  onNavigate?: (tab: AppTab) => void;
};

function sourceLabel(source: string): string {
  if (source === "gemini") return "Gemini";
  if (source === "openrouter") return "OpenRouter";
  if (source === "openai") return "OpenAI";
  return "Demo";
}

export default function TripResult({ tripPlanId, onHome, onNavigate }: TripResultProps) {
  const { theme } = useTheme();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialInput, setChatInitialInput] = useState("");
  const [savedDays, setSavedDays] = useState<number[]>([]);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItinerary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      try {
        const existing = await getTrip(tripPlanId);
        setTrip(existing);
        return;
      } catch (err: unknown) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          throw err;
        }
      }
      const result = await generateTrip(tripPlanId);
      setTrip(result);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Failed to generate itinerary");
    } finally {
      setLoading(false);
    }
  }, [tripPlanId]);

  useEffect(() => {
    saveLastTripId(tripPlanId);
    loadItinerary();
  }, [loadItinerary, tripPlanId]);

  function toggleSave(day: number) {
    setSavedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  if (loading) {
    return (
      <div style={{ background: theme.pageBg, minHeight: "100vh" }}>
        <Navbar variant="app" onHome={onHome} onNavigate={onNavigate} />
        <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: "70vh", color: theme.muted }}>
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mb-4"
            style={{ borderColor: theme.accentSky, borderTopColor: "transparent" }}
          />
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "0.95rem" }}>
            Generating your AI itinerary...
          </p>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "0.8rem", marginTop: 8, color: theme.faint }}>
            This can take up to a minute with AI.
          </p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={{ background: theme.pageBg, minHeight: "100vh" }}>
        <Navbar variant="app" onHome={onHome} onNavigate={onNavigate} />
        <div className="flex flex-col items-center justify-center gap-4 px-4" style={{ minHeight: "70vh" }}>
          <p style={{ color: theme.body, fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
            {error ?? "Something went wrong"}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={loadItinerary}
              className="px-4 py-2.5 rounded-xl"
              style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, color: "#fff", border: "none", fontFamily: "system-ui, sans-serif" }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onHome}
              className="px-4 py-2.5 rounded-xl"
              style={{ background: theme.optionBg, border: `1px solid ${theme.border}`, color: theme.body, fontFamily: "system-ui, sans-serif" }}
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", transition: "background 0.3s" }}>
      <Navbar variant="app" onHome={onHome} onNavigate={onNavigate} />

      <div
        className="relative"
        style={{
          background: theme.isDark
            ? "linear-gradient(180deg, #0D2A55 0%, #0A1628 100%)"
            : `linear-gradient(180deg, ${theme.sectionAlt} 0%, ${theme.pageBg} 100%)`,
          borderBottom: `1px solid ${theme.border}`,
          paddingTop: "60px",
          transition: "background 0.3s",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#4CAF50" }} />
                <span style={{ color: theme.muted, fontSize: "0.72rem", fontFamily: "system-ui, sans-serif", letterSpacing: "0.08em" }}>
                  YOUR AI-GENERATED ITINERARY
                </span>
              </div>
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.8rem, 8vw, 3.5rem)", color: theme.heading, lineHeight: 1.1, marginBottom: "0.4rem" }}>
                {trip.destination}
              </h1>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontStyle: "italic", color: theme.accentLabel, fontSize: "1.05rem" }}>
                {trip.duration} · {trip.tags}
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                {trip.stats.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-1.5">
                    <span style={{ color: theme.faint, fontSize: "0.75rem", fontFamily: "system-ui, sans-serif" }}>{stat.label}:</span>
                    <span style={{ color: theme.accentSky, fontWeight: 600, fontSize: "0.85rem", fontFamily: "system-ui, sans-serif" }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setChatInitialInput("");
                  setIsChatOpen(true);
                }}
                className="hidden md:inline-flex items-center justify-center gap-2 w-full md:w-auto px-4 py-3 md:py-2.5 rounded-xl cursor-pointer whitespace-nowrap flex-shrink-0 min-h-[44px]"
                style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, border: `1px solid ${theme.border}`, color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: "0.88rem", fontWeight: 500, lineHeight: 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="flex-shrink-0" aria-hidden>
                  <path d="M2 2h11v9H8l-3 3v-3H2V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                <span>Ask AI</span>
              </motion.button>
            </div>
          </div>

          {trip.source !== "mock" && (
            <p
              className="mt-4 rounded-lg px-3 py-2 text-sm inline-block"
              style={{
                background: "rgba(88, 171, 212, 0.12)",
                border: `1px solid ${theme.accentSky}`,
                color: theme.accentSky,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Generated with {sourceLabel(trip.source)}
            </p>
          )}

          {trip.source === "mock" && (
            <p
              className="mt-4 rounded-lg px-3 py-2 text-sm inline-block"
              style={{
                background: "rgba(234, 179, 8, 0.12)",
                border: "1px solid rgba(234, 179, 8, 0.4)",
                color: theme.body,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Demo itinerary — AI unavailable
              {trip.fallback_reason ? `: ${trip.fallback_reason}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-32 md:pb-12">
        <div className="space-y-10">
          {trip.itinerary.map((dayPlan) => {
            const dayActivityNames = dayPlan.activities.map((a) => a.name);
            const dayGoogleRoute = googleMapsDayRouteUrl(dayActivityNames, trip.destination);
            const routeTruncated = dayRouteExceedsWaypointLimit(dayActivityNames.length);

            return (
            <div
              key={dayPlan.day}
              className="rounded-2xl p-4 md:p-5"
              style={{
                background: theme.isDark ? "rgba(255,255,255,0.03)" : theme.sectionAlt,
                border: `1px solid ${theme.border}`,
                boxShadow: theme.cardShadow,
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    style={{ background: theme.dayHeaderBg, color: "#fff", fontFamily: "'DM Serif Display', serif" }}
                  >
                    {dayPlan.day}
                  </div>
                  <div className="min-w-0">
                    <h2 style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.25rem", lineHeight: 1.2 }}>
                      Day {dayPlan.day}
                    </h2>
                    <p style={{ color: theme.accentSky, fontSize: "0.78rem", fontFamily: "system-ui, sans-serif", marginTop: 2 }}>
                      {dayPlan.theme}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto sm:flex-shrink-0">
                  {dayGoogleRoute && (
                    <a
                      href={dayGoogleRoute}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl transition-opacity hover:opacity-90 min-h-[44px]"
                      style={{
                        background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
                        color: "#fff",
                        fontFamily: "system-ui, sans-serif",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        textDecoration: "none",
                        minHeight: 36,
                      }}
                      title={routeTruncated ? "First 11 stops only — Google Maps waypoint limit" : "Driving route through today's activities in order"}
                    >
                      <Route size={14} strokeWidth={2} />
                      Day route
                      <ExternalLink size={11} strokeWidth={2} className="opacity-85" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleSave(dayPlan.day)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all min-h-[44px]"
                    style={{
                      background: savedDays.includes(dayPlan.day) ? theme.optionBgSelected : theme.optionBg,
                      border: `1px solid ${savedDays.includes(dayPlan.day) ? theme.accentSky : theme.border}`,
                      color: savedDays.includes(dayPlan.day) ? theme.accentSky : theme.muted,
                      fontFamily: "system-ui, sans-serif",
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      minHeight: 36,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill={savedDays.includes(dayPlan.day) ? theme.accentSky : "none"}>
                      <path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9l-3 1.5.5-3.5L1 4.5 4.5 4 6 1z" stroke={theme.accentSky} strokeWidth="1" strokeLinejoin="round" />
                    </svg>
                    {savedDays.includes(dayPlan.day) ? "Saved" : "Save Day"}
                  </button>
                </div>
              </div>
              {routeTruncated && (
                <p className="mb-4 -mt-2 text-xs" style={{ color: theme.faint, fontFamily: "system-ui, sans-serif" }}>
                  Day route includes the first 11 stops — Google Maps limits multi-stop URLs.
                </p>
              )}

              <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
                {dayPlan.activities.map((activity, aIdx) => {
                  const typeStyle = getActivityTypeStyle(activity.type);
                  const TypeIcon = typeStyle.icon;
                  const dayColor = dayPinColor(dayPlan.day);
                  const googleMapsUrl = googleMapsSearchUrl(activity.name, trip.destination);
                  const previousActivity = aIdx > 0 ? dayPlan.activities[aIdx - 1] : null;
                  const legGoogleUrl = previousActivity
                    ? googleMapsLegUrl(previousActivity.name, activity.name, trip.destination)
                    : null;

                  return (
                  <motion.div
                    key={`${dayPlan.day}-${activity.time_slot}-${activity.name}`}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: aIdx * 0.08 }}
                    className="rounded-2xl overflow-hidden w-full flex flex-col"
                    style={{
                      background: theme.activityCardBg,
                      border: `1px solid ${theme.activityCardBorder}`,
                      borderTop: `3px solid ${dayColor}`,
                      minHeight: "260px",
                      boxShadow: theme.cardShadow,
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.activityCardHoverBorder;
                      e.currentTarget.style.boxShadow = `0 4px 20px ${theme.accentSky}18`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.activityCardBorder;
                      e.currentTarget.style.boxShadow = theme.cardShadow;
                    }}
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3"
                      style={{ background: typeStyle.gradient }}
                    >
                      <div className="flex items-center gap-2">
                        <TypeIcon size={16} color="#fff" strokeWidth={2} />
                        <span style={{ color: "#fff", fontSize: "0.75rem", fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>
                          {activity.type}
                        </span>
                      </div>
                      <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.7rem", fontFamily: "system-ui, sans-serif" }}>
                        {activity.duration}
                      </span>
                    </div>
                    <div className="p-4 flex flex-col flex-1 min-h-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 style={{ fontFamily: "'DM Serif Display', serif", color: theme.activityHeading, fontSize: "1.02rem", lineHeight: 1.25 }}>{activity.name}</h3>
                        <span
                          className="px-2 py-0.5 rounded-md flex-shrink-0"
                          style={{
                            color: theme.accentSky,
                            background: theme.isDark ? "rgba(88,171,212,0.12)" : "rgba(30,75,136,0.08)",
                            fontSize: "0.7rem",
                            fontFamily: "system-ui, sans-serif",
                            fontWeight: 600,
                          }}
                        >
                          {activity.time}
                        </span>
                      </div>
                      <p className="flex-1 mb-3" style={{ color: theme.activityBody, fontSize: "0.8rem", lineHeight: "1.55", fontFamily: "system-ui, sans-serif" }}>
                        {activity.desc}
                      </p>
                      <div className="mt-auto flex flex-col gap-2">
                        {legGoogleUrl && (
                          <a
                            href={legGoogleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-xl transition-opacity hover:opacity-90 min-h-[44px]"
                            style={{
                              background: theme.isDark ? "rgba(88,171,212,0.1)" : "rgba(88,171,212,0.12)",
                              border: `1px solid ${theme.accentSky}44`,
                              color: theme.accentSky,
                              fontSize: "0.74rem",
                              fontFamily: "system-ui, sans-serif",
                              fontWeight: 500,
                              textDecoration: "none",
                            }}
                          >
                            <Route size={13} strokeWidth={2} />
                            Route from previous stop
                          </a>
                        )}
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-xl transition-opacity hover:opacity-90 min-h-[44px]"
                          style={{
                            background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
                            color: "#fff",
                            fontSize: "0.78rem",
                            fontFamily: "system-ui, sans-serif",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          <MapPin size={14} strokeWidth={2} className="flex-shrink-0" />
                          Open in Maps
                          <ExternalLink size={11} strokeWidth={2} className="flex-shrink-0 opacity-85" />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>

        <div className="mt-10 pt-8" style={{ borderTop: `1px solid ${theme.border}` }}>
          <button
            type="button"
            onClick={onHome}
            className="w-full px-6 py-3.5 rounded-xl cursor-pointer transition-all min-h-[48px]"
            style={{ background: theme.optionBg, border: `1px solid ${theme.border}`, color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.95rem" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.accentMid)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.border)}
          >
            ← Home
          </button>
        </div>
      </div>

      {!isChatOpen && (
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 px-4 pt-3"
        style={{
          background: theme.navBg,
          backdropFilter: "blur(14px)",
          borderTop: `1px solid ${theme.navBorder}`,
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
        }}
      >
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => setIsChatOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl cursor-pointer min-h-[48px]"
          style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, border: "none", color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: "0.9rem", fontWeight: 600, lineHeight: 1 }}
        >
          <svg width="16" height="16" viewBox="0 0 15 15" fill="none" className="flex-shrink-0" aria-hidden>
            <path d="M2 2h11v9H8l-3 3v-3H2V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          <span>Ask AI</span>
        </motion.button>
      </div>
      )}

      {!isChatOpen && (
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
        onClick={() => setIsChatOpen(true)}
        className="hidden md:inline-flex fixed bottom-6 right-5 z-30 items-center justify-center gap-2 px-4 py-3 rounded-full cursor-pointer shadow-xl whitespace-nowrap min-h-[44px]"
        style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, border: `1px solid ${theme.border}`, color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: "0.88rem", fontWeight: 500, lineHeight: 1, boxShadow: "0 8px 30px rgba(30,75,136,0.35)" }}
      >
        <svg width="16" height="16" viewBox="0 0 15 15" fill="none" className="flex-shrink-0" aria-hidden>
          <path d="M2 2h11v9H8l-3 3v-3H2V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        <span>Ask AI</span>
      </motion.button>
      )}

      <ChatbotSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        tripPlanId={tripPlanId}
        destination={trip.destination}
        initialInput={chatInitialInput}
        onItineraryUpdated={setTrip}
      />
    </div>
  );
}
