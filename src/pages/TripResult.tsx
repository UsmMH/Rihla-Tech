import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import ChatbotSidebar from "@/components/trip/ChatbotSidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import { alternatives } from "@/data/itinerary";
import { generateTrip, getTrip, type TripDetail } from "@/lib/trips";

type TripResultProps = {
  tripPlanId: number;
  onEdit: () => void;
  onHome: () => void;
};

function activityImageSeed(name: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(name.replace(/\s/g, ""))}/600/350`;
}

function sourceLabel(source: string): string {
  if (source === "gemini") return "Gemini";
  if (source === "openrouter") return "OpenRouter";
  if (source === "openai") return "OpenAI";
  return "Demo";
}

export default function TripResult({ tripPlanId, onEdit, onHome }: TripResultProps) {
  const { theme } = useTheme();
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
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
    loadItinerary();
  }, [loadItinerary]);

  function toggleSave(day: number) {
    setSavedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  if (loading) {
    return (
      <div style={{ background: theme.pageBg, minHeight: "100vh" }}>
        <Navbar onHome={onHome} />
        <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: "70vh", color: theme.muted }}>
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mb-4"
            style={{ borderColor: theme.accentSky, borderTopColor: "transparent" }}
          />
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "0.95rem" }}>
            Generating your AI itinerary...
          </p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={{ background: theme.pageBg, minHeight: "100vh" }}>
        <Navbar onHome={onHome} />
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
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all"
                style={{ background: theme.optionBg, border: `1px solid ${theme.border}`, color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.88rem" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.accentMid)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.border)}
              >
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                  <path d="M10 2l3 3-8 8H2v-3L10 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                Edit Trip
              </button>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setIsChatOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer"
                style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, border: `1px solid ${theme.border}`, color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: "0.88rem", fontWeight: 500 }}
              >
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                  <path d="M2 2h11v9H8l-3 3v-3H2V2z" stroke="#58ABD4" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                <span className="hidden sm:inline">Ask AI</span>
                <span className="sm:hidden">AI</span>
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
          {trip.itinerary.map((dayPlan) => (
            <div key={dayPlan.day}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    style={{ background: theme.dayHeaderBg, color: "#fff", fontFamily: "'DM Serif Display', serif" }}>
                    {dayPlan.day}
                  </div>
                  <div>
                    <h2 style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.2rem" }}>Day {dayPlan.day}</h2>
                    <p style={{ color: theme.accentSky, fontSize: "0.75rem", fontFamily: "system-ui, sans-serif" }}>{dayPlan.theme}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSave(dayPlan.day)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer text-xs transition-all flex-shrink-0"
                  style={{
                    background: savedDays.includes(dayPlan.day) ? theme.optionBgSelected : theme.optionBg,
                    border: `1px solid ${savedDays.includes(dayPlan.day) ? theme.accentSky : theme.border}`,
                    color: savedDays.includes(dayPlan.day) ? theme.accentSky : theme.muted,
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill={savedDays.includes(dayPlan.day) ? theme.accentSky : "none"}>
                    <path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9l-3 1.5.5-3.5L1 4.5 4.5 4 6 1z" stroke={theme.accentSky} strokeWidth="1" strokeLinejoin="round" />
                  </svg>
                  {savedDays.includes(dayPlan.day) ? "Saved" : "Save Day"}
                </button>
              </div>

              <div
                className="md:grid md:gap-4 md:grid-cols-3"
                style={{ display: "flex", overflowX: "auto", gap: "12px", paddingBottom: "8px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {dayPlan.activities.map((activity, aIdx) => (
                  <motion.div
                    key={`${dayPlan.day}-${activity.time_slot}-${activity.name}`}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: aIdx * 0.08 }}
                    className="rounded-2xl overflow-hidden flex-shrink-0"
                    style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}`, minWidth: "270px", width: "270px", scrollSnapAlign: "start", boxShadow: theme.cardShadow, transition: "background 0.3s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.activityCardHoverBorder)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.activityCardBorder)}
                  >
                    <div className="relative" style={{ height: "155px", overflow: "hidden" }}>
                      <img src={activityImageSeed(activity.name)} alt={activity.name} className="w-full h-full object-cover"
                        style={{ transition: "transform 0.4s" }}
                        onMouseEnter={(e) => ((e.target as HTMLElement).style.transform = "scale(1.05)")}
                        onMouseLeave={(e) => ((e.target as HTMLElement).style.transform = "scale(1)")}
                      />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,22,40,0.7) 0%, transparent 60%)" }} />
                      <div className="absolute top-3 left-3">
                        <span className="px-2 py-1 rounded-full text-xs"
                          style={{ background: "rgba(30,75,136,0.7)", border: "1px solid rgba(88,171,212,0.5)", color: "#B5D9EE", fontFamily: "system-ui, sans-serif" }}>
                          {activity.type}
                        </span>
                      </div>
                      <div className="absolute bottom-2 right-3">
                        <span style={{ color: "#B5D9EE", fontSize: "0.7rem", fontFamily: "system-ui, sans-serif" }}>{activity.duration}</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 style={{ fontFamily: "'DM Serif Display', serif", color: theme.activityHeading, fontSize: "1rem", lineHeight: 1.2 }}>{activity.name}</h3>
                        <span style={{ color: theme.accentSky, fontSize: "0.72rem", fontFamily: "system-ui, sans-serif", flexShrink: 0, paddingTop: "2px" }}>{activity.time}</span>
                      </div>
                      <p style={{ color: theme.activityBody, fontSize: "0.8rem", lineHeight: "1.5", fontFamily: "system-ui, sans-serif" }}>{activity.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 mb-4">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.4rem" }}>Explore Alternatives</h2>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowAlternatives((s) => !s)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all"
              style={{
                background: showAlternatives ? theme.optionBgSelected : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
                border: `1px solid ${theme.border}`,
                color: "#FFFFFF",
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.88rem",
                fontWeight: 500,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                <path d="M2 7.5h11M9 4l3.5 3.5L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {showAlternatives ? "Hide" : "Suggest Alternatives"}
            </motion.button>
          </div>

          <AnimatePresence>
            {showAlternatives && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }} className="overflow-hidden"
              >
                <div
                  className="md:grid md:grid-cols-3 md:gap-5"
                  style={{ display: "flex", overflowX: "auto", gap: "12px", paddingBottom: "8px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
                >
                  {alternatives.map((alt, i) => (
                    <motion.div
                      key={alt.destination}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                      className="rounded-2xl overflow-hidden cursor-pointer flex-shrink-0"
                      style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}`, minWidth: "260px", width: "260px", scrollSnapAlign: "start", boxShadow: theme.cardShadow, transition: "background 0.3s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.activityCardHoverBorder)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.activityCardBorder)}
                    >
                      <div className="relative" style={{ height: "130px" }}>
                        <img src={alt.img} alt={alt.destination} className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${alt.destination}/400/240`; }} />
                        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,22,40,0.75) 0%, transparent 55%)" }} />
                        <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs"
                          style={{ background: "rgba(30,75,136,0.85)", border: "1px solid rgba(88,171,212,0.3)", color: "#58ABD4", fontFamily: "system-ui, sans-serif" }}>
                          {alt.match} match
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 style={{ fontFamily: "'DM Serif Display', serif", color: theme.activityHeading, fontSize: "1rem", marginBottom: "0.2rem" }}>{alt.destination}</h3>
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
                          <span style={{ color: theme.faint, fontSize: "0.72rem", fontFamily: "system-ui, sans-serif" }}>{alt.budget}</span>
                          <button className="px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all"
                            style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, color: "#fff", border: "none", fontFamily: "system-ui, sans-serif" }}>
                            Explore
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
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
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-5 flex items-center gap-2 px-4 py-3 rounded-full cursor-pointer shadow-xl z-30"
        style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, border: `1px solid ${theme.border}`, color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: "0.88rem", fontWeight: 500, boxShadow: "0 8px 30px rgba(30,75,136,0.35)" }}
      >
        <svg width="16" height="16" viewBox="0 0 15 15" fill="none">
          <path d="M2 2h11v9H8l-3 3v-3H2V2z" stroke="#58ABD4" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">Ask AI</span>
        <span className="sm:hidden">AI</span>
      </motion.button>

      <ChatbotSidebar isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
