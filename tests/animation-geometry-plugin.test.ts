import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "../src/parser";
import { buildSceneGraph } from "../src/scene";
import { layout } from "../src/layout";
import { renderToSVG } from "../src/renderer/svg";
import { AnimationController } from "../src/animation";
import { geometry } from "../packages/plugin-geometry/src/index";

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

  const ast = parse(dsl, {
    plugins: [geometry()],
  });
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

describe("AnimationController geometry helpers", () => {
  it("keeps generated geometry labels hidden until their parent draw step", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram layout=absolute
geo.point A x=90 y=230
geo.point B x=290 y=230
geo.segment AB from=A to=B label="AB"
step draw AB
end`);

    try {
      const base = svg.querySelector<SVGGElement>("#node-AB");
      const label = svg.querySelector<SVGGElement>("#node-__geo_AB_label");

      expect(base?.classList.contains("hidden")).toBe(true);
      expect(label?.classList.contains("hidden")).toBe(true);

      anim.next();
      vi.advanceTimersByTime(1);

      expect(base?.classList.contains("hidden")).toBe(false);
      expect(label?.classList.contains("hidden")).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("keeps generated geometry labels in sync with non-draw animations", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram layout=absolute
geo.point O x=180 y=140 label="O"
step highlight O
step fade O
step move O dx=20 dy=12
step color O value="#ff0000"
end`);

    try {
      const label = svg.querySelector<SVGGElement>("#node-__geo_O_label");
      anim.next();
      expect(label?.classList.contains("hl")).toBe(true);

      anim.next();
      expect(label?.classList.contains("faded")).toBe(true);

      anim.next();
      expect(label?.style.transform).toContain("translate(20px,12px)");

      anim.next();
    } finally {
      cleanup();
    }
  });
});
