#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const core = require("../dist/src");
const { editorHtml } = require("./editor-ui.cjs");
const { previewHtml } = require("./preview-ui.cjs");

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
  await edit(args, { defaultPort: 4177, label: "Preview", readOnly: true });
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
        const pageHtml = options.readOnly ? previewHtml : editorHtml;
        send(response, 200, "text/html; charset=utf-8", pageHtml(path.basename(inputPath)));
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
      if (request.method === "POST" && url.pathname === "/api/canvas") {
        if (options.readOnly) {
          sendJson(response, 403, { ok: false, error: "Preview mode is read-only." });
          return;
        }
        const payload = await readJson(request);
        const doc = applyCanvasPatch(loadDocument(inputPath), payload);
        saveDocument(inputPath, doc);
        sendJson(response, 200, editorDocumentPayload(doc));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/property") {
        if (options.readOnly) {
          sendJson(response, 403, { ok: false, error: "Preview mode is read-only." });
          return;
        }
        const payload = await readJson(request);
        const doc = core.setElementProperty(loadDocument(inputPath), requiredString(payload.id, "id"), requiredString(payload.property, "property"), normalizeMotionValue(payload.value));
        saveDocument(inputPath, doc);
        sendJson(response, 200, editorDocumentPayload(doc));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/keyframe") {
        if (options.readOnly) {
          sendJson(response, 403, { ok: false, error: "Preview mode is read-only." });
          return;
        }
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
        if (options.readOnly) {
          sendJson(response, 403, { ok: false, error: "Preview mode is read-only." });
          return;
        }
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

function applyCanvasPatch(document, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("canvas payload must be an object.");
  }
  const next = {
    ...document,
    canvas: { ...(document.canvas || {}) }
  };
  if ("width" in payload) next.canvas.width = requiredCanvasDimension(payload.width, "width");
  if ("height" in payload) next.canvas.height = requiredCanvasDimension(payload.height, "height");
  if ("background" in payload) {
    if (payload.background === null || payload.background === "") delete next.canvas.background;
    else if (typeof payload.background === "string") next.canvas.background = payload.background;
    else throw new Error("background must be a string or null.");
  }
  if ("duration" in payload) {
    if (payload.duration === null || payload.duration === "") delete next.canvas.duration;
    else {
      const duration = Number(payload.duration);
      if (!Number.isFinite(duration) || duration < 0) throw new Error("duration must be a non-negative number or null.");
      next.canvas.duration = duration;
    }
  }
  if ("fps" in payload) {
    if (payload.fps === null || payload.fps === "") delete next.canvas.fps;
    else {
      const fps = Number(payload.fps);
      if (!Number.isFinite(fps) || fps <= 0) throw new Error("fps must be a positive number or null.");
      next.canvas.fps = Math.round(fps);
    }
  }
  return next;
}

function requiredCanvasDimension(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} must be a positive number.`);
  return Math.round(number);
}

function normalizeMotionValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.every((item) => Number.isFinite(Number(item)))) return value.map((item) => Number(item));
    if (value.every((item) => typeof item === "string")) return value.slice();
    throw new Error("array values must contain only numbers or only strings.");
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = normalizeJsonMotionValue(item);
    return out;
  }
  throw new Error("value must be a JSON-safe timeline value.");
}

function normalizeJsonMotionValue(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(normalizeJsonMotionValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = normalizeJsonMotionValue(item);
    return out;
  }
  throw new Error("object timeline values must be JSON-safe.");
}

function curveFromPayload(payload) {
  if (payload.curve && typeof payload.curve === "object") return payload.curve;
  if (typeof payload.curvePreset === "string") return core.timelineCurvePreset(payload.curvePreset);
  return undefined;
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
