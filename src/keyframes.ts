import type { MotionValue, Point2, TimelineCurve, TimelineTrack, VisualDocument, VisualElement } from "./types";
import { clone, flattenElements, isFiniteNumber, isPoint2 } from "./utils";
import { validateVisualDocument } from "./validate";

export type TimelineCurvePresetName = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "hold";
export type KeyframeOffsetMap = Record<string, number | Record<string, number>>;
export interface KeyframePropertySpec {
  value: MotionValue;
  curve?: TimelineCurve;
  ease?: TimelineCurvePresetName | string;
  offset?: number;
  in?: TimelineCurve;
  out?: TimelineCurve;
  interpolation?: TimelineCurve;
}
export type KeyframePropertyState = MotionValue | KeyframePropertySpec;

export interface KeyframeElementState {
  position?: Point2 | KeyframePropertySpec;
  x?: number | KeyframePropertySpec;
  y?: number | KeyframePropertySpec;
  rotation?: KeyframePropertyState;
  scale?: KeyframePropertyState;
  scaleX?: KeyframePropertyState;
  scaleY?: KeyframePropertyState;
  opacity?: KeyframePropertyState;
  fill?: KeyframePropertyState;
  stroke?: KeyframePropertyState;
  strokeWidth?: KeyframePropertyState;
  drawStart?: KeyframePropertyState;
  drawEnd?: KeyframePropertyState;
  dashOffset?: KeyframePropertyState;
  [property: string]: KeyframePropertyState | undefined;
}

export interface KeyframeState {
  time: number;
  set?: Record<string, KeyframeElementState>;
  elements?: Record<string, KeyframeElementState>;
  curve?: TimelineCurve;
  ease?: string;
  offsets?: KeyframeOffsetMap;
}

export interface CompileKeyframeStateOptions {
  validate?: boolean;
  includeBaseFrame?: boolean;
  baseTime?: number;
  defaultCurve?: TimelineCurve;
  defaultEase?: string;
  offsets?: KeyframeOffsetMap;
}

