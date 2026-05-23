#!/usr/bin/env node
const fs = require("node:fs");
const crypto = require("node:crypto");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
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

  if (command === "preview") {
    await preview(args);
    return;
  }

  if (command === "render") {
    await render(args);
    return;
  }

  if (command === "timeline") {
    await timeline(args);
    return;
  }

  if (command === "lint") {
    await lint(args);
    return;
  }

  if (command === "screenshot-lint") {
    await screenshotLint(args);
    return;
  }

  throw new Error(`Unknown command '${command}'.`);
}

function usage() {
  console.log(`Sketchmark primitive JSON visual CLI

Usage:
  sketchmark preview <input.visual.json> [--scene intro] [--sequence main] [--deck] [--port 5177] [--no-open]
  sketchmark render <input.visual.json> <output.svg|html|png|jpg|pdf|pptx|mp4|webm> [--scene intro] [--sequence main] [--deck] [--time 1.2] [--fps 30] [--duration 4] [--keep-frames] [--transparent]
  sketchmark timeline <input.visual.json> [--sequence main] [--fps 30] [--out timeline.json]
  sketchmark lint <input.visual.json> [--json]
  sketchmark screenshot-lint <input.visual.json> [--scene intro] [--sequence main] [--time 1.2] [--json]

Examples:
  sketchmark preview examples/dns.visual.json
  sketchmark render examples/dns.visual.json out.svg
  sketchmark render examples/dns.visual.json out.png --time 2
  sketchmark render examples/dns.visual.json out.mp4 --fps 30 --duration 8
  sketchmark render examples/dns.visual.json transparent.webm --transparent --fps 30 --duration 8
  sketchmark render examples/three-cube.visual.json cube.png
  sketchmark render examples/dns.visual.json out.pdf
  sketchmark render examples/deck.visual.json deck.pptx --deck --scene slide
  sketchmark timeline examples/project.visual.json --sequence main --fps 12
`);
}

async function preview(args) {
  const input = args[0];
  if (!input) throw new Error("preview requires an input JSON file.");
  const port = numberOption(args, "--port", 5177);
  const shouldOpen = !args.includes("--no-open");
  const scene = stringOption(args, "--scene");
  const sequence = stringOption(args, "--sequence");
  const deck = args.includes("--deck");
  const inputPath = path.resolve(input);

  const server = http.createServer((request, response) => {
    void (async () => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (url.pathname === "/") {
        send(response, 200, inlineEditorHtml({ scene, sequence, deck }), "text/html; charset=utf-8");
        return;
      }
      if (url.pathname.startsWith("/three.")) {
        const filePath = threeBuildFile(url.pathname);
        send(response, 200, fs.readFileSync(filePath), mimeType(filePath));
        return;
      }
      if (url.pathname === "/api/initial") {
        const source = fs.readFileSync(inputPath, "utf8");
        sendJson(response, 200, {
          ok: true,
          file: inputPath,
          fileName: path.basename(inputPath),
          source,
          scene,
          sequence,
          deck
        });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/render") {
        const body = JSON.parse(await readRequestBody(request, 8_000_000));
        const source = String(body.source || "");
        const time = Number(body.time || 0);
        const requestedScene = Object.prototype.hasOwnProperty.call(body, "scene") ? (body.scene ? String(body.scene) : undefined) : scene;
        const requestedSequence = Object.prototype.hasOwnProperty.call(body, "sequence") ? (body.sequence ? String(body.sequence) : undefined) : sequence;
        const requestedDeck = Object.prototype.hasOwnProperty.call(body, "deck") ? Boolean(body.deck) : deck;
        const requestedDeckStep = Object.prototype.hasOwnProperty.call(body, "deckStep") ? Number(body.deckStep) : undefined;
        const result = renderPreviewSource(inputPath, source, { scene: requestedScene, sequence: requestedSequence, time, deck: requestedDeck, deckStep: requestedDeckStep });
        sendJson(response, 200, result);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/save") {
        const body = JSON.parse(await readRequestBody(request, 8_000_000));
        const source = String(body.source || "");
        JSON.parse(source);
        fs.writeFileSync(inputPath, source, "utf8");
        sendJson(response, 200, { ok: true });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/export") {
        const body = JSON.parse(await readRequestBody(request, 8_000_000));
        await exportPreviewSource(inputPath, body, response);
        return;
      }
      if (url.pathname === "/frame.svg") {
        const time = Number(url.searchParams.get("time") || 0);
        const doc = loadDocument(inputPath);
        const frame = frameDocument(doc, { scene, sequence, time });
        send(response, 200, core.renderToSvg(frame.document, { time: frame.localTime }), "image/svg+xml; charset=utf-8");
        return;
      }
      send(response, 404, "Not found", "text/plain; charset=utf-8");
    } catch (error) {
      if (!response.headersSent) send(response, 500, String(error?.message || error), "text/plain; charset=utf-8");
    }
    })();
  });

  await listen(server, port);
  const url = `http://127.0.0.1:${port}/`;
  console.log(`Sketchmark preview: ${url}`);
  console.log(`Source: ${inputPath}`);
  if (shouldOpen) openBrowser(url);
}

async function render(args) {
  const input = args[0];
  const output = args[1];
  if (!input || !output) throw new Error("render requires input and output paths.");

  const inputPath = path.resolve(input);
  const outputPath = path.resolve(output);
  const doc = loadDocument(inputPath);
  const format = inferFormat(outputPath);
  const time = numberOption(args, "--time", 0);
  const scene = stringOption(args, "--scene");
  const sequence = stringOption(args, "--sequence");
  const deck = args.includes("--deck");
  const fps = numberOption(args, "--fps", doc.canvas.fps || 30);
  const duration = numberOption(args, "--duration", doc.canvas.duration || 0);
  const keepFrames = args.includes("--keep-frames");
  const browser = stringOption(args, "--browser");
  const transparent = args.includes("--transparent");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (format === "svg") {
    const frame = frameDocument(doc, { scene, sequence, time });
    fs.writeFileSync(outputPath, core.renderToSvg(frame.document, { time: frame.localTime, transparent }), "utf8");
  } else if (format === "html") {
    if (deck) {
      const sceneId = scene || firstSceneId(doc);
      if (!sceneId) throw new Error("--deck requires a scene with steps.");
      fs.writeFileSync(outputPath, core.renderDeckToHtml(doc, sceneId), "utf8");
    } else {
      const frame = frameDocument(doc, { scene, sequence, time });
      fs.writeFileSync(outputPath, core.renderToHtml(frame.document, { time: frame.localTime, transparent }), "utf8");
    }
  } else if (format === "png" || format === "jpg") {
    await renderRaster(doc, outputPath, format, { scene, sequence, time, browser, transparent });
  } else if (format === "pdf") {
    await renderPdf(doc, outputPath, { scene, sequence, time, deck, browser });
  } else if (format === "pptx") {
    await renderPptx(doc, outputPath, { scene, sequence, time, deck, transparent });
  } else if (format === "mp4") {
    if (transparent) throw new Error("Transparent MP4 is not supported. Use transparent PNG frames with --keep-frames, or export PNG/SVG.");
    await renderMp4(doc, outputPath, { fps, duration, keepFrames, scene, sequence, browser, transparent });
  } else if (format === "webm") {
    await renderWebm(doc, outputPath, { fps, duration, keepFrames, scene, sequence, browser, transparent });
  } else {
    throw new Error(`Unsupported output format '${format}'.`);
  }

  console.log(`Rendered ${format.toUpperCase()}: ${outputPath}`);
}

