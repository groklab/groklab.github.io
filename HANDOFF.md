# Handoff: `groklab.github.io` personal blog

Last updated: 2026-08-29

## Mission

Create a personal blog for the GitHub account `groklab`, hosted as its GitHub Pages user site at:

`https://groklab.github.io/`

This bootstrap establishes the repository and Codex working context only. It intentionally does not implement or publish a blog.

## Why this repository name

GitHub Pages distinguishes user sites from project sites:

- A user site must use the repository name `<owner>.github.io`.
- For this account, the required name is therefore `groklab.github.io`.
- Its default URL is `https://groklab.github.io/`.
- A repository with another name could still host a project site, but its default URL would be `https://groklab.github.io/<repository-name>/`.
- A repository named only `groklab` with a root `README.md` would customize the GitHub profile; it would not be this website.

For the requested personal root site, the repository name is required, not optional.

## Bootstrap state

At handoff, verify these statements against Git and GitHub before relying on them:

- Local path: `/Users/rong.lu/repo/groklab.github.io`
- Remote repository: `https://github.com/groklab/groklab.github.io`
- Default branch: `main`
- Repository visibility: public
- Bootstrap files: `AGENTS.md` and `HANDOFF.md`
- No framework, package manager, dependencies, theme, site code, generated site, or content structure has been selected.
- No site entry file exists. A `README.md` was deliberately omitted so the bootstrap cannot become an accidental placeholder homepage.
- GitHub automatically configured Pages when this specially named public repository was pushed. Verified configuration: legacy branch build from `main` `/`, HTTPS enforced, and default URL `https://groklab.github.io/`. The bootstrap build completed successfully; that confirms the deployment machinery only, because no blog entry page has been implemented.
- That automatic branch setting is not a final architecture choice. Recheck its current status, then either retain it for a compatible branch/Jekyll approach or replace it with GitHub Actions after the stack is selected.
- No custom domain, analytics, comments, CMS, external forms, or license has been chosen.

This machine has multiple GitHub identities. Any API or remote write must explicitly use and verify the `groklab` identity. Never display an authentication token, and restore the previously active CLI identity after the write.

## Decisions already made

- Owner: `groklab`
- Site type: GitHub Pages user site
- Repository: `groklab/groklab.github.io`
- Intended default URL: `https://groklab.github.io/`
- Hosting target: GitHub Pages
- Bootstrap should remain framework-neutral until the next session establishes requirements.

## Decisions intentionally left open

| Decision | Resolve before |
| --- | --- |
| Blog goals, audience, voice, and launch content | Writing the information architecture or final copy |
| Visual direction and reference sites | Establishing typography, color, layout, or a theme |
| Authoring workflow and content format | Selecting a framework or content model |
| Framework or static-site generator | Installing dependencies or scaffolding |
| Package manager | Creating dependency metadata or a lockfile |
| Branch publishing versus GitHub Actions | Configuring GitHub Pages |
| URL and permalink policy | Publishing real posts |
| Custom domain | Adding `CNAME`, DNS, or canonical-domain configuration |
| Analytics, comments, forms, search, or CMS | Adding third-party services |
| Content and code licensing | Adding `LICENSE` or license metadata |

## Focused checklist for the first real Codex session

1. Read `AGENTS.md` and this handoff.
2. Verify the local and remote state:
   - `pwd`
   - `git status --short --branch`
   - `git remote -v`
   - `git log --oneline --decorate -5`
   - Confirm the remote owner and authenticated write identity are `groklab`.
3. Establish a compact product brief with the user:
   - Who the blog is for and what it should communicate.
   - Initial sections and the first real content to publish.
   - Preferred writing workflow, such as Markdown in Git versus browser editing.
   - Visual mood, reference sites, available bio, headshot, and other assets, and accessibility needs.
   - Required launch features and features that can wait.
   - Whether a custom domain is wanted now or later.
4. Propose two or three appropriately sized architecture options. Compare authoring experience, maintenance burden, design flexibility, performance, dependencies, and the GitHub Pages deployment path.
5. Recommend one option, obtain the user's decision, and record it here before scaffolding.
6. Build the smallest complete vertical slice after the decision: a production build, home-page experience, one representative content route, responsive behavior, and a usable missing-page path.
7. Run the chosen stack's checks and production build, then inspect the production preview in a browser on mobile and desktop.
8. Configure GitHub Pages only when the deployment artifact and method are ready.
9. Verify the Pages workflow and live URL rather than assuming a successful push means a successful publication.
10. Add a practical `README.md` with authoring, development, validation, build, and deployment instructions; update this handoff with the next concrete step.

If the user has already supplied any of the requested product information, do not ask for it again. Summarize it, identify only the genuinely unresolved decisions, and continue.

## GitHub Pages facts relevant to the design

- Pages publishes static files and does not provide a persistent server-side runtime.
- Branch publishing can use only `/` or `/docs`; GitHub Actions supports custom builds.
- The publishing source or deployed artifact needs a top-level `index.html`, `index.md`, or `README.md`.
- A Pages site is publicly accessible even when a paid plan permits a private source repository.
- Publishing may take several minutes, so deployment should be verified through both Actions and the live URL.

## Reddit thread audit

The supplied Reddit thread points in the right direction but mixes several different GitHub features:

- The comment recommending `username.github.io` is correct for a user site.
- The comment recommending a repository named only after the username plus a `README.md` describes a profile README, not a website.
- The claim that GitHub is not a website host is incorrect; GitHub Pages is a static-site hosting service. The commenter later acknowledged not knowing about Pages.
- The thread's advice to select `main` in Pages settings is only one deployment path. Current GitHub documentation also supports custom GitHub Actions workflows.
- `pages.github.com` gets the naming rule right, but parts of its project-site settings walkthrough show older UI. Use the current GitHub Docs for exact deployment steps.

## Sources reviewed for the bootstrap

- [GitHub community discussion supplied by the user](https://www.reddit.com/r/github/comments/1gxr8bk/how_to_create_github_website_portfolio/)
- [GitHub Pages documentation](https://docs.github.com/en/pages)
- [GitHub Pages getting-started site](https://pages.github.com/)
- [GitHub: What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub: Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [GitHub: Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [OpenAI: Custom instructions with `AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
