"use strict";

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
.treeRow{display:grid;grid-template-columns:16px 20px 20px 1fr;gap:3px;align-items:center;margin:1px 0}
.treePad{display:block;width:16px;height:20px}
.treeCtl{height:20px;padding:0;border:1px solid #9aa1ad;background:#f8fafc;cursor:pointer;line-height:18px;font-size:11px}
.treeCtl.active{background:#003399;color:#fff;border-color:#003399}
.treeBtn{display:block;width:100%;text-align:left;margin:0;border:1px solid transparent;background:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px 6px}
.treeBtn.dim{opacity:0.6}
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
let collapsedGroups = new Set();
let hiddenIds = new Set();
let lockedIds = new Set();
let parentById = Object.create(null);
let childIdsById = Object.create(null);
let typeById = Object.create(null);
let sidebarCommitTimers = Object.create(null);

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
    if (svg) svg.style.overflow = "visible";
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

function renderTree() {
  tree.innerHTML = "<div class='section'><span class='label'>Elements</span></div>";
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
    tree.appendChild(row);
  }
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
    ? "<div class='row'><label>Fill<input id='propFill' type='text' placeholder='#22c55e or color' " + lockDisabled + "></label><label>Stroke<input id='propStroke' type='text' placeholder='#0f172a or color' " + lockDisabled + "></label></div>" +
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
  inspector.innerHTML =
    "<div class='section'><span class='label'>Selected</span><strong>" + escapeText(element.id || "") + "</strong><div class='muted'>" + escapeText(element.type) + (hidden ? " | hidden" : "") + (locked ? " | locked" : "") + "</div>" + (locked ? "<div class='tiny'>Locked elements and groups cannot be edited from canvas or inspector.</div>" : "") + "<div id='error'></div></div>" +
    "<div class='section'><span class='label'>Properties</span>" +
    "<div class='row'><label>X<input id='propX' type='number' step='1' value='" + valueOr(displayElement.x, 0) + "' " + positionDisabled + "></label><label>Y<input id='propY' type='number' step='1' value='" + valueOr(displayElement.y, 0) + "' " + positionDisabled + "></label></div>" +
    "<div class='row'><label>Rotation<input id='propRotation' type='number' step='1' value='" + valueOr(displayElement.rotation, 0) + "' " + lockDisabled + "></label><label>Scale<input id='propScale' type='number' step='0.05' value='" + valueOr(displayElement.scale, 1) + "' " + lockDisabled + "></label></div>" +
    "<div class='row'><label>Scale X<input id='propScaleX' type='number' step='0.05' value='" + valueOr(displayElement.scaleX, valueOr(displayElement.scale, 1)) + "' " + lockDisabled + "></label><label>Scale Y<input id='propScaleY' type='number' step='0.05' value='" + valueOr(displayElement.scaleY, valueOr(displayElement.scale, 1)) + "' " + lockDisabled + "></label></div>" +
    originRows +
    "<div class='row'><label>Opacity<input id='propOpacity' type='number' min='0' max='1' step='0.05' value='" + valueOr(displayElement.opacity, 1) + "' " + lockDisabled + "></label><div></div></div>" +
    paintRows +
    pathRows +
    textRows +
    paintHint +
    sourceRows +
    effectsRows +
    structuredPaintRows +
    "</div>" +
    "<div class='section'><span class='label'>Keyframe</span><div class='row'><label>Time<input id='kfTime' type='number' step='0.05' value='" + currentTime.toFixed(2) + "'></label><label>Curve<select id='curve'><option value='linear'>linear</option><option value='ease-in'>ease-in</option><option value='ease-out'>ease-out</option><option value='ease-in-out'>ease-in-out</option><option value='hold'>hold</option></select></label></div>" +
    "<p class='tiny'>Changing sidebar values updates keyframes at the current time.</p><p class='tiny'>Drag to move. Use the square to scale and the round handle to rotate.</p></div>";
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
}

function renderEffectsRows(element, disabled) {
  const effects = element.effects || {};
  const shadow = effects.shadow || {};
  return "<div class='section'><span class='label'>Effects</span>" +
    "<div class='row'>" +
    dynamicNumberInput("Blur", "propEffectsBlur", "effects.blur", valueOr(effects.blur, 0), disabled, "0.1") +
    dynamicNumberInput("Bright", "propEffectsBrightness", "effects.brightness", valueOr(effects.brightness, 1), disabled, "0.05") +
    "</div>" +
    "<div class='row'>" +
    dynamicNumberInput("Contrast", "propEffectsContrast", "effects.contrast", valueOr(effects.contrast, 1), disabled, "0.05") +
    dynamicNumberInput("Saturate", "propEffectsSaturate", "effects.saturate", valueOr(effects.saturate, 1), disabled, "0.05") +
    "</div>" +
    "<div class='row'>" +
    dynamicNumberInput("Hue", "propEffectsHue", "effects.hueRotate", valueOr(effects.hueRotate, 0), disabled, "1") +
    dynamicTextInput("Shadow Color", "propShadowColor", "effects.shadow.color", valueOr(shadow.color, "#000000"), disabled) +
    "</div>" +
    "<div class='row'>" +
    dynamicNumberInput("Shadow X", "propShadowDx", "effects.shadow.dx", valueOr(shadow.dx, 0), disabled, "0.5") +
    dynamicNumberInput("Shadow Y", "propShadowDy", "effects.shadow.dy", valueOr(shadow.dy, 0), disabled, "0.5") +
    "</div>" +
    "<div class='row'>" +
    dynamicNumberInput("Shadow Blur", "propShadowBlur", "effects.shadow.blur", valueOr(shadow.blur, 0), disabled, "0.5") +
    dynamicNumberInput("Shadow Opacity", "propShadowOpacity", "effects.shadow.opacity", valueOr(shadow.opacity, 1), disabled, "0.05", "0", "1") +
    "</div></div>";
}

function renderImageSourceRows(element, disabled) {
  const source = element.source || { x: 0, y: 0, width: element.width || 0, height: element.height || 0 };
  return "<div class='section'><span class='label'>Image Source</span>" +
    "<div class='row'>" +
    dynamicNumberInput("Source X", "propSourceX", "source.x", valueOr(source.x, 0), disabled, "1") +
    dynamicNumberInput("Source Y", "propSourceY", "source.y", valueOr(source.y, 0), disabled, "1") +
    "</div>" +
    "<div class='row'>" +
    dynamicNumberInput("Source W", "propSourceWidth", "source.width", valueOr(source.width, element.width || 0), disabled, "1") +
    dynamicNumberInput("Source H", "propSourceHeight", "source.height", valueOr(source.height, element.height || 0), disabled, "1") +
    "</div></div>";
}

function renderStructuredPaintRows(element, root, disabled) {
  const paint = element[root];
  if (!paint || typeof paint !== "object") return "";
  let html = "<div class='section'><span class='label'>" + root + " paint</span>";
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
      dynamicTextInput("Color " + index, "prop" + cap(root) + "Stop" + index + "Color", root + ".stops." + index + ".color", valueOr(color, "#000000"), disabled) +
      "</div>";
  }
  return html + "</div>";
}

