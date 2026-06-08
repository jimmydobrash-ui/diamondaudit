import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EvaluationSlider from "./EvaluationSlider";

describe("EvaluationSlider", () => {
  it("displays the initial value", () => {
    render(<EvaluationSlider label="Contact" value={5} onChange={() => {}} />);
    expect(screen.getByText("5.0")).toBeInTheDocument();
  });

  it("reflects later value-prop changes (saved scores loading in)", () => {
    // Guards the reset bug: the slider must update when the parent supplies a
    // new value after mount, not stay stuck on its initial value.
    const { rerender } = render(
      <EvaluationSlider label="Contact" value={5} onChange={() => {}} />,
    );
    expect(screen.getByText("5.0")).toBeInTheDocument();

    rerender(<EvaluationSlider label="Contact" value={8} onChange={() => {}} />);
    expect(screen.getByText("8.0")).toBeInTheDocument();
    expect(screen.queryByText("5.0")).not.toBeInTheDocument();
  });

  it("renders its label", () => {
    render(<EvaluationSlider label="Bat Speed" value={6} onChange={vi.fn()} />);
    expect(screen.getByText("Bat Speed")).toBeInTheDocument();
  });
});
