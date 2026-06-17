import { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

import { useTheme } from "@/contexts/ThemeContext";
import { fetchWalkingRoute } from "@/lib/mapDirections";
import { mapboxgl } from "@/lib/mapboxSetup";
import type { MapPin } from "@/lib/trips";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "";

const DAY_COLORS = ["#58ABD4", "#4CAF50", "#FFB74D", "#CE93D8", "#F06292", "#80CBC4", "#FFD54F"];
const TIME_SLOT_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };

type TripMapProps = {
  pins: MapPin[];
  geocodingConfigured: boolean;
  selectedPlaceId?: number | null;
  onSelectPin?: (placeId: number | null) => void;
  onAdjustPin?: (placeId: number) => void;
};

type DisplayPin = MapPin & {
  displayLat: number;
  displayLng: number;
  color: string;
};

function pinColor(dayNumber: number): string {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}

function offsetCoordinate(lat: number, lng: number, index: number, total: number): [number, number] {
  if (total <= 1) {
    return [lng, lat];
  }
  const angle = (2 * Math.PI * index) / total;
  const meters = 35 + total * 8;
  const dLat = (meters / 111_320) * Math.cos(angle);
  const dLng = (meters / (111_320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
  return [lng + dLng, lat + dLat];
}

function buildDisplayPins(pins: MapPin[]): DisplayPin[] {
  const safePins = pins.filter(
    (pin) => Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude),
  );

  const groups = new globalThis.Map<string, MapPin[]>();
  for (const pin of safePins) {
    const key = `${pin.latitude.toFixed(4)},${pin.longitude.toFixed(4)}`;
    const group = groups.get(key) ?? [];
    group.push(pin);
    groups.set(key, group);
  }

  const displayPins: DisplayPin[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        (a.day_number - b.day_number) ||
        (TIME_SLOT_ORDER[a.time_slot] ?? 0) - (TIME_SLOT_ORDER[b.time_slot] ?? 0),
    );
    sorted.forEach((pin, index) => {
      const [displayLng, displayLat] = offsetCoordinate(pin.latitude, pin.longitude, index, sorted.length);
      displayPins.push({
        ...pin,
        displayLat,
        displayLng,
        color: pinColor(pin.day_number),
      });
    });
  }

  return displayPins.sort(
    (a, b) =>
      a.day_number - b.day_number ||
      (TIME_SLOT_ORDER[a.time_slot] ?? 0) - (TIME_SLOT_ORDER[b.time_slot] ?? 0),
  );
}

function fitMapToPins(map: mapboxgl.Map, displayPins: DisplayPin[]) {
  if (displayPins.length === 0) {
    return;
  }

  const lngs = displayPins.map((p) => p.displayLng);
  const lats = displayPins.map((p) => p.displayLat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  if (minLng === maxLng && minLat === maxLat) {
    map.jumpTo({ center: [minLng, minLat], zoom: 13 });
    return;
  }

  map.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    { padding: 56, maxZoom: 14, duration: 0 },
  );
}

