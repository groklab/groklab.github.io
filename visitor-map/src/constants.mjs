export const ALLOWED_ORIGIN = "https://groklab.github.io";

export const CELL_DEGREES = 15;
export const LATITUDE_BAND_COUNT = 12;
export const LONGITUDE_BAND_COUNT = 24;
export const PUBLIC_THRESHOLD = 1;
export const ROLLBACK_RETENTION_DAYS = 90;

// Each accepted request performs at most three D1 row writes: budget, daily
// rollback buffer, and the all-time total maintained by a database trigger.
// The limit leaves
// substantial room below the free daily Worker/D1 ceilings for reads, retries,
// maintenance, and future traffic growth.
export const DAILY_REQUEST_LIMIT = 20_000;
export const CELL_DAILY_LIMIT = 2_000;

export const MAP_CACHE_CONTROL =
  "public, max-age=300, s-maxage=1800, stale-while-revalidate=300";
export const PIXEL_CACHE_CONTROL = "no-store, max-age=0";

export const PIXEL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1" aria-hidden="true"><path fill="none" d="M0 0h1v1H0z"/></svg>';
