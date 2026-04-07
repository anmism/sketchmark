import { describe, expect, it } from "vitest";
import { buildSceneGraph, layout, parse } from "../src/index";
import { anchors, compileAnchors } from "../packages/plugin-anchors/src/index";

describe("@sketchmark/plugin-anchors", () => {
  it("rewrites anchored edge refs into ordinary edge props", () => {
    const compiled = compileAnchors(`diagram
box a label="A"
box b label="B"
a@right --> b@left label="request"
end`);

    expect(compiled).toContain("a --> b label=\"request\" anchor-from=right anchor-to=left");
  });

  it("stores anchor metadata on parsed edges", () => {
    const ast = parse(`diagram
box a label="A"
box b label="B"
a@bottom --> b@top
end`, {
      plugins: [anchors()],
    });

    expect(ast.edges[0]).toMatchObject({
      from: "a",
      to: "b",
      fromAnchor: "bottom",
      toAnchor: "top",
    });
  });

  it("routes anchored edges to the requested sides after layout", () => {
    const ast = parse(`diagram
layout row
config gap=80
box a label="Source"
box b label="Target"
a@right --> b@left
end`, {
      plugins: [anchors()],
    });
    const scene = buildSceneGraph(ast);
    layout(scene);

    const edge = scene.edges[0];
    const [fromPoint, toPoint] = edge.points ?? [];
    const source = scene.nodes.find((node) => node.id === "a")!;
    const target = scene.nodes.find((node) => node.id === "b")!;

    expect(fromPoint[0]).toBeGreaterThan(source.x + source.w / 2);
    expect(toPoint[0]).toBeLessThan(target.x + target.w / 2);
  });

  it("routes corner anchors to the requested corner in absolute layouts", () => {
    const ast = parse(`diagram
layout absolute
box a x=60 y=160 width=120 height=56 label="A"
box c x=320 y=250 width=120 height=56 label="C"
a@bottom-right -> c@bottom-left
end`, {
      plugins: [anchors()],
    });
    const scene = buildSceneGraph(ast);
    layout(scene);

    const edge = scene.edges[0];
    const [fromPoint, toPoint] = edge.points ?? [];
    const source = scene.nodes.find((node) => node.id === "a")!;
    const target = scene.nodes.find((node) => node.id === "c")!;

    expect(fromPoint[0]).toBeGreaterThan(source.x + source.w / 2);
    expect(fromPoint[1]).toBeGreaterThan(source.y + source.h / 2);
    expect(toPoint[0]).toBeLessThan(target.x + target.w / 2);
    expect(toPoint[1]).toBeGreaterThan(target.y + target.h / 2);
  });
});
