import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, render } from "../src/index";
import { annotations } from "../packages/plugin-annotations/src/index";
import { compileGraph, graph } from "../packages/plugin-graph/src/index";

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

describe("@sketchmark/plugin-graph", () => {
  it("compiles graph commands into ordinary absolute-layout nodes", () => {
    const compiled = compileGraph(`diagram
graph.axes plane x=80 y=60 width=320 height=180 xmin=-3 xmax=3 ymin=-1 ymax=1 grid=true xlabel="x" ylabel="y"
graph.plot sine axes=plane expr="sin(x)" label="sin"
graph.point O axes=plane at=[0,0]
graph.arrow vec axes=plane from=[0,0] to=[2,0.75] label="v"
graph.region band axes=plane points=[[-1,0],[-1,1],[1,1],[1,0]]
graph.area fill axes=plane expr="sin(x)" from=0 to=3.14
graph.tangent tan axes=plane expr="sin(x)" at=1.57 label="tan"
end`);

    expect(compiled).toContain("layout absolute");
    expect(compiled).toContain('path plane label=""');
    expect(compiled).toContain('path sine label=""');
    expect(compiled).toContain('circle O label=""');
    expect(compiled).toContain('path vec label=""');
    expect(compiled).toContain('path band label=""');
    expect(compiled).toContain('path fill label=""');
    expect(compiled).toContain('path tan label=""');
  });

  it("renders sampled plots and graph points through the normal render pipeline", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
graph.axes plane x=80 y=60 width=320 height=180 xmin=-3 xmax=3 ymin=-1 ymax=1 grid=true
graph.plot sine axes=plane expr="sin(x)" label="sin"
graph.point O axes=plane at=[0,0] label="O"
graph.line axisMarker axes=plane from=[0,-1] to=[0,1]
end`,
      plugins: [graph()],
    });

    expect(instance.svg?.querySelector("#node-plane")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-sine")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-O")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-axisMarker")).toBeTruthy();
    expect(instance.svg?.textContent).toContain("sin");
    expect(instance.svg?.textContent).toContain("O");
  });

  it("lets existing annotation commands target graph points", () => {
    const ast = parse(`diagram
graph.axes plane x=80 y=60 width=320 height=180 xmin=-3 xmax=3 ymin=-1 ymax=1
graph.point A axes=plane at=[0,0] label="A"
graph.point B axes=plane at=[2,1] label="B"
annot.dimension rise from=A to=B label="rise"
end`, {
      plugins: [graph(), annotations()],
    });

    expect(ast.nodes.some((node) => node.id === "A" && node.shape === "circle")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "B" && node.shape === "circle")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "rise" && node.shape === "path")).toBe(true);
  });

  it("throws if graph commands are used with a non-absolute root layout", () => {
    expect(() =>
      parse(`diagram
layout row
graph.axes plane x=0 y=0 width=100 height=100 xmin=0 xmax=1 ymin=0 ymax=1
end`, {
        plugins: [graph()],
      }),
    ).toThrow("layout absolute");
  });
});
