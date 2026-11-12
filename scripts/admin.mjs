#!/usr/bin/env node
/**
 * Local-only writeup dashboard.
 *
 * This server is intentionally not part of the Astro build. It binds to
 * 127.0.0.1, uses a per-run access token, and writes Markdown files directly
 * into src/content/writeups. It is a writing tool, not a deployed CMS.
 */

import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'content', 'writeups');
const CATEGORIES_PATH = path.join(ROOT, 'src', 'data', 'categories.json');
const ADMIN_DIR = path.join(ROOT, 'scripts', 'admin');

const HOST = '127.0.0.1';
const PORT = normalizePort(process.env.ADMIN_PORT ?? '4323');
const TOKEN = crypto.randomBytes(24).toString('base64url');
const ALLOWED_ORIGINS = new Set([
  `http://${HOST}:${PORT}`,
  `http://localhost:${PORT}`,
]);
const ALLOWED_HOSTS = new Set([
  `${HOST}:${PORT}`,
  `localhost:${PORT}`,
]);

const DEFAULT_CATEGORIES = [
  'Web Security',
  'Mobile Security',
  'Thick Client',
  'Research',
  'CTF',
];

const MAX_BODY_BYTES = 1_000_000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function normalizePort(value) {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('ADMIN_PORT must be an integer between 1024 and 65535.');
  }
  return port;
}

function securityHeaders(contentType = 'text/plain; charset=utf-8') {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  };
}

function send(res, status, body, contentType) {
  res.writeHead(status, securityHeaders(contentType));
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), 'application/json; charset=utf-8');
}

function assertSafeRequest(req) {
  const host = req.headers.host;
  if (!host || !ALLOWED_HOSTS.has(host)) {
    throw new HttpError(403, 'Unexpected host.');
  }
}

function assertAuthorized(req) {
  const provided = req.headers['x-admin-token'];
  if (typeof provided !== 'string' || !safeEqual(provided, TOKEN)) {
    throw new HttpError(401, 'This dashboard session is not authorised. Reload the page.');
  }

  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    throw new HttpError(403, 'Unexpected origin.');
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function readJson(req) {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.startsWith('application/json')) {
    throw new HttpError(415, 'Expected a JSON request.');
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, 'Request body is too large.');
    }
    chunks.push(chunk);
  }

  if (!chunks.length) throw new HttpError(400, 'Request body is empty.');

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON.');
  }
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function validateSlug(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new HttpError(400, 'Slug must use lowercase letters, numbers, and single hyphens.');
  }
  return slug;
}

function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Enter a valid date.');
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'Enter a valid date.');
  }
  return value;
}

