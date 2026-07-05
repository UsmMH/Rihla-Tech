import { useEffect, useRef } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayButton, type DayButtonProps } from "react-day-picker";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { useTheme } from "@/contexts/ThemeContext";

type TripDateRangePickerProps = {
  value: { start: string; end: string };
  onChange: (value: { start: string; end: string }) => void;
};

function parseDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function ThemedDayButton({ day, modifiers, ...props }: DayButtonProps) {
  const { theme } = useTheme();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isEndpoint = modifiers.range_start || modifiers.range_end;
  const isMiddle = modifiers.range_middle;
  const isSelected = modifiers.selected;
  const isToday = modifiers.today;

  let background = "transparent";
  let color = theme.optionLabel;
  let fontWeight: number = 400;
  let boxShadow = "none";

  if (isEndpoint) {
    background = `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`;
    color = "#FFFFFF";
    fontWeight = 600;
    boxShadow = `0 2px 8px rgba(30, 75, 136, 0.45)`;
  } else if (isMiddle) {
    background = theme.optionBgSelected;
    color = theme.optionLabelSelected;
  } else if (isToday && !isSelected) {
    color = theme.accentSky;
    boxShadow = `inset 0 0 0 1.5px ${theme.accentSky}`;
  }

  if (modifiers.outside) color = theme.faint;
  if (modifiers.disabled) color = theme.faint;

  return (
    <button
      ref={ref}
      type="button"
      {...props}
      style={{
        width: "var(--cell-size)",
        height: "var(--cell-size)",
        minWidth: "var(--cell-size)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: isMiddle ? 0 : "10px",
        background,
        color,
        fontWeight,
        boxShadow,
        opacity: modifiers.disabled ? 0.35 : 1,
        cursor: modifiers.disabled ? "not-allowed" : "pointer",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.875rem",
        transition: "background 0.15s, color 0.15s",
      }}
    />
  );
}

function calendarClassNames() {
  const navBtn =
    "!absolute !top-0 !z-10 !h-10 !w-10 !rounded-lg !flex !items-center !justify-center !p-0 hover:!opacity-80 !bg-transparent !border-0 !shadow-none";

  return {
    months: "w-full flex justify-center",
    month: "relative w-full max-w-[272px]",
    month_caption: "relative flex items-center justify-center h-10 mb-1 w-full",
    caption_label: "text-[0.95rem] font-semibold tracking-wide pointer-events-none",
    button_previous: `${navBtn} !left-0`,
    button_next: `${navBtn} !right-0`,
    weekdays: "flex w-full",
    weekday: "flex-1 text-center text-[0.7rem] font-medium uppercase tracking-wider opacity-70",
    week: "flex w-full mt-0.5",
    day: "p-0 text-center",
    range_start: "rounded-l-lg",
    range_end: "rounded-r-lg",
    range_middle: "rounded-none",
    today: "",
    outside: "opacity-50",
    disabled: "opacity-30",
  };
}

export default function TripDateRangePicker({ value, onChange }: TripDateRangePickerProps) {
  const { theme } = useTheme();

  const range: DateRange | undefined = value.start
    ? {
        from: parseDate(value.start),
        to: value.end ? parseDate(value.end) : undefined,
      }
    : undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function handleSelect(next: DateRange | undefined) {
    onChange({
      start: next?.from ? format(next.from, "yyyy-MM-dd") : "",
      end: next?.to ? format(next.to, "yyyy-MM-dd") : "",
    });
  }

  const nights =
    value.start && value.end
      ? differenceInCalendarDays(parseDate(value.end), parseDate(value.start))
      : null;

  const summary =
    value.start && value.end
      ? `${format(parseDate(value.start), "MMM d")} – ${format(parseDate(value.end), "MMM d, yyyy")}`
      : value.start
        ? `${format(parseDate(value.start), "MMM d, yyyy")} — select your return date`
        : "Select your departure and return dates";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: theme.optionBg,
        border: `1px solid ${theme.optionBorder}`,
      }}
    >
      <div
        className="px-4 py-3 text-center"
        style={{
          borderBottom: `1px solid ${theme.optionBorder}`,
          background: `linear-gradient(180deg, ${theme.isDark ? "rgba(88,171,212,0.06)" : "rgba(30,75,136,0.04)"} 0%, transparent 100%)`,
        }}
      >
        <p style={{ color: theme.heading, fontWeight: 600, fontSize: "0.95rem", fontFamily: "system-ui, sans-serif" }}>
          {summary}
        </p>
        {nights !== null && nights >= 0 && (
          <p style={{ color: nights > 14 ? "#ef4444" : theme.accentSky, fontSize: "0.8rem", marginTop: "0.25rem", fontFamily: "system-ui, sans-serif" }}>
            {nights === 0 ? "Same-day trip" : `${nights} night${nights === 1 ? "" : "s"}`}
            {nights > 14 ? " — max 14 nights" : ""}
          </p>
        )}
      </div>

      <div
        className="flex justify-center px-2 py-3"
        style={{ color: theme.heading }}
      >
        <Calendar
          mode="range"
          navLayout="around"
          selected={range}
          onSelect={handleSelect}
          disabled={{ before: today }}
          numberOfMonths={1}
          defaultMonth={range?.from ?? today}
          showOutsideDays
          className="bg-transparent p-0 w-full [--cell-size:2.4rem]"
          classNames={calendarClassNames()}
          components={{
            DayButton: ThemedDayButton,
            Chevron: ({ orientation }) =>
              orientation === "left" ? (
                <ChevronLeft size={18} color={theme.accentSky} />
              ) : (
                <ChevronRight size={18} color={theme.accentSky} />
              ),
          }}
        />
      </div>
    </div>
  );
}
