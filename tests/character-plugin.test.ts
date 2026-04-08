import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, render } from "../src/index";
import { character, compileCharacter } from "../packages/plugin-character/src/index";

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

describe("@sketchmark/plugin-character", () => {
  it("compiles char.actor into ordinary groups and nodes", () => {
    const compiled = compileCharacter(`diagram
char.actor hero x=180 y=80 pose=wave label="Hero"
end`);

    expect(compiled).toContain("layout absolute");
    expect(compiled).toContain("bare hero ");
    expect(compiled).toContain("circle hero_head");
    expect(compiled).toContain("path hero_body");
    expect(compiled).toContain("path hero_armR");
    expect(compiled).toContain('text hero_label label="Hero"');
  });

  it("renders a stick actor through the normal render pipeline", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
char.actor hero x=180 y=80 pose=walk1 label="Hero"
end`,
      plugins: [character()],
    });

    expect(instance.svg?.querySelector("#group-hero")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-hero_armL")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-hero_head")).toBeTruthy();
    expect(instance.svg?.textContent).toContain("Hero");
  });

  it("supports part-level animation targets via generated ids", () => {
    const ast = parse(`diagram
char.actor hero x=180 y=80 pose=idle
step rotate hero_armR deg=20 duration=300
step move hero dx=120 dy=0 duration=700
end`, {
      plugins: [character()],
    });

    expect(ast.groups.some((group) => group.id === "hero")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "hero_armR")).toBe(true);
    expect(ast.steps.some((step) => step.kind === "step" && step.target === "hero_armR")).toBe(true);
    expect(ast.steps.some((step) => step.kind === "step" && step.target === "hero")).toBe(true);
  });

  it("throws if character commands are used with a non-absolute root layout", () => {
    expect(() =>
      parse(`diagram
layout row
char.actor hero x=180 y=80
end`, {
        plugins: [character()],
      }),
    ).toThrow("layout absolute");
  });
});
