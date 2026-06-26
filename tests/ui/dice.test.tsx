// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { act } from "react";
import { Dice } from "../../src/ui/Dice";

afterEach(cleanup);

describe("Dice highlighting", () => {
  it("colors settled faces immediately when mounted with a roll (no animation)", () => {
    const { container } = render(<Dice roll={[6, 5, 3]} />);
    expect(container.querySelectorAll(".die").length).toBe(3);
    // 6,5 -> hit, 3 -> miss; all three carry an outcome class
    expect(container.querySelectorAll(".die--hit, .die--miss, .die--low").length).toBe(3);
  });

  it("settles a fresh roll to highlighted faces after the tumble animation", () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<Dice roll={[]} />);
      act(() => { rerender(<Dice roll={[6, 1, 4]} />); }); // a new roll → animates (uncolored while rolling)
      act(() => { vi.advanceTimersByTime(800); });          // finish the ~700ms tumble
      expect(container.querySelectorAll(".die").length).toBe(3);
      expect(container.querySelectorAll(".die--hit, .die--miss, .die--low").length).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  // Regression: a no-op state change after a roll (e.g. auto-skipping the empty helpers
  // step) re-renders with a NEW array of identical values. The dice must still settle,
  // not get stuck rolling/cream.
  it("still settles when re-rendered mid-tumble with an identical-content roll", () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<Dice roll={[]} />);
      act(() => { rerender(<Dice roll={[6, 1, 4]} />); });   // roll lands → tumble starts
      act(() => { vi.advanceTimersByTime(200); });            // mid-tumble
      act(() => { rerender(<Dice roll={[6, 1, 4]} />); });   // new array, SAME values (clone)
      act(() => { vi.advanceTimersByTime(800); });            // let the original timer finish
      expect(container.querySelectorAll(".die--hit, .die--miss, .die--low").length).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
