import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function sourceText() {
  return readdirSync(join(root, "src"))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => readFileSync(join(root, "src", name), "utf8"))
    .join("\n");
}

function migrationText(name) {
  return readFileSync(join(root, "migrations", name), "utf8");
}

test("project has no package-manager files or deployable default config", () => {
  for (const name of [
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "wrangler.json",
    "wrangler.jsonc",
    "wrangler.toml",
  ]) {
    assert.equal(existsSync(join(root, name)), false, `${name} must remain absent`);
  }
  assert.equal(existsSync(join(root, "wrangler.template.jsonc")), true);
});

test("D1 migrations retain bounded daily rollback data and add capped all-time totals", () => {
  const migrationNames = readdirSync(join(root, "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(migrationNames, [
    "0001_aggregate_counts.sql",
    "0002_all_time_counts.sql",
  ]);

  const dailySchema = migrationText("0001_aggregate_counts.sql");
  const totalSchema = migrationText("0002_all_time_counts.sql");
  const schema = `${dailySchema}\n${totalSchema}`;

  assert.match(dailySchema, /CREATE TABLE cell_day/);
  assert.match(dailySchema, /PRIMARY KEY \(day, lat_band, lon_band\)/);
  assert.match(dailySchema, /hits BETWEEN 1 AND 2000/);
  assert.match(dailySchema, /accepted BETWEEN 1 AND 20000/);

  assert.match(totalSchema, /CREATE TABLE cell_total/);
  assert.match(totalSchema, /PRIMARY KEY \(lat_band, lon_band\)/);
  assert.match(totalSchema, /hits BETWEEN 1 AND 2000000000/);
  assert.match(
    totalSchema,
    /INSERT INTO cell_total[\s\S]*SELECT lat_band, lon_band, MIN\(SUM\(hits\), 2000000000\)[\s\S]*FROM cell_day[\s\S]*GROUP BY lat_band, lon_band/,
  );
  assert.match(totalSchema, /CREATE TRIGGER cell_day_total_after_insert/);
  assert.match(totalSchema, /AFTER INSERT ON cell_day/);
  assert.match(totalSchema, /CREATE TRIGGER cell_day_total_after_update/);
  assert.match(totalSchema, /AFTER UPDATE OF hits ON cell_day/);
  assert.match(totalSchema, /WHEN NEW\.hits > OLD\.hits/);
  assert.match(totalSchema, /NEW\.hits - OLD\.hits/);
  assert.match(
    totalSchema,
    /SET hits = MIN\(cell_total\.hits \+ excluded\.hits, 2000000000\)/,
  );
  assert.doesNotMatch(totalSchema, /AFTER DELETE|DROP TABLE\s+cell_day/i);

  assert.match(schema, /lat_band BETWEEN 0 AND 11/);
  assert.match(schema, /lon_band BETWEEN 0 AND 23/);
  assert.doesNotMatch(
    schema,
    /\b(ip|address|user_agent|visitor_id|digest|latitude|longitude|timestamp|referrer|path)\b/i,
  );
});

test("Worker source never reads identifying request headers or creates event fields", () => {
  const source = sourceText();
  assert.doesNotMatch(source, /cf-connecting-ip|x-forwarded-for|true-client-ip|user-agent|referer|cookie/i);
  assert.doesNotMatch(source, /crypto\.subtle|createHash|console\./);
  assert.doesNotMatch(source, /created_at|updated_at|visitor_id|event_id/);
  const withoutAllowedGeography = source
    .replaceAll("request.cf?.latitude", "")
    .replaceAll("request.cf?.longitude", "");
  assert.doesNotMatch(withoutAllowedGeography, /request\.cf/);
  assert.match(source, /PUBLIC_THRESHOLD = 1/);
  assert.match(source, /DAILY_REQUEST_LIMIT = 20_000/);
  assert.match(source, /CELL_DAILY_LIMIT = 2_000/);
  assert.match(source, /ROLLBACK_RETENTION_DAYS = 90/);
  assert.match(source, /FROM cell_total[\s\S]*WHERE hits >= \?1/);
  assert.doesNotMatch(source, /aggregateWindow|HAVING SUM\(hits\)|renderMapHtml/);
  assert.doesNotMatch(source, /["']\/v1\/map["']/);
  assert.match(source, /MAP_CACHE_POLICY = "all-time-v6-scaled-winged-cup-ripples"/);
});

test("Wrangler template is visibly locked and disables logs", () => {
  const config = readFileSync(join(root, "wrangler.template.jsonc"), "utf8");
  assert.match(config, /REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID/);
  assert.match(config, /REPLACE_WITH_D1_DATABASE_ID/);
  assert.match(config, /"workers_dev": false/);
  assert.match(config, /"preview_urls": false/);
  assert.match(config, /"send_metrics": false/);
  assert.match(config, /"minify": true/);
  assert.match(config, /"upload_source_maps": false/);
  assert.match(config, /"observability"[\s\S]*"enabled": false/);
  assert.match(config, /"logs"[\s\S]*"enabled": false/);
  assert.match(config, /"invocation_logs": false/);
});

test("site legend mirrors all five Worker marker colors and scales", () => {
  const css = readFileSync(join(root, "..", "assets", "css", "main.css"), "utf8");
  const colors = ["#916960", "#9f6053", "#ad5747", "#ba4e3b", "#c74330"];
  const scales = ["0.72", "0.86", "1", "1.16", "1.34"];
  for (let index = 0; index < colors.length; index += 1) {
    const level = index + 1;
    assert.match(css, new RegExp(`--map-range-${level}: ${colors[index]}`));
    assert.match(
      css,
      new RegExp(`visitor-map__swatch--${level} \\{[\\s\\S]*?--marker-scale: ${scales[index]}`),
    );
  }
});

test("basemap is generated from one pinned public-domain source", () => {
  assert.equal(existsSync(join(root, "src", "basemap-placeholder.mjs")), false);
  const basemap = readFileSync(join(root, "src", "basemap.mjs"), "utf8");
  const worldPath = readFileSync(join(root, "src", "world-path.mjs"));
  const generator = readFileSync(join(root, "tools", "generate_world_path.py"), "utf8");
  assert.match(basemap, /natural-earth-110m/);
  assert.match(basemap, /WORLD_LAND_PATH/);
  assert.equal(
    createHash("sha256").update(worldPath).digest("hex"),
    "3ccc2e6ddf9447263ced08cd815739021d446a22166484fd355d45fa95536587",
  );
  assert.match(generator, /ca96624a56bd078437bca8184e78163e5039ad19/);
  assert.match(generator, /8689e6932b8e370e2ca4587cf3ba21e460b1235db37b6ed3c172c35b4a6088de/);
});

test("local secret and account files are ignored", () => {
  const ignores = readFileSync(join(root, ".gitignore"), "utf8");
  const siteIgnores = readFileSync(join(root, "..", ".gitignore"), "utf8");
  assert.match(ignores, /^\.dev\.vars\.\*$/m);
  assert.match(ignores, /^\.env\.\*$/m);
  assert.match(ignores, /^wrangler\.jsonc$/m);
  assert.match(siteIgnores, /^\/\.wrangler\/$/m);
  assert.match(siteIgnores, /^\/\.playwright-cli\/$/m);
});
