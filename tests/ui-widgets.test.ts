import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SketchmarkCanvas, SketchmarkEditor } from "../src/index";

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

describe("reusable UI widgets", () => {
  it("emits editor run events", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const editor = new SketchmarkEditor({
      container: host,
      value: "diagram\nbox a\nend",
    });

    let payload = "";
    editor.on("run", ({ value }) => {
      payload = value;
    });

    editor.run();

    expect(payload).toContain("box a");
  });

  it("binds the editor to the canvas renderer", () => {
    const editorHost = document.createElement("div");
    const canvasHost = document.createElement("div");
    document.body.appendChild(editorHost);
    document.body.appendChild(canvasHost);

    const editor = new SketchmarkEditor({
      container: editorHost,
      value: "diagram\nbox a label=\"App\"\nend",
    });

    const canvas = new SketchmarkCanvas({
      container: canvasHost,
      autoFit: false,
      showMinimap: false,
    });

    canvas.bindEditor(editor, { initialRender: false });
    editor.run();

    expect(canvas.instance?.svg).toBeTruthy();
    expect(canvas.instance?.svg?.querySelector("#node-a")).toBeTruthy();
    expect(editor.errorElement.classList.contains("is-visible")).toBe(false);
  });

  it("mirrors render errors back into the editor", () => {
    const editorHost = document.createElement("div");
    const canvasHost = document.createElement("div");
    document.body.appendChild(editorHost);
    document.body.appendChild(canvasHost);

    const editor = new SketchmarkEditor({
      container: editorHost,
      value: "diagram\nbox a\nend",
    });

    const canvas = new SketchmarkCanvas({
      container: canvasHost,
      autoFit: false,
      showMinimap: false,
    });

    canvas.bindEditor(editor, { initialRender: false });
    editor.setValue("diagram\nbox\nend");
    editor.run();

    expect(canvas.errorElement.textContent).toContain("ParseError");
    expect(editor.errorElement.textContent).toContain("ParseError");
  });
});
