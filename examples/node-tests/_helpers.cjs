const fs = require("node:fs");
const path = require("node:path");

const core = require("../../dist/src");

const outDir = path.join(__dirname, "generated");
fs.mkdirSync(outDir, { recursive: true });

function outPath(name) {
  return path.join(outDir, name);
}

function writeJson(name, value) {
  const file = outPath(name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
  return file;
}

function writeText(name, value) {
  const file = outPath(name);
  fs.writeFileSync(file, value, "utf8");
  return file;
}

function assertValid(doc, label) {
  const result = core.validateVisualDocument(doc);
  if (!result.ok) {
    const messages = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
    throw new Error(`${label} is invalid:\n${messages}`);
  }
  return result;
}

function saveVisual(name, doc) {
  assertValid(doc, name);
  const jsonFile = writeJson(`${name}.visual.json`, doc);
  const frame = core.resolveVisualFrame(doc, Number(doc.canvas.duration || 0) / 2);
  if (frame.canvas.renderer === "three") {
    writeText(`${name}.preview.svg`, core.renderThreePreviewSvg(frame));
    writeText(`${name}.html`, core.renderToHtml(doc, { time: 0 }));
  } else {
    writeText(`${name}.svg`, core.renderToSvg(doc, { time: Number(doc.canvas.duration || 0) / 2 }));
    writeText(`${name}.html`, core.renderToHtml(doc));
  }
  console.log(`wrote ${path.relative(process.cwd(), jsonFile)}`);
}

module.exports = {
  core,
  outPath,
  writeJson,
  writeText,
  assertValid,
  saveVisual
};
