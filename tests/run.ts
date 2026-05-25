declare const require: (id: string) => any;
declare const __dirname: string;

const fs = require("node:fs");
const path = require("node:path");

import {
  compileKeyframeStates,
  findElementById,
  generateVisualSchema,
  lintVisualDocument,
  listElementReferences,
  listTimelineTracks,
  renderToHtml,
  renderToSvg,
  removeTimelineKeyframe,
  resolveVisualFrame,
  setElementProperty,
  setTimelineKeyframe,
  validateVisualDocument,
  type VisualDocument
} from "../src";

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    throw error;
  }
}

test("validates minimal render-kernel documents", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180, background: "#ffffff" },
    elements: [
      { id: "line", type: "path", d: "M 20 120 L 300 40", stroke: "#111827", strokeWidth: 4 },
      { id: "label", type: "text", text: "Kernel", x: 160, y: 90, align: "center", valign: "middle" },
      { id: "pin", type: "point", x: 20, y: 120 }
    ]
  };
  const result = validateVisualDocument(doc);
  assert(result.ok, `document should validate: ${result.issues.map((item) => item.message).join("; ")}`);
});

test("rejects non-kernel fields and types", () => {
  const doc = {
    version: 1,
    canvas: { width: 320, height: 180, space: "3d", renderer: "three" },
    elements: [
      { id: "box", type: "rect", x: 20, y: 20, width: 80, height: 40 },
      { id: "cube", type: "cuboid", position: [0, 0, 0], size: [1, 1, 1] }
    ],
    motion: { drivers: [] },
    scenes: {},
    imports: {},
    assets: {},
    exports: {}
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "document should be invalid");
  assert(result.issues.some((item) => item.code === "non_kernel_field" && item.path === "/motion"), "motion should be rejected");
  assert(result.issues.some((item) => item.code === "non_kernel_canvas_field" && item.path === "/canvas/space"), "3D canvas fields should be rejected");
  assert(result.issues.some((item) => item.code === "unsupported_type" && item.path.endsWith("/type")), "non-kernel element types should be rejected");
});

test("rejects non-kernel fields on supported elements", () => {
  const doc = {
    version: 1,
    canvas: { width: 320, height: 180 },
    elements: [{ id: "old_line", type: "path", d: "M 0 0 L 10 10", from: [0, 0], to: [10, 10] }]
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "extra authoring fields should be invalid");
  assert(result.issues.some((item) => item.code === "non_kernel_element_field" && item.path.endsWith("/from")), "should reject old element fields");
});

test("renders path, text, image, and group to SVG and HTML", () => {
  const src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Crect width='10' height='10' fill='%232563eb'/%3E%3C/svg%3E";
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 240, height: 140, background: "#f8fafc" },
    elements: [
      {
        id: "card",
        type: "group",
        x: 20,
        y: 20,
        width: 200,
        height: 100,
        children: [
          { id: "panel", type: "path", d: "M 0 0 H 200 V 100 H 0 Z", fill: "#ffffff", stroke: "#cbd5e1" },
          { id: "photo", type: "image", src, x: 16, y: 16, width: 40, height: 40 },
          { id: "copy", type: "text", text: "Render kernel", x: 116, y: 38, align: "center", valign: "middle" }
        ]
      }
    ]
  };
  const svg = renderToSvg(doc);
  assert(svg.includes("<svg"), "should render SVG root");
  assert(svg.includes("<path") && svg.includes("<image") && svg.includes("Render kernel"), "should render kernel elements");
  assert(renderToHtml(doc).includes("Sketchmark Kernel Visual"), "should render HTML shell");
});

test("resolves element-local timeline tracks", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180, duration: 3 },
    elements: [
      {
        id: "dot",
        type: "point",
        x: 0,
        y: 0,
        timeline: {
          start: 1,
          end: 3,
          tracks: {
            position: { keyframes: [[0, [20, 30]], [2, [120, 90]]], ease: "linear" },
            opacity: { keyframes: [[0, 0], [1, 1]] }
          }
        }
      },
      {
        id: "mark",
        type: "path",
        d: "M 10 10 L 30 10",
        stroke: "#000000",
        timeline: {
          tracks: {
            stroke: { keyframes: [[0, "#000000"], [2, "#ffffff"]], ease: "linear" }
          }
        }
      }
    ]
  };
  assert(resolveVisualFrame(doc, 0.5).elements.every((item) => item.id !== "dot"), "timeline start should hide early elements");
  const mid = resolveVisualFrame(doc, 2);
  const dot = mid.elements.find((item) => item.id === "dot") as any;
  const mark = mid.elements.find((item) => item.id === "mark") as any;
  assert(near(dot.x, 70) && near(dot.y, 60), `position should interpolate, got ${dot.x},${dot.y}`);
  assert(dot.opacity === 1, "opacity should clamp after the last keyframe");
  assert(mark.stroke === "#ffffff", `color should interpolate/clamp, got ${mark.stroke}`);
  assert(!("timeline" in dot), "resolved frame should not keep timeline instructions");
});

