import { renderBasemapLayer } from "./basemap.mjs";
import { escapeMarkup, publicCells } from "./privacy.mjs";

const WIDTH = 720;
const HEIGHT = 360;
const RANGE_FILL = Object.freeze({
  "1-4": "#916960",
  "5-9": "#9f6053",
  "10-24": "#ad5747",
  "25-99": "#ba4e3b",
  "100-plus": "#c74330",
});
const RANGE_HALO_OPACITY = Object.freeze({
  "1-4": 0.08,
  "5-9": 0.12,
  "10-24": 0.17,
  "25-99": 0.23,
  "100-plus": 0.3,
});
const RANGE_LEVEL = Object.freeze({
  "1-4": 1,
  "5-9": 2,
  "10-24": 3,
  "25-99": 4,
  "100-plus": 5,
});
const RANGE_SCALE = Object.freeze({
  "1-4": 0.72,
  "5-9": 0.86,
  "10-24": 1,
  "25-99": 1.16,
  "100-plus": 1.34,
});

function renderWaterRipples(level, direction) {
  return Array.from({ length: level }, (_, index) => {
    const y = direction * (13 + index * 7);
    const controlY = y - direction * 3;
    const halfWidth = 13 - index * 0.75;
    return `M-${halfWidth} ${y}Q0 ${controlY} ${halfWidth} ${y}`;
  }).join("");
}

function projectCellCenter(bounds) {
  const rawY = ((90 - ((bounds.south + bounds.north) / 2)) / 180) * HEIGHT;
  return {
    x: ((((bounds.west + bounds.east) / 2) + 180) / 360) * WIDTH,
    y: Math.min(Math.max(rawY, 11), HEIGHT - 11),
    rippleDirection: rawY > HEIGHT - 50 ? -1 : 1,
  };
}

export function renderMapSvg(rows) {
  const cells = publicCells(rows);
  const markers = cells
    .map((cell) => {
      const { x, y, rippleDirection } = projectCellCenter(cell.bounds);
      const fill = RANGE_FILL[cell.range.key];
      const haloOpacity = RANGE_HALO_OPACITY[cell.range.key];
      const level = RANGE_LEVEL[cell.range.key];
      const scale = RANGE_SCALE[cell.range.key];
      const accessibleLabel = escapeMarkup(
        `${cell.label}：累计 ${cell.range.label} 次页面请求`,
      );
      return [
        `<g class="aggregate-marker" transform="translate(${x} ${y}) scale(${scale})" data-range="${cell.range.key}" data-level="${level}" data-scale="${scale}" data-motif="winged-cup">`,
        `<title>${accessibleLabel}</title>`,
        `<ellipse cx="0" cy="1" rx="14" ry="12" fill="${fill}" fill-opacity="${haloOpacity}"/>`,
        `<path d="M-13-2C-11-6-8-8-5-6L-7 0C-9 1-11 1-13-2ZM13-2C11-6 8-8 5-6L7 0C9 1 11 1 13-2Z" fill="${fill}" stroke="${fill}" stroke-width="0.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
        `<path d="M-8-5Q0-2 8-5L7 2C6 8 3 10 0 10C-3 10-6 8-7 2Z" fill="${fill}" stroke="${fill}" stroke-width="0.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
        '<path d="M-6-4Q0-1 6-4" fill="none" stroke="#fffaf0" stroke-opacity="0.72" stroke-width="0.8" stroke-linecap="round" vector-effect="non-scaling-stroke"/>',
        `<path data-ripples="${level}" data-ripple-direction="${rippleDirection > 0 ? "down" : "up"}" d="${renderWaterRipples(level, rippleDirection)}" fill="none" stroke="${fill}" stroke-opacity="0.9" stroke-width="0.9" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
        "</g>",
      ].join("");
    })
    .join("");

  const emptyText = cells.length ? "" : "尚无可显示的累计页面请求地区。";
  const description =
    "世界访问地图。" +
    "每枚朱砂羽觞标记代表一个 15 度区域，自第一次成功计入起显示；" +
    "由小到大的五档羽觞、朱砂色阶与一至五道水纹共同表示累计页面请求区间；" +
    "统计页面请求而非独立访客，不显示精确数量或个人位置。" +
    emptyText;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xml:lang="zh-CN" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="map-title map-description">`,
    '<title id="map-title">累计页面请求地区地图</title>',
    `<desc id="map-description">${description}</desc>`,
    renderBasemapLayer(),
    `<g id="aggregate-markers">${markers}</g>`,
    "</svg>",
  ].join("");
}
