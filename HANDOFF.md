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

- Local path: `/Users/rong.lu/repo/groklab.github.io`
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
  `America/Chicago` timezone. Home and archive order posts newest first.
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
  remains exactly `真假维斯`.
- The theme control follows the system preference until a visitor chooses light
  or dark, then persists that choice under `groklab.theme.v1` in localStorage.
  It sets no cookie, makes no network request, and is hidden when JavaScript is
  unavailable while CSS continues to follow the system theme.
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

## Approved work in progress

The user approved the following release brief on 2026-08-30. Treat these as
requirements, while current files and the live site remain authoritative about
what has actually shipped:

- Implement an anonymous aggregate world map with a Cloudflare Worker, D1, a
  no-JavaScript hit pixel, and a server-rendered SVG. Store only coarse
  geographic counts; do not store raw IPs or stable hashes. Public locations
  require a minimum-count threshold and must never appear as individual visitor
  pins or precise locations.
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

The deploy-locked source lives in `visitor-map/`; it is not yet connected to
the Hugo footer and has not been provisioned on Cloudflare. Current properties:

- A dependency-free ESM Worker serves a strict no-JavaScript hit pixel, a
  server-rendered SVG, a Chinese text/table alternative, and static health
  response. There is no package manifest or client analytics script.
- D1 stores only UTC day, integer 15-degree latitude/longitude bands, and
  bounded aggregate counters. It has no event table, raw address, stable
  identifier, precise coordinate, path, referrer, user agent, or individual
  timestamp. Missing geography and write failures fail closed for counting.
- Public output is a rolling 90-day view. Cells below five page requests are
  omitted; visible counts are only `5-9`, `10-24`, `25-99`, or `100+`. This is
  request suppression, not a claim of five distinct visitors or k-anonymity.
- The map uses near-full 15-degree blue squares, never individual pins. Its
  transparent Natural Earth 1:110m coastline is generated locally from one
  SHA-256-pinned public-domain source; no map CDN is contacted at runtime.
- At most 20,000 eligible requests are accepted daily and each cell/day
  saturates at 2,000, bounding normal D1 writes near 40,000 rows/day before
  maintenance. Free-tier exhaustion is an availability failure, not permission
  to enable billing.
- `wrangler.template.jsonc` has invalid placeholders, disables workers.dev,
  previews, logs, and metrics, and is not auto-discovered. Real IDs belong only
  in ignored `visitor-map/wrangler.jsonc`; `.env*`, `.dev.vars*`, and local
  Wrangler state are ignored.
- Thirty-one Node tests plus a standard-library SQLite execution check cover the
  privacy contract, request gates, renderer, source provenance, SQL
  `RETURNING`, caps, thresholding, and observable retention failures. Pages CI
  runs both checks without installing packages.

Remaining release gates are deliberate: this machine currently has no verified
Cloudflare CLI/dashboard deployment identity. No Wrangler, workerd, Miniflare,
cloudflared, cached auth, or Cloudflare environment configuration was found;
the in-app browser connection was unavailable, so a possible login in an
ordinary browser could not be inspected. The owner must sign in to a free
account and the target must visibly be Workers Free. Before provisioning, pin
and run current Wrangler against local D1 to validate its config, migration,
bundle, scheduled handler, and request metadata. Then create D1, apply the
migration, deploy to `workers.dev`, verify all endpoints and quota settings,
and only afterward place the real endpoint in Hugo. Do not add a placeholder or
dead endpoint to the live site.

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

The aggregate query can read up to 25,920 retained rows in the theoretical
maximum, and Cloudflare's Cache API is data-center-local. A distributed abuser
could therefore exhaust a free daily read/request quota and make the map
temporarily unavailable. That must fail closed and remain a documented
availability trade-off; it must never trigger a paid upgrade.

## Decisions intentionally left open

Do not infer or implement these without a later explicit user decision:

| Decision | Current state |
| --- | --- |
| Custom domain | Not selected; no `CNAME` or DNS configuration |
| Anonymous visitor map deployment | Deploy-locked Worker/D1 source and tests exist; free-account identity, real Wrangler/D1 validation, provisioning, endpoint verification, and Hugo integration remain pending |
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
