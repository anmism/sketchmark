import type { Paint, Point2, TimelineCurve, TimelineTrack, VisualElement } from "../types";

export type PresetTimelineMap = Record<string, Record<string, TimelineTrack>>;

export interface PresetFragment {
  elements?: VisualElement[];
  timelines?: PresetTimelineMap;
}

export interface ApplyPresetOptions {
  validate?: boolean;
}

export interface BasePresetOptions {
  id?: string;
}

export interface StylePresetOptions {
  fill?: Paint;
  stroke?: Paint;
  strokeWidth?: number;
  opacity?: number;
}

export interface MotionPresetOptions {
  start?: number;
  duration?: number;
  curve?: TimelineCurve;
}

export type TransitionPair = {
  fromId: string;
  toId: string;
};

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PointLike = Point2;
