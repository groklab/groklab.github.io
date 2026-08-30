# Handoff: `groklab.github.io` personal blog

Last updated: 2026-08-30

## Mission

Maintain and publish the public personal blog `真假维斯` for the GitHub account
`groklab` at <https://groklab.github.io/>. It is a quiet writing space for short
or long notes in the author's own voice, with the newest writing immediately
visible.

The repository name is required for a GitHub Pages user site at the account's
root URL. Do not rename it or introduce a project-site prefix.

## Authoritative repository state

Verify this state at the start of each session rather than trusting it blindly:

- Local path: the root of the current checkout; do not record a machine-specific
  home-directory path
- Remote: `https://github.com/groklab/groklab.github.io`
- Default/source branch: `main`
- Visibility: public
- Generator: Hugo Extended 0.165.0
- Local tools: Hugo, Python 3, and Node.js 20+; no JS package manager or
  installed JavaScript package dependency
- Source content: Markdown page bundles under `content/posts/`
- Production output: generated `public/`, ignored by Git
- Deployment: custom GitHub Actions workflow in `.github/workflows/pages.yml`
- Canonical production URL: `https://groklab.github.io/`

This machine has multiple GitHub identities. Before every remote or API write,
explicitly switch to and verify `groklab` without displaying credentials, then
restore the previously active account.

## Product and architecture decisions

Decisions made on 2026-08-30:

- The site name is exactly `真假维斯` in the wordmark, metadata, and accessible
  name. The secondary wordmark line is exactly `real jarvis`; it is visual
  decoration, while the accessible home-link name remains `真假维斯`.
- Hugo was selected over Astro and Jekyll for a small static binary toolchain,
  native Markdown/page-bundle image processing, and build-time MathML.
- There is no JavaScript package manager, external font CDN, third-party theme,
  starter, or production package dependency. The sole client script is the
  repository-local, dependency-free light/dark control; Hugo minifies and
  fingerprints it, and every page loads it with SHA-384 SRI before the CSS.
- GitHub Actions is the publishing method because a custom Hugo build is
  required. Pull requests validate without deploying; pushes to `main` deploy
  only after all checks pass.
- Posts use `/posts/<slug>/`, a stable slug, and an explicit timestamp in the
  `America/Chicago` timezone. Human-facing timestamps say `Houston, TX`, while
  machine HTML and RSS retain the DST-aware UTC offset. Home and archive order
  posts newest first.
- Colocated Markdown images require non-empty alternative text. Processable
  images receive responsive WebP sources, intrinsic dimensions, lazy loading,
  and optional captions.
- LaTeX-style delimiters are transformed to MathML during the Hugo build. The
  public site needs no math JavaScript or CDN.
- The visual system is the custom `Counterpoint Axis`: mineral paper, dark ink,
  one structural blue datum, one red latest-post joint, and one ochre footer
  field. It borrows De Stijl's asymmetrical balance and functional color while
  preserving the site's quiet Nordic/editorial character; it deliberately
  avoids literal painting grids, cards, gradients, shadows, and decorative
  motion.
- The wordmark's `real jarvis` line is split across the same datum, with `real`
  beneath `真` and `jarvis` beneath `假维斯`. The accessible home-link name
  remains exactly `真假维斯`. A one-pixel optical correction aligns the left
  edge of `jarvis` with `假` without moving the shared structural datum.
- The theme control follows the system preference until a visitor chooses light
  or dark, then persists that choice under `groklab.theme.v1` in localStorage.
  It sets no cookie, makes no network request, and is hidden when JavaScript is
  unavailable while CSS continues to follow the system theme. Its visible
  state words are `明` and `暗`, avoiding the time-of-day ambiguity of `日` and `夜`.
- The Chinese font is the unmodified LXGW WenKai GB 1.522 TTF under SIL OFL
  1.1. The user explicitly prioritizes its elegant contemporary-kai appearance
  over its roughly 25 MB mobile transfer cost.
