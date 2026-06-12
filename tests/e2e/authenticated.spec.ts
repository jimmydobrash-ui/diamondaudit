import { test, expect } from "@playwright/test";

// Authenticated coverage. Provide a test account to run these:
//   TEST_USER_EMAIL=you@example.com TEST_USER_PASSWORD=secret npm run test:e2e
// They skip automatically when those env vars aren't set (e.g. the public CI
// run). Read-only: this navigates the signed-in shell and asserts each section
// renders — it does not create or modify any data. A data-mutating flow
// (add player → evaluate → save → reopen) needs a dedicated test org/DB so it
// doesn't pollute prod; that's intentionally not automated here. The core of
// that regression (inputs reflecting saved values) is covered by the
// EvaluationSlider / EvaluationNumberInput component tests.

const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;

test.describe("authenticated shell", () => {
  test.skip(!EMAIL || !PASSWORD, "set TEST_USER_EMAIL and TEST_USER_PASSWORD to run");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    // Land on the dashboard.
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("dashboard renders after login", async ({ page }) => {
    await expect(page.getByText("Tryout Overview")).toBeVisible();
  });

  test("bottom nav reaches each main section", async ({ page }) => {
    await page.getByRole("link", { name: "Players", exact: true }).click();
    await expect(page).toHaveURL(/\/players$/);
    await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();

    await page.getByRole("link", { name: "Evaluate", exact: true }).click();
    await expect(page).toHaveURL(/\/evaluate$/);

    await page.getByRole("link", { name: "Build", exact: true }).click();
    await expect(page).toHaveURL(/\/team-builder$/);

    await page.getByRole("link", { name: "Results", exact: true }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  });

  test("scoring guide opens from the header help icon", async ({ page }) => {
    await page.getByRole("link", { name: "Scoring guide" }).click();
    await expect(page).toHaveURL(/\/scoring-guide$/);
    await expect(page.getByRole("heading", { name: "Scoring Guide" })).toBeVisible();
  });
});
