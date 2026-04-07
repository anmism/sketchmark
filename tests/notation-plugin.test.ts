import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, render } from "../src/index";
import { notation, renderMath } from "../packages/plugin-notation/src/index";

function ensureCanvasStub(): void {
  const canvasProto = Object.getPrototypeOf(document.createElement("canvas")) as {
    getContext?: (contextId: string) => unknown;
  };

  canvasProto.getContext = () => ({
    font: "",
    scale: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    drawImage: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    fillText: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    setLineDash: () => {},
    arc: () => {},
    rect: () => {},
    measureText: (text: string) => ({ width: text.length * 8 }),
  });
}

beforeEach(() => {
  ensureCanvasStub();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("@sketchmark/plugin-notation", () => {
  it("converts common TeX-style math in labels and narration", () => {
    const ast = parse(`diagram
title label="Angle $\\theta$"
box eq label="$x^2 + y_1 \\geq \\frac{7}{5}$"
step narrate "$\\sqrt{2} \\approx 1.41$"
end`, {
      plugins: [notation()],
    });

    expect(ast.title).toBe("Angle θ");
    expect(ast.nodes[0]?.label).toBe("x² + y₁ ≥ 7⁄5");
    expect(ast.steps[0]).toMatchObject({
      kind: "step",
      action: "narrate",
      value: "√(2) ≈ 1.41",
    });
  });

  it("supports \\(...\\) delimiters and keeps plain text intact", () => {
    const ast = parse(`diagram
box a label="Area \\(\\pi r^2\\) stays positive"
end`, {
      plugins: [notation()],
    });

    expect(ast.nodes[0]?.label).toBe("Area π r² stays positive");
  });

  it("preserves single backslash math commands typed directly into DSL strings", () => {
    const ast = parse(String.raw`diagram
note angle label="$\theta = 45^\circ$"
table trig label="Special Values"
{
  header Expr Value
  row "$\sin(\theta)$" "$\frac{\sqrt{2}}{2}$"
}
step narrate "With $\theta = 45^\circ$, both legs contribute equally."
end`, {
      plugins: [notation()],
    });

    expect(ast.nodes[0]?.label).toBe("θ = 45°");
    expect(ast.tables[0]?.rows[1]?.cells[0]).toBe("sin(θ)");
    expect(ast.tables[0]?.rows[1]?.cells[1]).toBe("√(2)⁄2");
    expect(ast.steps[0]).toMatchObject({
      kind: "step",
      action: "narrate",
      value: "With θ = 45°, both legs contribute equally.",
    });
  });

  it("renders transformed notation through the normal render pipeline", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
box trig label="$\\alpha + \\beta = \\pi$"
end`,
      plugins: [notation()],
    });

    expect(instance.svg?.querySelector("#node-trig")).toBeTruthy();
    expect(instance.svg?.textContent).toContain("α + β = π");
  });

  it("exports the raw text renderer for package consumers", () => {
    expect(renderMath("\\frac{a_1}{b^2}")).toBe("a₁⁄b²");
  });
});
