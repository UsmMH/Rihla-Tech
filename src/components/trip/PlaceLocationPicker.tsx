import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Search, X } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import { searchActivityPlaces, type ActivityPlaceSearchResult } from "@/lib/places";
import { updatePlaceLocation, type TripDetail } from "@/lib/trips";

type PlaceLocationPickerProps = {
  open: boolean;
  onClose: () => void;
  tripPlanId: number;
  placeId: number;
  activityName: string;
  onSaved: (trip: TripDetail) => void;
};

export default function PlaceLocationPicker({
  open,
  onClose,
  tripPlanId,
  placeId,
  activityName,
  onSaved,
}: PlaceLocationPickerProps) {
  const { theme } = useTheme();
  const [query, setQuery] = useState(activityName);
  const [results, setResults] = useState<ActivityPlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuery(activityName);
      setResults([]);
      setError(null);
    }
  }, [open, activityName, placeId]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      searchActivityPlaces(query, tripPlanId)
        .then(setResults)
        .catch((err: unknown) => {
          setResults([]);
          setError(err instanceof ApiError ? err.message : "Search failed");
        })
        .finally(() => setLoading(false));
    }, 320);

    return () => window.clearTimeout(timer);
  }, [open, query, tripPlanId]);

  async function selectResult(result: ActivityPlaceSearchResult) {
    setSaving(true);
    setError(null);
    try {
      const trip = await updatePlaceLocation(tripPlanId, placeId, {
        label: result.label,
        latitude: result.latitude,
        longitude: result.longitude,
        mapbox_id: result.mapbox_id,
      });
      onSaved(trip);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Could not save location");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: theme.pageBg, border: `1px solid ${theme.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${theme.border}` }}
            >
              <div className="flex items-center gap-2">
                <MapPin size={18} style={{ color: theme.accentSky }} />
                <span style={{ fontFamily: "system-ui, sans-serif", fontWeight: 600, color: theme.heading }}>
                  Set map location
                </span>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" style={{ color: theme.muted }}>
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              <p
                className="mb-3 text-sm"
                style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", lineHeight: 1.4 }}
              >
                Search for the exact venue to pin{" "}
                <strong style={{ color: theme.body }}>{activityName}</strong> on your map.
              </p>

              <div className="relative mb-3">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: theme.muted }}
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a place..."
                  autoFocus
                  className="w-full rounded-xl py-2.5 pl-9 pr-3 outline-none text-sm"
                  style={{
                    background: theme.optionBg,
                    border: `1.5px solid ${theme.border}`,
                    color: theme.body,
                    fontFamily: "system-ui, sans-serif",
                  }}
                />
              </div>

              {error && (
                <p className="mb-2 text-sm" style={{ color: "#e57373", fontFamily: "system-ui, sans-serif" }}>
                  {error}
                </p>
              )}

              <div className="max-h-64 overflow-y-auto rounded-xl" style={{ border: `1px solid ${theme.borderFaint}` }}>
                {loading && (
                  <p className="p-4 text-sm text-center" style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>
                    Searching...
                  </p>
                )}
                {!loading && query.trim().length < 2 && (
                  <p className="p-4 text-sm text-center" style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>
                    Type at least 2 characters
                  </p>
                )}
                {!loading && query.trim().length >= 2 && results.length === 0 && (
                  <p className="p-4 text-sm text-center" style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>
                    No places found — try a shorter name or nearby landmark
                  </p>
                )}
                {results.map((result) => (
                  <button
                    key={`${result.latitude}-${result.longitude}-${result.label}`}
                    type="button"
                    disabled={saving}
                    onClick={() => void selectResult(result)}
                    className="w-full text-left px-4 py-3 transition-colors disabled:opacity-60"
                    style={{
                      borderBottom: `1px solid ${theme.borderFaint}`,
                      fontFamily: "system-ui, sans-serif",
                      color: theme.body,
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = theme.optionBg;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div className="text-sm font-medium">{result.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: theme.muted }}>
                      {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
