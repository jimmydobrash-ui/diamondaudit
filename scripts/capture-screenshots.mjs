// Capture dark-mode product screenshots of the running app for the marketing
// landing page. Saves PNGs into landing/screenshots/.
//
// Usage:
//   DA_EMAIL=… DA_PASSWORD=… npm run dev   (in another terminal, port 8080)
//   DA_EMAIL=… DA_PASSWORD=… node scripts/capture-screenshots.mjs
//
// Credentials come from env vars so nothing secret lands in the repo.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const WEBP_QUALITY = 0.85;

// Encode a PNG buffer to WebP using Chromium's canvas encoder (no native deps).
const toWebp = async (page, pngBuffer, quality = WEBP_QUALITY) => {
  const dataUrl = "data:image/png;base64," + pngBuffer.toString("base64");
  const b64 = await page.evaluate(
    async ({ dataUrl, quality }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.toDataURL("image/webp", quality).split(",")[1];
    },
    { dataUrl, quality },
  );
  return Buffer.from(b64, "base64");
};

// Blur the coach's display name in the header user pill (the .text-xs span),
// so no real name ships in marketing screenshots.
const blurName = () => {
  const pill = [...document.querySelectorAll("header div")].find(
    (d) => d.className.includes("px-3") && d.className.includes("rounded-full"),
  );
  if (!pill) return;
  pill.querySelectorAll("span").forEach((s) => {
    if (/(^|\s)text-xs(\s|$)/.test(s.className)) s.style.filter = "blur(6px)";
  });
};

const BASE = process.env.DA_BASE ?? "http://localhost:8080";
const EMAIL = process.env.DA_EMAIL;
const PASSWORD = process.env.DA_PASSWORD;
const OUT = "landing/screenshots";

if (!EMAIL || !PASSWORD) {
  console.error("Set DA_EMAIL and DA_PASSWORD env vars.");
  process.exit(1);
}

// First eval link id scouted from /evaluate (any player works — we want the
// scoring UI + ScoringRuler, not a specific athlete).
const EVAL_ID = process.env.DA_EVAL_ID ?? "556f8859-9a34-4967-bea9-2e6cfb5783ed";

const DESKTOP = { width: 1280, height: 860 };
const MOBILE = { width: 390, height: 844 };

const shots = [
  { name: "app-leaderboard", path: "/leaderboard", viewport: DESKTOP },
  { name: "app-evaluate", path: `/evaluate/${EVAL_ID}`, viewport: DESKTOP },
  { name: "app-evaluate-mobile", path: `/evaluate/${EVAL_ID}`, viewport: MOBILE },
  { name: "app-team-builder", path: "/team-builder", viewport: DESKTOP, tab: /^Offer/ },
  { name: "app-dashboard", path: "/", viewport: DESKTOP },
  // Note: the template/settings screen is intentionally NOT captured — it shows
  // real pending-invite emails that the name-blur does not cover.
];

const run = async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  // Force the app into dark mode on every document load (class strategy).
  await context.addInitScript(() => {
    document.documentElement.classList.add("dark");
  });
  const page = await context.newPage();
  const convPage = await context.newPage(); // blank page for WebP encoding

  // --- Sign in ---
  await page.setViewportSize(DESKTOP);
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  console.log("signed in");

  // --- Capture ---
  for (const shot of shots) {
    await page.setViewportSize(shot.viewport);
    await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    if (shot.tab) {
      await page.getByRole("button", { name: shot.tab }).first().click();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1200); // let lazy chunks + data settle
    await page.evaluate(blurName); // redact the display name in the header pill
    const png = await page.screenshot(); // viewport-only buffer
    const webp = await toWebp(convPage, png);
    const file = `${OUT}/${shot.name}.webp`;
    await writeFile(file, webp);
    console.log("saved", file, `${Math.round(webp.length / 1024)}KB`);
  }

  await browser.close();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
