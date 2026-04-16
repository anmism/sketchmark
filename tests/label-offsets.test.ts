import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NODE } from "../src/config";
import { buildSceneGraph, layout, parse, render } from "../src/index";

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

describe("label offsets", () => {
  it("parses and renders label-dx / label-dy for core groups, nodes, and edges", () => {
    const dsl = `diagram layout=absolute margin=0
group frame label="Frame" x=10 y=10 width=140 height=80 label-dx=7 label-dy=3
box a x=30 y=120 width=80 height=40 label="Node" label-dx=12 label-dy=-6
box b x=190 y=120 width=80 height=40 label="Peer"
a --> b label="edge" label-dx=10 label-dy=5
end`;

    const ast = parse(dsl);
    expect(ast.groups.find((group) => group.id === "frame")).toMatchObject({
      labelDx: 7,
      labelDy: 3,
    });
    expect(ast.nodes.find((node) => node.id === "a")).toMatchObject({
      labelDx: 12,
      labelDy: -6,
    });
    expect(ast.edges[0]).toMatchObject({
      labelDx: 10,
      labelDy: 5,
    });

    const scene = buildSceneGraph(ast);
    layout(scene);

    expect(scene.groups.find((group) => group.id === "frame")).toMatchObject({
      labelDx: 7,
      labelDy: 3,
    });
    expect(scene.nodes.find((node) => node.id === "a")).toMatchObject({
      labelDx: 12,
      labelDy: -6,
    });
    expect(scene.edges[0]).toMatchObject({
      labelDx: 10,
      labelDy: 5,
    });

    const host = document.createElement("div");
    document.body.appendChild(host);

    const instance = render({
      container: host,
      dsl,
      injectCSS: false,
    });

    const groupLabel = instance.svg?.querySelector("#group-frame text");
    const nodeLabel = instance.svg?.querySelector("#node-a text");
    const edgeLabel = instance.svg?.querySelector("#edge-a-b [data-edge-role='label']");

    expect(groupLabel?.getAttribute("x")).toBe("31");
    expect(groupLabel?.getAttribute("y")).toBe("27");
    expect(nodeLabel?.getAttribute("x")).toBe("82");
    expect(nodeLabel?.getAttribute("y")).toBe("134");
    expect(edgeLabel?.getAttribute("x")).toBe("160");
    expect(edgeLabel?.getAttribute("y")).toBe("159");
  });

  it("keeps icon, image, and line labels anchored to the shared bottom strip", () => {
    const dsl = `diagram layout=absolute margin=0
icon iconNode x=20 y=20 width=60 height=80 name="mdi:star" label="Icon"
image imageNode x=120 y=20 width=80 height=90 url="https://example.com/test.png" label="Image"
line lineNode x=240 y=20 width=120 height=26 label="Line"
end`;

    const instance = render({
      container: document.body,
      dsl,
      injectCSS: false,
    });

    const iconLabel = instance.svg?.querySelector("#node-iconNode text");
    const imageLabel = instance.svg?.querySelector("#node-imageNode text");
    const lineLabel = instance.svg?.querySelector("#node-lineNode text");

    expect(iconLabel?.getAttribute("y")).toBe(String(20 + 80 - NODE.mediaLabelH / 2));
    expect(imageLabel?.getAttribute("y")).toBe(String(20 + 90 - NODE.mediaLabelH / 2));
    expect(lineLabel?.getAttribute("y")).toBe(String(20 + 26 - NODE.mediaLabelH / 2));
  });
});
