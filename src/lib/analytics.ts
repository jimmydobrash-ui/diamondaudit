/**
 * Google Analytics 4 — privacy-first wiring for app.diamondaudit.io.
 *
 * DiamondAudit stores evaluations of minors, and its URLs carry two things that
 * must never reach Google:
 *   - player UUIDs (/players/:id, /evaluate/:id, /players/:id/report)
 *   - an invitee's email address (legacy /auth?invite=1&email=…)
 *
 * So we never let gtag read `document.location` / `document.referrer` for
 * itself. Every event passes an explicitly sanitised page_location, page_path
 * and page_referrer. The query string and fragment are dropped wholesale
 * (allowlist-by-omission: harmless params like ?sort= and ?age= go too, which
 * is a fine trade for never having to maintain a blocklist), and opaque path
 * segments collapse to `:id`.
 *
 * Two non-obvious failure modes this file is written to avoid:
 *   1. The dataLayer shim MUST push the real `arguments` object. Pushing a rest
 *      array (`(...a) => dataLayer.push(a)`) silently no-ops: the script loads,
 *      window.gtag appears, and not one hit is ever sent.
 *   2. Neither CSP allows 'unsafe-inline', so Google's copy-paste inline config
 *      block cannot run. Only the external gtag.js loads; the config below has
 *      to happen in bundled code like this.
 *
 * The GA4 "Enhanced measurement → page changes based on browser history events"
 * toggle MUST stay off in the dashboard. It fires its own pageview from gtag's
 * internally captured raw URL and ignores every sanitised value passed here —
 * no code change can defeat it.
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

/**
 * Only these hosts report. Keeps localhost and Vercel preview deploys from
 * polluting the property. Both hosts share one GA4 property so the
 * marketing → signup → app funnel stays followable.
 */
const REPORTING_HOSTS = new Set(["www.diamondaudit.io", "app.diamondaudit.io"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True for a path segment that looks like an identifier rather than a route
 * name. Real routes here are short lowercase words ("players", "team-builder",
 * "scoring-guide"); ids are UUIDs, contain an "@", or are long and carry
 * digits. Deliberately conservative — a missed collapse leaks an id, while an
 * over-eager one only blurs a route name in reports.
 */
function isOpaqueSegment(segment: string): boolean {
  if (UUID_RE.test(segment)) return true;
  if (segment.includes("@")) return true;
  return segment.length >= 16 && /\d/.test(segment);
}

/** Collapse identifier-ish path segments to `:id`. */
export function sanitisePath(pathname: string): string {
  const cleaned = pathname
    .split("/")
    .map(segment => (isOpaqueSegment(segment) ? ":id" : segment))
    .join("/");
  return cleaned === "" ? "/" : cleaned;
}

/**
 * Absolute URL with the query string and fragment removed and ids collapsed.
 * Falls back to "/" rather than throwing on anything unparseable — analytics
 * must never break a page.
 */
export function sanitiseUrl(raw: string): string {
  try {
    const url = new URL(raw, "https://app.diamondaudit.io");
    return `${url.origin}${sanitisePath(url.pathname)}`;
  } catch {
    return "https://app.diamondaudit.io/";
  }
}

/**
 * A referrer safe to forward. Same sanitisation as above, but an empty/absent
 * referrer stays empty so GA can still attribute organic traffic correctly.
 * (On DiamondReps the leak that survived every other fix hid in `dr`.)
 */
export function sanitiseReferrer(raw: string): string {
  if (!raw) return "";
  return sanitiseUrl(raw);
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/** Whether analytics should run at all: configured, in a browser, right host. */
export function analyticsEnabled(): boolean {
  if (!MEASUREMENT_ID) return false;
  if (typeof window === "undefined") return false;
  return REPORTING_HOSTS.has(window.location.hostname);
}

let initialised = false;

/**
 * Load gtag.js and configure it. Safe to call more than once.
 *
 * `send_page_view: false` — we report every pageview ourselves (including the
 * first) through trackPageview, so gtag never gets to infer one from the raw
 * URL.
 */
export function initAnalytics(): void {
  if (initialised || !analyticsEnabled()) return;
  initialised = true;

  window.dataLayer = window.dataLayer || [];
  // Must forward the real `arguments` object — see the note at the top of this
  // file. A rest-parameter version of this function sends nothing, silently.
  // Declared with no parameters on purpose (that is what makes `arguments` the
  // caller's own list); we then call it through the typed window.gtag alias so
  // TypeScript still checks the call sites below.
  function gtagShim() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  }
  window.gtag = gtagShim as unknown as Window["gtag"];
  const gtag = window.gtag;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag("js", new Date());

  // Deny every advertising signal before any hit goes out. This product holds
  // evaluations of children; it has no business feeding ad profiles.
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });

  gtag("config", MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    // Shared across www + app so a visitor crossing hosts stays one session.
    // Without this the app looks referred by our own marketing site and the
    // signup funnel splits in two.
    cookie_domain: ".diamondaudit.io",
    cookie_flags: "SameSite=None;Secure",
    page_location: sanitiseUrl(window.location.href),
    page_path: sanitisePath(window.location.pathname),
    page_referrer: sanitiseReferrer(document.referrer),
  });
}

/** Report one pageview with fully sanitised URL fields. */
export function trackPageview(pathname: string): void {
  if (!analyticsEnabled() || typeof window.gtag !== "function") return;
  const path = sanitisePath(pathname);
  window.gtag("event", "page_view", {
    page_location: `${window.location.origin}${path}`,
    page_path: path,
    page_referrer: sanitiseReferrer(document.referrer),
  });
}
