import assert from "node:assert/strict";
import test from "node:test";

import { renderMapHtml, renderMapSvg } from "../src/render.mjs";
import { WORLD_LAND_METADATA, WORLD_LAND_PATH } from "../src/world-path.mjs";

const rows = [
  { lat_band: 0, lon_band: 0, hits: 4 },
  { lat_band: 1, lon_band: 1, hits: 5 },
  { lat_band: 2, lon_band: 2, hits: 10 },
  { lat_band: 3, lon_band: 3, hits: 25 },
  { lat_band: 4, lon_band: 4, hits: 137 },
];

test("SVG renders only thresholded aggregate cells and capped ranges", () => {
  const svg = renderMapSvg(rows, { startDay: "2026-06-03", endDay: "2026-08-30" });
  assert.equal((svg.match(/class="aggregate-cell"/g) ?? []).length, 4);
  assert.match(svg, /x="31\.5" y="301\.5" width="27" height="27" data-range="5-9"/);
  assert.match(svg, /5–9 次页面请求/);
  assert.match(svg, /10–24 次页面请求/);
  assert.match(svg, /25–99 次页面请求/);
  assert.match(svg, /100\+ 次页面请求/);
  assert.doesNotMatch(svg, /137 次页面请求/);
  assert.match(svg, /xml:lang="zh-CN"/);
  assert.match(svg, /role="img" aria-labelledby="map-title map-description"/);
  assert.match(svg, /id="world-outline" data-source="natural-earth-110m"/);
  assert.match(svg, /<path d="[ML0-9.,-]+" fill="none"[^>]+vector-effect="non-scaling-stroke"/);
  assert.doesNotMatch(svg, /<circle|graticule|basemap-placeholder|<script|<a\s|<image|<foreignObject/i);
  assert.doesNotMatch(svg, /<rect (?:x="0\.5" )?width="720"/);
});

test("SVG exposes the rolling window and aggregate-only meaning", () => {
  const svg = renderMapSvg([], { startDay: "2026-06-03", endDay: "2026-08-30" });
  assert.match(svg, /过去 90 个 UTC 日的匿名聚合页面请求/);
  assert.match(svg, /统计页面请求而非独立访客/);
  assert.match(svg, /至少收到五次请求的 15 度网格/);
  assert.match(svg, /不显示精确数量或个人位置/);
  assert.match(svg, /当前没有网格达到公开阈值/);
});

test("HTML summary has semantic table structure and privacy explanation", () => {
  const html = renderMapHtml(rows, { startDay: "2026-06-03", endDay: "2026-08-30" });
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<main>/);
  assert.match(html, /<h1>匿名聚合访问地图<\/h1>/);
  assert.match(html, /统计页面请求，不识别或统计个人/);
  assert.match(html, /五次请求不等于五位不同访客/);
  assert.match(html, /<caption>达到公开阈值的 15° 网格<\/caption>/);
  assert.match(html, /scope="col"/);
  assert.match(html, /scope="row"/);
  assert.match(html, /100\+/);
  assert.doesNotMatch(html, />137</);
  assert.match(html, /Natural Earth 1:110m 公共领域陆地数据/);
});

test("HTML explicitly reports an empty thresholded result", () => {
  const html = renderMapHtml([], { startDay: "2026-06-03", endDay: "2026-08-30" });
  assert.match(html, /尚无网格达到公开阈值/);
  assert.doesNotMatch(html, /<table>/);
});

test("verified land path is self-contained and has no antimeridian jump", () => {
  assert.equal(WORLD_LAND_METADATA.sourceSha256, "8689e6932b8e370e2ca4587cf3ba21e460b1235db37b6ed3c172c35b4a6088de");
  assert.equal(WORLD_LAND_METADATA.partCount, 128);
  assert.equal(WORLD_LAND_METADATA.pointCount, 5143);
  assert.match(WORLD_LAND_PATH, /^M/);
  assert.match(WORLD_LAND_PATH, /^[ML0-9.,-]+$/);
  assert.doesNotMatch(WORLD_LAND_PATH, /https?:|<|>|NaN|Infinity/);

  let previousX = null;
  let commandCount = 0;
  for (const match of WORLD_LAND_PATH.matchAll(/([ML])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
    const [, command, xText, yText] = match;
    const x = Number(xText);
    const y = Number(yText);
    assert.ok(x >= 0 && x <= 720);
    assert.ok(y >= 0 && y <= 360);
    if (command === "L") assert.ok(Math.abs(x - previousX) <= 360);
    previousX = x;
    commandCount += 1;
  }
  assert.equal(commandCount, 5143);
});
