const fs = require("node:fs");
const path = require("node:path");

const { applyPresetFragments, characters, effects, motions, scenes, shapes } = require("../dist/src/presets");

const outputPath = path.join(__dirname, "preset-character-motion.visual.json");

const doc = {
  version: 1,
  canvas: { width: 960, height: 540, background: "#f8fafc", duration: 4, fps: 30 },
  elements: []
};

const visual = applyPresetFragments(doc, [
  scenes.gridBackground({ id: "stage.grid", x: 0, y: 0, width: 960, height: 540, step: 48 }),
  shapes.line({ id: "stage.ground", from: [80, 430], to: [880, 430], stroke: "#cbd5e1", strokeWidth: 8 }),
  characters.stickPerson({ id: "hero", x: 150, y: 235, height: 190 }),
  characters.simpleDog({ id: "dog", x: 470, y: 335, width: 190, height: 100 }),
  characters.simpleSpider({ id: "spider", x: 730, y: 330, width: 130, height: 130 }),
  shapes.speechBubble({ id: "caption", x: 280, y: 84, width: 400, height: 90, text: "Characters are just kernel groups", fill: "#ffffff", stroke: "#94a3b8" }),
  effects.dropShadow({ id: "hero", dy: 8, blur: 18, opacity: 0.16 }),
  effects.dropShadow({ id: "dog", dy: 7, blur: 16, opacity: 0.14 }),
  effects.glow({ id: "spider", color: "#60a5fa", blur: 12, opacity: 0.22 }),
  motions.slideIn({ id: "hero", from: [80, 235], to: [150, 235], start: 0, duration: 0.7 }),
  motions.bob({ id: "dog", to: [470, 335], start: 0.4, duration: 1.4, distance: 12 }),
  motions.shake({ id: "spider", start: 1.1, duration: 0.8, amount: 10 }),
  motions.stagger({ ids: ["hero.head", "hero.body", "hero.leftArm", "hero.rightArm"], start: 0.1, duration: 0.35, each: 0.08 }),
  motions.fadeIn({ id: "caption", start: 0.45, duration: 0.45 })
]);

fs.writeFileSync(outputPath, JSON.stringify(visual, null, 2));
console.log(`Wrote ${outputPath}`);
