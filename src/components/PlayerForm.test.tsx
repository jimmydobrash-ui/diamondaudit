import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PlayerForm, { playerFormToPayload, emptyPlayerForm } from "./PlayerForm";

describe("PlayerForm — jersey number", () => {
  it("raises the jersey number cap to 999 (tryouts run past 99)", () => {
    const { container } = render(
      <PlayerForm submitting={false} submitLabel="Add Player" onSubmit={() => {}} />,
    );
    const jersey = container.querySelector('input[type="number"][max="999"]');
    expect(jersey).not.toBeNull();
    expect(jersey).toHaveAttribute("min", "0");
  });

  it("submits successfully with a jersey number above the old 99 cap", () => {
    // Regression guard: with the old max={99}, the browser's native constraint
    // validation silently blocked the form's submit event for any value over
    // 99 (the exact bug reported from a 186-player tryout) — handleSubmit
    // would never even run. This proves the raised cap lets it through.
    const onSubmit = vi.fn();
    const { container } = render(
      <PlayerForm submitting={false} submitLabel="Add Player" onSubmit={onSubmit} />,
    );
    const [firstName, lastName] = container.querySelectorAll('input[maxlength="100"]');
    const dob = container.querySelector('input[type="date"]');
    const jersey = container.querySelector('input[type="number"][max="999"]');

    fireEvent.change(firstName, { target: { value: "Marcus" } });
    fireEvent.change(lastName, { target: { value: "Johnson" } });
    fireEvent.change(dob!, { target: { value: "2012-05-10" } });
    fireEvent.change(jersey!, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: /add player/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ jersey_number: "150" }));
  });
});

describe("playerFormToPayload — jersey number", () => {
  it("converts jersey numbers above 100 to a number, uncapped", () => {
    const payload = playerFormToPayload({ ...emptyPlayerForm, jersey_number: "150" });
    expect(payload.jersey_number).toBe(150);
  });

  it("converts jersey numbers up to 999", () => {
    const payload = playerFormToPayload({ ...emptyPlayerForm, jersey_number: "999" });
    expect(payload.jersey_number).toBe(999);
  });

  it("does not dedupe or reject a jersey number shared with another player", () => {
    // playerFormToPayload only ever sees one player at a time, so duplicate
    // detection isn't (and shouldn't be) its job — two payloads built with the
    // same jersey number should both come through unchanged.
    const a = playerFormToPayload({ ...emptyPlayerForm, first_name: "Marcus", jersey_number: "7" });
    const b = playerFormToPayload({ ...emptyPlayerForm, first_name: "Eli", jersey_number: "7" });
    expect(a.jersey_number).toBe(7);
    expect(b.jersey_number).toBe(7);
  });

  it("still maps a blank jersey number to null", () => {
    const payload = playerFormToPayload({ ...emptyPlayerForm, jersey_number: "" });
    expect(payload.jersey_number).toBeNull();
  });
});