async function lint(args) {
  const input = args[0];
  if (!input) throw new Error("lint requires an input JSON file.");
  const doc = loadDocumentForLint(path.resolve(input));
  const validation = core.validateVisualDocument(doc);
  const diagnostics = core.lintVisualDocument(doc);
  const payload = {
    ok: validation.ok && diagnostics.warnings.length === 0,
    issues: validation.issues,
    warnings: [...validation.warnings, ...diagnostics.warnings]
  };
  if (args.includes("--json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  for (const issue of payload.issues) {
    console.error(`Issue ${issue.path}: ${issue.message}${issue.suggestion ? ` ${issue.suggestion}` : ""}`);
  }
  for (const warning of payload.warnings) {
    console.warn(`Warning ${warning.path}: ${warning.message}${warning.suggestion ? ` ${warning.suggestion}` : ""}`);
  }
  if (payload.issues.length) process.exitCode = 1;
  if (!payload.issues.length && !payload.warnings.length) console.log("No issues or warnings.");
}

function loadDocumentForLint(inputPath) {
  try {
    return core.loadVisualProject(inputPath).document;
  } catch {
    return JSON.parse(fs.readFileSync(inputPath, "utf8"));
  }
}

async function screenshotLint(args) {
  const input = args[0];
  if (!input) throw new Error("screenshot-lint requires an input JSON file.");
  const doc = loadDocument(path.resolve(input));
  const scene = stringOption(args, "--scene");
  const sequence = stringOption(args, "--sequence");
  const time = numberOption(args, "--time", 0);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketchmark-shot-lint-"));
  try {
    const pngPath = path.join(tempDir, "frame.png");
    await renderRaster(doc, pngPath, "png", { scene, sequence, time });
    const report = await analyzePng(pngPath);
    if (args.includes("--json")) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    for (const warning of report.warnings) {
      console.warn(`Warning ${warning.code}: ${warning.message}`);
    }
    if (!report.warnings.length) console.log("Screenshot lint passed.");
  } finally {
    removeTempDir(tempDir);
  }
}

async function analyzePng(pngPath) {
  const sharp = loadSharp();
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  let changed = 0;
  const first = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0];
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;
    if (alpha > 5) opaque += 1;
    if (
      Math.abs((data[index] ?? 0) - first[0]) > 3 ||
      Math.abs((data[index + 1] ?? 0) - first[1]) > 3 ||
      Math.abs((data[index + 2] ?? 0) - first[2]) > 3 ||
      Math.abs(alpha - first[3]) > 3
    ) {
      changed += 1;
    }
  }
  const pixels = Math.max(1, info.width * info.height);
  const warnings = [];
  if (opaque / pixels < 0.01) warnings.push({ code: "mostly_transparent", message: "Rendered frame is almost entirely transparent." });
  if (changed / pixels < 0.005) warnings.push({ code: "nearly_blank", message: "Rendered frame has very little visual variation." });
  return {
    ok: warnings.length === 0,
    width: info.width,
    height: info.height,
    opaqueRatio: opaque / pixels,
    changedRatio: changed / pixels,
    warnings
  };
}

async function timeline(args) {
  const input = args[0];
  if (!input) throw new Error("timeline requires an input JSON file.");
  const inputPath = path.resolve(input);
  const doc = loadDocument(inputPath);
  const sequence = stringOption(args, "--sequence") || core.defaultSequenceId(doc);
  if (!sequence) throw new Error("timeline requires a sequence.");
  const fps = numberOption(args, "--fps", doc.canvas.fps || 30);
  const output = stringOption(args, "--out");
  const payload = JSON.stringify(core.sequenceTimeline(doc, sequence, fps), null, 2);
  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, payload, "utf8");
    console.log(`Rendered timeline: ${outputPath}`);
  } else {
    console.log(payload);
  }
}

function firstSceneId(doc) {
  return Object.keys(doc.scenes || {})[0];
}

function loadDocument(inputPath) {
  const doc = core.loadVisualProject(inputPath).document;
  const result = core.validateVisualDocument(doc);
  for (const warning of result.warnings) {
    console.warn(`Warning ${warning.path}: ${warning.message}${warning.suggestion ? ` ${warning.suggestion}` : ""}`);
  }
  if (!result.ok) {
    const first = result.issues[0];
    throw new Error(first ? `${first.path}: ${first.message}` : "Invalid visual document.");
  }
  return doc;
}

function frameDocument(doc, options = {}) {
  const wantsDeck = options.deck || options.deckStep !== undefined;
  if (wantsDeck && !options.sequence) {
    const sceneId = options.scene || firstSceneId(doc);
    if (!sceneId) throw new Error("Deck preview requires a scene with steps.");
    const stepIndex = Number.isFinite(Number(options.deckStep)) ? Math.trunc(Number(options.deckStep)) : -1;
    const document = stepIndex < 0 ? core.documentForScene(doc, sceneId) : core.documentForDeckStep(doc, sceneId, stepIndex);
    return {
      document,
      localTime: Number(options.time || 0),
      duration: 0,
      scene: sceneId,
      deckStep: stepIndex
    };
  }
  if (options.sequence) {
    const frame = core.documentForSequenceTime(doc, options.sequence, Number(options.time || 0));
    return { document: frame.document, localTime: frame.localTime, duration: core.compileVisualSequence(doc, options.sequence).duration, sequenceId: options.sequence, scene: frame.scene, globalTime: frame.globalTime };
  }
  if (options.scene) {
    return { document: core.documentForScene(doc, options.scene), localTime: Number(options.time || 0), duration: Number((doc.scenes?.[options.scene]?.canvas?.duration) || doc.canvas.duration || 0), scene: options.scene };
  }
  const defaultSequence = core.defaultSequenceId(doc);
  if (defaultSequence) {
    const frame = core.documentForSequenceTime(doc, defaultSequence, Number(options.time || 0));
    return { document: frame.document, localTime: frame.localTime, duration: core.compileVisualSequence(doc, defaultSequence).duration, sequenceId: defaultSequence, scene: frame.scene, globalTime: frame.globalTime };
  }
  return { document: doc, localTime: Number(options.time || 0), duration: Number(doc.canvas.duration || 0) };
}

