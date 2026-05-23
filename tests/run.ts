declare const require: (id: string) => any;
declare const __dirname: string;

const fs = require("node:fs");
const path = require("node:path");

import {
  applyVisualPatch,
  buildSymbolIndex,
  compileCompounds,
  compileVisualSequence,
  documentForDeckStep,
  documentForScene,
  documentForSequenceTime,
  generateVisualSchema,
  lintVisualDocument,
  loadVisualProject,
  lowerVisualDocument,
  normalizeVisualDocument,
  renderToHtml,
  renderRawThreeModuleHtml,
  renderToSvg,
  renderToThreeHtml,
  renderThreePreviewSvg,
  resolveVisualFrame,
  resolveKernelFrame,
  resolvedFrameForDeckStep,
  resolvedFrameForScene,
  resolvedFrameForSequenceTime,
  renderDeckToHtml,
  sequenceTimeline,
  validateVisualDocument,
  validateKernelVisualDocument,
  validateVisualProject,
  type VisualDocument,
  type VisualProject
} from "../src";
import { registeredAuthoringShapeTypes } from "../src/shapes";
import {
  animate,
  callout,
  column,
  flow,
  node,
  packet,
  row,
  scene
} from "../src/builders";

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

test("validates primitive geometry", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 400, height: 240 },
    elements: [{ id: "card", type: "rect", x: 20, y: 30, width: 100, height: 60 }]
  };
  const result = validateVisualDocument(doc);
  assert(result.ok, "document should be valid");
});

test("rejects compound types in canonical JSON", () => {
  const doc = {
    version: 1,
    canvas: { width: 400, height: 240 },
    elements: [{ id: "bad", type: "node", label: "Browser", x: 0, y: 0, width: 100, height: 50 }]
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "document should be invalid");
  assert(result.issues.some((item) => item.code === "compound_type_not_allowed"), "should report compound type");
});

test("builders expand compounds into primitives", () => {
  const items = [
    ...node({ id: "browser", label: "Browser", x: 120, y: 160, width: 180, height: 80 }),
    ...node({ id: "resolver", label: "DNS Resolver", x: 380, y: 160, width: 180, height: 80 }),
    ...flow({ id: "query", from: "browser_box.right", to: "resolver_box.left", label: "Query", labelX: 340, labelY: 145 }),
    packet({ id: "query_packet", on: "query", progress: animate(0, 1, { duration: 1, delay: 1 }) }),
    ...callout({ id: "note", text: "Cached result", x: 520, y: 80, width: 140, height: 48, target: "resolver_box.top" })
  ];
  const compoundTypes = new Set<string>(["node", "flow", "packet", "callout"]);
  assert(items.every((item) => !compoundTypes.has(item.type)), "builders must return primitives");
});

test("compileCompounds is explicit and outputs primitives", () => {
  const doc = compileCompounds({
    version: 1,
    canvas: { width: 640, height: 360 },
    elements: [
      { id: "browser", type: "node", label: "Browser", x: 80, y: 120, width: 160, height: 70 },
      { id: "resolver", type: "node", label: "Resolver", x: 320, y: 120, width: 160, height: 70 },
      { id: "query", type: "flow", from: "browser_box.right", to: "resolver_box.left", label: "Query", labelX: 280, labelY: 110 }
    ]
  });
  const forbidden = new Set<string>(["node", "flow"]);
  assert(doc.elements?.every((item) => !forbidden.has(item.type)), "compiled document should contain only primitives");
  assert(validateVisualDocument(doc).ok, "compiled document should validate");
});

