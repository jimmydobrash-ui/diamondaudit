#!/usr/bin/env node
// Static-site generator for the marketing site.
//
// Design note: index.html is the single source of truth for site chrome. This
// script lifts its :root tokens, <header>, and <footer> at build time, so every
// other page inherits the real nav, footer, and design tokens automatically —
// change the nav on index.html and the whole site follows on the next build.
// That's deliberate: the hand-written pages drifted from each other once
// already (the mobile-nav/footer-parity fix), and duplicating chrome per page
// is what caused it.
//
//   • index.html      — hand-written; the source of chrome + tokens.
//   • _src/*.html      — content pages (clubs/pricing/tour): per-page metadata +
//                        component CSS (no :root) + body. Generated into landing/.
//   • blog/posts/*.html — blog fragments. Generated into landing/blog/.
//
// Output is committed to the repo, so the Vercel project keeps serving landing/
// as plain static files with no build step and no config change.
//
// Usage: node landing/_build/build.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LANDING = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(LANDING, "_src");
const POSTS_DIR = join(LANDING, "blog", "posts");
const BLOG_OUT = join(LANDING, "blog");
const SITE = "https://www.diamondaudit.io";
const DEFAULT_OG_IMAGE = "https://diamondaudit.io/screenshots/app-dashboard.webp";

// Hand-written pages that belong in the sitemap. privacy/terms are deliberately
// absent: both carry <meta name="robots" content="noindex">, and submitting a
// noindex URL is a Search Console error. The generated content pages and blog
// posts are added to the sitemap separately, below.
const HANDWRITTEN_INDEXED = ["/"];

function extract(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "i"));
  if (!m) throw new Error(`Could not find <${tag}> in index.html — the build reuses it for site chrome.`);
  return m[0];
}

// The shared :root token block, pulled out of index's <style> and re-wrapped so
// every generated page carries exactly the same design tokens.
function extractRootStyle(indexStyle) {
  const m = indexStyle.match(/:root\s*\{[^}]*\}/);
  if (!m) throw new Error("Could not find :root {…} in index.html's <style>.");
  return `    <style>\n      ${m[0]}\n    </style>`;
}

// Drop the nav link that points at the current page, matching the hand-written
// convention where a page never links to itself in its own nav.
function stripSelfNavLink(headerHtml, path) {
  const re = new RegExp(`\\s*<a\\b[^>]*href="${path.replace(/[.]/g, "\\.")}"[^>]*>[^<]*</a>`);
  return headerHtml.replace(re, "");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

function parseMeta(filename, raw, required) {
  const m = raw.match(/^<!--([\s\S]*?)-->/);
  if (!m) throw new Error(`${filename}: missing leading <!--{ ... }--> metadata block`);
  let meta;
  try {
    meta = JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`${filename}: metadata block is not valid JSON — ${e.message}`);
  }
  for (const key of required) {
    if (!meta[key]) throw new Error(`${filename}: metadata is missing "${key}"`);
  }
  return { meta, rest: raw.slice(m[0].length).trim() };
}