function renderPreviewSource(inputPath, source, options) {
  try {
    const doc = loadDocumentFromSource(inputPath, source);
    const validation = core.validateVisualDocument(doc);
    const diagnostics = core.lintVisualDocument(doc);
    if (!validation.ok) {
      return { ok: false, issues: validation.issues, warnings: validation.warnings };
    }
    const scenes = Object.keys(doc.scenes || {});
    const sequences = Object.keys(doc.sequences || {});
    const sceneForPreview = options.sequence
      ? options.scene
      : options.scene || (scenes.length && !(doc.elements || []).length ? scenes[0] : undefined);
    const shouldUseDeck = !options.sequence && sceneForPreview && (options.deck || options.deckStep !== undefined || hasDeckSteps(doc, sceneForPreview));
    const deckStep = Number.isFinite(Number(options.deckStep)) ? Math.trunc(Number(options.deckStep)) : -1;
    const frame = frameDocument(doc, { ...options, scene: sceneForPreview, deck: shouldUseDeck, deckStep: shouldUseDeck ? deckStep : undefined });
    const sequence = frame.sequenceId ? previewSequenceMeta(doc, frame.sequenceId) : undefined;
    const deck = shouldUseDeck && frame.scene ? previewDeckMeta(doc, frame.scene, deckStep) : undefined;
    if (frame.document.canvas.renderer === "three") {
      return {
        ok: true,
        renderer: "three",
        html: core.renderToHtml(frame.document, { time: 0, threeRuntime: "/three.module.js" }),
        duration: frame.duration,
        time: Number(options.time || 0),
        frameTime: frame.localTime,
        scenes,
        sequences,
        selectedScene: frame.scene || options.scene || "",
        selectedSequence: frame.sequenceId || options.sequence || "",
        sequence,
        deck,
        warnings: [...validation.warnings, ...diagnostics.warnings],
        canvas: frame.document.canvas
      };
    }
    return {
      ok: true,
      renderer: "svg",
      svg: core.renderToSvg(frame.document, { time: frame.localTime }),
      duration: frame.duration,
      time: Number(options.time || 0),
      frameTime: frame.localTime,
      scenes,
      sequences,
      selectedScene: frame.scene || options.scene || "",
      selectedSequence: frame.sequenceId || options.sequence || "",
      sequence,
      deck,
      warnings: [...validation.warnings, ...diagnostics.warnings],
      canvas: frame.document.canvas
    };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

async function exportPreviewSource(inputPath, payload, response) {
  const source = String(payload.source || "");
  const format = String(payload.format || "").toLowerCase();
  const scene = payload.scene ? String(payload.scene) : undefined;
  const sequence = payload.sequence ? String(payload.sequence) : undefined;
  const deck = Boolean(payload.deck) || Object.prototype.hasOwnProperty.call(payload, "deckStep");
  const deckStep = Number.isFinite(Number(payload.deckStep)) ? Math.trunc(Number(payload.deckStep)) : -1;
  const time = Number(payload.time || 0);
  const transparent = Boolean(payload.transparent);
  const supported = new Set(["svg", "html", "png", "jpg", "pdf", "pptx", "mp4", "webm"]);

  try {
    if (!supported.has(format)) {
      sendJson(response, 400, { ok: false, error: `Unsupported export format '${format}'.` });
      return;
    }

    const doc = loadDocumentFromSource(inputPath, source);
    const validation = core.validateVisualDocument(doc);
    if (!validation.ok) {
      sendJson(response, 200, { ok: false, issues: validation.issues, warnings: validation.warnings });
      return;
    }

    const parsed = path.parse(inputPath);
    const wantsVideo = format === "mp4" || format === "webm";
    const sequenceForVideo = wantsVideo ? sequence || core.defaultSequenceId(doc) : undefined;
    const frameSequence = sequence && !sequenceForVideo && ["svg", "html", "png", "jpg", "pdf"].includes(format) ? sequence : undefined;
    const suffix = sequenceForVideo
      ? `-${sequenceForVideo}`
        : frameSequence
          ? `-${frameSequence}`
        : scene
          ? `-${scene}${deck ? `-step-${deckStep + 1}` : ""}`
          : "";
    const outputName = `${parsed.name}${suffix}.${format}`;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketchmark-json-preview-"));
    const outputPath = path.join(tempDir, outputName);
    const fps = Number(payload.fps || doc.canvas.fps || 30);
    const duration = Number(payload.duration || doc.canvas.duration || 0);
    const options = {
      scene: sequenceForVideo || frameSequence ? undefined : scene,
      sequence: sequenceForVideo,
      deck: deck && !sequenceForVideo && !frameSequence,
      deckStep,
      time,
      fps,
      duration,
      transparent,
      browser: payload.browser ? String(payload.browser) : undefined
    };

    if (format === "svg") {
      const frame = frameSequence ? core.documentForSequenceTime(doc, frameSequence, time) : frameDocument(doc, options);
      fs.writeFileSync(outputPath, core.renderToSvg(frame.document, { time: frame.localTime, transparent }), "utf8");
    } else if (format === "html") {
      if (options.deck && options.scene) {
        fs.writeFileSync(outputPath, core.renderDeckToHtml(doc, options.scene), "utf8");
      } else {
        const frame = frameSequence ? core.documentForSequenceTime(doc, frameSequence, time) : frameDocument(doc, options);
        fs.writeFileSync(outputPath, core.renderToHtml(frame.document, { time: frame.localTime, transparent }), "utf8");
      }
    } else if (format === "png" || format === "jpg") {
      const rasterOptions = frameSequence ? { ...options, sequence: frameSequence, scene: undefined } : options;
      await renderRaster(doc, outputPath, format, rasterOptions);
    } else if (format === "pdf") {
      const pdfOptions = frameSequence ? { ...options, sequence: frameSequence, scene: undefined } : options;
      await renderPdf(doc, outputPath, pdfOptions);
    } else if (format === "pptx") {
      await renderPptx(doc, outputPath, { ...options, deck: options.deck });
    } else if (format === "mp4") {
      if (transparent) throw new Error("Transparent MP4 is not supported. Use WebM or PNG/SVG.");
      await renderMp4(doc, outputPath, options);
    } else if (format === "webm") {
      await renderWebm(doc, outputPath, options);
    }

    sendDownloadFile(response, outputPath, outputName, mimeType(outputPath), validation.warnings || [], () => removeTempDir(tempDir));
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error?.message || String(error) });
  }
}

function previewSequenceMeta(doc, sequenceId) {
  const sequence = core.compileVisualSequence(doc, sequenceId);
  return {
    id: sequenceId,
    clips: sequence.clips.map((clip) => {
      const sceneDoc = core.documentForScene(doc, clip.scene);
      return {
        scene: clip.scene,
        start: clip.start,
        duration: clip.duration,
        renderer: sceneDoc.canvas.renderer === "three" ? "three" : "svg"
      };
    })
  };
}

function hasDeckSteps(doc, sceneId) {
  return Boolean(doc.scenes?.[sceneId]?.steps?.length);
}

function previewDeckMeta(doc, sceneId, selectedStep) {
  const steps = doc.scenes?.[sceneId]?.steps || [];
  return {
    scene: sceneId,
    selectedStep,
    labels: ["Base", ...steps.map((step) => step.id || "step")],
    count: steps.length + 1
  };
}

function loadDocumentFromSource(inputPath, source) {
  const document = JSON.parse(source);
  if (!document.imports || typeof document.imports !== "object") return document;
  return mergeProjectFromSource(inputPath, document, new Set());
}

function mergeProjectFromSource(filePath, sourceDocument, seen) {
  const absolute = path.resolve(filePath);
  if (seen.has(absolute)) throw new Error(`Circular import detected at '${absolute}'.`);
  seen.add(absolute);
  const merged = {
    ...sourceDocument,
    elements: [...(sourceDocument.elements || [])],
    scenes: { ...(sourceDocument.scenes || {}) },
    sequences: { ...(sourceDocument.sequences || {}) },
    assets: { ...(sourceDocument.assets || {}) }
  };
  for (const [key, importPath] of Object.entries(sourceDocument.imports || {})) {
    const childPath = path.resolve(path.dirname(absolute), String(importPath));
    const child = JSON.parse(fs.readFileSync(childPath, "utf8"));
    const loaded = child.imports ? mergeProjectFromSource(childPath, child, seen) : child;
    if (loaded.elements?.length) {
      merged.scenes[key] = { id: key, canvas: loaded.canvas, elements: loaded.elements };
    }
    merged.scenes = { ...merged.scenes, ...(loaded.scenes || {}) };
    merged.sequences = { ...merged.sequences, ...(loaded.sequences || {}) };
    merged.assets = { ...merged.assets, ...(loaded.assets || {}) };
  }
  seen.delete(absolute);
  return merged;
}

