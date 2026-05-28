import type { ClipShape, ImageElement, MotionValue, TimelineCurve, TimelineKeyframe, TimelineTrack, VisualDocument, VisualElement } from "./types";
import { applyPropertyValue } from "./animatable";
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

export function setElementProperty(document: VisualDocument, id: string, property: string, value: MotionValue): VisualDocument {
  const next = clone(document);
  const element = requireElement(next, id);
  applyProperty(element, property, value);
  assertValid(next);
  return next;
}

export function setTimelineKeyframe(document: VisualDocument, id: string, property: string, time: number, value: MotionValue, options: SetKeyframeOptions = {}): VisualDocument {
  if (!isFiniteNumber(time) || time < 0) throw new Error("Keyframe time must be a non-negative finite number.");
  const next = clone(document);
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
  return {
    ...existing,
    ...next,
    in: next.in ?? existing.in,
    out: next.out ?? existing.out,
    interpolation: next.interpolation ?? existing.interpolation
  };
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

function finiteOrZero(value: number): number {
  return isFiniteNumber(value) ? value : 0;
}
