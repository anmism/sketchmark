import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, render } from "../src/index";
import { circuit, compileCircuit } from "../packages/plugin-circuit/src/index";

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

describe("@sketchmark/plugin-circuit", () => {
  it("compiles ckt.* commands into ordinary absolute-layout groups and nodes", () => {
    const compiled = compileCircuit(`diagram
ckt.port vin x=80 y=140 label="Vin"
ckt.comp r1 kind=resistor x=220 y=140 label="R1" label-dx=14 label-dy=-6
ckt.wire w1 from=vin to=r1.left label="in" label-dx=8 label-dy=10
end`);

    expect(compiled).toContain("layout absolute");
    expect(compiled).toContain("__ckt_vin_body");
    expect(compiled).toContain("__ckt_r1_body");
    expect(compiled).toContain("bare w1");
    expect(compiled).toContain("__ckt_r1_label");
    expect(compiled).toContain("__ckt_w1_label");
    expect(compiled).toContain('x=-26');
    expect(compiled).toContain('y=-34');
  });

  it("supports forward refs and stores generated groups through parse()", () => {
    const ast = parse(`diagram
ckt.wire w1 from=vin to=r1.left
ckt.port vin x=80 y=140 label="Vin"
ckt.comp r1 kind=resistor x=220 y=140 label="R1"
end`, {
      plugins: [circuit()],
    });

    expect(ast.layout).toBe("absolute");
    expect(ast.groups.some((group) => group.id === "vin")).toBe(true);
    expect(ast.groups.some((group) => group.id === "r1")).toBe(true);
    expect(ast.groups.some((group) => group.id === "w1")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "__ckt_w1_body" && node.shape === "path")).toBe(true);
  });

  it("renders generated circuit primitives through the normal render pipeline", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
ckt.port vin x=80 y=140 label="Vin"
ckt.comp r1 kind=resistor x=220 y=140 label="R1" value="10k"
ckt.comp c1 kind=capacitor x=380 y=140 orient=v label="C1"
ckt.comp gnd kind=ground x=380 y=260
ckt.port vout x=520 y=140 label="Vout"
ckt.wire w1 from=vin to=r1.left
ckt.wire w2 from=r1.right to=vout label="out"
ckt.wire w3 from=r1.right to=c1.top mode=hv
ckt.wire w4 from=c1.bottom to=gnd.top
end`,
      plugins: [circuit()],
    });

    expect(instance.svg?.querySelector("#group-r1")).toBeTruthy();
    expect(instance.svg?.querySelector("#group-w1")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-__ckt_r1_body")).toBeTruthy();
    expect(instance.svg?.textContent).toContain("Vin");
    expect(instance.svg?.textContent).toContain("10k");
  });
});