function inlineEditorHtml(initialOptions) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sketchmark Inline Preview</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #0b1020; color: #e5e7eb; font-family: Inter, Arial, sans-serif; }
    body { min-height: 100vh; display: grid; grid-template-columns: minmax(360px, 42vw) 1fr; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: #111827; border-bottom: 1px solid #26324a; }
    h1 { margin: 0; font-size: 14px; }
    .file { color: #94a3b8; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .editor-pane, .preview-pane { min-width: 0; min-height: 100vh; display: flex; flex-direction: column; }
    .editor-pane { border-right: 1px solid #26324a; background: #0f172a; }
    textarea { flex: 1; width: 100%; resize: none; border: 0; outline: 0; padding: 16px; background: #0f172a; color: #dbeafe; font: 13px/1.55 "Cascadia Code", Consolas, monospace; tab-size: 2; }
    .stage-wrap { flex: 1; display: grid; place-items: center; padding: 24px; overflow: auto; background: linear-gradient(90deg,#ffffff08 1px,transparent 1px),linear-gradient(#ffffff08 1px,transparent 1px),#0b1020; background-size: 32px 32px; }
    #stage { position: relative; width: min(100%, 1280px); max-width: 100%; max-height: calc(100vh - 132px); box-shadow: 0 18px 48px #00000066; background: transparent; }
    #stage .svg-layer { width: 100%; height: 100%; }
    #stage svg { display: block; max-width: 100%; max-height: calc(100vh - 132px); height: auto; }
    #stage iframe { display: block; width: 100%; min-height: 480px; aspect-ratio: inherit; border: 0; background: #0f172a; }
    .toolbar { display: flex; gap: 10px; align-items: center; padding: 12px 16px; background: #111827; border-top: 1px solid #26324a; }
    button, select { border: 1px solid #334155; border-radius: 6px; padding: 7px 12px; background: #1f2937; color: #f8fafc; font: inherit; }
    button { cursor: pointer; }
    button:hover { background: #263244; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .deck-control { display: none; }
    .deck-control.visible { display: inline-flex; }
    select.deck-control.visible { display: inline-block; }
    input[type=range] { flex: 1; }
    .time { min-width: 88px; text-align: right; color: #cbd5e1; font-variant-numeric: tabular-nums; font-size: 12px; }
    .status { min-height: 34px; padding: 8px 16px; border-top: 1px solid #26324a; background: #111827; color: #94a3b8; font-size: 12px; white-space: pre-wrap; }
    .status.error { color: #fecaca; }
    @media (max-width: 900px) { body { grid-template-columns: 1fr; } .editor-pane { min-height: 46vh; border-right: 0; border-bottom: 1px solid #26324a; } .preview-pane { min-height: 54vh; } }
  </style>
</head>
<body>
  <section class="editor-pane">
    <header><h1>Sketchmark JSON</h1><div class="file" id="fileName"></div></header>
    <textarea id="editor" spellcheck="false"></textarea>
    <div class="toolbar"><button id="render">Render</button><button id="save">Save</button><button id="export">Export</button></div>
  </section>
  <section class="preview-pane">
    <header><h1>Preview</h1><div class="file">inline editor</div></header>
    <div class="stage-wrap"><div id="stage"></div></div>
    <div class="toolbar">
      <button id="play">Play</button>
      <input id="scrub" type="range" min="0" max="0" step="0.01" value="0">
      <div class="time" id="clock">0.00s</div>
      <select id="scene"></select>
      <select id="sequence"></select>
      <button id="prevStep" class="deck-control">Prev Step</button>
      <select id="deckStep" class="deck-control"></select>
      <button id="nextStep" class="deck-control">Next Step</button>
    </div>
    <div id="status" class="status">Loading...</div>
  </section>
  <script>
    const initialScene = ${JSON.stringify(initialOptions.scene || "")};
    const initialSequence = ${JSON.stringify(initialOptions.sequence || "")};
    const initialDeck = ${JSON.stringify(Boolean(initialOptions.deck))};
    const editor = document.getElementById("editor");
    const fileName = document.getElementById("fileName");
    const stage = document.getElementById("stage");
    const status = document.getElementById("status");
    const renderButton = document.getElementById("render");
    const saveButton = document.getElementById("save");
    const exportButton = document.getElementById("export");
    const scrub = document.getElementById("scrub");
    const clock = document.getElementById("clock");
    const play = document.getElementById("play");
    const sceneSelect = document.getElementById("scene");
    const sequenceSelect = document.getElementById("sequence");
    const prevStep = document.getElementById("prevStep");
    const nextStep = document.getElementById("nextStep");
    const deckStepSelect = document.getElementById("deckStep");
    let duration = 0;
    let playing = false;
    let playFrame = 0;
    let start = 0;
    let startTime = 0;
    let timer = 0;
    let currentRenderer = "svg";
    let svgLayer = null;
    let threeIframe = null;
    let threeHtml = "";
    let deckStep = -1;
    let deckMeta = null;
    const preloadedThree = new Map();
    init().catch((error) => setError(error.message || String(error)));

    async function init() {
      const response = await fetch("/api/initial");
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Could not load initial file.");
      fileName.textContent = data.fileName || data.file || "";
      editor.value = data.source || "";
      renderButton.addEventListener("click", () => renderNow());
      saveButton.addEventListener("click", () => saveNow());
      exportButton.addEventListener("click", () => exportNow());
      editor.addEventListener("input", debounceRender);
      scrub.addEventListener("input", () => renderNow());
      sceneSelect.addEventListener("change", () => {
        if (sceneSelect.value) sequenceSelect.value = "";
        deckStep = -1;
        renderNow();
      });
      sequenceSelect.addEventListener("change", () => {
        if (sequenceSelect.value) sceneSelect.value = "";
        deckStep = -1;
        renderNow();
      });
      deckStepSelect.addEventListener("change", () => {
        deckStep = Number(deckStepSelect.value || -1);
        renderNow();
      });
      prevStep.addEventListener("click", () => {
        if (!deckMeta) return;
        deckStep = Math.max(-1, deckStep - 1);
        renderNow();
      });
      nextStep.addEventListener("click", () => {
        if (!deckMeta) return;
        deckStep = Math.min(Number(deckMeta.count || 1) - 2, deckStep + 1);
        renderNow();
      });
      play.addEventListener("click", togglePlay);
      await renderNow();
    }

    function debounceRender() {
      window.clearTimeout(timer);
      clearThreeCache();
      timer = window.setTimeout(() => renderNow(), 300);
    }

    async function renderNow() {
      renderButton.disabled = true;
      const time = Number(scrub.value || 0);
      try {
        const response = await fetch("/api/render", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: editor.value,
            time,
            scene: sceneSelect.value || initialScene || undefined,
            sequence: sequenceSelect.value || initialSequence || undefined,
            deck: initialDeck,
            deckStep: sequenceSelect.value || initialSequence ? undefined : deckStep
          })
        });
        const data = await response.json();
        if (!data.ok) {
          setError(formatError(data));
          return;
        }
        duration = Number(data.duration || 0);
        if (data.canvas && data.canvas.width && data.canvas.height) {
          stage.style.aspectRatio = Number(data.canvas.width) + " / " + Number(data.canvas.height);
        }
        scrub.max = String(Math.max(0, duration));
        scrub.value = String(Math.max(0, Math.min(duration || time, Number(data.time ?? time))));
        clock.textContent = Number(scrub.value || 0).toFixed(2) + "s";
        currentRenderer = data.renderer || "svg";
        if (data.sequence && Array.isArray(data.sequence.clips)) preloadThreeScenes(data.sequence.clips);
        if (data.html) mountThreePreview(data.html, data.selectedScene || "current", Number(data.frameTime || 0));
        else mountSvgPreview(data.svg || "");
        updateSelect(sceneSelect, data.scenes || [], data.selectedScene || initialScene, "document");
        updateSelect(sequenceSelect, data.sequences || [], data.selectedSequence || initialSequence, "no sequence");
        updateDeckControls(data.deck);
        const warningText = data.warnings && data.warnings.length ? " - " + data.warnings.length + " warning(s)" : "";
        const deckText = data.deck ? " - " + (data.deck.labels?.[Number(data.deck.selectedStep || -1) + 1] || "Base") : "";
        setStatus("Rendered " + (data.renderer || "svg") + " at " + Number(data.frameTime || 0).toFixed(2) + "s" + deckText + warningText);
      } catch (error) {
        setError(error.message || String(error));
      } finally {
        renderButton.disabled = false;
      }
    }

    async function saveNow() {
      saveButton.disabled = true;
      try {
        const response = await fetch("/api/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: editor.value })
        });
        const data = await response.json();
        if (!data.ok) {
          setError(data.error || "Save failed.");
          return;
        }
        setStatus("Saved.");
      } catch (error) {
        setError(error.message || String(error));
      } finally {
        saveButton.disabled = false;
      }
    }

    async function exportNow() {
      const fallback = currentRenderer === "three" ? "mp4" : "png";
      const format = window.prompt("Export format: svg, png, jpg, html, mp4, webm, pdf, pptx", fallback);
      if (!format) return;
      exportButton.disabled = true;
      const normalizedFormat = String(format).toLowerCase();
      const selectedSequence = sequenceSelect.value || initialSequence || "";
      const sequenceExport = selectedSequence && ["svg", "png", "jpg", "html", "pdf", "mp4", "webm"].includes(normalizedFormat);
      const deckExport = Boolean(deckMeta) && !sequenceExport;
      setStatus("Exporting " + normalizedFormat + "...");
      try {
        const response = await fetch("/api/export", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: editor.value,
            format: normalizedFormat,
            scene: sequenceExport ? undefined : sceneSelect.value || initialScene || undefined,
            sequence: sequenceExport ? selectedSequence : undefined,
            deck: deckExport && (normalizedFormat === "html" || normalizedFormat === "pptx"),
            deckStep: deckExport ? deckStep : undefined,
            time: Number(scrub.value || 0),
            download: true
          })
        });
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          setError(formatError(data));
          return;
        }
        if (!response.ok) {
          setError(await response.text());
          return;
        }
        const blob = await response.blob();
        const filename = downloadFilename(response.headers.get("content-disposition")) || exportFilename(normalizedFormat);
        downloadBlob(blob, filename);
        const warnings = parseWarnings(response.headers.get("x-sketchmark-warnings"));
        const warningText = warnings.length ? " (" + warnings.length + " warning" + (warnings.length === 1 ? "" : "s") + ")" : "";
        setStatus("Downloaded " + filename + warningText);
      } catch (error) {
        setError(error.message || String(error));
      } finally {
        exportButton.disabled = false;
      }
    }

    function exportFilename(format) {
      const cleanFile = String(fileName.textContent || "sketchmark").split(/[\\\\/]/).pop() || "sketchmark";
      const base = cleanFile.replace(/\\.visual\\.json$/i, "").replace(/\\.(json|txt)$/i, "");
      const selectedSequence = sequenceSelect.value || initialSequence || "";
      const isSequenceExport = selectedSequence && ["svg", "png", "jpg", "html", "pdf", "mp4", "webm"].includes(String(format || "").toLowerCase());
      const suffix = isSequenceExport
        ? "-" + selectedSequence
        : sceneSelect.value
          ? "-" + sceneSelect.value + (deckMeta ? "-step-" + (deckStep + 1) : "")
          : "";
      return base + suffix + "." + String(format || "png").toLowerCase();
    }

    function downloadFilename(contentDisposition) {
      const match = /filename\\*?=(?:UTF-8''|")?([^";]+)/i.exec(String(contentDisposition || ""));
      return match ? decodeURIComponent(match[1].replace(/"$/, "")) : "";
    }

    function parseWarnings(header) {
      if (!header) return [];
      try {
        const value = JSON.parse(decodeURIComponent(header));
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function togglePlay() {
      playing = !playing;
      play.textContent = playing ? "Pause" : "Play";
      start = performance.now();
      startTime = Number(scrub.value || 0);
      if (playing) playFrame = requestAnimationFrame(tick);
      else if (playFrame) cancelAnimationFrame(playFrame);
    }

    async function tick(now) {
      if (!playing) return;
      let t = startTime + (now - start) / 1000;
      if (duration > 0 && t > duration) {
        t = t % duration;
        start = now;
        startTime = t;
      }
      scrub.value = String(t);
      await renderNow();
      if (playing) playFrame = requestAnimationFrame(tick);
    }

    function ensureSvgLayer() {
      if (!svgLayer) {
        svgLayer = document.createElement("div");
        svgLayer.className = "svg-layer";
        stage.appendChild(svgLayer);
      }
      return svgLayer;
    }

    function mountSvgPreview(svg) {
      const layer = ensureSvgLayer();
      layer.innerHTML = svg;
      layer.style.display = "";
      if (threeIframe) threeIframe.style.display = "none";
      for (const iframe of preloadedThree.values()) {
        if (iframe && iframe.nodeType === 1) iframe.style.display = "none";
      }
    }

    function mountThreePreview(html, sceneId, time) {
      const cached = preloadedThree.get(sceneId);
      if (cached && cached.nodeType === 1) {
        threeIframe = cached;
        threeHtml = html;
        cached.style.display = "";
        if (svgLayer) svgLayer.style.display = "none";
        hidePreloadedExcept(sceneId);
        showThreeTime(time);
        return;
      }
      if (!threeIframe || threeHtml !== html) {
        threeHtml = html;
        if (!threeIframe || threeIframe.dataset.preloadScene) {
          threeIframe = createThreeIframe();
          stage.appendChild(threeIframe);
        }
        threeIframe.addEventListener("load", () => showThreeTime(time), { once: true });
        threeIframe.srcdoc = html;
      }
      threeIframe.style.display = "";
      if (svgLayer) svgLayer.style.display = "none";
      hidePreloadedExcept(null);
      showThreeTime(time);
    }

    function showThreeTime(time) {
      if (!threeIframe || !threeIframe.contentWindow) return;
      threeIframe.contentWindow.postMessage({ type: "sketchmark-show", time: Number(time || 0) }, "*");
    }

    function createThreeIframe() {
      const iframe = document.createElement("iframe");
      iframe.title = "Sketchmark Three preview";
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
      return iframe;
    }

    function preloadThreeScenes(clips) {
      for (const clip of clips) {
        if (clip.renderer !== "three" || !clip.scene || preloadedThree.has(clip.scene)) continue;
        preloadedThree.set(clip.scene, "loading");
        fetch("/api/render", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: editor.value, scene: clip.scene, sequence: "", time: 0 })
        })
          .then((response) => response.json())
          .then((data) => {
            if (!data.ok || !data.html) {
              preloadedThree.delete(clip.scene);
              return;
            }
            const iframe = createThreeIframe();
            iframe.dataset.preloadScene = clip.scene;
            iframe.srcdoc = data.html;
            iframe.style.display = "none";
            stage.appendChild(iframe);
            preloadedThree.set(clip.scene, iframe);
          })
          .catch(() => preloadedThree.delete(clip.scene));
      }
    }

    function hidePreloadedExcept(sceneId) {
      for (const [id, iframe] of preloadedThree.entries()) {
        if (!iframe || iframe.nodeType !== 1) continue;
        iframe.style.display = id === sceneId ? "" : "none";
      }
    }

    function clearThreeCache() {
      for (const iframe of preloadedThree.values()) {
        if (iframe && iframe.nodeType === 1) iframe.remove();
      }
      preloadedThree.clear();
      if (threeIframe) {
        threeIframe.remove();
        threeIframe = null;
        threeHtml = "";
      }
    }

    function updateDeckControls(meta) {
      deckMeta = meta && Number(meta.count || 0) > 1 ? meta : null;
      const controls = [prevStep, nextStep, deckStepSelect];
      for (const control of controls) control.classList.toggle("visible", Boolean(deckMeta));
      if (!deckMeta) {
        deckStepSelect.innerHTML = "";
        return;
      }
      deckStep = Number.isFinite(Number(deckMeta.selectedStep)) ? Number(deckMeta.selectedStep) : -1;
      deckStepSelect.innerHTML = "";
      const labels = Array.isArray(deckMeta.labels) ? deckMeta.labels : ["Base"];
      for (let index = 0; index < Number(deckMeta.count || labels.length); index += 1) {
        const option = document.createElement("option");
        option.value = String(index - 1);
        option.textContent = labels[index] || (index === 0 ? "Base" : "Step " + index);
        deckStepSelect.appendChild(option);
      }
      deckStepSelect.value = String(deckStep);
      prevStep.disabled = deckStep <= -1;
      nextStep.disabled = deckStep >= Number(deckMeta.count || 1) - 2;
    }

    function updateSelect(select, values, selected, emptyLabel) {
      const current = select.value || selected || "";
      select.innerHTML = "";
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = emptyLabel;
      select.appendChild(empty);
      for (const value of values) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }
      select.value = values.includes(current) ? current : "";
    }

    function formatError(data) {
      if (data.error) return data.error;
      if (Array.isArray(data.issues)) return data.issues.map((issue) => issue.path + ": " + issue.message).join("\\n");
      return "Render failed.";
    }
    function setStatus(message) { status.classList.remove("error"); status.textContent = message; }
    function setError(message) { status.classList.add("error"); status.textContent = message; }
  </script>
</body>
</html>`;
}

async function renderRaster(doc, outputPath, format, options) {
  const sharp = loadSharp();
  const frame = frameDocument(doc, options);
  if (frame.document.canvas.renderer === "three") {
    const tempDir = format === "png" ? undefined : fs.mkdtempSync(path.join(os.tmpdir(), "sketchmark-three-shot-"));
    const pngPath = format === "png" ? outputPath : path.join(tempDir, "frame.png");
    try {
      await captureThreeFrames(frame.document, [{ time: frame.localTime, outputPath: pngPath }], options);
      if (format !== "png") {
        await sharp(pngPath).flatten({ background: doc.canvas.background || "#ffffff" }).jpeg({ quality: 92 }).toFile(outputPath);
      }
    } finally {
      if (tempDir) removeTempDir(tempDir);
    }
    return;
  }
  const svg = core.renderToSvg(frame.document, { time: frame.localTime, transparent: options.transparent });
  const image = sharp(Buffer.from(svg));
  if (format === "png") {
    await image.png().toFile(outputPath);
  } else {
    await image.flatten({ background: doc.canvas.background || "#ffffff" }).jpeg({ quality: 92 }).toFile(outputPath);
  }
}

async function renderPdf(doc, outputPath, options) {
  const frame = frameDocument(doc, options);
  const sharp = loadSharp();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketchmark-pdf-"));
  try {
    const jpgPath = path.join(tempDir, "page.jpg");
    await renderRaster(doc, jpgPath, "jpg", { scene: options.scene, sequence: options.sequence, time: options.time ?? 0, browser: options.browser });
    const jpeg = fs.readFileSync(jpgPath);
    const metadata = await sharp(jpeg).metadata();
    writeJpegPdf(outputPath, jpeg, metadata.width || frame.document.canvas.width, metadata.height || frame.document.canvas.height);
  } finally {
    removeTempDir(tempDir);
  }
}

async function renderPptx(doc, outputPath, options) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketchmark-pptx-"));
  try {
    const slides = await pptxSlides(doc, tempDir, options);
    writePptx(outputPath, slides, doc.canvas.width, doc.canvas.height);
  } finally {
    removeTempDir(tempDir);
  }
}

async function pptxSlides(doc, tempDir, options) {
  const slides = [];
  if (options.deck) {
    const sceneId = options.scene || firstSceneId(doc);
    if (!sceneId) throw new Error("--deck requires a scene with steps.");
    const scene = doc.scenes?.[sceneId];
    const count = Math.max(1, (scene?.steps?.length ?? 0) + 1);
    for (let index = 0; index < count; index += 1) {
      const frame = index === 0 ? core.documentForScene(doc, sceneId) : core.documentForDeckStep(doc, sceneId, index - 1);
      slides.push(await renderDocumentPng(frame, path.join(tempDir, `slide-${index + 1}.png`), options));
    }
    return slides;
  }
  if (options.sequence) {
    const sequence = core.compileVisualSequence(doc, options.sequence);
    for (const clip of sequence.clips) {
      const frame = core.documentForSequenceTime(doc, options.sequence, clip.start);
      slides.push(await renderDocumentPng(frame.document, path.join(tempDir, `slide-${slides.length + 1}.png`), options));
    }
    return slides;
  }
  const frame = options.scene ? core.documentForScene(doc, options.scene) : frameDocument(doc, options).document;
  slides.push(await renderDocumentPng(frame, path.join(tempDir, "slide-1.png"), options));
  return slides;
}

async function renderDocumentPng(document, outputPath, options) {
  const sharp = loadSharp();
  if (document.canvas.renderer === "three") {
    await captureThreeFrames(document, [{ time: options.time ?? 0, outputPath }], options);
    return fs.readFileSync(outputPath);
  }
  const svg = core.renderToSvg(document, { time: options.time ?? 0, transparent: options.transparent });
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  return fs.readFileSync(outputPath);
}

async function renderMp4(doc, outputPath, options) {
  await renderVideoFrames(doc, options, (frameDir, fps) => {
    runFfmpeg([
      "-y",
      "-framerate",
      String(fps),
      "-i",
      path.join(frameDir, "frame-%05d.png"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-vf",
      "pad=ceil(iw/2)*2:ceil(ih/2)*2",
      outputPath
    ]);
  }, outputPath);
}

async function renderWebm(doc, outputPath, options) {
  await renderVideoFrames(doc, options, (frameDir, fps) => {
    runFfmpeg([
      "-y",
      "-framerate",
      String(fps),
      "-i",
      path.join(frameDir, "frame-%05d.png"),
      "-c:v",
      "libvpx-vp9",
      "-pix_fmt",
      options.transparent ? "yuva420p" : "yuv420p",
      "-auto-alt-ref",
      options.transparent ? "0" : "1",
      outputPath
    ]);
  }, outputPath);
}

async function renderVideoFrames(doc, options, encode, outputPath) {
  const fps = Math.max(1, Math.round(options.fps || 30));
  const defaultDuration = options.sequence ? core.compileVisualSequence(doc, options.sequence).duration : options.scene ? frameDocument(doc, { scene: options.scene, time: 0 }).duration : doc.canvas.duration;
  const duration = Math.max(0.001, Number(options.duration || defaultDuration || 1));
  const frameCount = Math.max(1, Math.ceil(duration * fps));
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketchmark-json-frames-"));
  const sharp = loadSharp();
  const threeGroups = new Map();
  try {
    for (let index = 0; index < frameCount; index += 1) {
      const time = index / fps;
      const framePath = path.join(frameDir, `frame-${String(index + 1).padStart(5, "0")}.png`);
      const frame = frameDocument(doc, { scene: options.scene, sequence: options.sequence, time });
      if (frame.document.canvas.renderer === "three") {
        const key = frame.scene || frame.sequenceId || "__document";
        const group = threeGroups.get(key) || { document: frame.document, requests: [] };
        group.requests.push({ time: frame.localTime, outputPath: framePath });
        threeGroups.set(key, group);
      } else {
        const svg = core.renderToSvg(frame.document, { time: frame.localTime, transparent: options.transparent });
        await sharp(Buffer.from(svg)).png().toFile(framePath);
      }
    }
    for (const group of threeGroups.values()) {
      await captureThreeFrames(group.document, group.requests, options);
    }
    encode(frameDir, fps);
    if (options.keepFrames) {
      const kept = `${outputPath}.frames`;
      if (fs.existsSync(kept)) fs.rmSync(kept, { recursive: true, force: true });
      fs.renameSync(frameDir, kept);
      console.log(`Kept frames: ${kept}`);
      return;
    }
  } finally {
    if (!options.keepFrames && fs.existsSync(frameDir)) fs.rmSync(frameDir, { recursive: true, force: true });
  }
}

async function renderBrowserImage(doc, outputPath, options) {
  const html = core.renderToHtml(doc, { time: options.time || 0 });
  const browser = findBrowser(options.browser);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketchmark-browser-"));
  try {
    const htmlPath = path.join(tempDir, "frame.html");
    const capturePath = path.join(tempDir, "capture.png");
    fs.writeFileSync(htmlPath, html, "utf8");
    runBrowser(browser, [
      "--headless",
      "--disable-gpu",
      "--disable-gpu-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${path.join(tempDir, "profile")}`,
      `--window-size=${Math.round(doc.canvas.width)},${Math.round(doc.canvas.height)}`,
      "--run-all-compositor-stages-before-draw",
      `--screenshot=${capturePath}`,
      pathToFileURL(htmlPath).href
    ]);
    if (!fs.existsSync(capturePath)) throw new Error("Browser capture did not produce a PNG file.");
    fs.copyFileSync(capturePath, outputPath);
  } finally {
    removeTempDir(tempDir);
  }
}

async function renderBrowserPdfHtml(html, outputPath, canvas, options) {
  const browser = findBrowser(options.browser);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketchmark-browser-"));
  try {
    const htmlPath = path.join(tempDir, "page.html");
    const capturePath = path.join(tempDir, "capture.pdf");
    fs.writeFileSync(htmlPath, html, "utf8");
    runBrowser(browser, [
      "--headless",
      "--disable-gpu",
      "--disable-gpu-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${path.join(tempDir, "profile")}`,
      `--window-size=${Math.round(canvas.width)},${Math.round(canvas.height)}`,
      `--print-to-pdf=${capturePath}`,
      pathToFileURL(htmlPath).href
    ]);
    if (!fs.existsSync(capturePath)) throw new Error("Browser capture did not produce a PDF file.");
    fs.copyFileSync(capturePath, outputPath);
  } finally {
    removeTempDir(tempDir);
  }
}

async function captureThreeFrames(document, frames, options = {}) {
  if (!frames.length) return;
  const browser = findBrowser(options.browser);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketchmark-three-cdp-"));
  const userDataDir = path.join(tempDir, "profile");
  const htmlPath = path.join(tempDir, "scene.html");
  const width = Math.ceil(document.canvas.width);
  const height = Math.ceil(document.canvas.height);
  const html = core.renderToHtml(document, {
    transparent: options.transparent,
    threeRuntime: "/three.module.js"
  });

  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(htmlPath, html, "utf8");
  const server = await startThreeExportServer(tempDir);
  const browserProcess = spawn(browser, [
    "--headless=new",
    "--hide-scrollbars",
    "--mute-audio",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-gpu-sandbox",
    "--enable-unsafe-swiftshader",
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`,
    server.url
  ], { stdio: "pipe" });
  const stderr = [];
  browserProcess.stderr?.on("data", (chunk) => stderr.push(chunk));

  let cdp;
  try {
    const port = await readDevToolsPort(userDataDir);
    const targets = await httpJson(`http://127.0.0.1:${port}/json/list`);
    const target = Array.isArray(targets) ? targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl) : undefined;
    if (!target) throw new Error("Could not find a Chromium page target for renderer: three export.");

    cdp = await connectCdp(target.webSocketDebuggerUrl, () => Buffer.concat(stderr).toString("utf8"));
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: server.url });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    });
    await waitForThreeReady(cdp);

    for (const frame of frames) {
      await cdp.send("Runtime.evaluate", {
        expression: `window.__SKETCHMARK_SHOW_TIME__(${JSON.stringify(frame.time)})`,
        awaitPromise: true
      });
      await cdp.send("Runtime.evaluate", {
        expression: "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
        awaitPromise: true
      });
      const clip = await canvasClip(cdp, width, height);
      const screenshot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        clip
      });
      fs.writeFileSync(frame.outputPath, Buffer.from(screenshot.data, "base64"));
    }
  } finally {
    cdp?.close();
    await stopProcess(browserProcess);
    await server.close();
    removeTempDir(tempDir);
  }
}