test("resolves references to numeric endpoints", () => {
  const doc = scene({
    canvas: { width: 640, height: 360 },
    elements: [
      { id: "left", type: "rect", x: 100, y: 100, width: 100, height: 60 },
      { id: "right", type: "rect", x: 300, y: 100, width: 100, height: 60 },
      { id: "arrow", type: "arrow", from: "left.right", to: "right.left", stroke: "#111827" }
    ]
  });
  const normalized = normalizeVisualDocument(doc);
  const arrow = normalized.elements.find((item) => item.id === "arrow");
  assert(JSON.stringify((arrow as any).from) === JSON.stringify([200, 130]), "from should resolve to right edge");
  assert(JSON.stringify((arrow as any).to) === JSON.stringify([300, 130]), "to should resolve to left edge");
});

test("animated x requires a static x", () => {
  const doc = {
    version: 1,
    canvas: { width: 400, height: 240 },
    elements: [{ id: "label", type: "text", text: "Move", y: 40, animate: { x: animate(0, 100, { duration: 1 }) } }]
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "document should be invalid");
  assert(result.issues.some((item) => item.code === "missing_static_animation_property"), "should require static animated property");
});

test("rejects raw keyframe arrays in animate", () => {
  const doc = {
    version: 1,
    canvas: { width: 400, height: 240, duration: 2 },
    elements: [
      {
        id: "dot",
        type: "circle",
        cx: 20,
        cy: 40,
        radius: 6,
        animate: { cx: [[0, 20], [1, 120], [2, 20]] }
      }
    ]
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "document should be invalid");
  assert(result.issues.some((item) => item.code === "invalid_animation"), "should reject raw keyframe arrays");
});

test("rejects effects arrays", () => {
  const doc = {
    version: 1,
    canvas: { width: 400, height: 240 },
    elements: [
      {
        id: "sun",
        type: "circle",
        cx: 200,
        cy: 120,
        radius: 30,
        effects: [{ type: "shadow", blur: 20, color: "#facc15" }]
      }
    ]
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "document should be invalid");
  assert(result.issues.some((item) => item.code === "invalid_effects"), "should reject effects arrays");
});

test("rejects structured canvas backgrounds", () => {
  const doc = {
    version: 1,
    canvas: {
      width: 400,
      height: 240,
      background: {
        type: "linearGradient",
        from: [0, 0],
        to: [0, 240],
        stops: [[0, "#87ceeb"], [1, "#e8f4f8"]]
      }
    },
    elements: []
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "document should be invalid");
  assert(result.issues.some((item) => item.code === "invalid_canvas_background"), "should reject structured canvas backgrounds");
});

test("long text warns without changing layout", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 400, height: 240 },
    elements: [{ id: "label", type: "text", text: "This is a long label that should warn instead of resizing anything automatically", x: 20, y: 20 }]
  };
  const result = validateVisualDocument(doc);
  assert(result.ok, "warning should not invalidate document");
  assert(result.warnings.some((item) => item.code === "long_text_no_wrap"), "should warn for long text");
});

test("row and column builders position explicit primitive children", () => {
  const rowItems = row({
    x: 10,
    y: 20,
    gap: 10,
    children: [
      node({ id: "a", label: "A", x: 0, y: 0, width: 100, height: 40 }),
      node({ id: "b", label: "B", x: 0, y: 0, width: 100, height: 40 })
    ]
  });
  const bBox = rowItems.find((item) => item.id === "b_box") as any;
  assert(bBox.x === 120 && bBox.y === 20, "row should move second box deterministically");

  const columnItems = column({
    x: 10,
    y: 20,
    gap: 10,
    children: [
      node({ id: "c", label: "C", x: 0, y: 0, width: 100, height: 40 }),
      node({ id: "d", label: "D", x: 0, y: 0, width: 100, height: 40 })
    ]
  });
  const dBox = columnItems.find((item) => item.id === "d_box") as any;
  assert(dBox.x === 10 && dBox.y === 70, "column should move second box deterministically");
});

