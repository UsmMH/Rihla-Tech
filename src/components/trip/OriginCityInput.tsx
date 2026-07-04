import { useEffect, useState } from "react";

import { useTheme } from "@/contexts/ThemeContext";
import { searchPlaces, type PlaceSearchResult } from "@/lib/places";

type OriginCityInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestionsTitle?: string;
};

export default function OriginCityInput({
  value,
  onChange,
  placeholder,
  suggestionsTitle = "SUGGESTED CITIES",
}: OriginCityInputProps) {
  const { theme } = useTheme();
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setQuery(value);
    setConfirmed(false);
  }, [value]);

  useEffect(() => {
    if (confirmed && query.trim() === value.trim()) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    if (query.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      searchPlaces(query)
        .then((results) => {
          setSuggestions(results);
          setOpen(results.length > 0);
        })
        .catch(() => {
          setSuggestions([]);
          setOpen(false);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, value, confirmed]);

  function handleSelect(item: PlaceSearchResult) {
    setConfirmed(true);
    setQuery(item.label);
    onChange(item.label);
    setOpen(false);
    setSuggestions([]);
    setLoading(false);
  }

  const showSuggestions = open && suggestions.length > 0;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setConfirmed(false);
          setQuery(e.target.value);
          onChange(e.target.value);
          if (e.target.value.trim().length >= 2) {
            setOpen(true);
          }
        }}
        onFocus={() => {
          if (!confirmed && suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder ?? "Search your departure city..."}
        className="w-full rounded-xl px-4 py-3 outline-none"
        style={{
          background: theme.optionBg,
          border: `1.5px solid ${showSuggestions ? theme.accentSky : theme.optionBorder}`,
          color: theme.body,
          fontFamily: "system-ui, sans-serif",
          transition: "border-color 0.2s",
        }}
      />

      {loading && (
        <p className="mt-2 text-xs" style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>
          Searching cities...
        </p>
      )}

      {showSuggestions && (
        <div
          className="mt-3 rounded-xl overflow-hidden"
          style={{
            background: theme.optionBg,
            border: `1px solid ${theme.border}`,
            boxShadow: theme.cardShadow,
          }}
        >
          <div className="px-3 py-2" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <span style={{ color: theme.muted, fontSize: "0.72rem", fontFamily: "system-ui, sans-serif", letterSpacing: "0.04em" }}>
              {suggestionsTitle}
            </span>
          </div>
          <ul className="max-h-48 overflow-y-auto" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {suggestions.map((item) => (
              <li key={`${item.label}-${item.latitude}-${item.longitude}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-4 py-3 transition-colors"
                  style={{
                    color: theme.body,
                    fontFamily: "system-ui, sans-serif",
                    fontSize: "0.88rem",
                    borderBottom: `1px solid ${theme.border}`,
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.optionBgSelected;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ color: theme.accentSky, marginRight: 8 }}>📍</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && query.trim().length >= 2 && suggestions.length === 0 && open && !confirmed && (
        <p className="mt-2 text-xs" style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>
          No matches — you can still type your city manually.
        </p>
      )}
    </div>
  );
}
