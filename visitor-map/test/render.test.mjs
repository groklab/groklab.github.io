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

test("SVG renders only thresholded aggregate regions as winged-cup markers", () => {
  const svg = renderMapSvg(rows);
  assert.equal((svg.match(/class="aggregate-marker"/g) ?? []).length, 5);
  assert.match(svg, /transform="translate\(45 315\) scale\(0\.72\)" data-range="1-4" data-level="1" data-scale="0\.72" data-motif="winged-cup"/);
  assert.match(svg, /累计 1–4 次页面请求/);
  assert.match(svg, /累计 5–9 次页面请求/);
  assert.match(svg, /累计 10–24 次页面请求/);
  assert.match(svg, /累计 25–99 次页面请求/);
  assert.match(svg, /累计 100\+ 次页面请求/);
  assert.match(svg, /fill="#916960"/);
  assert.match(svg, /fill="#c74330"/);
  for (const level of [1, 2, 3, 4, 5]) {
    assert.match(svg, new RegExp(`data-ripples="${level}"`));
  }
  for (const scale of ["0.72", "0.86", "1", "1.16", "1.34"]) {
    assert.match(svg, new RegExp(`data-scale="${scale}"`));
  }
  assert.doesNotMatch(svg, /137 次页面请求/);
  assert.match(svg, /xml:lang="zh-CN"/);
  assert.match(svg, /role="img" aria-labelledby="map-title map-description"/);
  assert.match(svg, /id="world-outline" data-source="natural-earth-110m"/);
  assert.match(svg, /<path d="[ML0-9.,-]+" fill="none"[^>]+vector-effect="non-scaling-stroke"/);
  assert.doesNotMatch(svg, /aggregate-cell|<rect|<text|graticule|basemap-placeholder|<script|<a\s|<image|<foreignObject/i);
});

test("SVG exposes all-time aggregate-only meaning and threshold one", () => {
  const svg = renderMapSvg([]);
  assert.match(svg, /世界访问地图/);
  assert.match(svg, /朱砂羽觞标记代表一个 15 度区域/);
  assert.match(svg, /统计页面请求而非独立访客/);
  assert.match(svg, /自第一次成功计入起显示/);
  assert.match(svg, /由小到大的五档羽觞、朱砂色阶与一至五道水纹共同表示累计页面请求区间/);
  assert.match(svg, /不显示精确数量或个人位置/);
  assert.match(svg, /尚无可显示的累计页面请求地区/);
  assert.doesNotMatch(svg, /过去 90|UTC 日|startDay|endDay/);
});

test("bottom-row winged cup keeps its geographic center and sends ripples upward", () => {
  const svg = renderMapSvg([{ lat_band: 0, lon_band: 0, hits: 1 }]);
  assert.match(svg, /transform="translate\(15 345\) scale\(0\.72\)"/);
  assert.match(svg, /data-ripples="1" data-ripple-direction="up" d="M-13 -13Q0 -10 13 -13"/);
});

test("five water ripples retain seven SVG units of vertical separation", () => {
  const svg = renderMapSvg([{ lat_band: 6, lon_band: 6, hits: 100 }]);
  assert.match(svg, /data-ripples="5" data-ripple-direction="down"/);
  assert.match(svg, /M-13 13Q0 10 13 13/);
  assert.match(svg, /M-12\.25 20Q0 17 12\.25 20/);
  assert.match(svg, /M-11\.5 27Q0 24 11\.5 27/);
  assert.match(svg, /M-10\.75 34Q0 31 10\.75 34/);
  assert.match(svg, /M-10 41Q0 38 10 41/);
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
