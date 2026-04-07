import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, render } from "../src/index";
import { compileGeometry, geometry } from "../packages/plugin-geometry/src/index";

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

describe("@sketchmark/plugin-geometry", () => {
  it("compiles geo.* commands into ordinary absolute-layout nodes", () => {
    const compiled = compileGeometry(`diagram
geo.point A x=60 y=140
geo.point B x=220 y=140
geo.segment AB from=A to=B label="6 cm"
end`);

    expect(compiled).toContain("layout absolute");
    expect(compiled).toContain('circle A label=""');
    expect(compiled).toContain('path AB label=""');
    expect(compiled).toContain("__geo_AB_label");
  });

  it("supports forward point references and polygon commands through parse()", () => {
    const ast = parse(`diagram
geo.segment AB from=A to=B
geo.triangle tri points=[A,B,C]
geo.point A x=70 y=210
geo.point B x=250 y=210
geo.point C x=160 y=90
end`, {
      plugins: [geometry()],
    });

    expect(ast.layout).toBe("absolute");
    expect(ast.nodes.some((node) => node.id === "A" && node.shape === "circle")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "AB" && node.shape === "path")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "tri" && node.shape === "path")).toBe(true);
  });

  it("renders geometry-generated primitives through the normal render pipeline", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
geo.point A x=70 y=170
geo.point B x=250 y=170
geo.point O x=160 y=90 label="O"
geo.segment AB from=A to=B label="AB"
geo.circle c center=O r=36 label="r"
end`,
      plugins: [geometry()],
    });

    expect(instance.svg?.querySelector("#node-A")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-AB")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-c")).toBeTruthy();
    expect(instance.svg?.textContent).toContain("AB");
    expect(instance.svg?.textContent).toContain("O");
  });

  it("throws if geometry commands are used with a non-absolute root layout", () => {
    expect(() =>
      parse(`diagram
layout row
geo.point A x=20 y=30
end`, {
        plugins: [geometry()],
      }),
    ).toThrow("layout absolute");
  });
});
