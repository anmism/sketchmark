import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANIMATION } from "../src/config";
import { parse } from "../src/parser";
import { buildSceneGraph } from "../src/scene";
import { layout } from "../src/layout";
import { renderToSVG } from "../src/renderer/svg";
import { AnimationController } from "../src/animation";

function renderAnimatedDiagram(dsl: string): {
  svg: SVGSVGElement;
  anim: AnimationController;
  cleanup: () => void;
} {
  const canvasProto = Object.getPrototypeOf(document.createElement("canvas")) as {
    getContext?: (contextId: string) => unknown;
  };
  if (typeof canvasProto.getContext !== "function") {
    canvasProto.getContext = () => ({
      font: "",
      measureText: (text: string) => ({ width: text.length * 8 }),
    });
  }

  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(performance.now()), 0)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) =>
    window.clearTimeout(id)) as typeof window.cancelAnimationFrame;

  const ast = parse(dsl);
  const scene = buildSceneGraph(ast);
  layout(scene);

  const container = document.createElement("div");
  document.body.appendChild(container);
  const svg = renderToSVG(scene, container);
  const anim = new AnimationController(svg, ast.steps, container, undefined, ast.config);

  return {
    svg,
    anim,
    cleanup: () => {
      anim.destroy();
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

describe("AnimationController node draw text reveal", () => {
  it("applies the text clip-path before the delayed reveal window", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
box a label="This is text,\n and this is this long"
step draw a
end`);

    try {
      const text = svg.querySelector<SVGTextElement>("#node-a text");
      if (!text) throw new Error("Missing node label text");
      const clipPathValue = () => text.getAttributeNode("clip-path")?.value ?? "";

      Object.defineProperty(text, "getBBox", {
        configurable: true,
        value: () => ({ x: 20, y: 20, width: 140, height: 32 }),
      });

      anim.next();
      vi.advanceTimersByTime(1);

      expect(clipPathValue()).toMatch(/^url\(#skm-clip-/);

      vi.advanceTimersByTime(ANIMATION.nodeStrokeDur + ANIMATION.textDelay + 29);
      expect(clipPathValue()).toMatch(/^url\(#skm-clip-/);

      vi.advanceTimersByTime(ANIMATION.textRevealMs + 51);
      expect(text.hasAttribute("clip-path")).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("uses the step duration for text-only nodes", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
text a label="This is text, and this is this long"
step draw a duration=6000
end`);

    try {
      const text = svg.querySelector<SVGTextElement>("#node-a text");
      if (!text) throw new Error("Missing text-only node label");
      const clipPathValue = () => text.getAttributeNode("clip-path")?.value ?? "";

      Object.defineProperty(text, "getBBox", {
        configurable: true,
        value: () => ({ x: 12, y: 12, width: 180, height: 18 }),
      });

      anim.next();
      vi.advanceTimersByTime(1);

      expect(clipPathValue()).toMatch(/^url\(#skm-clip-/);

      vi.advanceTimersByTime(5800);
      expect(clipPathValue()).toMatch(/^url\(#skm-clip-/);

      vi.advanceTimersByTime(300);
      expect(text.hasAttribute("clip-path")).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("does not stretch shaped node text reveal to the full step duration", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
box a label="This is text, and this is this long"
step draw a duration=6000
end`);

    try {
      const text = svg.querySelector<SVGTextElement>("#node-a text");
      if (!text) throw new Error("Missing shaped node label");
      const clipPathValue = () => text.getAttributeNode("clip-path")?.value ?? "";

      Object.defineProperty(text, "getBBox", {
        configurable: true,
        value: () => ({ x: 20, y: 20, width: 180, height: 18 }),
      });

      anim.next();
      vi.advanceTimersByTime(1);

      expect(clipPathValue()).toMatch(/^url\(#skm-clip-/);

      vi.advanceTimersByTime(6999);
      expect(text.hasAttribute("clip-path")).toBe(false);
    } finally {
      cleanup();
    }
  });
});
