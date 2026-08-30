import assert from "node:assert/strict";
import test from "node:test";

import { renderMapSvg } from "../src/render.mjs";
import { WORLD_LAND_METADATA, WORLD_LAND_PATH } from "../src/world-path.mjs";

const rows = [
  { lat_band: 0, lon_band: 0, hits: 0 },
  { lat_band: 1, lon_band: 1, hits: 1 },
  { lat_band: 2, lon_band: 2, hits: 5 },
  { lat_band: 3, lon_band: 3, hits: 10 },
  { lat_band: 4, lon_band: 4, hits: 25 },
  { lat_band: 5, lon_band: 5, hits: 137 },
];

test("SVG renders only thresholded aggregate cells and capped ranges", () => {
  const svg = renderMapSvg(rows);
  assert.equal((svg.match(/class="aggregate-cell"/g) ?? []).length, 5);
  assert.match(svg, /x="31\.5" y="301\.5" width="27" height="27" data-range="1-4"/);
  assert.match(svg, /1–4 次页面请求/);
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

test("SVG exposes all-time aggregate-only meaning and threshold one", () => {
  const svg = renderMapSvg([]);
  assert.match(svg, /自启用以来成功计入的匿名聚合页面请求/);
  assert.match(svg, /统计页面请求而非独立访客/);
  assert.match(svg, /每个网格从第一次成功计入起显示/);
  assert.match(svg, /1–4、5–9、10–24、25–99、100\+/);
  assert.match(svg, /不显示精确数量或个人位置/);
  assert.match(svg, /尚无可显示的页面请求网格/);
  assert.doesNotMatch(svg, /过去 90|UTC 日|startDay|endDay/);
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
