import type { ClipShape, GroupElement, ImageElement, MotionValue, Point2, TimelineCurve, TimelineKeyframe, TimelineTrack, VisualDocument, VisualElement } from "./types";
import { applyPropertyValue } from "./animatable";
import { timelineCurvePreset } from "./keyframes";
import { clone, isFiniteNumber } from "./utils";
import { validateVisualDocument } from "./validate";

export interface ElementReference {
  id: string;
  type: string;
  depth: number;
  path: number[];
}

export interface SetKeyframeOptions {
  in?: TimelineCurve;
  out?: TimelineCurve;
  interpolation?: TimelineCurve;
  curve?: TimelineCurve;
  ease?: string;
}

export type ElementPresetKind = "text" | "rectangle" | "circle" | "line" | "path" | "point" | "group";

export interface InsertElementPresetOptions {
  id?: string;
  parentId?: string | null;
  index?: number;
}

export interface InsertElementPresetResult {
  document: VisualDocument;
  element: VisualElement;
  parentId?: string;
}

export type ReorderElementDirection = "backward" | "forward" | "back" | "front";

export interface ReorderElementOptions {
  direction?: ReorderElementDirection | string;
  toIndex?: number;
}

export interface ReorderElementResult {
  document: VisualDocument;
  id: string;
  index: number;
  previousIndex: number;
  parentId?: string;
}

export interface DeleteElementResult {
  document: VisualDocument;
  element: VisualElement;
  id: string;
  index: number;
  parentId?: string;
}

export function listElementReferences(document: VisualDocument): ElementReference[] {
  const out: ElementReference[] = [];
  visitElements(document.elements ?? [], (element, path, depth) => {
    if (element.id) out.push({ id: element.id, type: element.type, depth, path });
  });
  return out;
}

export function findElementById(document: VisualDocument, id: string): VisualElement | undefined {
  let found: VisualElement | undefined;
  visitElements(document.elements ?? [], (element) => {
    if (!found && element.id === id) found = element;
  });
  return found;
}

export function insertElementPreset(document: VisualDocument, preset: ElementPresetKind | string, options: InsertElementPresetOptions = {}): InsertElementPresetResult {
  const next = clone(document);
  repairLegacyTimelineCurves(next);
  next.elements ??= [];
  const parentId = typeof options.parentId === "string" && options.parentId ? options.parentId : "";
  const parent = parentId ? requireElement(next, parentId) : undefined;
  if (parent && parent.type !== "group") throw new Error(`Element '${parentId}' is not a group.`);
  const id = uniqueElementId(next, options.id || presetBaseId(preset));
  const element = createPresetElement(preset, id, insertionPoint(next, parent));
  const target = parent ? (parent as GroupElement).children : next.elements;
  insertAt(target, element, options.index);
  assertValid(next);
  return { document: next, element: clone(element), ...(parentId ? { parentId } : {}) };
}

export function reorderElement(document: VisualDocument, id: string, options: ReorderElementOptions = {}): ReorderElementResult {
  if (!id) throw new Error("id must be a non-empty string.");
  const next = clone(document);
  repairLegacyTimelineCurves(next);
  next.elements ??= [];
  const slot = findElementSlot(next.elements, id);
  if (!slot) throw new Error(`Unknown element '${id}'.`);
  const previousIndex = slot.index;
  const nextIndex = layerTargetIndex(slot.index, slot.elements.length, options);
  if (nextIndex !== slot.index) {
    const [element] = slot.elements.splice(slot.index, 1);
    if (element) slot.elements.splice(nextIndex, 0, element);
  }
  assertValid(next);
  return {
    document: next,
    id,
    previousIndex,
    index: nextIndex,
    ...(slot.parentId ? { parentId: slot.parentId } : {})
  };
}

export function deleteElement(document: VisualDocument, id: string): DeleteElementResult {
  if (!id) throw new Error("id must be a non-empty string.");
  const next = clone(document);
  repairLegacyTimelineCurves(next);
  next.elements ??= [];
  const slot = findElementSlot(next.elements, id);
  if (!slot) throw new Error(`Unknown element '${id}'.`);
  const [element] = slot.elements.splice(slot.index, 1);
  if (!element) throw new Error(`Unknown element '${id}'.`);
  assertValid(next);
  return {
    document: next,
    element: clone(element),
    id,
    index: slot.index,
    ...(slot.parentId ? { parentId: slot.parentId } : {})
  };
}

