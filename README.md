# Rishi Raj Singh Chauhan — Portfolio & Writeups

A dark editorial portfolio and writeup site for Rishi Raj Singh Chauhan, built
with Astro and deployed as a static site on GitHub Pages.

- **Live site:** <https://rrschauhan07.tech/>
- **Online Studio:** <https://rrschauhan07.tech/admin/>
- **Repository:** <https://github.com/rrschauhan07/Portfolio>

The public site has two destinations:

- **Writeups** at `/` — featured note and the full archive.
- **About** at `/about/` — profile and contact links.

Individual writeups live at `/writeups/<slug>/`. The public header intentionally
links only to Writeups and About.

## Features

- Static, fast-loading Astro site with a dark editorial design.
- Markdown/MDX writeups via Astro content collections.
- Draft, featured, and sample-content states.
- RSS feed and automatic sitemap.
- Custom 404 page.
- Responsive layout and accessible navigation.
- Online Studio at `/admin/` for publishing from any browser.
- Optional local Studio for offline editing without deploying an admin server.
- GitHub Pages deployment through GitHub Actions.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | [Astro](https://astro.build/) — static output |
| Content | Astro content collections; Markdown and MDX |
| Styling | Hand-written CSS tokens in `src/styles/global.css` |
| Article styles | `src/styles/prose.css` |
| Feeds | `@astrojs/rss` and `@astrojs/sitemap` |
| Online dashboard | [Sveltia CMS](https://sveltiacms.app/) in `public/admin/` |
| Local dashboard | Dependency-free Node HTTP server in `scripts/admin.mjs` |
| Deployment | GitHub Pages via GitHub Actions |

## Quick start

Requirements: Node.js 22.23.4+ and npm.

```bash
npm install
npm run dev
```

The public site runs at <http://localhost:4321>.

To use the optional local Studio, run it in a second terminal:

```bash
npm run admin
```

Local Studio runs at <http://127.0.0.1:4323>. It writes directly to
`src/content/writeups/`; it does not publish anything by itself.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Astro development site on `:4321` |
| `npm run admin` | Start the local Studio on `:4323` |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run check` | Run Astro and TypeScript diagnostics |

Set `SITE_URL` when building for a different canonical domain:

```bash
SITE_URL=https://rrschauhan07.tech npm run build
```

Set `ADMIN_PORT` to use a different port for the local Studio.

## Online Studio: signing in

The deployed dashboard is a static Sveltia CMS page. It reads and writes the
repository through the GitHub API using a fine-grained personal access token.

> The token is stored in the browser's local storage. Do not sign in on a shared
> computer. Sign out when finished.

1. Open <https://rrschauhan07.tech/admin/>.
2. Choose **Sign In with Token** if you are not already signed in.
3. Create a fine-grained token at
   <https://github.com/settings/personal-access-tokens/new>.
   - **Repository access:** Only select repositories →
     `rrschauhan07/Portfolio`
   - **Permissions:** **Contents: Read and write**
   - **Pull requests: Read and write** is not required for the current
     simple workflow.
   - Choose an expiration date and keep a reminder to rotate the token.
4. GitHub may require a 2FA/sudo confirmation before creating the token.
5. Copy the token and paste it into the Studio login form.

You normally will not need to enter the token on every visit. You will need to
sign in again if you sign out, clear browser storage, use another browser or
device, or the token expires or is revoked.

If a token is lost or exposed, revoke it in GitHub and create a replacement.
Never commit a token to the repository or paste it into a public issue/chat.

### Why token login?

GitHub OAuth requires a server-side token exchange, which would add another
service to a deliberately static deployment. A scoped token is sufficient for a
single-author site and keeps the dashboard on GitHub Pages.

If multiple editors or non-technical users are added later, deploy
[Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) on
Cloudflare Workers with a GitHub App, then configure its URL as
`backend.base_url` in `public/admin/config.yml` and enable the `oauth` method.

## Publishing a writeup

### Online Studio

1. Open <https://rrschauhan07.tech/admin/> and sign in.
2. Create a new writeup or open an existing one.
3. Keep **Draft** enabled while writing.
4. When the note is ready, turn **Draft** off and click **Save**.
5. Sveltia commits directly to `main`. GitHub Actions rebuilds and deploys the
   site, usually within 1–2 minutes.
6. Check the live URL at `/writeups/<slug>/`.

New notes default to drafts. Drafts are committed to the repository but are
excluded from the production homepage, article routes, RSS feed, and sitemap.

Uploaded images are committed under `public/uploads/` and referenced as
`/uploads/<filename>`. Use the **Assets** area in Studio to upload and delete
media.

### Local Studio

1. Run `npm run dev` for the live preview.
2. Run `npm run admin` in another terminal.
3. Create or open a note in the local Studio.
4. Save it as a draft while writing.
5. Switch it to **Published** when ready.
6. Preview the article at
   `http://127.0.0.1:4321/writeups/<slug>/`.
7. Commit and push the changes. The GitHub Actions workflow deploys them.

The local Studio is intentionally not part of the Astro build and is never
deployed. Restarting the server invalidates the previous local session; reload
the dashboard after a restart.

## Writeup format

Writeups live in `src/content/writeups/` as Markdown or MDX files with
frontmatter:

```yaml
---
title: "A clear, specific title"
description: "One or two sentences for cards, metadata, and feeds."
date: 2026-11-12
category: Research
tags: ["methodology", "web"]
featured: false
draft: false
sample: false
---
```

The schema is defined in `src/content.config.ts`.

| Field | Meaning |
| --- | --- |
| `title` | Article title and metadata title |
| `description` | Card summary, meta description, and feed description |
| `date` | Publication date |
| `updated` | Optional updated date |
| `category` | Free-form category, up to 60 characters |
| `tags` | Optional list of tags |
| `featured` | Promotes the note to the homepage lead card |
| `draft` | Excludes the note from the production build |
| `sample` | Shows a visible sample-content label |

Local Studio keeps its category list in `src/data/categories.json`. Online
Studio writes the category directly into the entry and does not modify that
file.

## Routes

| Route | Output |
| --- | --- |
| `/` | Writeups landing page and archive |
| `/about/` | About page |
| `/writeups/<slug>/` | Individual article |
| `/admin/` | Online Studio (Sveltia CMS, token login) |
| `/rss.xml` | Combined writeup feed |
| `/sitemap-index.xml` | Sitemap index |
| `/robots.txt` | Crawler rules |
| `/404.html` | Custom not-found page |

There is intentionally no `/writeups/` archive route; Writeups links directly to
`/`. `/admin/` is excluded from indexing with a `noindex, nofollow` meta tag and
`Disallow: /admin/` in `robots.txt`.

## Build and deployment

```bash
npm run check
SITE_URL=https://rrschauhan07.tech npm run build
```

The output in `dist/` is fully static. Pushing to `main` triggers the GitHub
Actions workflow in `.github/workflows/deploy.yml`, which builds the site and
deploys it to GitHub Pages.

The production domain is `https://rrschauhan07.tech`. `public/CNAME` contains the
custom domain. For GitHub Pages:

1. Set the custom domain in repository **Settings → Pages**.
2. Point the apex domain at GitHub's `A`/`AAAA` records.
3. Point `www` at `rrschauhan07.github.io`.
4. Enable **Enforce HTTPS** after DNS verification.

The workflow uses the repository variable `SITE_URL` when present, falling back
to `https://rrschauhan07.tech`.

## Troubleshooting

### A published note is not visible

- Check that **Draft** is off in Studio and the change was saved.
- Check the latest GitHub Actions run in the repository's **Actions** tab.
- Wait 1–2 minutes after a successful run.
- Hard-refresh the page (`Ctrl+Shift+R`). GitHub Pages caches HTML for up to
  10 minutes.
- Confirm the note exists at `src/content/writeups/<slug>.md` and that its
  `draft` field is `false`.

### The sample-content banner appears

The banner is shown only when the note has `sample: true`. Set it to `false` in
Studio and save, then hard-refresh the page.

### An older deployment was canceled

A newer commit supersedes an older deployment. Check the latest workflow run,
not a canceled intermediate run. Wait for the latest run to complete successfully.

### Studio asks for a token again

This is expected after signing out, clearing browser storage, using another
browser/device, or when the token expires or is revoked. Create a new fine-grained
token with **Contents: Read and write** access to this repository.

### Images are not loading

- Confirm the file is present under `public/uploads/`.
- Use the `/uploads/<filename>` path in the Markdown.
- Wait for the deployment to finish.
- Avoid spaces in new filenames when possible; URL-encode existing paths.

## Security notes

- The admin page is public but does nothing without a valid GitHub token.
- The token is not stored in the repository, the Astro build, or the page source.
- Only a token with read/write access to this repository can load or change
  content.
- The public site is fully static; no file-writing API is exposed.
- GitHub Pages does not provide custom CSP or HSTS response headers. The local
  Studio sends stricter security headers because it runs its own Node server.
- `/admin/` sends `noindex, nofollow` and is disallowed in `robots.txt`.

## Project structure

```text
.
├── .github/workflows/deploy.yml   # GitHub Pages build and deploy
├── public/
│   ├── admin/                     # Online Studio (Sveltia CMS)
│   ├── brand/                     # Brand assets
│   ├── uploads/                   # Media uploaded through Studio
│   └── CNAME                      # Custom domain
├── scripts/
│   ├── admin.mjs                  # Local-only Studio server
│   └── admin/                     # Local Studio UI and assets
├── src/
│   ├── components/                # Header, footer, article components
│   ├── content/writeups/          # Markdown/MDX writeups
│   ├── content.config.ts          # Writeup schema
│   ├── data/                      # Site identity and local categories
│   ├── layouts/                   # Base HTML layout
│   ├── pages/                     # Astro routes
│   └── styles/                    # Global and prose styles
├── astro.config.mjs               # Site URL and integrations
└── package.json
```

## Customization

- `src/data/site.ts` — name, role, description, email, social links, navigation.
- `src/pages/about.astro` — profile copy and contact details.
- `src/components/` — header, footer, cards, and article UI.
- `src/styles/global.css` — design tokens and layout styles.
- `src/styles/prose.css` — article typography and Markdown styles.
- `public/` — favicon, social image, brand assets, and other static files.

Do not add claims, engagements, locations, or availability unless they are
verified.

## QA checklist

Before publishing a change:

- Check `/`, `/about/`, an article, and `/404.html`.
- Check desktop and mobile widths.
- Confirm public navigation contains only Writeups and About.
- Confirm drafts are absent from the production build.
- Confirm RSS and the sitemap contain only published pages.
- Confirm `/admin/` loads, sends `noindex`, and asks for a token when signed out.
- Confirm `/admin/` is absent from the sitemap and disallowed by `robots.txt`.
- Confirm no local `scripts/admin` assets appear in `dist/`.
- Run `npm run check` and a production build.
