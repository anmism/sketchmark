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
  it("applies fixed sizing and follows the next focusable step inside the clipped viewport", async () => {
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
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    expect(embed.world.style.transform).toBe(
      "translate(16px, 45.333333333333336px) scale(0.22333333333333333)",
    );
  });

  it("lets the play control hard-stop autoplay mid-run", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const embed = new SketchmarkEmbed({
      container: host,
      width: 320,
      height: 220,
      dsl: `
diagram
box a label="Start"
box b label="Finish"

step draw a
step draw b
end
      `.trim(),
    });

    const playButton = embed.root.querySelector('[data-action="play"]') as HTMLButtonElement;
    const playPromise = embed.play();

    expect(playButton.textContent).toBe("Stop");

    playButton.click();
    await playPromise;

    expect(playButton.textContent).toBe("Play");
    expect(embed.instance?.anim.currentStep).toBe(0);
  });
});
