import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EvaluationTimer from "./EvaluationTimer";

// Drive performance.now() from a mutable value so the test controls the clock
// at each step. (A call-order mock won't work — React 18's scheduler also calls
// performance.now(), so it would consume a mockReturnValueOnce before start().)
describe("EvaluationTimer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("captures the elapsed seconds (2dp) when stopped", () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const onCapture = vi.fn();
    render(<EvaluationTimer onCapture={onCapture} />);

    now = 1000;
    fireEvent.click(screen.getByLabelText("Start timer"));
    now = 5310; // 4.31s later
    fireEvent.click(screen.getByLabelText("Stop timer"));

    expect(onCapture).toHaveBeenCalledWith(4.31);
    expect(screen.getByText("4.31")).toBeInTheDocument();
  });

  it("does not capture anything until the coach stops it", () => {
    let now = 2000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const onCapture = vi.fn();
    render(<EvaluationTimer onCapture={onCapture} />);

    fireEvent.click(screen.getByLabelText("Start timer"));

    expect(onCapture).not.toHaveBeenCalled();
  });

  it("reset returns the readout to 0.00", () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    render(<EvaluationTimer onCapture={vi.fn()} />);

    now = 1000;
    fireEvent.click(screen.getByLabelText("Start timer"));
    now = 3000;
    fireEvent.click(screen.getByLabelText("Stop timer"));
    expect(screen.getByText("2.00")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Reset timer"));
    expect(screen.getByText("0.00")).toBeInTheDocument();
  });
});
