import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SketchmarkEmbed } from "../src/index";

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

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
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

describe("SketchmarkEmbed", () => {
  it("applies fixed sizing and follows the next focusable step inside the clipped viewport", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const embed = new SketchmarkEmbed({
      container: host,
      width: 320,
      height: 220,
      focusDuration: 0,
      dsl: `
diagram layout=row gap=600

box a label="Start"
box b label="Focus"

step narrate "Set the stage"
step draw b
end
      `.trim(),
    });

    expect(embed.root.style.width).toBe("320px");
    expect(embed.root.style.height).toBe("220px");

    embed.viewport.getBoundingClientRect = () => rect(0, 0, 300, 180);
    embed.instance?.svg?.setAttribute("width", "1200");
    embed.instance?.svg?.setAttribute("height", "400");

    const focusNode = embed.instance?.svg?.querySelector("#node-b") as Element;
    focusNode.getBoundingClientRect = () => rect(900, 40, 120, 60);

    embed.nextStep();

    expect(embed.world.style.transform).toBe(
      "translate(16px, 45.333333333333336px) scale(0.22333333333333333)",
    );
  });
});
