import { describe, expect, it } from "vitest";
import { buildSceneGraph, layout, parse, render } from "../src/index";
import { polylineArrowTipPoint } from "../src/renderer/shared";

function ensureCanvasStub(): void {
  const canvasProto = Object.getPrototypeOf(document.createElement("canvas")) as {
    getContext?: (contextId: string) => unknown;
  };

  canvasProto.getContext = () => ({
    font: "",
    measureText: (text: string) => ({ width: text.length * 8 }),
  });
}

describe("polyline edges", () => {
  it("parses manual via coordinate pairs for edges", () => {
    const ast = parse(`diagram
box a label="A"
box b label="B"
a --> b route=polyline via=[120,40,120,160]
end`);

    expect(ast.edges[0]).toMatchObject({
      route: "polyline",
      via: [
        [120, 40],
        [120, 160],
      ],
    });
  });

  it("routes manual polyline waypoints between anchored endpoints", () => {
    ensureCanvasStub();

    const ast = parse(`diagram layout=absolute margin=0
box a x=20 y=20 width=80 height=40 label="A"
box b x=220 y=160 width=80 height=40 label="B"
a --> b anchor-from=right anchor-to=left via=[160,40,160,180]
end`);

    const scene = buildSceneGraph(ast);
    layout(scene);

    expect(scene.edges[0]?.points).toEqual([
      [90, 40],
      [160, 40],
      [160, 180],
      [230, 180],
    ]);
  });

  it("generates orthogonal elbow points when route=orthogonal", () => {
    ensureCanvasStub();

    const ast = parse(`diagram layout=absolute margin=0
box a x=20 y=20 width=80 height=40 label="A"
box b x=220 y=160 width=80 height=40 label="B"
a --> b anchor-from=right anchor-to=left route=orthogonal
end`);

    const scene = buildSceneGraph(ast);
    layout(scene);

    expect(scene.edges[0]?.points).toEqual([
      [90, 40],
      [160, 40],
      [160, 180],
      [230, 180],
    ]);
  });

  it("positions SVG edge labels on the routed polyline midpoint", () => {
    ensureCanvasStub();

    const instance = render({
      container: document.body,
      injectCSS: false,
      dsl: `diagram layout=absolute margin=0
box a x=0 y=0 width=40 height=20 label="A"
box b x=200 y=100 width=40 height=20 label="B"
a --> b anchor-from=right anchor-to=left via=[100,10,100,110] label="edge"
end`,
    });

    const label = instance.svg?.querySelector("#edge-a-b [data-edge-role='label']");

    expect(label?.getAttribute("x")).toBe("86");
    expect(label?.getAttribute("y")).toBe("80");
  });

  it("moves arrow tips from inset anchor points to the visible node boundary", () => {
    expect(
      polylineArrowTipPoint(
        { x: 200, y: 100, w: 40, h: 20 },
        [
          [100, 110],
          [210, 110],
        ],
        "end",
      ),
    ).toEqual([200, 110]);

    expect(
      polylineArrowTipPoint(
        { x: 0, y: 0, w: 40, h: 20 },
        [
          [30, 10],
          [100, 10],
        ],
        "start",
      ),
    ).toEqual([40, 10]);
  });
});
