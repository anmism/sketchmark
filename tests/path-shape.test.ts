import { describe, expect, it } from "vitest";
import { parse } from "../src/parser";
import { buildSceneGraph } from "../src/scene";
import { layout } from "../src/layout";
import { renderToSVG } from "../src/renderer/svg";
import { getRenderablePathData } from "../src/renderer/shapes/path-geometry";

function ensureCanvasMeasureStub(): void {
  const canvasProto = Object.getPrototypeOf(document.createElement("canvas")) as {
    getContext?: (contextId: string) => unknown;
  };
  if (typeof canvasProto.getContext !== "function") {
    canvasProto.getContext = () => ({
      font: "",
      measureText: (text: string) => ({ width: text.length * 8 }),
    });
  }
}

describe("path shape sizing", () => {
  it("scales local path data into the requested width and height", () => {
    const scaled = getRenderablePathData(
      "M 0 0 L 100 0 L 100 60 L 0 60 Z",
      50,
      30,
    );

    expect(scaled).toBe("M 0 0 L 50 0 L 50 30 L 0 30 Z");
  });

  it("normalizes world-style coordinates before scaling", () => {
    const scaled = getRenderablePathData(
      "M 100 200 L 300 200 L 300 260 L 100 260 Z",
      50,
      30,
    );

    expect(scaled).toBe("M 0 0 L 50 0 L 50 30 L 0 30 Z");
  });

  it("stores the rendered path data for SVG animations", () => {
    ensureCanvasMeasureStub();

    const ast = parse(`diagram
layout absolute
config margin=0
path lake x=10 y=20 width=50 height=30 value="M 100 200 L 300 200 L 300 260 L 100 260 Z"
end`);

    const scene = buildSceneGraph(ast);
    layout(scene);

    const container = document.createElement("div");
    const svg = renderToSVG(scene, container, { theme: "light" });
    const node = svg.querySelector("#node-lake") as SVGGElement | null;

    expect(node).not.toBeNull();
    expect(node?.dataset.pathData).toBe("M 0 0 L 50 0 L 50 30 L 0 30 Z");
    expect(node?.dataset.x).toBe("10");
    expect(node?.dataset.y).toBe("20");
  });
});
