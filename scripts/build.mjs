#!/usr/bin/env node
/**
 * Builds dist/ from index.template.html + content/*.json.
 *
 * The CMS only ever writes to content/ and to the image folders. This script
 * turns that content into the single index.html that GitHub Pages serves:
 *
 *   1. gallery + client logos are rendered from JSON into their grids
 *   2. English text is written into every [data-i18n] element, so the shipped
 *      HTML is readable by crawlers before any JavaScript runs
 *   3. all three dictionaries are inlined as the I18N object the page uses to
 *      switch languages at runtime
 *
 * No dependencies. Run: node scripts/build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const readJSON = (p) => JSON.parse(read(p));

const LANGS = ['en', 'fr', 'ar'];
const STATIC = ['assets', 'images', 'CNAME', 'LICENSE'];

/* ---------- load ---------- */
// content/site.<lang>.json is grouped by section for the CMS UI; the page wants
// flat dotted keys ("nav.home"), so flatten on the way in.
const flatten = (grouped) => {
  const out = {};
  for (const [section, fields] of Object.entries(grouped)) {
    for (const [key, value] of Object.entries(fields)) {
      out[key === '_' ? section : `${section}.${key}`] = value;
    }
  }
  return out;
};
const dict = Object.fromEntries(LANGS.map((l) => [l, flatten(readJSON(`content/site.${l}.json`))]));
const gallery = readJSON('content/gallery.json').photos ?? [];
const clients = readJSON('content/clients.json').logos ?? [];
let html = read('index.template.html');

/* ---------- sanity checks ---------- */
const problems = [];
const enKeys = Object.keys(dict.en);
for (const l of ['fr', 'ar']) {
  const missing = enKeys.filter((k) => !(k in dict[l]));
  if (missing.length) problems.push(`${l}: ${missing.length} key(s) missing — ${missing.slice(0, 6).join(', ')}`);
}
const used = [...html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)].map((m) => m[1]);
const unknown = [...new Set(used)].filter((k) => !(k in dict.en));
if (unknown.length) problems.push(`template uses unknown key(s): ${unknown.join(', ')}`);
for (const p of gallery) {
  for (const f of [p.image, p.thumbnail]) {
    if (f && !existsSync(join(root, f))) problems.push(`gallery file not found: ${f}`);
  }
}
for (const c of clients) {
  if (c.logo && !existsSync(join(root, c.logo))) problems.push(`client logo not found: ${c.logo}`);
}
if (problems.length) {
  console.error('Build failed:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

/* ---------- 1. repeating blocks ---------- */
const attr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const galleryHTML = gallery
  .map((p) => `      <button class="gal-item gal-photo" type="button" data-full="${attr(p.image)}">` +
    `<img src="${attr(p.thumbnail || p.image)}" alt="${attr(p.alt)}" loading="lazy">` +
    `<span class="gal-zoom" aria-hidden="true">＋</span></button>`)
  .join('\n');

const clientsHTML = clients
  .map((c) => `      <div class="logo"><img src="${attr(c.logo)}" alt="${attr(c.name)}" loading="lazy"></div>`)
  .join('\n');

html = html.replace('__GALLERY__', galleryHTML).replace('__CLIENTS__', clientsHTML);

/* ---------- 2. English text into the markup ---------- */
// Values may legitimately contain markup (the brochure cover <img>, <b> in the
// hero metrics), so they are written verbatim — the same thing setLang does
// with innerHTML at runtime.
// A bare & is legal in innerHTML but should be escaped in served markup; the
// values may also contain intentional tags, so only loose ampersands are fixed.
const amp = (v) => String(v).replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, '&amp;');
let injected = 0;
html = html.replace(
  /<(\w+)([^>]*\bdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,
  (whole, tag, attrs, key) => {
    const v = dict.en[key];
    if (v === undefined) return whole;
    injected++;
    return `<${tag}${attrs}>${amp(v)}</${tag}>`;
  }
);
let phInjected = 0;
html = html.replace(/(\bdata-i18n-ph="([^"]+)"[^>]*?\bplaceholder=")[^"]*(")/g, (whole, head, key, tail) => {
  const v = dict.en[key];
  if (v === undefined) return whole;
  phInjected++;
  return head + attr(v) + tail;
});

/* ---------- 3. dictionaries ---------- */
const payload = Object.fromEntries(LANGS.map((l) => [l, dict[l]]));
html = html.replace('__I18N__', JSON.stringify(payload).replace(/<\/script/gi, '<\\/script'));

/* ---------- write ---------- */
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'index.html'), html);
for (const item of STATIC) {
  if (existsSync(join(root, item))) cpSync(join(root, item), join(dist, item), { recursive: true });
}

const kb = (n) => Math.round(n / 1024) + ' KB';
console.log(`dist/index.html  ${kb(Buffer.byteLength(html))}`);
console.log(`  languages      ${LANGS.join(', ')} (${enKeys.length} keys each)`);
console.log(`  text injected  ${injected} elements, ${phInjected} placeholders`);
console.log(`  gallery        ${gallery.length} photos`);
console.log(`  clients        ${clients.length} logos`);