async function waitForThreeReady(cdp) {
  const deadline = Date.now() + 30_000;
  let lastError = "";
  while (Date.now() < deadline) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: "({ ready: Boolean(window.__SKETCHMARK_READY__ && window.__SKETCHMARK_SHOW_TIME__), error: window.__SKETCHMARK_ERROR__ || '' })",
      returnByValue: true
    });
    const value = result.result?.value || {};
    if (value.ready === true) return;
    if (value.error) lastError = String(value.error);
    await delay(100);
  }
  let debug = "";
  try {
    const result = await cdp.send("Runtime.evaluate", {
      expression: "({ href: location.href, readyState: document.readyState, title: document.title, body: document.body ? document.body.innerText.slice(0, 200) : '', scripts: document.scripts.length, error: window.__SKETCHMARK_ERROR__ || '', resources: performance.getEntriesByType('resource').map(r => ({ name: r.name, transferSize: r.transferSize, duration: Math.round(r.duration) })).slice(0, 8) })",
      returnByValue: true
    });
    debug = JSON.stringify(result.result?.value || {});
  } catch {
    // Keep the original timeout message if Chromium is already gone.
  }
  throw new Error(lastError
    ? `Timed out waiting for renderer: three page to become ready. Browser error: ${lastError}`
    : `Timed out waiting for renderer: three page to become ready.${debug ? ` Debug: ${debug}` : ""}`);
}

