import { describe, expect, it } from "vitest";
import { parse } from "../src/parser";
import { buildSceneGraph } from "../src/scene";
import { layout } from "../src/layout";
import { renderToSVG } from "../src/renderer/svg";

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

describe("diagram root props", () => {
  it("parses one-line root layout, size, style, and config props", () => {
    const ast = parse(
      `diagram layout=absolute width=1200 height=800 margin=0 gap=40 fill="#fff" stroke="#222" stroke-width=2 font="Virgil" tts=true theme=ocean pointer=chalk
box a x=10 y=20 label="A"
end`,
    );

    expect(ast.layout).toBe("absolute");
    expect(ast.width).toBe(1200);
    expect(ast.height).toBe(800);
    expect(ast.style).toMatchObject({
      fill: "#fff",
      stroke: "#222",
      strokeWidth: 2,
      font: "Virgil",
    });
    expect(ast.config).toMatchObject({
      margin: 0,
      gap: 40,
      tts: true,
      theme: "ocean",
      pointer: "chalk",
      font: "Virgil",
    });
  });

  it("rejects legacy root layout and config lines with migration errors", () => {
    expect(() =>
      parse(`diagram
layout absolute
box a label="A"
end`),
    ).toThrow(/diagram layout=/);

    expect(() =>
      parse(`diagram
config gap=40
box a label="A"
end`),
    ).toThrow(/diagram gap=40/);
  });

  it("uses fixed root width and height and renders root fill and stroke", () => {
    ensureCanvasMeasureStub();

    const ast = parse(`diagram width=320 height=180 margin=0 fill="#ffffff" stroke="#222222" stroke-width=4
title label="Fixed Canvas"
box a x=20 y=40 width=60 height=30 label="A"
end`);
    const scene = buildSceneGraph(ast);
    layout(scene);

    expect(scene.width).toBe(320);
    expect(scene.height).toBe(180);

    const container = document.createElement("div");
    const svg = renderToSVG(scene, container, { theme: "light", showTitle: true });

    expect(svg.getAttribute("width")).toBe("320");
    expect(svg.getAttribute("height")).toBe("180");

    const rects = Array.from(svg.querySelectorAll("rect"));
    expect(rects[0]?.getAttribute("fill")).toBe("#ffffff");
    expect(rects[1]?.getAttribute("stroke")).toBe("#222222");
    expect(rects[1]?.getAttribute("stroke-width")).toBe("4");
    expect(svg.textContent).toContain("Fixed Canvas");
  });
});
