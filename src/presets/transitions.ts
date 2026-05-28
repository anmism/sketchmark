import type { Point2 } from "../types";
import type { Box, MotionPresetOptions, PresetFragment, TransitionPair } from "./types";
import { curves, ellipsePath, mergeFragments, rectPath, timelineFragment, track } from "./helpers";

export interface TransitionOptions extends TransitionPair, MotionPresetOptions {
  distance?: number;
  fromPosition?: Point2;
  toPosition?: Point2;
}

export interface WipeOptions extends TransitionOptions, Box {}

export interface CanvasTransitionOptions extends TransitionOptions {
  width: number;
  height: number;
  id?: string;
}

export interface IrisOptions extends MotionPresetOptions, Box {
  id: string;
  cx?: number;
  cy?: number;
}

export function crossfade(options: TransitionOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.5;
  return mergeFragments(
    timelineFragment(options.fromId, { opacity: track([[start, 1], [start + duration, 0]], options.curve ?? curves.easeInOut) }),
    timelineFragment(options.toId, { opacity: track([[start, 0], [start + duration, 1]], options.curve ?? curves.easeInOut) })
  );
}

export function pushLeft(options: TransitionOptions): PresetFragment {
  return push(options, -Math.abs(options.distance ?? 120), 0);
}

export function pushRight(options: TransitionOptions): PresetFragment {
  return push(options, Math.abs(options.distance ?? 120), 0);
}

export function slideUp(options: TransitionOptions): PresetFragment {
  const distance = Math.abs(options.distance ?? 90);
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.5;
  const fromBase = options.fromPosition ?? [0, 0];
  const toBase = options.toPosition ?? [0, 0];
  return mergeFragments(
    timelineFragment(options.fromId, { position: track([[start, fromBase], [start + duration, [fromBase[0], fromBase[1] - distance]]], options.curve ?? curves.easeInOut), opacity: track([[start, 1], [start + duration, 0]], options.curve ?? curves.easeInOut) }),
    timelineFragment(options.toId, { position: track([[start, [toBase[0], toBase[1] + distance]], [start + duration, toBase]], options.curve ?? curves.easeInOut), opacity: track([[start, 0], [start + duration, 1]], options.curve ?? curves.easeInOut) })
  );
}

export function wipeLeft(options: WipeOptions): PresetFragment {
  return wipe(options, "left");
}

export function wipeRight(options: WipeOptions): PresetFragment {
  return wipe(options, "right");
}

export function zoomCut(options: TransitionOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.45;
  return mergeFragments(
    timelineFragment(options.fromId, { scale: track([[start, 1], [start + duration, 1.08]], options.curve ?? curves.easeIn), opacity: track([[start, 1], [start + duration, 0]], options.curve ?? curves.easeIn) }),
    timelineFragment(options.toId, { scale: track([[start, 0.92], [start + duration, 1]], options.curve ?? curves.easeOut), opacity: track([[start, 0], [start + duration, 1]], options.curve ?? curves.easeOut) })
  );
}

export function fadeThroughBlack(options: CanvasTransitionOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.8;
  const id = options.id ?? "transition.black";
  return mergeFragments(
    crossfade({ fromId: options.fromId, toId: options.toId, start, duration, curve: options.curve ?? curves.easeInOut }),
    {
      elements: [{ id, type: "path", d: rectPath(0, 0, options.width, options.height), fill: "#000000", opacity: 0 }],
      timelines: {
        [id]: {
          opacity: track([[start, 0], [start + duration * 0.5, 1], [start + duration, 0]], options.curve ?? curves.easeInOut)
        }
      }
    }
  );
}

export function irisIn(options: IrisOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.8;
  const cx = options.cx ?? options.x + options.width / 2;
  const cy = options.cy ?? options.y + options.height / 2;
  const maxRadius = Math.hypot(options.width, options.height);
  return timelineFragment(options.id, {
    "clip.d": {
      keyframes: sampledClip(start, duration, 12, (progress) => ellipsePath(cx, cy, maxRadius * progress, maxRadius * progress), options.curve ?? curves.easeOut)
    }
  });
}

export function irisOut(options: IrisOptions): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.8;
  const cx = options.cx ?? options.x + options.width / 2;
  const cy = options.cy ?? options.y + options.height / 2;
  const maxRadius = Math.hypot(options.width, options.height);
  return timelineFragment(options.id, {
    "clip.d": {
      keyframes: sampledClip(start, duration, 12, (progress) => ellipsePath(cx, cy, maxRadius * (1 - progress), maxRadius * (1 - progress)), options.curve ?? curves.easeIn)
    }
  });
}

function push(options: TransitionOptions, dx: number, dy: number): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.55;
  const fromBase = options.fromPosition ?? [0, 0];
  const toBase = options.toPosition ?? [0, 0];
  return mergeFragments(
    timelineFragment(options.fromId, { position: track([[start, fromBase], [start + duration, [fromBase[0] + dx, fromBase[1] + dy]]], options.curve ?? curves.easeInOut) }),
    timelineFragment(options.toId, { position: track([[start, [toBase[0] - dx, toBase[1] - dy]], [start + duration, toBase]], options.curve ?? curves.easeInOut) })
  );
}

function wipe(options: WipeOptions, direction: "left" | "right"): PresetFragment {
  const start = options.start ?? 0;
  const duration = options.duration ?? 0.6;
  const full = rectPath(options.x, options.y, options.width, options.height);
  const empty = direction === "right" ? rectPath(options.x, options.y, 0, options.height) : rectPath(options.x + options.width, options.y, 0, options.height);
  return mergeFragments(
    timelineFragment(options.fromId, { opacity: track([[start, 1], [start + duration, 0]], options.curve ?? curves.easeInOut) }),
    timelineFragment(options.toId, {
      "mask.d": {
        keyframes: [
          { time: start, value: empty, out: options.curve ?? curves.easeInOut },
          { time: start + duration, value: full }
        ]
      },
      "mask.opacity": track([[start, 1], [start + duration, 1]], curves.linear),
      opacity: track([[start, 0], [start + 0.001, 1]], curves.linear)
    })
  );
}

function sampledClip(start: number, duration: number, samples: number, makePath: (progress: number) => string, curve: typeof curves.linear) {
  return Array.from({ length: samples + 1 }, (_, index) => {
    const progress = index / samples;
    return {
      time: start + duration * progress,
      value: makePath(progress),
      ...(index < samples ? { out: curve } : {})
    };
  });
}
