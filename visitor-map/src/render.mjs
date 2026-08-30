import { renderBasemapLayer } from "./basemap.mjs";
import { escapeMarkup, publicCells } from "./privacy.mjs";

const WIDTH = 720;
const HEIGHT = 360;
const CELL_INSET = 1.5;
const RANGE_OPACITY = Object.freeze({
  "5-9": 0.18,
  "10-24": 0.34,
  "25-99": 0.56,
  "100-plus": 0.82,
});

function projectCell(bounds) {
  return {
    x: ((bounds.west + 180) / 360) * WIDTH + CELL_INSET,
    y: ((90 - bounds.north) / 180) * HEIGHT + CELL_INSET,
    width: ((bounds.east - bounds.west) / 360) * WIDTH - CELL_INSET * 2,
    height: ((bounds.north - bounds.south) / 180) * HEIGHT - CELL_INSET * 2,
  };
}

export function renderMapSvg(rows, { startDay, endDay } = {}) {
  const cells = publicCells(rows);
  const markers = cells
    .map((cell) => {
      const { x, y, width, height } = projectCell(cell.bounds);
      const accessibleLabel = escapeMarkup(`${cell.label}：${cell.range.label} 次页面请求`);
      return `<rect class="aggregate-cell" x="${x}" y="${y}" width="${width}" height="${height}" data-range="${cell.range.key}" fill="#5472a9" fill-opacity="${RANGE_OPACITY[cell.range.key]}" stroke="#5472a9" stroke-width="1.25" vector-effect="non-scaling-stroke"><title>${accessibleLabel}</title></rect>`;
    })
    .join("");

  const rangeText = escapeMarkup(`${startDay ?? "unknown"} through ${endDay ?? "unknown"}`);
  const emptyText = cells.length ? "" : "当前没有网格达到公开阈值。";
  const description =
    `过去 90 个 UTC 日的匿名聚合页面请求，${rangeText}。` +
    "统计页面请求而非独立访客；只显示至少收到五次请求的 15 度网格。" +
    "颜色深浅代表 5–9、10–24、25–99、100+ 四个封顶区间，不显示精确数量或个人位置。" +
    emptyText;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xml:lang="zh-CN" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="map-title map-description">`,
    '<title id="map-title">匿名聚合访问地图</title>',
    `<desc id="map-description">${description}</desc>`,
    `<g id="aggregate-cells">${markers}</g>`,
    renderBasemapLayer(),
    "</svg>",
  ].join("");
}

export function renderMapHtml(rows, { startDay, endDay } = {}) {
  const cells = publicCells(rows);
  const rowsMarkup = cells
    .map(
      (cell) =>
        `<tr><th scope="row">${escapeMarkup(cell.label)}</th><td>${escapeMarkup(cell.range.label)}</td></tr>`,
    )
    .join("");
  const resultMarkup = cells.length
    ? `<table><caption>达到公开阈值的 15° 网格</caption><thead><tr><th scope="col">粗略区域</th><th scope="col">页面请求区间</th></tr></thead><tbody>${rowsMarkup}</tbody></table>`
    : "<p>这个时间窗口内，尚无网格达到公开阈值。</p>";

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>匿名聚合访问地图</title>
<style>:root{color-scheme:light dark}body{max-width:44rem;margin:2rem auto;padding:0 1rem;font:1rem/1.65 system-ui,sans-serif;color:#171818;background:#f1f1ea;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;margin-block:2rem}caption{font-weight:700;text-align:left;margin-block:.75rem}th,td{padding:.65rem 0;border-bottom:1px solid #74766f;text-align:left}th+th,td+td{padding-left:1.5rem}:focus-visible{outline:3px solid #244b8f;outline-offset:3px}@media(prefers-color-scheme:dark){body{color:#ecebe3;background:#111214}}</style>
</head>
<body>
<main>
<h1>匿名聚合访问地图</h1>
<p>这里统计页面请求，不识别或统计个人。时间范围为 ${escapeMarkup(startDay ?? "未知")} 至 ${escapeMarkup(endDay ?? "未知")}（90 个 UTC 日）。地理位置立即缩减为 15° 网格；网格至少收到五次请求才公开，数量只显示封顶区间。五次请求不等于五位不同访客。</p>
${resultMarkup}
<p>世界轮廓由 Natural Earth 1:110m 公共领域陆地数据生成，仅提供地理背景。</p>
</main>
</body>
</html>`;
}
