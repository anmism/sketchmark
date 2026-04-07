import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, render } from "../src/index";
import { annotations } from "../packages/plugin-annotations/src/index";
import { geometry } from "../packages/plugin-geometry/src/index";
import { notation } from "../packages/plugin-notation/src/index";

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

describe("@sketchmark/plugin-annotations", () => {
  it("adds annotation nodes for geometry-based commands", () => {
    const ast = parse(`diagram
geo.point A x=90 y=230
geo.point B x=290 y=230
geo.point C x=190 y=90
geo.triangle tri points=[A,B,C]
annot.dimension base from=A to=B label="6 cm"
annot.equal eq1 from=A to=C count=1
annot.angle ang a=A b=C c=B label="theta"
annot.midpoint mid from=A to=B label="M"
end`, {
      plugins: [annotations(), geometry()],
    });

    expect(ast.nodes.some((node) => node.id === "base" && node.shape === "path")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "eq1" && node.shape === "path")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "ang" && node.shape === "path")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "mid" && node.shape === "circle")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "__annot_base_label" && node.label === "6 cm")).toBe(true);
  });

  it("lets later plugins transform generated annotation labels", () => {
    const ast = parse(String.raw`diagram
geo.point A x=90 y=230
geo.point B x=290 y=230
geo.point C x=190 y=90
annot.angle ang a=A b=C c=B label="$\theta$"
end`, {
      plugins: [annotations(), geometry(), notation()],
    });

    expect(ast.nodes.find((node) => node.id === "__annot_ang_label")?.label).toBe("θ");
  });

  it("supports inverting angle bends without moving the mark outside", () => {
    const astDefault = parse(`diagram
geo.point A x=90 y=230
geo.point B x=190 y=90
geo.point C x=290 y=230
annot.angle angDefault a=A b=B c=C label="theta"
end`, {
      plugins: [annotations(), geometry()],
    });

    const astInverted = parse(`diagram
geo.point A x=90 y=230
geo.point B x=190 y=90
geo.point C x=290 y=230
annot.angle ang a=A b=B c=C label="theta" invert=true
end`, {
      plugins: [annotations(), geometry()],
    });

    const defaultLabel = astDefault.nodes.find((node) => node.id === "__annot_angDefault_label");
    const invertedLabel = astInverted.nodes.find((node) => node.id === "__annot_ang_label");
    const defaultPath = astDefault.nodes.find((node) => node.id === "angDefault");
    const invertedPath = astInverted.nodes.find((node) => node.id === "ang");

    expect(defaultLabel).toBeTruthy();
    expect(invertedLabel).toBeTruthy();
    expect(defaultPath).toBeTruthy();
    expect(invertedPath).toBeTruthy();
    expect((defaultLabel?.y ?? 0)).toBeGreaterThan(90);
    expect((invertedLabel?.y ?? 0)).toBeGreaterThan(90);
    expect((invertedLabel?.y ?? 0)).toBeLessThan((defaultLabel?.y ?? 0));
    expect(invertedPath?.pathData).not.toBe(defaultPath?.pathData);
  });

  it("keeps right-angle marks on the same corner when inverted", () => {
    const astDefault = parse(`diagram
geo.point A x=90 y=230
geo.point B x=190 y=90
geo.point C x=290 y=90
annot.right-angle rightDefault a=A b=B c=C label="90"
end`, {
      plugins: [annotations(), geometry()],
    });

    const astInverted = parse(`diagram
geo.point A x=90 y=230
geo.point B x=190 y=90
geo.point C x=290 y=90
annot.right-angle right a=A b=B c=C label="90" invert=true
end`, {
      plugins: [annotations(), geometry()],
    });

    const defaultPath = astDefault.nodes.find((node) => node.id === "rightDefault");
    const invertedPath = astInverted.nodes.find((node) => node.id === "right");
    const defaultLabel = astDefault.nodes.find((node) => node.id === "__annot_rightDefault_label");
    const invertedLabel = astInverted.nodes.find((node) => node.id === "__annot_right_label");

    expect(defaultPath?.pathData).toBe(invertedPath?.pathData);
    expect((invertedLabel?.y ?? 0)).toBeLessThan((defaultLabel?.y ?? 0));
  });

  it("renders annotation marks through the normal render pipeline", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
geo.point A x=90 y=230
geo.point B x=290 y=230
geo.point C x=190 y=90
geo.triangle tri points=[A,B,C]
annot.dimension base from=A to=B label="6 cm"
annot.right-angle corner a=A b=B c=C label="90°"
end`,
      plugins: [annotations(), geometry()],
    });

    expect(instance.svg?.querySelector("#node-base")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-corner")).toBeTruthy();
    expect(instance.svg?.textContent).toContain("6 cm");
    expect(instance.svg?.textContent).toContain("90°");
  });

  it("supports inverting dimensions to the opposite side of a segment", () => {
    const astAbove = parse(`diagram
geo.point A x=90 y=230
geo.point B x=290 y=230
annot.dimension baseDefault from=A to=B label="6 cm"
end`, {
      plugins: [annotations(), geometry()],
    });

    const astBelow = parse(`diagram
geo.point A x=90 y=230
geo.point B x=290 y=230
annot.dimension base from=A to=B label="6 cm" invert=true
end`, {
      plugins: [annotations(), geometry()],
    });

    const defaultBase = astAbove.nodes.find((node) => node.id === "baseDefault");
    const base = astBelow.nodes.find((node) => node.id === "base");
    const label = astBelow.nodes.find((node) => node.id === "__annot_base_label");

    expect(defaultBase).toBeTruthy();
    expect(base).toBeTruthy();
    expect(label).toBeTruthy();
    expect((label?.y ?? 0)).toBeGreaterThan(230);
    expect(base?.pathData).not.toBe(defaultBase?.pathData);
  });

  it("supports inverting equal marks to the opposite side of a segment", () => {
    const astDefault = parse(`diagram
geo.point A x=90 y=230
geo.point B x=290 y=230
annot.equal eqDefault from=A to=B count=2
end`, {
      plugins: [annotations(), geometry()],
    });

    const astInverted = parse(`diagram
geo.point A x=90 y=230
geo.point B x=290 y=230
annot.equal eqInverted from=A to=B count=2 invert=true
end`, {
      plugins: [annotations(), geometry()],
    });

    const eqDefault = astDefault.nodes.find((node) => node.id === "eqDefault");
    const eqInverted = astInverted.nodes.find((node) => node.id === "eqInverted");

    expect(eqDefault).toBeTruthy();
    expect(eqInverted).toBeTruthy();
    expect(eqInverted?.pathData).not.toBe(eqDefault?.pathData);
  });

  it("throws when used outside absolute layout", () => {
    expect(() =>
      parse(`diagram
layout row
circle A label="" x=80 y=100 width=8 height=8
circle B label="" x=220 y=100 width=8 height=8
annot.dimension base from=A to=B label="bad"
end`, {
        plugins: [annotations()],
      }),
    ).toThrow("layout absolute");
  });
});
