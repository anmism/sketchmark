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

function getGroupChildren(dsl: string, groupId: string) {
  const ast = parse(dsl);
  const group = ast.groups.find((g) => g.id === groupId);
  if (!group) throw new Error(`Missing group ${groupId}`);
  return group.children;
}

describe("flat group references", () => {
  it("resolves items=[...] with forward references", () => {
    const children = getGroupChildren(`diagram
group system items=[services,db]
group services items=[auth]
box auth label="Auth"
cylinder db label="DB"
end`, "system");

    expect(children).toEqual([
      { kind: "group", id: "services" },
      { kind: "node", id: "db" },
    ]);
  });

  it("supports bare groups with flat item references", () => {
    const ast = parse(`diagram
box a label="A"
box b label="B"
bare lane layout=row items=[a,b]
end`);

    expect(ast.groups[0]).toMatchObject({
      id: "lane",
      label: "",
      children: [
        { kind: "node", id: "a" },
        { kind: "node", id: "b" },
      ],
    });
    expect(ast.groups[0].style.fill).toBe("none");
    expect(ast.groups[0].style.stroke).toBe("none");
  });

  it("rejects legacy nested group blocks with a targeted error", () => {
    expect(() =>
      parse(`diagram
group services {
  box auth label="Auth"
}
end`),
    ).toThrow(/Nested group blocks were removed/);
  });

  it("requires explicit ids for authored nodes and groups", () => {
    expect(() =>
      parse(`diagram
box label="Auth"
end`),
    ).toThrow(/requires an explicit id/);

    expect(() =>
      parse(`diagram
group label="Services" items=[auth]
end`),
    ).toThrow(/requires an explicit id/);
  });

  it("rejects duplicate ids across entity kinds", () => {
    expect(() =>
      parse(`diagram
box shared label="Auth"
group shared items=[shared]
end`),
    ).toThrow(/Duplicate id "shared"/);
  });

  it("rejects unknown item ids", () => {
    expect(() =>
      parse(`diagram
box auth label="Auth"
group services items=[auth,missing]
end`),
    ).toThrow(/unknown item "missing"/i);
  });

  it("rejects invalid tokens inside items lists", () => {
    expect(() =>
      parse(`diagram
box a label="A"
box b label="B"
group g items=[a-->b]
end`),
    ).toThrow(/items/i);
  });

  it("rejects duplicate parent membership", () => {
    expect(() =>
      parse(`diagram
box auth label="Auth"
group services items=[auth]
group platform items=[auth]
end`),
    ).toThrow(/cannot belong to both/);
  });

  it("rejects direct and indirect group cycles", () => {
    expect(() =>
      parse(`diagram
group loop items=[loop]
end`),
    ).toThrow(/cannot include itself/i);

    expect(() =>
      parse(`diagram
group a items=[b]
group b items=[a]
end`),
    ).toThrow(/Group cycle detected/);
  });

  it("filters grouped declarations out of root layout order", () => {
    ensureCanvasMeasureStub();

    const ast = parse(`diagram
layout row
config gap=10
config margin=0
box a width=10 height=10
box b width=10 height=10
group pair layout=row padding=0 gap=0 items=[a,b]
box c width=10 height=10
end`);

    const scene = buildSceneGraph(ast);
    layout(scene);

    const pair = scene.groups.find((g) => g.id === "pair");
    const c = scene.nodes.find((n) => n.id === "c");
    if (!pair || !c) throw new Error("Missing expected layout entities");

    expect(pair.x).toBe(0);
    expect(c.x).toBe(pair.w + 10);
  });

  it("keeps edges compatible with later explicit node declarations", () => {
    const ast = parse(`diagram
a --> b
box a label="Auth"
box b label="Billing"
end`);

    expect(ast.nodes.find((n) => n.id === "a")?.label).toBe("Auth");
    expect(ast.nodes.find((n) => n.id === "b")?.label).toBe("Billing");
  });
});
