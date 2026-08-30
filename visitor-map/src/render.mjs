import { renderBasemapLayer } from "./basemap.mjs";
import { escapeMarkup, publicCells } from "./privacy.mjs";

const WIDTH = 720;
const HEIGHT = 360;
const CELL_INSET = 1.5;
const RANGE_OPACITY = Object.freeze({
  "1-4": 0.12,
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

export function renderMapSvg(rows) {
  const cells = publicCells(rows);
  const markers = cells
    .map((cell) => {
      const { x, y, width, height } = projectCell(cell.bounds);
      const accessibleLabel = escapeMarkup(`${cell.label}：${cell.range.label} 次页面请求`);
      return `<rect class="aggregate-cell" x="${x}" y="${y}" width="${width}" height="${height}" data-range="${cell.range.key}" fill="#5472a9" fill-opacity="${RANGE_OPACITY[cell.range.key]}" stroke="#5472a9" stroke-width="1.25" vector-effect="non-scaling-stroke"><title>${accessibleLabel}</title></rect>`;
    })
    .join("");

  const emptyText = cells.length ? "" : "尚无可显示的页面请求网格。";
  const description =
    "自启用以来成功计入的匿名聚合页面请求。" +
    "统计页面请求而非独立访客；每个网格从第一次成功计入起显示。" +
    "颜色深浅代表 1–4、5–9、10–24、25–99、100+ 五个封顶区间，不显示精确数量或个人位置。" +
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