function validateText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${label} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${label} is too long.`);
  }
  return trimmed;
}

function normalizeTags(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, 'Tags must be an array.');

  const tags = [...new Set(
    value
      .map((tag) => String(tag).trim().replace(/^#/, ''))
      .filter(Boolean),
  )];

  if (tags.length > 20) throw new HttpError(400, 'Use 20 tags or fewer.');
  if (tags.some((tag) => tag.length > 50)) {
    throw new HttpError(400, 'Each tag must be 50 characters or fewer.');
  }
  return tags;
}

function normalizeCategoryName(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Category is required.');
  }

  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new HttpError(400, 'Category is required.');
  if (name.length > 60) {
    throw new HttpError(400, 'Category must be 60 characters or fewer.');
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    throw new HttpError(400, 'Category contains invalid characters.');
  }
  return name;
}

function categoryKey(value) {
  return value.toLowerCase();
}

function dedupeCategories(categories) {
  const seen = new Set();
  return categories.filter((category) => {
    const key = categoryKey(category);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeCategories(...groups) {
  const merged = [];

  for (const group of groups) {
    for (const value of group) {
      if (typeof value !== 'string') continue;
      const name = value.trim().replace(/\s+/g, ' ');
      if (!name || name.length > 60) continue;
      merged.push(name);
    }
  }

  return dedupeCategories(merged);
}

async function readCategoryStore() {
  try {
    const raw = await fs.readFile(CATEGORIES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('Category list is not an array; using defaults.');
      return [...DEFAULT_CATEGORIES];
    }
    return mergeCategories(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') return [...DEFAULT_CATEGORIES];
    console.warn(`Could not read category list: ${error.message}`);
    return [...DEFAULT_CATEGORIES];
  }
}

async function saveCategoryStore(categories) {
  const directory = path.dirname(CATEGORIES_PATH);
  const tempPath = path.join(
    directory,
    `.categories.${crypto.randomBytes(6).toString('hex')}.tmp`,
  );

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    tempPath,
    `${JSON.stringify(dedupeCategories(categories), null, 2)}\n`,
    { encoding: 'utf8', mode: 0o644 },
  );
  await fs.rename(tempPath, CATEGORIES_PATH);
}

async function getCategoryList(posts = null) {
  const categories = await readCategoryStore();
  const resolvedPosts = posts ?? await getPosts();
  return mergeCategories(categories, resolvedPosts.map((post) => post.category));
}

async function ensureCategory(value) {
  const category = normalizeCategoryName(value);
  const categories = await readCategoryStore();
  const existing = categories.find((entry) => categoryKey(entry) === categoryKey(category));

  if (existing) return existing;

  categories.push(category);
  await saveCategoryStore(categories);
  return category;
}

async function addCategory(value) {
  const category = normalizeCategoryName(value);
  const categories = await readCategoryStore();

  if (categories.some((entry) => categoryKey(entry) === categoryKey(category))) {
    throw new HttpError(409, 'That category already exists.');
  }

  categories.push(category);
  await saveCategoryStore(categories);
  return category;
}

async function deleteCategory(value) {
  const category = normalizeCategoryName(value);
  const [categories, posts] = await Promise.all([
    readCategoryStore(),
    getPosts(),
  ]);

  const usedBy = posts.filter((post) => categoryKey(post.category) === categoryKey(category));
  if (usedBy.length) {
    const names = usedBy.slice(0, 3).map((post) => post.title).join(', ');
    const more = usedBy.length > 3 ? ', and others' : '';
    throw new HttpError(
      409,
      `"${category}" is still used by ${usedBy.length} ${usedBy.length === 1 ? 'writeup' : 'writeups'} (${names}${more}). Reassign or delete those writeups first.`,
    );
  }

  const index = categories.findIndex((entry) => categoryKey(entry) === categoryKey(category));
  if (index === -1) throw new HttpError(404, 'Category not found.');

  const [removed] = categories.splice(index, 1);
  await saveCategoryStore(categories);
  return removed;
}

function normalizePostInput(input, existing = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'Expected a post object.');
  }

  const title = validateText(input.title, 'Title', 220);
  const slug = validateSlug(input.slug || slugify(title));
  const description = validateText(input.description, 'Description', 600);
  const date = validateDate(input.date);
  const body = validateText(input.body, 'Body', 500_000);
  const category = normalizeCategoryName(input.category);
  const tags = normalizeTags(input.tags);

  return {
    title,
    slug,
    description,
    date,
    category,
    tags,
    body,
    featured: Boolean(input.featured),
    draft: Boolean(input.draft),
    sample: input.sample == null ? Boolean(existing?.sample) : Boolean(input.sample),
    updated: existing?.updated ?? null,
  };
}

function serializePost(post) {
  const lines = [
    '---',
    `title: ${JSON.stringify(post.title)}`,
    `description: ${JSON.stringify(post.description)}`,
    `date: ${post.date}`,
  ];

  if (post.updated) lines.push(`updated: ${post.updated}`);

  lines.push(
    `category: ${JSON.stringify(post.category)}`,
    `tags: ${JSON.stringify(post.tags)}`,
    `featured: ${post.featured}`,
    `draft: ${post.draft}`,
    `sample: ${post.sample}`,
    '---',
    '',
    post.body.trim(),
    '',
  );

  return lines.join('\n');
}

function parseScalar(raw) {
  const value = raw.trim();
  if (!value) return '';

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }

  return value;
}

function parseTags(raw) {
  const value = raw.trim();
  if (!value) return [];

  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return value
        .slice(1, -1)
        .split(',')
        .map((tag) => parseScalar(tag))
        .filter(Boolean);
    }
  }

  return value.split(',').map((tag) => parseScalar(tag)).filter(Boolean);
}

function parsePostFile(raw, slug, extension) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`Could not read frontmatter in ${slug}.${extension}.`);

  const fields = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    fields.set(line.slice(0, separator).trim(), line.slice(separator + 1));
  }

  return {
    slug,
    extension,
    title: parseScalar(fields.get('title') ?? ''),
    description: parseScalar(fields.get('description') ?? ''),
    date: parseScalar(fields.get('date') ?? ''),
    updated: fields.has('updated') ? parseScalar(fields.get('updated')) : null,
    category: parseScalar(fields.get('category') ?? ''),
    tags: parseTags(fields.get('tags') ?? '[]'),
    featured: parseScalar(fields.get('featured') ?? 'false') === 'true',
    draft: parseScalar(fields.get('draft') ?? 'false') === 'true',
    sample: parseScalar(fields.get('sample') ?? 'false') === 'true',
    body: match[2].trim(),
  };
}

function publicPost(post, includeBody = true) {
  const result = {
    slug: post.slug,
    extension: post.extension,
    title: post.title,
    description: post.description,
    date: post.date,
    updated: post.updated,
    category: post.category,
    tags: post.tags,
    featured: post.featured,
    draft: post.draft,
    sample: post.sample,
  };
  if (includeBody) result.body = post.body;
  return result;
}

async function listPostFiles() {
  const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function readPostFromFile(filename) {
  const filePath = path.join(CONTENT_DIR, filename);
  const raw = await fs.readFile(filePath, 'utf8');
  const extension = path.extname(filename).slice(1).toLowerCase();
  const slug = path.basename(filename, path.extname(filename));

  validateSlug(slug);
  return parsePostFile(raw, slug, extension);
}

async function getPosts() {
  const files = await listPostFiles();
  const posts = [];

  for (const filename of files) {
    try {
      posts.push(publicPost(await readPostFromFile(filename), false));
    } catch (error) {
      console.warn(`Skipping unreadable content file ${filename}: ${error.message}`);
    }
  }

  return posts.sort((a, b) => {
    const dateOrder = String(b.date).localeCompare(String(a.date));
    return dateOrder || a.title.localeCompare(b.title);
  });
}

async function findPostFile(slug) {
  validateSlug(slug);
  for (const extension of ['md', 'mdx']) {
    const filename = `${slug}.${extension}`;
    const filePath = path.join(CONTENT_DIR, filename);

    if (!filePath.startsWith(`${CONTENT_DIR}${path.sep}`)) {
      throw new HttpError(400, 'Invalid content path.');
    }

    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) return { filePath, filename, extension };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

async function getPost(slug) {
  const file = await findPostFile(slug);
  if (!file) throw new HttpError(404, 'Writeup not found.');
  return readPostFromFile(file.filename);
}

async function writePostFile(filename, content) {
  const filePath = path.join(CONTENT_DIR, filename);
  const tempPath = path.join(CONTENT_DIR, `.${filename}.${crypto.randomBytes(6).toString('hex')}.tmp`);

  if (!filePath.startsWith(`${CONTENT_DIR}${path.sep}`)) {
    throw new HttpError(400, 'Invalid content path.');
  }

  await fs.writeFile(tempPath, content, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tempPath, filePath);
}

async function createPost(input) {
  const post = normalizePostInput(input);
  const existing = await findPostFile(post.slug);
  if (existing) throw new HttpError(409, 'A writeup with that slug already exists.');

  post.category = await ensureCategory(post.category);

  const filename = `${post.slug}.md`;
  await writePostFile(filename, serializePost(post));
  console.log(`Created ${filename}`);
  return readPostFromFile(filename);
}

async function updatePost(slug, input) {
  const existingFile = await findPostFile(slug);
  if (!existingFile) throw new HttpError(404, 'Writeup not found.');

  const existing = await readPostFromFile(existingFile.filename);
  const post = normalizePostInput({ ...input, slug }, existing);
  post.category = await ensureCategory(post.category);

  await writePostFile(existingFile.filename, serializePost(post));
  console.log(`Updated ${existingFile.filename}`);
  return readPostFromFile(existingFile.filename);
}

async function deletePost(slug) {
  const existingFile = await findPostFile(slug);
  if (!existingFile) throw new HttpError(404, 'Writeup not found.');
  await fs.unlink(existingFile.filePath);
  console.log(`Deleted ${existingFile.filename}`);
}

async function handleApi(req, res, pathname) {
  assertAuthorized(req);

  if (pathname === '/api/posts' && req.method === 'GET') {
    const posts = await getPosts();
    sendJson(res, 200, {
      posts,
      categories: await getCategoryList(posts),
    });
    return;
  }

  if (pathname === '/api/posts' && req.method === 'POST') {
    const post = await createPost(await readJson(req));
    sendJson(res, 201, { post: publicPost(post) });
    return;
  }

  if (pathname === '/api/categories' && req.method === 'GET') {
    sendJson(res, 200, { categories: await getCategoryList() });
    return;
  }

  if (pathname === '/api/categories' && req.method === 'POST') {
    const body = await readJson(req);
    const category = await addCategory(body?.name);
    sendJson(res, 201, {
      category,
      categories: await getCategoryList(),
    });
    return;
  }

  if (pathname === '/api/categories' && req.method === 'DELETE') {
    const body = await readJson(req);
    const category = await deleteCategory(body?.name);
    sendJson(res, 200, {
      category,
      categories: await getCategoryList(),
    });
    return;
  }

  if (pathname === '/api/categories') {
    throw new HttpError(405, 'Method not allowed.');
  }

  const match = pathname.match(/^\/api\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!match) throw new HttpError(404, 'Not found.');

  const slug = match[1];

  if (req.method === 'GET') {
    sendJson(res, 200, { post: publicPost(await getPost(slug)) });
    return;
  }

  if (req.method === 'PUT') {
    const post = await updatePost(slug, await readJson(req));
    sendJson(res, 200, { post: publicPost(post) });
    return;
  }

  if (req.method === 'DELETE') {
    await deletePost(slug);
    sendJson(res, 200, { ok: true });
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function serve() {
  await fs.mkdir(CONTENT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(CATEGORIES_PATH), { recursive: true });

  const [htmlTemplate, css, js] = await Promise.all([
    fs.readFile(path.join(ADMIN_DIR, 'index.html'), 'utf8'),
    fs.readFile(path.join(ADMIN_DIR, 'admin.css'), 'utf8'),
    fs.readFile(path.join(ADMIN_DIR, 'admin.js'), 'utf8'),
  ]);

  const html = htmlTemplate.replace('__ADMIN_TOKEN__', TOKEN);

  const server = http.createServer(async (req, res) => {
    try {
      assertSafeRequest(req);
      const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        send(res, 200, html, 'text/html; charset=utf-8');
        return;
      }

      if (req.method === 'GET' && url.pathname === '/admin.css') {
        send(res, 200, css, 'text/css; charset=utf-8');
        return;
      }

      if (req.method === 'GET' && url.pathname === '/admin.js') {
        send(res, 200, js, 'text/javascript; charset=utf-8');
        return;
      }

      if (req.method === 'GET' && url.pathname === '/favicon.ico') {
        res.writeHead(204, securityHeaders());
        res.end();
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url.pathname);
        return;
      }

      throw new HttpError(404, 'Not found.');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError
        ? error.message
        : 'The dashboard hit an unexpected error. Check the terminal for details.';

      if (status === 500) console.error(error);
      if (res.headersSent) {
        res.end();
        return;
      }
      sendJson(res, status, { error: message });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  Studio — local writeup dashboard');
    console.log(`  ${`http://${HOST}:${PORT}`}`);
    console.log('');
    console.log('  Only reachable from this computer. Never included in the deployed site.');
    console.log('  Run `npm run dev` separately if you want a live preview at :4321.');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

serve().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
