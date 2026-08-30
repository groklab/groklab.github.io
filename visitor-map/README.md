# Anonymous aggregate visitor map

This directory is a self-contained Cloudflare Worker and D1 design for the
site's optional visitor map. It counts eligible **page requests, not people**.
It has no runtime dependencies, package manifest, lockfile, client script,
secret, account identifier, or deployable default configuration.

## Privacy boundary

An eligible `GET /v1/pixel.svg` request is accepted only when its exact origin
is `https://groklab.github.io` and its Fetch Metadata describes a cross-site
CORS image request. The Worker immediately converts Cloudflare's transient
country-edge latitude and longitude values to one of 12 by 24 fixed 15-degree
cells. Only these columns can reach D1:

- UTC aggregate day
- integer latitude band (0 through 11)
- integer longitude band (0 through 23)
- aggregate request count

There is no event table. The schema has no raw address, network header,
visitor identifier, stable digest, user-agent value, precise coordinate,
individual timestamp, path, or referrer. The implementation sets no cookies
and contains no application logging. Missing geography, storage errors, and a
tripped circuit breaker all fail closed for counting while the pixel remains a
valid transparent image.

The public map reads one all-time row per coarse cell and includes every cell
from its first successfully counted request. Visible counts are reduced to
`1-4`, `5-9`, `10-24`, `25-99`, or `100+`; an exact aggregate is never
rendered. Lowering the display threshold to one deliberately reveals that a
coarse cell received at least one counted request, but it still does not reveal
an IP, exact location, or unique visitor. The map never labels its numbers as
unique visitors.
The global daily circuit breaker accepts at most 20,000 requests, and each
cell/day counter saturates at 2,000. Origin and Fetch Metadata checks reduce
accidental noise but are not authentication because non-browser clients can
forge headers; the fixed write cap is the final abuse/cost boundary. The daily
rows are retained for 90 days only as a private rollback buffer. Database
triggers add every accepted daily increment to the all-time table before that
buffer is pruned.

## Routes

| Route | Behavior |
| --- | --- |
| `GET /v1/pixel.svg` | Transparent 1 px, `no-store`; eligible GETs may increment one aggregate cell. HEAD never counts. |
| `GET /v1/map.svg` | Server-rendered, accessible, cacheable all-time SVG containing 15-degree aggregate squares from the first accepted request. |
| `GET /healthz` | Static liveness response; it neither reads nor writes D1. |

Only `GET`, `HEAD`, and tightly scoped image-endpoint `OPTIONS` are supported.
The retired `/v1/map` document route returns 404. Query strings are rejected.
Image endpoints require `crossorigin="anonymous"`, because that
causes the browser to send the exact Origin and CORS Fetch Metadata checked by
the Worker. Hugo integration uses this shape:

```html
<img src="https://WORKER.SUBDOMAIN.workers.dev/v1/pixel.svg"
     crossorigin="anonymous" referrerpolicy="no-referrer"
     alt="" width="1" height="1">
<img src="https://WORKER.SUBDOMAIN.workers.dev/v1/map.svg"
     crossorigin="anonymous" referrerpolicy="no-referrer"
     alt="Anonymous aggregate page-request map">
```

The SVG uses no map CDN or runtime network dependency. Its quiet coastline is
generated locally from the Natural Earth 1:110m land shapefile; the source is
public domain, pinned by URL and SHA-256, and described in
`../THIRD_PARTY_NOTICES.md`. Each visible mark occupies almost the complete
15-degree cell so the visual communicates coarse aggregation rather than an
individual pin.

## Local verification

Node 20 or newer is sufficient. There is nothing to install and no command
contacts Cloudflare:

```sh
cd visitor-map
node --test test/*.test.mjs
python3 tools/check_sqlite.py
```

The committed path can be reproduced from the exact verified shapefile with:

```sh
python3 tools/generate_world_path.py /path/to/ne_110m_land.shp src/world-path.mjs
```

The Node tests mock D1 and the Worker execution context. They cover privacy
bucketing, the threshold-one range caps, request validation, CORS, method and
query rejection, versioned cache/security headers, circuit-breaker behavior,
SQL binds, rollback-buffer retention, accessible output, configuration locks,
and forbidden schema/source fields. The Python check executes both migrations
and the exact SQL templates extracted from the Worker against an in-memory
SQLite database, including `RETURNING`, trigger bridging, saturation,
all-time reads, and pruning that never subtracts from lifetime totals.

## Deployment remains deliberately locked

Production already uses exactly one Workers Free service and one D1 Free
database named `groklab-visitor-map`. `wrangler.template.jsonc` remains a
non-deployable template: it contains invalid placeholder IDs, has a nonstandard
filename that Wrangler does not discover, and explicitly disables workers.dev,
preview URLs, logs, metrics, and telemetry. There is intentionally no
`wrangler.jsonc`, account ID, database ID, public endpoint, or credential in
this repository. `.gitignore` rejects common local Wrangler config variants and
`.wrangler/` state.

Do not run another `d1 create` or create a second Worker. Approved maintenance
must first verify the intended Cloudflare account, re-check the current free
plan, and use a reviewed temporary configuration outside the checkout with
autoprovisioning disabled. Apply only pending migrations explicitly with
`--remote`, perform a strict dry run, deploy the existing service, verify its
routes and inventory, then log out and remove the temporary credentials. No
credential or external-service identifier belongs in Git.

The scheduled handler deletes daily rollback-buffer rows older than 90 days and
expired daily-budget rows. It never deletes from the all-time aggregate table.
D1 Time Travel remains a platform-level recovery feature; if the strictest
possible deletion semantics are required, its then-current retention behavior
must be reviewed before deployment.
