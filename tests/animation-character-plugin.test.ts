import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "../src/parser";
import { buildSceneGraph } from "../src/scene";
import { layout } from "../src/layout";
import { renderToSVG } from "../src/renderer/svg";
import { AnimationController } from "../src/animation";
import { character } from "../packages/plugin-character/src/index";

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
    plugins: [character()],
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

describe("AnimationController character transforms", () => {
  it("keeps group movement and limb rotation composable", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
char.actor hero x=120 y=90 pose=walk1
step move hero dx=50 dy=0 duration=300
step rotate hero_armR deg=20 duration=300
end`);

    try {
      const hero = svg.querySelector<SVGGElement>("#group-hero");
      const arm = svg.querySelector<SVGGElement>("#node-hero_armR");

      anim.next();
      expect(hero?.style.transform).toContain("translate(50px,0px)");
      expect(arm?.style.transform).toContain("translate(50px,0px)");
      expect(arm?.style.transform).toContain("rotate(92deg)");

      anim.next();
      expect(hero?.style.transform).toContain("translate(50px,0px)");
      expect(arm?.style.transform).toContain("translate(50px,0px)");
      expect(arm?.style.transform).toContain("rotate(20deg)");
      expect(arm?.style.transform).toContain("rotate(92deg)");
    } finally {
      cleanup();
    }
  });
});
