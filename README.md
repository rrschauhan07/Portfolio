# Rishi Raj Singh Chauhan — Writeups

A small, dark editorial site built around two destinations:

- **Writeups** at `/` — the landing page, with a featured note and the full archive.
- **About** at `/about/` — a concise profile and contact path.

Individual articles live at `/writeups/<slug>/`. There is intentionally no
`/writeups/` archive route; the Writeups link points straight to `/`.

The repository also contains **Studio**, a private, local-only dashboard for
writing and publishing notes. It is not part of the Astro build and is never
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
| Dashboard | Dependency-free Node HTTP server in `scripts/admin.mjs` |
| Deployment | GitHub Pages via GitHub Actions |

## Run locally

```bash
npm install
npm run dev
```

The public site runs at <http://localhost:4321>.

To run the publishing dashboard, use a **second terminal**:

```bash
npm run admin
```

The dashboard runs at <http://127.0.0.1:4323>. The two servers are separate:
`npm run admin` does not start the Astro preview.

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
| `/rss.xml` | Combined writeups feed |
| `/404.html` | Custom not-found page |

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

Categories are free-form, up to 60 characters. Studio keeps the category list in
`src/data/categories.json`; any category already used by a writeup remains
available even if the file is edited by hand.

- `draft: true` notes are visible in local development but excluded from the
  production build.
- `featured: true` promotes a note to the lead card. The most recent featured
  note is used first.
- `sample: true` displays a visible sample-content label. The five bundled
  notes are samples and should be replaced, edited, or deleted before launch.

## Studio — local publishing dashboard

Studio is a small writing interface for the content directory. It can list,
create, edit, and delete writeups, attach categories and tags, set draft or
published status, and mark a note as featured or sample content. Categories can
be created and deleted from the category manager; a category still used by a
writeup cannot be deleted until those writeups are reassigned or removed.

### Why it is local-only

This is a static GitHub Pages site. A static host cannot securely authenticate
an admin interface: any password check would ship to the browser or be
bypassed. Exposing a file-writing API would be worse.

Studio therefore runs only on `127.0.0.1` and writes directly to
`src/content/writeups`. It is intentionally outside `src/` and is not included
in `dist`. Publishing remains a deliberate Git action.

If remote publishing is needed later, use a small authenticated backend or an
OAuth-based Git provider integration — not a public admin page.

### Safety model

The dashboard server:

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

The Studio dashboard is not copied into `dist/` and has no public route.

## QA checklist

Before publishing:

- Check `/`, `/about/`, an article, and `/404.html`.
- Check the layout at desktop and mobile widths.
- Confirm navigation contains only Writeups and About.
- Confirm drafts are absent from the production build.
- Confirm the RSS feed and sitemap contain only published pages.
- Confirm no `scripts/admin` assets or admin strings appear in `dist/`.
