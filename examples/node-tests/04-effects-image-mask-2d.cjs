const { saveVisual } = require("./_helpers.cjs");

const tile = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23dbeafe'/%3E%3Cpath d='M0 48 L48 0' stroke='%232563eb' stroke-width='8'/%3E%3C/svg%3E";
const photo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='320'%3E%3Crect width='500' height='320' fill='%23fef3c7'/%3E%3Ccircle cx='340' cy='160' r='120' fill='%23fb923c'/%3E%3Ccircle cx='210' cy='130' r='80' fill='%23f97316'/%3E%3C/svg%3E";

const doc = {
  version: 1,
  canvas: { width: 960, height: 540, background: "#ffffff" },
  elements: [
    { id: "title", type: "text", text: "Paint, effects, image crop, clip and mask", x: 480, y: 52, align: "center", valign: "middle", fontSize: 30, weight: 800, fill: "#111827" },
    {
      id: "gradient_card",
      type: "rect",
      x: 90,
      y: 130,
      width: 250,
      height: 260,
      radius: 24,
      fill: { type: "linearGradient", from: [90, 130], to: [340, 390], stops: [[0, "#dbeafe"], [1, "#a7f3d0"]] },
      stroke: "#2563eb",
      strokeWidth: 3,
      effects: { shadow: { dx: 0, dy: 14, blur: 24, color: "#64748b", opacity: 0.28 } }
    },
    { id: "pattern_circle", type: "circle", cx: 490, cy: 260, radius: 120, fill: { type: "pattern", src: tile, width: 48, height: 48, fit: "cover" }, stroke: "#1d4ed8", strokeWidth: 4 },
    {
      id: "cropped_image",
      type: "image",
      src: photo,
      x: 650,
      y: 140,
      width: 220,
      height: 220,
      fit: "cover",
      source: { x: 130, y: 40, width: 250, height: 220, imageWidth: 500, imageHeight: 320 },
      mask: { type: "circle", cx: 760, cy: 250, radius: 108 }
    },
    { id: "caption", type: "text", lines: ["Everything here is", "still primitive JSON"], x: 480, y: 445, align: "center", valign: "middle", fontSize: 24, lineHeight: 1.25, weight: 800, fill: "#0f172a" }
  ]
};

saveVisual("04-effects-image-mask-2d", doc);
