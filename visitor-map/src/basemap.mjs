import { WORLD_LAND_PATH } from "./world-path.mjs";

export const BASEMAP_STATUS = "natural-earth-110m-public-domain";

export function renderBasemapLayer() {
  return `<g id="world-outline" data-source="natural-earth-110m" aria-hidden="true"><path d="${WORLD_LAND_PATH}" fill="none" stroke="#74766f" stroke-linecap="square" stroke-linejoin="round" stroke-width="1.25" vector-effect="non-scaling-stroke"/></g>`;
}