async function canvasClip(cdp, fallbackWidth, fallbackHeight) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const canvas = document.getElementById("stage");
      if (!canvas) return { x: 0, y: 0, width: ${fallbackWidth}, height: ${fallbackHeight}, scale: 1 };
      const r = canvas.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 };
    })()`,
    returnByValue: true
  });
  const value = result.result?.value ?? {};
  return {
    x: Math.max(0, Number(value.x || 0)),
    y: Math.max(0, Number(value.y || 0)),
    width: Math.max(1, Number(value.width || fallbackWidth)),
    height: Math.max(1, Number(value.height || fallbackHeight)),
    scale: 1
  };
}

async function readDevToolsPort(userDataDir) {
  const filePath = path.join(userDataDir, "DevToolsActivePort");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) {
      const text = fs.readFileSync(filePath, "utf8");
      const port = Number(text.split(/\r?\n/)[0]);
      if (Number.isFinite(port) && port > 0) return port;
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for Chromium DevTools port.");
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

class CdpClient {
  constructor(socket, diagnostics = () => "") {
    this.socket = socket;
    this.diagnostics = diagnostics;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    this.socket.write(encodeWsFrame(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  handleData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const opcode = first & 0x0f;
      const masked = Boolean(second & 0x80);
      let length = second & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.buffer.length < offset + 2) return;
        length = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return;
        length = Number(this.buffer.readBigUInt64BE(offset));
        offset += 8;
      }

      let mask;
      if (masked) {
        if (this.buffer.length < offset + 4) return;
        mask = this.buffer.slice(offset, offset + 4);
        offset += 4;
      }

      if (this.buffer.length < offset + length) return;
      let payload = this.buffer.slice(offset, offset + length);
      this.buffer = this.buffer.slice(offset + length);

      if (masked && mask) payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
      if (opcode === 8) {
        this.close();
        return;
      }
      if (opcode === 9) {
        this.socket.write(encodeWsFrame(payload, 0x0a));
        continue;
      }
      if (opcode !== 1) continue;

      const message = JSON.parse(payload.toString("utf8"));
      if (!message.id) continue;
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || "Chrome DevTools Protocol error."));
      else pending.resolve(message.result);
    }
  }

  close() {
    const details = this.diagnostics();
    const message = details.trim()
      ? `Chrome DevTools connection closed.\n${details.trim()}`
      : "Chrome DevTools connection closed.";
    for (const pending of this.pending.values()) pending.reject(new Error(message));
    this.pending.clear();
    this.socket.destroy();
  }
}

function connectCdp(wsUrl, diagnostics) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(wsUrl);
    const socket = net.connect(Number(parsed.port), parsed.hostname);
    const client = new CdpClient(socket, diagnostics);
    const key = crypto.randomBytes(16).toString("base64");
    let handshake = Buffer.alloc(0);

    const fail = (error) => {
      socket.destroy();
      reject(error);
    };

    socket.once("error", fail);
    socket.once("connect", () => {
      socket.write([
        `GET ${parsed.pathname}${parsed.search} HTTP/1.1`,
        `Host: ${parsed.host}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "",
        ""
      ].join("\r\n"));
    });

    const onData = (chunk) => {
      handshake = Buffer.concat([handshake, chunk]);
      const end = handshake.indexOf("\r\n\r\n");
      if (end === -1) return;

      const header = handshake.slice(0, end).toString("utf8");
      if (!/^HTTP\/1\.1 101/.test(header)) {
        fail(new Error(`Unexpected DevTools WebSocket response: ${header.split(/\r?\n/)[0]}`));
        return;
      }

      socket.off("data", onData);
      socket.off("error", fail);
      socket.on("data", (data) => client.handleData(data));
      socket.on("error", () => client.close());

      const rest = handshake.slice(end + 4);
      if (rest.length) client.handleData(rest);
      resolve(client);
    };

    socket.on("data", onData);
  });
}