test("resolves timeline interpolation graphs", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180, duration: 1 },
    elements: [
      {
        id: "graph",
        type: "point",
        x: 0,
        y: 0,
        timeline: {
          tracks: {
            position: {
              keyframes: [[0, [0, 0]], [1, [100, 0]]],
              curve: { type: "graph", points: [[0, 0], [0.5, 0], [1, 1]] }
            }
          }
        }
      },
      {
        id: "hold",
        type: "point",
        x: 0,
        y: 20,
        timeline: {
          tracks: {
            position: {
              keyframes: [[0, [0, 20]], [1, [100, 20]]],
              curve: { type: "hold" }
            }
          }
        }
      }
    ]
  };
  const mid = resolveVisualFrame(doc, 0.5);
  const graph = mid.elements.find((item) => item.id === "graph") as any;
  const hold = mid.elements.find((item) => item.id === "hold") as any;
  assert(near(graph.x, 0), `graph curve should map halfway time to zero progress, got ${graph.x}`);
  assert(near(hold.x, 0), `hold curve should stay at previous value, got ${hold.x}`);
  const late = resolveVisualFrame(doc, 0.75).elements.find((item) => item.id === "graph") as any;
  assert(near(late.x, 50), `graph curve should interpolate along normalized graph, got ${late.x}`);
});

test("resolves object keyframes and per-segment curves", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180, duration: 2 },
    elements: [
      {
        id: "dot",
        type: "point",
        x: 0,
        y: 0,
        timeline: {
          tracks: {
            position: {
              curve: { type: "graph", points: [[0, 0], [1, 1]] },
              keyframes: [
                { time: 0, value: [0, 0], out: { type: "hold" } },
                { time: 1, value: [100, 0] },
                { time: 2, value: [200, 0] }
              ]
            }
          }
        }
      }
    ]
  };
  const held = resolveVisualFrame(doc, 0.5).elements[0] as any;
  const linear = resolveVisualFrame(doc, 1.5).elements[0] as any;
  assert(near(held.x, 0), `object keyframe out curve should override track curve, got ${held.x}`);
  assert(near(linear.x, 150), `track curve should apply when segment has no keyframe curve, got ${linear.x}`);
});

test("compiles visual keyframe states to kernel timelines", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180, duration: 1 },
    elements: [
      {
        id: "card",
        type: "group",
        x: 20,
        y: 80,
        width: 80,
        height: 40,
        children: [{ id: "card_bg", type: "path", d: "M 0 0 H 80 V 40 H 0 Z", fill: "#ffffff" }]
      }
    ]
  };
  const animated = compileKeyframeStates(doc, [
    { time: 1, set: { card: { position: [220, 80], scale: 1.2, opacity: 0.5 } }, ease: "linear" }
  ]);
  const result = validateVisualDocument(animated);
  assert(result.ok, `compiled keyframes should validate: ${result.issues.map((item) => item.message).join("; ")}`);
  const card = animated.elements?.[0] as any;
  assert(card.timeline.tracks.position.keyframes.length === 2, "compiler should include the base position keyframe");
  assert(card.timeline.tracks.position.keyframes[0].value[0] === 20, "base position should come from the element");
  assert(card.timeline.tracks.position.keyframes[0].out?.type === "graph", "named linear ease should compile to an explicit graph curve");
  const mid = resolveVisualFrame(animated, 0.5).elements[0] as any;
  assert(near(mid.x, 120) && near(mid.scale, 1.1) && near(mid.opacity, 0.75), `compiled timeline should interpolate, got ${mid.x}, ${mid.scale}, ${mid.opacity}`);
});

