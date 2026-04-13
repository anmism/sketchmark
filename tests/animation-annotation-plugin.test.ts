import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "../src/parser";
import { buildSceneGraph } from "../src/scene";
import { layout } from "../src/layout";
import { renderToSVG } from "../src/renderer/svg";
import { AnimationController } from "../src/animation";
import { annotations } from "../packages/plugin-annotations/src/index";
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
    plugins: [annotations(), geometry()],
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

describe("AnimationController annotation helpers", () => {
  it("keeps generated annotation labels hidden until their parent draw step", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram layout=absolute
geo.point A x=90 y=230
geo.point B x=290 y=230
annot.dimension base from=A to=B label="6 cm"
step draw base
end`);

    try {
      const base = svg.querySelector<SVGGElement>("#node-base");
      const label = svg.querySelector<SVGGElement>("#node-__annot_base_label");

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

  it("keeps generated annotation labels in sync with non-draw animations", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram layout=absolute
geo.point A x=90 y=230
geo.point B x=290 y=230
annot.dimension base from=A to=B label="6 cm"
step highlight base
step fade base
step move base dx=20 dy=10
step color base value="#ff0000"
end`);

    try {
      const label = svg.querySelector<SVGGElement>("#node-__annot_base_label");
      anim.next();
      expect(label?.classList.contains("hl")).toBe(true);

      anim.next();
      expect(label?.classList.contains("faded")).toBe(true);

      anim.next();
      expect(label?.style.transform).toContain("translate(20px,10px)");

      anim.next();
    } finally {
      cleanup();
    }
  });
});
