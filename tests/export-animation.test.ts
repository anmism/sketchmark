import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "../src/render";
import { getSVGString } from "../src/export";

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

function extractTag(markup: string, id: string): string {
  return markup.match(new RegExp(`<g\\b[^>]*id="${id}"[^>]*>`, "i"))?.[0] ?? "";
}

beforeEach(() => {
  ensureCanvasStub();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("animated export snapshots", () => {
  it("exports the settled final SVG instead of the pre-hidden animation state", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
box a label="A"
box b label="B"
group g items=[a,b]
step draw g
end`,
    });

    expect(instance.svg?.querySelector("#group-g")?.classList.contains("gg-hidden")).toBe(true);
    expect(instance.svg?.querySelector("#node-a")?.classList.contains("hidden")).toBe(true);

    const markup = getSVGString(instance.svg!);
    const groupTag = extractTag(markup, "group-g");
    const nodeTag = extractTag(markup, "node-a");
    const nodeLabelTag = markup.match(/<text\b[^>]*>A<\/text>/)?.[0] ?? "";

    expect(groupTag).toContain('id="group-g"');
    expect(groupTag).not.toContain("gg-hidden");
    expect(nodeTag).toContain('id="node-a"');
    expect(nodeTag).not.toContain("hidden");
    expect(nodeLabelTag).not.toContain("opacity: 0");

    instance.anim.destroy();
    host.remove();
  });

  it("includes final annotation marks and final visibility changes in the export snapshot", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
box a label="A"
step draw a
step circle a
step hide a duration=0
end`,
    });

    const markup = getSVGString(instance.svg!);
    const nodeTag = extractTag(markup, "node-a");

    expect(nodeTag).toContain("opacity: 0");
    expect(markup).toMatch(/<g\b[^>]*id="annotation-layer"[^>]*>[\s\S]*<(g|path|line|ellipse|polygon)\b/);

    instance.anim.destroy();
    host.remove();
  });
});
