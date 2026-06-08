import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EvaluationNumberInput from "./EvaluationNumberInput";

describe("EvaluationNumberInput", () => {
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
});
