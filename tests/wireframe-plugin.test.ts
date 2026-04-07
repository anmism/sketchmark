import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, render } from "../src/index";
import { compileWireframe, wireframe } from "../packages/plugin-wireframe/src/index";

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

describe("@sketchmark/plugin-wireframe", () => {
  it("compiles wf.* primitives into ordinary Sketchmark groups and nodes", () => {
    const compiled = compileWireframe(`diagram
wf.screen mobile frame=phone items=[hero]
wf.panel hero label="Hero" items=[title,body,cta]
wf.text title kind=heading lines=2 width=220
wf.text body kind=body lines=3 width=240
wf.control cta kind=button label="Continue"
wf.divider sep width=200
end`);

    expect(compiled).toContain("group mobile");
    expect(compiled).toContain("group hero");
    expect(compiled).toContain("__wf_title_line1");
    expect(compiled).toContain("box cta");
    expect(compiled).toContain("line sep");
  });

  it("supports placeholder text and choice controls through parse()", () => {
    const ast = parse(`diagram
layout column
wf.text body kind=body lines=3 width=220
wf.control agree kind=checkbox label="Email me updates"
end`, {
      plugins: [wireframe()],
    });

    expect(ast.groups.some((group) => group.id === "body")).toBe(true);
    expect(ast.groups.some((group) => group.id === "agree")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "__wf_body_line1" && node.shape === "line")).toBe(true);
    expect(ast.nodes.some((node) => node.id === "__wf_agree_marker")).toBe(true);
  });

  it("keeps checkbox labels compact by default while preserving explicit text-width overrides", () => {
    const compact = compileWireframe(`diagram
wf.control agree kind=checkbox label="Yes"
end`);

    expect(compact).toContain("text __wf_agree_label");
    expect(compact).toContain("width=48");
    expect(compact).not.toContain("width=180");

    const overridden = compileWireframe(`diagram
wf.control agree kind=checkbox label="Yes" text-width=120
end`);

    expect(overridden).toContain("width=120");
  });

  it("emits checkbox controls as compact top-aligned inline rows", () => {
    const compiled = compileWireframe(`diagram
wf.control agree kind=checkbox label="Accept terms"
end`);

    expect(compiled).toContain("bare agree");
    expect(compiled).toContain("align=start");
    expect(compiled).toContain("vertical-align=middle");
    expect(compiled).toContain("height=18");
    expect(compiled).toContain("font-size=14");
  });

  it("renders generated wireframe primitives through the normal render pipeline", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
layout row
config gap=28
wf.screen mobile frame=phone width=390 height=640 items=[hero,form]
wf.panel hero label="Hero" items=[cover,title,cta] width=300 height=280
wf.media cover kind=image width=240 height=120
wf.text title kind=heading label="Welcome back" width=220
wf.control cta kind=button label="Continue"
wf.panel form label="Sign In" items=[email,password,remember] width=300 height=220
wf.control email kind=input placeholder="Email"
wf.control password kind=input placeholder="Password"
wf.control remember kind=checkbox label="Remember me"
end`,
      plugins: [wireframe()],
    });

    expect(instance.svg?.querySelector("#group-mobile")).toBeTruthy();
    expect(instance.svg?.querySelector("#group-hero")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-cover")).toBeTruthy();
    expect(instance.svg?.querySelector("#node-cta")).toBeTruthy();
    expect(instance.svg?.textContent).toContain("Continue");
    expect(instance.svg?.textContent).toContain("Remember me");
  });
});
