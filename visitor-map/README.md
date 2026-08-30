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

The public map covers today plus the preceding 89 UTC days. A 15-degree cell
is omitted until its aggregate reaches five. Visible counts are reduced to
`5-9`, `10-24`, `25-99`, or `100+`; an exact aggregate is never rendered.
The threshold suppresses low-volume cells but is not a k-anonymity guarantee:
five requests can come from fewer than five people. The map therefore never
labels its numbers as unique visitors.
The global daily circuit breaker accepts at most 20,000 requests, and each
cell/day counter saturates at 2,000. Origin and Fetch Metadata checks reduce
accidental noise but are not authentication because non-browser clients can
forge headers; the fixed write cap is the final abuse/cost boundary.

## Routes

| Route | Behavior |
| --- | --- |
| `GET /v1/pixel.svg` | Transparent 1 px, `no-store`; eligible GETs may increment one aggregate cell. HEAD never counts. |
| `GET /v1/map.svg` | Server-rendered, cacheable rolling 90-day SVG containing only thresholded 15-degree aggregate squares. |
| `GET /v1/map` | Keyboard- and screen-reader-friendly HTML table with the same coarse cells and count ranges. |
| `GET /healthz` | Static liveness response; it neither reads nor writes D1. |

Only `GET`, `HEAD`, and tightly scoped image-endpoint `OPTIONS` are supported.
The HTML summary is a top-level navigation, not a CORS API. Query strings are
rejected. Image endpoints require `crossorigin="anonymous"`, because that
causes the browser to send the exact Origin and CORS Fetch Metadata checked by
the Worker. Later Hugo integration can use this shape after deployment:

```html
<img src="https://WORKER.SUBDOMAIN.workers.dev/v1/pixel.svg"
     crossorigin="anonymous" referrerpolicy="no-referrer"
     alt="" width="1" height="1">
<img src="https://WORKER.SUBDOMAIN.workers.dev/v1/map.svg"
     crossorigin="anonymous" referrerpolicy="no-referrer"
     alt="Anonymous aggregate page-request map">
<a href="https://WORKER.SUBDOMAIN.workers.dev/v1/map">Text map summary</a>
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
cd /Users/rong.lu/repo/groklab.github.io/visitor-map
node --test test/*.test.mjs
python3 tools/check_sqlite.py
```

The committed path can be reproduced from the exact verified shapefile with:

```sh
python3 tools/generate_world_path.py /path/to/ne_110m_land.shp src/world-path.mjs
```

The Node tests mock D1 and the Worker execution context. They cover privacy
bucketing, thresholds and range caps, request validation, CORS, method and
query rejection, cache/security headers, circuit-breaker behavior, SQL binds,
scheduled retention, accessible output, configuration locks, and forbidden
schema/source fields. The Python check executes the migration and the exact SQL
templates extracted from the Worker against an in-memory SQLite database,
including `RETURNING`, saturation, thresholding, and pruning.

## Deployment remains deliberately locked

`wrangler.template.jsonc` is not a filename Wrangler auto-discovers. It also
contains invalid placeholder account/database values, has `workers_dev` and
preview URLs disabled, and disables observability/logs. Consequently this
directory cannot be deployed merely by running `wrangler deploy`.

If the owner later creates or signs into a free Cloudflare account, they must
review the then-current free-plan limits and terms before doing these explicit
external-write steps. These commands are documentation only and were not run:

```sh
cd /Users/rong.lu/repo/groklab.github.io/visitor-map
wrangler whoami
wrangler d1 create groklab-visitor-map
cp wrangler.template.jsonc wrangler.jsonc
# Replace every REPLACE_WITH_* value and deliberately set workers_dev to true.
wrangler d1 migrations apply DB --remote --config wrangler.jsonc
wrangler deploy --config wrangler.jsonc
```

The one-time Cloudflare actions require the owner to create/sign into an
account, accept any applicable terms, record the account ID and returned D1
database ID only in the ignored `wrangler.jsonc`, and choose the workers.dev
subdomain. No credential or external-service identifier belongs in Git.

The daily retention trigger deletes aggregate days older than the rolling
window. D1 Time Travel remains a platform-level recovery feature; if the
strictest possible deletion semantics are required, its then-current retention
behavior must be reviewed before deployment.