- Latin text uses the unmodified Newsreader 1.003 variable WOFF2 files; math
  continues to use STIX Two Math. Both are under SIL OFL 1.1, and sources and
  checksums are recorded in `THIRD_PARTY_NOTICES.md`. Newsreader was selected
  for a more distinctive editorial voice than STIX Two Text while remaining
  classic, readable, and harmonious with LXGW WenKai GB.
- 得到今楷 is not used because it is exclusive to 得到. 仓耳今楷 is not used
  because clear redistribution and web-embedding permission was not established.
- The favicon is an original code-native 16 px Mondrian-inspired pixel
  composition in the site's five-color palette. SVG, multi-size ICO, 32 px PNG,
  and 180 px Apple touch variants are committed so browsers do not fall back to
  a generic globe.

## Approved work in progress

The user approved the following release brief on 2026-08-30. Treat these as
requirements, while current files and the live site remain authoritative about
what has actually shipped:

- Implement an anonymous aggregate world map with a Cloudflare Worker, D1, a
  no-JavaScript hit pixel, and a server-rendered SVG. Store only coarse
  geographic counts; do not store raw IPs or stable hashes. Public locations
  appear from the first accepted request as coarse ranges and must never appear
  as individual visitor pins or precise locations.
- Keep `AGENTS.md` and this handoff evergreen, make focused commits, and verify
  every pushed Pages release against its exact source commit and live output.

The visual selection is complete. Three anonymized proposals were rendered at
desktop/mobile widths in light/dark modes and scored independently by GREEN,
CYAN, and BLUE. `Counterpoint Axis` (blind code `XQ7`) received two of three
first-place votes and narrowly led the aggregate score, 276 to 274. Its source
implementation incorporates the judges' common fixes: one-pixel datum
alignment, a 44 px text-labelled theme control, 12 px mobile metadata on the
content side of the axis, larger tagline text, higher dark-mode contrast, and
no production placeholder copy.

## Launch content and features

- The first post is `content/posts/hello-world/index.md`.
- Its title is exactly `hello world`.
- Its body is exactly:
  `AI时代，我突然想让自己写点东西。可多可少。未必是好的写作，但力争是我自己的写作。开始罢。`
- The site includes a home page, complete post archive, post pages, a designed
  404, one canonical RSS feed, sitemap, and robots file.
- Semantic HTML, keyboard focus, reduced-motion support, safe-area insets,
  narrow-screen layout, image alternatives, and no-horizontal-scroll behavior
  are launch requirements.

## Commands

```sh
hugo new content posts/<slug>/index.md
hugo server --buildDrafts --disableFastRender
python3 scripts/check_content.py
python3 scripts/check_visitor_map_integration.py
node --test visitor-map/test/*.test.mjs
python3 visitor-map/tools/check_sqlite.py
hugo --cleanDestinationDir --gc --minify --panicOnWarning
python3 scripts/check_site.py public
```

See `README.md` for the beginner-oriented writing and publishing workflow.

## Verified deployment state

The first production launch was verified on 2026-08-30:

- The implementation and pipeline baseline is commit
  `1409008c8894bd08f746af82edf19d9f845b4cf2`.
- GitHub Pages reports `workflow` as its publishing source with HTTPS enforced.
- Workflow run `33296489305`, dispatched after the source switch, built and
  deployed that exact commit successfully.
- The live root and archive return HTTP 200; an unknown route returns HTTP 404
  with the custom Chinese missing-page content.
- The live root, first post, CSS, icons, all four font files, RSS, sitemap, and
  robots file were downloaded and validated. The live root, first-post HTML,
  and fingerprinted CSS were byte-for-byte identical to the local strict Hugo
  production artifact.
- A real browser loaded the self-hosted LXGW and STIX fonts, reported no console
  warnings or errors, contained no client scripts, and had no horizontal page
  overflow at 390, 412, or 1440 CSS pixels.

There was one launch-only race worth preserving: the push began both the former
legacy Jekyll build and the new custom workflow before the Pages source switch
completed. Although both succeeded, the later legacy deployment temporarily
served `README.md`. Re-dispatching the custom workflow after Pages reported
`build_type: workflow` replaced it with the correct Hugo artifact. Future pushes
should trigger only `.github/workflows/pages.yml`.

