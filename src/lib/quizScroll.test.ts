import { describe, expect, it, vi } from "vitest";
import { scrollQuizActionsIntoView } from "./quizScroll";

describe("scrollQuizActionsIntoView", () => {
  it("smoothly reveals the quiz actions with the smallest necessary page movement", () => {
    const scrollIntoView = vi.fn();

    scrollQuizActionsIntoView({ scrollIntoView }, false);

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });
  });

  it("avoids animated scrolling when the user prefers reduced motion", () => {
    const scrollIntoView = vi.fn();

    scrollQuizActionsIntoView({ scrollIntoView }, true);

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "nearest",
    });
  });

  it("does nothing before the quiz actions are mounted", () => {
    expect(() => scrollQuizActionsIntoView(null)).not.toThrow();
  });
});
