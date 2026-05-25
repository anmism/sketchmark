#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const core = require("../dist/src");

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "-h" || command === "--help") {
    usage();
    return;
  }
  if (command === "render") {
    await render(args);
    return;
  }
  if (command === "preview") {
    await preview(args);
    return;
  }
  if (command === "edit") {
    await edit(args);
    return;
  }
  if (command === "lint") {
    lint(args);
    return;
  }
  throw new Error(`Unknown command '${command}'.`);
}

function usage() {
  console.log(`Sketchmark render-kernel CLI

Usage:
  sketchmark render <input.visual.json> <output.svg|html|mp4|webm> [--time 1.2] [--transparent]
  sketchmark render <input.visual.json> <output.mp4|webm> [--duration 5] [--fps 30]
  sketchmark preview <input.visual.json> [--port 4177] [--no-open]
  sketchmark edit <input.visual.json> [--port 4179] [--no-open]
  sketchmark lint <input.visual.json> [--json]
`);
}

async function render(args) {
  const input = args[0];
  const output = args[1];
  if (!input || !output) throw new Error("render requires input and output paths.");
  const inputPath = path.resolve(input);
  const outputPath = path.resolve(output);
  const doc = loadDocument(inputPath);
  const format = inferFormat(outputPath);
  const options = {
    time: numberOption(args, "--time", 0),
    transparent: args.includes("--transparent")
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (format === "svg") {
    fs.writeFileSync(outputPath, core.renderToSvg(doc, options), "utf8");
  } else if (format === "html") {
    fs.writeFileSync(outputPath, core.renderToHtml(doc, options), "utf8");
  } else {
    await renderVideo(doc, outputPath, format, {
      duration: numberOption(args, "--duration", undefined),
      fps: numberOption(args, "--fps", undefined),
      transparent: options.transparent
    });
  }
  console.log(`Rendered ${format.toUpperCase()}: ${outputPath}`);
}

async function preview(args) {
  await edit(args, { defaultPort: 4177, label: "Preview" });
}

async function edit(args, options = {}) {
  const input = args[0];
  if (!input) throw new Error(`${(options.label || "edit").toLowerCase()} requires an input JSON file.`);
  const inputPath = path.resolve(input);
  loadDocument(inputPath);
  const port = Math.round(numberOption(args, "--port", options.defaultPort ?? 4179));
  if (!Number.isFinite(port) || port <= 0) throw new Error(`${(options.label || "edit").toLowerCase()} --port must be a positive number.`);

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      if (request.method === "GET" && url.pathname === "/") {
        send(response, 200, "text/html; charset=utf-8", editorHtml(path.basename(inputPath)));
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/document") {
        const doc = loadDocument(inputPath);
        sendJson(response, 200, editorDocumentPayload(doc));
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/frame") {
        const doc = loadDocument(inputPath);
        const duration = Number(doc.canvas.duration ?? 0);
        const time = clamp(Number(url.searchParams.get("time") || 0), 0, Math.max(duration, 0));
        const resolved = core.resolveVisualFrame(doc, time);
        sendJson(response, 200, { ok: true, svg: core.renderResolvedSvg(resolved), resolved, duration, fps: visualFps(doc), canvas: doc.canvas });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/property") {
        const payload = await readJson(request);
        const doc = core.setElementProperty(loadDocument(inputPath), requiredString(payload.id, "id"), requiredString(payload.property, "property"), normalizeMotionValue(payload.value));
        saveDocument(inputPath, doc);
        sendJson(response, 200, editorDocumentPayload(doc));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/keyframe") {
        const payload = await readJson(request);
        const curve = curveFromPayload(payload);
        const doc = core.setTimelineKeyframe(
          loadDocument(inputPath),
          requiredString(payload.id, "id"),
          requiredString(payload.property, "property"),
          requiredNumber(payload.time, "time"),
          normalizeMotionValue(payload.value),
          curve ? { out: curve } : {}
        );
        saveDocument(inputPath, doc);
        sendJson(response, 200, editorDocumentPayload(doc));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/remove-keyframe") {
        const payload = await readJson(request);
        const doc = core.removeTimelineKeyframe(loadDocument(inputPath), requiredString(payload.id, "id"), requiredString(payload.property, "property"), requiredNumber(payload.time, "time"));
        saveDocument(inputPath, doc);
        sendJson(response, 200, editorDocumentPayload(doc));
        return;
      }
      send(response, 404, "text/plain; charset=utf-8", "Not found");
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error?.message || String(error) });
    }
  });

  await listen(server, port);
  const url = `http://localhost:${port}/`;
  console.log(`${options.label || "Editor"}: ${url}`);
  if (!args.includes("--no-open")) openBrowser(url);
}

