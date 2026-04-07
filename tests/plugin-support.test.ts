import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parse,
  render,
  SketchmarkCanvas,
  SketchmarkEmbed,
  type SketchmarkPlugin,
} from "../src/index";

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

const aliasPlugin: SketchmarkPlugin = {
  name: "alias-shapes",
  preprocess(source) {
    return source.replace(/\bcard\b/g, "box");
  },
};

const labelPlugin: SketchmarkPlugin = {
  name: "label-defaults",
  transformAst(ast) {
    return {
      ...ast,
      nodes: ast.nodes.map((node) =>
        node.label ? node : { ...node, label: `plugin:${node.id}` },
      ),
    };
  },
};

beforeEach(() => {
  ensureCanvasStub();

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(performance.now()), 0)) as typeof window.requestAnimationFrame;
  }

  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = ((id: number) =>
      window.clearTimeout(id)) as typeof window.cancelAnimationFrame;
  }
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("plugin support", () => {
  it("applies preprocess and AST transforms in parse order", () => {
    const ast = parse(`diagram
card a
end`, {
      plugins: [aliasPlugin, labelPlugin],
    });

    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]).toMatchObject({
      id: "a",
      shape: "box",
      label: "plugin:a",
    });
  });

  it("passes plugins into render()", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl: `diagram
card a
end`,
      plugins: [aliasPlugin, labelPlugin],
    });

    expect(instance.svg?.querySelector("#node-a")).toBeTruthy();
    expect(instance.svg?.textContent).toContain("plugin:a");
  });

  it("passes plugins into SketchmarkCanvas", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const canvas = new SketchmarkCanvas({
      container: host,
      dsl: `diagram
card a
end`,
      plugins: [aliasPlugin, labelPlugin],
      autoFit: false,
      showMinimap: false,
    });

    expect(canvas.instance?.svg?.querySelector("#node-a")).toBeTruthy();
    expect(canvas.instance?.svg?.textContent).toContain("plugin:a");
  });

  it("passes plugins into SketchmarkEmbed", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const embed = new SketchmarkEmbed({
      container: host,
      dsl: `diagram
card a
end`,
      plugins: [aliasPlugin, labelPlugin],
      showControls: false,
    });

    expect(embed.instance?.svg?.querySelector("#node-a")).toBeTruthy();
    expect(embed.instance?.svg?.textContent).toContain("plugin:a");
  });
});