function encodeWsFrame(payload, opcode = 0x01) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const mask = crypto.randomBytes(4);
  let header;

  if (data.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | data.length;
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }

  const masked = Buffer.alloc(data.length);
  for (let index = 0; index < data.length; index += 1) {
    masked[index] = data[index] ^ mask[index % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopProcess(child) {
  if (!child || child.exitCode !== null || child.killed) return Promise.resolve();
  child.kill();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 1500);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function startThreeExportServer(tempDir) {
  const threeBuildDir = findThreeBuildDir();
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(requestUrl.pathname);
      const filePath = pathname.startsWith("/three.")
        ? path.join(threeBuildDir, path.basename(pathname))
        : path.resolve(tempDir, pathname === "/" ? "scene.html" : pathname.slice(1));
      const allowed = filePath.startsWith(threeBuildDir) || filePath.startsWith(tempDir);
      if (!allowed || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "content-type": mimeType(filePath), "cache-control": "no-store" });
      response.end(fs.readFileSync(filePath));
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/scene.html`,
        close: () => new Promise((done) => server.close(() => done()))
      });
    });
  });
}

function findThreeRuntimePath() {
  return path.join(findThreeBuildDir(), "three.module.js");
}

function threeBuildFile(requestPath) {
  const filePath = path.join(findThreeBuildDir(), path.basename(requestPath));
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Could not find Three runtime file '${requestPath}'.`);
  }
  return filePath;
}

function findThreeBuildDir() {
  const candidates = [
    path.resolve(__dirname, "..", "node_modules", "three", "build"),
    path.resolve(__dirname, "..", "..", "node_modules", "three", "build"),
    path.resolve(__dirname, "..", "..", "sketchmark-core", "node_modules", "three", "build")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "three.module.js"))) return candidate;
  }
  const pnpmRoot = path.resolve(__dirname, "..", "..", "node_modules", ".pnpm");
  if (fs.existsSync(pnpmRoot)) {
    for (const name of fs.readdirSync(pnpmRoot)) {
      const candidate = path.join(pnpmRoot, name, "node_modules", "three", "build");
      if (name.startsWith("three@") && fs.existsSync(path.join(candidate, "three.module.js"))) return candidate;
    }
  }
  throw new Error("Could not find three.module.js. Install three in the workspace or keep sketchmark-core/node_modules available.");
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

function removeTempDir(tempDir) {
  if (!fs.existsSync(tempDir)) return;
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Browser profile crash reporters can keep a handle briefly on Windows.
  }
}