function lint(args) {
  const input = args[0];
  if (!input) throw new Error("lint requires an input JSON file.");
  const doc = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
  const validation = core.validateVisualDocument(doc);
  const diagnostics = validation.ok ? core.lintVisualDocument(doc) : { warnings: [] };
  const payload = {
    ok: validation.ok && diagnostics.warnings.length === 0,
    issues: validation.issues,
    warnings: [...validation.warnings, ...diagnostics.warnings]
  };
  if (args.includes("--json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  for (const issue of payload.issues) console.error(`Issue ${issue.path}: ${issue.message}${issue.suggestion ? ` ${issue.suggestion}` : ""}`);
  for (const warning of payload.warnings) console.warn(`Warning ${warning.path}: ${warning.message}${warning.suggestion ? ` ${warning.suggestion}` : ""}`);
  if (payload.issues.length) process.exitCode = 1;
  if (!payload.issues.length && !payload.warnings.length) console.log("No issues or warnings.");
}

function loadDocument(inputPath) {
  const doc = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const result = core.validateVisualDocument(doc);
  for (const warning of result.warnings) console.warn(`Warning ${warning.path}: ${warning.message}${warning.suggestion ? ` ${warning.suggestion}` : ""}`);
  if (!result.ok) {
    const first = result.issues[0];
    throw new Error(first ? `${first.path}: ${first.message}` : "Invalid visual document.");
  }
  return doc;
}

function saveDocument(inputPath, document) {
  const result = core.validateVisualDocument(document);
  if (!result.ok) {
    const first = result.issues[0];
    throw new Error(first ? `${first.path}: ${first.message}` : "Invalid visual document.");
  }
  fs.writeFileSync(inputPath, JSON.stringify(document, null, 2) + "\n", "utf8");
}

function inferFormat(outputPath) {
  const ext = path.extname(outputPath).toLowerCase().replace(".", "");
  if (ext === "svg" || ext === "html" || ext === "mp4" || ext === "webm") return ext;
  throw new Error(`Cannot infer kernel output format from '${outputPath}'. Use .svg, .html, .mp4, or .webm.`);
}

async function renderVideo(document, outputPath, format, options) {
  if (format === "mp4" && options.transparent) {
    throw new Error("MP4 does not support alpha in this exporter. Use .webm for transparent video.");
  }
  const sharp = loadSharp();
  const ffmpeg = findExecutable("ffmpeg");
  const duration = visualDuration(document, options.duration);
  const fps = visualFps(document, options.fps);
  const frameCount = Math.max(1, Math.ceil(duration * fps));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketchmark-kernel-video-"));
  try {
    for (let frame = 0; frame < frameCount; frame += 1) {
      const time = Math.min(duration, frame / fps);
      const svg = core.renderToSvg(document, { time, transparent: options.transparent });
      const framePath = path.join(tempDir, `frame-${String(frame + 1).padStart(5, "0")}.png`);
      await sharp(Buffer.from(svg)).png().toFile(framePath);
    }
    const pattern = path.join(tempDir, "frame-%05d.png");
    const args = format === "mp4"
      ? ["-y", "-framerate", String(fps), "-i", pattern, "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath]
      : ["-y", "-framerate", String(fps), "-i", pattern, "-c:v", "libvpx-vp9", "-pix_fmt", options.transparent ? "yuva420p" : "yuv420p", outputPath];
    const result = spawnSync(ffmpeg, args, { stdio: "pipe" });
    if (result.status !== 0) {
      const stderr = result.stderr?.toString("utf8").trim();
      throw new Error(stderr ? `ffmpeg failed: ${stderr}` : "ffmpeg failed.");
    }
  } finally {
    safeRemoveDirectory(tempDir);
  }
}

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    const pnpmRoot = path.resolve(__dirname, "..", "..", "node_modules", ".pnpm");
    if (fs.existsSync(pnpmRoot)) {
      for (const entry of fs.readdirSync(pnpmRoot)) {
        const candidate = path.join(pnpmRoot, entry, "node_modules", "sharp");
        if (entry.startsWith("sharp@") && fs.existsSync(candidate)) return require(candidate);
      }
    }
  }
  throw new Error("Video export requires the optional 'sharp' package to rasterize SVG frames.");
}

function findExecutable(name) {
  const check = process.platform === "win32" ? `${name}.exe` : name;
  const result = spawnSync(check, ["-version"], { stdio: "ignore" });
  if (!result.error) return check;
  throw new Error(`Video export requires '${name}' to be available on PATH.`);
}

function visualDuration(document, override) {
  const value = Number(override ?? document.canvas.duration ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Video export and preview require a positive canvas.duration or --duration value.");
  }
  return value;
}

function visualFps(document, override) {
  const value = Number(override ?? document.canvas.fps ?? 30);
  if (!Number.isFinite(value) || value <= 0) throw new Error("FPS must be a positive number.");
  return Math.round(value);
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function send(response, status, type, body) {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  response.end(body);
}

function sendJson(response, status, payload) {
  send(response, status, "application/json; charset=utf-8", JSON.stringify(payload));
}

function editorDocumentPayload(document) {
  return {
    ok: true,
    document,
    elements: core.listElementReferences(document),
    canvas: document.canvas,
    duration: Number(document.canvas.duration ?? 0),
    fps: visualFps(document)
  };
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be JSON."));
      }
    });
    request.on("error", reject);
  });
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value) throw new Error(`${name} must be a non-empty string.`);
  return value;
}

function requiredNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a finite number.`);
  return number;
}

function normalizeMotionValue(value) {
  if (Array.isArray(value) && value.length === 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) return [Number(value[0]), Number(value[1])];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  throw new Error("value must be a number, string, or [x,y].");
}

function curveFromPayload(payload) {
  if (payload.curve && typeof payload.curve === "object") return payload.curve;
  if (typeof payload.curvePreset === "string") return core.timelineCurvePreset(payload.curvePreset);
  return undefined;
}

function editorHtml(title) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sketchmark Editor - ${escapeHtml(title)}</title><style>
html,body{margin:0;width:100%;height:100%;font:13px Arial,sans-serif;background:#c0c0c0;color:#000}
body{display:grid;grid-template-columns:240px 1fr 300px;grid-template-rows:1fr 165px;min-width:900px}
button,input,select{font:13px Arial,sans-serif}
button{padding:3px 8px}
input,select{box-sizing:border-box;width:100%}
#tree,#inspector,#timeline{background:#eee;border:2px inset #ddd;overflow:auto;padding:8px}
#tree{grid-row:1/3}
#stageWrap{display:grid;place-items:center;min-width:0;min-height:0;padding:8px;background:#999}
#stage svg{max-width:100%;max-height:calc(100vh - 190px);background:white;border:1px solid #333;overflow:visible}
#timeline{grid-column:2/4}
.row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0}
.stack{display:grid;gap:5px}.section{margin:0 0 10px}.label{display:block;font-weight:bold;margin:0 0 3px}
.treeBtn{display:block;width:100%;text-align:left;margin:1px 0;border:1px solid transparent;background:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.treeBtn.selected{background:#003399;color:white}.muted{color:#555}.track{border:1px solid #888;background:#ddd;padding:5px;margin:4px 0}
.kf{display:inline-block;margin:3px;padding:2px 4px;background:#eee;border:1px solid #999}.kf button{padding:0 4px;margin-left:4px}
#error{color:#900;min-height:18px;margin-top:6px}.tiny{font-size:11px;color:#444}.toolbar{display:grid;grid-template-columns:auto 1fr auto auto;gap:6px;align-items:center}
</style></head><body><aside id="tree"></aside><main id="stageWrap"><div id="stage"></div></main><aside id="inspector"></aside><section id="timeline"></section><script>
const tree = document.getElementById("tree");
const stageWrap = document.getElementById("stageWrap");
const stage = document.getElementById("stage");
const inspector = document.getElementById("inspector");
const timeline = document.getElementById("timeline");
let doc = null;
let refs = [];
let selectedId = "";
let currentTime = 0;
let playing = false;
let lastTick = 0;
let playHandle = 0;
let resolvedDoc = null;
let drawScheduled = false;
let drawInFlight = false;
let drawQueued = false;
let drag = null;
let suppressClick = false;

async function api(path, options) {
  const response = await fetch(path, options || { cache: "no-store" });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function load() {
  const data = await api("/api/document");
  doc = data.document;
  refs = data.elements;
  if (!selectedId && refs[0]) selectedId = refs[0].id;
  renderTree();
  renderInspector();
  renderTimeline();
  requestDraw();
}

async function draw() {
  if (drawInFlight) {
    drawQueued = true;
    return;
  }
  drawInFlight = true;
  const time = currentTime;
  try {
    const data = await api("/api/frame?time=" + encodeURIComponent(time));
    resolvedDoc = data.resolved || null;
    stage.innerHTML = data.svg;
    const svg = stage.querySelector("svg");
    if (svg) svg.style.overflow = "visible";
    const selected = selectedId ? stage.querySelector("#" + cssId(selectedId)) : null;
    if (selected) {
      selected.style.outline = "2px solid red";
      selected.style.filter = "drop-shadow(0 0 3px red)";
      drawHandles(selected);
      syncInspectorValues();
    }
  } finally {
    drawInFlight = false;
    if (drawQueued) {
      drawQueued = false;
      requestDraw();
    }
  }
}

function requestDraw() {
  if (drawInFlight) {
    drawQueued = true;
    return;
  }
  if (drawScheduled) return;
  drawScheduled = true;
  requestAnimationFrame(() => {
    drawScheduled = false;
    draw().catch(showError);
  });
}

function renderTree() {
  tree.innerHTML = "<div class='section'><span class='label'>Elements</span></div>";
  for (const ref of refs) {
    const button = document.createElement("button");
    button.className = "treeBtn" + (ref.id === selectedId ? " selected" : "");
    button.style.paddingLeft = 8 + ref.depth * 16 + "px";
    button.textContent = ref.id + "  " + ref.type;
    button.onclick = () => select(ref.id);
    tree.appendChild(button);
  }
}

function select(id, options) {
  selectedId = id;
  renderTree();
  renderInspector();
  renderTimeline();
  if (options && options.draw === false) {
    refreshHandles();
  } else {
    requestDraw();
  }
}

function deselect() {
  if (!selectedId) return;
  selectedId = "";
  clearHandles();
  renderTree();
  renderInspector();
  renderTimeline();
  requestDraw();
}

function renderInspector() {
  const element = findElement(selectedId);
  if (!element) {
    inspector.innerHTML = "<div class='muted'>Select an element.</div>";
    return;
  }
  const displayElement = findResolvedElement(selectedId) || element;
  const supportsPosition = ["path","point","text","image","group"].includes(element.type);
  inspector.innerHTML =
    "<div class='section'><span class='label'>Selected</span><strong>" + escapeText(element.id || "") + "</strong><div class='muted'>" + escapeText(element.type) + "</div><div id='error'></div></div>" +
    "<div class='section'><span class='label'>Base Properties</span>" +
    "<div class='row'><label>X<input id='propX' type='number' step='1' value='" + valueOr(displayElement.x, 0) + "' " + (supportsPosition ? "" : "disabled") + "></label><label>Y<input id='propY' type='number' step='1' value='" + valueOr(displayElement.y, 0) + "' " + (supportsPosition ? "" : "disabled") + "></label></div>" +
    "<div class='row'><label>Rotation<input id='propRotation' type='number' step='1' value='" + valueOr(displayElement.rotation, 0) + "'></label><label>Scale<input id='propScale' type='number' step='0.05' value='" + valueOr(displayElement.scale, 1) + "'></label></div>" +
    "<div class='row'><button id='rotMinus'>Rot -5</button><button id='rotPlus'>Rot +5</button></div><div class='row'><button id='scaleMinus'>Scale -</button><button id='scalePlus'>Scale +</button></div>" +
    "<div class='row'><label>Opacity<input id='propOpacity' type='number' min='0' max='1' step='0.05' value='" + valueOr(displayElement.opacity, 1) + "'></label><button id='applyBase'>Apply Base</button></div></div>" +
    "<div class='section'><span class='label'>Keyframe</span><div class='row'><label>Time<input id='kfTime' type='number' step='0.05' value='" + currentTime.toFixed(2) + "'></label><label>Curve<select id='curve'><option value='linear'>linear</option><option value='ease-in'>ease-in</option><option value='ease-out'>ease-out</option><option value='ease-in-out'>ease-in-out</option><option value='hold'>hold</option></select></label></div>" +
    "<div class='stack'><button id='kfPosition' " + (supportsPosition ? "" : "disabled") + ">Set Position Keyframe</button><button id='kfRotation'>Set Rotation Keyframe</button><button id='kfScale'>Set Scale Keyframe</button><button id='kfOpacity'>Set Opacity Keyframe</button></div><p class='tiny'>Drag to move. Use the square to scale and the round handle to rotate.</p></div>";
  document.getElementById("applyBase").onclick = applyBase;
  document.getElementById("rotMinus").onclick = () => nudge("propRotation", -5);
  document.getElementById("rotPlus").onclick = () => nudge("propRotation", 5);
  document.getElementById("scaleMinus").onclick = () => nudge("propScale", -0.1);
  document.getElementById("scalePlus").onclick = () => nudge("propScale", 0.1);
  document.getElementById("kfPosition").onclick = () => keyframe("position", [num("propX"), num("propY")]);
  document.getElementById("kfRotation").onclick = () => keyframe("rotation", num("propRotation"));
  document.getElementById("kfScale").onclick = () => keyframe("scale", num("propScale"));
  document.getElementById("kfOpacity").onclick = () => keyframe("opacity", num("propOpacity"));
}

function renderTimeline() {
  const element = findElement(selectedId);
  const tracks = element && element.timeline && element.timeline.tracks ? element.timeline.tracks : {};
  timeline.innerHTML = "<div class='toolbar'><button id='play'>" + (playing ? "Pause" : "Play") + "</button><input id='scrub' type='range' min='0' max='" + Math.max(Number(doc.canvas.duration || 0), 0.01) + "' step='0.005' value='" + currentTime + "'><strong id='timeLabel'>" + currentTime.toFixed(2) + "s</strong><button id='refresh'>Refresh</button></div>";
  document.getElementById("play").onclick = togglePlay;
  document.getElementById("refresh").onclick = load;
  document.getElementById("scrub").oninput = (event) => {
    currentTime = Number(event.target.value || 0);
    document.getElementById("timeLabel").textContent = currentTime.toFixed(2) + "s";
    const kfTime = document.getElementById("kfTime");
    if (kfTime) kfTime.value = currentTime.toFixed(2);
    requestDraw();
  };
  for (const property of Object.keys(tracks)) {
    const track = tracks[property];
    const box = document.createElement("div");
    box.className = "track";
    box.innerHTML = "<strong>" + escapeText(property) + "</strong> ";
    for (const frame of track.keyframes || []) {
      const time = Array.isArray(frame) ? frame[0] : frame.time;
      const value = Array.isArray(frame) ? frame[1] : frame.value;
      const chip = document.createElement("span");
      chip.className = "kf";
      chip.textContent = Number(time).toFixed(2) + "s " + formatMotionValue(value);
      const remove = document.createElement("button");
      remove.textContent = "x";
      remove.onclick = () => removeKeyframe(property, time);
      chip.appendChild(remove);
      box.appendChild(chip);
    }
    timeline.appendChild(box);
  }
}

async function applyBase() {
  try {
    const element = findElement(selectedId);
    const x = num("propX");
    const y = num("propY");
    const rotation = num("propRotation");
    const scale = num("propScale");
    const opacity = num("propOpacity");
    if (supportsPosition(element)) await mutate("/api/property", { id: selectedId, property: "position", value: [x, y] });
    await mutate("/api/property", { id: selectedId, property: "rotation", value: rotation });
    await mutate("/api/property", { id: selectedId, property: "scale", value: scale });
    await mutate("/api/property", { id: selectedId, property: "opacity", value: opacity });
  } catch (error) {
    showError(error);
  }
}

async function keyframe(property, value) {
  try {
    await mutate("/api/keyframe", { id: selectedId, property, value, time: Number(document.getElementById("kfTime").value || 0), curvePreset: document.getElementById("curve").value });
  } catch (error) {
    showError(error);
  }
}

async function removeKeyframe(property, time) {
  try {
    await mutate("/api/remove-keyframe", { id: selectedId, property, time });
  } catch (error) {
    showError(error);
  }
}

async function mutate(path, body) {
  const data = await api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  doc = data.document;
  refs = data.elements;
  renderTree();
  renderInspector();
  renderTimeline();
  requestDraw();
}

stage.addEventListener("click", (event) => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (event.target.closest("[data-handle]")) return;
  const selected = selectedTarget();
  const selectedElement = findElement(selectedId);
  if (selected && selectedElement && selectedElement.type === "group" && selected.contains(event.target)) return;
  const target = event.target.closest("[id]");
  if (target && findElement(target.id)) select(target.id);
  else deselect();
});

stageWrap.addEventListener("click", (event) => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (event.target === stageWrap) deselect();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  drag = null;
  suppressClick = false;
  deselect();
});

stage.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-handle]");
  if (handle && selectedId) {
    const selected = selectedTarget();
    if (selected) startDrag(event, selected, handle.getAttribute("data-handle"));
    return;
  }
  const selected = selectedTarget();
  const selectedElement = findElement(selectedId);
  const target = selected && selectedElement && selectedElement.type === "group" && selected.contains(event.target)
    ? selected
    : event.target.closest("[id]");
  if (!target || !findElement(target.id)) return;
  select(target.id, { draw: false });
  const element = findElement(target.id);
  const mode = event.shiftKey ? "rotate" : event.ctrlKey ? "scale" : "move";
  if (mode === "move" && !supportsPosition(element)) return;
  startDrag(event, target, mode);
});

stage.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const point = parentPoint(event, drag.target);
  const dx = point.x - drag.start.x;
  const dy = point.y - drag.start.y;
  drag.changed = drag.changed || Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25;
  let x = drag.x;
  let y = drag.y;
  let rotation = drag.rotation;
  let scale = drag.scale;
  if (drag.mode === "move") {
    x = Math.round(drag.x + dx);
    y = Math.round(drag.y + dy);
    setInput("propX", x);
    setInput("propY", y);
    previewDraggedTransform("translate(" + dx + " " + dy + ")");
  } else if (drag.mode === "rotate") {
    const delta = angleAround(drag.center, point) - angleAround(drag.center, drag.start);
    drag.changed = drag.changed || Math.abs(delta) > 0.25;
    rotation = Math.round((drag.rotation + delta) * 100) / 100;
    setInput("propRotation", rotation);
    previewDraggedTransform("rotate(" + delta + " " + drag.center.x + " " + drag.center.y + ")");
  } else {
    const startDistance = Math.max(distance(drag.center, drag.start), 1);
    const nextDistance = Math.max(distance(drag.center, point), 1);
    const ratio = Math.max(0.05, nextDistance / startDistance);
    drag.changed = drag.changed || Math.abs(ratio - 1) > 0.005;
    scale = Math.max(0.05, Math.round((drag.scale * ratio) * 100) / 100);
    setInput("propScale", scale);
    previewDraggedTransform("translate(" + drag.center.x + " " + drag.center.y + ") scale(" + ratio + ") translate(" + (-drag.center.x) + " " + (-drag.center.y) + ")");
  }
  drag.value = { x, y, rotation, scale };
  refreshHandles();
});

stage.addEventListener("pointerup", finishDrag);
stage.addEventListener("pointercancel", finishDrag);

async function finishDrag() {
  if (!drag) return;
  const snapshot = drag;
  drag = null;
  if (snapshot.changed) {
    suppressClick = true;
    await commitDrag(snapshot);
  }
}

function startDrag(event, target, mode) {
  const element = findElement(target.id);
  if (!element) return;
  const resolved = findResolvedElement(target.id) || element;
  drag = {
    id: target.id,
    target,
    mode,
    start: parentPoint(event, target),
    center: targetCenterInParent(target),
    x: Number(resolved.x ?? element.x ?? 0),
    y: Number(resolved.y ?? element.y ?? 0),
    rotation: Number(resolved.rotation ?? element.rotation ?? 0),
    scale: Number(resolved.scale ?? element.scale ?? 1),
    transform: target.getAttribute("transform") || "",
    changed: false,
    value: null
  };
  event.preventDefault();
  event.stopPropagation();
  stage.setPointerCapture?.(event.pointerId);
}

async function commitDrag(snapshot) {
  const element = findElement(snapshot.id);
  if (!element || !snapshot.value) return;
  if (snapshot.mode === "move") {
    await commitEditedProperty(element, "position", [snapshot.value.x, snapshot.value.y]);
  } else if (snapshot.mode === "rotate") {
    await commitEditedProperty(element, "rotation", snapshot.value.rotation);
  } else if (snapshot.mode === "scale") {
    await commitEditedProperty(element, "scale", snapshot.value.scale);
  }
}

async function commitEditedProperty(element, property, value) {
  const curve = document.getElementById("curve");
  await mutate("/api/keyframe", { id: element.id, property, value, time: currentTime, curvePreset: curve ? curve.value : "linear" });
}

function findElement(id, elements) {
  for (const element of elements || doc.elements || []) {
    if (element.id === id) return element;
    if (element.type === "group") {
      const found = findElement(id, element.children);
      if (found) return found;
    }
  }
}
function findResolvedElement(id, elements) {
  if (!resolvedDoc) return undefined;
  for (const element of elements || resolvedDoc.elements || []) {
    if (element.id === id) return element;
    if (element.type === "group") {
      const found = findResolvedElement(id, element.children);
      if (found) return found;
    }
  }
}
function togglePlay() {
  playing = !playing;
  const button = document.getElementById("play");
  if (button) button.textContent = playing ? "Pause" : "Play";
  if (playing) {
    lastTick = performance.now();
    if (playHandle) cancelAnimationFrame(playHandle);
    playHandle = requestAnimationFrame(playTick);
  } else if (playHandle) {
    cancelAnimationFrame(playHandle);
    playHandle = 0;
  }
}
function playTick(now) {
  if (!playing) {
    playHandle = 0;
    return;
  }
  const duration = Math.max(Number(doc.canvas.duration || 0), 0.01);
  currentTime = (currentTime + Math.max(0, now - lastTick) / 1000) % duration;
  lastTick = now;
  const scrub = document.getElementById("scrub");
  const label = document.getElementById("timeLabel");
  if (scrub) scrub.value = currentTime;
  if (label) label.textContent = currentTime.toFixed(2) + "s";
  const kfTime = document.getElementById("kfTime");
  if (kfTime) kfTime.value = currentTime.toFixed(2);
  requestDraw();
  playHandle = requestAnimationFrame(playTick);
}
function svgPoint(event) {
  const svg = stage.querySelector("svg");
  if (!svg) return { x: 0, y: 0 };
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}
function parentPoint(event, target) {
  const svg = stage.querySelector("svg");
  if (!svg || !target) return { x: 0, y: 0 };
  const parent = target.parentNode && target.parentNode.getScreenCTM ? target.parentNode : svg;
  const matrix = parent.getScreenCTM();
  if (!matrix) return svgPoint(event);
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(matrix.inverse());
}
function previewDraggedTransform(prefix) {
  if (!drag || !drag.target) return;
  drag.target.setAttribute("transform", prefix + (drag.transform ? " " + drag.transform : ""));
}
function selectedTarget() {
  return selectedId ? stage.querySelector("#" + cssId(selectedId)) : null;
}
function refreshHandles() {
  const target = selectedTarget();
  if (target) drawHandles(target);
  else clearHandles();
}
function clearHandles() {
  const svg = stage.querySelector("svg");
  const handles = svg ? svg.querySelector("#__sketchmark_handles") : null;
  if (handles) handles.remove();
}
function drawHandles(target) {
  const svg = target.ownerSVGElement;
  if (!svg || !target.getBBox || !target.getCTM) return;
  const old = svg.querySelector("#__sketchmark_handles");
  if (old) old.remove();
  let box;
  let matrix;
  try {
    box = target.getBBox();
    matrix = target.getCTM();
  } catch {
    return;
  }
  if (!matrix) return;
  const center = matrixPoint(svg, matrix, box.x + box.width / 2, box.y + box.height / 2);
  const rotate = matrixPoint(svg, matrix, box.x + box.width / 2, box.y - 32);
  const scale = matrixPoint(svg, matrix, box.x + box.width, box.y + box.height);
  const group = svgNode("g");
  group.setAttribute("id", "__sketchmark_handles");
  group.setAttribute("style", "pointer-events:all");
  const stem = svgNode("line");
  stem.setAttribute("x1", center.x);
  stem.setAttribute("y1", center.y);
  stem.setAttribute("x2", rotate.x);
  stem.setAttribute("y2", rotate.y);
  stem.setAttribute("stroke", "#000");
  stem.setAttribute("stroke-width", "1");
  stem.setAttribute("stroke-dasharray", "3 3");
  const rotateHandle = svgNode("circle");
  rotateHandle.setAttribute("cx", rotate.x);
  rotateHandle.setAttribute("cy", rotate.y);
  rotateHandle.setAttribute("r", "7");
  rotateHandle.setAttribute("fill", "#ffff66");
  rotateHandle.setAttribute("stroke", "#000");
  rotateHandle.setAttribute("data-handle", "rotate");
  rotateHandle.setAttribute("style", "cursor:grab");
  const scaleHandle = svgNode("rect");
  scaleHandle.setAttribute("x", scale.x - 6);
  scaleHandle.setAttribute("y", scale.y - 6);
  scaleHandle.setAttribute("width", "12");
  scaleHandle.setAttribute("height", "12");
  scaleHandle.setAttribute("fill", "#66ffff");
  scaleHandle.setAttribute("stroke", "#000");
  scaleHandle.setAttribute("data-handle", "scale");
  scaleHandle.setAttribute("style", "cursor:nwse-resize");
  group.appendChild(stem);
  group.appendChild(rotateHandle);
  group.appendChild(scaleHandle);
  svg.appendChild(group);
}
function targetCenterInParent(target) {
  const svg = target.ownerSVGElement || stage.querySelector("svg");
  if (!svg || !target.getBBox || !target.getCTM) return { x: 0, y: 0 };
  try {
    const box = target.getBBox();
    const targetMatrix = target.getCTM();
    const parent = target.parentNode && target.parentNode.getCTM ? target.parentNode : svg;
    const parentMatrix = parent.getCTM ? parent.getCTM() : null;
    if (!targetMatrix || !parentMatrix) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    return matrixPoint(svg, parentMatrix.inverse().multiply(targetMatrix), box.x + box.width / 2, box.y + box.height / 2);
  } catch {
    return { x: 0, y: 0 };
  }
}
function matrixPoint(svg, matrix, x, y) {
  const point = svg.createSVGPoint();
  point.x = x;
  point.y = y;
  return point.matrixTransform(matrix);
}
function svgNode(name) {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}
function angleAround(center, point) {
  return Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI;
}
function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function supportsPosition(element) {
  return element && ["path","point","text","image","group"].includes(element.type);
}
function nudge(id, delta) {
  setInput(id, Math.round((num(id) + delta) * 100) / 100);
}
function setInput(id, value) {
  const input = document.getElementById(id);
  if (input) input.value = value;
}
function syncInspectorValues() {
  if (drag || !selectedId) return;
  const active = document.activeElement;
  if (active && active.closest && active.closest("#inspector")) return;
  const element = findResolvedElement(selectedId) || findElement(selectedId);
  if (!element) return;
  setInput("propX", valueOr(element.x, 0));
  setInput("propY", valueOr(element.y, 0));
  setInput("propRotation", valueOr(element.rotation, 0));
  setInput("propScale", valueOr(element.scale, 1));
  setInput("propOpacity", valueOr(element.opacity, 1));
}
function num(id) { return Number(document.getElementById(id).value || 0); }
function valueOr(value, fallback) { return value === undefined ? fallback : value; }
function formatMotionValue(value) {
  if (Array.isArray(value)) return "[" + value.map((item) => Number(item).toFixed(0)).join(",") + "]";
  if (typeof value === "number") return Number(value).toFixed(2).replace(/\\.00$/, "");
  if (value === undefined) return "";
  return String(value);
}
function cssId(id) { return String(id).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\\\\]^\\\`{|}~])/g, "\\\\$1"); }
function escapeText(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function showError(error) { const box = document.getElementById("error"); if (box) box.textContent = error.message || String(error); }
load().catch(showError);
</script></body></html>`;
}

