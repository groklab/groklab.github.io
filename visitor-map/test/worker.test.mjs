import assert from "node:assert/strict";
import test from "node:test";

import {
  default as worker,
  handleRequest,
  pruneRollbackState,
  SQL,
} from "../src/index.mjs";
import {
  executionContext,
  imageRequest,
  MockD1,
} from "./helpers/mock-d1.mjs";

const NOW = new Date("2026-08-30T12:34:56.000Z");

test("eligible pixel issues the budget and daily-buffer writes used by the total trigger", async () => {
  const database = new MockD1();
  const context = executionContext();
  const response = await handleRequest(imageRequest("/v1/pixel.svg"), { DB: database }, context, {
    now: NOW,
  });
  await context.drain();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/svg+xml; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("access-control-allow-origin"), "https://groklab.github.io");
  assert.equal(response.headers.get("vary"), "Origin");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(database.calls.length, 2);
  assert.deepEqual(database.calls[0].binds, ["2026-08-30", 20_000]);
  assert.deepEqual(database.calls[1].binds, ["2026-08-30", 8, 6, 2_000]);
});

test("pixel never counts HEAD, missing geography, or a rejected source", async () => {
  for (const request of [
    imageRequest("/v1/pixel.svg", { method: "HEAD" }),
    imageRequest("/v1/pixel.svg", { latitude: null }),
  ]) {
    const database = new MockD1();
    const context = executionContext();
    const response = await handleRequest(request, { DB: database }, context, { now: NOW });
    await context.drain();
    assert.equal(response.status, 200);
    assert.equal(database.calls.length, 0);
  }

  const rejectedDatabase = new MockD1();
  const rejectedContext = executionContext();
  const rejected = await handleRequest(
    imageRequest("/v1/pixel.svg", { origin: "https://attacker.example" }),
    { DB: rejectedDatabase },
    rejectedContext,
    { now: NOW },
  );
  await rejectedContext.drain();
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("access-control-allow-origin"), null);
  assert.equal(rejectedDatabase.calls.length, 0);
});

test("daily circuit breaker prevents the cell write", async () => {
  const database = new MockD1({ budgetResults: [null] });
  const context = executionContext();
  const response = await handleRequest(imageRequest("/v1/pixel.svg"), { DB: database }, context, {
    now: NOW,
  });
  await context.drain();
  assert.equal(response.status, 200);
  assert.equal(database.calls.length, 1);
  assert.match(database.calls[0].sql, /WHERE daily_budget\.accepted < \?2/);
});

test("storage failures fail closed without changing the pixel response", async () => {
  const database = new MockD1({ fail: "first" });
  const context = executionContext();
  const response = await handleRequest(imageRequest("/v1/pixel.svg"), { DB: database }, context, {
    now: NOW,
  });
  await context.drain();
  assert.equal(response.status, 200);
  assert.match(await response.text(), /^<svg/);
});

