/*
 * Google Analytics 4 for www.diamondaudit.io (the static marketing site).
 *
 * The app half of this lives in src/lib/analytics.ts. Same GA4 property and the
 * same measurement ID on purpose: one property covering both hosts is what
 * keeps the marketing -> signup -> app journey followable as a single session.
 *
 * Why this is a separate file rather than the snippet Google gives you:
 *   - landing/vercel.json sets script-src 'self' https://www.googletagmanager.com
 *     with no 'unsafe-inline', so Google's inline <script> config block cannot
 *     run here. It has to be an external file like this one.
 *   - The measurement ID is hardcoded because the marketing site has no build
 *     step, so there is no env-var substitution available. A G- measurement ID
 *     is public by design (it ships in the page source of every GA site), so
 *     this is not a secret being committed.
 *
 * The dataLayer shim below MUST push the real `arguments` object. Rewriting it
 * as (...a) => dataLayer.push(a) silently sends nothing at all: the script
 * loads, window.gtag appears, and no hit is ever made and no _ga cookie set.
 */
(function () {
  "use strict";

  var MEASUREMENT_ID = "G-L8441V08D1";

  // Never report from localhost or a Vercel preview deploy.
  var REPORTING_HOSTS = ["www.diamondaudit.io", "diamondaudit.io"];
  if (REPORTING_HOSTS.indexOf(window.location.hostname) === -1) return;

  /*
   * Campaign parameters are preserved here and nowhere else.
   *
   * The app drops the query string wholesale because its URLs have carried an
   * invitee's email address. This site has no such parameter — it is public
   * marketing copy — and dropping the query here would silently destroy UTM
   * campaign attribution, which is most of the point of measuring a marketing
   * site. So: strict allowlist, everything not named below is discarded.
   */
  var ALLOWED_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
  ];

  function sanitiseUrl(raw) {
    try {
      var url = new URL(raw, "https://www.diamondaudit.io");
      var kept = new URLSearchParams();
      for (var i = 0; i < ALLOWED_PARAMS.length; i++) {
        var value = url.searchParams.get(ALLOWED_PARAMS[i]);
        if (value) kept.set(ALLOWED_PARAMS[i], value);
      }
      var query = kept.toString();
      // Fragment is always dropped.
      return url.origin + url.pathname + (query ? "?" + query : "");
    } catch (e) {
      return "https://www.diamondaudit.io/";
    }
  }

  // A referrer from our own app can carry a player id or a legacy ?email=,
  // so strip an inbound referrer back to origin + path with no query at all.
  function sanitiseReferrer(raw) {
    if (!raw) return "";
    try {
      var url = new URL(raw);
      return url.origin + url.pathname;
    } catch (e) {
      return "";
    }
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
  document.head.appendChild(script);

  gtag("js", new Date());

  // This product evaluates minors. No advertising signals, ever.
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });

  gtag("config", MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    // Shared with app.diamondaudit.io so crossing hosts stays one session and
    // conversions aren't attributed to "referral / diamondaudit.io".
    cookie_domain: ".diamondaudit.io",
    cookie_flags: "SameSite=None;Secure",
    page_location: sanitiseUrl(window.location.href),
    page_referrer: sanitiseReferrer(document.referrer),
  });
})();
