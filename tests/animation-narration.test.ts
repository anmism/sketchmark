import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationController, ANIMATION_CSS } from "../src/animation";
import type { ASTStepItem } from "../src/ast/types";

function renderAnimatedDiagram(steps: ASTStepItem[]): {
  anim: AnimationController;
  cleanup: () => void;
} {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(performance.now()), 0)) as typeof window.requestAnimationFrame;
  }

  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = ((id: number) =>
      window.clearTimeout(id)) as typeof window.cancelAnimationFrame;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "320");
  svg.setAttribute("height", "180");
  container.appendChild(svg);

  const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
  node.setAttribute("id", "node-a");
  node.setAttribute("class", "ng");
  svg.appendChild(node);

  const style = document.createElement("style");
  style.textContent = ANIMATION_CSS;
  document.head.appendChild(style);
  const anim = new AnimationController(svg, steps, container);

  return {
    anim,
    cleanup: () => {
      anim.destroy();
      style.remove();
      container.remove();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("AnimationController narration typing", () => {
  it("keeps only the latest narration text when next() is pressed rapidly", () => {
    const { anim, cleanup } = renderAnimatedDiagram([
      { kind: "step", action: "narrate", target: "", value: "Alpha" },
      { kind: "step", action: "draw", target: "a" },
      { kind: "step", action: "narrate", target: "", value: "Beta" },
    ]);

    try {
      anim.next();
      anim.next();
      anim.next();

      expect(anim.captionElement?.textContent).toBe("B");

      vi.advanceTimersByTime(200);

      expect(anim.captionElement?.textContent).toBe("Beta");
    } finally {
      cleanup();
    }
  });
});