For every later release, repeat the same gate: verify the workflow head SHA,
both jobs, Pages source, live content, assets, and missing-page response. The
current Actions run is the authoritative record for documentation-only commits
made after the production baseline above.

The typography and secondary-wordmark update was verified on 2026-08-30:

- Commit `08fd4b073aadb9bcdb49b2f10c9fc22b7c47deca` added the visible
  `real jarvis` tagline and replaced STIX Two Text with Newsreader 1.003.
- Workflow run `33319884594` built and deployed that exact commit; both jobs
  completed successfully while Pages remained in workflow mode with HTTPS
  enforced.
- The live root returned HTTP 200 and the custom missing route returned HTTP
  404. The live root and fingerprinted CSS were byte-for-byte identical to the
  local strict build; both live Newsreader files matched their recorded hashes.
- A live 390 px browser loaded Newsreader and LXGW WenKai GB, showed the exact
  tagline, had no horizontal overflow, loaded no client scripts, and emitted no
  console warnings or errors.

The selected Counterpoint visual system was verified on 2026-08-30:

- Commit `251afae26d102d7276402539badd7a8b05d082cb` implemented the blind-review
  winner, split the tagline across the axis, and added the persistent theme
  control.
- Workflow run `33323043105` built and deployed that exact commit successfully.
- The live root, post, CSS, and theme script were byte-for-byte identical to a
  strict local build. Browser checks at 320 px in both themes found exact datum
  alignment, no overflow, correct theme persistence, loaded fonts, no external
  requests, and no console errors.

## Anonymous visitor-map implementation state

The deploy-locked source lives in `visitor-map/`. The committed Hugo
configuration remains strictly default-off, while production is enabled only
through the paired GitHub Actions variables. One Workers Free service and one
D1 Free database, both named `groklab-visitor-map`, now back the live footer;
the verified public origin remains only in the repository variable. Current
properties:

- A dependency-free ESM Worker serves a strict no-JavaScript hit pixel, a
  server-rendered accessible SVG, and a static health response. The former HTML
  text/table route is retired and returns 404. There is no package manifest or
  client analytics script.
- D1 stores only UTC days for rollback and budgeting, integer 15-degree
  latitude/longitude bands, bounded aggregate counters, and a 90-day private
  daily rollback buffer. It has no event table, raw address, stable identifier,
  precise coordinate, path, referrer, user agent, or individual timestamp.
  Missing geography and write failures fail closed for counting.
- Public output is all-time from the original map launch. Cells display from
  their first successfully counted page request; visible counts are only
  `1-4`, `5-9`, `10-24`, `25-99`, or `100+`. The lower threshold deliberately
  reveals that one coarse 15-degree cell received a counted request, but never
  an exact location or unique visitor.
- The map uses code-native cinnabar winged-cup marks inspired by the Eastern
  Jin `曲水流觞` tradition. Each mark represents a 15-degree region; a compact
  five-swatch HTML legend maps increasingly large, increasingly vivid,
  theme-safe cinnabar cups to the cumulative bands, and one to five separated
  water ripples add a second redundant non-color encoding without unreadable
  in-mark text or a continuous color bar. It never
  claims an individual or precise-location pin. Its transparent
  Natural Earth 1:110m coastline is generated locally from one SHA-256-pinned
  public-domain source; no map CDN is contacted at runtime.
- At most 20,000 eligible requests are accepted daily and each cell/day
  saturates at 2,000. A trigger bridges each accepted daily increment into the
  all-time table, bounding normal D1 writes near 60,000 rows/day before
  maintenance. Free-tier exhaustion is an availability failure, not permission
  to enable billing.
- `wrangler.template.jsonc` has invalid placeholders, disables workers.dev,
  previews, logs, metrics, and source-map uploads, requires minification so
  local build paths do not enter the uploaded bundle, and is not
  auto-discovered. During the approved one-time deployment, real IDs and auth
  live only in a temporary `/tmp` configuration; no deployable
  `wrangler.jsonc` remains in the workspace. Root and Worker-local Wrangler
  caches plus browser-QA session artifacts are ignored so account metadata or
  transient screenshots cannot be staged accidentally.