test("renders primitive SVG", () => {
  const doc = scene({
    canvas: { width: 320, height: 180, background: "#ffffff" },
    elements: [
      { id: "box", type: "rect", x: 20, y: 20, width: 100, height: 60, fill: "#ffffff", stroke: "#111827" },
      { id: "label", type: "text", text: "Hello", x: 70, y: 50, align: "center", valign: "middle" }
    ]
  });
  const svg = renderToSvg(doc);
  assert(svg.includes("<svg"), "should render svg");
  assert(svg.includes("Hello"), "should include text");
  assert(!renderToSvg(doc, { transparent: true }).includes('width="320" height="180" fill="#ffffff"'), "transparent SVG should omit background rect");
});

test("renders abstract canvas primitive styling", () => {
  const doc = scene({
    canvas: { width: 520, height: 320, background: "#f8fafc" },
    elements: [
      {
        id: "panel",
        type: "rect",
        x: 40,
        y: 40,
        width: 180,
        height: 120,
        radius: 14,
        fill: { type: "linearGradient", from: [40, 40], to: [220, 160], stops: [[0, "#dbeafe"], [1, "#a7f3d0"]] },
        stroke: "#2563eb",
        strokeWidth: 3,
        effects: { shadow: { dx: 0, dy: 8, blur: 16, color: "#64748b", opacity: 0.25 } },
        rotation: -4
      },
      {
        id: "copy",
        type: "text",
        lines: ["Gradient panel", "with two lines"],
        x: 130,
        y: 100,
        align: "center",
        valign: "middle",
        fontSize: 18,
        lineHeight: 1.25,
        letterSpacing: 0.2
      },
      { id: "anchor", type: "point", x: 260, y: 100 },
      { id: "trend", type: "polyline", points: [[300, 170], [340, 130], [390, 150], [440, 90]], stroke: "#dc2626", strokeWidth: 4, strokeCap: "round", drawEnd: 0.6 },
      { id: "triangle", type: "polygon", points: [[330, 230], [390, 190], [450, 230]], fill: "#fef3c7", stroke: "#f59e0b", strokeJoin: "round", blendMode: "multiply" },
      { id: "link", type: "arrow", from: "panel.right", to: "anchor", stroke: "#16a34a", strokeWidth: 3, strokeCap: "round" }
    ]
  });
  const result = validateVisualDocument(doc);
  assert(result.ok, `styled document should validate: ${result.issues.map((item) => item.message).join("; ")}`);
  const svg = renderToSvg(doc);
  assert(svg.includes("<linearGradient"), "should render gradients");
  assert(svg.includes("feDropShadow"), "should render shadow filters");
  assert(svg.includes("<tspan"), "should render multiline text");
  assert(svg.includes("pathLength=\"1\""), "should render draw reveal");
  assert(svg.includes("stroke-linecap=\"round\""), "should render stroke caps");
  assert(svg.includes("mix-blend-mode:multiply"), "should render blend mode");
});

test("color animation resolves fill and stroke values", () => {
  const doc = scene({
    canvas: { width: 200, height: 120 },
    elements: [
      {
        id: "signal",
        type: "circle",
        cx: 60,
        cy: 60,
        radius: 20,
        fill: "#ff0000",
        stroke: "#0000ff",
        animate: {
          fill: animate("#ff0000" as any, "#00ff00" as any, { duration: 2 }) as any,
          stroke: animate("#0000ff" as any, "#ff0000" as any, { duration: 2 }) as any
        }
      }
    ]
  });
  const frame = resolveVisualFrame(doc, 1);
  const signal = frame.elements.find((item) => item.id === "signal") as any;
  assert(signal.fill === "#808000", `fill should interpolate, got ${signal.fill}`);
  assert(signal.stroke === "#800080", `stroke should interpolate, got ${signal.stroke}`);
});

test("point references resolve after point animation", () => {
  const doc = scene({
    canvas: { width: 240, height: 120 },
    elements: [
      { id: "moving", type: "point", x: 20, y: 40, animate: { x: animate(20, 120, { duration: 2 }) } },
      { id: "wire", type: "line", from: "moving", to: [200, 40], stroke: "#111827" }
    ]
  });
  const frame = resolveVisualFrame(doc, 1);
  const wire = frame.elements.find((item) => item.id === "wire") as any;
  assert(JSON.stringify(wire.from) === JSON.stringify([70, 40]), `animated point reference should resolve, got ${JSON.stringify(wire.from)}`);
});