export function timelineCurvePreset(name: TimelineCurvePresetName | string): TimelineCurve | undefined {
  switch (name) {
    case "linear":
      return { type: "graph", points: [[0, 0], [1, 1]] };
    case "ease-in":
      return { type: "cubicBezier", x1: 0.42, y1: 0, x2: 1, y2: 1 };
    case "ease-out":
      return { type: "cubicBezier", x1: 0, y1: 0, x2: 0.58, y2: 1 };
    case "ease-in-out":
      return { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
    case "hold":
      return { type: "hold" };
    default:
      return undefined;
  }
}

export function compileKeyframeStates(document: VisualDocument, states: KeyframeState[], options: CompileKeyframeStateOptions = {}): VisualDocument {
  if (options.validate !== false) {
    const result = validateVisualDocument(document);
    if (!result.ok) {
      const first = result.issues[0];
      throw new Error(first ? `${first.path}: ${first.message}` : "Invalid visual document.");
    }
  }
  const next = clone(document);
  const elements = flattenElements(next.elements ?? []);
  const byId = new Map(elements.filter((element) => element.id).map((element) => [element.id as string, element]));
  const sorted = states.slice().sort((left, right) => left.time - right.time);
  for (const state of sorted) {
    if (!isFiniteNumber(state.time) || state.time < 0) throw new Error("Keyframe state time must be a non-negative finite number.");
    const set = state.set ?? state.elements ?? {};
    for (const [id, values] of Object.entries(set)) {
      const element = byId.get(id);
      if (!element) throw new Error(`Cannot keyframe unknown element '${id}'.`);
      for (const entry of normalizedStateEntries(element, values)) {
        const offset = timingOffset(options.offsets, state.offsets, id, entry.property, entry.offset);
        const time = state.time + offset;
        if (!isFiniteNumber(time) || time < 0) throw new Error(`Keyframe time for '${id}.${entry.property}' must be a non-negative finite number after offsets.`);
        const ease = entry.ease ?? state.ease ?? options.defaultEase;
        const out = entry.out ?? entry.curve ?? state.curve ?? options.defaultCurve ?? timelineCurvePreset(ease ?? "");
        addTrackKeyframe(element, entry.property, entry.value, time, {
          in: entry.in,
          out,
          interpolation: entry.interpolation,
          ease: out || entry.in || entry.interpolation ? undefined : ease,
          includeBaseFrame: options.includeBaseFrame !== false,
          baseTime: options.baseTime ?? 0
        });
      }
    }
  }
  sortTimelineTracks(next.elements ?? []);
  return next;
}

interface NormalizedStateEntry {
  property: string;
  value: MotionValue;
  curve?: TimelineCurve;
  ease?: string;
  offset?: number;
  in?: TimelineCurve;
  out?: TimelineCurve;
  interpolation?: TimelineCurve;
}

function normalizedStateEntries(element: VisualElement, state: KeyframeElementState): NormalizedStateEntry[] {
  const entries: NormalizedStateEntry[] = [];
  const position = state.position;
  const hasX = state.x !== undefined;
  const hasY = state.y !== undefined;
  if (position !== undefined) {
    const parsed = parsePropertyState(element, "position", position);
    if (!isPoint2(parsed.value)) throw new Error(`Element '${element.id ?? "(unnamed)"}' position keyframe must be [x,y].`);
    entries.push({ property: "position", ...parsed });
  } else if (hasX && hasY && isFiniteNumber(state.x) && isFiniteNumber(state.y)) {
    entries.push({ property: "position", value: [state.x, state.y] });
  } else {
    if (hasX && state.x !== undefined) entries.push({ property: "x", ...parsePropertyState(element, "x", state.x) });
    if (hasY && state.y !== undefined) entries.push({ property: "y", ...parsePropertyState(element, "y", state.y) });
  }
  for (const [property, value] of Object.entries(state)) {
    if (property === "position" || property === "x" || property === "y" || value === undefined) continue;
    entries.push({ property, ...parsePropertyState(element, property, value) });
  }
  return entries;
}

function parsePropertyState(element: VisualElement, property: string, state: KeyframePropertyState): Omit<NormalizedStateEntry, "property"> {
  if (isPropertySpec(state)) {
    if (!isMotionValue(state.value)) throw new Error(`Element '${element.id ?? "(unnamed)"}' property '${property}' must be a number, string, or [x,y].`);
    return {
      value: clone(state.value),
      ...(state.curve ? { curve: clone(state.curve) } : {}),
      ...(state.ease ? { ease: state.ease } : {}),
      ...(state.offset !== undefined ? { offset: state.offset } : {}),
      ...(state.in ? { in: clone(state.in) } : {}),
      ...(state.out ? { out: clone(state.out) } : {}),
      ...(state.interpolation ? { interpolation: clone(state.interpolation) } : {})
    };
  }
  if (!isMotionValue(state)) throw new Error(`Element '${element.id ?? "(unnamed)"}' property '${property}' must be a number, string, or [x,y].`);
  return { value: clone(state) };
}

function addTrackKeyframe(
  element: VisualElement,
  property: string,
  value: MotionValue,
  time: number,
  options: { in?: TimelineCurve; out?: TimelineCurve; interpolation?: TimelineCurve; ease?: string; includeBaseFrame: boolean; baseTime: number }
): void {
  element.timeline ??= {};
  element.timeline.tracks ??= {};
  const tracks = element.timeline.tracks;
  const track = (tracks[property] ??= { keyframes: [] }) as TimelineTrack;
  if (options.ease && !track.ease) track.ease = options.ease;
  if (options.includeBaseFrame && time !== options.baseTime && !track.keyframes.some((frame) => keyframeTime(frame) === options.baseTime)) {
    const base = baseValue(element, property);
    if (base !== undefined) track.keyframes.push(makeKeyframe(options.baseTime, base, { out: options.out ?? options.interpolation }));
  }
  const next = makeKeyframe(time, value, { in: options.in, out: options.out, interpolation: options.interpolation });
  const existingIndex = track.keyframes.findIndex((frame) => keyframeTime(frame) === time);
  if (existingIndex >= 0) track.keyframes[existingIndex] = mergeKeyframe(track.keyframes[existingIndex]!, next);
  else track.keyframes.push(next);
}

function baseValue(element: VisualElement, property: string): MotionValue | undefined {
  if (property === "position" && canUsePosition(element)) return [Number(element.x ?? 0), Number(element.y ?? 0)];
  const value = (element as unknown as Record<string, unknown>)[property];
  if (isMotionValue(value)) return clone(value);
  if (property === "opacity" || property === "scale" || property === "scaleX" || property === "scaleY") return 1;
  if (property === "rotation" || property === "drawStart" || property === "dashOffset") return 0;
  if (property === "drawEnd") return 1;
  return undefined;
}

function sortTimelineTracks(elements: VisualElement[]): void {
  for (const element of elements) {
    for (const track of Object.values(element.timeline?.tracks ?? {})) {
      track.keyframes.sort((left, right) => keyframeTime(left) - keyframeTime(right));
    }
    if (element.type === "group") sortTimelineTracks(element.children);
  }
}

function makeKeyframe(time: number, value: MotionValue, options: { in?: TimelineCurve; out?: TimelineCurve; interpolation?: TimelineCurve } = {}) {
  return {
    time,
    value: clone(value),
    ...(options.in ? { in: clone(options.in) } : {}),
    ...(options.out ? { out: clone(options.out) } : {}),
    ...(options.interpolation ? { interpolation: clone(options.interpolation) } : {})
  };
}

function mergeKeyframe(existing: TimelineTrack["keyframes"][number], next: ReturnType<typeof makeKeyframe>): ReturnType<typeof makeKeyframe> {
  if (Array.isArray(existing)) return next;
  return {
    ...existing,
    ...next,
    in: next.in ?? existing.in,
    out: next.out ?? existing.out,
    interpolation: next.interpolation ?? existing.interpolation
  };
}

function keyframeTime(frame: TimelineTrack["keyframes"][number]): number {
  return Array.isArray(frame) ? frame[0] : frame.time;
}

function timingOffset(global: KeyframeOffsetMap | undefined, local: KeyframeOffsetMap | undefined, id: string, property: string, own: number | undefined): number {
  const value = offsetFromMap(global, id, property) + offsetFromMap(local, id, property) + Number(own ?? 0);
  if (!isFiniteNumber(value)) throw new Error(`Keyframe offset for '${id}.${property}' must be finite.`);
  return value;
}

function offsetFromMap(map: KeyframeOffsetMap | undefined, id: string, property: string): number {
  const entry = map?.[id];
  if (entry === undefined) return 0;
  if (isFiniteNumber(entry)) return entry;
  const value = entry[property];
  return isFiniteNumber(value) ? value : 0;
}

function canUsePosition(element: VisualElement): element is VisualElement & { x?: number; y?: number } {
  return element.type === "path" || element.type === "point" || element.type === "text" || element.type === "image" || element.type === "group";
}

function isMotionValue(value: unknown): value is MotionValue {
  return isFiniteNumber(value) || typeof value === "string" || isPoint2(value);
}

function isPropertySpec(value: unknown): value is KeyframePropertySpec {
  return !!value && typeof value === "object" && !Array.isArray(value) && "value" in value;
}