function previewHtml(title) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sketchmark Preview - ${escapeHtml(title)}</title><style>
html,body{margin:0;width:100%;height:100%;background:#0f172a;color:#e2e8f0;font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}
body{display:grid;grid-template-rows:1fr auto}
#stage{display:grid;place-items:center;min-height:0;padding:24px}
#stage svg{max-width:100%;max-height:100%;box-shadow:0 24px 80px rgba(0,0,0,.35)}
#controls{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:14px 18px;background:#111827;border-top:1px solid rgba(255,255,255,.08)}
button{width:42px;height:34px;border:1px solid rgba(255,255,255,.18);border-radius:6px;background:#f8fafc;color:#0f172a;font-weight:800;cursor:pointer}
input{width:100%;accent-color:#38bdf8}
#clock{font-variant-numeric:tabular-nums;min-width:110px;text-align:right;color:#cbd5e1}
#error{position:absolute;left:16px;top:16px;right:16px;color:#fecaca}
</style></head><body><div id="stage"><div id="error"></div></div><div id="controls"><button id="play" aria-label="Play">Play</button><input id="time" type="range" min="0" max="1" step="0.001" value="0"><div id="clock">0.00 / 0.00</div></div><script>
const stage = document.getElementById("stage");
const errorBox = document.getElementById("error");
const play = document.getElementById("play");
const slider = document.getElementById("time");
const clock = document.getElementById("clock");
let duration = 0;
let current = 0;
let playing = false;
let last = 0;
async function frame(time) {
  const response = await fetch("/api/frame?time=" + encodeURIComponent(time), { cache: "no-store" });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Preview failed.");
  duration = Number(data.duration || 0);
  stage.innerHTML = data.svg + "<div id=\\"error\\"></div>";
  slider.max = String(Math.max(duration, 0.001));
  slider.value = String(time);
  clock.textContent = time.toFixed(2) + " / " + duration.toFixed(2);
}
async function draw(time) {
  try {
    errorBox.textContent = "";
    await frame(time);
  } catch (error) {
    const box = document.getElementById("error") || errorBox;
    box.textContent = error.message || String(error);
  }
}
function tick(now) {
  if (!playing) return;
  if (!last) last = now;
  current += (now - last) / 1000;
  last = now;
  if (duration > 0) current = current % duration;
  draw(current);
  requestAnimationFrame(tick);
}
play.addEventListener("click", () => {
  playing = !playing;
  play.textContent = playing ? "Pause" : "Play";
  last = 0;
  if (playing) requestAnimationFrame(tick);
});
slider.addEventListener("input", () => {
  current = Number(slider.value || 0);
  draw(current);
});
draw(0);
</script></body></html>`;
}

function openBrowser(url) {
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

function safeRemoveDirectory(directory) {
  const root = os.tmpdir();
  const resolved = path.resolve(directory);
  if (resolved.startsWith(path.resolve(root))) fs.rmSync(resolved, { recursive: true, force: true });
}

function numberOption(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