/** Content page: metadata comment + a <style> component block + body HTML. */
function parseContentPage(filename, raw) {
  const { meta, rest } = parseMeta(filename, raw, ["title", "description", "path"]);
  const styleMatch = rest.match(/<style>[\s\S]*?<\/style>/);
  if (!styleMatch) throw new Error(`${filename}: expected a <style> block after the metadata`);
  const body = rest.slice(styleMatch.index + styleMatch[0].length).trim();
  return { ...meta, slug: meta.path.replace(/^\//, "").replace(/\.html$/, ""), styleBlock: styleMatch[0], body };
}

/** Blog post: metadata comment + body fragment (styles come from BLOG_CSS). */
function parsePost(filename, raw) {
  const { meta, rest } = parseMeta(filename, raw, ["title", "date", "description"]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
    throw new Error(`${filename}: date must be YYYY-MM-DD, got "${meta.date}"`);
  }
  return { ...meta, slug: filename.replace(/\.html$/, ""), body: rest };
}

// Blog-specific styles, layered on top of index.html's tokens.
const BLOG_CSS = `
    <style>
      .post-wrap { max-width: 720px; margin: 0 auto; padding: 56px 20px 80px; }
      .post-meta { color: var(--muted); font-size: 14px; margin: 0 0 8px; }
      .post-wrap h1 { font-size: clamp(28px, 5vw, 40px); line-height: 1.15; margin: 0 0 16px; letter-spacing: -0.02em; }
      .post-body { font-size: 17px; line-height: 1.7; }
      .post-body h2 { font-size: 22px; margin: 40px 0 12px; letter-spacing: -0.01em; }
      .post-body p { margin: 0 0 18px; color: var(--text); }
      .post-body ul, .post-body ol { margin: 0 0 18px; padding-left: 22px; color: var(--text); }
      .post-body li { margin-bottom: 8px; }
      .post-body a { color: var(--accent); }
      .post-body strong { color: #fff; }
      .post-body blockquote {
        margin: 24px 0; padding: 12px 20px; border-left: 3px solid var(--accent);
        background: var(--surface); color: var(--muted); border-radius: 0 8px 8px 0;
      }
      .post-cta {
        margin-top: 48px; padding: 24px; background: var(--surface);
        border: 1px solid var(--border); border-radius: var(--radius); text-align: center;
      }
      .post-cta p { margin: 0 0 14px; color: var(--muted); }
      .post-list { list-style: none; padding: 0; margin: 32px 0 0; }
      .post-list li { padding: 20px 0; border-bottom: 1px solid var(--border); }
      .post-list li:last-child { border-bottom: none; }
      .post-list a { font-size: 20px; font-weight: 600; color: var(--text); text-decoration: none; letter-spacing: -0.01em; }
      .post-list a:hover { color: var(--accent); }
      .post-list p { margin: 6px 0 0; color: var(--muted); font-size: 15px; }
      .back-link { display: inline-block; margin-bottom: 24px; color: var(--muted); text-decoration: none; font-size: 14px; }
      .back-link:hover { color: var(--text); }
    </style>`;

function page({ title, description, canonical, ogType = "website", ogImage = DEFAULT_OG_IMAGE, ogDescription = description, styleHtml, header, content, footer, sourceLabel }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />

    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="canonical" href="${canonical}" />

    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(ogDescription)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${ogImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${ogImage}" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
      rel="stylesheet"
    />

    <!-- GENERATED FILE — do not edit by hand.
         Source: ${sourceLabel}  ·  Build: node landing/_build/build.mjs -->
${styleHtml}
    <script src="/analytics.js" defer></script>
  </head>

  <body>
${header}
${content}
${footer}
  </body>
</html>
`;
}

function postContent(post) {
  // The CTA carries UTM params so GA4 can attribute a signup back to the
  // specific post — analytics.js already allowlists utm_* through its URL
  // sanitizer, so this works with no analytics code change.
  const cta = `https://app.diamondaudit.io/auth?utm_source=blog&utm_medium=post&utm_campaign=${post.slug}`;
  return `    <main class="post-wrap">
      <a class="back-link" href="/blog/">← All posts</a>
      <p class="post-meta"><time datetime="${post.date}">${formatDate(post.date)}</time></p>
      <h1>${escapeHtml(post.title)}</h1>
      <div class="post-body">
${post.body.split("\n").map(l => (l ? `        ${l}` : l)).join("\n")}
      </div>
      <div class="post-cta">
        <p>Running tryouts this season? DiamondAudit gives your staff one scoring standard and a record behind every cut.</p>
        <a class="btn btn-primary" href="${cta}">Request access →</a>
      </div>
    </main>`;
}

function indexContent(posts) {
  const items = posts.map(p => `        <li>
          <a href="/blog/${p.slug}.html">${escapeHtml(p.title)}</a>
          <p><time datetime="${p.date}">${formatDate(p.date)}</time> · ${escapeHtml(p.description)}</p>
        </li>`).join("\n");
  return `    <main class="post-wrap">
      <h1>Notes from the field</h1>
      <p class="post-meta">Tryout process, evaluation, and what the data actually says.</p>
      <ul class="post-list">
${items}
      </ul>
    </main>`;
}

function buildSitemap({ contentPaths, posts }) {
  const urls = [
    ...HANDWRITTEN_INDEXED.map(p => `${SITE}${p}`),
    ...contentPaths.map(p => `${SITE}${p}`),
    `${SITE}/blog/`,
    ...posts.map(p => `${SITE}/blog/${p.slug}.html`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by landing/_build/build.mjs — do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
}

function readFragments(dir, parse) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(".html"))
    .map(f => parse(f, readFileSync(join(dir, f), "utf8")));
}

function main() {
  const index = readFileSync(join(LANDING, "index.html"), "utf8");
  const chrome = {
    fullStyle: extract(index, "style"),
    rootStyle: extractRootStyle(index),
    header: extract(index, "header"),
    footer: extract(index, "footer"),
  };

  // --- Content pages (clubs / pricing / tour) ---
  const contentPages = readFragments(SRC_DIR, parseContentPage);
  for (const p of contentPages) {
    writeFileSync(
      join(LANDING, `${p.slug}.html`),
      page({
        title: p.title,
        description: p.description,
        canonical: `${SITE}${p.path}`,
        ogType: "website",
        ogImage: p.ogImage || DEFAULT_OG_IMAGE,
        ogDescription: p.ogDescription || p.description,
        styleHtml: `${chrome.rootStyle}\n${p.styleBlock.replace(/^/, "    ")}`,
        header: stripSelfNavLink(chrome.header, p.path),
        content: p.body,
        footer: chrome.footer,
        sourceLabel: "landing/_src/",
      }),
    );
  }

  // --- Blog ---
  if (!existsSync(POSTS_DIR)) mkdirSync(POSTS_DIR, { recursive: true });
  const posts = readFragments(POSTS_DIR, parsePost).sort((a, b) => b.date.localeCompare(a.date));
  for (const post of posts) {
    writeFileSync(
      join(BLOG_OUT, `${post.slug}.html`),
      page({
        title: `${post.title} — DiamondAudit`,
        description: post.description,
        canonical: `${SITE}/blog/${post.slug}.html`,
        ogType: "article",
        styleHtml: `${chrome.fullStyle}\n${BLOG_CSS}`,
        header: chrome.header,
        content: postContent(post),
        footer: chrome.footer,
        sourceLabel: "landing/blog/posts/",
      }),
    );
  }
  writeFileSync(
    join(BLOG_OUT, "index.html"),
    page({
      title: "Blog — DiamondAudit",
      description: "Notes on running better tryouts: process, evaluation, and what the data actually says.",
      canonical: `${SITE}/blog/`,
      ogType: "website",
      styleHtml: `${chrome.fullStyle}\n${BLOG_CSS}`,
      header: chrome.header,
      content: indexContent(posts),
      footer: chrome.footer,
      sourceLabel: "landing/blog/posts/",
    }),
  );

  writeFileSync(join(LANDING, "sitemap.xml"), buildSitemap({ contentPaths: contentPages.map(p => p.path), posts }));

  console.log(`Built ${contentPages.length} content page(s) + ${posts.length} post(s) + blog index + sitemap.xml`);
  for (const p of contentPages) console.log(`  ${p.path} — ${p.title}`);
  for (const p of posts) console.log(`  /blog/${p.slug}.html — ${p.title}`);
}

main();