test("renders image fit, image crop, arc, curve, mask, and pattern paint", () => {
  const texture = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23dbeafe'/%3E%3Cpath d='M0 32 L32 0' stroke='%232563eb' stroke-width='6'/%3E%3C/svg%3E";
  const photo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240'%3E%3Crect width='400' height='240' fill='%23fef3c7'/%3E%3Ccircle cx='260' cy='120' r='90' fill='%23fb923c'/%3E%3C/svg%3E";
  const doc = scene({
    canvas: { width: 640, height: 360, background: "#ffffff" },
    elements: [
      {
        id: "pattern_card",
        type: "rect",
        x: 40,
        y: 40,
        width: 150,
        height: 110,
        radius: 12,
        fill: { type: "pattern", src: texture, width: 32, height: 32, fit: "cover" },
        stroke: "#2563eb"
      },
      {
        id: "cropped_photo",
        type: "image",
        src: photo,
        x: 230,
        y: 40,
        width: 160,
        height: 110,
        fit: "cover",
        source: { x: 100, y: 40, width: 180, height: 120, imageWidth: 400, imageHeight: 240 },
        mask: { type: "circle", cx: 310, cy: 95, radius: 55 }
      },
      {
        id: "angle",
        type: "arc",
        cx: 120,
        cy: 250,
        radius: 70,
        startAngle: -20,
        endAngle: 230,
        stroke: "#dc2626",
        strokeWidth: 5,
        strokeCap: "round",
        drawEnd: 0.75
      },
      {
        id: "flow_curve",
        type: "curve",
        from: [250, 250],
        control1: [340, 150],
        control2: [440, 340],
        to: [560, 230],
        stroke: "#16a34a",
        strokeWidth: 5,
        strokeCap: "round",
        fill: "none"
      },
      {
        id: "curve_dot",
        type: "circle",
        radius: 7,
        fill: "#111827",
        follow: "flow_curve",
        progress: 0.5
      }
    ]
  });
  const result = validateVisualDocument(doc);
  assert(result.ok, `canvas-like document should validate: ${result.issues.map((item) => item.message).join("; ")}`);
  const frame = resolveVisualFrame(doc, 0);
  const dot = frame.elements.find((item) => item.id === "curve_dot") as any;
  assert(dot.cx > 250 && dot.cx < 560, "circle should follow curve primitive");
  const svg = renderToSvg(doc);
  assert(svg.includes("<pattern"), "should render pattern paint");
  assert(svg.includes("preserveAspectRatio=\"xMidYMid slice\""), "should render cover image fit");
  assert(svg.includes("clip-path=\"url(#"), "should crop image with clip path");
  assert(svg.includes("<mask"), "should render masks");
  assert(svg.includes(" A "), "should render arc path");
  assert(svg.includes(" C "), "should render cubic curve path");
});

