const fs = require("node:fs");
const path = require("node:path");

const { applyPresetFragments, effects, motions, scenes, shapes, transitions } = require("../dist/src/presets");

const outputPath = path.join(__dirname, "presets-demo.visual.json");

const doc = {
  version: 1,
  canvas: { width: 960, height: 540, background: "#f8fafc", duration: 3, fps: 30 },
  elements: []
};

const visual = applyPresetFragments(doc, [
  scenes.gridBackground({ id: "bg.grid", x: 0, y: 0, width: 960, height: 540, step: 40 }),
  scenes.titleCard({ id: "hero.card", x: 80, y: 56, width: 360, height: 180, title: "Presets", subtitle: "compile to kernel" }),
  shapes.roundedRect({ id: "cta.panel", x: 560, y: 78, width: 260, height: 96, radius: 18, fill: "#ffffff", stroke: "#2563eb", strokeWidth: 3 }),
  shapes.star({ id: "hero.star", cx: 690, cy: 280, outerRadius: 54, fill: "#fde68a", stroke: "#92400e", strokeWidth: 3 }),
  shapes.arrow({ id: "flow.arrow", from: [455, 150], to: [555, 126], stroke: "#0f172a", strokeWidth: 4 }),
  shapes.speechBubble({ id: "note.bubble", x: 520, y: 350, width: 300, height: 92, text: "No preset fields in JSON", fill: "#ffffff", stroke: "#94a3b8" }),
  effects.dropShadow({ id: "hero.card", dy: 12, blur: 24, opacity: 0.2 }),
  effects.glow({ id: "hero.star", color: "#f59e0b", blur: 18, opacity: 0.4 }),
  motions.riseIn({ id: "hero.card", from: [80, 92], to: [80, 56], start: 0, duration: 0.55 }),
  motions.fadeIn({ id: "cta.panel", start: 0.25, duration: 0.4 }),
  motions.pulse({ id: "hero.star", start: 0.8, duration: 1.1, amount: 0.12 }),
  transitions.irisIn({ id: "note.bubble", x: 520, y: 350, width: 300, height: 92, start: 0.45, duration: 0.7 })
]);

fs.writeFileSync(outputPath, JSON.stringify(visual, null, 2));
console.log(`Wrote ${outputPath}`);
