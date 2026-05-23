const { core, saveVisual, writeJson } = require("./_helpers.cjs");

const doc = {
  version: 1,
  canvas: { width: 640, height: 360, background: "#ffffff", duration: 2 },
  elements: [
    { id: "box", type: "rect", x: 80, y: 80, width: 160, height: 90, radius: 16, fill: "#ffffff", stroke: "#2563eb", strokeWidth: 3, animate: { x: { from: 80, to: 180, duration: 2 } } },
    { id: "dot", type: "circle", cx: 360, cy: 125, radius: 42, fill: "#dcfce7", stroke: "#16a34a", strokeWidth: 3 },
    { id: "link", type: "arrow", from: "box.right", to: "dot.left", stroke: "#64748b", strokeWidth: 3 }
  ]
};

saveVisual("08-kernel-inspection", doc);
writeJson("08-kernel-inspection.lowered.json", core.lowerVisualDocument(doc));
writeJson("08-kernel-inspection.frame-1s.json", core.resolveKernelFrame(doc, 1));