test("lowers authoring primitives into the 2D kernel", () => {
  const doc = scene({
    canvas: { width: 640, height: 360 },
    elements: [
      { id: "box", type: "rect", x: 20, y: 20, width: 80, height: 50, radius: 8, fill: "#ffffff", clip: { type: "rect", x: 20, y: 20, width: 80, height: 50 } },
      { id: "dot", type: "circle", cx: 140, cy: 45, radius: 20, fill: "#2563eb" },
      { id: "oval", type: "ellipse", cx: 210, cy: 45, rx: 28, ry: 16 },
      { id: "wire", type: "line", from: [260, 20], to: [320, 80] },
      { id: "arrow", type: "arrow", from: [340, 20], to: [400, 80], stroke: "#dc2626" },
      { id: "angle", type: "arc", cx: 100, cy: 160, radius: 40, startAngle: 0, endAngle: 180 },
      { id: "curve", type: "curve", from: [170, 160], control1: [230, 80], to: [300, 160], stroke: "#16a34a" },
      { id: "poly", type: "polyline", points: [[330, 150], [360, 110], [390, 150]] },
      { id: "shape", type: "polygon", points: [[420, 150], [450, 110], [480, 150]] },
      { id: "raw", type: "path", d: "M 20 260 L 100 260" },
      { id: "label", type: "text", text: "Kernel", x: 160, y: 260 },
      { id: "anchor", type: "point", x: 240, y: 260 },
      { id: "photo", type: "image", src: "data:image/svg+xml,%3Csvg/%3E", x: 280, y: 230, width: 80, height: 50, mask: { type: "circle", cx: 320, cy: 255, radius: 24 } },
      { id: "group", type: "group", x: 420, y: 220, children: [{ id: "child", type: "rect", x: 0, y: 0, width: 40, height: 30 }] }
    ]
  });
  const lowered = lowerVisualDocument(doc);
  const allowed = new Set(["group", "path", "text", "image", "point"]);
  assert(validateKernelVisualDocument(lowered).ok, "lowered 2D document should validate as kernel");
  assert(lowered.elements.every((item) => allowed.has(item.type)), "top-level 2D kernel should contain only low primitives");
  assert(lowered.elements.filter((item) => item.type === "path").length >= 10, "friendly shapes should lower to paths");
  assert((lowered.elements.find((item) => item.id === "arrow") as any).metadata.markerEnd === "arrow", "arrow marker metadata should survive lowering");
  assert((lowered.elements.find((item) => item.id === "box") as any).clip.type === "path", "clip shape should lower to path");
  assert((lowered.elements.find((item) => item.id === "photo") as any).mask.type === "path", "mask shape should lower to path");
});

test("uses an internal registry for authoring shape lowerers", () => {
  const types = registeredAuthoringShapeTypes();
  assert(types.includes("rect") && types.includes("circle") && types.includes("sphere"), "built-in shape registry should expose registered authoring shapes");
});

test("validates built-in shape geometry through the registry", () => {
  const doc = {
    version: 1,
    canvas: { width: 200, height: 120 },
    elements: [{ id: "bad_rect", type: "rect", x: 10, y: 10, height: 40 }]
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "document should be invalid");
  assert(result.issues.some((item) => item.path === "/elements/0/width" && item.code === "missing_number"), "rect width should be validated by shape definition");
});

test("enforces shape-owned animation properties", () => {
  const doc = {
    version: 1,
    canvas: { width: 200, height: 120 },
    elements: [{ id: "label", type: "text", text: "Hello", x: 20, y: 20, animate: { radius: animate(2, 10, { duration: 1 }) } }]
  } as unknown as VisualDocument;
  const result = validateVisualDocument(doc);
  assert(!result.ok, "document should be invalid");
  assert(result.issues.some((item) => item.code === "unsupported_animation_property"), "text should not accept circle-only animation properties");
});

test("generated schema matches the committed schema artifact", () => {
  const schemaPath = path.resolve(__dirname, "..", "..", "schema", "visual.schema.json");
  const committed = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert(stableStringify(generateVisualSchema()) === stableStringify(committed), "committed visual.schema.json should match generated schema");
});

test("resolves animation before lowering kernel frames", () => {
  const doc = scene({
    canvas: { width: 320, height: 180, duration: 2 },
    elements: [
      { id: "moving_box", type: "rect", x: 20, y: 30, width: 40, height: 30, animate: { x: animate(20, 120, { duration: 2 }) } }
    ]
  });
  const frame = resolveKernelFrame(doc, 1);
  const pathElement = frame.elements.find((item) => item.id === "moving_box") as any;
  assert(pathElement.type === "path", "animated rect should lower to a kernel path");
  assert(pathElement.d.startsWith("M 70 "), `lowered frame should use resolved animated x, got ${pathElement.d}`);
  assert(!("animate" in pathElement), "resolved kernel frame should not retain authoring animation instructions");
});

