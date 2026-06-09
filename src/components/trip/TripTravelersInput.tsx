import { Minus, Plus } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";

type TravelersValue = { adults: number; children: number };

type TripTravelersInputProps = {
  value: TravelersValue;
  onChange: (value: TravelersValue) => void;
};

type RowProps = {
  label: string;
  hint: string;
  count: number;
  min: number;
  max: number;
  onAdjust: (delta: number) => void;
};

function TravelerRow({ label, hint, count, min, max, onAdjust }: RowProps) {
  const { theme } = useTheme();
  const atMin = count <= min;
  const atMax = count >= max;

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
      style={{
        background: theme.optionBg,
        border: `1px solid ${theme.optionBorder}`,
      }}
    >
      <div>
        <p style={{ color: theme.heading, fontWeight: 500, fontSize: "0.95rem", fontFamily: "system-ui, sans-serif" }}>
          {label}
        </p>
        <p style={{ color: theme.muted, fontSize: "0.75rem", fontFamily: "system-ui, sans-serif" }}>{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onAdjust(-1)}
          disabled={atMin}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity"
          style={{
            background: theme.progressTrack,
            border: `1px solid ${theme.border}`,
            color: theme.body,
            opacity: atMin ? 0.4 : 1,
            cursor: atMin ? "not-allowed" : "pointer",
          }}
          aria-label={`Decrease ${label}`}
        >
          <Minus size={16} />
        </button>
        <span
          className="w-8 text-center tabular-nums"
          style={{ color: theme.heading, fontWeight: 600, fontSize: "1.1rem", fontFamily: "system-ui, sans-serif" }}
        >
          {count}
        </span>
        <button
          type="button"
          onClick={() => onAdjust(1)}
          disabled={atMax}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity"
          style={{
            background: theme.accentDeep,
            border: `1px solid ${theme.border}`,
            color: "#FFFFFF",
            opacity: atMax ? 0.4 : 1,
            cursor: atMax ? "not-allowed" : "pointer",
          }}
          aria-label={`Increase ${label}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export default function TripTravelersInput({ value, onChange }: TripTravelersInputProps) {
  function adjust(field: keyof TravelersValue, delta: number, min: number, max: number) {
    onChange({ ...value, [field]: Math.min(max, Math.max(min, value[field] + delta)) });
  }

  return (
    <div className="space-y-3">
      <TravelerRow
        label="Adults"
        hint="Ages 13+"
        count={value.adults}
        min={1}
        max={20}
        onAdjust={(d) => adjust("adults", d, 1, 20)}
      />
      <TravelerRow
        label="Children"
        hint="Ages 0–12"
        count={value.children}
        min={0}
        max={10}
        onAdjust={(d) => adjust("children", d, 0, 10)}
      />
    </div>
  );
}
