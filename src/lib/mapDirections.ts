/** Build a maps search query from venue name + trip destination (no API key). */
function activityMapsQuery(venueName: string, destination: string): string {
  return `${venueName} ${destination}`.trim();
}

function encodeMapsStops(stops: string[], destination: string): string[] {
  return stops.map((name) => activityMapsQuery(name, destination));
}

export function googleMapsSearchUrl(venueName: string, destination: string): string {
  const query = encodeURIComponent(activityMapsQuery(venueName, destination));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Directions between two consecutive activities. */
export function googleMapsLegUrl(
  fromVenue: string,
  toVenue: string,
  destination: string,
  travelMode: "walking" | "driving" = "driving",
): string {
  const origin = encodeURIComponent(activityMapsQuery(fromVenue, destination));
  const dest = encodeURIComponent(activityMapsQuery(toVenue, destination));
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${travelMode}`;
}

/**
 * Multi-stop route for one day. Google Maps URLs support up to 9 waypoints
 * (11 stops total); longer days are truncated with a note in the UI.
 */
export function googleMapsDayRouteUrl(
  activityNames: string[],
  destination: string,
  travelMode: "walking" | "driving" = "driving",
): string | null {
  if (activityNames.length < 2) {
    return null;
  }

  const labels = encodeMapsStops(activityNames, destination);
  const origin = encodeURIComponent(labels[0]);
  const dest = encodeURIComponent(labels[labels.length - 1]);
  const middle = labels.slice(1, -1).slice(0, 9).map(encodeURIComponent);

  let url =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${origin}&destination=${dest}&travelmode=${travelMode}`;
  if (middle.length > 0) {
    url += `&waypoints=${middle.join("%7C")}`;
  }
  return url;
}

/** Whether a day has more stops than a single Google Maps directions URL can list. */
export function dayRouteExceedsWaypointLimit(activityCount: number): boolean {
  return activityCount > 11;
}
