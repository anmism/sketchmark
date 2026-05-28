const fs = require("fs");
const path = require("path");

const width = 1080;
const height = 1350;
const bg = "#f3f5f7";

const elements = [
  {
    id: "card",
    type: "path",
    d: roundedRect(56, 56, 968, 1238, 34),
    fill: "#ffffff",
    stroke: "#e2e8f0",
    strokeWidth: 1.2,
    effects: {
      shadow: { dx: 0, dy: 18, blur: 44, color: "#94a3b8", opacity: 0.16 }
    }
  },
  {
    id: "photo",
    type: "image",
    src: "./oldman.jpg",
    x: 96,
    y: 96,
    width: 888,
    height: 1158,
    fit: "cover",
    cornerRadius: 26
  }
];

const doc = {
  version: 1,
  canvas: { width, height, background: bg },
  elements
};

const outPath = path.join(__dirname, "oldman-simple.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);

function roundedRect(x, y, w, h, r) {
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z"
  ].join(" ");
}
