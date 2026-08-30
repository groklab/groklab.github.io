import {
  ALLOWED_ORIGIN,
  CELL_DAILY_LIMIT,
  DAILY_REQUEST_LIMIT,
  MAP_CACHE_CONTROL,
  PIXEL_CACHE_CONTROL,
  PIXEL_SVG,
  PUBLIC_THRESHOLD,
} from "./constants.mjs";
import {
  coarseCell,
  isAllowedDocumentRequest,
  isAllowedImageRequest,
  rollingCutoffDay,
  utcDay,
} from "./privacy.mjs";
import { renderMapHtml, renderMapSvg } from "./render.mjs";

export const SQL = Object.freeze({
  claimDailyBudget: `
    INSERT INTO daily_budget (day, accepted)
    VALUES (?1, 1)
    ON CONFLICT(day) DO UPDATE SET accepted = daily_budget.accepted + 1
    WHERE daily_budget.accepted < ?2
    RETURNING accepted
  `,
  incrementCell: `
    INSERT INTO cell_day (day, lat_band, lon_band, hits)
    VALUES (?1, ?2, ?3, 1)
    ON CONFLICT(day, lat_band, lon_band) DO UPDATE
    SET hits = MIN(cell_day.hits + 1, ?4)
  `,
  aggregateWindow: `
    SELECT lat_band, lon_band, SUM(hits) AS hits
    FROM cell_day
    WHERE day >= ?1 AND day <= ?2
    GROUP BY lat_band, lon_band
    HAVING SUM(hits) >= ?3
    ORDER BY lat_band, lon_band
  `,
  pruneCells: "DELETE FROM cell_day WHERE day < ?1",
  pruneBudgets: "DELETE FROM daily_budget WHERE day < ?1",
});

function commonHeaders() {
  return {
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    Vary: "Origin",
  };
}

function imageHeaders({ cacheControl = PIXEL_CACHE_CONTROL } = {}) {
  return {
    ...commonHeaders(),
    ...corsHeaders(),
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": cacheControl,
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'none'; script-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; sandbox",
  };
}

function htmlHeaders() {
  return {
    ...commonHeaders(),
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": MAP_CACHE_CONTROL,
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    "X-Frame-Options": "DENY",
  };
}