function writeJpegPdf(outputPath, jpeg, width, height) {
  const objects = [];
  const add = (body) => {
    const id = objects.length + 1;
    objects.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), "binary"));
    return id;
  };
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  add(Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, "binary"),
    jpeg,
    Buffer.from("\nendstream", "binary")
  ]));
  const content = Buffer.from(`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ`, "binary");
  add(`<< /Length ${content.length} >>\nstream\n${content.toString("binary")}\nendstream`);

  const chunks = [Buffer.from("%PDF-1.4\n", "binary")];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`, "binary"), objects[index], Buffer.from("\nendobj\n", "binary"));
  }
  const xrefOffset = Buffer.concat(chunks).length;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (let index = 1; index < offsets.length; index += 1) {
    xref.push(`${String(offsets[index]).padStart(10, "0")} 00000 n `);
  }
  chunks.push(Buffer.from(`${xref.join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, "binary"));
  fs.writeFileSync(outputPath, Buffer.concat(chunks));
}

function writePptx(outputPath, slideImages, width, height) {
  const slideWidth = Math.round(width * 9525);
  const slideHeight = Math.round(height * 9525);
  const files = new Map();
  const contentTypes = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Default Extension="png" ContentType="image/png"/>',
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ...slideImages.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`),
    '</Types>'
  ].join("");

  files.set("[Content_Types].xml", contentTypes);
  files.set("_rels/.rels", rels([{ id: "rId1", type: "officeDocument", target: "ppt/presentation.xml" }, { id: "rId2", type: "metadata/core-properties", target: "docProps/core.xml" }, { id: "rId3", type: "extended-properties", target: "docProps/app.xml" }]));
  files.set("docProps/core.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Sketchmark Export</dc:title></cp:coreProperties>');
  files.set("docProps/app.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Sketchmark</Application></Properties>');
  files.set("ppt/presentation.xml", presentationXml(slideImages.length, slideWidth, slideHeight));
  files.set("ppt/_rels/presentation.xml.rels", rels([
    ...slideImages.map((_, index) => ({ id: `rId${index + 1}`, type: "slide", target: `slides/slide${index + 1}.xml` })),
    { id: `rId${slideImages.length + 1}`, type: "slideMaster", target: "slideMasters/slideMaster1.xml" },
    { id: `rId${slideImages.length + 2}`, type: "theme", target: "theme/theme1.xml" }
  ]));
  files.set("ppt/slideMasters/slideMaster1.xml", masterXml());
  files.set("ppt/slideMasters/_rels/slideMaster1.xml.rels", rels([{ id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" }]));
  files.set("ppt/slideLayouts/slideLayout1.xml", layoutXml());
  files.set("ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels([{ id: "rId1", type: "slideMaster", target: "../slideMasters/slideMaster1.xml" }]));
  files.set("ppt/theme/theme1.xml", themeXml());
  for (const [index, image] of slideImages.entries()) {
    files.set(`ppt/media/image${index + 1}.png`, image);
    files.set(`ppt/slides/slide${index + 1}.xml`, slideXml(index + 1, slideWidth, slideHeight));
    files.set(`ppt/slides/_rels/slide${index + 1}.xml.rels`, rels([{ id: "rId1", type: "image", target: `../media/image${index + 1}.png` }]));
  }
  fs.writeFileSync(outputPath, zipStore(files));
}

function rels(items) {
  const typePrefix = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
  const packagePrefix = "http://schemas.openxmlformats.org/package/2006/relationships/";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${packagePrefix}">${items.map((item) => `<Relationship Id="${item.id}" Type="${item.type.startsWith("http") ? item.type : `${typePrefix}${item.type}`}" Target="${item.target}"/>`).join("")}</Relationships>`;
}

function presentationXml(count, width, height) {
  const ids = Array.from({ length: count }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId${count + 1}"/></p:sldMasterIdLst><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="${width}" cy="${height}" type="custom"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
}

function slideXml(index, width, height) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/><a:chOff x="0" y="0"/><a:chExt cx="${width}" cy="${height}"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="slide${index}.png"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function masterXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:sldMaster>';
}

function layoutXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';
}

function themeXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Sketchmark"><a:themeElements><a:clrScheme name="Sketchmark"><a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="22C55E"/></a:accent2><a:accent3><a:srgbClr val="EF4444"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="8B5CF6"/></a:accent5><a:accent6><a:srgbClr val="06B6D4"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Sketchmark"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="Sketchmark"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>';
}

function zipStore(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, value] of files.entries()) {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
    const filename = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, filename, data);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0, 8);
    directory.writeUInt16LE(0, 10);
    directory.writeUInt16LE(0, 12);
    directory.writeUInt16LE(0, 14);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt16LE(0, 30);
    directory.writeUInt16LE(0, 32);
    directory.writeUInt16LE(0, 34);
    directory.writeUInt16LE(0, 36);
    directory.writeUInt32LE(0, 38);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += local.length + filename.length + data.length;
  }
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, ...central, end]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function runBrowser(browser, args) {
  if (process.platform === "win32" && path.isAbsolute(browser)) {
    const script = `$exe=${psQuote(browser)};$args=@(${args.map(psQuote).join(",")});& $exe @args;exit $LASTEXITCODE`;
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-EncodedCommand", encoded], { stdio: "ignore", timeout: 30000 });
    if (result.error) throw new Error(`Browser capture failed: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`Browser capture failed with exit code ${result.status}.`);
    return;
  }
  const result = spawnSync(browser, args, { stdio: "ignore", timeout: 30000 });
  if (result.error) throw new Error(`Browser capture failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Browser capture failed with exit code ${result.status}.`);
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function findBrowser(explicit) {
  const candidates = [
    explicit,
    process.env.SKETCHMARK_BROWSER,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "msedge",
    "chrome",
    "chromium",
    "google-chrome"
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
    if (!path.isAbsolute(candidate)) return candidate;
  }
  throw new Error("PNG/PDF capture for browser-rendered documents requires Edge or Chrome. Pass --browser <path> or set SKETCHMARK_BROWSER.");
}

function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", args, { stdio: "pipe", encoding: "utf8" });
  if (result.error) throw new Error(`ffmpeg is required for MP4 export: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr || result.stdout}`);
}

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    // Continue below.
  }

  const pnpmRoot = path.resolve(__dirname, "..", "..", "node_modules", ".pnpm");
  if (fs.existsSync(pnpmRoot)) {
    const candidates = fs.readdirSync(pnpmRoot).filter((name) => name.startsWith("sharp@"));
    for (const candidate of candidates) {
      const sharpPath = path.join(pnpmRoot, candidate, "node_modules", "sharp");
      try {
        return require(sharpPath);
      } catch {
        // Try the next platform candidate.
      }
    }
  }

  throw new Error("sharp is required for PNG/JPG/MP4 rendering. Install sharp in the workspace.");
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

function send(response, status, body, type) {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  response.end(body);
}

function sendJson(response, status, body) {
  send(response, status, JSON.stringify(body), "application/json; charset=utf-8");
}

function sendDownloadFile(response, filePath, downloadName, contentType, warnings, cleanup) {
  let cleaned = false;
  const finish = () => {
    if (cleaned) return;
    cleaned = true;
    cleanup();
  };
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    finish();
    if (!response.headersSent) send(response, 404, "File not found", "text/plain; charset=utf-8");
    else response.destroy();
  });
  response.on("finish", finish);
  response.on("close", finish);
  response.writeHead(200, {
    "content-type": contentType,
    "content-disposition": `attachment; filename="${downloadName.replace(/["\\]/g, "_")}"`,
    "cache-control": "no-store",
    "x-sketchmark-warnings": encodeURIComponent(JSON.stringify(warnings || []))
  });
  stream.pipe(response);
}

function readRequestBody(request, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function openBrowser(url) {
  const command = process.platform === "win32"
    ? "cmd"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", detached: true, shell: false });
  child.unref();
}

function inferFormat(outputPath) {
  const ext = path.extname(outputPath).toLowerCase().replace(".", "");
  if (ext === "jpeg") return "jpg";
  if (["svg", "html", "png", "jpg", "pdf", "pptx", "mp4", "webm"].includes(ext)) return ext;
  throw new Error(`Cannot infer output format from '${outputPath}'.`);
}

function numberOption(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function stringOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1] ? String(args[index + 1]) : undefined;
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
