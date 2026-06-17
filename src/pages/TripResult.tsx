import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, MapPin, Route } from "lucide-react";
import Footer from "@/components/layout/Footer";
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
import { editTrip, generateTrip, getTrip, saveLastTripId, type TripAlternative, type TripDetail } from "@/lib/trips";

type TripResultProps = {
  tripPlanId: number;
  onHome: () => void;
  onMyTrips?: () => void;
};

function sourceLabel(source: string): string {
  if (source === "gemini") return "Gemini";
  if (source === "openrouter") return "OpenRouter";
  if (source === "openai") return "OpenAI";
  return "Demo";
}

export default function TripResult({ tripPlanId, onHome, onMyTrips }: TripResultProps) {
  const { theme } = useTheme();
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<TripAlternative[]>([]);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [alternativesError, setAlternativesError] = useState<string | null>(null);
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

  async function loadAlternatives() {
    if (alternatives.length > 0) {
      setShowAlternatives((s) => !s);
      return;
    }
    setShowAlternatives(true);
    setAlternativesLoading(true);
    setAlternativesError(null);
    try {
      const result = await editTrip(tripPlanId);
      setAlternatives(result.alternatives);
    } catch (err: unknown) {
      setAlternativesError(err instanceof ApiError ? err.message : "Failed to load alternatives");
    } finally {
      setAlternativesLoading(false);
    }
  }

  function toggleSave(day: number) {
    setSavedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  if (loading) {
    return (
      <div style={{ background: theme.pageBg, minHeight: "100vh" }}>
        <Navbar onHome={onHome} onMyTrips={onMyTrips} />
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
        <Navbar onHome={onHome} onMyTrips={onMyTrips} />
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
      <Navbar onHome={onHome} />

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

            <div className="flex gap-2 flex-wrap">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setChatInitialInput("");
                  setIsChatOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap flex-shrink-0"
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

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  {dayGoogleRoute && (
                    <a
                      href={dayGoogleRoute}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl transition-opacity hover:opacity-90"
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
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl cursor-pointer transition-all"
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

              <div
                className="md:grid md:gap-4 md:grid-cols-3"
                style={{ display: "flex", overflowX: "auto", gap: "14px", paddingBottom: "4px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
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
                    className="rounded-2xl overflow-hidden flex-shrink-0 flex flex-col"
                    style={{
                      background: theme.activityCardBg,
                      border: `1px solid ${theme.activityCardBorder}`,
                      borderTop: `3px solid ${dayColor}`,
                      minWidth: "272px",
                      width: "272px",
                      minHeight: "260px",
                      scrollSnapAlign: "start",
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
                            className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl transition-opacity hover:opacity-90"
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
                          className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-xl transition-opacity hover:opacity-90"
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

        <div className="mt-12 mb-4">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.4rem" }}>Explore Alternatives</h2>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (showAlternatives && alternatives.length > 0) {
                  setShowAlternatives(false);
                } else {
                  void loadAlternatives();
                }
              }}
              disabled={alternativesLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all"
              style={{
                background: showAlternatives ? theme.optionBgSelected : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
                border: `1px solid ${theme.border}`,
                color: "#FFFFFF",
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.88rem",
                fontWeight: 500,
                opacity: alternativesLoading ? 0.7 : 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                <path d="M2 7.5h11M9 4l3.5 3.5L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {alternativesLoading ? "Loading..." : showAlternatives ? "Hide" : "Suggest Alternatives"}
            </motion.button>
          </div>

          <AnimatePresence>
            {showAlternatives && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }} className="overflow-hidden"
              >
                {alternativesError && (
                  <p className="mb-4 text-sm" style={{ color: theme.body, fontFamily: "system-ui, sans-serif" }}>
                    {alternativesError}
                  </p>
                )}
                {alternativesLoading && (
                  <div className="flex justify-center py-8">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: theme.accentSky, borderTopColor: "transparent" }}
                    />
                  </div>
                )}
                {!alternativesLoading && alternatives.length > 0 && (
                  <div
                    className="md:grid md:grid-cols-3 md:gap-5"
                    style={{ display: "flex", overflowX: "auto", gap: "12px", paddingBottom: "8px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
                  >
                    {alternatives.map((alt, i) => (
                      <motion.div
                        key={alt.title}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                        className="rounded-2xl overflow-hidden flex-shrink-0"
                        style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}`, minWidth: "260px", width: "260px", scrollSnapAlign: "start", boxShadow: theme.cardShadow, transition: "background 0.3s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.activityCardHoverBorder)}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.activityCardBorder)}
                      >
                        <div
                          className="relative flex items-end px-4 pb-4"
                          style={{
                            height: "100px",
                            background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
                          }}
                        >
                          <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs"
                            style={{ background: "rgba(10,22,40,0.5)", border: "1px solid rgba(88,171,212,0.3)", color: "#58ABD4", fontFamily: "system-ui, sans-serif" }}>
                            {alt.match_percent}% match
                          </div>
                          <h3 style={{ fontFamily: "'DM Serif Display', serif", color: "#fff", fontSize: "1.05rem" }}>{alt.title}</h3>
                        </div>
                        <div className="p-4">
                          <p style={{ color: theme.muted, fontSize: "0.78rem", marginBottom: "0.75rem", fontFamily: "system-ui, sans-serif" }}>{alt.tagline}</p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {alt.highlights.map((h) => (
                              <span key={h} className="px-2 py-0.5 rounded-full text-xs"
                                style={{ background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}`, color: theme.badgeText, fontFamily: "system-ui, sans-serif" }}>
                                {h}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <span style={{ color: theme.faint, fontSize: "0.72rem", fontFamily: "system-ui, sans-serif" }}>{alt.budget_note}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setChatInitialInput(`Tell me more about visiting ${alt.title} instead of my current destination`);
                                setIsChatOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all"
                              style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, color: "#fff", border: "none", fontFamily: "system-ui, sans-serif" }}
                            >
                              Ask AI
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-10 pt-8 flex flex-col sm:flex-row gap-3" style={{ borderTop: `1px solid ${theme.border}` }}>
          <button onClick={onHome}
            className="w-full sm:w-auto flex-1 px-6 py-3.5 rounded-xl cursor-pointer transition-all"
            style={{ background: theme.optionBg, border: `1px solid ${theme.border}`, color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.95rem" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.accentMid)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.border)}
          >
            ← Start Over
          </button>
          <button
            className="w-full sm:w-auto flex-1 px-6 py-3.5 rounded-xl cursor-pointer transition-all"
            style={{ background: theme.optionBg, border: `1px solid ${theme.border}`, color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.95rem" }}
          >
            Share Trip
          </button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto flex-1 px-6 py-3.5 rounded-xl font-semibold cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, border: "none", color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: "0.95rem" }}
          >
            Download PDF Guide
          </motion.button>
        </div>
      </div>

      <Footer />

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-5 z-30 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full cursor-pointer shadow-xl whitespace-nowrap"
        style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, border: `1px solid ${theme.border}`, color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: "0.88rem", fontWeight: 500, lineHeight: 1, boxShadow: "0 8px 30px rgba(30,75,136,0.35)" }}
      >
        <svg width="16" height="16" viewBox="0 0 15 15" fill="none" className="flex-shrink-0" aria-hidden>
          <path d="M2 2h11v9H8l-3 3v-3H2V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        <span>Ask AI</span>
      </motion.button>

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
