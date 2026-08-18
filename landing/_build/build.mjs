#!/usr/bin/env node
// Blog generator for the marketing site.
//
// Design note: index.html is the single source of truth for site chrome. This
// script lifts its <style>, <header>, and <footer> verbatim at build time
// rather than keeping its own copies, so blog pages inherit the real nav and
// theme automatically — change the nav on index.html and the blog follows on
// the next build. That's deliberate: the six hand-written pages have already
// drifted from each other once (the mobile-nav/footer-parity fix), and adding
// a seventh copy here would just widen the problem.
//
// Output is committed to the repo, so the Vercel project keeps serving
// landing/ as plain static files with no build step and no config change.
//
// Usage: node landing/_build/build.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LANDING = join(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_DIR = join(LANDING, "blog", "posts");
const BLOG_OUT = join(LANDING, "blog");
const SITE = "https://www.diamondaudit.io";

// Pages that exist as hand-written files and belong in the sitemap. privacy
// and terms are deliberately absent: both carry <meta name="robots"
// content="noindex">, and submitting a noindex URL is a Search Console error.
const STATIC_PAGES = ["/", "/clubs.html", "/pricing.html", "/tour.html"];

function extract(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "i"));
  if (!m) throw new Error(`Could not find <${tag}> in index.html — the blog build reuses it for site chrome.`);
  return m[0];
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

/** Posts are content fragments led by a JSON metadata comment. */
function parsePost(filename, raw) {
  const m = raw.match(/^<!--([\s\S]*?)-->/);
  if (!m) throw new Error(`${filename}: missing leading <!--{ ... }--> metadata block`);
  let meta;
  try {
    meta = JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`${filename}: metadata block is not valid JSON — ${e.message}`);
  }
  for (const key of ["title", "date", "description"]) {
    if (!meta[key]) throw new Error(`${filename}: metadata is missing "${key}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
    throw new Error(`${filename}: date must be YYYY-MM-DD, got "${meta.date}"`);
  }
  return { ...meta, slug: filename.replace(/\.html$/, ""), body: raw.slice(m[0].length).trim() };
}

// Blog-specific styles, layered on top of index.html's tokens (which this
// reuses — --surface, --border, --muted, --accent all come from there).
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

function page({ title, description, canonical, chrome, content }) {
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

    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="https://diamondaudit.io/screenshots/app-dashboard.webp" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="https://diamondaudit.io/screenshots/app-dashboard.webp" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
      rel="stylesheet"
    />

    <!-- GENERATED FILE — do not edit by hand.
         Source: landing/blog/posts/  ·  Build: node landing/_build/build.mjs -->
${chrome.style}
${BLOG_CSS}
    <script src="/analytics.js" defer></script>
  </head>

  <body>
${chrome.header}
${content}
${chrome.footer}
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

function buildSitemap(posts) {
  const urls = [
    ...STATIC_PAGES.map(p => `${SITE}${p}`),
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

function main() {
  const index = readFileSync(join(LANDING, "index.html"), "utf8");
  const chrome = {
    style: extract(index, "style"),
    header: extract(index, "header"),
    footer: extract(index, "footer"),
  };

  if (!existsSync(POSTS_DIR)) mkdirSync(POSTS_DIR, { recursive: true });
  const files = readdirSync(POSTS_DIR).filter(f => f.endsWith(".html"));
  const posts = files
    .map(f => parsePost(f, readFileSync(join(POSTS_DIR, f), "utf8")))
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first

  for (const post of posts) {
    writeFileSync(
      join(BLOG_OUT, `${post.slug}.html`),
      page({
        title: `${post.title} — DiamondAudit`,
        description: post.description,
        canonical: `${SITE}/blog/${post.slug}.html`,
        chrome,
        content: postContent(post),
      }),
    );
  }

  writeFileSync(
    join(BLOG_OUT, "index.html"),
    page({
      title: "Blog — DiamondAudit",
      description: "Notes on running better tryouts: process, evaluation, and what the data actually says.",
      canonical: `${SITE}/blog/`,
      chrome,
      content: indexContent(posts),
    }),
  );

  writeFileSync(join(LANDING, "sitemap.xml"), buildSitemap(posts));

  console.log(`Built ${posts.length} post${posts.length === 1 ? "" : "s"} + blog index + sitemap.xml`);
  for (const p of posts) console.log(`  /blog/${p.slug}.html — ${p.title}`);
}

main();
