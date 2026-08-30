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
- Local dependencies: Hugo and Python 3 only; no JS package manager
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
- There is no JavaScript package manager, client-side JavaScript, external font
  CDN, theme, starter, or production package dependency.
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
- The visual system is custom Nordic minimalism: cold paper tones, dark ink,
  restrained fjord green, generous space, and a one-pixel true/false axis. It
  deliberately avoids cards, gradients, shadows, and decorative motion.
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

## Decisions intentionally left open

Do not infer or implement these without a later explicit user decision:

| Decision | Current state |
| --- | --- |
| Custom domain | Not selected; no `CNAME` or DNS configuration |
| Analytics or visitor map | The user asked about footer statistics and a world map; no service, privacy model, or implementation has been selected |
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