- Node tests plus a standard-library SQLite execution check cover the privacy
  contract, request gates, renderer, source provenance, SQL `RETURNING`, caps,
  all-time trigger bridging, and observable retention failures. Pages CI runs
  both checks without installing packages.
- Hugo keeps a two-key `enabled: false` plus empty-origin latch in committed
  configuration. The partial rejects malformed or half-enabled states. Its
  enabled form emits one eager pixel and one lazy 720 by 360 SVG on ordinary
  pages, while the 404 remains collection-free.
- The artifact checker proves both states, forbids all unexpected external
  active resources, and accepts the pixel as the only empty-alt exception.
  GitHub Actions can enable production only through the paired public
  `VISITOR_MAP_ENABLED` and `VISITOR_MAP_ORIGIN` repository variables.
- The external SVG retains per-region titles in its markup, while the embedded
  `<img>` exposes a truthful aggregate-level alternative rather than dynamic
  per-region rows. Fully mirroring live region rows into the page's
  accessibility tree would require a second client data path, which remains
  outside the approved no-JavaScript collection architecture.

The Cloudflare deployment was verified with Wrangler 4.127.1, pinned from npm
with its registry SHA-512 integrity checked. Device-flow OAuth and the real
account/database IDs were isolated under `/tmp`; no global Wrangler
configuration, workspace deployment config, or project package-manager file was
created. The account-specific official Workers plans page visibly showed
Workers Free at $0. Every autoconfiguration and experimental auto-provision flag
was explicitly disabled.

The pre-deploy D1 inventory was empty. Deployment created exactly one named D1
without mutating repository configuration, applied `0001_aggregate_counts.sql`
with explicit `--remote`, and uploaded exactly one Worker with `--strict`.
Post-deploy inventory still showed one Worker and one D1, with no migration
pending. The Worker has only the `DB` binding, the daily `17 7 * * *` retention
cron, workers.dev enabled, preview URLs disabled, Logpush disabled, no Tail
Worker or live tail session, and no Workers Logs observability object. The
effective Workers Logs parent is off; Cloudflare represents that disabled state
as `observability: null` rather than exposing the nested disabled values.

The initial pre-retirement route checks covered health, the former text route,
the SVG map, HEAD pixel behavior, CORS/Fetch Metadata, OPTIONS, unsupported
methods, wrong origins, query rejection, security headers, and the former empty
threshold state. A single real browser page load then exercised the eligible
no-JavaScript pixel and produced a nonzero aggregate D1 counter without
disclosing its precise cell. This is only page-request counting, not a
unique-visitor measurement.

The deploy-locked source was committed and verified on 2026-08-30:

- Commit `4ebd9ad796c8f9943475aa6e938af31bce84d586` added the Worker, D1
  migration, Natural Earth generator, tests, CI gate, and documentation without
  a real Cloudflare ID or endpoint.
- Workflow run `33324485846` built and deployed that exact commit; both jobs and
  the new visitor-map validation step succeeded while Pages remained in
  workflow mode with HTTPS enforced.
- The live root and post returned 200, the custom missing route returned 404,
  and live HTML/CSS/theme-JS bytes matched the strict local artifact. The live
  root contained no `workers.dev`, pixel, map, or visitor-service endpoint.

Commit `a018a14` added the default-off Hugo integration, strict artifact checker,
negative integration suite, and variable-controlled Actions path. Commit
`dff95ce` documented its release gates. Workflow run `33325924825` validated and
deployed that exact commit with the production variables still off. The first
enabled release was subsequently verified at 320, 390, and 1440 CSS pixels, then
temporarily disabled while its personalized Worker origin was retired. The
privacy-cleanup workflow runs and their artifacts were deleted, so their IDs are
intentionally not retained here.

