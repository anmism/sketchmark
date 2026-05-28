import type { Point2 } from "../types";
import type { MotionPresetOptions, PresetFragment } from "./types";
import { curves, mergeFragments, timelineFragment, track } from "./helpers";

export interface TargetMotionOptions extends MotionPresetOptions {
  id: string;
}

export interface MoveMotionOptions extends TargetMotionOptions {
  from?: Point2;
  to?: Point2;
  distance?: number;
}

export interface PulseOptions extends TargetMotionOptions {
  amount?: number;
}

export interface DrawOnOptions extends TargetMotionOptions {
  from?: number;
  to?: number;
}

export interface StaggerOptions extends MotionPresetOptions {
  ids: string[];
  each?: number;
}

export function fadeIn(options: TargetMotionOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.4;
  return timelineFragment(options.id, { opacity: track([[start, 0], [start + duration, 1]], options.curve ?? curves.easeOut) });
}

export function fadeOut(options: TargetMotionOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.4;
  return timelineFragment(options.id, { opacity: track([[start, 1], [start + duration, 0]], options.curve ?? curves.easeIn) });
}

export function slideIn(options: MoveMotionOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.6;
  const to = options.to ?? [0, 0];
  const from = options.from ?? [to[0] - (options.distance ?? 80), to[1]];
  return timelineFragment(options.id, { position: track([[start, from], [start + duration, to]], options.curve ?? curves.easeOut) });
}

export function riseIn(options: MoveMotionOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.55;
  const to = options.to ?? [0, 0];
  const from = options.from ?? [to[0], to[1] + (options.distance ?? 36)];
  return mergeFragments(
    timelineFragment(options.id, { position: track([[start, from], [start + duration, to]], options.curve ?? curves.easeOut) }),
    fadeIn({ id: options.id, start, duration: Math.min(duration, 0.35), curve: options.curve ?? curves.easeOut })
  );
}

export function scaleIn(options: TargetMotionOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.5;
  return mergeFragments(
    timelineFragment(options.id, { scale: track([[start, 0.85], [start + duration, 1]], options.curve ?? curves.easeOut) }),
    fadeIn({ id: options.id, start, duration: Math.min(duration, 0.3), curve: options.curve ?? curves.easeOut })
  );
}

export function pulse(options: PulseOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.8;
  const amount = options.amount ?? 0.08;
  return timelineFragment(options.id, { scale: track([[start, 1], [start + duration * 0.5, 1 + amount], [start + duration, 1]], options.curve ?? curves.easeInOut) });
}

export function bob(options: MoveMotionOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 1.2;
  const base = options.to ?? [0, 0];
  const lift = options.distance ?? 16;
  return timelineFragment(options.id, { position: track([[start, base], [start + duration * 0.5, [base[0], base[1] - lift]], [start + duration, base]], options.curve ?? curves.easeInOut) });
}

export function shake(options: TargetMotionOptions & { amount?: number }): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.45;
  const amount = options.amount ?? 8;
  return timelineFragment(options.id, { x: track([[start, 0], [start + duration * 0.25, -amount], [start + duration * 0.5, amount], [start + duration * 0.75, -amount * 0.5], [start + duration, 0]], options.curve ?? curves.linear) });
}

export function drawOn(options: DrawOnOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.8;
  return timelineFragment(options.id, {
    drawStart: track([[start, options.from ?? 0], [start + duration, options.from ?? 0]], curves.linear),
    drawEnd: track([[start, options.from ?? 0], [start + duration, options.to ?? 1]], options.curve ?? curves.easeOut)
  });
}

export function stagger(options: StaggerOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.4;
  const each = options.each ?? 0.08;
  return mergeFragments(...options.ids.map((id, index) => fadeIn({ id, start: start + index * each, duration, curve: options.curve ?? curves.easeOut })));
}
