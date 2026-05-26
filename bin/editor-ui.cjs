"use strict";

function editorHtml(title) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sketchmark Editor - ${escapeHtml(title)}</title><style>
html,body{margin:0;width:100%;height:100%;font:13px Arial,sans-serif;background:#c0c0c0;color:#000;overflow:hidden}
body{display:grid;grid-template-columns:240px 1fr 300px;grid-template-rows:1fr 165px;min-width:900px;overflow:hidden}
button,input,select{font:13px Arial,sans-serif}
button{padding:3px 8px}
input,select{box-sizing:border-box;width:100%}
#tree,#inspector,#timeline{background:#f3f4f6;border:1px solid #c6ccd6;overflow:auto;padding:6px;scrollbar-width:none;-ms-overflow-style:none}
#tree{grid-row:1/3}
#stageWrap{position:relative;display:grid;place-items:center;min-width:0;min-height:0;padding:0;background:#fff;overflow:hidden;cursor:default}
#stageWrap.panning{cursor:grabbing}
#stage{display:grid;place-items:center;min-width:0;min-height:0}
#stage svg{max-width:100%;max-height:calc(100vh - 190px);background:white;border:1px solid #333;overflow:visible}
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
#error{color:#900;min-height:18px;margin-top:6px}.tiny{font-size:11px;color:#444}.toolbar{display:grid;grid-template-columns:auto 1fr auto auto auto;gap:6px;align-items:center}
.menuWrap{position:relative}
.menuBtn{min-width:72px}
.menuList{position:absolute;right:0;top:calc(100% + 4px);display:grid;gap:2px;padding:4px;background:#f3f4f6;border:1px solid #8f96a3;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:5}
.menuList button{min-width:88px;text-align:left;padding:2px 8px}
.menuList.hidden{display:none}
</style></head><body><aside id="tree"></aside><main id="stageWrap"><div id="stage"></div><div id="viewportHud"><button id="zoomOut" type="button" title="Zoom out">-</button><button id="zoomIn" type="button" title="Zoom in">+</button><button id="zoomFit" type="button" title="Reset zoom and pan">Fit</button><span id="zoomLabel">100%</span></div></main><aside id="inspector"></aside><section id="timeline"></section><div id="curveModalBackdrop" class="modalBackdrop hidden"><div id="curveModal" class="curveModal" role="dialog" aria-modal="true" aria-label="Interpolation Graph"><div class="curveModalBar"><strong>Interpolation Graph</strong><button id="curveModalClose" type="button">Close</button></div><div id="curveModalContent" class="curveModalContent"></div></div></div><script>
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
let drag = null;
let suppressClick = false;
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

curveModalClose.onclick = closeCurveModal;
curveModalBackdrop.onclick = (event) => {
  if (event.target === curveModalBackdrop) closeCurveModal();
};
curveModal.onclick = (event) => event.stopPropagation();
zoomOut.onclick = () => zoomBy(1.12);
zoomIn.onclick = () => zoomBy(1 / 1.12);
zoomFit.onclick = () => resetViewport(true);
document.addEventListener("click", (event) => {
  const wrap = document.getElementById("exportMenuWrap");
  const menu = document.getElementById("exportMenu");
  if (!wrap || !menu) return;
  if (wrap.contains(event.target)) return;
  menu.classList.add("hidden");
});

async function api(path, options) {
  const response = await fetch(path, options || { cache: "no-store" });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function load() {
  clearSidebarCommitTimers();
  const data = await api("/api/document");
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
    if (svg) {
      svg.style.overflow = "visible";
      applyViewportToSvg(svg, data.canvas || (doc && doc.canvas));
    } else {
      updateZoomLabel();
    }
    applyEditorFlagsToStage();
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
  svg.setAttribute("viewBox", viewport.x.toFixed(3) + " " + viewport.y.toFixed(3) + " " + viewport.width.toFixed(3) + " " + viewport.height.toFixed(3));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  updateZoomLabel();
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
  return stage.querySelector("svg");
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
    panelDetails("tree-canvas", "Canvas", canvasBody, { defaultOpen: false, meta: canvasSummary }) +
    panelDetails("tree-elements", "Elements", "<div id='elementsTree'></div>", { defaultOpen: false, meta: refs.length + " items" });
  bindPanelStates(tree);
  bindCanvasInputs();
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
        "/api/canvas",
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
  if (!element) {
    inspector.innerHTML = "<div class='muted'>Select an element.</div>";
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
  const textRows = isTextElement
    ? "<div class='row'><label>Text<input id='propText' type='text' " + lockDisabled + "></label><div></div></div>"
    : "";
  const effectsRows = supportsEffects ? renderEffectsRows(displayElement, lockDisabled) : "";
  const sourceRows = element.type === "image" ? renderImageSourceRows(displayElement, lockDisabled) : "";
  const structuredPaintRows = supportsPaint ? renderStructuredPaintRows(displayElement, "fill", lockDisabled) + renderStructuredPaintRows(displayElement, "stroke", lockDisabled) : "";
  const selectedMeta = escapeText(element.type) + (hidden ? " | hidden" : "") + (locked ? " | locked" : "");
  const selectedRows =
    "<strong>" + escapeText(element.id || "") + "</strong>" +
    "<div class='muted'>" + selectedMeta + "</div>" +
    (locked ? "<div class='tiny'>Locked elements and groups cannot be edited from canvas or inspector.</div>" : "") +
    "<div id='error'></div>";
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
    panelDetails("inspector-keyframe", "Keyframe", keyframeRows, { defaultOpen: false });
  bindPanelStates(inspector);
  if (supportsPaint) {
    setInput("propFill", typeof displayElement.fill === "string" ? displayElement.fill : "");
    setInput("propStroke", typeof displayElement.stroke === "string" ? displayElement.stroke : "");
  }
  if (isTextElement) setInput("propText", displayElement.text === undefined ? "" : String(displayElement.text));
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
      bindAutoKeyframe("propText", () => scheduleSidebarTextKeyframe("text", "propText"));
    }
    bindDynamicInspectorInputs(bindAutoKeyframe);
  }
  bindColorPickersInScope(inspector);
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
  timeline.innerHTML = "<div class='toolbar'><button id='play'>" + (playing ? "Pause" : "Play") + "</button><input id='scrub' type='range' min='0' max='" + Math.max(Number(doc.canvas.duration || 0), 0.01) + "' step='0.005' value='" + currentTime + "'><strong id='timeLabel'>" + currentTime.toFixed(2) + "s</strong><button id='refresh'>Refresh</button><div id='exportMenuWrap' class='menuWrap'><button id='exportMenuBtn' class='menuBtn' type='button' title='Export options'>Export</button><div id='exportMenu' class='menuList hidden'><button id='exportSvg' type='button' title='Export current frame as SVG'>SVG</button><button id='exportPng' type='button' title='Export current frame as PNG'>PNG</button><button id='exportMp4' type='button' title='Export full animation as MP4'>MP4</button></div></div></div>";
  document.getElementById("play").onclick = togglePlay;
  const exportMenuBtn = document.getElementById("exportMenuBtn");
  const exportMenu = document.getElementById("exportMenu");
  exportMenuBtn.onclick = (event) => {
    event.stopPropagation();
    if (exportMenu) exportMenu.classList.toggle("hidden");
  };
  if (exportMenu) exportMenu.onclick = (event) => event.stopPropagation();
  document.getElementById("exportSvg").onclick = () => {
    if (exportMenu) exportMenu.classList.add("hidden");
    exportDocument("svg", exportMenuBtn);
  };
  document.getElementById("exportPng").onclick = () => {
    if (exportMenu) exportMenu.classList.add("hidden");
    exportDocument("png", exportMenuBtn);
  };
  document.getElementById("exportMp4").onclick = () => {
    if (exportMenu) exportMenu.classList.add("hidden");
    exportDocument("mp4", exportMenuBtn);
  };
  document.getElementById("refresh").onclick = load;
  document.getElementById("scrub").oninput = (event) => {
    setCurrentTime(event.target.value);
  };
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
    const response = await fetch("/api/export?format=" + encodeURIComponent(format) + "&time=" + encodeURIComponent(currentTime), { cache: "no-store" });
    if (!response.ok) {
      let message = "Export failed.";
      try {
        const data = await response.json();
        message = data.error || message;
      } catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filenameFromDisposition(response.headers.get("content-disposition")) || ("sketchmark." + format);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (error) {
    showError(error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}

function filenameFromDisposition(header) {
  const match = /filename="([^"]+)"/.exec(header || "");
  return match ? match[1] : "";
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
    "/api/keyframe",
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
    "/api/keyframe",
    { id: selectedId, property, value: start.value, time: start.time, curve },
    { refreshTree: false, refreshInspector: false, refreshTimeline: true }
  );
}

function setCurrentTime(time) {
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

function scheduleSidebarTextKeyframe(property, inputId) {
  scheduleSidebarKeyframe(property, () => readTextInput(inputId));
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
  scheduleSidebarTextKeyframe(property, input.id);
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
        "/api/keyframe",
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
    await mutate("/api/remove-keyframe", { id: selectedId, property, time });
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
  if (snapshot.changed) {
    await commitDrag(snapshot);
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
  await mutate("/api/keyframe", { id: element.id, property, value, time: currentTime, curvePreset: "linear" });
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
  const rotate = matrixPoint(svg, matrix, box.x + box.width / 2, box.y - 32);
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
  if (element.type === "text") setInput("propText", element.text === undefined ? "" : String(element.text));
  syncDynamicInspectorValues(element);
  syncColorPickersInScope(inspector);
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

module.exports = { editorHtml };