test("lowered kernel paths keep only kernel-compatible animations", () => {
  const doc = scene({
    canvas: { width: 320, height: 180, duration: 2 },
    elements: [
      {
        id: "moving_box",
        type: "rect",
        x: 20,
        y: 30,
        width: 40,
        height: 30,
        opacity: 0.4,
        animate: {
          x: animate(20, 120, { duration: 2 }),
          opacity: animate(0.4, 1, { duration: 2 })
        }
      }
    ]
  });
  const lowered = lowerVisualDocument(doc);
  const pathElement = lowered.elements.find((item) => item.id === "moving_box") as any;
  assert(pathElement.type === "path", "rect should lower to a kernel path");
  assert(!("x" in (pathElement.animate ?? {})), "path lowering should remove authoring-only x animation");
  assert(pathElement.animate?.opacity, "path lowering should keep compatible opacity animation");
});

test("lowers structured 3D authoring primitives into mesh kernel", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180, space: "3d", renderer: "three" },
    elements: [
      { id: "cube", type: "cuboid", position: [0, 0, 0], size: [1, 1, 1], fill: "#2563eb" },
      { id: "ball", type: "sphere", position: [2, 0, 0], radius: 0.5, fill: "#ef4444" },
      { id: "floor", type: "plane", position: [0, -1, 0], size: [4, 3], fill: "#dbeafe" },
      { id: "axis", type: "line3d", from: [-1, 0, 0], to: [1, 0, 0], stroke: "#111827" },
      { id: "caption", type: "text3d", text: "3D", position: [0, 1, 0] },
      { id: "lamp", type: "light", kind: "directional", position: [2, 4, 3] }
    ]
  };
  const lowered = lowerVisualDocument(doc);
  assert(validateKernelVisualDocument(lowered).ok, "lowered 3D document should validate as kernel");
  assert(lowered.elements.filter((item) => item.type === "mesh3d").length === 3, "cuboid, sphere, and plane should lower to mesh3d");
  assert(lowered.elements.some((item) => item.type === "line3d"), "line3d should remain a kernel line");
  assert((lowered.elements.find((item) => item.id === "cube") as any).vertices.length === 8, "cuboid mesh should expose vertices");
});

test("circle followers can move along paths", () => {
  const doc = scene({
    canvas: { width: 320, height: 180, duration: 2 },
    elements: [
      { id: "route", type: "path", d: "M 20 120 C 90 20 180 160 300 60", fill: "none", stroke: "#2563eb" },
      { id: "dot", type: "circle", radius: 6, fill: "#ef4444", follow: "route", progress: animate(0, 1, { duration: 2 }) }
    ]
  });
  const start = resolveVisualFrame(doc, 0).elements.find((item) => item.id === "dot") as any;
  const middle = resolveVisualFrame(doc, 1).elements.find((item) => item.id === "dot") as any;
  const end = resolveVisualFrame(doc, 2).elements.find((item) => item.id === "dot") as any;
  assert(near(start.cx, 20) && near(start.cy, 120), "path follower should start at path start");
  assert(near(end.cx, 300) && near(end.cy, 60), "path follower should end at path end");
  assert(middle.cx > 20 && middle.cx < 300, "path follower should move through sampled path");
});