export function setElementProperty(document: VisualDocument, id: string, property: string, value: MotionValue): VisualDocument {
  const next = clone(document);
  repairLegacyTimelineCurves(next);
  const element = requireElement(next, id);
  applyProperty(element, property, value);
  assertValid(next);
  return next;
}

export function setTimelineKeyframe(document: VisualDocument, id: string, property: string, time: number, value: MotionValue, options: SetKeyframeOptions = {}): VisualDocument {
  if (!isFiniteNumber(time) || time < 0) throw new Error("Keyframe time must be a non-negative finite number.");
  const next = clone(document);
  repairLegacyTimelineCurves(next);
  const element = requireElement(next, id);
  element.timeline ??= {};
  element.timeline.tracks ??= {};
  const track = (element.timeline.tracks[property] ??= { keyframes: [] }) as TimelineTrack;
  if (options.ease && !track.ease) track.ease = options.ease;
  if (options.curve && !track.curve) track.curve = clone(options.curve);
  const frame = makeKeyframe(time, value, options);
  const existing = track.keyframes.findIndex((item) => keyframeTime(item) === time);
  if (existing >= 0) track.keyframes[existing] = mergeKeyframe(track.keyframes[existing]!, frame);
  else track.keyframes.push(frame);
  track.keyframes.sort((left, right) => keyframeTime(left) - keyframeTime(right));
  assertValid(next);
  return next;
}

export function removeTimelineKeyframe(document: VisualDocument, id: string, property: string, time: number): VisualDocument {
  const next = clone(document);
  const element = requireElement(next, id);
  const track = element.timeline?.tracks?.[property];
  if (!track) return next;
  track.keyframes = track.keyframes.filter((frame) => keyframeTime(frame) !== time);
  if (!track.keyframes.length && element.timeline?.tracks) delete element.timeline.tracks[property];
  if (element.timeline?.tracks && !Object.keys(element.timeline.tracks).length) delete element.timeline.tracks;
  if (element.timeline && !element.timeline.start && !element.timeline.end && !element.timeline.tracks) delete element.timeline;
  assertValid(next);
  return next;
}

export function listTimelineTracks(document: VisualDocument, id: string): Array<{ property: string; keyframes: TimelineKeyframe[]; curve?: TimelineCurve; ease?: string }> {
  const element = findElementById(document, id);
  if (!element?.timeline?.tracks) return [];
  return Object.entries(element.timeline.tracks).map(([property, track]) => ({
    property,
    keyframes: clone(track.keyframes),
    ...(track.curve ? { curve: clone(track.curve) } : {}),
    ...(track.ease ? { ease: track.ease } : {})
  }));
}

