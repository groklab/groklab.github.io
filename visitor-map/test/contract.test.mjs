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

test("D1 schema permits only daily aggregate keys and bounded counters", () => {
  const migrationNames = readdirSync(join(root, "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(migrationNames, ["0001_aggregate_counts.sql"]);
  const schema = migrationNames
    .map((name) => readFileSync(join(root, "migrations", name), "utf8"))
    .join("\n");
  assert.match(schema, /CREATE TABLE cell_day/);
  assert.match(schema, /PRIMARY KEY \(day, lat_band, lon_band\)/);
  assert.match(schema, /lat_band BETWEEN 0 AND 11/);
  assert.match(schema, /lon_band BETWEEN 0 AND 23/);
  assert.match(schema, /hits BETWEEN 1 AND 2000/);
  assert.match(schema, /accepted BETWEEN 1 AND 20000/);
  assert.doesNotMatch(schema, /\b(ip|address|user_agent|visitor_id|digest|latitude|longitude|timestamp|referrer|path)\b/i);
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
  assert.match(source, /HAVING SUM\(hits\) >= \?3/);
  assert.match(source, /DAILY_REQUEST_LIMIT = 20_000/);
});

test("Wrangler template is visibly locked and disables logs", () => {
  const config = readFileSync(join(root, "wrangler.template.jsonc"), "utf8");
  assert.match(config, /REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID/);
  assert.match(config, /REPLACE_WITH_D1_DATABASE_ID/);
  assert.match(config, /"workers_dev": false/);
  assert.match(config, /"preview_urls": false/);
  assert.match(config, /"send_metrics": false/);
  assert.match(config, /"observability"[\s\S]*"enabled": false/);
  assert.match(config, /"logs"[\s\S]*"enabled": false/);
  assert.match(config, /"invocation_logs": false/);
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
  assert.match(ignores, /^\.dev\.vars\.\*$/m);
  assert.match(ignores, /^\.env\.\*$/m);
  assert.match(ignores, /^wrangler\.jsonc$/m);
});
