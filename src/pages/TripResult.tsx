import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, ChevronDown, ChevronLeft, ExternalLink, MapPin, Plane, Route, Share2, X } from "lucide-react";
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
import { enrichTripPlaces, generateTrip, getTrip, getTripFlights, getTripHotels, saveLastTripId, type DayItinerary, type FlightOffer, type FlightsResult, type HotelsResult, type TripActivity, type TripDetail } from "@/lib/trips";
import { shareTrip, unshareTrip } from "@/lib/community";
import type { AppTab } from "@/lib/navigation";

type TripResultProps = {
  tripPlanId: number;
  onBack: () => void;
  onNavigate?: (tab: AppTab) => void;
};

function sourceLabel(source: string): string {
  if (source === "gemini") return "Gemini";
  if (source === "openrouter") return "OpenRouter";
  if (source === "openai") return "OpenAI";
  if (source === "duffel") return "Duffel";
  return "Demo";
}

function stopsLabel(stops: number): string {
  if (stops <= 0) return "Nonstop";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

function starsLabel(count: number): string {
  return "★".repeat(Math.max(1, Math.min(count, 5)));
}

function flightsSummary(flights: FlightsResult): string {
  const count = flights.offers.length;
  if (count === 0) return "No options found";
  const prices = flights.offers
    .map((o) => o.price_amount)
    .filter((p): p is number => p != null);
  const cheapest = prices.length ? Math.min(...prices) : null;
  const prefix = count === 1 ? "1 option" : `${count} options`;
  return cheapest != null ? `${prefix} · from ${flights.offers[0]?.currency ?? "USD"} ${cheapest}` : prefix;
}

function hotelsSummary(hotels: HotelsResult): string {
  const count = hotels.hotels.length;
  if (count === 0) return "No stays found";
  const cheapest = hotels.hotels[0]?.price_per_night ?? "";
  const prefix = count === 1 ? "1 stay" : `${count} stays`;
  return cheapest ? `${prefix} · ${cheapest}` : prefix;
}

function daySummary(dayPlan: DayItinerary): string {
  const count = dayPlan.activities.length;
  const activities = count === 1 ? "1 activity" : `${count} activities`;
  return `${dayPlan.theme} · ${activities}`;
}

type CollapsiblePanelProps = {
  icon: ReactNode;
  title: string;
  summary: string;
  loading?: boolean;
  externalUrl?: string | null;
  externalLabel?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

function CollapsiblePanel({
  icon,
  title,
  summary,
  loading = false,
  externalUrl,
  externalLabel,
  defaultOpen = false,
  children,
}: CollapsiblePanelProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: theme.isDark ? "rgba(255,255,255,0.03)" : theme.sectionAlt, border: `1px solid ${theme.border}` }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer min-h-[52px]"
        style={{ background: "none", border: "none" }}
        aria-expanded={open}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="flex-1 min-w-0">
          <span
            className="block"
            style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.05rem", lineHeight: 1.2 }}
          >
            {title}
          </span>
          <span
            className="block truncate mt-0.5"
            style={{ color: theme.muted, fontSize: "0.78rem", fontFamily: "system-ui, sans-serif" }}
          >
            {loading ? "Loading…" : summary}
          </span>
        </span>
        <ChevronDown
          size={18}
          color={theme.muted}
          className="flex-shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0" style={{ borderTop: `1px solid ${theme.border}` }}>
              {externalUrl && externalLabel && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mb-3 mt-3 text-sm"
                  style={{ color: theme.accentSky, fontFamily: "system-ui, sans-serif", fontWeight: 600, textDecoration: "none" }}
                >
                  {externalLabel}
                  <ExternalLink size={12} />
                </a>
              )}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FlightOfferCard({ offer, theme }: { offer: FlightOffer; theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <div
      className="rounded-xl p-3.5 flex flex-col flex-shrink-0 snap-start w-[min(85vw,280px)]"
      style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p style={{ fontFamily: "'DM Serif Display', serif", color: theme.activityHeading, fontSize: "0.95rem", lineHeight: 1.2 }}>
          {offer.airline}
        </p>
        <span style={{ color: theme.accentSky, fontWeight: 700, fontSize: "0.85rem", fontFamily: "system-ui, sans-serif", flexShrink: 0 }}>
          {offer.price}
        </span>
      </div>
      <p style={{ color: theme.muted, fontSize: "0.72rem", fontFamily: "system-ui, sans-serif", marginBottom: 8 }}>
        {offer.outbound.origin_code || offer.outbound.origin} → {offer.outbound.destination_code || offer.outbound.destination}
        {offer.inbound ? " · round trip" : ""}
      </p>
      <p className="flex-1" style={{ color: theme.activityBody, fontSize: "0.75rem", fontFamily: "system-ui, sans-serif", lineHeight: 1.45 }}>
        {offer.outbound.duration ?? "—"} · {stopsLabel(offer.outbound.stops)}
      </p>
      {offer.booking_url && (
        <a
          href={offer.booking_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center justify-center gap-1 w-full px-2 py-2 rounded-lg text-xs"
          style={{
            background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
            color: "#fff",
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Google Flights
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

function HorizontalCardRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory -mx-1 px-1">
      {children}
    </div>
  );
}

function DayActivityCard({
  activity,
  dayNumber,
  destination,
  previousActivity,
  theme,
}: {
  activity: TripActivity;
  dayNumber: number;
  destination: string;
  previousActivity: TripActivity | null;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const typeStyle = getActivityTypeStyle(activity.type);
  const TypeIcon = typeStyle.icon;
  const dayColor = dayPinColor(dayNumber);
  const googleMapsUrl = googleMapsSearchUrl(activity.name, destination);
  const legGoogleUrl = previousActivity
    ? googleMapsLegUrl(previousActivity.name, activity.name, destination)
    : null;

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col flex-shrink-0 snap-start w-[min(85vw,280px)]"
      style={{
        background: theme.activityCardBg,
        border: `1px solid ${theme.activityCardBorder}`,
        borderTop: `3px solid ${dayColor}`,
      }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ background: typeStyle.gradient }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <TypeIcon size={14} color="#fff" strokeWidth={2} />
          <span className="truncate" style={{ color: "#fff", fontSize: "0.7rem", fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>
            {activity.type}
          </span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.68rem", fontFamily: "system-ui, sans-serif", flexShrink: 0 }}>
          {activity.time}
        </span>
      </div>
      <div className="p-3 flex flex-col flex-1 min-h-0">
        <h3 style={{ fontFamily: "'DM Serif Display', serif", color: theme.activityHeading, fontSize: "0.92rem", lineHeight: 1.25, marginBottom: 6 }}>
          {activity.name}
        </h3>
        <p
          className="flex-1 line-clamp-3 mb-3"
          style={{ color: theme.activityBody, fontSize: "0.75rem", lineHeight: 1.45, fontFamily: "system-ui, sans-serif" }}
        >
          {activity.desc}
        </p>
        <div className="mt-auto flex flex-col gap-1.5">
          {legGoogleUrl && (
            <a
              href={legGoogleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded-lg text-xs"
              style={{
                background: theme.isDark ? "rgba(88,171,212,0.1)" : "rgba(88,171,212,0.12)",
                border: `1px solid ${theme.accentSky}44`,
                color: theme.accentSky,
                fontFamily: "system-ui, sans-serif",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <Route size={12} strokeWidth={2} />
              From previous
            </a>
          )}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 w-full px-2 py-2 rounded-lg text-xs"
            style={{
              background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
              color: "#fff",
              fontFamily: "system-ui, sans-serif",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <MapPin size={12} strokeWidth={2} />
            Maps
            <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function TripResult({ tripPlanId, onBack, onNavigate }: TripResultProps) {
  const { theme } = useTheme();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialInput, setChatInitialInput] = useState("");
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [flights, setFlights] = useState<FlightsResult | null>(null);
  const [hotels, setHotels] = useState<HotelsResult | null>(null);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCaption, setShareCaption] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const enrichStarted = useRef(false);

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
    enrichStarted.current = false;
    saveLastTripId(tripPlanId);
    loadItinerary();
  }, [loadItinerary, tripPlanId]);

  useEffect(() => {
    if (!trip) return;

    if (trip.trip_plan.include_flights) {
      setFlightsLoading(true);
      getTripFlights(tripPlanId)
        .then(setFlights)
        .catch(() => setFlights(null))
        .finally(() => setFlightsLoading(false));
    } else {
      setFlights(null);
    }

    if (trip.trip_plan.include_hotels) {
      setHotelsLoading(true);
      getTripHotels(tripPlanId)
        .then(setHotels)
        .catch(() => setHotels(null))
        .finally(() => setHotelsLoading(false));
    } else {
      setHotels(null);
    }
  }, [trip, tripPlanId]);

  useEffect(() => {
    if (!trip?.geocoding_configured || enrichStarted.current) return;
    const activityCount = trip.itinerary.reduce((sum, day) => sum + day.activities.length, 0);
    if (activityCount === 0 || trip.places_geocoded >= activityCount) return;

    enrichStarted.current = true;
    enrichTripPlaces(tripPlanId)
      .then(setTrip)
      .catch(() => {});
  }, [trip, tripPlanId]);

  async function handleShare() {
    if (!trip || shareBusy) return;
    setShareBusy(true);
    try {
      const result = await shareTrip(tripPlanId, shareCaption || undefined);
      setTrip({ ...trip, is_shared: result.is_shared, share_caption: result.share_caption });
      setShareOpen(false);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Failed to share trip");
    } finally {
      setShareBusy(false);
    }
  }

  async function handleUnshare() {
    if (!trip || shareBusy) return;
    setShareBusy(true);
    try {
      const result = await unshareTrip(tripPlanId);
      setTrip({ ...trip, is_shared: result.is_shared, share_caption: result.share_caption });
      setShareOpen(false);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Failed to unshare trip");
    } finally {
      setShareBusy(false);
    }
  }

  function openShareModal() {
    setShareCaption(trip?.share_caption ?? "");
    setShareOpen(true);
  }

  if (loading) {
    return (
      <div style={{ background: theme.pageBg, minHeight: "100vh" }}>
        <Navbar variant="app" onHome={onBack} onNavigate={onNavigate} />
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
        <Navbar variant="app" onHome={onBack} onNavigate={onNavigate} />
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
              onClick={onBack}
              className="px-4 py-2.5 rounded-xl"
              style={{ background: theme.optionBg, border: `1px solid ${theme.border}`, color: theme.body, fontFamily: "system-ui, sans-serif" }}
            >
              My Trips
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", transition: "background 0.3s" }}>
      <Navbar variant="app" onHome={onBack} onNavigate={onNavigate} />

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
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 mb-5 cursor-pointer min-h-[40px]"
            style={{ background: "none", border: "none", color: theme.accentSky, fontFamily: "system-ui, sans-serif", fontSize: "0.88rem", fontWeight: 500, padding: 0 }}
          >
            <ChevronLeft size={18} strokeWidth={2} />
            My Trips
          </button>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div>
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
                onClick={openShareModal}
                className="inline-flex items-center justify-center gap-2 w-full md:w-auto px-4 py-3 md:py-2.5 rounded-xl cursor-pointer whitespace-nowrap flex-shrink-0 min-h-[44px]"
                style={{
                  background: trip.is_shared ? "rgba(88, 171, 212, 0.12)" : theme.optionBg,
                  border: `1px solid ${trip.is_shared ? theme.accentSky : theme.border}`,
                  color: trip.is_shared ? theme.accentSky : theme.body,
                  fontFamily: "system-ui, sans-serif",
                  fontSize: "0.88rem",
                  fontWeight: 500,
                  lineHeight: 1,
                }}
              >
                <Share2 size={16} />
                {trip.is_shared ? "Shared" : "Share"}
              </motion.button>
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
        {(trip.trip_plan.include_flights || trip.trip_plan.include_hotels) && (
          <div className="space-y-3 mb-8">
            {trip.trip_plan.include_flights && (
              <CollapsiblePanel
                icon={<Plane size={18} style={{ color: theme.accentSky }} />}
                title="Flights"
                summary={flights ? flightsSummary(flights) : "Searching…"}
                loading={flightsLoading}
                externalUrl={flights?.search_url}
                externalLabel="Search all on Google Flights"
              >
                {flights && (
                  <>
                    {flights.source === "mock" && flights.fallback_reason && (
                      <p className="mb-3 text-xs" style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>
                        Demo prices — {flights.fallback_reason}
                      </p>
                    )}
                    {flights.source === "duffel" && (
                      <p className="mb-3 text-xs" style={{ color: theme.accentSky, fontFamily: "system-ui, sans-serif" }}>
                        Live sandbox prices via Duffel
                      </p>
                    )}
                    <HorizontalCardRow>
                      {flights.offers.map((offer) => (
                        <FlightOfferCard key={offer.id} offer={offer} theme={theme} />
                      ))}
                    </HorizontalCardRow>
                  </>
                )}
              </CollapsiblePanel>
            )}

            {trip.trip_plan.include_hotels && (
              <CollapsiblePanel
                icon={<Building2 size={18} style={{ color: theme.accentSky }} />}
                title="Hotels"
                summary={hotels ? hotelsSummary(hotels) : "Finding stays…"}
                loading={hotelsLoading}
                externalUrl={hotels?.search_url}
                externalLabel="Search all on Booking.com"
              >
                {hotels && (
                  <>
                    {hotels.check_in && hotels.check_out && (
                      <p className="mb-3 text-xs" style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>
                        {hotels.check_in} → {hotels.check_out}
                      </p>
                    )}
                    <HorizontalCardRow>
                      {hotels.hotels.map((hotel) => (
                        <div
                          key={hotel.id}
                          className="rounded-xl p-3.5 flex flex-col flex-shrink-0 snap-start w-[min(85vw,260px)]"
                          style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}` }}
                        >
                          <p style={{ color: theme.accentSky, fontSize: "0.68rem", fontFamily: "system-ui, sans-serif" }}>
                            {starsLabel(hotel.stars)} · {hotel.area}
                          </p>
                          <h3 style={{ fontFamily: "'DM Serif Display', serif", color: theme.activityHeading, fontSize: "0.92rem", lineHeight: 1.25, marginTop: 4 }}>
                            {hotel.name}
                          </h3>
                          <p style={{ color: theme.accentSky, fontWeight: 600, fontSize: "0.8rem", fontFamily: "system-ui, sans-serif", margin: "6px 0 8px" }}>
                            {hotel.price_per_night}
                          </p>
                          <a
                            href={hotel.booking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-auto inline-flex items-center justify-center gap-1 w-full px-2 py-2 rounded-lg text-xs"
                            style={{
                              background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
                              color: "#fff",
                              fontFamily: "system-ui, sans-serif",
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            Booking.com
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      ))}
                    </HorizontalCardRow>
                  </>
                )}
              </CollapsiblePanel>
            )}
          </div>
        )}

        <h2
          className="mb-6"
          style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.35rem" }}
        >
          Day-by-day itinerary
        </h2>

        <div className="space-y-3">
          {trip.itinerary.map((dayPlan) => {
            const dayActivityNames = dayPlan.activities.map((a) => a.name);
            const dayGoogleRoute = googleMapsDayRouteUrl(dayActivityNames, trip.destination);
            const routeTruncated = dayRouteExceedsWaypointLimit(dayActivityNames.length);

            return (
              <CollapsiblePanel
                key={dayPlan.day}
                defaultOpen={dayPlan.day === 1}
                icon={(
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{ background: theme.dayHeaderBg, color: "#fff", fontFamily: "'DM Serif Display', serif" }}
                  >
                    {dayPlan.day}
                  </div>
                )}
                title={`Day ${dayPlan.day}`}
                summary={daySummary(dayPlan)}
                externalUrl={dayGoogleRoute}
                externalLabel={routeTruncated ? "Day route (first 11 stops)" : "Day route in Google Maps"}
              >
                {routeTruncated && (
                  <p className="mb-3 text-xs" style={{ color: theme.faint, fontFamily: "system-ui, sans-serif" }}>
                    Route includes the first 11 stops — Google Maps waypoint limit.
                  </p>
                )}
                <HorizontalCardRow>
                  {dayPlan.activities.map((activity, aIdx) => (
                    <DayActivityCard
                      key={`${dayPlan.day}-${activity.time_slot}-${activity.name}`}
                      activity={activity}
                      dayNumber={dayPlan.day}
                      destination={trip.destination}
                      previousActivity={aIdx > 0 ? dayPlan.activities[aIdx - 1] : null}
                      theme={theme}
                    />
                  ))}
                </HorizontalCardRow>
              </CollapsiblePanel>
            );
          })}
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

      <AnimatePresence>
        {shareOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => !shareBusy && setShareOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-5"
              style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.2rem" }}>
                  {trip.is_shared ? "Update shared trip" : "Share to Community"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShareOpen(false)}
                  className="p-1 cursor-pointer"
                  style={{ background: "none", border: "none", color: theme.muted }}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="mb-4" style={{ color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.88rem", lineHeight: 1.5 }}>
                {trip.is_shared
                  ? "Your itinerary is visible on the Community feed. Add an optional caption or stop sharing."
                  : "Let other travelers discover your itinerary on the Community feed."}
              </p>
              <textarea
                value={shareCaption}
                onChange={(e) => setShareCaption(e.target.value)}
                placeholder="Optional caption (e.g. perfect long weekend in Kyoto)"
                rows={3}
                className="w-full px-4 py-3 rounded-xl mb-4 resize-none"
                style={{
                  background: theme.optionBg,
                  border: `1px solid ${theme.border}`,
                  color: theme.body,
                  fontFamily: "system-ui, sans-serif",
                  fontSize: "0.9rem",
                }}
              />
              <div className="flex flex-col sm:flex-row gap-2">
                {trip.is_shared && (
                  <button
                    type="button"
                    disabled={shareBusy}
                    onClick={handleUnshare}
                    className="flex-1 px-4 py-3 rounded-xl cursor-pointer min-h-[44px] disabled:opacity-60"
                    style={{
                      background: theme.optionBg,
                      border: `1px solid ${theme.border}`,
                      color: theme.body,
                      fontFamily: "system-ui, sans-serif",
                      fontSize: "0.9rem",
                    }}
                  >
                    Stop sharing
                  </button>
                )}
                <button
                  type="button"
                  disabled={shareBusy}
                  onClick={handleShare}
                  className="flex-1 px-4 py-3 rounded-xl cursor-pointer min-h-[44px] disabled:opacity-60"
                  style={{
                    background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
                    border: "none",
                    color: "#fff",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                  }}
                >
                  {shareBusy ? "Saving…" : trip.is_shared ? "Update" : "Share trip"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
