import type { MotionValue, Paint, Point2, TimelineCurve, TimelineKeyframe, TimelineTrack, VisualElement } from "../types";
import type { PresetFragment, StylePresetOptions } from "./types";

export const curves = {
  linear: { type: "graph", points: [[0, 0], [1, 1]] } as TimelineCurve,
  easeIn: { type: "cubicBezier", x1: 0.42, y1: 0, x2: 1, y2: 1 } as TimelineCurve,
  easeOut: { type: "cubicBezier", x1: 0, y1: 0, x2: 0.58, y2: 1 } as TimelineCurve,
  easeInOut: { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 } as TimelineCurve,
  hold: { type: "hold" } as TimelineCurve
};

export function fragment(elements: VisualElement[] = []): PresetFragment {
  return { elements };
}

export function timelineFragment(targetId: string, tracks: Record<string, TimelineTrack>): PresetFragment {
  return { timelines: { [targetId]: tracks } };
}

export function mergeFragments(...fragments: PresetFragment[]): PresetFragment {
  const elements = fragments.flatMap((item) => item.elements ?? []);
  const timelines: PresetFragment["timelines"] = {};
  for (const item of fragments) {
    for (const [id, tracks] of Object.entries(item.timelines ?? {})) {
      timelines[id] ??= {};
      for (const [property, track] of Object.entries(tracks)) {
        timelines[id]![property] = mergeTrack(timelines[id]![property], track);
      }
    }
  }
  return {
    ...(elements.length ? { elements } : {}),
    ...(Object.keys(timelines).length ? { timelines } : {})
  };
}

export function track(values: Array<[number, MotionValue]>, curve: TimelineCurve = curves.linear): TimelineTrack {
  return {
    keyframes: values.map(([time, value], index) => ({
      time,
      value,
      ...(index < values.length - 1 ? { out: curve } : {})
    }))
  };
}

export function constantTrack(value: MotionValue, time = 0): TimelineTrack {
  return { keyframes: [{ time, value }] };
}

export function pathStyle(options: StylePresetOptions = {}): { fill?: Paint; stroke?: Paint; strokeWidth?: number; opacity?: number } {
  return {
    ...(options.fill !== undefined ? { fill: options.fill } : {}),
    ...(options.stroke !== undefined ? { stroke: options.stroke } : {}),
    ...(options.strokeWidth !== undefined ? { strokeWidth: options.strokeWidth } : {}),
    ...(options.opacity !== undefined ? { opacity: options.opacity } : {})
  };
}

export function rectPath(x: number, y: number, width: number, height: number): string {
  return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
}

export function roundedRectPath(x: number, y: number, width: number, height: number, radius = 0): string {
  const r = Math.min(Math.max(0, radius), Math.max(0, width) / 2, Math.max(0, height) / 2);
  if (r <= 0) return rectPath(x, y, width, height);
  return [
    `M ${x + r} ${y}`,
    `H ${x + width - r}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `Q ${x + width} ${y + height} ${x + width - r} ${y + height}`,
    `H ${x + r}`,
    `Q ${x} ${y + height} ${x} ${y + height - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z"
  ].join(" ");
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

export function polygonPath(points: Point2[], close = true): string {
  if (!points.length) return "";
  const commands = [`M ${points[0]![0]} ${points[0]![1]}`];
  for (const point of points.slice(1)) commands.push(`L ${point[0]} ${point[1]}`);
  if (close) commands.push("Z");
  return commands.join(" ");
}

export function regularPoints(cx: number, cy: number, radius: number, sides: number, rotation = -90): Point2[] {
  const count = Math.max(3, Math.floor(sides));
  const start = (rotation * Math.PI) / 180;
  return Array.from({ length: count }, (_, index) => {
    const angle = start + (index / count) * Math.PI * 2;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

export function starPoints(cx: number, cy: number, outerRadius: number, innerRadius: number, points: number, rotation = -90): Point2[] {
  const count = Math.max(2, Math.floor(points)) * 2;
  const start = (rotation * Math.PI) / 180;
  return Array.from({ length: count }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = start + (index / count) * Math.PI * 2;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

export function linePath(from: Point2, to: Point2): string {
  return `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`;
}

export function withPaint(fill: Paint | undefined, fallback: Paint): Paint {
  return fill === undefined ? fallback : fill;
}

export function keyframeTime(frame: TimelineKeyframe): number {
  return Array.isArray(frame) ? frame[0] : frame.time;
}

export function mergeTrack(left: TimelineTrack | undefined, right: TimelineTrack): TimelineTrack {
  if (!left) return cloneTrack(right);
  const frames = left.keyframes.map(cloneKeyframe);
  for (const frame of right.keyframes) {
    const next = cloneKeyframe(frame);
    const existing = frames.findIndex((item) => keyframeTime(item) === keyframeTime(next));
    if (existing >= 0) frames[existing] = next;
    else frames.push(next);
  }
  frames.sort((a, b) => keyframeTime(a) - keyframeTime(b));
  return {
    keyframes: frames,
    ...(right.curve ?? left.curve ? { curve: right.curve ?? left.curve } : {}),
    ...(right.ease ?? left.ease ? { ease: right.ease ?? left.ease } : {})
  };
}

export function cloneTrack(trackValue: TimelineTrack): TimelineTrack {
  return {
    keyframes: trackValue.keyframes.map(cloneKeyframe),
    ...(trackValue.curve ? { curve: cloneValue(trackValue.curve) as TimelineCurve } : {}),
    ...(trackValue.ease ? { ease: trackValue.ease } : {})
  };
}

export function cloneElement<T extends VisualElement>(element: T): T {
  return cloneValue(element) as T;
}

export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneKeyframe(frame: TimelineKeyframe): TimelineKeyframe {
  return cloneValue(frame);
}
