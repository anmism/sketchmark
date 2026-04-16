import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, render } from "../src/index";
import {
  chemMolecule,
  compileChemMolecule,
} from "../packages/plugin-chem-molecule/src/index";

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

describe("@sketchmark/plugin-chem-molecule", () => {
  it("compiles chem.* commands into ordinary absolute-layout groups and nodes", () => {
    const compiled = compileChemMolecule(`diagram
chem.atom O x=120 y=150 element=O
chem.atom H1 x=70 y=220 element=H
chem.atom H2 x=170 y=220 element=H
chem.bond b1 from=O to=H1
chem.label water target=O side=top text="Water"
end`);

    expect(compiled).toContain("diagram layout=absolute");
    expect(compiled).toContain("__chem_O_body");
    expect(compiled).toContain("__chem_b1_seg_1");
    expect(compiled).toContain("bare water");
  });

  it("supports ring vertex refs and stores generated groups through parse()", () => {
    const ast = parse(`diagram
chem.ring ring1 x=240 y=160 kind=benzene aromatic=true
chem.atom O x=360 y=160 element=O
chem.bond side from=ring1.v1 to=ring1.v2 order=double
chem.bond attach from=ring1.v2 to=O
end`, {
      plugins: [chemMolecule()],
    });

    expect(ast.layout).toBe("absolute");
    expect(ast.groups.some((group) => group.id === "ring1")).toBe(true);
    expect(ast.groups.some((group) => group.id === "O")).toBe(true);
    expect(ast.groups.some((group) => group.id === "attach")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "__chem_attach_seg_1" && node.shape === "path")).toBe(true);
  });

  it("supports label-dx / label-dy across chemistry-generated labels", () => {
    const compiled = compileChemMolecule(`diagram
chem.atom O x=120 y=150 element=O label-dx=14 label-dy=-6
chem.atom H x=200 y=150 element=H
chem.bond b1 from=O to=H label="bond" label-dx=8 label-dy=10
chem.label water target=O side=top text="Water" label-dx=12 label-dy=4
end`);

    expect(compiled).toContain("bare O layout=absolute padding=0 gap=0 x=122 y=127 width=24 height=34");
    expect(compiled).toContain("text __chem_b1_label label=bond x=8 y=18 width=57 height=26");
    expect(compiled).toContain("bare water layout=absolute padding=0 gap=0 x=97 y=110 width=70 height=26");
  });

  it("renders generated chemistry primitives through the normal render pipeline", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
chem.atom O x=120 y=150 element=O
chem.atom H1 x=70 y=220 element=H
chem.atom H2 x=170 y=220 element=H
chem.bond b1 from=O to=H1
chem.bond b2 from=O to=H2
chem.ring ring1 x=360 y=160 kind=benzene aromatic=true
chem.label ringName target=ring1.center side=bottom text="Benzene"
end`,
      plugins: [chemMolecule()],
    });

    expect(instance.svg?.querySelector("#group-O")).toBeTruthy();
    expect(instance.svg?.querySelector("#group-b1")).toBeTruthy();
    expect(instance.svg?.querySelector("#group-ring1")).toBeTruthy();
    expect(instance.svg?.textContent).toContain("O");
    expect(instance.svg?.textContent).toContain("Benzene");
  });
});