export function roundedRectClipPath(x: number, y: number, width: number, height: number, radius = 0): string {
  const left = finiteOrZero(x);
  const top = finiteOrZero(y);
  const w = Math.max(0, finiteOrZero(width));
  const h = Math.max(0, finiteOrZero(height));
  const r = Math.min(Math.max(0, finiteOrZero(radius)), w / 2, h / 2);
  const right = left + w;
  const bottom = top + h;
  if (r <= 0) return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`;
  return [
    `M ${left + r} ${top}`,
    `H ${right - r}`,
    `Q ${right} ${top} ${right} ${top + r}`,
    `V ${bottom - r}`,
    `Q ${right} ${bottom} ${right - r} ${bottom}`,
    `H ${left + r}`,
    `Q ${left} ${bottom} ${left} ${bottom - r}`,
    `V ${top + r}`,
    `Q ${left} ${top} ${left + r} ${top}`,
    "Z"
  ].join(" ");
}

export function imageRoundedClip(element: Pick<ImageElement, "x" | "y" | "width" | "height">, radius = 0): ClipShape {
  return { type: "path", d: roundedRectClipPath(element.x, element.y, element.width, element.height, radius) };
}

export {
  deleteElement as remove,
  findElementById as find,
  insertElementPreset as insertPreset,
  listElementReferences as listReferences,
  listTimelineTracks as listTracks,
  removeTimelineKeyframe as removeKeyframe,
  reorderElement as reorder,
  setElementProperty as setProperty,
  setTimelineKeyframe as setKeyframe
};

function visitElements(elements: VisualElement[], visit: (element: VisualElement, path: number[], depth: number) => void, prefix: number[] = [], depth = 0): void {
  for (const [index, element] of elements.entries()) {
    const path = [...prefix, index];
    visit(element, path, depth);
    if (element.type === "group") visitElements(element.children, visit, path, depth + 1);
  }
}

function requireElement(document: VisualDocument, id: string): VisualElement {
  const element = findElementById(document, id);
  if (!element) throw new Error(`Unknown element '${id}'.`);
  return element;
}

function findElementSlot(elements: VisualElement[], id: string, parentId = ""): { elements: VisualElement[]; index: number; parentId: string } | undefined {
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (!element) continue;
    if (element.id === id) return { elements, index, parentId };
    if (element.type === "group") {
      const found = findElementSlot(element.children, id, element.id || parentId);
      if (found) return found;
    }
  }
}

function layerTargetIndex(index: number, length: number, options: ReorderElementOptions): number {
  if (length <= 1) return index;
  if (options.toIndex !== undefined) {
    const nextIndex = Math.round(Number(options.toIndex));
    if (!Number.isFinite(nextIndex)) throw new Error("toIndex must be a finite number.");
    return Math.max(0, Math.min(length - 1, nextIndex));
  }
  switch (options.direction || "forward") {
    case "backward":
      return Math.max(0, index - 1);
    case "forward":
      return Math.min(length - 1, index + 1);
    case "back":
      return 0;
    case "front":
      return length - 1;
    default:
      throw new Error(`Unknown reorder direction '${options.direction}'.`);
  }
}

function createPresetElement(preset: ElementPresetKind | string, id: string, point: Point2): VisualElement {
  const x = Math.round(point[0]);
  const y = Math.round(point[1]);
  switch (preset) {
    case "text":
      return {
        id,
        type: "text",
        x,
        y,
        text: "Text",
        align: "center",
        valign: "middle",
        fontSize: 36,
        weight: 700,
        fill: "#111827"
      };
    case "rectangle":
      return {
        id,
        type: "path",
        x,
        y,
        d: "M -80 -50 H 80 V 50 H -80 Z",
        fill: "#dbeafe",
        stroke: "#2563eb",
        strokeWidth: 3
      };
    case "circle":
      return {
        id,
        type: "path",
        x,
        y,
        d: "M 0 -55 A 55 55 0 1 1 0 55 A 55 55 0 1 1 0 -55 Z",
        fill: "#dcfce7",
        stroke: "#16a34a",
        strokeWidth: 3
      };
    case "line":
      return {
        id,
        type: "path",
        x,
        y,
        d: "M -90 0 H 90",
        fill: "none",
        stroke: "#111827",
        strokeWidth: 5,
        strokeCap: "round"
      };
    case "path":
      return {
        id,
        type: "path",
        x,
        y,
        d: "M -80 40 C -40 -50 40 -50 80 40",
        fill: "none",
        stroke: "#7c3aed",
        strokeWidth: 5,
        strokeCap: "round"
      };
    case "point":
      return { id, type: "point", x, y };
    case "group":
      return {
        id,
        type: "group",
        x: Math.round(x - 100),
        y: Math.round(y - 80),
        width: 200,
        height: 160,
        children: []
      };
    default:
      throw new Error(`Unknown element preset '${preset}'.`);
  }
}

function insertionPoint(document: VisualDocument, parent: VisualElement | undefined): Point2 {
  if (parent && parent.type === "group") {
    return [Math.max(0, Number(parent.width ?? 0)) / 2, Math.max(0, Number(parent.height ?? 0)) / 2];
  }
  return [Math.max(1, Number(document.canvas?.width ?? 1)) / 2, Math.max(1, Number(document.canvas?.height ?? 1)) / 2];
}

function insertAt(elements: VisualElement[], element: VisualElement, index: number | undefined): void {
  if (Number.isInteger(index) && Number(index) >= 0 && Number(index) <= elements.length) elements.splice(Number(index), 0, element);
  else elements.push(element);
}

function uniqueElementId(document: VisualDocument, base: string): string {
  const ids = new Set<string>();
  visitElements(document.elements ?? [], (element) => {
    if (element.id) ids.add(element.id);
  });
  const normalized = presetBaseId(base);
  if (!ids.has(normalized)) return normalized;
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${normalized}_${index}`;
    if (!ids.has(candidate)) return candidate;
  }
  throw new Error(`Could not generate a unique id for '${normalized}'.`);
}

function presetBaseId(value: unknown): string {
  const text = String(value || "element")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/^[^a-z_]+/i, "")
    .replace(/^_+|_+$/g, "");
  return text || "element";
}