test("compiles per-property curves and timing offsets", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180, duration: 2 },
    elements: [{ id: "dot", type: "point", x: 0, y: 0 }]
  };
  const animated = compileKeyframeStates(
    doc,
    [
      {
        time: 1,
        set: {
          dot: {
            position: {
              value: [100, 0],
              curve: { type: "hold" },
              offset: 0.25
            }
          }
        }
      }
    ],
    { offsets: { dot: { position: 0.25 } } }
  );
  const dot = animated.elements?.[0] as any;
  const keyframes = dot.timeline.tracks.position.keyframes;
  assert(keyframes[0].time === 0 && keyframes[0].out.type === "hold", "base keyframe should receive the property curve");
  assert(keyframes[1].time === 1.5, `global and property offsets should shift the target keyframe, got ${keyframes[1].time}`);
  assert(near((resolveVisualFrame(animated, 1).elements[0] as any).x, 0), "hold curve should keep the point at the base value before the target");
});

test("edits nested element properties and timeline keyframes", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180, duration: 2 },
    elements: [
      {
        id: "root",
        type: "group",
        x: 10,
        y: 20,
        children: [{ id: "nested", type: "point", x: 5, y: 6 }]
      }
    ]
  };
  assert(listElementReferences(doc).some((item) => item.id === "nested" && item.depth === 1), "nested element should be listed");
  const moved = setElementProperty(doc, "nested", "position", [30, 40]);
  assert((findElementById(moved, "nested") as any).x === 30, "nested position should update immutably");
  assert((findElementById(doc, "nested") as any).x === 5, "original document should not mutate");
  const animated = setTimelineKeyframe(moved, "nested", "position", 1, [90, 40], { out: { type: "hold" } });
  const tracks = listTimelineTracks(animated, "nested");
  assert(tracks.length === 1 && tracks[0].property === "position", "timeline track should be listed");
  assert((resolveVisualFrame(animated, 1).elements[0] as any).children[0].x === 90, "timeline keyframe should resolve");
  const cleaned = removeTimelineKeyframe(animated, "nested", "position", 1);
  assert(!listTimelineTracks(cleaned, "nested").length, "timeline keyframe removal should prune empty tracks");
});

test("edits and renders path position offsets", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 120, height: 80 },
    elements: [{ id: "mark", type: "path", d: "M 0 0 L 20 0", stroke: "#000000" }]
  };
  const moved = setElementProperty(doc, "mark", "position", [30, 40]);
  const mark = findElementById(moved, "mark") as any;
  assert(mark.x === 30 && mark.y === 40, "path position should edit x/y offsets");
  assert(renderToSvg(moved).includes("translate(30 40)"), "path position should render as translation");
});

test("validates timeline graph mistakes", () => {
  const doc = {
    version: 1,
    canvas: { width: 320, height: 180 },
    elements: [
      {
        id: "dot",
        type: "point",
        x: 0,
        y: 0,
        timeline: {
          tracks: {
            position: {
              keyframes: [[0, [0, 0]], [1, [100, 0]]],
              curve: { type: "graph", points: [[0, 0], [0.25, 1], [0.2, 0.5], [1, 1]] }
            }
          }
        }
      }
    ]
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "unsorted graph points should be invalid");
  assert(result.issues.some((item) => item.code === "unsorted_curve_points"), "should report unsorted curve points");
});

test("validates timeline mistakes", () => {
  const doc = {
    version: 1,
    canvas: { width: 320, height: 180 },
    elements: [
      { id: "dot", type: "point", x: 0, y: 0, timeline: { tracks: { x: { keyframes: [[1, 10], [0, 0]] } } } }
    ]
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "unsorted timeline should be invalid");
  assert(result.issues.some((item) => item.code === "unsorted_timeline_keyframes"), "should report unsorted timeline keyframes");
});

test("diagnostics report off-canvas elements", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 100, height: 100 },
    elements: [{ id: "outside", type: "text", text: "Outside", x: 120, y: 20 }]
  };
  assert(lintVisualDocument(doc).warnings.some((item) => item.code === "element_outside_canvas"), "should warn about off-canvas text");
});

test("generated schema matches the committed schema artifact", () => {
  const schemaPath = path.resolve(__dirname, "..", "..", "schema", "visual.schema.json");
  const committed = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert(stableStringify(generateVisualSchema()) === stableStringify(committed), "committed visual.schema.json should match generated schema");
});

console.log("All render-kernel tests passed.");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function near(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.0001;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortJson(item)]));
}
