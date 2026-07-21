import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EvaluationNumberInput from "./EvaluationNumberInput";

describe("EvaluationNumberInput", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows an empty field for a null value", () => {
    render(<EvaluationNumberInput label="Exit Velo" value={null} unit="mph" onChange={() => {}} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(null);
  });

  it("reflects a later value-prop change (saved score loading in)", () => {
    const { rerender } = render(
      <EvaluationNumberInput label="Exit Velo" value={null} unit="mph" onChange={() => {}} />,
    );
    rerender(<EvaluationNumberInput label="Exit Velo" value={80} unit="mph" onChange={() => {}} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(80);
  });

  it("calls onChange with the parsed number", () => {
    const onChange = vi.fn();
    render(<EvaluationNumberInput label="Exit Velo" value={null} unit="mph" onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "75" } });
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it("calls onChange with null when cleared", () => {
    const onChange = vi.fn();
    render(<EvaluationNumberInput label="Exit Velo" value={80} unit="mph" onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows a stopwatch on timed (sec) fields", () => {
    render(<EvaluationNumberInput label="Home to 1st" value={null} unit="sec" onChange={() => {}} />);
    expect(screen.getByLabelText("Start timer")).toBeInTheDocument();
  });

  it("does not show a stopwatch on non-timed (mph) fields", () => {
    render(<EvaluationNumberInput label="Exit Velo" value={null} unit="mph" onChange={() => {}} />);
    expect(screen.queryByLabelText("Start timer")).not.toBeInTheDocument();
  });

  it("stopping the timer fills the field with the elapsed time", () => {
    // Mutable clock (React's scheduler also calls performance.now()).
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const onChange = vi.fn();
    render(<EvaluationNumberInput label="Home to 1st" value={null} unit="sec" onChange={onChange} />);
    now = 1000;
    fireEvent.click(screen.getByLabelText("Start timer"));
    now = 4500; // 3.5s later
    fireEvent.click(screen.getByLabelText("Stop timer"));
    expect(onChange).toHaveBeenCalledWith(3.5);
    expect(screen.getByRole("spinbutton")).toHaveValue(3.5);
  });

  it("still accepts manual entry on a timed field (timer never blocks typing)", () => {
    const onChange = vi.fn();
    render(<EvaluationNumberInput label="Home to 1st" value={null} unit="sec" onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "4.2" } });
    expect(onChange).toHaveBeenCalledWith(4.2);
    expect(screen.getByRole("spinbutton")).toHaveValue(4.2);
  });
});