function applyProperty(element: VisualElement, property: string, value: MotionValue): void {
  applyPropertyValue(element, property, value);
}

function makeKeyframe(time: number, value: MotionValue, options: SetKeyframeOptions): Extract<TimelineKeyframe, { time: number }> {
  return {
    time,
    value: clone(value),
    ...(options.in ? { in: clone(options.in) } : {}),
    ...(options.out ?? options.curve ? { out: clone(options.out ?? options.curve!) } : {}),
    ...(options.interpolation ? { interpolation: clone(options.interpolation) } : {})
  };
}

function mergeKeyframe(existing: TimelineKeyframe, next: Extract<TimelineKeyframe, { time: number }>): Extract<TimelineKeyframe, { time: number }> {
  if (Array.isArray(existing)) return next;
  const merged: Extract<TimelineKeyframe, { time: number }> = {
    ...existing,
    ...next
  };
  mergeCurveValue(merged, "in", next.in ?? existing.in);
  mergeCurveValue(merged, "out", next.out ?? existing.out);
  mergeCurveValue(merged, "interpolation", next.interpolation ?? existing.interpolation);
  return merged;
}

function mergeCurveValue(frame: Extract<TimelineKeyframe, { time: number }>, key: "in" | "out" | "interpolation", value: TimelineCurve | undefined): void {
  if (value) frame[key] = value;
  else delete frame[key];
}

function keyframeTime(frame: TimelineKeyframe): number {
  return Array.isArray(frame) ? frame[0] : frame.time;
}

function assertValid(document: VisualDocument): void {
  const result = validateVisualDocument(document);
  if (!result.ok) {
    const first = result.issues[0];
    throw new Error(first ? `${first.path}: ${first.message}` : "Invalid visual document.");
  }
}

function repairLegacyTimelineCurves(document: VisualDocument): void {
  visitElements(document.elements ?? [], (element) => {
    for (const track of Object.values(element.timeline?.tracks ?? {})) {
      repairTrackCurve(track);
      for (const frame of track.keyframes ?? []) repairKeyframeCurve(frame);
    }
  });
}

function repairTrackCurve(track: TimelineTrack): void {
  const record = track as unknown as Record<string, unknown>;
  repairCurveField(record, "curve");
}

function repairKeyframeCurve(frame: TimelineKeyframe): void {
  if (Array.isArray(frame)) return;
  const record = frame as unknown as Record<string, unknown>;
  for (const key of ["in", "out", "interpolation"] as const) repairCurveField(record, key);
}

function repairCurveField(record: Record<string, unknown>, key: string): void {
  if (!(key in record)) return;
  const curve = coerceTimelineCurve(record[key]);
  if (curve) record[key] = curve;
  else delete record[key];
}

function coerceTimelineCurve(value: unknown): TimelineCurve | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return legacyCurve(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.type === "hold") return { type: "hold" };
  if (record.type === "cubicBezier") {
    const x1 = finiteNumber(record.x1);
    const y1 = finiteNumber(record.y1);
    const x2 = finiteNumber(record.x2);
    const y2 = finiteNumber(record.y2);
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return undefined;
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return undefined;
    return { type: "cubicBezier", x1, y1, x2, y2 };
  }
  if (record.type === "graph") {
    const points = Array.isArray(record.points)
      ? record.points.map(coerceCurvePoint).filter((point): point is Point2 => Boolean(point))
      : [];
    if (points.length < 2) return undefined;
    let previousX = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      if (point[0] < 0 || point[0] > 1 || point[0] <= previousX) return undefined;
      previousX = point[0];
    }
    if (points[0]?.[0] !== 0 || points[points.length - 1]?.[0] !== 1) return undefined;
    return { type: "graph", points };
  }
  return undefined;
}

function coerceCurvePoint(value: unknown): Point2 | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const x = finiteNumber(value[0]);
  const y = finiteNumber(value[1]);
  return x === undefined || y === undefined ? undefined : [x, y];
}

function finiteNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function legacyCurve(value: string): TimelineCurve | undefined {
  switch (value.trim()) {
    case "ease":
    case "easeInOut":
    case "ease-inout":
    case "easeInout":
      return timelineCurvePreset("ease-in-out");
    case "easeIn":
      return timelineCurvePreset("ease-in");
    case "easeOut":
      return timelineCurvePreset("ease-out");
    default:
      return timelineCurvePreset(value);
  }
}

function finiteOrZero(value: number): number {
  return isFiniteNumber(value) ? value : 0;
}
