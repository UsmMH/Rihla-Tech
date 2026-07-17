import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import PlanningBackHeader, { PLANNING_HEADER_HEIGHT_PX } from "@/components/layout/PlanningBackHeader";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import type { AppTab } from "@/lib/navigation";
import { selectDestination, suggestDestinations, type DestinationSuggestion } from "@/lib/trips";

type DestinationPickerPageProps = {
  tripPlanId: number;
  onComplete: () => void;
  onBack: () => void;
  onNavigate?: (tab: AppTab) => void;
};

export default function DestinationPickerPage({ tripPlanId, onComplete, onBack }: DestinationPickerPageProps) {
  const { theme } = useTheme();
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSampleNotice, setShowSampleNotice] = useState(false);

  useEffect(() => {
    suggestDestinations(tripPlanId)
      .then((result) => {
        setSuggestions(result.suggestions);
        setShowSampleNotice(result.source === "mock");
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load destination suggestions");
      })
      .finally(() => setLoading(false));
  }, [tripPlanId]);

  async function handleSelect(city: string, country: string) {
    const destination = `${city}, ${country}`;
    setSelecting(destination);
    setError(null);
    try {
      await selectDestination(tripPlanId, destination);
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Failed to save destination");
      setSelecting(null);
    }
  }

  return (
    <div style={{ background: theme.pageBg, minHeight: "100svh" }}>
      <PlanningBackHeader onBack={onBack} />

      <div
        className="flex flex-col items-center px-4"
        style={{ paddingTop: PLANNING_HEADER_HEIGHT_PX + 16, paddingBottom: "2rem" }}
      >
        <div className="w-full max-w-2xl pt-4">
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.5rem, 5vw, 2rem)", color: theme.heading, marginBottom: "0.5rem" }}>
            Pick your destination
          </h1>
          <p style={{ color: theme.muted, marginBottom: "1.5rem", fontFamily: "system-ui, sans-serif", fontSize: "0.95rem" }}>
            Based on your preferences, we suggest these cities for your trip.
          </p>

          {loading && (
            <p style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>Finding perfect destinations...</p>
          )}

          {showSampleNotice && (
            <p
              className="mb-4 rounded-lg px-3 py-2 text-sm"
              style={{
                background: "rgba(234, 179, 8, 0.12)",
                border: "1px solid rgba(234, 179, 8, 0.4)",
                color: theme.body,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Showing sample destinations — personalized suggestions are temporarily unavailable.
            </p>
          )}

          {error && !loading && (
            <p style={{ color: "#ef4444", marginBottom: "1rem", fontFamily: "system-ui, sans-serif" }}>{error}</p>
          )}

          <div className="grid gap-4">
            {suggestions.map((s, i) => {
              const label = `${s.city}, ${s.country}`;
              const isSelecting = selecting === label;
              return (
                <motion.button
                  key={label}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => handleSelect(s.city, s.country)}
                  disabled={Boolean(selecting)}
                  className="text-left rounded-2xl p-5 md:p-6 w-full transition-all"
                  style={{
                    background: theme.cardBgGradient,
                    border: `1.5px solid ${isSelecting ? theme.accentSky : theme.cardBorder}`,
                    boxShadow: theme.cardShadow,
                    cursor: selecting ? "not-allowed" : "pointer",
                    opacity: selecting && !isSelecting ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.35rem", color: theme.heading, marginBottom: "0.35rem" }}>
                        {s.city}
                      </h2>
                      <p style={{ color: theme.accentSky, fontSize: "0.85rem", marginBottom: "0.5rem", fontFamily: "system-ui, sans-serif" }}>
                        {s.country}
                      </p>
                      <p style={{ color: theme.body, fontSize: "0.9rem", lineHeight: 1.5, fontFamily: "system-ui, sans-serif" }}>
                        {s.blurb}
                      </p>
                    </div>
                    <span style={{ color: theme.accentMid, fontSize: "1.5rem" }}>→</span>
                  </div>
                  {isSelecting && (
                    <p style={{ color: theme.muted, fontSize: "0.8rem", marginTop: "0.75rem", fontFamily: "system-ui, sans-serif" }}>
                      Saving your choice...
                    </p>
                  )}
                </motion.button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onBack}
            disabled={Boolean(selecting)}
            className="mt-6 px-4 py-3 rounded-xl"
            style={{
              background: theme.optionBg,
              border: `1px solid ${theme.border}`,
              color: theme.body,
              fontFamily: "system-ui, sans-serif",
              opacity: selecting ? 0.6 : 1,
            }}
          >
            Back to preferences
          </button>
        </div>
      </div>
    </div>
  );
}