function textResponse(body, status, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      ...commonHeaders(),
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function headAwareResponse(request, body, init) {
  return new Response(request.method === "HEAD" ? null : body, init);
}

async function recordAggregateRequest(request, env, now) {
  if (!env?.DB) return;
  const cell = coarseCell(request.cf?.latitude, request.cf?.longitude);
  if (!cell) return;

  const day = utcDay(now);
  const budget = await env.DB.prepare(SQL.claimDailyBudget)
    .bind(day, DAILY_REQUEST_LIMIT)
    .first();
  if (budget === null) return;

  await env.DB.prepare(SQL.incrementCell)
    .bind(day, cell.latBand, cell.lonBand, CELL_DAILY_LIMIT)
    .run();
}

async function aggregateRows(env, startDay, endDay) {
  if (!env?.DB) throw new Error("aggregate storage unavailable");
  const result = await env.DB.prepare(SQL.aggregateWindow)
    .bind(startDay, endDay, PUBLIC_THRESHOLD)
    .all();
  return Array.isArray(result?.results) ? result.results : [];
}

function edgeCache() {
  return globalThis.caches?.default ?? null;
}

async function cacheMatch(request) {
  const cache = edgeCache();
  if (!cache || request.method !== "GET") return null;
  try {
    return await cache.match(new Request(request.url, { method: "GET" }));
  } catch {
    return null;
  }
}

function cachePut(request, response, context) {
  const cache = edgeCache();
  if (!cache || !context?.waitUntil || request.method !== "GET" || !response.ok) return;
  const task = cache
    .put(new Request(request.url, { method: "GET" }), response.clone())
    .catch(() => undefined);
  context.waitUntil(task);
}

async function pixelResponse(request, env, context, now) {
  if (!isAllowedImageRequest(request)) {
    return textResponse("Forbidden\n", 403);
  }

  if (request.method === "GET") {
    const task = recordAggregateRequest(request, env, now).catch(() => undefined);
    if (context?.waitUntil) context.waitUntil(task);
    else await task;
  }

  return headAwareResponse(request, PIXEL_SVG, {
    status: 200,
    headers: imageHeaders(),
  });
}

async function mapSvgResponse(request, env, context, now) {
  if (!isAllowedImageRequest(request)) {
    return textResponse("Forbidden\n", 403);
  }

  const cached = await cacheMatch(request);
  if (cached) return cached;

  const endDay = utcDay(now);
  const startDay = rollingCutoffDay(now);
  try {
    const rows = await aggregateRows(env, startDay, endDay);
    const response = headAwareResponse(
      request,
      renderMapSvg(rows, { startDay, endDay }),
      { status: 200, headers: imageHeaders({ cacheControl: MAP_CACHE_CONTROL }) },
    );
    cachePut(request, response, context);
    return response;
  } catch {
    return headAwareResponse(
      request,
      renderMapSvg([], { startDay, endDay }),
      { status: 503, headers: imageHeaders() },
    );
  }
}

async function mapHtmlResponse(request, env, context, now) {
  if (!isAllowedDocumentRequest(request)) {
    return textResponse("Forbidden\n", 403);
  }

  const cached = await cacheMatch(request);
  if (cached) return cached;

  const endDay = utcDay(now);
  const startDay = rollingCutoffDay(now);
  try {
    const rows = await aggregateRows(env, startDay, endDay);
    const response = headAwareResponse(
      request,
      renderMapHtml(rows, { startDay, endDay }),
      { status: 200, headers: htmlHeaders() },
    );
    cachePut(request, response, context);
    return response;
  } catch {
    return headAwareResponse(
      request,
      renderMapHtml([], { startDay, endDay }),
      { status: 503, headers: { ...htmlHeaders(), "Cache-Control": "no-store" } },
    );
  }
}

function optionsResponse(request, pathname) {
  if (
    !["/v1/pixel.svg", "/v1/map.svg"].includes(pathname) ||
    request.headers.get("Origin") !== ALLOWED_ORIGIN ||
    !["GET", "HEAD"].includes(request.headers.get("Access-Control-Request-Method")) ||
    request.headers.has("Access-Control-Request-Headers")
  ) {
    return textResponse("Forbidden\n", 403);
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...commonHeaders(),
      ...corsHeaders(),
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-store",
    },
  });
}

function healthResponse(request) {
  const body = JSON.stringify({
    status: "ok",
    service: "groklab-visitor-map",
    unit: "page-requests",
  });
  return headAwareResponse(request, body, {
    status: 200,
    headers: {
      ...commonHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function handleRequest(
  request,
  env = {},
  context = {},
  { now = new Date() } = {},
) {
  const url = new URL(request.url);
  if (url.search || url.hash) return textResponse("Not found\n", 404);

  if (request.method === "OPTIONS") return optionsResponse(request, url.pathname);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return textResponse("Method not allowed\n", 405, { Allow: "GET, HEAD, OPTIONS" });
  }

  switch (url.pathname) {
    case "/v1/pixel.svg":
      return pixelResponse(request, env, context, now);
    case "/v1/map.svg":
      return mapSvgResponse(request, env, context, now);
    case "/v1/map":
      return mapHtmlResponse(request, env, context, now);
    case "/healthz":
      return healthResponse(request);
    default:
      return textResponse("Not found\n", 404);
  }
}

export async function pruneExpiredAggregates(env, now = new Date()) {
  if (!env?.DB) return;
  const cutoff = rollingCutoffDay(now);
  await env.DB.batch([
    env.DB.prepare(SQL.pruneCells).bind(cutoff),
    env.DB.prepare(SQL.pruneBudgets).bind(cutoff),
  ]);
}

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context);
  },
  scheduled(controller, env, context) {
    context.waitUntil(pruneExpiredAggregates(env, new Date(controller.scheduledTime)));
  },
};
