import { describe, it, expect } from "vitest";
import { sanitisePath, sanitiseUrl, sanitiseReferrer } from "./analytics";

const PLAYER_UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("sanitisePath", () => {
  it("leaves real route names alone", () => {
    expect(sanitisePath("/")).toBe("/");
    expect(sanitisePath("/players")).toBe("/players");
    expect(sanitisePath("/team-builder")).toBe("/team-builder");
    expect(sanitisePath("/scoring-guide")).toBe("/scoring-guide");
    expect(sanitisePath("/players/report-cards")).toBe("/players/report-cards");
    expect(sanitisePath("/settings/template")).toBe("/settings/template");
    expect(sanitisePath("/auth/recover")).toBe("/auth/recover");
  });

  it("collapses player UUIDs wherever they appear", () => {
    expect(sanitisePath(`/players/${PLAYER_UUID}`)).toBe("/players/:id");
    expect(sanitisePath(`/evaluate/${PLAYER_UUID}`)).toBe("/evaluate/:id");
    expect(sanitisePath(`/players/${PLAYER_UUID}/report`)).toBe("/players/:id/report");
    expect(sanitisePath(`/players/${PLAYER_UUID}/edit`)).toBe("/players/:id/edit");
  });

  it("collapses a segment containing an email address", () => {
    expect(sanitisePath("/invite/coach@example.com")).toBe("/invite/:id");
  });

  it("collapses long opaque tokens", () => {
    expect(sanitisePath("/t/a8Xk92Lm04Qz71Rb55")).toBe("/t/:id");
  });

  it("keeps static landing filenames", () => {
    expect(sanitisePath("/pricing.html")).toBe("/pricing.html");
    expect(sanitisePath("/clubs.html")).toBe("/clubs.html");
    expect(sanitisePath("/tour.html")).toBe("/tour.html");
  });
});

describe("sanitiseUrl", () => {
  it("drops the query string entirely", () => {
    expect(sanitiseUrl("https://app.diamondaudit.io/leaderboard?age=12U&sort=overall")).toBe(
      "https://app.diamondaudit.io/leaderboard",
    );
  });

  it("drops the fragment", () => {
    expect(sanitiseUrl("https://app.diamondaudit.io/players#roster")).toBe(
      "https://app.diamondaudit.io/players",
    );
  });

  it("never leaks an invited email from the legacy invite link", () => {
    const leaky = "https://app.diamondaudit.io/auth?invite=1&email=DECOY_MUST_NOT_LEAK@example.com";
    const safe = sanitiseUrl(leaky);
    expect(safe).toBe("https://app.diamondaudit.io/auth");
    expect(safe).not.toContain("DECOY_MUST_NOT_LEAK");
    expect(safe).not.toContain("@");
  });

  it("strips the query and the player id together", () => {
    const raw = `https://app.diamondaudit.io/evaluate/${PLAYER_UUID}?tab=hitting`;
    expect(sanitiseUrl(raw)).toBe("https://app.diamondaudit.io/evaluate/:id");
  });

  it("preserves the marketing origin", () => {
    expect(sanitiseUrl("https://www.diamondaudit.io/pricing.html?utm_source=x")).toBe(
      "https://www.diamondaudit.io/pricing.html",
    );
  });

  it("falls back safely instead of throwing on junk", () => {
    expect(sanitiseUrl("::::not a url::::")).toMatch(/^https:\/\/app\.diamondaudit\.io/);
  });
});

describe("sanitiseReferrer", () => {
  it("keeps an absent referrer empty so organic attribution still works", () => {
    expect(sanitiseReferrer("")).toBe("");
  });

  it("sanitises a referrer that carries an id or query", () => {
    expect(sanitiseReferrer(`https://app.diamondaudit.io/players/${PLAYER_UUID}?q=1`)).toBe(
      "https://app.diamondaudit.io/players/:id",
    );
  });

  it("never forwards an email that arrived via the referrer header", () => {
    const raw = "https://app.diamondaudit.io/auth?email=DECOY_MUST_NOT_LEAK@example.com";
    expect(sanitiseReferrer(raw)).not.toContain("DECOY_MUST_NOT_LEAK");
  });
});
