import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("the + stepper increments by 0.5 and reports the new value", () => {
    const onChange = vi.fn();
    render(<EvaluationSlider label="Contact" value={5} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Increase Contact"));
    expect(onChange).toHaveBeenCalledWith(5.5);
    expect(screen.getByText("5.5")).toBeInTheDocument();
  });

  it("the − stepper decrements by 0.5 and reports the new value", () => {
    const onChange = vi.fn();
    render(<EvaluationSlider label="Contact" value={5} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Decrease Contact"));
    expect(onChange).toHaveBeenCalledWith(4.5);
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("clamps at the top: + is disabled at 10 and never exceeds it", () => {
    const onChange = vi.fn();
    render(<EvaluationSlider label="Power" value={10} onChange={onChange} />);
    const inc = screen.getByLabelText("Increase Power");
    expect(inc).toBeDisabled();
    fireEvent.click(inc);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("10.0")).toBeInTheDocument();
  });

  it("clamps at the bottom: − is disabled at 1 and never goes below it", () => {
    const onChange = vi.fn();
    render(<EvaluationSlider label="Power" value={1} onChange={onChange} />);
    const dec = screen.getByLabelText("Decrease Power");
    expect(dec).toBeDisabled();
    fireEvent.click(dec);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("1.0")).toBeInTheDocument();
  });
});