test("circle followers sample lowered path-like authoring shapes", () => {
  const doc = scene({
    canvas: { width: 320, height: 220 },
    elements: [
      { id: "arc_route", type: "arc", cx: 90, cy: 100, radius: 50, startAngle: 0, endAngle: 180, stroke: "#2563eb" },
      { id: "arc_dot", type: "circle", radius: 4, fill: "#ef4444", follow: "arc_route", progress: 0.5 },
      { id: "poly_route", type: "polyline", points: [[180, 160], [220, 80], [280, 160]], stroke: "#16a34a" },
      { id: "poly_dot", type: "circle", radius: 4, fill: "#111827", follow: "poly_route", progress: 1 }
    ]
  });
  const frame = resolveVisualFrame(doc, 0);
  const arcDot = frame.elements.find((item) => item.id === "arc_dot") as any;
  const polyDot = frame.elements.find((item) => item.id === "poly_dot") as any;
  assert(near(arcDot.cx, 90) && near(arcDot.cy, 150), `arc follower should sample the lowered arc path, got ${arcDot.cx},${arcDot.cy}`);
  assert(near(polyDot.cx, 280) && near(polyDot.cy, 160), "polyline follower should sample lowered polyline path");
});

test("applies primitive id patches", () => {
  const doc = scene({
    canvas: { width: 320, height: 180 },
    elements: [{ id: "label", type: "text", text: "Old", x: 20, y: 20 }]
  });
  const patched = applyVisualPatch(doc, { op: "update", id: "label", set: { text: "New" } as any }).document;
  const label = patched.elements?.find((item) => item.id === "label") as any;
  assert(label.text === "New", "patch should update by id");
});

test("resolves scenes and sequences", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180 },
    scenes: {
      intro: { elements: [{ id: "intro_title", type: "text", text: "Intro", x: 20, y: 20 }] },
      outro: { elements: [{ id: "outro_title", type: "text", text: "Outro", x: 20, y: 20 }] }
    },
    sequences: {
      main: { id: "main", clips: [{ scene: "intro", duration: 2 }, { scene: "outro", duration: 3 }] }
    }
  };
  assert(documentForScene(doc, "intro").elements?.[0]?.id === "intro_title", "scene should resolve");
  assert(resolvedFrameForScene(doc, "intro", 0).elements[0]?.id === "intro_title", "scene resolved frame should resolve");
  assert(compileVisualSequence(doc, "main").duration === 5, "sequence duration should compile");
  const frame = documentForSequenceTime(doc, "main", 2.5);
  assert(frame.scene === "outro" && frame.localTime === 0.5, "sequence frame should map global to local time");
  assert(resolvedFrameForSequenceTime(doc, "main", 2.5).document.elements[0]?.id === "outro_title", "sequence resolved frame should expose resolved authoring frame");
});

test("sequence fade transitions produce inspectable frames and timeline", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180, duration: 2, fps: 10 },
    scenes: {
      a: { elements: [{ id: "a_title", type: "text", text: "A", x: 20, y: 20 }] },
      b: { elements: [{ id: "b_title", type: "text", text: "B", x: 20, y: 20 }] }
    },
    sequences: {
      main: { id: "main", clips: [{ scene: "a", duration: 1 }, { scene: "b", duration: 1, transition: { type: "fade", duration: 0.5 } }] }
    }
  };
  const frame = documentForSequenceTime(doc, "main", 1.25);
  assert(frame.transition?.type === "fade", "frame should expose fade transition");
  assert(frame.document.elements?.some((item) => item.id === "fade_from_a_title"), "fade should include previous primitive clone");
  assert(frame.document.elements?.some((item) => item.id === "fade_to_b_title"), "fade should include next primitive clone");
  assert(sequenceTimeline(doc, "main", 10).some((item) => item.transition?.type === "fade"), "timeline should expose transition frames");
});

test("applies deck step visibility without mutating primitives", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180 },
    scenes: {
      slide: {
        elements: [
          { id: "title", type: "text", text: "Title", x: 20, y: 20 },
          { id: "detail", type: "text", text: "Detail", x: 20, y: 60, opacity: 0 }
        ],
        steps: [{ id: "show_detail", show: ["detail"] }]
      }
    }
  };
  const frame = documentForDeckStep(doc, "slide", 0);
  const detail = frame.elements?.find((item) => item.id === "detail");
  assert(detail?.opacity === 1, "deck step should show explicit ids");
  assert(resolvedFrameForDeckStep(doc, "slide", 0).elements.find((item) => item.id === "detail")?.opacity === 1, "deck resolved frame should expose step visibility");
  assert(renderDeckToHtml(doc, "slide").includes("Next"), "deck html should include controls");
});

