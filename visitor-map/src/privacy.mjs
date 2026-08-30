import {
  ALLOWED_ORIGIN,
  CELL_DEGREES,
  LATITUDE_BAND_COUNT,
  LONGITUDE_BAND_COUNT,
  PUBLIC_THRESHOLD,
  ROLLBACK_RETENTION_DAYS,
} from "./constants.mjs";

const DAY_MILLISECONDS = 86_400_000;

export function utcDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError("A valid date is required");
  }
  return date.toISOString().slice(0, 10);
}

export function rollbackCutoffDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError("A valid date is required");
  }
  return utcDay(
    new Date(date.getTime() - (ROLLBACK_RETENTION_DAYS - 1) * DAY_MILLISECONDS),
  );
}

export function coarseCell(latitudeValue, longitudeValue) {
  if (
    latitudeValue === null ||
    latitudeValue === undefined ||
    latitudeValue === "" ||
    longitudeValue === null ||
    longitudeValue === undefined ||
    longitudeValue === ""
  ) {
    return null;
  }
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  // Clamp the closed upper endpoints into the final half-open cell.
  const latBand = Math.min(
    LATITUDE_BAND_COUNT - 1,
    Math.floor((latitude + 90) / CELL_DEGREES),
  );
  const lonBand = Math.min(
    LONGITUDE_BAND_COUNT - 1,
    Math.floor((longitude + 180) / CELL_DEGREES),
  );

  return { latBand, lonBand };
}

export function isAllowedImageRequest(request) {
  return (
    (request.method === "GET" || request.method === "HEAD") &&
    request.headers.get("Origin") === ALLOWED_ORIGIN &&
    request.headers.get("Sec-Fetch-Dest") === "image" &&
    request.headers.get("Sec-Fetch-Mode") === "cors" &&
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  );
}

export function publicCountRange(countValue) {
  const count = Number(countValue);
  if (!Number.isFinite(count) || count < PUBLIC_THRESHOLD) return null;
  if (count < 5) return { key: "1-4", label: "1–4" };
  if (count < 10) return { key: "5-9", label: "5–9" };
  if (count < 25) return { key: "10-24", label: "10–24" };
  if (count < 100) return { key: "25-99", label: "25–99" };
  return { key: "100-plus", label: "100+" };
}

export function cellBounds(latBand, lonBand) {
  if (
    !Number.isInteger(latBand) ||
    !Number.isInteger(lonBand) ||
    latBand < 0 ||
    latBand >= LATITUDE_BAND_COUNT ||
    lonBand < 0 ||
    lonBand >= LONGITUDE_BAND_COUNT
  ) {
    return null;
  }

  const south = -90 + latBand * CELL_DEGREES;
  const west = -180 + lonBand * CELL_DEGREES;
  return {
    south,
    north: south + CELL_DEGREES,
    west,
    east: west + CELL_DEGREES,
  };
}

function latitudeLabel(south, north) {
  if (south === 0) return `0°–${north}°N`;
  if (north === 0) return `${Math.abs(south)}°S–0°`;
  if (north <= 0) return `${Math.abs(north)}°–${Math.abs(south)}°S`;
  return `${south}°–${north}°N`;
}

function longitudeLabel(west, east) {
  if (west === 0) return `0°–${east}°E`;
  if (east === 0) return `${Math.abs(west)}°W–0°`;
  if (east <= 0) return `${Math.abs(east)}°–${Math.abs(west)}°W`;
  return `${west}°–${east}°E`;
}

export function coarseCellLabel(bounds) {
  return `${latitudeLabel(bounds.south, bounds.north)}, ${longitudeLabel(bounds.west, bounds.east)}`;
}

export function publicCells(rows) {
  const cells = [];
  for (const row of rows ?? []) {
    const latBand = Number(row.lat_band);
    const lonBand = Number(row.lon_band);
    const bounds = cellBounds(latBand, lonBand);
    const range = publicCountRange(row.hits);
    if (!bounds || !range) continue;
    cells.push({ latBand, lonBand, bounds, range, label: coarseCellLabel(bounds) });
  }
  return cells;
}

export function escapeMarkup(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
