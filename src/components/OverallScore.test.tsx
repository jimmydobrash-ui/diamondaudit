import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OverallScore from "./OverallScore";

describe("OverallScore", () => {
  it("renders the score with its /10 scale", () => {
    render(<OverallScore value={7.5} />);
    expect(screen.getByText("7.5")).toBeInTheDocument();
    expect(screen.getByText("/ 10")).toBeInTheDocument();
  });

  it("omits the tier label by default", () => {
    render(<OverallScore value={5.8} />);
    expect(screen.queryByText(/AAA|Average/)).not.toBeInTheDocument();
  });

  it("shows the rubric tier when showTier is set", () => {
    render(<OverallScore value={5.8} showTier />);
    expect(screen.getByText("Average (AAA)")).toBeInTheDocument();
  });

  it("labels an above-average score", () => {
    render(<OverallScore value={7.5} showTier />);
    expect(screen.getByText("Above Avg (AAA)")).toBeInTheDocument();
  });
});
