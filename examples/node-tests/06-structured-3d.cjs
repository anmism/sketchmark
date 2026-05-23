const { saveVisual } = require("./_helpers.cjs");

const doc = {
  version: 1,
  canvas: { width: 960, height: 540, background: "#eef2ff", space: "3d", renderer: "three", duration: 6, fps: 30 },
  elements: [
    { id: "ambient", type: "light", kind: "ambient", intensity: 0.55 },
    { id: "key_light", type: "light", kind: "directional", position: [4, 6, 5], intensity: 0.9 },
    { id: "floor", type: "plane", position: [0, -0.8, 0], size: [5.5, 3.5], fill: "#dbeafe", opacity: 0.75 },
    { id: "product", type: "cuboid", position: [0, 0.2, 0], size: [1.1, 1.8, 0.7], fill: "#2563eb", stroke: "#1e3a8a", rotationY: 0, animate: { rotationY: { from: 0, to: 360, duration: 6, ease: "linear" } } },
    { id: "button", type: "sphere", position: [0, 0.35, 0.48], radius: 0.16, fill: "#f8fafc", stroke: "#0f172a" },
    { id: "axis", type: "line3d", from: [-2.2, -0.75, 0], to: [2.2, -0.75, 0], stroke: "#64748b", strokeWidth: 2 },
    { id: "caption", type: "text3d", text: "structured 3D primitives", position: [-1.7, 1.8, 0], fontSize: 0.22, fill: "#111827" }
  ]
};

saveVisual("06-structured-3d", doc);