export default function TripMap({
  pins,
  geocodingConfigured,
  selectedPlaceId = null,
  onSelectPin,
  onAdjustPin,
}: TripMapProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const onSelectPinRef = useRef(onSelectPin);
  const onAdjustPinRef = useRef(onAdjustPin);
  const [mapError, setMapError] = useState<string | null>(null);

  onSelectPinRef.current = onSelectPin;
  onAdjustPinRef.current = onAdjustPin;

  const displayPins = useMemo(() => buildDisplayPins(pins ?? []), [pins]);
  const displayPinsRef = useRef(displayPins);
  displayPinsRef.current = displayPins;
  const pinSignature = useMemo(
    () => displayPins.map((p) => `${p.place_id}:${p.displayLat}:${p.displayLng}`).join("|"),
    [displayPins],
  );

  useEffect(() => {
    const container = containerRef.current;
    const pinsToShow = displayPinsRef.current;
    if (!container || !MAPBOX_TOKEN || pinsToShow.length === 0) {
      return;
    }

    let cancelled = false;
    setMapError(null);
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container,
      style: theme.isDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12",
      center: [pinsToShow[0].displayLng, pinsToShow[0].displayLat],
      zoom: 12,
      maxPitch: 0,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const clearMarkers = () => {
      popupRef.current?.remove();
      popupRef.current = null;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };

    const clearRouteLayers = () => {
      const style = map.getStyle();
      if (!style?.layers) {
        return;
      }
      for (const layer of style.layers) {
        if (layer.id.startsWith("day-route-line-")) {
          map.removeLayer(layer.id);
        }
      }
      if (style.sources) {
        for (const sourceId of Object.keys(style.sources)) {
          if (sourceId.startsWith("day-route-")) {
            map.removeSource(sourceId);
          }
        }
      }
    };

    const addPinsAndRoutes = async () => {
      if (cancelled) {
        return;
      }

      clearMarkers();
      clearRouteLayers();
      map.resize();
      fitMapToPins(map, pinsToShow);

      const byDay = new globalThis.Map<number, DisplayPin[]>();
      for (const pin of pinsToShow) {
        const dayPins = byDay.get(pin.day_number) ?? [];
        dayPins.push(pin);
        byDay.set(pin.day_number, dayPins);
      }

      for (const [day, dayPins] of byDay) {
        const sorted = [...dayPins].sort(
          (a, b) => (TIME_SLOT_ORDER[a.time_slot] ?? 0) - (TIME_SLOT_ORDER[b.time_slot] ?? 0),
        );
        if (sorted.length < 2) {
          continue;
        }

        const waypointCoords = sorted.map((p) => [p.displayLng, p.displayLat] as [number, number]);
        let lineCoords = waypointCoords;
        const routed = await fetchWalkingRoute(waypointCoords);
        if (routed) {
          lineCoords = routed;
        }

        if (cancelled) {
          return;
        }

        const sourceId = `day-route-${day}`;
        const layerId = `day-route-line-${day}`;
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }

        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: lineCoords,
            },
          },
        });

        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": pinColor(day),
            "line-width": 3,
            "line-opacity": 0.75,
          },
        });
      }

      for (const pin of pinsToShow) {
        const el = document.createElement("div");
        el.dataset.placeId = String(pin.place_id);
        el.style.width = "22px";
        el.style.height = "22px";
        el.style.borderRadius = "50%";
        el.style.background = pin.color;
        el.style.border = `2px solid ${theme.pageBg}`;
        el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)";
        el.style.cursor = "pointer";

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([pin.displayLng, pin.displayLat])
          .addTo(map);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectPinRef.current?.(pin.place_id);

          popupRef.current?.remove();

          const popupRoot = document.createElement("div");
          popupRoot.style.fontFamily = "system-ui,sans-serif";
          popupRoot.style.fontSize = "0.85rem";
          popupRoot.style.maxWidth = "220px";

          const title = document.createElement("div");
          title.innerHTML = `<strong>Day ${pin.day_number}</strong> · ${pin.time_slot}`;
          popupRoot.appendChild(title);

          const nameEl = document.createElement("div");
          nameEl.style.marginTop = "4px";
          nameEl.textContent = pin.name;
          popupRoot.appendChild(nameEl);

          if (onAdjustPinRef.current) {
            const adjustBtn = document.createElement("button");
            adjustBtn.type = "button";
            adjustBtn.textContent = "Adjust location";
            adjustBtn.style.marginTop = "8px";
            adjustBtn.style.fontSize = "0.75rem";
            adjustBtn.style.color = "#58ABD4";
            adjustBtn.style.background = "none";
            adjustBtn.style.border = "none";
            adjustBtn.style.padding = "0";
            adjustBtn.style.cursor = "pointer";
            adjustBtn.addEventListener("click", (evt) => {
              evt.stopPropagation();
              onAdjustPinRef.current?.(pin.place_id);
              popupRef.current?.remove();
            });
            popupRoot.appendChild(adjustBtn);
          }

          popupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: true })
            .setLngLat([pin.displayLng, pin.displayLat])
            .setDOMContent(popupRoot)
            .addTo(map);
        });

        markersRef.current.push(marker);
      }
    };

    const addPinsAndRoutesLegacy = () => {
      void addPinsAndRoutes();
    };

    map.on("error", (event) => {
      console.error("Mapbox error:", event.error);
      if (!cancelled) {
        setMapError("Map tiles could not load. Check your Mapbox token scopes (needs styles:read + tiles).");
      }
    });

    const onReady = () => {
      addPinsAndRoutesLegacy();
      requestAnimationFrame(() => {
        if (!cancelled) {
          map.resize();
        }
      });
    };

    if (map.isStyleLoaded()) {
      onReady();
    } else {
      map.once("load", onReady);
    }

    map.once("idle", () => {
      if (!cancelled) {
        map.resize();
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!cancelled) {
        map.resize();
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, [pinSignature, theme.isDark, theme.pageBg, onAdjustPin]);

  useEffect(() => {
    if (!mapRef.current || displayPins.length === 0) {
      return;
    }
    for (const marker of markersRef.current) {
      const el = marker.getElement();
      const pinId = Number(el.dataset.placeId);
      const isSelected = pinId === selectedPlaceId;
      el.style.width = isSelected ? "28px" : "22px";
      el.style.height = isSelected ? "28px" : "22px";
      el.style.borderColor = isSelected ? "#fff" : theme.pageBg;
      el.style.transform = isSelected ? "scale(1.15)" : "scale(1)";
    }
  }, [selectedPlaceId, displayPins.length, theme.pageBg]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedPlaceId == null) {
      return;
    }
    const pin = displayPins.find((p) => p.place_id === selectedPlaceId);
    if (!pin) {
      return;
    }
    map.flyTo({
      center: [pin.displayLng, pin.displayLat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 700,
      essential: true,
    });
  }, [selectedPlaceId, displayPins]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className="rounded-2xl flex items-center justify-center px-6 text-center"
        style={{
          height: 360,
          background: theme.optionBg,
          border: `1px solid ${theme.border}`,
          color: theme.muted,
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.9rem",
        }}
      >
        Add <code style={{ color: theme.accentSky }}>VITE_MAPBOX_ACCESS_TOKEN</code> to your <code>.env</code> to show the trip map.
      </div>
    );
  }

  if (displayPins.length === 0) {
    return (
      <div
        className="rounded-2xl flex items-center justify-center px-6 text-center"
        style={{
          height: 360,
          background: theme.optionBg,
          border: `1px solid ${theme.border}`,
          color: theme.muted,
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.9rem",
        }}
      >
        {geocodingConfigured
          ? "Placing pins on the map..."
          : "Add MAPBOX_ACCESS_TOKEN to enable geocoding and map pins."}
      </div>
    );
  }

  if (mapError) {
    return (
      <div
        className="rounded-2xl flex items-center justify-center px-6 text-center"
        style={{
          height: 360,
          background: theme.optionBg,
          border: `1px solid ${theme.border}`,
          color: theme.muted,
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.9rem",
        }}
      >
        {mapError}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${theme.border}`, height: 360, width: "100%" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
