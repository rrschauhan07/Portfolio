# Rishi Raj Singh Chauhan — Writeups

A small, dark editorial site built around two destinations:

- **Writeups** at `/` — the landing page, with a featured note and the full archive.
- **About** at `/about/` — a concise profile and contact path.

Individual articles live at `/writeups/<slug>/`. There is intentionally no
`/writeups/` archive route; the Writeups link points straight to `/`.

The repository also contains two writing interfaces:

- **Online Studio** at `/admin/` — a static Sveltia CMS page that signs in with
  a scoped GitHub token, commits entries to this repository, and triggers the
  existing GitHub Pages deploy.
- **Local Studio** — a private, dependency-free Node server for working against
  the local repository. It is not part of the Astro build and is never
  deployed.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | [Astro](https://astro.build/) — static output |
| Content | Astro content collections; Markdown and MDX |
| Styling | Hand-written CSS tokens in `src/styles/global.css` |
| Article styles | `src/styles/prose.css` |
| Feeds | `@astrojs/rss` and `@astrojs/sitemap` |
| Online dashboard | [Sveltia CMS](https://sveltiacms.app/) at `public/admin/` |
| Local dashboard | Dependency-free Node HTTP server in `scripts/admin.mjs` |
| Deployment | GitHub Pages via GitHub Actions |

## Run locally

```bash
npm install
npm run dev
```

The public site runs at <http://localhost:4321>.

To run the local Studio dashboard, use a **second terminal**:

```bash
npm run admin
```

Local Studio runs at <http://127.0.0.1:4323>. The two servers are separate:
`npm run admin` does not start the Astro preview.

The online Studio is deployed at <https://rrschauhan07.tech/admin/>. To preview
its static shell locally, open
<http://localhost:4321/admin/index.html> — Astro's dev server does not resolve a
folder path to `index.html` from `public/`. Signing in there still writes to the
GitHub repository, so use it only when you intend to commit.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Astro development site on `:4321` |
| `npm run admin` | Start the local Studio dashboard on `:4323` |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Preview the built site locally |
| `npm run check` | Run Astro and TypeScript diagnostics |

Set `ADMIN_PORT` to use a different dashboard port. Set `SITE_URL` for the
canonical URL used by metadata, RSS, and the sitemap:

```bash
SITE_URL=https://rrschauhan07.tech npm run build
```

## Routes

| Route | Output |
| --- | --- |
| `/` | Writeups archive and landing page |
| `/about/` | About page |
| `/writeups/<slug>/` | Individual article |
| `/admin/` | Online Studio (Sveltia CMS, token login) |
| `/rss.xml` | Combined writeups feed |
| `/404.html` | Custom not-found page |

The public header intentionally links only to Writeups and About. `/admin/` is
not part of the public navigation and is excluded from indexing with both a
`noindex` meta tag and `Disallow: /admin/` in `robots.txt`.

## Writing content

Articles live in `src/content/writeups/`. Each file uses frontmatter like this:

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

Categories are free-form, up to 60 characters. Local Studio keeps the category
list in `src/data/categories.json`; any category already used by a writeup
remains available even if the file is edited by hand. Online Studio writes the
category directly into the entry and does not modify `categories.json`.

- `draft: true` notes are visible in local development but excluded from the
  production build.
- `featured: true` promotes a note to the lead card. The most recent featured
  note is used first.
- `sample: true` displays a visible sample-content label. The five bundled
  notes are samples and should be replaced, edited, or deleted before launch.

## Online Studio — publish from anywhere

The deployed dashboard is at <https://rrschauhan07.tech/admin/>. It is a static
[Sveltia CMS](https://sveltiacms.app/) page that reads and writes the repository
through the GitHub API. It can list, create, edit, and delete writeups, upload
media, set draft or published status, and mark a note as featured or sample
content.

### Sign in

1. Open <https://rrschauhan07.tech/admin/>.
2. Choose **Sign In with Token**.
3. Use the token-generation link shown on the login screen, or create a
   fine-grained personal access token at
   <https://github.com/settings/personal-access-tokens/new>.
4. Scope it to **only** the `rrschauhan07/Portfolio` repository and grant:
   - **Contents: Read and write** — required for reading, committing, and
     uploading media.
   - **Pull requests: Read and write** — only needed if editorial workflow is
     enabled; the current simple workflow does not require it.
5. Paste the token into the dashboard and sign in.

The token is stored in that browser's local storage. Sign out when using a
shared computer. If a token is lost or exposed, revoke it on GitHub and create
a replacement.

### Publish

1. Create a writeup or open an existing one.
2. Keep **Draft** enabled while writing. Drafts are committed to the repository
   but excluded from the production build.
3. When the note is ready, turn **Draft** off and save.
4. Sveltia commits to `main`. The GitHub Actions workflow rebuilds and deploys
   the site, usually within 1–2 minutes.
5. Check the live URL at `/writeups/<slug>/`.

New notes default to drafts. The date field accepts a date-only value. Uploaded
media is committed under `public/uploads/` and referenced as `/uploads/...`.

### Why token login instead of GitHub OAuth

GitHub OAuth needs a server-side token exchange because the client secret cannot
be shipped in a static page. This deployment deliberately avoids adding another
service just for login. A scoped fine-grained token is sufficient for a
single-author site and keeps the dashboard on GitHub Pages.

If multiple editors or non-technical users are added later, deploy the
[Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) on
Cloudflare Workers with a GitHub App, then add its URL as `backend.base_url` in
`public/admin/config.yml` and enable the `oauth` auth method.

### Security model

- The admin page is public but does nothing without a valid GitHub token.
- Only a token with read/write access to this repository can load or change
  content.
- The token is not in the repository, the Astro build, or the page source.
- The admin page sends `noindex, nofollow` and `/admin/` is disallowed in
  `robots.txt`.
- The public site remains fully static; no file-writing API is exposed.

## Local Studio — optional local dashboard

Local Studio is a small writing interface for the content directory. It can
list, create, edit, and delete writeups, attach categories and tags, set draft or
published status, and mark a note as featured or sample content. Categories can
be created and deleted from the category manager; a category still used by a
writeup cannot be deleted until those writeups are reassigned or removed.

### Why it is local-only

Local Studio runs on `127.0.0.1` and writes directly to
`src/content/writeups`. It is intentionally outside `src/` and is not included
in `dist`. Publishing still requires a Git commit and push. It remains useful
for offline editing and for managing `src/data/categories.json`.

### Safety model

The local dashboard server:

- binds to `127.0.0.1` only;
- generates a fresh access token for every server run and embeds it in the
  served page;
- rejects unexpected `Host` and `Origin` headers;
- requires the token on every content API request;
- accepts JSON only, with a request-size limit;
- validates slugs, dates, categories, and field lengths;
- rejects path traversal and unknown file paths;
- sends CSP, frame, referrer, MIME-sniffing, and no-store security headers.

There is no persistent password or secret in the repository. Restarting the
server invalidates the previous page session; reload the dashboard after a
restart.

### Publishing workflow

1. Keep `npm run dev` running for a live preview.
2. Start `npm run admin` in another terminal.
3. Create a note, or choose an existing one from the sidebar.
4. Save it as a **Draft** while writing. Drafts are not included in production.
5. Set the status to **Published** when it is ready, then save.
6. Check the preview at `http://127.0.0.1:4321/writeups/<slug>/`.
7. Commit and push. The GitHub Actions workflow rebuilds and deploys the site.

New notes are drafts by default. Slugs become read-only after the first save so
article URLs stay stable. Use **Manage** beside the Category field to add custom
categories or delete categories that no longer have any writeups attached.

## Personalization

Update the placeholders before launch:

- `src/data/site.ts` — name, role, description, email, social links;
- `src/pages/about.astro` — profile copy and contact details;
- `src/content/writeups/` — replace the sample notes with real writing;
- `public/` — favicon, social image, and other static assets.

Do not fill in claims, engagements, locations, or availability unless they are
verified.

## Build and deploy

```bash
npm run check
SITE_URL=https://rrschauhan07.tech npm run build
```

The build output is static and can be hosted anywhere. The existing GitHub Pages
workflow is in `.github/workflows/deploy.yml`; configure the repository Pages
settings and set `SITE_URL` for the production domain.

The production site is `https://rrschauhan07.tech`. `public/CNAME` carries the
custom domain. For GitHub Pages, set the custom domain in the repository Pages
settings, point the apex at GitHub's `A`/`AAAA` records, and point
`www` at `rrschauhan07.github.io`. Enable **Enforce HTTPS** after DNS verification.

Local Studio is not copied into `dist/` and has no public route. The online
Studio is deployed as static files from `public/admin/`; it only reads and
writes the repository after a GitHub token is supplied.

## QA checklist

Before publishing:

- Check `/`, `/about/`, an article, and `/404.html`.
- Check the layout at desktop and mobile widths.
- Confirm navigation contains only Writeups and About.
- Confirm drafts are absent from the production build.
- Confirm the RSS feed and sitemap contain only published pages.
- Confirm `/admin/` loads, sends `noindex`, and asks for a token before showing
  any content.
- Confirm `/admin/` is absent from the sitemap and disallowed by `robots.txt`.
- Confirm no local `scripts/admin` assets appear in `dist/`.
