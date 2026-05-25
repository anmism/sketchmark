import type { MotionValue, Point2, ResolvedVisualDocument, TimelineCurve, TimelineKeyframe, TimelineTrack, VisualDocument, VisualElement } from "./types";
import { clamp, clone, easing, isFiniteNumber, isPoint2 } from "./utils";
import { validateVisualDocument } from "./validate";

export interface NormalizeOptions {
  validate?: boolean;
}

export function normalizeVisualDocument(document: VisualDocument, options: NormalizeOptions = {}): ResolvedVisualDocument {
  if (options.validate !== false) {
    const result = validateVisualDocument(document);
    if (!result.ok) {
      const first = result.issues[0];
      throw new Error(first ? `${first.path}: ${first.message}` : "Invalid visual document.");
    }
  }
  return { ...clone(document), elements: clone(document.elements ?? []) };
}

export function resolveVisualFrame(document: VisualDocument, time = 0): ResolvedVisualDocument {
  const normalized = normalizeVisualDocument(document);
  return {
    ...normalized,
    elements: resolveElements(normalized.elements, time)
  };
}

function resolveElements(elements: VisualElement[], time: number): VisualElement[] {
  return elements.flatMap((element) => {
    const timeline = element.timeline;
    if (timeline?.start !== undefined && time < timeline.start) return [];
    if (timeline?.end !== undefined && time > timeline.end) return [];

    const next = clone(element) as VisualElement;
    if (next.type === "group") next.children = resolveElements(next.children, time);

    const localTime = time - Number(timeline?.start ?? 0);
    for (const [property, track] of Object.entries(timeline?.tracks ?? {})) {
      const value = resolveTrack(track, localTime);
      if (value !== undefined) applyTrackValue(next, property, value);
    }
    delete next.timeline;
    return [next];
  });
}

function resolveTrack(track: TimelineTrack, time: number): MotionValue | undefined {
  const frames = track.keyframes
    .map(normalizeKeyframe)
    .filter((frame): frame is ResolvedKeyframe => frame !== undefined)
    .slice()
    .sort((left, right) => left.time - right.time);
  if (!frames.length) return undefined;
  if (time <= frames[0]!.time) return clone(frames[0]!.value);
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]!;
    const next = frames[index]!;
    if (time <= next.time) {
      const span = Math.max(0.000001, next.time - previous.time);
      const curve = previous.out ?? previous.interpolation ?? next.in ?? track.curve;
      return interpolateValue(previous.value, next.value, curveProgress(curve, track.ease, (time - previous.time) / span));
    }
  }
  return clone(frames[frames.length - 1]!.value);
}

interface ResolvedKeyframe {
  time: number;
  value: MotionValue;
  in?: TimelineCurve;
  out?: TimelineCurve;
  interpolation?: TimelineCurve;
}

function normalizeKeyframe(frame: TimelineKeyframe): ResolvedKeyframe | undefined {
  if (Array.isArray(frame)) {
    if (!isFiniteNumber(frame[0]) || !isMotionValue(frame[1])) return undefined;
    return { time: frame[0], value: clone(frame[1]) };
  }
  if (!frame || typeof frame !== "object" || !isFiniteNumber(frame.time) || !isMotionValue(frame.value)) return undefined;
  return {
    time: frame.time,
    value: clone(frame.value),
    ...(frame.in ? { in: clone(frame.in) } : {}),
    ...(frame.out ? { out: clone(frame.out) } : {}),
    ...(frame.interpolation ? { interpolation: clone(frame.interpolation) } : {})
  };
}

function curveProgress(curve: TimelineCurve | undefined, easeName: string | undefined, t: number): number {
  if (!curve) return easing(easeName, t);
  const x = clamp(t, 0, 1);
  if (curve.type === "hold") return x < 1 ? 0 : 1;
  if (curve.type === "graph") return graphProgress(curve.points, x);
  if (curve.type === "cubicBezier") return cubicBezierProgress(x, curve.x1, curve.y1, curve.x2, curve.y2);
  return easing(easeName, t);
}

function graphProgress(points: Point2[], t: number): number {
  const sorted = points.slice().sort((left, right) => left[0] - right[0]);
  if (!sorted.length) return t;
  if (t <= sorted[0]![0]) return sorted[0]![1];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const next = sorted[index]!;
    if (t <= next[0]) {
      const span = Math.max(0.000001, next[0] - previous[0]);
      const local = (t - previous[0]) / span;
      return previous[1] + (next[1] - previous[1]) * local;
    }
  }
  return sorted[sorted.length - 1]![1];
}

function cubicBezierProgress(t: number, x1: number, y1: number, x2: number, y2: number): number {
  let lo = 0;
  let hi = 1;
  let u = t;
  for (let index = 0; index < 24; index += 1) {
    u = (lo + hi) / 2;
    const x = cubicBezier(0, x1, x2, 1, u);
    if (x < t) lo = u;
    else hi = u;
  }
  return cubicBezier(0, y1, y2, 1, u);
}

function cubicBezier(a: number, b: number, c: number, d: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

function interpolateValue(from: MotionValue, to: MotionValue, t: number): MotionValue {
  if (typeof from === "number" && typeof to === "number") return from + (to - from) * t;
  if (isPoint2(from) && isPoint2(to)) return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  if (typeof from === "string" && typeof to === "string") {
    const a = parseHexColor(from);
    const b = parseHexColor(to);
    if (a && b) {
      return `#${hex(Math.round(a[0] + (b[0] - a[0]) * t))}${hex(Math.round(a[1] + (b[1] - a[1]) * t))}${hex(Math.round(a[2] + (b[2] - a[2]) * t))}`;
    }
  }
  return t < 1 ? clone(from) : clone(to);
}

function applyTrackValue(element: VisualElement, property: string, value: MotionValue): void {
  const record = element as unknown as Record<string, unknown>;
  if (property === "position" && isPoint2(value)) {
    if (element.type === "path" || element.type === "point" || element.type === "text" || element.type === "image" || element.type === "group") {
      record.x = value[0];
      record.y = value[1];
    }
    return;
  }
  record[property] = clone(value);
}

function isMotionValue(value: unknown): value is MotionValue {
  return isFiniteNumber(value) || typeof value === "string" || isPoint2(value);
}

function parseHexColor(value: string): [number, number, number] | undefined {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value.trim());
  if (short) {
    return [parseInt(short[1]! + short[1]!, 16), parseInt(short[2]! + short[2]!, 16), parseInt(short[3]! + short[3]!, 16)];
  }
  const long = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!long) return undefined;
  return [parseInt(long[1]!.slice(0, 2), 16), parseInt(long[1]!.slice(2, 4), 16), parseInt(long[1]!.slice(4, 6), 16)];
}

function hex(value: number): string {
  return value.toString(16).padStart(2, "0");
}
