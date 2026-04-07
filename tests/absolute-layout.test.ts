import { describe, expect, it } from "vitest";
import { parse } from "../src/parser";
import { buildSceneGraph } from "../src/scene";
import { layout } from "../src/layout";

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

describe("absolute layout", () => {
  it("parses authored absolute coordinates for positioned entities", () => {
    const ast = parse(`diagram
layout absolute
box a x=10 y=20 label="A"
group lane layout=absolute x=80 y=40 items=[a]
end`);

    expect(ast.layout).toBe("absolute");
    expect(ast.nodes[0]).toMatchObject({ id: "a", x: 10, y: 20 });
    expect(ast.groups[0]).toMatchObject({
      id: "lane",
      layout: "absolute",
      x: 80,
      y: 40,
    });
  });

  it("uses authored x/y for root absolute placement and edge routing", () => {
    ensureCanvasMeasureStub();

    const ast = parse(`diagram
layout absolute
config margin=0
box a width=40 height=20 x=10 y=20
box b width=40 height=20 x=110 y=50
a -> b
end`);

    const scene = buildSceneGraph(ast);
    layout(scene);

    const a = scene.nodes.find((n) => n.id === "a");
    const b = scene.nodes.find((n) => n.id === "b");
    const edge = scene.edges[0];
    if (!a || !b || !edge?.points) throw new Error("Missing absolute layout entities");

    expect(a.x).toBe(10);
    expect(a.y).toBe(20);
    expect(b.x).toBe(110);
    expect(b.y).toBe(50);
    expect(edge.points).toHaveLength(2);
    expect(edge.points[0]![0]).toBeGreaterThan(a.x);
    expect(edge.points[1]![0]).toBeLessThan(b.x + b.w);
  });

  it("positions children relative to an absolute group and auto-sizes the group", () => {
    ensureCanvasMeasureStub();

    const ast = parse(`diagram
config margin=0
group cluster layout=absolute padding=10 items=[a,b]
box a width=40 height=20 x=0 y=0
box b width=50 height=30 x=100 y=40
end`);

    const scene = buildSceneGraph(ast);
    layout(scene);

    const group = scene.groups.find((g) => g.id === "cluster");
    const a = scene.nodes.find((n) => n.id === "a");
    const b = scene.nodes.find((n) => n.id === "b");
    if (!group || !a || !b) throw new Error("Missing absolute group entities");

    expect(group.x).toBe(0);
    expect(group.y).toBe(0);
    expect(group.w).toBe(170);
    expect(group.h).toBe(90);
    expect(a.x).toBe(10);
    expect(a.y).toBe(10);
    expect(b.x).toBe(110);
    expect(b.y).toBe(50);
  });
});
