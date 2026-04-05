import { afterEach, describe, expect, it } from "vitest";
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

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(performance.now()), 0)) as typeof window.requestAnimationFrame;
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame;
  }

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

function getById(svg: SVGSVGElement, id: string): SVGGElement {
  const el = svg.querySelector<SVGGElement>(`#${id}`);
  if (!el) throw new Error(`Missing SVG element: ${id}`);
  return el;
}

function isHidden(el: SVGGElement): boolean {
  return el.classList.contains("hidden") || el.classList.contains("gg-hidden");
}

function isFaded(el: SVGGElement): boolean {
  return el.classList.contains("faded");
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("AnimationController group draw cascade", () => {
  it("pre-hides a draw-targeted group subtree and reveals implicit descendants on draw", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
box a
box b
group g1 items=[a,b]
step draw g1
end`);

    try {
      const group = getById(svg, "group-g1");
      const a = getById(svg, "node-a");
      const b = getById(svg, "node-b");

      expect(isHidden(group)).toBe(true);
      expect(isHidden(a)).toBe(true);
      expect(isHidden(b)).toBe(true);

      anim.next();

      expect(isHidden(group)).toBe(false);
      expect(isHidden(a)).toBe(false);
      expect(isHidden(b)).toBe(false);

      anim.reset();

      expect(isHidden(group)).toBe(true);
      expect(isHidden(a)).toBe(true);
      expect(isHidden(b)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("keeps explicitly drawn child nodes hidden until their own step and restores that state on prev()", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
box a
box b
group g1 items=[a,b]
step draw g1
step draw a
end`);

    try {
      const a = getById(svg, "node-a");
      const b = getById(svg, "node-b");

      anim.next();
      expect(isHidden(a)).toBe(true);
      expect(isHidden(b)).toBe(false);

      anim.next();
      expect(isHidden(a)).toBe(false);

      anim.prev();
      expect(anim.currentStep).toBe(0);
      expect(isHidden(a)).toBe(true);
      expect(isHidden(b)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("keeps explicitly drawn nested groups and their branches hidden until their own step, including goTo()", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
box a
box b
group inner items=[b]
group outer items=[a,inner]
step draw outer
step draw inner
end`);

    try {
      const outer = getById(svg, "group-outer");
      const inner = getById(svg, "group-inner");
      const a = getById(svg, "node-a");
      const b = getById(svg, "node-b");

      anim.goTo(0);
      expect(isHidden(outer)).toBe(false);
      expect(isHidden(a)).toBe(false);
      expect(isHidden(inner)).toBe(true);
      expect(isHidden(b)).toBe(true);

      anim.goTo(1);
      expect(isHidden(inner)).toBe(false);
      expect(isHidden(b)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("cascades to notes, tables, charts, and markdown inside the group subtree", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
note sticky label="Sticky"
table people label="People" {
  header Name
  row Alice
}
bar-chart revenue label="Revenue"
data [
  ["Month", "Value"],
  ["Jan", 10]
]
markdown explainer
"""
Hello world
"""
group g1 items=[sticky,people,revenue,explainer]
step draw g1
end`);

    try {
      const note = getById(svg, "note-sticky");
      const table = getById(svg, "table-people");
      const chart = getById(svg, "chart-revenue");
      const markdown = getById(svg, "markdown-explainer");

      expect(isHidden(note)).toBe(true);
      expect(isHidden(table)).toBe(true);
      expect(isHidden(chart)).toBe(true);
      expect(isHidden(markdown)).toBe(true);

      anim.next();

      expect(isHidden(note)).toBe(false);
      expect(isHidden(table)).toBe(false);
      expect(isHidden(chart)).toBe(false);
      expect(isHidden(markdown)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("leaves groups visible by default when they are not draw targets", () => {
    const { svg, cleanup } = renderAnimatedDiagram(`diagram
box a
group g1 items=[a]
end`);

    try {
      expect(isHidden(getById(svg, "group-g1"))).toBe(false);
      expect(isHidden(getById(svg, "node-a"))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("cascades hide and show through nested group subtrees", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
box a
box b
group inner items=[b]
group outer items=[a,inner]
step hide outer
step show outer
end`);

    try {
      const outer = getById(svg, "group-outer");
      const inner = getById(svg, "group-inner");
      const a = getById(svg, "node-a");
      const b = getById(svg, "node-b");

      anim.next();
      expect(outer.style.opacity).toBe("0");
      expect(inner.style.opacity).toBe("0");
      expect(a.style.opacity).toBe("0");
      expect(b.style.opacity).toBe("0");

      anim.next();
      expect(outer.style.opacity).toBe("1");
      expect(inner.style.opacity).toBe("1");
      expect(a.style.opacity).toBe("1");
      expect(b.style.opacity).toBe("1");

      anim.prev();
      expect(anim.currentStep).toBe(0);
      expect(outer.style.opacity).toBe("0");
      expect(inner.style.opacity).toBe("0");
      expect(a.style.opacity).toBe("0");
      expect(b.style.opacity).toBe("0");
    } finally {
      cleanup();
    }
  });

  it("cascades fade and unfade through nested group subtrees", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
box a
box b
group inner items=[b]
group outer items=[a,inner]
step fade outer
step unfade outer
end`);

    try {
      const outer = getById(svg, "group-outer");
      const inner = getById(svg, "group-inner");
      const a = getById(svg, "node-a");
      const b = getById(svg, "node-b");

      anim.goTo(0);
      expect(isFaded(outer)).toBe(true);
      expect(isFaded(inner)).toBe(true);
      expect(isFaded(a)).toBe(true);
      expect(isFaded(b)).toBe(true);

      anim.goTo(1);
      expect(isFaded(outer)).toBe(false);
      expect(isFaded(inner)).toBe(false);
      expect(isFaded(a)).toBe(false);
      expect(isFaded(b)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("cascades erase through the full group subtree", () => {
    const { svg, anim, cleanup } = renderAnimatedDiagram(`diagram
box a
note sticky label="Sticky"
box b
group inner items=[b]
group outer items=[a,sticky,inner]
step erase outer duration=0
end`);

    try {
      const outer = getById(svg, "group-outer");
      const inner = getById(svg, "group-inner");
      const a = getById(svg, "node-a");
      const b = getById(svg, "node-b");
      const note = getById(svg, "note-sticky");

      anim.next();
      expect(outer.style.opacity).toBe("0");
      expect(inner.style.opacity).toBe("0");
      expect(a.style.opacity).toBe("0");
      expect(b.style.opacity).toBe("0");
      expect(note.style.opacity).toBe("0");
    } finally {
      cleanup();
    }
  });
});
