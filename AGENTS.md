# Repository instructions

## Start each session here

- Read `HANDOFF.md` before planning or changing anything.
- Inspect the repository, current branch, working tree, recent commits, and remotes. Treat current files and Git state as authoritative if these instructions or the handoff have become stale.
- Summarize the current state and unresolved decisions before beginning implementation.
- Preserve user changes and unrelated work. Never rewrite public history or force-push.
- This machine may have more than one GitHub identity. Before any GitHub write, explicitly verify that the authenticated account is `groklab`; do not rely on the CLI default and never print credentials.

## Project purpose and current phase

- This repository is the future personal blog for the GitHub account `groklab`.
- It is a GitHub Pages user site intended to publish at `https://groklab.github.io/`.
- The bootstrap is deliberately implementation-neutral. No framework, static-site generator, theme, package manager, content model, deployment workflow, custom domain, analytics, comments, CMS, or license has been selected.
- Do not infer a product or architecture decision from an otherwise empty repository.

## Decision gates

Before scaffolding a site or installing dependencies:

1. Establish the blog's audience, purpose, initial content, authoring workflow, desired visual direction, and required features.
2. Present two or three suitable implementation options with a recommendation and concrete trade-offs in authoring experience, maintenance, performance, dependency load, and GitHub Pages deployment.
3. Obtain the user's choice of implementation stack and package manager.
4. Choose the Pages publishing method only after the stack is chosen.
5. Record material decisions and their rationale in `HANDOFF.md`.

Do not add any of the following without an explicit user decision:

- A `LICENSE` file or license metadata.
- A custom domain, `CNAME`, or DNS-dependent configuration.
- Analytics, comments, forms, a CMS, cookies, trackers, or another third-party service.
- A large theme, starter template, design system, or production dependency.
- Generated deployment output committed to the source branch.

## GitHub Pages constraints

- The repository name `groklab.github.io` is intentional and must not be changed. It gives the account its one user site at the root URL; an arbitrary repository name would instead be a project site under `/<repository-name>`.
- GitHub Pages serves static output. The deployable result must be HTML, CSS, JavaScript, and static assets; do not design around a persistent server-side runtime.
- The published source or artifact must contain `index.html`, `index.md`, or `README.md` at its top level.
- Branch publishing supports only the selected branch's repository root or `/docs` folder and uses Jekyll by default.
- A custom build or a generator other than the branch/Jekyll path should normally deploy through GitHub Actions. Decide this after selecting the stack.
- Treat the published site as public. Never commit or deploy secrets, credentials, private drafts, confidential data, or personal information not intended for publication.
- Build links and asset paths for the user-site root `/`, not a project-site prefix.
- Do not enable or reconfigure Pages until a publishing method and valid entry artifact exist.
- Do not claim deployment success from a push alone. Verify the deployment run, the live URL, and that the live content corresponds to the intended commit.

## Implementation and quality bar

- Prefer the smallest maintainable solution that satisfies the agreed product brief.
- Once a stack is chosen, document exact install, development, check, build, and preview commands in `README.md`, and update this file with any durable repository-specific rules.
- Commit the appropriate lockfile and keep dependency additions deliberate.
- Before pushing implementation changes, run every available formatter, linter, test, and production build. If a category does not exist, state that clearly.
- Inspect the production artifact and preview it in a real browser at narrow mobile and desktop widths.
- Check semantic structure, keyboard use, visible focus, accessible names, image alternatives, color contrast, responsive layout, internal links, asset loading, and missing-page behavior.
- Use the available frontend-design skill for the initial visual system or any substantial interface redesign.
- Keep source content separate from generated output unless the chosen deployment architecture explicitly requires otherwise.
- Keep commits focused and review `git status` and the staged diff before each commit or push.
- Update `HANDOFF.md` when a decision, deployment state, command, or next step materially changes.