function dynamicNumberInput(label, id, property, value, disabled, step, min, max) {
  return "<label>" + escapeText(label) + "<input id='" + id + "' type='number' data-kf-property='" + property + "' data-kf-kind='number' step='" + (step || "1") + "' " + (min === undefined ? "" : "min='" + min + "' ") + (max === undefined ? "" : "max='" + max + "' ") + "value='" + escapeAttr(value) + "' " + disabled + "></label>";
}

function dynamicTextInput(label, id, property, value, disabled) {
  return "<label>" + escapeText(label) + "<input id='" + id + "' type='text' data-kf-property='" + property + "' data-kf-kind='text' value='" + escapeAttr(value) + "' " + disabled + "></label>";
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
  document.getElementById("scrub").oninput = (event) => {
    setCurrentTime(event.target.value);
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
      chip.title = "Jump to this keyframe time";
      chip.style.cursor = "pointer";
      const remove = document.createElement("button");
      remove.textContent = "x";
      remove.onclick = () => removeKeyframe(property, time);
      chip.onclick = (event) => {
        if (event.target === remove) return;
        setCurrentTime(time);
      };
      chip.appendChild(remove);
      box.appendChild(chip);
    }
    timeline.appendChild(box);
  }
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
      const curve = document.getElementById("curve");
      await mutate(
        "/api/keyframe",
        { id: selectedId, property, value, time: currentTime, curvePreset: curve ? curve.value : "linear" },
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
  rebuildElementIndex();
  if (selectedId && !findElement(selectedId)) selectedId = "";
  if (refreshTree) renderTree();
  if (refreshInspector) renderInspector();
  if (refreshTimeline) renderTimeline();
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
  if (event.key !== "Escape") return;
  drag = null;
  suppressClick = false;
  deselect();
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
  const curve = document.getElementById("curve");
  await mutate("/api/keyframe", { id: element.id, property, value, time: currentTime, curvePreset: curve ? curve.value : "linear" });
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
