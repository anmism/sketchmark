import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, render } from "../src/index";
import {
  compileSolidGeometry,
  solidGeometry,
} from "../packages/plugin-solid-geometry/src/index";
import { annotations } from "../packages/plugin-annotations/src/index";
import { geometry } from "../packages/plugin-geometry/src/index";

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

describe("@sketchmark/plugin-solid-geometry", () => {
  it("compiles solid commands into geo, annot, and group DSL", () => {
    const compiled = compileSolidGeometry(`diagram
solid.cube cube x=90 y=260 size=110 label="Cube" width-label="a"
end`);

    expect(compiled).toContain("geo.point __solid_cube_A");
    expect(compiled).toContain("annot.dimension __solid_cube_width");
    expect(compiled).toContain("group cube label=\"\" layout=absolute");
  });

  it("parses a cube and pyramid through the plugin chain", () => {
    const ast = parse(`diagram
solid.cube cube x=90 y=260 size=110 label="Cube" width-label="a" height-label="a" depth-label="a"
solid.pyramid py x=320 y=260 width=130 depth=70 height=150 label="Pyramid" width-label="base" depth-label="depth"
end`, {
      plugins: [solidGeometry(), annotations(), geometry()],
    });

    expect(ast.layout).toBe("absolute");
    expect(ast.groups.some((group) => group.id === "cube")).toBe(true);
    expect(ast.groups.some((group) => group.id === "py")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "__solid_cube_AB" && node.shape === "path")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "__solid_py_AP" && node.shape === "path")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "__annot___solid_cube_width_label")).toBe(true);
  });

  it("renders generated solid geometry through the normal render pipeline", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
solid.rectangle rect x=80 y=240 width=180 height=100 label="Rectangle" width-label="w" height-label="h"
solid.prism prism x=320 y=260 width=150 height=90 depth=60 label="Prism"
end`,
      plugins: [solidGeometry(), annotations(), geometry()],
    });

    expect(instance.svg?.querySelector("#node-__solid_rect_outline")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-__solid_prism_AB")).toBeTruthy();
    expect(instance.svg?.textContent).toContain("Rectangle");
    expect(instance.svg?.textContent).toContain("Prism");
  });

  it("respects hidden=off by omitting dashed hidden edges", () => {
    const compiled = compileSolidGeometry(`diagram
solid.pyramid py x=200 y=260 width=140 depth=70 height=140 hidden=off
end`);

    expect(compiled).not.toContain("__solid_py_CD");
    expect(compiled).not.toContain("__solid_py_DP");
  });
});
