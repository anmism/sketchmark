"use strict";

const fs = require("node:fs");
const path = require("node:path");

function editorHtml(title, options = {}) {
  const apiBase = normalizeApiBase(options.apiBase || "/api");
  const mp4MuxerUrl = options.mp4MuxerUrl || "";
  const mp4MuxerSource = mp4MuxerUrl ? "" : resolveMp4MuxerSource(options.mp4MuxerSource);
  const serverExportFallback = options.serverExportFallback !== false;
  const canvasStageRender = options.canvasStageRender === true;
  const localDocumentControls = options.localDocumentControls === true;
  const bootstrapScript = typeof options.bootstrapScript === "string" ? options.bootstrapScript : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sketchmark Editor - ${escapeHtml(title)}</title><style>
@font-face{font-family:'Roboto';src:url('/fonts/Roboto-Light.ttf') format('truetype');font-weight:300;font-style:normal;font-display:swap}
@font-face{font-family:'Roboto';src:url('/fonts/Roboto-Regular.ttf') format('truetype');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Roboto';src:url('/fonts/Roboto-Bold.ttf') format('truetype');font-weight:700;font-style:normal;font-display:swap}
html,body{margin:0;width:100%;height:100%;font:13px Roboto,Arial,sans-serif;background:#c0c0c0;color:#000;overflow:hidden}
body{display:grid;grid-template-columns:240px 1fr 300px;grid-template-rows:1fr 165px;min-width:900px;overflow:hidden}
button,input,select,textarea{font:13px Roboto,Arial,sans-serif}
button{padding:3px 8px}
input,select,textarea{box-sizing:border-box;width:100%}
textarea{min-height:88px;padding:4px;resize:vertical}
#tree,#inspector,#timeline{background:#f3f4f6;border:1px solid #c6ccd6;overflow:auto;padding:6px;scrollbar-width:none;-ms-overflow-style:none}
#tree{grid-row:1/3}
#stageWrap{position:relative;display:grid;place-items:center;min-width:0;min-height:0;padding:0;background:#fff;overflow:hidden;cursor:default}
#stageWrap.panning{cursor:grabbing}
#stage{display:grid;place-items:center;min-width:0;min-height:0;position:relative}
#stage svg{max-width:100%;max-height:calc(100vh - 190px);background:white;border:1px solid #333;overflow:visible}
${canvasStageRender ? `#stage.sketchmarkCanvasStage{display:block;position:relative;line-height:0;background:white;border:1px solid #333;box-sizing:content-box}
#stageCanvas{display:block;background:white}
#stage.sketchmarkCanvasStage>svg{position:absolute;left:0;top:0;width:100%;height:100%;max-width:none;max-height:none;background:transparent;border:0;box-sizing:border-box;z-index:2;pointer-events:auto}
#stage.sketchmarkCanvasStage>svg:not(#stageLiveSvg)>*:not(defs):not(#__sketchmark_handles):not(#__sketchmark_drag_preview){opacity:0}
#stage.sketchmarkCanvasStage>svg:not(#stageLiveSvg) #__sketchmark_handles,#stage.sketchmarkCanvasStage>svg:not(#stageLiveSvg) #__sketchmark_drag_preview{opacity:1}
#stage.sketchmarkCanvasStage.canvasStageRendering>svg:not(#stageLiveSvg) #__sketchmark_handles,#stage.sketchmarkCanvasStage.canvasStageRendering>svg:not(#stageLiveSvg) #__sketchmark_drag_preview{opacity:0}
#stage.sketchmarkCanvasStage>#stageLiveSvg{display:none;position:absolute;left:0;top:0;width:100%;height:100%;max-width:none;max-height:none;background:transparent;border:0;box-sizing:border-box;z-index:1;pointer-events:none;overflow:visible}
#stage.sketchmarkCanvasStage.liveSvgDrag>#stageCanvas{visibility:hidden}
#stage.sketchmarkCanvasStage.liveSvgDrag>#stageLiveSvg{display:block}
#stage.sketchmarkCanvasStage.liveSvgScrub>#stageCanvas{visibility:hidden}
#stage.sketchmarkCanvasStage.liveSvgScrub>svg:not(#stageLiveSvg)>*:not(defs):not(#__sketchmark_handles):not(#__sketchmark_drag_preview){opacity:1}
#stage.sketchmarkCanvasStage.liveSvgScrub>svg:not(#stageLiveSvg) #__sketchmark_handles,#stage.sketchmarkCanvasStage.liveSvgScrub>svg:not(#stageLiveSvg) #__sketchmark_drag_preview{opacity:1}` : ""}
${localDocumentControls ? `.browserFileGrid{display:grid;gap:6px}
.browserFileActions{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.browserFileInput{font-size:12px}
.browserStatus{font-size:11px;color:#374151;min-height:14px}` : ""}
#viewportHud{position:absolute;right:12px;bottom:12px;display:flex;flex-direction:column;gap:6px;align-items:stretch;padding:6px;background:rgba(238,238,238,.95);border:1px solid #8f96a3;z-index:3}
#viewportHud button{padding:1px 8px;min-width:42px}
#zoomLabel{min-width:42px;text-align:center;font-weight:bold;color:#111827}
#timeline{grid-column:2/4}
.row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0}
.row label{display:block}
.colorField{display:grid;grid-template-columns:34px 1fr;gap:6px;align-items:center}
.colorField input[type=color]{width:34px;height:28px;padding:0;border:1px solid #8f96a3;background:#fff;cursor:pointer}
.stack{display:grid;gap:5px}.section{margin:0 0 10px}.label{display:block;font-weight:bold;margin:0 0 3px}
.panelGroup{margin:0 0 8px;border:1px solid #c9cfdb;background:#f8fafc}
.panelGroup > summary{list-style:none;cursor:pointer;padding:6px 8px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;gap:8px}
.panelGroup > summary::-webkit-details-marker{display:none}
.panelGroup > summary::after{content:"+";font-weight:bold;color:#4b5563}
.panelGroup[open] > summary::after{content:"-"}
.panelGroup > summary .summaryMeta{font-size:11px;color:#4b5563;font-weight:normal;margin-left:auto}
.panelBody{padding:6px 8px;border-top:1px solid #d8dee8}
.subhead{display:block;font-size:11px;font-weight:bold;color:#374151;margin:6px 0 2px}
.treeRow{display:grid;grid-template-columns:16px 20px 20px 1fr;gap:3px;align-items:center;margin:1px 0}
.treePad{display:block;width:16px;height:20px}
.treeCtl{height:20px;padding:0;border:1px solid #9aa1ad;background:#f8fafc;cursor:pointer;line-height:18px;font-size:11px}
.treeCtl.active{background:#003399;color:#fff;border-color:#003399}
.canvasError{color:#900;font-size:11px;min-height:14px}
.treeBtn{display:block;width:100%;text-align:left;margin:0;border:1px solid transparent;background:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px 6px}
.treeBtn.dim{opacity:0.6}
.treeBtn.selected{background:#003399;color:white}.muted{color:#555}.track{border:1px solid #888;background:#ddd;padding:5px;margin:4px 0}
.trackName{display:block;font-weight:bold;margin-bottom:4px}
.trackLine{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.kf{display:inline-flex;align-items:center;gap:4px;padding:2px 4px;background:#eee;border:1px solid #999;cursor:pointer}.kf button{padding:0 4px;margin:0}
.segBadge{padding:1px 6px;border:1px solid #8f96a3;background:#f9fbff;font-size:11px;cursor:pointer}
.segBadge.active{background:#003399;color:#fff;border-color:#003399}
.curvePanel{border:1px solid #777;background:#ececec;padding:6px;margin-top:6px}
.curvePanelHead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
.curvePanelTitle{font-weight:bold}
.curvePanelRange{font-size:11px;color:#333}
.curvePreview{width:100%;height:120px;border:1px solid #9aa1ad;background:#fff;margin-bottom:6px;overflow:hidden}
.curvePreview svg{display:block;width:100%;height:100%;overflow:hidden}
.curvePresets{display:flex;flex-wrap:wrap;gap:6px}
.curvePreset{padding:2px 8px;border:1px solid #8f96a3;background:#f9fbff;cursor:pointer}
.curvePreset.active{background:#003399;color:#fff;border-color:#003399}
.curveCustom{border:1px solid #b8bcc4;background:#f7f7f7;padding:6px;margin-top:6px}
.curveCustomLabel{display:block;font-size:11px;color:#333;margin-bottom:4px}
.curveCustomFields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.curveCustom textarea{width:100%;height:56px;box-sizing:border-box;font:12px Consolas,monospace}
.modalBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:9999}
.modalBackdrop.hidden{display:none}
.curveModal{width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;border:2px outset #ddd;background:#ececec;padding:8px;scrollbar-width:none;-ms-overflow-style:none}
.curveModalBar{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
.curveModalContent .curvePanel{margin-top:0}
#tree::-webkit-scrollbar,#inspector::-webkit-scrollbar,#timeline::-webkit-scrollbar,.curveModal::-webkit-scrollbar{width:0;height:0}
#error{color:#900;min-height:18px;margin-top:6px}.tiny{font-size:11px;color:#444}.toolbar{display:grid;grid-template-columns:auto 1fr auto auto;gap:6px;align-items:center}
.exportButtons{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.exportButtons button{width:100%;text-align:left;padding:4px 6px}
.exportButtons button.exportWide{grid-column:1/3}
</style></head><body><aside id="tree"></aside><main id="stageWrap"><div id="stage"></div><div id="viewportHud"><button id="zoomOut" type="button" title="Zoom out">-</button><button id="zoomIn" type="button" title="Zoom in">+</button><button id="zoomFit" type="button" title="Reset zoom and pan">Fit</button><span id="zoomLabel">100%</span></div></main><aside id="inspector"></aside><section id="timeline"></section><div id="curveModalBackdrop" class="modalBackdrop hidden"><div id="curveModal" class="curveModal" role="dialog" aria-modal="true" aria-label="Interpolation Graph"><div class="curveModalBar"><strong>Interpolation Graph</strong><button id="curveModalClose" type="button">Close</button></div><div id="curveModalContent" class="curveModalContent"></div></div></div>${bootstrapScript ? `<script>\n${bootstrapScript}\n</script>` : ""}<script>
const tree = document.getElementById("tree");
const stageWrap = document.getElementById("stageWrap");
const stage = document.getElementById("stage");
const zoomOut = document.getElementById("zoomOut");
const zoomIn = document.getElementById("zoomIn");
const zoomFit = document.getElementById("zoomFit");
const zoomLabel = document.getElementById("zoomLabel");
const inspector = document.getElementById("inspector");
const timeline = document.getElementById("timeline");
const curveModalBackdrop = document.getElementById("curveModalBackdrop");
const curveModal = document.getElementById("curveModal");
const curveModalContent = document.getElementById("curveModalContent");
const curveModalClose = document.getElementById("curveModalClose");
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
let drawRequestId = 0;
let drag = null;
let suppressClick = false;
const FONT_FAMILY_OPTIONS = [
  { label: "Roboto (Local)", value: "Roboto, Arial, sans-serif" }
];
const FONT_WEIGHT_OPTIONS = [
  { label: "300", value: "300" },
  { label: "400", value: "400" },
  { label: "500", value: "500" },
  { label: "600", value: "600" },
  { label: "700", value: "700" }
];
let collapsedGroups = new Set();
let hiddenIds = new Set();
let lockedIds = new Set();
let parentById = Object.create(null);
let childIdsById = Object.create(null);
let typeById = Object.create(null);
let sidebarCommitTimers = Object.create(null);
let selectedSegment = null;
let panelOpenState = Object.create(null);
let viewport = { initialized: false, baseWidth: 1, baseHeight: 1, x: 0, y: 0, width: 1, height: 1 };
let viewportPan = null;
let spacePanActive = false;
const API_BASE = ${scriptJson(apiBase)};
const EDITOR_TITLE = ${scriptJson(title || "sketchmark")};
const MP4_MUXER_URL = ${scriptJson(mp4MuxerUrl)};
const MP4_MUXER_SOURCE = ${scriptJson(mp4MuxerSource)};
const SERVER_EXPORT_FALLBACK = ${scriptJson(serverExportFallback)};
const CANVAS_STAGE_RENDER = ${scriptJson(canvasStageRender)};
const LOCAL_DOCUMENT_CONTROLS = ${scriptJson(localDocumentControls)};
let mp4MuxerObjectUrl = "";

let canvasStageRenderToken = 0;
let canvasStageRenderScheduled = false;
let pendingCanvasStageCanvas = null;
let liveDragPreviewPendingClear = false;
let canvasStageRenderedViewport = null;
let canvasStageSourceSvg = "";
let canvasStageSourceImage = null;
let scrubPreviewActive = false;
let scrubPointerActive = false;
let scrubPreviewTimer = 0;

function requestVisibleCanvasStageRender(canvas) {
  if (!CANVAS_STAGE_RENDER || !canvas) return;
  pendingCanvasStageCanvas = canvas;
  syncCanvasStageLayout(canvas);
  if (scrubPreviewActive) return;
  if (canvasStageRenderScheduled) return;
  canvasStageRenderScheduled = true;
  requestAnimationFrame(() => {
    canvasStageRenderScheduled = false;
    renderVisibleCanvasStage(pendingCanvasStageCanvas);
  });
}

function setStageOverlaySvg(svgMarkup) {
  const template = document.createElement("template");
  template.innerHTML = String(svgMarkup || "").trim();
  const nextSvg = template.content.querySelector("svg");
  if (!nextSvg) {
    stage.innerHTML = String(svgMarkup || "");
    return;
  }
  const previousSvg = stage.querySelector("svg:not(#stageLiveSvg)");
  if (previousSvg) {
    previousSvg.replaceWith(nextSvg);
    return;
  }
  const stageCanvas = document.getElementById("stageCanvas");
  if (stageCanvas && stageCanvas.parentElement === stage) stageCanvas.after(nextSvg);
  else stage.appendChild(nextSvg);
}

function syncCanvasStageLayout(canvas) {
  const svg = currentSvg();
  if (!CANVAS_STAGE_RENDER || !svg || !canvas) return null;
  const size = canvasSize(canvas);
  let stageCanvas = document.getElementById("stageCanvas");
  if (!stageCanvas || stageCanvas.parentElement !== stage) {
    stageCanvas = document.createElement("canvas");
    stageCanvas.id = "stageCanvas";
    stage.insertBefore(stageCanvas, svg);
  } else if (stageCanvas.nextSibling !== svg) {
    stage.insertBefore(stageCanvas, svg);
  }
  stage.classList.add("sketchmarkCanvasStage");
  const display = canvasStageDisplaySize(size);
  stage.style.width = display.width + "px";
  stage.style.height = display.height + "px";
  stageCanvas.style.width = display.width + "px";
  stageCanvas.style.height = display.height + "px";
  stageCanvas.style.transformOrigin = "0 0";
  svg.style.width = display.width + "px";
  svg.style.height = display.height + "px";
  svg.style.maxWidth = "none";
  svg.style.maxHeight = "none";
  const liveSvg = document.getElementById("stageLiveSvg");
  if (liveSvg && liveSvg.parentElement === stage) {
    liveSvg.style.width = display.width + "px";
    liveSvg.style.height = display.height + "px";
    liveSvg.style.maxWidth = "none";
    liveSvg.style.maxHeight = "none";
  }
  const pixelRatio = canvasStageRenderPixelRatio(display);
  const pixelWidth = Math.max(1, Math.round(display.width * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(display.height * pixelRatio));
  return { svg, stageCanvas, display, pixelRatio, pixelWidth, pixelHeight };
}

function canvasStageRenderPixelRatio(display) {
  const deviceRatio = Math.max(1, Number(window.devicePixelRatio || 1));
  const zoomRatio = viewport && viewport.initialized && viewport.width > 0
    ? Math.max(1, viewport.baseWidth / viewport.width)
    : 1;
  const desired = deviceRatio * zoomRatio;
  const maxDimensionRatio = Math.min(8192 / Math.max(1, display.width), 8192 / Math.max(1, display.height));
  const maxPixelRatio = Math.sqrt(20000000 / Math.max(1, display.width * display.height));
  return Math.max(1, Math.min(desired, maxDimensionRatio, maxPixelRatio, 8));
}

function renderVisibleCanvasStage(canvas) {
  const layout = syncCanvasStageLayout(canvas);
  if (!layout) {
    stage.classList.remove("canvasStageRendering");
    return;
  }
  const { svg } = layout;
  const serialized = serializeStageSvgForCanvas(svg);
  const renderViewport = viewportSnapshot();
  const token = ++canvasStageRenderToken;
  if (canvasStageSourceImage && canvasStageSourceImage.complete && serialized === canvasStageSourceSvg) {
    drawCanvasStageImage(layout, canvasStageSourceImage, renderViewport, token);
    return;
  }
  const image = new Image();
  const url = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
  image.onload = () => {
    URL.revokeObjectURL(url);
    canvasStageSourceSvg = serialized;
    canvasStageSourceImage = image;
    drawCanvasStageImage(layout, image, renderViewport, token);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    stage.classList.remove("canvasStageRendering");
  };
  image.src = url;
}

function drawCanvasStageImage(layout, image, renderViewport, token) {
  const { stageCanvas, display, pixelRatio, pixelWidth, pixelHeight } = layout;
  const context = stageCanvas.getContext("2d");
  if (!context) {
    stage.classList.remove("canvasStageRendering");
    return;
  }
    if (token !== canvasStageRenderToken || !stage.contains(stageCanvas)) return;
    if (stageCanvas.width !== pixelWidth) stageCanvas.width = pixelWidth;
    if (stageCanvas.height !== pixelHeight) stageCanvas.height = pixelHeight;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in context) context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, display.width, display.height);
    context.drawImage(image, 0, 0, display.width, display.height);
    canvasStageRenderedViewport = renderViewport;
    stage.classList.remove("canvasStageRendering");
    if (!scrubPreviewActive) stage.classList.remove("liveSvgScrub");
    if (liveDragPreviewPendingClear && !drag) clearLiveDragPreview();
}

function beginScrubPreview() {
  if (!CANVAS_STAGE_RENDER) return;
  scrubPreviewActive = true;
  clearTimeout(scrubPreviewTimer);
  stage.classList.add("liveSvgScrub");
}

function scheduleEndScrubPreview() {
  if (!CANVAS_STAGE_RENDER) return;
  if (scrubPointerActive) return;
  clearTimeout(scrubPreviewTimer);
  scrubPreviewTimer = setTimeout(endScrubPreview, 120);
}

function endScrubPreview() {
  if (!CANVAS_STAGE_RENDER) return;
  scrubPointerActive = false;
  clearTimeout(scrubPreviewTimer);
  scrubPreviewActive = false;
  requestVisibleCanvasStageRender(doc && doc.canvas);
}

function beginScrubPointerPreview() {
  scrubPointerActive = true;
  beginScrubPreview();
}

function applyCanvasStageViewportPreview(canvas) {
  if (!CANVAS_STAGE_RENDER || !canvasStageRenderedViewport) return;
  const layout = syncCanvasStageLayout(canvas);
  if (!layout) return;
  const next = viewportSnapshot();
  const previous = canvasStageRenderedViewport;
  if (!next || !previous || previous.baseWidth !== next.baseWidth || previous.baseHeight !== next.baseHeight) {
    layout.stageCanvas.style.transform = "";
    layout.stageCanvas.style.willChange = "";
    return;
  }
  const scaleX = previous.width / next.width;
  const scaleY = previous.height / next.height;
  const translateX = ((previous.x - next.x) / next.width) * layout.display.width;
  const translateY = ((previous.y - next.y) / next.height) * layout.display.height;
  if (
    Math.abs(scaleX - 1) < 0.0001 &&
    Math.abs(scaleY - 1) < 0.0001 &&
    Math.abs(translateX) < 0.05 &&
    Math.abs(translateY) < 0.05
  ) {
    layout.stageCanvas.style.transform = "";
    layout.stageCanvas.style.willChange = "";
    return;
  }
  layout.stageCanvas.style.willChange = "transform";
  layout.stageCanvas.style.transform = "translate(" + translateX.toFixed(3) + "px," + translateY.toFixed(3) + "px) scale(" + scaleX.toFixed(6) + "," + scaleY.toFixed(6) + ")";
}

function applyCanvasStageViewportTransform(canvas) {
  if (!CANVAS_STAGE_RENDER || !canvas) return;
  const layout = syncCanvasStageLayout(canvas);
  const next = viewportSnapshot();
  if (!layout || !next) return;
  const scaleX = next.baseWidth / next.width;
  const scaleY = next.baseHeight / next.height;
  const translateX = -(next.x / next.baseWidth) * layout.display.width * scaleX;
  const translateY = -(next.y / next.baseHeight) * layout.display.height * scaleY;
  const isIdentity =
    Math.abs(scaleX - 1) < 0.0001 &&
    Math.abs(scaleY - 1) < 0.0001 &&
    Math.abs(translateX) < 0.05 &&
    Math.abs(translateY) < 0.05;
  const transform = isIdentity
    ? ""
    : "translate(" + translateX.toFixed(3) + "px," + translateY.toFixed(3) + "px) scale(" + scaleX.toFixed(6) + "," + scaleY.toFixed(6) + ")";
  const willChange = transform ? "transform" : "";
  applyCanvasStageTransform(layout.stageCanvas, transform, willChange);
  applyCanvasStageTransform(layout.svg, transform, willChange);
  const liveSvg = document.getElementById("stageLiveSvg");
  if (liveSvg) applyCanvasStageTransform(liveSvg, transform, willChange);
}

function applyCanvasStageTransform(node, transform, willChange) {
  if (!node || !node.style) return;
  node.style.transformOrigin = "0 0";
  node.style.transform = transform;
  node.style.willChange = willChange;
}

function viewportSnapshot() {
  if (!viewport || !viewport.initialized) return null;
  return {
    baseWidth: viewport.baseWidth,
    baseHeight: viewport.baseHeight,
    x: viewport.x,
    y: viewport.y,
    width: viewport.width,
    height: viewport.height
  };
}

function canvasStageDisplaySize(size) {
  const availableWidth = Math.max(1, Number(stageWrap && stageWrap.clientWidth || size.width) - 2);
  const availableHeight = Math.max(1, Number(stageWrap && stageWrap.clientHeight || size.height) - 2);
  const scale = Math.min(1, availableWidth / size.width, availableHeight / size.height);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale))
  };
}

function serializeStageSvgForCanvas(svg) {
  const clone = svg.cloneNode(true);
  if (clone.style) {
    clone.style.transform = "";
    clone.style.willChange = "";
  }
  const handles = clone.querySelector("#__sketchmark_handles");
  if (handles) handles.remove();
  const preview = clone.querySelector("#__sketchmark_drag_preview");
  if (preview) preview.remove();
  if (drag && drag.id) {
    const dragged = clone.querySelector("#" + cssId(drag.id));
    if (dragged) dragged.remove();
  }
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

function showLiveDragPreview(target) {
  if (!CANVAS_STAGE_RENDER || !target) return;
  const svg = target.ownerSVGElement;
  if (!svg) return;
  syncLiveDragSvg(svg);
  stage.classList.add("liveSvgDrag");
  liveDragPreviewPendingClear = false;
}

function syncLiveDragSvg(svg) {
  const clone = svg.cloneNode(true);
  const handles = clone.querySelector("#__sketchmark_handles");
  if (handles) handles.remove();
  const preview = clone.querySelector("#__sketchmark_drag_preview");
  if (preview) preview.remove();
  clone.setAttribute("id", "stageLiveSvg");
  clone.setAttribute("aria-hidden", "true");
  let liveSvg = document.getElementById("stageLiveSvg");
  if (liveSvg) liveSvg.replaceWith(clone);
  else svg.after(clone);
  clone.style.width = svg.style.width;
  clone.style.height = svg.style.height;
  clone.style.maxWidth = "none";
  clone.style.maxHeight = "none";
}

function releaseLiveDragPreview(waitForDraw) {
  if (!CANVAS_STAGE_RENDER || !stage.classList.contains("liveSvgDrag")) return;
  liveDragPreviewPendingClear = true;
  if (waitForDraw) requestDraw();
  else requestVisibleCanvasStageRender(doc && doc.canvas);
}

function clearLiveDragPreview() {
  const preview = stage.querySelector("#__sketchmark_drag_preview");
  if (preview) preview.remove();
  const liveSvg = document.getElementById("stageLiveSvg");
  if (liveSvg) liveSvg.remove();
  stage.classList.remove("liveSvgDrag");
  liveDragPreviewPendingClear = false;
}

function browserStoragePanel() {
  if (!LOCAL_DOCUMENT_CONTROLS) return "";
  const api = window.__SKETCHMARK_BROWSER_API__;
  const status = api && api.storageStatus ? api.storageStatus() : "Browser-local document";
  const body =
    "<div class='browserFileGrid'>" +
    "<input id='browserImportFile' class='browserFileInput' type='file' accept='.json,.visual.json,application/json'>" +
    "<div class='browserFileActions'><button id='browserSaveLocal' type='button'>Save local</button><button id='browserResetDocument' type='button'>Reset</button></div>" +
    "<div id='browserStatus' class='browserStatus'>" + escapeText(status) + "</div>" +
    "</div>";
  return panelDetails("tree-browser", "Browser", body, { defaultOpen: true, meta: "local" });
}

function bindBrowserStoragePanel() {
  if (!LOCAL_DOCUMENT_CONTROLS) return;
  const api = window.__SKETCHMARK_BROWSER_API__;
  const file = document.getElementById("browserImportFile");
  if (file) {
    file.onchange = async () => {
      const selectedFile = file.files && file.files[0];
      if (!selectedFile || !api || !api.replaceDocument) return;
      try {
        const text = await selectedFile.text();
        await Promise.resolve(api.replaceDocument(JSON.parse(text), selectedFile.name.replace(/\\.visual\\.json$/i, "").replace(/\\.json$/i, "")));
        selectedId = "";
        currentTime = 0;
        await load();
      } catch (error) {
        showError(error);
      } finally {
        file.value = "";
      }
    };
  }
  const save = document.getElementById("browserSaveLocal");
  if (save) {
    save.onclick = () => {
      if (api && api.saveDocument) api.saveDocument();
      showBrowserStorageStatus();
    };
  }
  const reset = document.getElementById("browserResetDocument");
  if (reset) {
    reset.onclick = async () => {
      if (!api || !api.resetDocument) return;
      if (!window.confirm("Reset the local Sketchmark document?")) return;
      try {
        await Promise.resolve(api.resetDocument());
        selectedId = "";
        currentTime = 0;
        await load();
      } catch (error) {
        showError(error);
      }
    };
  }
  showBrowserStorageStatus();
}

function showBrowserStorageStatus() {
  const api = window.__SKETCHMARK_BROWSER_API__;
  const box = document.getElementById("browserStatus");
  if (box && api && api.storageStatus) box.textContent = api.storageStatus();
}

function apiPath(path) {
  return API_BASE + path;
}

curveModalClose.onclick = closeCurveModal;
curveModalBackdrop.onclick = (event) => {
  if (event.target === curveModalBackdrop) closeCurveModal();
};
curveModal.onclick = (event) => event.stopPropagation();
zoomOut.onclick = () => zoomBy(1.12);
zoomIn.onclick = () => zoomBy(1 / 1.12);
zoomFit.onclick = () => resetViewport(true);
async function api(path, options) {
  const response = await fetch(path, options || { cache: "no-store" });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function load() {
  clearSidebarCommitTimers();
  const data = await api(apiPath("/document"));
  doc = data.document;
  refs = data.elements;
  rebuildElementIndex();
  if (selectedId && !findElement(selectedId)) selectedId = "";
  if (!selectedId && refs[0]) selectedId = refs[0].id;
  renderTree();
  renderInspector();
  renderTimeline();
  requestDraw();
}

async function draw(requestId) {
  if (drawInFlight) {
    drawQueued = true;
    return;
  }
  drawInFlight = true;
  requestId = Number(requestId || drawRequestId);
  const time = currentTime;
  try {
    const data = await api(apiPath("/frame") + "?time=" + encodeURIComponent(time));
    const rejectStaleFrame = CANVAS_STAGE_RENDER && !scrubPreviewActive && stage.classList.contains("liveSvgScrub");
    if (rejectStaleFrame && (requestId !== drawRequestId || Math.abs(time - currentTime) > 0.0005)) {
      drawQueued = true;
      return;
    }
    resolvedDoc = data.resolved || null;
    if (CANVAS_STAGE_RENDER) setStageOverlaySvg(data.svg);
    else stage.innerHTML = data.svg;
    const svg = currentSvg();
    if (svg) {
      svg.style.overflow = "visible";
      applyEditorFlagsToStage();
      applyViewportToSvg(svg, data.canvas || (doc && doc.canvas));
    } else {
      updateZoomLabel();
    }
    const selected = selectedId ? stage.querySelector("#" + cssId(selectedId)) : null;
    if (selected && !isElementHidden(selectedId) && !isElementLocked(selectedId)) {
      drawHandles(selected);
    } else {
      clearHandles();
    }
    if (selectedId) syncInspectorValues();
  } finally {
    drawInFlight = false;
    if (drawQueued) {
      drawQueued = false;
      requestDraw();
    }
  }
}

function requestDraw() {
  drawRequestId += 1;
  if (drawInFlight) {
    drawQueued = true;
    return;
  }
  if (drawScheduled) return;
  drawScheduled = true;
  requestAnimationFrame(() => {
    drawScheduled = false;
    draw(drawRequestId).catch(showError);
  });
}

function canvasSize(canvas) {
  const width = Math.max(1, Number(canvas && canvas.width || 1));
  const height = Math.max(1, Number(canvas && canvas.height || 1));
  return { width, height };
}

function ensureViewportState(canvas, forceReset) {
  const size = canvasSize(canvas);
  const changed = !viewport.initialized || viewport.baseWidth !== size.width || viewport.baseHeight !== size.height;
  if (forceReset || changed) {
    viewport = {
      initialized: true,
      baseWidth: size.width,
      baseHeight: size.height,
      x: 0,
      y: 0,
      width: size.width,
      height: size.height
    };
  }
  clampViewport();
}

function applyViewportToSvg(svg, canvas) {
  if (!svg) return;
  ensureViewportState(canvas, false);
  if (CANVAS_STAGE_RENDER && canvas) {
    const size = canvasSize(canvas);
    svg.setAttribute("viewBox", "0 0 " + size.width + " " + size.height);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    updateZoomLabel();
    applyCanvasStageViewportTransform(canvas);
    requestVisibleCanvasStageRender(canvas);
    return;
  }
  svg.setAttribute("viewBox", viewport.x.toFixed(3) + " " + viewport.y.toFixed(3) + " " + viewport.width.toFixed(3) + " " + viewport.height.toFixed(3));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  updateZoomLabel();
  requestVisibleCanvasStageRender(canvas);
}

function updateZoomLabel() {
  if (!zoomLabel) return;
  if (!viewport.initialized || viewport.width <= 0) {
    zoomLabel.textContent = "100%";
    return;
  }
  const zoom = Math.round((viewport.baseWidth / viewport.width) * 100);
  zoomLabel.textContent = zoom + "%";
}

function clampViewport() {
  if (!viewport.initialized) return;
  viewport.width = clampRange(viewport.width, viewport.baseWidth * 0.08, viewport.baseWidth);
  viewport.height = clampRange(viewport.height, viewport.baseHeight * 0.08, viewport.baseHeight);
  const maxX = viewport.baseWidth - viewport.width;
  const maxY = viewport.baseHeight - viewport.height;
  viewport.x = clampRange(viewport.x, 0, Math.max(0, maxX));
  viewport.y = clampRange(viewport.y, 0, Math.max(0, maxY));
}

function clampRange(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function wheelDeltaToPixels(event) {
  const mode = Number(event && event.deltaMode || 0);
  if (mode === 1) return { x: event.deltaX * 16, y: event.deltaY * 16 };
  if (mode === 2) return { x: event.deltaX * Math.max(1, stageWrap.clientWidth), y: event.deltaY * Math.max(1, stageWrap.clientHeight) };
  return { x: event.deltaX, y: event.deltaY };
}

function zoomFactorFromWheel(event) {
  const delta = wheelDeltaToPixels(event);
  const dy = clampRange(delta.y, -600, 600);
  return Math.exp(dy * 0.002);
}

function currentSvg() {
  return stage.querySelector("svg:not(#stageLiveSvg)") || stage.querySelector("svg");
}

function svgPointFromClient(svg, clientX, clientY) {
  if (!svg || !svg.getScreenCTM) return null;
  const matrix = svg.getScreenCTM();
  if (!matrix || !matrix.inverse) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(matrix.inverse());
}

function zoomBy(factor, clientX, clientY) {
  const svg = currentSvg();
  if (!svg || !doc || !doc.canvas) return;
  ensureViewportState(doc.canvas, false);
  const focus = Number.isFinite(clientX) && Number.isFinite(clientY)
    ? svgPointFromClient(svg, clientX, clientY)
    : { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 };
  const worldX = focus ? focus.x : viewport.x + viewport.width / 2;
  const worldY = focus ? focus.y : viewport.y + viewport.height / 2;
  const ux = clamp01((worldX - viewport.x) / viewport.width);
  const uy = clamp01((worldY - viewport.y) / viewport.height);
  const nextWidth = clampRange(viewport.width * Number(factor || 1), viewport.baseWidth * 0.08, viewport.baseWidth);
  const zoomScale = nextWidth / viewport.width;
  const nextHeight = clampRange(viewport.height * zoomScale, viewport.baseHeight * 0.08, viewport.baseHeight);
  viewport.x = worldX - ux * nextWidth;
  viewport.y = worldY - uy * nextHeight;
  viewport.width = nextWidth;
  viewport.height = nextHeight;
  clampViewport();
  applyViewportToSvg(svg, doc.canvas);
}

function resetViewport(applyNow) {
  ensureViewportState(doc && doc.canvas, true);
  if (!applyNow) return;
  const svg = currentSvg();
  if (svg) applyViewportToSvg(svg, doc && doc.canvas);
  else updateZoomLabel();
}

function panViewportByPixels(deltaX, deltaY) {
  const svg = currentSvg();
  if (!svg || !doc || !doc.canvas) return;
  ensureViewportState(doc.canvas, false);
  const rect = svg.getBoundingClientRect();
  const widthPx = Math.max(1, rect.width);
  const heightPx = Math.max(1, rect.height);
  viewport.x += (Number(deltaX) || 0) * (viewport.width / widthPx);
  viewport.y += (Number(deltaY) || 0) * (viewport.height / heightPx);
  clampViewport();
  applyViewportToSvg(svg, doc.canvas);
}

function shouldStartViewportPan(event) {
  if (!stage.contains(event.target)) return false;
  if (event.target && event.target.closest && event.target.closest("#viewportHud")) return false;
  if (event.button === 1) return true;
  return spacePanActive && event.button === 0;
}

function beginViewportPan(event) {
  if (!doc || !doc.canvas) return;
  const svg = currentSvg();
  if (!svg) return;
  ensureViewportState(doc.canvas, false);
  viewportPan = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: viewport.x,
    startY: viewport.y,
    moved: false
  };
  stageWrap.classList.add("panning");
  stageWrap.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function updateViewportPan(event) {
  if (!viewportPan || event.pointerId !== viewportPan.pointerId) return;
  const svg = currentSvg();
  if (!svg || !doc || !doc.canvas) return;
  const startPoint = svgPointFromClient(svg, viewportPan.startClientX, viewportPan.startClientY);
  const currentPoint = svgPointFromClient(svg, event.clientX, event.clientY);
  if (!startPoint || !currentPoint) return;
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  viewport.x = viewportPan.startX - dx;
  viewport.y = viewportPan.startY - dy;
  clampViewport();
  applyViewportToSvg(svg, doc.canvas);
  viewportPan.moved = viewportPan.moved || Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25;
  event.preventDefault();
  event.stopPropagation();
}

function endViewportPan(event) {
  if (!viewportPan) return;
  if (event && event.pointerId !== undefined && event.pointerId !== viewportPan.pointerId) return;
  const pointerId = viewportPan.pointerId;
  if (viewportPan.moved) suppressClick = true;
  viewportPan = null;
  stageWrap.classList.remove("panning");
  if (pointerId !== undefined) stageWrap.releasePointerCapture?.(pointerId);
}

function isEditableInputTarget(target) {
  if (!target || !target.tagName) return false;
  const tag = String(target.tagName).toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target.isContentEditable);
}

function isPanelOpen(panelId, defaultOpen) {
  if (Object.prototype.hasOwnProperty.call(panelOpenState, panelId)) return Boolean(panelOpenState[panelId]);
  return Boolean(defaultOpen);
}

function panelDetails(panelId, title, body, options) {
  const open = isPanelOpen(panelId, options && options.defaultOpen);
  const extraClass = options && options.className ? " " + options.className : "";
  const meta = options && options.meta !== undefined && options.meta !== ""
    ? "<span class='summaryMeta'>" + escapeText(String(options.meta)) + "</span>"
    : "";
  return "<details class='panelGroup" + extraClass + "' data-panel='" + escapeAttr(panelId) + "'" + (open ? " open" : "") + ">" +
    "<summary><span>" + escapeText(title) + "</span>" + meta + "</summary>" +
    "<div class='panelBody'>" + (body || "") + "</div>" +
    "</details>";
}

function bindPanelStates(scope) {
  const root = scope || document;
  const panels = root.querySelectorAll("details[data-panel]");
  for (const panel of panels) {
    const panelId = panel.getAttribute("data-panel");
    if (!panelId) continue;
    panelOpenState[panelId] = panel.open;
    panel.ontoggle = () => {
      panelOpenState[panelId] = panel.open;
    };
  }
}

function renderTree() {
  const canvas = doc && doc.canvas ? doc.canvas : {};
  const canvasSummary = Math.round(valueOr(canvas.width, 1)) + "x" + Math.round(valueOr(canvas.height, 1));
  const canvasBody =
    "<div class='row'><label>Width<input id='canvasWidth' type='number' step='1' min='1' value='" + escapeAttr(valueOr(canvas.width, 1)) + "'></label><label>Height<input id='canvasHeight' type='number' step='1' min='1' value='" + escapeAttr(valueOr(canvas.height, 1)) + "'></label></div>" +
    "<div class='row'>" + colorTextInput("Background", "canvasBackground", "", valueOr(canvas.background, ""), "", "#ffffff") + "<div></div></div>" +
    "<div class='row'><label>Duration<input id='canvasDuration' type='number' step='0.1' min='0' value='" + escapeAttr(valueOr(canvas.duration, "")) + "'></label><label>FPS<input id='canvasFps' type='number' step='1' min='1' value='" + escapeAttr(valueOr(canvas.fps, "")) + "'></label></div>" +
    "<div id='canvasError' class='canvasError'></div>";
  tree.innerHTML =
    browserStoragePanel() +
    panelDetails("tree-canvas", "Canvas", canvasBody, { defaultOpen: false, meta: canvasSummary }) +
    panelDetails("tree-elements", "Elements", "<div id='elementsTree'></div>", { defaultOpen: false, meta: refs.length + " items" });
  bindPanelStates(tree);
  bindCanvasInputs();
  bindBrowserStoragePanel();
  const treeRoot = document.getElementById("elementsTree");
  if (!treeRoot) return;
  for (const ref of refs) {
    if (isInCollapsedBranch(ref.id)) continue;
    const row = document.createElement("div");
    row.className = "treeRow";
    row.style.paddingLeft = 8 + ref.depth * 14 + "px";
    const hasChildren = hasTreeChildren(ref.id) && typeById[ref.id] === "group";
    if (hasChildren) {
      const fold = document.createElement("button");
      fold.className = "treeCtl";
      fold.textContent = collapsedGroups.has(ref.id) ? "+" : "-";
      fold.title = collapsedGroups.has(ref.id) ? "Expand group" : "Collapse group";
      fold.onclick = (event) => {
        event.stopPropagation();
        toggleCollapse(ref.id);
      };
      row.appendChild(fold);
    } else {
      const pad = document.createElement("span");
      pad.className = "treePad";
      row.appendChild(pad);
    }
    const hide = document.createElement("button");
    hide.className = "treeCtl" + (hiddenIds.has(ref.id) ? " active" : "");
    hide.textContent = "H";
    hide.title = hiddenIds.has(ref.id) ? "Show element/group" : "Hide element/group";
    hide.onclick = (event) => {
      event.stopPropagation();
      toggleHidden(ref.id);
    };
    row.appendChild(hide);
    const lock = document.createElement("button");
    lock.className = "treeCtl" + (lockedIds.has(ref.id) ? " active" : "");
    lock.textContent = "L";
    lock.title = lockedIds.has(ref.id) ? "Unlock element/group" : "Lock element/group";
    lock.onclick = (event) => {
      event.stopPropagation();
      toggleLocked(ref.id);
    };
    row.appendChild(lock);
    const button = document.createElement("button");
    button.className = "treeBtn" + (ref.id === selectedId ? " selected" : "") + (isElementHidden(ref.id) ? " dim" : "");
    button.textContent = ref.id + "  " + ref.type;
    button.onclick = () => select(ref.id);
    row.appendChild(button);
    treeRoot.appendChild(row);
  }
}

function bindCanvasInputs() {
  const bind = (id, callback) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.oninput = callback;
    input.onchange = callback;
  };
  bind("canvasWidth", () => scheduleCanvasCommit("width", () => parseCanvasNumber("canvasWidth", { min: 1, integer: true })));
  bind("canvasHeight", () => scheduleCanvasCommit("height", () => parseCanvasNumber("canvasHeight", { min: 1, integer: true })));
  bind("canvasBackground", () => scheduleCanvasCommit("background", () => parseCanvasBackground("canvasBackground")));
  bind("canvasDuration", () => scheduleCanvasCommit("duration", () => parseCanvasNumber("canvasDuration", { min: 0, optional: true })));
  bind("canvasFps", () => scheduleCanvasCommit("fps", () => parseCanvasNumber("canvasFps", { min: 1, integer: true, optional: true })));
  bindColorPickerPair("canvasBackground");
}

function scheduleCanvasCommit(property, reader) {
  const timerKey = "__canvas__" + property;
  if (sidebarCommitTimers[timerKey]) clearTimeout(sidebarCommitTimers[timerKey]);
  sidebarCommitTimers[timerKey] = setTimeout(async () => {
    delete sidebarCommitTimers[timerKey];
    try {
      const value = reader();
      if (value === undefined) return;
      await mutate(
        apiPath("/canvas"),
        { [property]: value },
        { refreshTree: false, refreshInspector: false, refreshTimeline: true }
      );
      showCanvasError("");
    } catch (error) {
      showCanvasError(error && error.message ? error.message : String(error));
    }
  }, 160);
}

function parseCanvasNumber(inputId, options) {
  const input = document.getElementById(inputId);
  if (!input) return undefined;
  const raw = String(input.value || "").trim();
  if (!raw) {
    if (options && options.optional) return null;
    throw new Error(inputId + " cannot be empty.");
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) throw new Error(inputId + " must be a number.");
  const min = options && Number.isFinite(Number(options.min)) ? Number(options.min) : undefined;
  if (min !== undefined && numeric < min) throw new Error(inputId + " must be >= " + min + ".");
  return options && options.integer ? Math.round(numeric) : numeric;
}

function parseCanvasBackground(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return undefined;
  const raw = String(input.value || "").trim();
  return raw ? raw : null;
}

function showCanvasError(message) {
  const box = document.getElementById("canvasError");
  if (box) box.textContent = message || "";
}

function rebuildElementIndex() {
  parentById = Object.create(null);
  childIdsById = Object.create(null);
  typeById = Object.create(null);
  const visit = (elements, parentId) => {
    for (const element of elements || []) {
      const id = element && element.id;
      const nextParent = id || parentId;
      if (id) {
        typeById[id] = element.type;
        parentById[id] = parentId || "";
        childIdsById[id] = childIdsById[id] || [];
        if (parentId) {
          childIdsById[parentId] = childIdsById[parentId] || [];
          childIdsById[parentId].push(id);
        }
      }
      if (element && element.type === "group") visit(element.children || [], nextParent);
    }
  };
  visit(doc && doc.elements ? doc.elements : [], "");
  pruneEditorSets();
}

function pruneEditorSets() {
  const prune = (set, predicate) => {
    for (const id of Array.from(set)) if (!predicate(id)) set.delete(id);
  };
  prune(hiddenIds, (id) => Boolean(typeById[id]));
  prune(lockedIds, (id) => Boolean(typeById[id]));
  prune(collapsedGroups, (id) => typeById[id] === "group");
}

function hasTreeChildren(id) {
  const children = childIdsById[id];
  return Boolean(children && children.length);
}

function isInCollapsedBranch(id) {
  let parent = parentById[id];
  while (parent) {
    if (collapsedGroups.has(parent)) return true;
    parent = parentById[parent];
  }
  return false;
}

function isElementHidden(id) {
  return hasMarkedAncestor(id, hiddenIds);
}

function isElementLocked(id) {
  return hasMarkedAncestor(id, lockedIds);
}

function hasMarkedAncestor(id, set) {
  let current = id;
  while (current) {
    if (set.has(current)) return true;
    current = parentById[current];
  }
  return false;
}

function toggleCollapse(id) {
  if (collapsedGroups.has(id)) collapsedGroups.delete(id);
  else collapsedGroups.add(id);
  renderTree();
}

function toggleHidden(id) {
  clearSidebarCommitTimers();
  if (hiddenIds.has(id)) hiddenIds.delete(id);
  else hiddenIds.add(id);
  clearHandles();
  renderTree();
  renderInspector();
  requestDraw();
}

function toggleLocked(id) {
  clearSidebarCommitTimers();
  if (lockedIds.has(id)) lockedIds.delete(id);
  else lockedIds.add(id);
  if (drag && isElementLocked(drag.id)) drag = null;
  clearHandles();
  renderTree();
  renderInspector();
  requestDraw();
}

function applyEditorFlagsToStage() {
  for (const id of hiddenIds) {
    const target = stage.querySelector("#" + cssId(id));
    if (target) target.style.display = "none";
  }
}

function select(id, options) {
  clearSidebarCommitTimers();
  if (selectedId !== id) {
    selectedSegment = null;
    closeCurveModal();
  }
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
  clearSidebarCommitTimers();
  selectedId = "";
  selectedSegment = null;
  closeCurveModal();
  clearHandles();
  renderTree();
  renderInspector();
  renderTimeline();
  requestDraw();
}

function renderInspector() {
  const element = findElement(selectedId);
  const exportPanel = renderExportPanel();
  if (!element) {
    inspector.innerHTML = "<div class='muted'>Select an element.</div>" + exportPanel;
    bindPanelStates(inspector);
    bindExportButtons();
    return;
  }
  const displayElement = findResolvedElement(selectedId) || element;
  const supportsPosition = ["path","point","text","image","group"].includes(element.type);
  const supportsOrigin = ["path","text","image","group"].includes(element.type);
  const supportsPaint = element.type !== "point";
  const supportsEffects = ["path","text","image","group"].includes(element.type);
  const isPath = element.type === "path";
  const isTextElement = element.type === "text";
  const origin = originPointValue(displayElement);
  const locked = isElementLocked(selectedId);
  const hidden = isElementHidden(selectedId);
  const lockDisabled = locked ? "disabled" : "";
  const positionDisabled = supportsPosition && !locked ? "" : "disabled";
  const originRows = supportsOrigin
    ? "<div class='row'><label>Origin X<input id='propOriginX' type='number' step='1' value='" + origin[0] + "' " + lockDisabled + "></label><label>Origin Y<input id='propOriginY' type='number' step='1' value='" + origin[1] + "' " + lockDisabled + "></label></div>"
    : "";
  const paintHint = supportsPaint && ((displayElement.fill !== undefined && typeof displayElement.fill !== "string") || (displayElement.stroke !== undefined && typeof displayElement.stroke !== "string"))
    ? "<div class='tiny'>Structured paint channels can be keyframed below.</div>"
    : "";
  const paintRows = supportsPaint
    ? "<div class='row'>" +
      colorTextInput("Fill", "propFill", "fill", typeof displayElement.fill === "string" ? displayElement.fill : "", lockDisabled, "#22c55e or color") +
      colorTextInput("Stroke", "propStroke", "stroke", typeof displayElement.stroke === "string" ? displayElement.stroke : "", lockDisabled, "#0f172a or color") +
      "</div>" +
      "<div class='row'><label>Stroke W<input id='propStrokeWidth' type='number' step='0.1' value='" + valueOr(displayElement.strokeWidth, 1) + "' " + lockDisabled + "></label><label>Dash Offset<input id='propDashOffset' type='number' step='0.1' value='" + valueOr(displayElement.dashOffset, 0) + "' " + lockDisabled + "></label></div>"
    : "";
  const pathRows = isPath
    ? "<div class='row'><label>Draw Start<input id='propDrawStart' type='number' min='0' max='1' step='0.01' value='" + valueOr(displayElement.drawStart, 0) + "' " + lockDisabled + "></label><label>Draw End<input id='propDrawEnd' type='number' min='0' max='1' step='0.01' value='" + valueOr(displayElement.drawEnd, 1) + "' " + lockDisabled + "></label></div>" +
      "<div class='row'><label>Dash Array<input id='propDashArray' type='text' value='" + escapeAttr(formatArrayValue(displayElement.dashArray)) + "' " + lockDisabled + "></label><div></div></div>"
    : "";
  const textTrackProperty = isTextElement ? textEditorProperty(displayElement) : "text";
  const typographyRows = isTextElement
    ? panelDetails(
      "inspector-typography",
      "Typography",
      "<div class='row'><label>Font<select id='propFontFamily' " + lockDisabled + ">" + fontFamilyOptionsHtml(displayElement.fontFamily) + "</select></label><label>Weight<select id='propWeight' " + lockDisabled + ">" + fontWeightOptionsHtml(displayElement.weight) + "</select></label></div>" +
      "<div class='row'><label>Font Size<input id='propFontSize' type='number' step='1' value='" + valueOr(displayElement.fontSize, 16) + "' " + lockDisabled + "></label><label>Line Height<input id='propLineHeight' type='number' step='0.05' value='" + valueOr(displayElement.lineHeight, 1.2) + "' " + lockDisabled + "></label></div>" +
      "<div class='row'><label>Letter Spacing<input id='propLetterSpacing' type='number' step='0.1' value='" + valueOr(displayElement.letterSpacing, 0) + "' " + lockDisabled + "></label><div></div></div>",
      { defaultOpen: false }
    )
    : "";
  const textRows = isTextElement
    ? "<div class='stack'><label>Text<textarea id='propText' rows='4' " + lockDisabled + "></textarea></label><div class='tiny'>Use new lines for multiline text. Elements already using lines[] keep that format.</div></div>" +
      typographyRows
    : "";
  const effectsRows = supportsEffects ? renderEffectsRows(displayElement, lockDisabled) : "";
  const sourceRows = element.type === "image" ? renderImageSourceRows(displayElement, lockDisabled) : "";
  const structuredPaintRows = supportsPaint ? renderStructuredPaintRows(displayElement, "fill", lockDisabled) + renderStructuredPaintRows(displayElement, "stroke", lockDisabled) : "";
  const selectedMeta = escapeText(element.type) + (hidden ? " | hidden" : "") + (locked ? " | locked" : "");
  const selectedRows =
    "<strong>" + escapeText(element.id || "") + "</strong>" +
    "<div class='muted'>" + selectedMeta + "</div>" +
    (locked ? "<div class='tiny'>Locked elements and groups cannot be edited from canvas or inspector.</div>" : "");
  const transformRows =
    "<div class='row'><label>X<input id='propX' type='number' step='1' value='" + valueOr(displayElement.x, 0) + "' " + positionDisabled + "></label><label>Y<input id='propY' type='number' step='1' value='" + valueOr(displayElement.y, 0) + "' " + positionDisabled + "></label></div>" +
    "<div class='row'><label>Rotation<input id='propRotation' type='number' step='1' value='" + valueOr(displayElement.rotation, 0) + "' " + lockDisabled + "></label><label>Scale<input id='propScale' type='number' step='0.05' value='" + valueOr(displayElement.scale, 1) + "' " + lockDisabled + "></label></div>" +
    "<div class='row'><label>Scale X<input id='propScaleX' type='number' step='0.05' value='" + valueOr(displayElement.scaleX, valueOr(displayElement.scale, 1)) + "' " + lockDisabled + "></label><label>Scale Y<input id='propScaleY' type='number' step='0.05' value='" + valueOr(displayElement.scaleY, valueOr(displayElement.scale, 1)) + "' " + lockDisabled + "></label></div>" +
    originRows;
  const appearanceRows =
    "<div class='row'><label>Opacity<input id='propOpacity' type='number' min='0' max='1' step='0.05' value='" + valueOr(displayElement.opacity, 1) + "' " + lockDisabled + "></label><div></div></div>" +
    paintRows +
    paintHint;
  const contentRows = pathRows + textRows + sourceRows;
  const keyframeRows =
    "<div class='row'><label>Time<input id='kfTime' type='number' step='0.05' value='" + currentTime.toFixed(2) + "'></label><div></div></div>" +
    "<p class='tiny'>Changing sidebar values updates keyframes at the current time.</p>" +
    "<p class='tiny'>Interpolation curves are edited from timeline badges.</p>" +
    "<p class='tiny'>Drag to move. Use the square to scale and the round handle to rotate.</p>";
  inspector.innerHTML =
    panelDetails("inspector-selected", "Selected", selectedRows, { defaultOpen: true, meta: element.type }) +
    panelDetails("inspector-transform", "Transform", transformRows, { defaultOpen: false }) +
    panelDetails("inspector-appearance", "Appearance", appearanceRows, { defaultOpen: false }) +
    (contentRows ? panelDetails("inspector-content", "Path / Content", contentRows, { defaultOpen: false }) : "") +
    (supportsEffects ? panelDetails("inspector-effects", "Effects", effectsRows, { defaultOpen: false }) : "") +
    (structuredPaintRows ? panelDetails("inspector-structured-paint", "Structured Paint", structuredPaintRows, { defaultOpen: false }) : "") +
    panelDetails("inspector-keyframe", "Keyframe", keyframeRows, { defaultOpen: false }) +
    exportPanel;
  bindPanelStates(inspector);
  bindExportButtons();
  if (supportsPaint) {
    setInput("propFill", typeof displayElement.fill === "string" ? displayElement.fill : "");
    setInput("propStroke", typeof displayElement.stroke === "string" ? displayElement.stroke : "");
  }
  if (isTextElement) {
    setInput("propText", textEditorValue(displayElement));
    setInput("propFontFamily", valueOr(displayElement.fontFamily, defaultFontFamilyValue()));
    setInput("propWeight", valueOr(displayElement.weight, 400));
    setInput("propFontSize", valueOr(displayElement.fontSize, 16));
    setInput("propLineHeight", valueOr(displayElement.lineHeight, 1.2));
    setInput("propLetterSpacing", valueOr(displayElement.letterSpacing, 0));
  }
  const kfTimeInput = document.getElementById("kfTime");
  if (kfTimeInput) {
    kfTimeInput.oninput = (event) => {
      setCurrentTime(event.target.value);
    };
  }
  const bindAutoKeyframe = (id, callback) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.oninput = callback;
    input.onchange = callback;
  };
  if (supportsPosition && !locked) {
    bindAutoKeyframe("propX", scheduleSidebarPositionKeyframe);
    bindAutoKeyframe("propY", scheduleSidebarPositionKeyframe);
  }
  if (supportsOrigin && !locked) {
    bindAutoKeyframe("propOriginX", scheduleSidebarOriginKeyframe);
    bindAutoKeyframe("propOriginY", scheduleSidebarOriginKeyframe);
  }
  if (!locked) {
    bindAutoKeyframe("propRotation", () => scheduleSidebarNumberKeyframe("rotation", "propRotation"));
    bindAutoKeyframe("propScale", () => scheduleSidebarNumberKeyframe("scale", "propScale"));
    bindAutoKeyframe("propScaleX", () => scheduleSidebarNumberKeyframe("scaleX", "propScaleX"));
    bindAutoKeyframe("propScaleY", () => scheduleSidebarNumberKeyframe("scaleY", "propScaleY"));
    bindAutoKeyframe("propOpacity", () => scheduleSidebarNumberKeyframe("opacity", "propOpacity"));
    if (supportsPaint) {
      bindAutoKeyframe("propFill", () => scheduleSidebarPaintKeyframe("fill", "propFill"));
      bindAutoKeyframe("propStroke", () => scheduleSidebarPaintKeyframe("stroke", "propStroke"));
      bindAutoKeyframe("propStrokeWidth", () => scheduleSidebarNumberKeyframe("strokeWidth", "propStrokeWidth"));
      bindAutoKeyframe("propDashOffset", () => scheduleSidebarNumberKeyframe("dashOffset", "propDashOffset"));
    }
    if (isPath) {
      bindAutoKeyframe("propDrawStart", () => scheduleSidebarNumberKeyframe("drawStart", "propDrawStart"));
      bindAutoKeyframe("propDrawEnd", () => scheduleSidebarNumberKeyframe("drawEnd", "propDrawEnd"));
      bindAutoKeyframe("propDashArray", () => scheduleSidebarNumberArrayKeyframe("dashArray", "propDashArray"));
    }
    if (isTextElement) {
      bindAutoKeyframe("propText", () => scheduleSidebarTextContentKeyframe(textTrackProperty, "propText"));
      bindAutoKeyframe("propFontFamily", () => scheduleSidebarTextKeyframe("fontFamily", "propFontFamily"));
      bindAutoKeyframe("propWeight", () => scheduleSidebarNumberOrTextKeyframe("weight", "propWeight"));
      bindAutoKeyframe("propFontSize", () => scheduleSidebarNumberKeyframe("fontSize", "propFontSize"));
      bindAutoKeyframe("propLineHeight", () => scheduleSidebarNumberKeyframe("lineHeight", "propLineHeight"));
      bindAutoKeyframe("propLetterSpacing", () => scheduleSidebarNumberKeyframe("letterSpacing", "propLetterSpacing"));
    }
    bindDynamicInspectorInputs(bindAutoKeyframe);
  }
  bindColorPickersInScope(inspector);
}

function renderExportPanel() {
  const rows =
    "<div class='exportButtons'>" +
    "<button id='exportSvg' type='button' title='Export current frame as SVG'>SVG</button>" +
    "<button id='exportPng' type='button' title='Export current frame as PNG'>PNG</button>" +
    "<button id='exportJpg' type='button' title='Export current frame as JPG'>JPG</button>" +
    "<button id='exportHtml' type='button' title='Export current frame as HTML'>HTML</button>" +
    "<button id='exportJson' type='button' title='Export kernel JSON'>JSON</button>" +
    "<button id='exportMp4' type='button' title='Export full animation as MP4'>MP4</button>" +
    "</div>" +
    "<div id='error'></div>" +
    "<p class='tiny'>MP4 exports in the browser. Chrome or Edge is recommended.</p>";
  return panelDetails("inspector-export", "Export", rows, { defaultOpen: true });
}

function bindExportButtons() {
  bindExportButton("exportSvg", "svg");
  bindExportButton("exportPng", "png");
  bindExportButton("exportJpg", "jpg");
  bindExportButton("exportHtml", "html");
  bindExportButton("exportJson", "json");
  bindExportButton("exportMp4", "mp4");
}

function bindExportButton(id, format) {
  const button = document.getElementById(id);
  if (button) button.onclick = () => exportDocument(format, button);
}

function fontFamilyOptionsHtml(currentValue) {
  const current = String(valueOr(currentValue, "")).trim();
  const seen = new Set();
  const options = [];
  for (const option of FONT_FAMILY_OPTIONS) {
    if (!option || !option.value || seen.has(option.value)) continue;
    seen.add(option.value);
    options.push("<option value='" + escapeAttr(option.value) + "'" + (current === option.value ? " selected" : "") + ">" + escapeText(option.label) + "</option>");
  }
  if (current && !seen.has(current)) {
    options.unshift("<option value='" + escapeAttr(current) + "' selected>" + escapeText(current) + "</option>");
  }
  if (!current && options.length) {
    options[0] = options[0].replace("<option ", "<option selected ");
  }
  return options.join("");
}

function defaultFontFamilyValue() {
  return FONT_FAMILY_OPTIONS[0] && FONT_FAMILY_OPTIONS[0].value ? FONT_FAMILY_OPTIONS[0].value : "";
}

function fontWeightOptionsHtml(currentValue) {
  const current = String(valueOr(currentValue, "")).trim();
  const seen = new Set();
  const options = [];
  for (const option of FONT_WEIGHT_OPTIONS) {
    if (!option || !option.value || seen.has(option.value)) continue;
    seen.add(option.value);
    options.push("<option value='" + escapeAttr(option.value) + "'" + (current === option.value ? " selected" : "") + ">" + escapeText(option.label) + "</option>");
  }
  if (current && !seen.has(current)) {
    options.unshift("<option value='" + escapeAttr(current) + "' selected>" + escapeText(current) + "</option>");
  }
  if (!current && options.length) {
    const defaultIndex = options.findIndex((option) => option.includes("value='400'"));
    if (defaultIndex >= 0) {
      options[defaultIndex] = options[defaultIndex].replace("<option ", "<option selected ");
    } else {
      options[0] = options[0].replace("<option ", "<option selected ");
    }
  }
  return options.join("");
}

function renderEffectsRows(element, disabled) {
  const effects = element.effects || {};
  const shadow = effects.shadow || {};
  return "<div class='row'>" +
    dynamicNumberInput("Blur", "propEffectsBlur", "effects.blur", valueOr(effects.blur, 0), disabled, "0.1") +
    dynamicNumberInput("Bright", "propEffectsBrightness", "effects.brightness", valueOr(effects.brightness, 1), disabled, "0.05") +
    "</div>" +
    "<div class='row'>" +
    dynamicNumberInput("Contrast", "propEffectsContrast", "effects.contrast", valueOr(effects.contrast, 1), disabled, "0.05") +
    dynamicNumberInput("Saturate", "propEffectsSaturate", "effects.saturate", valueOr(effects.saturate, 1), disabled, "0.05") +
    "</div>" +
    "<div class='row'>" +
    dynamicNumberInput("Hue", "propEffectsHue", "effects.hueRotate", valueOr(effects.hueRotate, 0), disabled, "1") +
    dynamicColorInput("Shadow Color", "propShadowColor", "effects.shadow.color", valueOr(shadow.color, "#000000"), disabled) +
    "</div>" +
    "<div class='row'>" +
    dynamicNumberInput("Shadow X", "propShadowDx", "effects.shadow.dx", valueOr(shadow.dx, 0), disabled, "0.5") +
    dynamicNumberInput("Shadow Y", "propShadowDy", "effects.shadow.dy", valueOr(shadow.dy, 0), disabled, "0.5") +
    "</div>" +
    "<div class='row'>" +
    dynamicNumberInput("Shadow Blur", "propShadowBlur", "effects.shadow.blur", valueOr(shadow.blur, 0), disabled, "0.5") +
    dynamicNumberInput("Shadow Opacity", "propShadowOpacity", "effects.shadow.opacity", valueOr(shadow.opacity, 1), disabled, "0.05", "0", "1") +
    "</div>";
}

function renderImageSourceRows(element, disabled) {
  const source = element.source || { x: 0, y: 0, width: element.width || 0, height: element.height || 0 };
  return "<div class='row'>" +
    dynamicNumberInput("Source X", "propSourceX", "source.x", valueOr(source.x, 0), disabled, "1") +
    dynamicNumberInput("Source Y", "propSourceY", "source.y", valueOr(source.y, 0), disabled, "1") +
    "</div>" +
    "<div class='row'>" +
    dynamicNumberInput("Source W", "propSourceWidth", "source.width", valueOr(source.width, element.width || 0), disabled, "1") +
    dynamicNumberInput("Source H", "propSourceHeight", "source.height", valueOr(source.height, element.height || 0), disabled, "1") +
    "</div>" +
    "<div class='row'>" +
    dynamicClipRadiusInput("Radius", "propClipRadius", clipRadiusValue(element), disabled, "1", "0") +
    "<div></div>" +
    "</div>";
}

function renderStructuredPaintRows(element, root, disabled) {
  const paint = element[root];
  if (!paint || typeof paint !== "object") return "";
  let html = "<span class='subhead'>" + escapeText(cap(root)) + " Paint</span>";
  if (paint.type === "linearGradient") {
    html += "<div class='row'>" +
      dynamicPointInput(root + " From", "prop" + cap(root) + "From", root + ".from", paint.from || [0, 0], disabled) +
      dynamicPointInput(root + " To", "prop" + cap(root) + "To", root + ".to", paint.to || [100, 0], disabled) +
      "</div>";
  } else if (paint.type === "radialGradient") {
    html += "<div class='row'>" +
      dynamicPointInput(root + " Center", "prop" + cap(root) + "Center", root + ".center", paint.center || [50, 50], disabled) +
      dynamicPointInput(root + " Focus", "prop" + cap(root) + "Focus", root + ".focus", paint.focus || paint.center || [50, 50], disabled) +
      "</div><div class='row'>" +
      dynamicNumberInput(root + " Radius", "prop" + cap(root) + "Radius", root + ".radius", valueOr(paint.radius, 50), disabled, "1") +
      "<div></div></div>";
  }
  const stops = Array.isArray(paint.stops) ? paint.stops : [];
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    const offset = Array.isArray(stop) ? stop[0] : stop && stop.offset;
    const color = Array.isArray(stop) ? stop[1] : stop && stop.color;
    html += "<div class='row'>" +
      dynamicNumberInput(root + " Stop " + index, "prop" + cap(root) + "Stop" + index + "Offset", root + ".stops." + index + ".offset", valueOr(offset, index / Math.max(1, stops.length - 1)), disabled, "0.01", "0", "1") +
      dynamicColorInput("Color " + index, "prop" + cap(root) + "Stop" + index + "Color", root + ".stops." + index + ".color", valueOr(color, "#000000"), disabled) +
      "</div>";
  }
  return html;
}

function dynamicNumberInput(label, id, property, value, disabled, step, min, max) {
  return "<label>" + escapeText(label) + "<input id='" + id + "' type='number' data-kf-property='" + property + "' data-kf-kind='number' step='" + (step || "1") + "' " + (min === undefined ? "" : "min='" + min + "' ") + (max === undefined ? "" : "max='" + max + "' ") + "value='" + escapeAttr(value) + "' " + disabled + "></label>";
}

function dynamicClipRadiusInput(label, id, value, disabled, step, min, max) {
  return "<label>" + escapeText(label) + "<input id='" + id + "' type='number' data-kf-property='clip.d' data-kf-kind='clipRadius' step='" + (step || "1") + "' " + (min === undefined ? "" : "min='" + min + "' ") + (max === undefined ? "" : "max='" + max + "' ") + "value='" + escapeAttr(value) + "' " + disabled + "></label>";
}

function dynamicTextInput(label, id, property, value, disabled) {
  return "<label>" + escapeText(label) + "<input id='" + id + "' type='text' data-kf-property='" + property + "' data-kf-kind='text' value='" + escapeAttr(value) + "' " + disabled + "></label>";
}

function dynamicColorInput(label, id, property, value, disabled) {
  return colorTextInput(label, id, property, value, disabled, "#000000");
}

function colorTextInput(label, id, property, value, disabled, placeholder) {
  const data = property ? " data-kf-property='" + escapeAttr(property) + "' data-kf-kind='text'" : "";
  const place = placeholder ? " placeholder='" + escapeAttr(placeholder) + "'" : "";
  return "<label>" + escapeText(label) +
    "<div class='colorField'>" +
    "<input id='" + id + "Picker' type='color' data-color-source='" + id + "' value='" + escapeAttr(colorPickerValue(value)) + "' " + disabled + ">" +
    "<input id='" + id + "' type='text'" + data + place + " value='" + escapeAttr(valueOr(value, "")) + "' " + disabled + ">" +
    "</div></label>";
}

function bindColorPickersInScope(scope) {
  const root = scope || document;
  const pickers = root.querySelectorAll("input[type='color'][data-color-source]");
  const seen = new Set();
  for (const picker of pickers) {
    const textId = picker.getAttribute("data-color-source");
    if (!textId || seen.has(textId)) continue;
    seen.add(textId);
    bindColorPickerPair(textId);
  }
}

function bindColorPickerPair(textId) {
  const text = document.getElementById(textId);
  const picker = document.getElementById(textId + "Picker");
  if (!text || !picker) return;
  const sync = () => {
    picker.value = colorPickerValue(text.value);
  };
  sync();
  picker.oninput = () => {
    text.value = picker.value;
    text.dispatchEvent(new Event("input", { bubbles: true }));
  };
  picker.onchange = picker.oninput;
  text.addEventListener("input", sync);
  text.addEventListener("change", sync);
}

function syncColorPickersInScope(scope) {
  const root = scope || document;
  const pickers = root.querySelectorAll("input[type='color'][data-color-source]");
  for (const picker of pickers) {
    const text = document.getElementById(picker.getAttribute("data-color-source"));
    if (text) picker.value = colorPickerValue(text.value);
  }
}

function colorPickerValue(value) {
  const normalized = normalizeHexColor(value);
  return normalized || "#000000";
}

function normalizeHexColor(value) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  const short = /^#([0-9a-f]{3})$/i.exec(text);
  if (short) return "#" + short[1].split("").map((char) => char + char).join("").toLowerCase();
  const full = /^#([0-9a-f]{6})$/i.exec(text);
  if (full) return "#" + full[1].toLowerCase();
  return undefined;
}

function dynamicPointInput(label, idPrefix, property, value, disabled) {
  const point = Array.isArray(value) ? value : [0, 0];
  const xId = idPrefix + "X";
  const yId = idPrefix + "Y";
  return "<label>" + escapeText(label) +
    "<div class='row'>" +
    "<input id='" + xId + "' type='number' data-kf-property='" + property + "' data-kf-kind='point' data-kf-x='" + xId + "' data-kf-y='" + yId + "' step='1' value='" + escapeAttr(valueOr(point[0], 0)) + "' " + disabled + ">" +
    "<input id='" + yId + "' type='number' data-kf-property='" + property + "' data-kf-kind='point' data-kf-x='" + xId + "' data-kf-y='" + yId + "' step='1' value='" + escapeAttr(valueOr(point[1], 0)) + "' " + disabled + ">" +
    "</div></label>";
}

function bindDynamicInspectorInputs(bindAutoKeyframe) {
  const inputs = inspector.querySelectorAll("[data-kf-property]");
  for (const input of inputs) {
    bindAutoKeyframe(input.id, () => scheduleSidebarDynamicKeyframe(input));
  }
}

function renderTimeline() {
  const element = findElement(selectedId);
  const tracks = element && element.timeline && element.timeline.tracks ? element.timeline.tracks : {};
  timeline.innerHTML = "<div class='toolbar'><button id='play'>" + (playing ? "Pause" : "Play") + "</button><input id='scrub' type='range' min='0' max='" + Math.max(Number(doc.canvas.duration || 0), 0.01) + "' step='0.005' value='" + currentTime + "'><strong id='timeLabel'>" + currentTime.toFixed(2) + "s</strong><button id='refresh'>Refresh</button></div>";
  document.getElementById("play").onclick = togglePlay;
  document.getElementById("refresh").onclick = load;
  const scrub = document.getElementById("scrub");
  scrub.onpointerdown = beginScrubPointerPreview;
  scrub.oninput = (event) => {
    setCurrentTime(event.target.value, { scrubbing: true });
  };
  scrub.onchange = () => endScrubPreview();
  scrub.onpointerup = () => endScrubPreview();
  scrub.onpointercancel = () => endScrubPreview();
  scrub.onkeyup = () => endScrubPreview();
  const properties = Object.keys(tracks);
  if (!properties.length) {
    selectedSegment = null;
    closeCurveModal();
    const empty = document.createElement("div");
    empty.className = "tiny";
    empty.textContent = "No keyframes on selected element yet.";
    timeline.appendChild(empty);
    return;
  }
  selectedSegment = reconcileSelectedSegment(tracks, selectedSegment);
  for (const property of properties) {
    const track = tracks[property];
    const frames = normalizeTrackKeyframes(track);
    const box = document.createElement("div");
    box.className = "track";
    const name = document.createElement("span");
    name.className = "trackName";
    name.textContent = property;
    box.appendChild(name);
    const line = document.createElement("div");
    line.className = "trackLine";
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      const chip = document.createElement("span");
      chip.className = "kf";
      chip.title = "Jump to this keyframe time";
      const text = document.createElement("span");
      text.textContent = Number(frame.time).toFixed(2) + "s " + formatMotionValue(frame.value);
      chip.appendChild(text);
      const remove = document.createElement("button");
      remove.textContent = "x";
      remove.onclick = (event) => {
        event.stopPropagation();
        removeKeyframe(property, frame.time);
      };
      chip.onclick = () => setCurrentTime(frame.time);
      chip.appendChild(remove);
      line.appendChild(chip);
      if (index >= frames.length - 1) continue;
      const interpolation = resolveSegmentInterpolation(track, frames, index);
      const indicator = document.createElement("button");
      indicator.type = "button";
      indicator.className = "segBadge" + (selectedSegment && selectedSegment.property === property && selectedSegment.index === index ? " active" : "");
      indicator.textContent = interpolation.preset === "custom" ? "custom" : interpolation.preset;
      indicator.title = "Edit interpolation: " + Number(frames[index].time).toFixed(2) + "s -> " + Number(frames[index + 1].time).toFixed(2) + "s";
      indicator.onclick = () => {
        selectedSegment = { property, index };
        renderTimeline();
        openCurveModal();
      };
      line.appendChild(indicator);
    }
    box.appendChild(line);
    timeline.appendChild(box);
  }
  if (isCurveModalOpen()) refreshCurveModal(tracks);
}

async function exportDocument(format, triggerButton) {
  const button = triggerButton || document.getElementById("exportMenuBtn");
  const label = button ? button.textContent : "";
  try {
    if (button) {
      button.disabled = true;
      button.textContent = format === "mp4" ? "Exporting..." : "Export...";
    }
    if (format === "json") {
      downloadBlob(
        new Blob([JSON.stringify(doc, null, 2)], { type: "application/json;charset=utf-8" }),
        safeFileName(EDITOR_TITLE) + ".json"
      );
      return;
    }
    if (format === "svg" || format === "png" || format === "jpg" || format === "html") {
      await exportCurrentFrameInBrowser(format);
      return;
    }
    if (format === "mp4") {
      try {
        await exportMp4InBrowser(button);
        return;
      } catch (error) {
        if (!SERVER_EXPORT_FALLBACK) throw error;
      }
    }
    await exportViaServer(format);
  } catch (error) {
    showError(error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}

async function exportCurrentFrameInBrowser(format) {
  const data = await api(apiPath("/frame") + "?time=" + encodeURIComponent(currentTime));
  const width = Math.max(1, Number(data.canvas && data.canvas.width || 1));
  const height = Math.max(1, Number(data.canvas && data.canvas.height || 1));
  const baseName = safeFileName(EDITOR_TITLE);
  const frameName = baseName + "-t" + Number(currentTime).toFixed(2).replace(".", "-");
  if (format === "svg") {
    downloadBlob(new Blob([data.svg], { type: "image/svg+xml;charset=utf-8" }), frameName + ".svg");
    return;
  }
  if (format === "html") {
    const html = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>" + escapeText(EDITOR_TITLE) + "</title></head><body style='margin:0'>" + data.svg + "</body></html>";
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), frameName + ".html");
    return;
  }
  const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
  const blob = await rasterizeSvgBlob(data.svg, width, height, mimeType, format === "jpg" ? 0.92 : undefined);
  downloadBlob(blob, frameName + "." + format);
}

async function exportViaServer(format) {
  const response = await fetch(apiPath("/export") + "?format=" + encodeURIComponent(format) + "&time=" + encodeURIComponent(currentTime), { cache: "no-store" });
  if (!response.ok) {
    let message = "Export failed.";
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }
  const blob = await response.blob();
  downloadBlob(blob, filenameFromDisposition(response.headers.get("content-disposition")) || ("sketchmark." + format));
}

async function exportMp4InBrowser(button) {
  const VideoEncoderCtor = window.VideoEncoder;
  const VideoFrameCtor = window.VideoFrame;
  if (!VideoEncoderCtor || !VideoFrameCtor) {
    throw new Error("Browser MP4 export requires WebCodecs. Try Chrome or Edge.");
  }
  if (!MP4_MUXER_URL && !MP4_MUXER_SOURCE) {
    throw new Error("Browser MP4 export is not configured for this editor.");
  }
  const duration = Number(doc && doc.canvas && doc.canvas.duration || 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("MP4 export requires a positive canvas.duration.");
  }
  const fps = Math.max(1, Math.round(Number(doc && doc.canvas && doc.canvas.fps || 30) || 30));
  const sourceWidth = Math.max(1, Number(doc && doc.canvas && doc.canvas.width || 1));
  const sourceHeight = Math.max(1, Number(doc && doc.canvas && doc.canvas.height || 1));
  const width = evenDimension(sourceWidth);
  const height = evenDimension(sourceHeight);
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const muxerModule = await importMp4Muxer();
  const target = new muxerModule.ArrayBufferTarget();
  const muxer = new muxerModule.Muxer({
    target,
    video: { codec: "avc", width, height },
    fastStart: "in-memory"
  });
  let encoderError = null;
  const encoder = new VideoEncoderCtor({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => { encoderError = error; }
  });
  encoder.configure({
    codec: "avc1.640028",
    width,
    height,
    bitrate: 5000000,
    framerate: fps
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const time = Math.min(duration, frameIndex / fps);
      const data = await api(apiPath("/frame") + "?time=" + encodeURIComponent(time));
      await drawSvgToCanvas(data.svg, canvas, width, height);
      const frame = new VideoFrameCtor(canvas, {
        timestamp: Math.round((frameIndex / fps) * 1000000),
        duration: Math.round((1 / fps) * 1000000)
      });
      encoder.encode(frame, { keyFrame: frameIndex % Math.max(1, fps * 2) === 0 });
      frame.close();
      if (encoderError) throw encoderError;
      if (frameIndex % 5 === 0 || frameIndex === totalFrames - 1) {
        const progress = Math.round(((frameIndex + 1) / totalFrames) * 100);
        if (button) button.textContent = "Exporting " + progress + "%";
        await yieldToBrowser();
      }
    }
    await encoder.flush();
    if (encoderError) throw encoderError;
    encoder.close();
    muxer.finalize();
    downloadBlob(new Blob([target.buffer], { type: "video/mp4" }), safeFileName(EDITOR_TITLE) + ".mp4");
  } catch (error) {
    try { encoder.close(); } catch {}
    throw error;
  }
}

async function importMp4Muxer() {
  if (MP4_MUXER_URL) return import(MP4_MUXER_URL);
  if (MP4_MUXER_SOURCE) {
    if (!mp4MuxerObjectUrl) {
      mp4MuxerObjectUrl = URL.createObjectURL(new Blob([MP4_MUXER_SOURCE], { type: "text/javascript" }));
    }
    return import(mp4MuxerObjectUrl);
  }
  throw new Error("Browser MP4 export is not available in this editor build.");
}

function filenameFromDisposition(header) {
  const match = /filename="([^"]+)"/.exec(header || "");
  return match ? match[1] : "";
}

function rasterizeSvgBlob(svg, width, height, mimeType, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return drawSvgToCanvas(svg, canvas, width, height).then(() => canvasToBlob(canvas, mimeType || "image/png", quality));
}

function drawSvgToCanvas(svg, canvas, width, height) {
  return new Promise((resolve, reject) => {
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Could not create canvas context."));
      return;
    }
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not rasterize current SVG frame."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export the canvas frame. Cross-origin image assets can block browser raster export."));
    }, mimeType, quality);
  });
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function evenDimension(value) {
  const rounded = Math.max(2, Math.round(Number(value) || 2));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function safeFileName(value) {
  return String(value || "sketchmark").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "sketchmark";
}

function yieldToBrowser() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function isCurveModalOpen() {
  return !curveModalBackdrop.classList.contains("hidden");
}

function openCurveModal() {
  refreshCurveModal();
  curveModalBackdrop.classList.remove("hidden");
}

function closeCurveModal() {
  curveModalBackdrop.classList.add("hidden");
  curveModalContent.innerHTML = "";
}

function selectedTracks() {
  const element = findElement(selectedId);
  return element && element.timeline && element.timeline.tracks ? element.timeline.tracks : {};
}

function refreshCurveModal(tracksInput) {
  const tracks = tracksInput || selectedTracks();
  const panel = renderCurvePanel(tracks);
  if (!panel) {
    closeCurveModal();
    return;
  }
  curveModalContent.innerHTML = "";
  curveModalContent.appendChild(panel);
}

function renderCurvePanel(tracks) {
  if (!selectedSegment) return null;
  const track = tracks[selectedSegment.property];
  if (!track) return null;
  const frames = normalizeTrackKeyframes(track);
  if (selectedSegment.index < 0 || selectedSegment.index >= frames.length - 1) return null;
  const start = frames[selectedSegment.index];
  const end = frames[selectedSegment.index + 1];
  const interpolation = resolveSegmentInterpolation(track, frames, selectedSegment.index);
  const panel = document.createElement("div");
  panel.className = "curvePanel";
  const header = document.createElement("div");
  header.className = "curvePanelHead";
  header.innerHTML = "<span class='curvePanelTitle'>Interpolation</span><span class='curvePanelRange'>" + escapeText(selectedSegment.property) + " | " + Number(start.time).toFixed(2) + "s -> " + Number(end.time).toFixed(2) + "s</span>";
  panel.appendChild(header);
  const graph = document.createElement("div");
  graph.className = "curvePreview";
  graph.innerHTML = renderCurveSvg(interpolation.curve, interpolation.ease, 320, 120);
  panel.appendChild(graph);
  const presets = document.createElement("div");
  presets.className = "curvePresets";
  const options = ["linear", "ease-in", "ease-out", "ease-in-out", "hold"];
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "curvePreset" + (interpolation.preset === option ? " active" : "");
    button.textContent = option;
    button.onclick = () => {
      applySegmentPreset(selectedSegment.property, selectedSegment.index, option).catch(showError);
    };
    presets.appendChild(button);
  }
  panel.appendChild(presets);
  const custom = document.createElement("div");
  custom.className = "curveCustom";
  if (interpolation.curve && interpolation.curve.type === "graph" && !isLinearGraphCurve(interpolation.curve.points)) {
    const label = document.createElement("span");
    label.className = "curveCustomLabel";
    label.textContent = "Custom graph points [x,y] (x must increase):";
    custom.appendChild(label);
    const area = document.createElement("textarea");
    area.value = formatGraphPoints(interpolation.curve.points);
    custom.appendChild(area);
    const applyGraph = document.createElement("button");
    applyGraph.type = "button";
    applyGraph.textContent = "Apply Graph";
    applyGraph.onclick = () => {
      const points = parseGraphPoints(area.value);
      if (!points) {
        showError(new Error("Graph points must be JSON array of [x,y] with increasing x."));
        return;
      }
      applySegmentCurve(selectedSegment.property, selectedSegment.index, { type: "graph", points }).catch(showError);
    };
    custom.appendChild(applyGraph);
  } else {
    const label = document.createElement("span");
    label.className = "curveCustomLabel";
    label.textContent = "Custom cubicBezier (editable graph controls):";
    custom.appendChild(label);
    const cubic = curveToEditableCubic(interpolation.curve, interpolation.ease);
    const fields = document.createElement("div");
    fields.className = "curveCustomFields";
    fields.innerHTML =
      "<label>x1<input id='curveX1' type='number' step='0.01' min='0' max='1' value='" + escapeAttr(cubic.x1.toFixed(2)) + "'></label>" +
      "<label>y1<input id='curveY1' type='number' step='0.01' value='" + escapeAttr(cubic.y1.toFixed(2)) + "'></label>" +
      "<label>x2<input id='curveX2' type='number' step='0.01' min='0' max='1' value='" + escapeAttr(cubic.x2.toFixed(2)) + "'></label>" +
      "<label>y2<input id='curveY2' type='number' step='0.01' value='" + escapeAttr(cubic.y2.toFixed(2)) + "'></label>";
    custom.appendChild(fields);
    const applyCubic = document.createElement("button");
    applyCubic.type = "button";
    applyCubic.textContent = "Apply Custom";
    applyCubic.onclick = () => {
      const x1 = clamp01(Number(document.getElementById("curveX1").value));
      const y1 = Number(document.getElementById("curveY1").value);
      const x2 = clamp01(Number(document.getElementById("curveX2").value));
      const y2 = Number(document.getElementById("curveY2").value);
      if (!Number.isFinite(y1) || !Number.isFinite(y2)) {
        showError(new Error("Bezier y values must be finite numbers."));
        return;
      }
      applySegmentCurve(selectedSegment.property, selectedSegment.index, { type: "cubicBezier", x1, y1, x2, y2 }).catch(showError);
    };
    custom.appendChild(applyCubic);
  }
  panel.appendChild(custom);
  const hint = document.createElement("div");
  hint.className = "tiny";
  hint.textContent = "Click an interpolation badge between keyframes to edit this segment.";
  panel.appendChild(hint);
  return panel;
}

function reconcileSelectedSegment(tracks, current) {
  if (current && isSegmentSelectionValid(tracks, current)) return current;
  for (const [property, track] of Object.entries(tracks)) {
    const frames = normalizeTrackKeyframes(track);
    if (frames.length >= 2) return { property, index: 0 };
  }
  return null;
}

function isSegmentSelectionValid(tracks, selection) {
  if (!selection) return false;
  const track = tracks[selection.property];
  if (!track) return false;
  const frames = normalizeTrackKeyframes(track);
  return selection.index >= 0 && selection.index < frames.length - 1;
}

function normalizeTrackKeyframes(track) {
  const frames = [];
  for (const frame of track && Array.isArray(track.keyframes) ? track.keyframes : []) {
    if (Array.isArray(frame) && Number.isFinite(Number(frame[0]))) {
      frames.push({ time: Number(frame[0]), value: frame[1] });
      continue;
    }
    if (frame && typeof frame === "object" && Number.isFinite(Number(frame.time))) {
      frames.push({
        time: Number(frame.time),
        value: frame.value,
        in: frame.in,
        out: frame.out,
        interpolation: frame.interpolation
      });
    }
  }
  frames.sort((left, right) => left.time - right.time);
  return frames;
}

function resolveSegmentInterpolation(track, frames, index) {
  const previous = frames[index];
  const next = frames[index + 1];
  const curve = (previous && (previous.out || previous.interpolation)) || (next && next.in) || (track && track.curve);
  const ease = curve ? undefined : track && track.ease;
  return { curve, ease, preset: curvePresetName(curve, ease), label: curvePresetLabel(curve, ease) };
}

function curvePresetName(curve, ease) {
  if (!curve) {
    const eased = String(ease || "linear");
    return eased === "ease-in" || eased === "ease-out" || eased === "ease-in-out" || eased === "linear" ? eased : "custom";
  }
  if (curve.type === "hold") return "hold";
  if (curve.type === "graph") return isLinearGraphCurve(curve.points) ? "linear" : "custom";
  if (curve.type === "cubicBezier") {
    if (isBezierCurve(curve, 0.42, 0, 1, 1)) return "ease-in";
    if (isBezierCurve(curve, 0, 0, 0.58, 1)) return "ease-out";
    if (isBezierCurve(curve, 0.42, 0, 0.58, 1)) return "ease-in-out";
    if (isBezierCurve(curve, 0, 0, 1, 1)) return "linear";
    return "custom";
  }
  return "custom";
}

function curvePresetLabel(curve, ease) {
  const name = curvePresetName(curve, ease);
  return name === "custom" ? "custom" : name;
}

function isLinearGraphCurve(points) {
  if (!Array.isArray(points) || points.length < 2) return false;
  const first = points[0];
  const last = points[points.length - 1];
  if (!Array.isArray(first) || !Array.isArray(last)) return false;
  return nearlyEqual(Number(first[0]), 0) && nearlyEqual(Number(first[1]), 0) && nearlyEqual(Number(last[0]), 1) && nearlyEqual(Number(last[1]), 1);
}

function isBezierCurve(curve, x1, y1, x2, y2) {
  return nearlyEqual(Number(curve.x1), x1) && nearlyEqual(Number(curve.y1), y1) && nearlyEqual(Number(curve.x2), x2) && nearlyEqual(Number(curve.y2), y2);
}

function nearlyEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.0001;
}

function renderCurveSvg(curve, ease, width, height) {
  const innerWidth = Math.max(16, Number(width || 160));
  const innerHeight = Math.max(16, Number(height || 56));
  const line = curvePath(curve, ease, innerWidth - 2, innerHeight - 2, 36);
  return "<svg viewBox='0 0 " + innerWidth + " " + innerHeight + "' preserveAspectRatio='none' width='100%' height='100%' aria-hidden='true'>" +
    "<path d='M1 " + (innerHeight - 1) + " L" + (innerWidth - 1) + " 1' stroke='#d2d6dd' stroke-width='1' fill='none'/>" +
    "<path d='" + line + "' stroke='#0f172a' stroke-width='2' fill='none'/>" +
    "</svg>";
}

function curvePath(curve, ease, width, height, steps) {
  const segments = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / Math.max(1, steps);
    const x = 1 + t * width;
    const y = 1 + (1 - clamp01(sampleCurve(curve, ease, t))) * height;
    segments.push((index === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2));
  }
  return segments.join(" ");
}

function sampleCurve(curve, ease, t) {
  const x = clamp01(t);
  if (!curve) return sampleEase(ease, x);
  if (curve.type === "hold") return x < 1 ? 0 : 1;
  if (curve.type === "graph") return sampleGraph(curve.points, x);
  if (curve.type === "cubicBezier") return sampleCubicBezier(x, Number(curve.x1), Number(curve.y1), Number(curve.x2), Number(curve.y2));
  return sampleEase(ease, x);
}

function sampleGraph(points, t) {
  const list = Array.isArray(points) ? points.filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))) : [];
  if (!list.length) return t;
  list.sort((left, right) => Number(left[0]) - Number(right[0]));
  if (t <= Number(list[0][0])) return Number(list[0][1]);
  for (let index = 1; index < list.length; index += 1) {
    const previous = list[index - 1];
    const next = list[index];
    if (t <= Number(next[0])) {
      const span = Math.max(0.000001, Number(next[0]) - Number(previous[0]));
      const local = (t - Number(previous[0])) / span;
      return Number(previous[1]) + (Number(next[1]) - Number(previous[1])) * local;
    }
  }
  const last = list[list.length - 1];
  return Number(last[1]);
}

function sampleCubicBezier(t, x1, y1, x2, y2) {
  let low = 0;
  let high = 1;
  let u = t;
  for (let index = 0; index < 24; index += 1) {
    u = (low + high) / 2;
    const x = cubicBezierValue(0, x1, x2, 1, u);
    if (x < t) low = u;
    else high = u;
  }
  return cubicBezierValue(0, y1, y2, 1, u);
}

function cubicBezierValue(a, b, c, d, t) {
  const mt = 1 - t;
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

function sampleEase(ease, t) {
  const x = clamp01(t);
  switch (ease) {
    case "ease-in":
      return x * x;
    case "ease-out":
      return 1 - (1 - x) * (1 - x);
    case "ease-in-out":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case "linear":
    default:
      return x;
  }
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function curveToEditableCubic(curve, ease) {
  if (curve && curve.type === "cubicBezier") {
    return {
      x1: clamp01(curve.x1),
      y1: Number.isFinite(Number(curve.y1)) ? Number(curve.y1) : 0,
      x2: clamp01(curve.x2),
      y2: Number.isFinite(Number(curve.y2)) ? Number(curve.y2) : 1
    };
  }
  const preset = curvePresetName(curve, ease);
  if (preset === "ease-in") return { x1: 0.42, y1: 0, x2: 1, y2: 1 };
  if (preset === "ease-out") return { x1: 0, y1: 0, x2: 0.58, y2: 1 };
  if (preset === "ease-in-out") return { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
  if (preset === "linear") return { x1: 0, y1: 0, x2: 1, y2: 1 };
  return { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
}

function formatGraphPoints(points) {
  const list = Array.isArray(points) ? points.filter((point) => Array.isArray(point) && point.length >= 2) : [];
  const safe = list.map((point) => [Number(point[0]), Number(point[1])]);
  return JSON.stringify(safe, null, 2);
}

function parseGraphPoints(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || "").trim());
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 2) return null;
  const points = parsed
    .map((point) => Array.isArray(point) && point.length >= 2 ? [Number(point[0]), Number(point[1])] : null)
    .filter((point) => point && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (points.length < 2) return null;
  points.sort((left, right) => left[0] - right[0]);
  for (let index = 1; index < points.length; index += 1) {
    if (points[index][0] <= points[index - 1][0]) return null;
  }
  return points;
}

async function applySegmentPreset(property, segmentIndex, preset) {
  if (!selectedId || !ensureElementEditable(selectedId)) return;
  const element = findElement(selectedId);
  const track = element && element.timeline && element.timeline.tracks ? element.timeline.tracks[property] : null;
  if (!track) return;
  const frames = normalizeTrackKeyframes(track);
  if (segmentIndex < 0 || segmentIndex >= frames.length - 1) return;
  const start = frames[segmentIndex];
  await mutate(
    apiPath("/keyframe"),
    { id: selectedId, property, value: start.value, time: start.time, curvePreset: preset },
    { refreshTree: false, refreshInspector: false, refreshTimeline: true }
  );
}

async function applySegmentCurve(property, segmentIndex, curve) {
  if (!selectedId || !ensureElementEditable(selectedId)) return;
  const element = findElement(selectedId);
  const track = element && element.timeline && element.timeline.tracks ? element.timeline.tracks[property] : null;
  if (!track) return;
  const frames = normalizeTrackKeyframes(track);
  if (segmentIndex < 0 || segmentIndex >= frames.length - 1) return;
  const start = frames[segmentIndex];
  await mutate(
    apiPath("/keyframe"),
    { id: selectedId, property, value: start.value, time: start.time, curve },
    { refreshTree: false, refreshInspector: false, refreshTimeline: true }
  );
}

function setCurrentTime(time, options) {
  const scrubbing = Boolean(options && options.scrubbing);
  if (scrubbing) beginScrubPreview();
  const duration = Math.max(Number(doc && doc.canvas && doc.canvas.duration || 0), 0.01);
  const next = Math.max(0, Math.min(Number(time || 0), duration));
  currentTime = next;
  const scrub = document.getElementById("scrub");
  if (scrub) scrub.value = String(next);
  const label = document.getElementById("timeLabel");
  if (label) label.textContent = next.toFixed(2) + "s";
  const kfTime = document.getElementById("kfTime");
  if (kfTime) kfTime.value = next.toFixed(2);
  requestDraw();
  if (scrubbing) scheduleEndScrubPreview();
}

function clearSidebarCommitTimers() {
  for (const key of Object.keys(sidebarCommitTimers)) {
    clearTimeout(sidebarCommitTimers[key]);
    delete sidebarCommitTimers[key];
  }
}

function scheduleSidebarPositionKeyframe() {
  scheduleSidebarKeyframe("position", () => {
    const x = readNumberInput("propX");
    const y = readNumberInput("propY");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [x, y];
  });
}

function scheduleSidebarOriginKeyframe() {
  scheduleSidebarKeyframe("origin", () => {
    const x = readNumberInput("propOriginX");
    const y = readNumberInput("propOriginY");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [x, y];
  });
}

function scheduleSidebarPointKeyframe(property, xId, yId) {
  scheduleSidebarKeyframe(property, () => {
    const x = readNumberInput(xId);
    const y = readNumberInput(yId);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [x, y];
  });
}

function scheduleSidebarNumberKeyframe(property, inputId) {
  scheduleSidebarKeyframe(property, () => {
    const value = readNumberInput(inputId);
    return Number.isFinite(value) ? value : null;
  });
}

function scheduleSidebarNumberArrayKeyframe(property, inputId) {
  scheduleSidebarKeyframe(property, () => {
    const text = readTextInput(inputId).trim();
    if (!text) return [];
    const values = text.split(/[,\s]+/).filter(Boolean).map(Number);
    return values.every(Number.isFinite) ? values : null;
  });
}

function scheduleSidebarPaintKeyframe(property, inputId) {
  scheduleSidebarKeyframe(property, () => {
    const value = readTextInput(inputId).trim();
    return value ? value : null;
  });
}

function scheduleSidebarTextContentKeyframe(property, inputId) {
  if (property === "lines") {
    scheduleSidebarStringArrayKeyframe(property, inputId);
    return;
  }
  scheduleSidebarTextKeyframe(property, inputId);
}

function scheduleSidebarTextKeyframe(property, inputId) {
  scheduleSidebarKeyframe(property, () => readTextInput(inputId));
}

function scheduleSidebarNumberOrTextKeyframe(property, inputId) {
  scheduleSidebarKeyframe(property, () => {
    const value = readTextInput(inputId).trim();
    if (!value) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  });
}

function scheduleSidebarStringArrayKeyframe(property, inputId) {
  scheduleSidebarKeyframe(property, () => {
    const value = readTextInput(inputId);
    if (!value) return [];
    return value.split(/\\r?\\n/);
  });
}

function scheduleSidebarDynamicKeyframe(input) {
  const property = input.getAttribute("data-kf-property");
  const kind = input.getAttribute("data-kf-kind") || "text";
  if (!property) return;
  if (kind === "number") {
    scheduleSidebarNumberKeyframe(property, input.id);
    return;
  }
  if (kind === "point") {
    scheduleSidebarPointKeyframe(property, input.getAttribute("data-kf-x"), input.getAttribute("data-kf-y"));
    return;
  }
  if (kind === "clipRadius") {
    scheduleSidebarClipRadiusKeyframe(property, input.id);
    return;
  }
  scheduleSidebarTextKeyframe(property, input.id);
}

function scheduleSidebarClipRadiusKeyframe(property, inputId) {
  scheduleSidebarKeyframe(property, () => {
    const radius = readNumberInput(inputId);
    if (!Number.isFinite(radius)) return null;
    const element = findResolvedElement(selectedId) || findElement(selectedId);
    if (!element || element.type !== "image") return null;
    return roundedRectClipPath(Number(element.x || 0), Number(element.y || 0), Number(element.width || 0), Number(element.height || 0), radius);
  });
}

function scheduleSidebarKeyframe(property, valueReader) {
  if (!selectedId || !ensureElementEditable(selectedId)) return;
  if (sidebarCommitTimers[property]) clearTimeout(sidebarCommitTimers[property]);
  sidebarCommitTimers[property] = setTimeout(async () => {
    delete sidebarCommitTimers[property];
    const value = valueReader();
    if (value === null || value === undefined) return;
    try {
      await mutate(
        apiPath("/keyframe"),
        { id: selectedId, property, value, time: currentTime, curvePreset: "linear" },
        { refreshTree: false, refreshInspector: false, refreshTimeline: true }
      );
    } catch (error) {
      showError(error);
    }
  }, 120);
}

function readNumberInput(id) {
  const input = document.getElementById(id);
  if (!input) return NaN;
  const value = Number(input.value);
  return Number.isFinite(value) ? value : NaN;
}

function readTextInput(id) {
  const input = document.getElementById(id);
  return input ? String(input.value ?? "") : "";
}

async function removeKeyframe(property, time) {
  try {
    if (!ensureElementEditable(selectedId)) return;
    await mutate(apiPath("/remove-keyframe"), { id: selectedId, property, time });
  } catch (error) {
    showError(error);
  }
}

async function mutate(path, body, options) {
  const refreshTree = !options || options.refreshTree !== false;
  const refreshInspector = !options || options.refreshInspector !== false;
  const refreshTimeline = !options || options.refreshTimeline !== false;
  const data = await api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  doc = data.document;
  refs = data.elements;
  const duration = Math.max(Number(doc && doc.canvas && doc.canvas.duration || 0), 0.01);
  if (!Number.isFinite(currentTime) || currentTime < 0) currentTime = 0;
  if (currentTime > duration) currentTime = duration;
  rebuildElementIndex();
  if (selectedId && !findElement(selectedId)) selectedId = "";
  if (refreshTree) renderTree();
  if (refreshInspector) renderInspector();
  if (refreshTimeline) renderTimeline();
  requestDraw();
}

stageWrap.addEventListener("wheel", (event) => {
  if (!stage.contains(event.target)) return;
  const delta = wheelDeltaToPixels(event);
  const zoomGesture = event.ctrlKey || event.metaKey;
  if (spacePanActive || !zoomGesture) {
    panViewportByPixels(delta.x, delta.y);
    event.preventDefault();
    return;
  }
  zoomBy(zoomFactorFromWheel(event), event.clientX, event.clientY);
  event.preventDefault();
}, { passive: false });

stageWrap.addEventListener("pointerdown", (event) => {
  if (!shouldStartViewportPan(event)) return;
  beginViewportPan(event);
}, true);

stageWrap.addEventListener("pointermove", (event) => {
  updateViewportPan(event);
}, true);

stageWrap.addEventListener("pointerup", (event) => {
  endViewportPan(event);
}, true);

stageWrap.addEventListener("pointercancel", (event) => {
  endViewportPan(event);
}, true);

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
  if (target && findElement(target.id)) {
    if (isElementLocked(target.id) || isElementHidden(target.id)) return;
    select(target.id);
  }
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
  if (event.code === "Space" && !isEditableInputTarget(document.activeElement)) {
    spacePanActive = true;
    event.preventDefault();
    return;
  }
  if (event.key !== "Escape") return;
  if (isCurveModalOpen()) {
    closeCurveModal();
    return;
  }
  drag = null;
  endViewportPan();
  suppressClick = false;
  deselect();
});

document.addEventListener("keyup", (event) => {
  if (event.code === "Space") spacePanActive = false;
});

window.addEventListener("blur", () => {
  spacePanActive = false;
  endViewportPan();
});

stage.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-handle]");
  if (handle && selectedId) {
    if (isElementLocked(selectedId) || isElementHidden(selectedId)) return;
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
  if (isElementLocked(target.id) || isElementHidden(target.id)) return;
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
  suppressClick = true;
  let committed = false;
  try {
    if (snapshot.changed) {
      await commitDrag(snapshot);
      committed = true;
    }
  } finally {
    if (snapshot.changed && !committed && snapshot.target) {
      if (snapshot.transform) snapshot.target.setAttribute("transform", snapshot.transform);
      else snapshot.target.removeAttribute("transform");
    }
    releaseLiveDragPreview(committed);
  }
}

function startDrag(event, target, mode) {
  if (!target || isElementLocked(target.id) || isElementHidden(target.id)) return;
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
  showLiveDragPreview(target);
  requestVisibleCanvasStageRender(doc && doc.canvas);
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
  if (!ensureElementEditable(element.id)) return;
  await mutate(apiPath("/keyframe"), { id: element.id, property, value, time: currentTime, curvePreset: "linear" });
}

function ensureElementEditable(id) {
  if (!id) return false;
  if (isElementLocked(id)) {
    showError(new Error("Element is locked."));
    return false;
  }
  return true;
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
  showLiveDragPreview(drag.target);
}
function selectedTarget() {
  if (!selectedId || isElementHidden(selectedId) || isElementLocked(selectedId)) return null;
  return stage.querySelector("#" + cssId(selectedId));
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
    matrix = elementMatrixInSvg(target, svg);
  } catch {
    return;
  }
  if (!matrix) return;
  const topLeft = matrixPoint(svg, matrix, box.x, box.y);
  const topRight = matrixPoint(svg, matrix, box.x + box.width, box.y);
  const bottomRight = matrixPoint(svg, matrix, box.x + box.width, box.y + box.height);
  const bottomLeft = matrixPoint(svg, matrix, box.x, box.y + box.height);
  const center = matrixPoint(svg, matrix, box.x + box.width / 2, box.y + box.height / 2);
  const topCenter = midpoint(topLeft, topRight);
  const rotate = offsetFromPoint(center, topCenter, 32);
  const scale = matrixPoint(svg, matrix, box.x + box.width, box.y + box.height);
  const group = svgNode("g");
  group.setAttribute("id", "__sketchmark_handles");
  group.setAttribute("style", "pointer-events:all");
  const selection = svgNode("polygon");
  selection.setAttribute("points", topLeft.x + "," + topLeft.y + " " + topRight.x + "," + topRight.y + " " + bottomRight.x + "," + bottomRight.y + " " + bottomLeft.x + "," + bottomLeft.y);
  selection.setAttribute("fill", "none");
  selection.setAttribute("stroke", "#ff0000");
  selection.setAttribute("stroke-width", "1.5");
  selection.setAttribute("stroke-dasharray", "4 3");
  selection.setAttribute("vector-effect", "non-scaling-stroke");
  selection.setAttribute("style", "pointer-events:none");
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
  group.appendChild(selection);
  group.appendChild(stem);
  group.appendChild(rotateHandle);
  group.appendChild(scaleHandle);
  svg.appendChild(group);
}
function elementMatrixInSvg(target, svg) {
  const targetScreen = target.getScreenCTM ? target.getScreenCTM() : null;
  const svgScreen = svg.getScreenCTM ? svg.getScreenCTM() : null;
  if (targetScreen && svgScreen && svgScreen.inverse) {
    try {
      return svgScreen.inverse().multiply(targetScreen);
    } catch {}
  }
  return target.getCTM ? target.getCTM() : null;
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
function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function offsetFromPoint(origin, edge, distance) {
  const dx = edge.x - origin.x;
  const dy = edge.y - origin.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(length) || length < 0.000001) return { x: edge.x, y: edge.y - distance };
  return { x: edge.x + (dx / length) * distance, y: edge.y + (dy / length) * distance };
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
  const origin = originPointValue(element);
  setInput("propX", valueOr(element.x, 0));
  setInput("propY", valueOr(element.y, 0));
  setInput("propRotation", valueOr(element.rotation, 0));
  setInput("propScale", valueOr(element.scale, 1));
  setInput("propScaleX", valueOr(element.scaleX, valueOr(element.scale, 1)));
  setInput("propScaleY", valueOr(element.scaleY, valueOr(element.scale, 1)));
  setInput("propOriginX", origin[0]);
  setInput("propOriginY", origin[1]);
  setInput("propOpacity", valueOr(element.opacity, 1));
  setInput("propStrokeWidth", valueOr(element.strokeWidth, 1));
  setInput("propDashOffset", valueOr(element.dashOffset, 0));
  setInput("propDashArray", formatArrayValue(element.dashArray));
  setInput("propDrawStart", valueOr(element.drawStart, 0));
  setInput("propDrawEnd", valueOr(element.drawEnd, 1));
  if (typeof element.fill === "string") setInput("propFill", element.fill);
  if (typeof element.stroke === "string") setInput("propStroke", element.stroke);
  if (element.type === "text") {
    setInput("propText", textEditorValue(element));
    setInput("propFontFamily", valueOr(element.fontFamily, defaultFontFamilyValue()));
    setInput("propWeight", valueOr(element.weight, 400));
    setInput("propFontSize", valueOr(element.fontSize, 16));
    setInput("propLineHeight", valueOr(element.lineHeight, 1.2));
    setInput("propLetterSpacing", valueOr(element.letterSpacing, 0));
  }
  syncDynamicInspectorValues(element);
  syncColorPickersInScope(inspector);
}

function textEditorProperty(element) {
  return Array.isArray(element && element.lines) && element.lines.length ? "lines" : "text";
}

function textEditorValue(element) {
  if (Array.isArray(element && element.lines) && element.lines.length) {
    return element.lines.map((line) => String(line)).join("\\n");
  }
  return String(valueOr(element && element.text, ""));
}

function syncDynamicInspectorValues(element) {
  const effects = element.effects || {};
  const shadow = effects.shadow || {};
  setInput("propEffectsBlur", valueOr(effects.blur, 0));
  setInput("propEffectsBrightness", valueOr(effects.brightness, 1));
  setInput("propEffectsContrast", valueOr(effects.contrast, 1));
  setInput("propEffectsSaturate", valueOr(effects.saturate, 1));
  setInput("propEffectsHue", valueOr(effects.hueRotate, 0));
  setInput("propShadowDx", valueOr(shadow.dx, 0));
  setInput("propShadowDy", valueOr(shadow.dy, 0));
  setInput("propShadowBlur", valueOr(shadow.blur, 0));
  setInput("propShadowColor", valueOr(shadow.color, "#000000"));
  setInput("propShadowOpacity", valueOr(shadow.opacity, 1));
  if (element.type === "image") {
    const source = element.source || { x: 0, y: 0, width: element.width || 0, height: element.height || 0 };
    setInput("propSourceX", valueOr(source.x, 0));
    setInput("propSourceY", valueOr(source.y, 0));
    setInput("propSourceWidth", valueOr(source.width, element.width || 0));
    setInput("propSourceHeight", valueOr(source.height, element.height || 0));
    setInput("propClipRadius", clipRadiusValue(element));
  }
  syncStructuredPaintValues(element, "fill");
  syncStructuredPaintValues(element, "stroke");
}

function syncStructuredPaintValues(element, root) {
  const paint = element[root];
  if (!paint || typeof paint !== "object") return;
  const prefix = "prop" + cap(root);
  if (paint.type === "linearGradient") {
    setPointInputs(prefix + "From", paint.from || [0, 0]);
    setPointInputs(prefix + "To", paint.to || [100, 0]);
  } else if (paint.type === "radialGradient") {
    setPointInputs(prefix + "Center", paint.center || [50, 50]);
    setPointInputs(prefix + "Focus", paint.focus || paint.center || [50, 50]);
    setInput(prefix + "Radius", valueOr(paint.radius, 50));
  }
  const stops = Array.isArray(paint.stops) ? paint.stops : [];
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    setInput(prefix + "Stop" + index + "Offset", Array.isArray(stop) ? stop[0] : valueOr(stop && stop.offset, 0));
    setInput(prefix + "Stop" + index + "Color", Array.isArray(stop) ? stop[1] : valueOr(stop && stop.color, "#000000"));
  }
}

function setPointInputs(prefix, point) {
  const value = Array.isArray(point) ? point : [0, 0];
  setInput(prefix + "X", valueOr(value[0], 0));
  setInput(prefix + "Y", valueOr(value[1], 0));
}
function originPointValue(element) {
  if (Array.isArray(element && element.origin) && element.origin.length === 2) {
    const x = Number(element.origin[0]);
    const y = Number(element.origin[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
  }
  const x = Number(element && element.x);
  const y = Number(element && element.y);
  if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
  return [0, 0];
}
function valueOr(value, fallback) { return value === undefined ? fallback : value; }
function clipRadiusValue(element) {
  if (!element || !element.clip || typeof element.clip.d !== "string") return 0;
  const numbers = element.clip.d.match(/-?\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?/gi);
  if (!numbers || numbers.length < 2) return 0;
  const x = Number(element.x || 0);
  const y = Number(element.y || 0);
  const width = Math.max(0, Number(element.width || 0));
  const height = Math.max(0, Number(element.height || 0));
  const firstX = Number(numbers[0]);
  const firstY = Number(numbers[1]);
  if (!Number.isFinite(firstX) || !Number.isFinite(firstY)) return 0;
  if (Math.abs(firstX - x) < 0.001 && Math.abs(firstY - y) < 0.001) return 0;
  const radius = Math.max(0, Math.min(firstX - x, width / 2, height / 2));
  return Number.isFinite(radius) ? Number(radius.toFixed(2)) : 0;
}
function roundedRectClipPath(x, y, width, height, radius) {
  const left = finiteNumber(x, 0);
  const top = finiteNumber(y, 0);
  const w = Math.max(0, finiteNumber(width, 0));
  const h = Math.max(0, finiteNumber(height, 0));
  const r = Math.min(Math.max(0, finiteNumber(radius, 0)), w / 2, h / 2);
  const right = left + w;
  const bottom = top + h;
  if (r <= 0) return "M " + left + " " + top + " H " + right + " V " + bottom + " H " + left + " Z";
  return [
    "M " + (left + r) + " " + top,
    "H " + (right - r),
    "Q " + right + " " + top + " " + right + " " + (top + r),
    "V " + (bottom - r),
    "Q " + right + " " + bottom + " " + (right - r) + " " + bottom,
    "H " + (left + r),
    "Q " + left + " " + bottom + " " + left + " " + (bottom - r),
    "V " + (top + r),
    "Q " + left + " " + top + " " + (left + r) + " " + top,
    "Z"
  ].join(" ");
}
function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function formatArrayValue(value) {
  return Array.isArray(value) ? value.map((item) => typeof item === "number" ? Number(item).toFixed(2).replace(/\\.00$/, "") : String(item)).join(",") : "";
}
function formatMotionValue(value) {
  if (Array.isArray(value)) return "[" + value.map((item) => typeof item === "number" ? Number(item).toFixed(2).replace(/\\.00$/, "") : JSON.stringify(item)).join(",") + "]";
  if (typeof value === "number") return Number(value).toFixed(2).replace(/\\.00$/, "");
  if (value === undefined) return "";
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function cap(value) { value = String(value); return value.charAt(0).toUpperCase() + value.slice(1); }
function cssId(id) { return String(id).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\\\\]^\\\`{|}~])/g, "\\\\$1"); }
function escapeText(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escapeAttr(value) { return escapeText(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function showError(error) { const box = document.getElementById("error"); if (box) box.textContent = error.message || String(error); }
load().catch(showError);
</script></body></html>`;
}


function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function normalizeApiBase(value) {
  const text = String(value || "/api").replace(/\/+$/, "");
  return text.startsWith("/") ? text : `/${text}`;
}

function editorMp4MuxerSource(value) {
  if (value === false) return "";
  if (typeof value === "string") return value;
  for (const candidate of mp4MuxerSourceCandidates()) {
    try {
      if (candidate && fs.existsSync(candidate)) return fs.readFileSync(candidate, "utf8");
    } catch {
      // Try the next candidate.
    }
  }
  return "";
}

function resolveMp4MuxerSource(value) {
  return editorMp4MuxerSource(value);
}

function mp4MuxerSourceCandidates() {
  const candidates = [path.join(__dirname, "vendor", "mp4-muxer.mjs")];
  try {
    const resolved = require.resolve("mp4-muxer");
    candidates.push(resolved.replace(/\.js$/, ".mjs"));
    candidates.push(path.join(path.dirname(resolved), "mp4-muxer.mjs"));
  } catch {
    // Dependency may be bundled differently by the host app.
  }
  candidates.push(path.join(/*turbopackIgnore: true*/ process.cwd(), "node_modules", "mp4-muxer", "build", "mp4-muxer.mjs"));
  return candidates;
}

function scriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

module.exports = { editorHtml, editorMp4MuxerSource };