test("reports visual diagnostics without moving elements", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 100, height: 100 },
    elements: [
      { id: "outside", type: "rect", x: 80, y: 80, width: 40, height: 40 },
      { id: "panel", type: "rect", x: 10, y: 10, width: 50, height: 20, fill: "#ffffff" },
      { id: "low", type: "text", text: "Low contrast text", x: 35, y: 20, align: "center", valign: "middle", fill: "#eeeeee" }
    ]
  };
  const report = lintVisualDocument(doc);
  assert(report.warnings.some((item) => item.code === "element_outside_canvas"), "should warn about off-canvas elements");
  assert(report.warnings.some((item) => item.code === "low_text_contrast"), "should warn about contrast");
});

test("builds project symbol index and validates project scopes", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180 },
    scenes: {
      intro: { elements: [{ id: "title", type: "text", text: "Intro", x: 20, y: 20 }] }
    }
  };
  const project: Pick<VisualProject, "document" | "files" | "symbols"> = { document: doc, files: { "project.visual.json": doc }, symbols: [] };
  project.symbols = buildSymbolIndex(project);
  assert(project.symbols.some((symbol) => symbol.id === "title" && symbol.scene === "intro"), "symbol index should include scene ids");
  assert(validateVisualProject(project).ok, "project should validate");
});

test("renders structured three html", () => {
  const doc: VisualDocument = {
    version: 1,
    canvas: { width: 320, height: 180, space: "3d", renderer: "three", background: "#ffffff" },
    elements: [{ id: "cube", type: "cuboid", position: [0, 0, 0], size: [1, 1, 1], fill: "#2563eb" }]
  };
  const html = renderToThreeHtml(doc);
  assert(html.includes("THREE") && html.includes("mesh3d"), "should render three html from kernel mesh");
  assert(renderToHtml(doc).includes("THREE"), "html renderer should delegate to three");
  assert(renderThreePreviewSvg(doc).includes("<polygon"), "structured three should have deterministic svg preview");
});

test("renders raw three module escape hatch html outside primitive docs", () => {
  const html = renderRawThreeModuleHtml({ width: 320, height: 180, moduleUrl: "./scene.js" });
  assert(html.includes("createSketchmarkThreeScene"), "raw module html should use explicit module entrypoint");
});

test("all good examples validate and render", () => {
  const examplesRoot = path.resolve(__dirname, "..", "..", "examples");
  const files = collectVisualFiles(examplesRoot).filter((file: string) => !normalizePath(file).includes("/bad/"));
  const featureFiles = files.filter((file: string) => normalizePath(file).includes("/features/"));
  assert(featureFiles.length >= 20, "should include at least 20 feature examples");
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as VisualDocument;
    const doc = raw.imports ? loadVisualProject(file).document : raw;
    const result = validateVisualDocument(doc);
    const relative = normalizePath(path.relative(examplesRoot, file));
    assert(result.ok, `${relative} should validate: ${result.issues.map((issue) => issue.message).join("; ")}`);
    const frame = raw.sequences ? documentForSequenceTime(doc, Object.keys(raw.sequences)[0]!, 0).document : raw.scenes ? documentForScene(doc, Object.keys(raw.scenes)[0]!) : doc;
    const output = frame.canvas.renderer === "three" ? renderThreePreviewSvg(frame) : renderToSvg(frame);
    assert(output.includes("<svg"), `${relative} should render an SVG preview`);
  }
});

console.log("All primitive visual language tests passed.");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function collectVisualFiles(directory: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...collectVisualFiles(fullPath));
    else if (entry.name.endsWith(".visual.json")) out.push(fullPath);
  }
  return out;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
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