The all-time release added one additive D1 migration and preserves the original
daily rows for a 90-day rollback window. Its backfill and triggers were applied
and validated remotely before the Worker was updated. The account workers.dev
subdomain was replaced with a neutral value; the old personalized hostname no
longer serves the Worker. The paired production Actions variables retain the
verified neutral origin outside the repository. No account ID, database ID,
credential, or deployable Wrangler configuration is committed.

The all-time, identity, and favicon release was verified on 2026-08-30:

- Implementation commit `cb548eab207d8b72f3fc6b5e4a6a29a17372bfc7`
  changed the public threshold to one, moved public reads to lifetime totals,
  retired the HTML route, hardened map HEAD requests against uncached D1 reads,
  changed the theme words to `明` and `暗`, aligned `jarvis`, and installed the
  original multi-format favicon set.
- Workflow run `33335395389` built and deployed that exact commit; both jobs
  succeeded while Pages remained in workflow mode with HTTPS enforced.
- Fourteen live HTML, feed, metadata, CSS, JavaScript, and icon artifacts were
  byte-for-byte identical to the strict enabled local build. Ordinary pages
  contained exactly the pixel and SVG routes, the custom 404 contained neither,
  and the retired document route returned 404.
- Live Edge checks at 320, 390, and 1440 CSS pixels loaded the map, favicon,
  LXGW WenKai GB, and Newsreader; preserved the 2:1 map, one-pixel wordmark
  correction, theme labels and persistence; and found no horizontal overflow,
  console warning, or error. Edge emitted one informational lazy-image notice.
- Direct Worker checks returned 200 for health, SVG map, map HEAD, and pixel
  HEAD; 403 for a wrong origin; and 404 for the retired document route. The old
  personalized hostname was unreachable.
- The current indexed tree, deployed artifacts, live pages, and final Worker
  bundle contain none of the audited name, email, personal-path, old-hostname,
  or credential patterns. The prior privacy-bearing Actions runs and artifacts
  were deleted.

The winged-cup map Worker was updated in place on 2026-08-30. Wrangler 4.127.1
found no pending migration, retained exactly one D1 database, disabled
autoconfiguration and experimental provisioning, minified the upload, and did
not upload its locally generated source map. The upload contains the
`all-time-v6-scaled-winged-cup-ripples` cache policy and no known personal path,
identity pattern, or identifying request-header reference. Live health and an
eligible map GET returned the new winged-cup SVG without requesting the
counting pixel. The isolated OAuth session was then logged out and no OAuth
token field remained in its temporary configuration.

Historical Git objects still contain values deleted from the current tree.
Removing those objects would require rewriting public history and force-pushing,
which this repository explicitly prohibits. Do not claim complete historical
erasure unless the owner separately authorizes that destructive exception;
current files and live surfaces are clean.

The all-time aggregate query reads at most 288 coarse-cell rows, and
Cloudflare's Cache API is data-center-local. A distributed abuser
could therefore exhaust a free daily read/request quota and make the map
temporarily unavailable. That must fail closed and remain a documented
availability trade-off; it must never trigger a paid upgrade.

## Decisions intentionally left open

Do not infer or implement these without a later explicit user decision:

| Decision | Current state |
| --- | --- |
| Custom domain | Not selected; no `CNAME` or DNS configuration |
| Anonymous visitor map deployment | Live on one Workers Free service and one D1 Free database through paired Actions variables; committed Hugo config remains default-off, and clearing both variables plus redeploying is the rollback |
| Comments, forms, search, or CMS | Not selected |
| Project/content license | Not selected; third-party font licenses only |
| Author bio, portrait, social links, or additional sections | Not supplied |

## Durable safeguards

- Treat the deployed site as public. Never commit private drafts, secrets,
  credentials, or information not meant for publication.
- Do not commit generated `public/` output.
- Keep action references and the Hugo archive checksum pinned; revalidate them
  deliberately when upgrading.
- Preserve the exact brand and first-post copy unless the user requests a change.
- A successful push is not deployment evidence. Verify Actions, Pages, the live
  URL, and the source commit.
