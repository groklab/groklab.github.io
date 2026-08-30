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
  isAllowedImageRequest,
  rollbackCutoffDay,
  utcDay,
} from "./privacy.mjs";
import { renderMapSvg } from "./render.mjs";

const MAP_CACHE_POLICY = "all-time-v2";

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
  aggregateAllTime: `
    SELECT lat_band, lon_band, hits
    FROM cell_total
    WHERE hits >= ?1
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

async function aggregateRows(env) {
  if (!env?.DB) throw new Error("aggregate storage unavailable");
  const result = await env.DB.prepare(SQL.aggregateAllTime)
    .bind(PUBLIC_THRESHOLD)
    .all();
  return Array.isArray(result?.results) ? result.results : [];
}

function edgeCache() {
  return globalThis.caches?.default ?? null;
}

function mapCacheRequest(request) {
  const url = new URL(request.url);
  url.searchParams.set("__cache_policy", MAP_CACHE_POLICY);
  return new Request(url, { method: "GET" });
}

async function cacheMatch(request) {
  const cache = edgeCache();
  if (!cache || request.method !== "GET") return null;
  try {
    return await cache.match(mapCacheRequest(request));
  } catch {
    return null;
  }
}

function cachePut(request, response, context) {
  const cache = edgeCache();
  if (!cache || !context?.waitUntil || request.method !== "GET" || !response.ok) return;
  const task = cache
    .put(mapCacheRequest(request), response.clone())
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

async function mapSvgResponse(request, env, context) {
  if (!isAllowedImageRequest(request)) {
    return textResponse("Forbidden\n", 403);
  }

  // A HEAD probe needs only the stable representation headers. Do not let it
  // bypass the GET cache and turn into an unbounded D1 read primitive.
  if (request.method === "HEAD") {
    return headAwareResponse(request, "", {
      status: 200,
      headers: imageHeaders({ cacheControl: MAP_CACHE_CONTROL }),
    });
  }

  const cached = await cacheMatch(request);
  if (cached) return cached;

  try {
    const rows = await aggregateRows(env);
    const response = headAwareResponse(
      request,
      renderMapSvg(rows),
      { status: 200, headers: imageHeaders({ cacheControl: MAP_CACHE_CONTROL }) },
    );
    cachePut(request, response, context);
    return response;
  } catch {
    return headAwareResponse(
      request,
      renderMapSvg([]),
      { status: 503, headers: imageHeaders() },
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
      return mapSvgResponse(request, env, context);
    case "/healthz":
      return healthResponse(request);
    default:
      return textResponse("Not found\n", 404);
  }
}

export async function pruneRollbackState(env, now = new Date()) {
  if (!env?.DB) return;
  await env.DB.batch([
    env.DB.prepare(SQL.pruneCells).bind(rollbackCutoffDay(now)),
    env.DB.prepare(SQL.pruneBudgets).bind(utcDay(now)),
  ]);
}

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context);
  },
  scheduled(controller, env, context) {
    context.waitUntil(pruneRollbackState(env, new Date(controller.scheduledTime)));
  },
};
