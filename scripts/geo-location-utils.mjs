export function parseGoogleMapsCoordinates(value) {
  const text = String(value || "");
  const destinationPairs = [...text.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/gi)];
  if (destinationPairs.length) {
    const match = destinationPairs.at(-1);
    return { latitude: Number(match[1]), longitude: Number(match[2]), source: "destination_3d_4d" };
  }
  const viewportPairs = [...text.matchAll(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|z)/gi)];
  if (viewportPairs.length) {
    const match = viewportPairs.at(-1);
    return { latitude: Number(match[1]), longitude: Number(match[2]), source: "viewport_at" };
  }
  try {
    const url = new URL(text);
    for (const key of ["q", "query"]) {
      const raw = decodeURIComponent(url.searchParams.get(key) || "").trim();
      const match = raw.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
      if (match) return { latitude: Number(match[1]), longitude: Number(match[2]), source: `query_${key}` };
    }
  } catch {
    // Not a parseable URL.
  }
  return null;
}

export function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
