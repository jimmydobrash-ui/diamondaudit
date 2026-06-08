import { test, expect } from "@playwright/test";

// Smoke coverage that doesn't require a logged-in session. Verifies the SPA
// boots, the protected-route guard redirects an unauthenticated visitor to the
// auth page, and the sign-in form renders. Authenticated flows (add player,
// evaluate → save → reopen) need a seeded test account — see README/notes
// before adding those.

test("unauthenticated visit to home redirects to the auth page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth/);
});

test("auth page shows the DiamondAudit sign-in form", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByAltText("DiamondAudit")).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("deep link to a protected route redirects to auth (SPA rewrite)", async ({ page }) => {
  await page.goto("/players");
  await expect(page).toHaveURL(/\/auth/);
});
