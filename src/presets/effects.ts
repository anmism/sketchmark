import type { Point2 } from "../types";
import type { Box, MotionPresetOptions, PresetFragment } from "./types";
import { constantTrack, curves, roundedRectPath, timelineFragment, track } from "./helpers";

export interface TargetEffectOptions {
  id: string;
  start?: number;
}

export interface ShadowOptions extends TargetEffectOptions {
  dx?: number;
  dy?: number;
  blur?: number;
  color?: string;
  opacity?: number;
}

export interface AnimatedEffectOptions extends TargetEffectOptions, MotionPresetOptions {}

export interface RoundedImageClipOptions extends TargetEffectOptions, Box {
  radius?: number;
  radii?: Array<[number, number]>;
}

export interface MaskRevealOptions extends TargetEffectOptions, Box, MotionPresetOptions {
  direction?: "left" | "right" | "up" | "down";
}

export function dropShadow(options: ShadowOptions): PresetFragment {
  const time = options.start ?? 0;
  return timelineFragment(options.id, {
    "effects.shadow.dx": constantTrack(options.dx ?? 0, time),
    "effects.shadow.dy": constantTrack(options.dy ?? 8, time),
    "effects.shadow.blur": constantTrack(options.blur ?? 18, time),
    "effects.shadow.color": constantTrack(options.color ?? "#000000", time),
    "effects.shadow.opacity": constantTrack(options.opacity ?? 0.22, time)
  });
}

export function softBlur(options: TargetEffectOptions & { amount?: number }): PresetFragment {
  return timelineFragment(options.id, { "effects.blur": constantTrack(options.amount ?? 6, options.start ?? 0) });
}

export function glow(options: ShadowOptions): PresetFragment {
  return dropShadow({ ...options, dx: options.dx ?? 0, dy: options.dy ?? 0, blur: options.blur ?? 24, color: options.color ?? "#38bdf8", opacity: options.opacity ?? 0.55 });
}

export function dim(options: AnimatedEffectOptions & { opacity?: number }): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.25;
  return timelineFragment(options.id, { opacity: track([[start, 1], [start + duration, options.opacity ?? 0.35]], options.curve ?? curves.easeOut) });
}

export function tintFill(options: TargetEffectOptions & { color?: string }): PresetFragment {
  return timelineFragment(options.id, { fill: constantTrack(options.color ?? "#dbeafe", options.start ?? 0) });
}

export function gradientSweep(options: AnimatedEffectOptions & { from?: Point2; to?: Point2; colors?: [string, string] }): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 1;
  const from = options.from ?? [0, 0];
  const to = options.to ?? [180, 0];
  const colors = options.colors ?? ["#38bdf8", "#8b5cf6"];
  return timelineFragment(options.id, {
    fill: track(
      [
        [start, { type: "linearGradient", from, to, stops: [[0, colors[0]], [1, colors[1]]] }],
        [start + duration, { type: "linearGradient", from: [to[0], to[1]], to: [to[0] + (to[0] - from[0]), to[1] + (to[1] - from[1])], stops: [[0, colors[1]], [1, colors[0]]] }]
      ],
      options.curve ?? curves.linear
    )
  });
}

export function roundedImageClip(options: RoundedImageClipOptions): PresetFragment {
  const keyframes = options.radii?.length
    ? options.radii.map(([time, radius]) => ({ time, value: roundedRectPath(options.x, options.y, options.width, options.height, radius) }))
    : [{ time: options.start ?? 0, value: roundedRectPath(options.x, options.y, options.width, options.height, options.radius ?? 12) }];
  return timelineFragment(options.id, { "clip.d": { keyframes } });
}

export function maskReveal(options: MaskRevealOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.7;
  const from = revealPath(options, 0);
  const to = revealPath(options, 1);
  return timelineFragment(options.id, {
    "mask.d": {
      keyframes: [
        { time: start, value: from, out: options.curve ?? curves.easeOut },
        { time: start + duration, value: to }
      ]
    },
    "mask.opacity": track([[start, 1], [start + duration, 1]], curves.linear)
  });
}

function revealPath(options: MaskRevealOptions, progress: number): string {
  const direction = options.direction ?? "right";
  if (direction === "right") return roundedRectPath(options.x, options.y, options.width * progress, options.height, 0);
  if (direction === "left") return roundedRectPath(options.x + options.width * (1 - progress), options.y, options.width * progress, options.height, 0);
  if (direction === "down") return roundedRectPath(options.x, options.y, options.width, options.height * progress, 0);
  return roundedRectPath(options.x, options.y + options.height * (1 - progress), options.width, options.height * progress, 0);
}
