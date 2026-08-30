import assert from "node:assert/strict";
import test from "node:test";

import {
  cellBounds,
  coarseCell,
  escapeMarkup,
  isAllowedImageRequest,
  publicCells,
  publicCountRange,
  rollbackCutoffDay,
  utcDay,
} from "../src/privacy.mjs";
import { imageRequest } from "./helpers/mock-d1.mjs";

test("coarseCell reduces valid edge coordinates to fixed 15-degree bands", () => {
  assert.deepEqual(coarseCell(-90, -180), { latBand: 0, lonBand: 0 });
  assert.deepEqual(coarseCell(90, 180), { latBand: 11, lonBand: 23 });
  assert.deepEqual(coarseCell(0, 0), { latBand: 6, lonBand: 12 });
  assert.deepEqual(coarseCell("41.8", "-87.6"), { latBand: 8, lonBand: 6 });
});

test("coarseCell rejects missing, non-finite, and out-of-range geography", () => {
  assert.equal(coarseCell(undefined, 0), null);
  assert.equal(coarseCell(0, "not-a-number"), null);
  assert.equal(coarseCell(-90.01, 0), null);
  assert.equal(coarseCell(0, 180.01), null);
});

test("private rollback buffer includes today and the preceding 89 UTC days", () => {
  const now = new Date("2026-08-30T23:59:59.000Z");
  assert.equal(utcDay(now), "2026-08-30");
  assert.equal(rollbackCutoffDay(now), "2026-06-02");
});

test("image validation requires exact origin and all Fetch Metadata", () => {
  assert.equal(isAllowedImageRequest(imageRequest("/v1/pixel.svg")), true);
  assert.equal(
    isAllowedImageRequest(imageRequest("/v1/pixel.svg", { origin: "https://example.org" })),
    false,
  );
  assert.equal(
    isAllowedImageRequest(imageRequest("/v1/pixel.svg", { mode: "no-cors" })),
    false,
  );
  assert.equal(
    isAllowedImageRequest(imageRequest("/v1/pixel.svg", { destination: "document" })),
    false,
  );
  assert.equal(
    isAllowedImageRequest(imageRequest("/v1/pixel.svg", { site: "same-site" })),
    false,
  );
});

test("public count ranges threshold and cap exact aggregate values", () => {
  assert.equal(publicCountRange(0), null);
  assert.equal(publicCountRange(Number.NaN), null);
  assert.deepEqual(publicCountRange(1), { key: "1-4", label: "1–4" });
  assert.equal(publicCountRange(4).label, "1–4");
  assert.deepEqual(publicCountRange(5), { key: "5-9", label: "5–9" });
  assert.equal(publicCountRange(9).label, "5–9");
  assert.equal(publicCountRange(10).label, "10–24");
  assert.equal(publicCountRange(24).label, "10–24");
  assert.equal(publicCountRange(25).label, "25–99");
  assert.equal(publicCountRange(99).label, "25–99");
  assert.equal(publicCountRange(100).label, "100+");
  assert.equal(publicCountRange(2_000_000_000).label, "100+");
});

test("publicCells discards sub-threshold and invalid cells", () => {
  const cells = publicCells([
    { lat_band: 8, lon_band: 6, hits: 0 },
    { lat_band: 8, lon_band: 6, hits: 1 },
    { lat_band: 99, lon_band: 6, hits: 500 },
  ]);
  assert.equal(cells.length, 1);
  assert.equal(cells[0].label, "30°–45°N, 75°–90°W");
  assert.deepEqual(cellBounds(8, 6), {
    south: 30,
    north: 45,
    west: -90,
    east: -75,
  });
});

test("markup escaping covers every active delimiter", () => {
  assert.equal(escapeMarkup(`<a x="'">&`), "&lt;a x=&quot;&#39;&quot;&gt;&amp;");
});
