# Repository instructions

## Start each session here

- Read `HANDOFF.md` before planning or changing anything.
- Inspect the repository, current branch, working tree, recent commits, remotes,
  GitHub Pages settings, and recent Actions runs when relevant. Treat current
  files and Git state as authoritative if this file or the handoff is stale.
- Summarize the current state and genuinely unresolved decisions before work.
- Preserve user changes and unrelated work. Never rewrite public history or
  force-push.
- This machine may have more than one GitHub identity. Before every GitHub
  write, explicitly switch to and verify `groklab`; never rely on the CLI
  default and never print credentials. Restore the previously active identity
  afterward.

## Project and fixed architecture

- This repository is the public GitHub Pages user site for `groklab`, published
  at `https://groklab.github.io/`. Do not rename the repository or introduce a
  project-site path prefix.
- The visible site name and accessible brand name are exactly `真假维斯`. Its
  visible secondary tagline is exactly `real jarvis`; keep the accessible link
  name as `真假维斯`.
- The generator is Hugo Extended 0.165.0 with custom, repository-local
  templates and CSS. There is no theme, JavaScript runtime, JS package manager,
  package manifest, or lockfile.
- GitHub Actions builds and deploys the static `public/` artifact. Generated
  output remains ignored and must not be committed.
- Root-relative asset paths are intentional because this is a user site at `/`.
- `America/Chicago` is the site timezone. Published dates include an explicit
  UTC offset and control both ordering and the visible timestamp.

## Content conventions

- Posts are Markdown page bundles at `content/posts/<slug>/index.md`.
- Slugs use lowercase ASCII words separated by hyphens. Once published, keep a
  slug stable so its `/posts/<slug>/` permalink does not change.
- Required front matter is `title`, `date`, `draft`, and `slug`. A production
  post uses `draft: false`; CI rejects drafts and future publication dates.
- Create a post with `hugo new content posts/<slug>/index.md`.
- Put post images beside `index.md`. Every image requires meaningful alt text;
  an optional Markdown image title becomes its caption. Hugo produces
  responsive WebP variants for processable local images.
- Use `\(...\)` for inline math and `\[...\]` or `$$...$$` for display math.
  Hugo renders it to MathML at build time; invalid math fails the build.
- The home page and `/posts/` show posts newest first. Do not silently change
  the first post's title or exact supplied body.

## Visual and accessibility rules

- Keep the design restrained, Nordic, editorial, and typography-led. Retain the
  thin true/false axis as the visual signature; avoid cards, gradients, heavy
  shadows, pill-heavy UI, ornamental motion, and generic template styling.
- Chinese text uses the self-hosted, unmodified LXGW WenKai GB font. Latin text
  uses Newsreader and math uses STIX Two Math. The user explicitly chose
  typography quality over the full Chinese font's mobile transfer size.
- Add no font whose redistribution or web-embedding rights are unclear. Keep
  font licenses, upstream versions, and checksums in
  `THIRD_PARTY_NOTICES.md`; do not rename reserved font names.
- Preserve semantic structure, keyboard access, visible focus, meaningful image
  alternatives, sufficient contrast, reduced-motion behavior, safe-area
  insets, and layouts that work without horizontal page scrolling at 320 px.
- There is deliberately no client JavaScript. Do not add it when HTML, CSS,
  MathML, or Hugo build-time processing can solve the problem.

## Local commands and quality gate

Use Hugo Extended 0.165.0 and Python 3:

```sh
hugo server --buildDrafts --disableFastRender
python3 scripts/check_content.py
hugo --cleanDestinationDir --gc --minify --panicOnWarning
python3 scripts/check_site.py public
```

Before pushing implementation changes:

- Run the content check, strict production build, and artifact check above.
- Run `git diff --check` and review `git status`, the staged diff, and staged
  file sizes before every commit.
- Preview the production artifact in a real browser at narrow iOS/Android-like
  widths and desktop width. Check the homepage, archive, post, 404, keyboard
  focus, semantics, contrast, internal links, assets, images, MathML, RSS, and
  missing-page behavior.
- Python validation scripts use only the standard library. No separate project
  formatter, linter, or unit-test framework exists; state that accurately
  rather than implying those categories ran.
- For deployment, verify the Actions run, its source commit, the Pages
  deployment, and the live content. Never infer success from a push alone.

## Change boundaries

- Prefer the smallest maintainable change that satisfies the agreed product
  brief. Keep source content separate from generated output and commits focused.
- Keep this file and `HANDOFF.md` evergreen when architecture, commands,
  deployment state, or durable content rules change.
- Do not add a project `LICENSE` or license metadata without an explicit user
  decision. Third-party notices and bundled upstream font license files are
  required and do not license the site's own code or content.
- Do not add a custom domain, `CNAME`, analytics, comments, forms, CMS, cookies,
  trackers, search service, or another third-party service without explicit
  approval.
- Never commit secrets, credentials, private drafts, confidential data, or
  personal information that is not intended to be public.