test("map SVG queries the bounded all-time table at threshold one", async () => {
  const database = new MockD1({
    aggregateRows: [
      { lat_band: 8, lon_band: 6, hits: 1 },
      { lat_band: 8, lon_band: 7, hits: 12 },
    ],
  });
  const response = await handleRequest(
    imageRequest("/v1/map.svg"),
    { DB: database },
    executionContext(),
    { now: NOW },
  );
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=300, s-maxage=1800, stale-while-revalidate=300");
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
  assert.equal(database.calls.length, 1);
  assert.match(database.calls[0].sql, /FROM cell_total/);
  assert.doesNotMatch(database.calls[0].sql, /cell_day|SUM\(|GROUP BY|day >=/);
  assert.deepEqual(database.calls[0].binds, [1]);
  assert.equal((body.match(/class="aggregate-cell"/g) ?? []).length, 2);
  assert.match(body, /1–4 次页面请求/);
  assert.match(body, /10–24 次页面请求/);
  assert.doesNotMatch(body, /12 次页面请求/);
});

test("map HEAD returns representation headers without cache or D1 access", async () => {
  const database = new MockD1();
  const response = await handleRequest(
    imageRequest("/v1/map.svg", { method: "HEAD" }),
    { DB: database },
    executionContext(),
    { now: NOW },
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=300, s-maxage=1800, stale-while-revalidate=300",
  );
  assert.equal(await response.text(), "");
  assert.equal(database.calls.length, 0);
});

test("SVG map returns a safe 503 representation if D1 is unavailable", async () => {
  const svg = await handleRequest(
    imageRequest("/v1/map.svg"),
    {},
    executionContext(),
    { now: NOW },
  );
  assert.equal(svg.status, 503);
  assert.equal(svg.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(await svg.text(), /<svg/);
});

test("removed HTML map route returns 404 without touching D1", async () => {
  for (const method of ["GET", "HEAD"]) {
    const database = new MockD1();
    const response = await handleRequest(
      new Request("https://map.example/v1/map", { method }),
      { DB: database },
      executionContext(),
      { now: NOW },
    );
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(database.calls.length, 0);
  }
});

test("preflight is exact-origin, method-limited, and header-free", async () => {
  const valid = new Request("https://map.example/v1/pixel.svg", {
    method: "OPTIONS",
    headers: {
      Origin: "https://groklab.github.io",
      "Access-Control-Request-Method": "GET",
    },
  });
  const validResponse = await handleRequest(valid);
  assert.equal(validResponse.status, 204);
  assert.equal(validResponse.headers.get("access-control-allow-origin"), "https://groklab.github.io");
  assert.equal(validResponse.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");

  for (const request of [
    new Request("https://map.example/v1/pixel.svg", {
      method: "OPTIONS",
      headers: { Origin: "https://other.example", "Access-Control-Request-Method": "GET" },
    }),
    new Request("https://map.example/v1/pixel.svg", {
      method: "OPTIONS",
      headers: {
        Origin: "https://groklab.github.io",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "X-Custom",
      },
    }),
    new Request("https://map.example/v1/map", {
      method: "OPTIONS",
      headers: {
        Origin: "https://groklab.github.io",
        "Access-Control-Request-Method": "GET",
      },
    }),
  ]) {
    assert.equal((await handleRequest(request)).status, 403);
  }
});

test("versioned edge-cache hits bypass D1 and cache failures fall back safely", async () => {
  const originalCaches = globalThis.caches;
  try {
    const cachedBody = "<svg data-test=\"cached\"></svg>";
    const matchedUrls = [];
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: {
        default: {
          async match(request) {
            matchedUrls.push(request.url);
            return new Response(cachedBody, {
              headers: { "Content-Type": "image/svg+xml" },
            });
          },
          async put() {
            throw new Error("cache put must not run after a hit");
          },
        },
      },
    });
    const hitDatabase = new MockD1({
      aggregateRows: [{ lat_band: 8, lon_band: 6, hits: 12 }],
    });
    const hit = await handleRequest(
      imageRequest("/v1/map.svg"),
      { DB: hitDatabase },
      executionContext(),
      { now: NOW },
    );
    assert.equal(await hit.text(), cachedBody);
    assert.equal(hitDatabase.calls.length, 0);
    assert.deepEqual(matchedUrls, [
      "https://map.example/v1/map.svg?__cache_policy=all-time-v2",
    ]);
    assert.notEqual(matchedUrls[0], "https://map.example/v1/map.svg");

    let putAttempts = 0;
    let failedMatchUrl = null;
    let failedPutUrl = null;
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: {
        default: {
          async match(request) {
            failedMatchUrl = request.url;
            throw new Error("simulated cache miss failure");
          },
          async put(request) {
            putAttempts += 1;
            failedPutUrl = request.url;
            throw new Error("simulated cache write failure");
          },
        },
      },
    });
    const missDatabase = new MockD1({
      aggregateRows: [{ lat_band: 8, lon_band: 6, hits: 12 }],
    });
    const missContext = executionContext();
    const miss = await handleRequest(
      imageRequest("/v1/map.svg"),
      { DB: missDatabase },
      missContext,
      { now: NOW },
    );
    await missContext.drain();
    assert.equal(miss.status, 200);
    assert.equal(missDatabase.calls.length, 1);
    assert.equal(putAttempts, 1);
    assert.equal(
      failedMatchUrl,
      "https://map.example/v1/map.svg?__cache_policy=all-time-v2",
    );
    assert.equal(failedPutUrl, failedMatchUrl);
  } finally {
    if (originalCaches === undefined) Reflect.deleteProperty(globalThis, "caches");
    else Object.defineProperty(globalThis, "caches", { configurable: true, value: originalCaches });
  }
});

test("health is storage-independent, while methods and query strings are rejected", async () => {
  const health = await handleRequest(new Request("https://map.example/healthz"));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    status: "ok",
    service: "groklab-visitor-map",
    unit: "page-requests",
  });
  assert.equal(health.headers.get("cache-control"), "no-store");

  const method = await handleRequest(new Request("https://map.example/healthz", { method: "POST" }));
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "GET, HEAD, OPTIONS");
  assert.equal((await handleRequest(new Request("https://map.example/healthz?probe=1"))).status, 404);
  assert.equal((await handleRequest(new Request("https://map.example/missing"))).status, 404);
});

test("scheduled retention keeps a 90-day daily buffer and only today's budget", async () => {
  const database = new MockD1();
  await pruneRollbackState({ DB: database }, NOW);
  assert.equal(database.batches.length, 1);
  assert.deepEqual(database.batches[0].map((item) => item.binds), [
    ["2026-06-02"],
    ["2026-08-30"],
  ]);
  assert.equal(database.batches[0][0].sql, SQL.pruneCells);
  assert.equal(database.batches[0][1].sql, SQL.pruneBudgets);
});

test("scheduled retention failures remain observable to the runtime", async () => {
  const context = executionContext();
  worker.scheduled(
    { scheduledTime: NOW.getTime() },
    { DB: new MockD1({ fail: "batch" }) },
    context,
  );
  await assert.rejects(context.drain(), /mock batch failure/);
});
