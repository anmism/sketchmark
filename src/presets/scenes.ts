import type { VisualElement } from "../types";
import type { BasePresetOptions, PresetFragment } from "./types";
import { ellipsePath, fragment, linePath, rectPath, roundedRectPath } from "./helpers";

export interface SceneOptions extends BasePresetOptions {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface TitleCardOptions extends SceneOptions {
  title: string;
  subtitle?: string;
}

export interface LowerThirdOptions extends SceneOptions {
  title: string;
  subtitle?: string;
}

export interface CaptionBubbleOptions extends SceneOptions {
  text: string;
}

export interface ComparisonSplitOptions extends SceneOptions {
  leftTitle?: string;
  rightTitle?: string;
}

export interface DeviceFrameOptions extends SceneOptions {
  label?: string;
}

export interface GridBackgroundOptions extends SceneOptions {
  step?: number;
  stroke?: string;
}

export function titleCard(options: TitleCardOptions): PresetFragment {
  const id = options.id ?? "titleCard";
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const children: VisualElement[] = [
    path(`${id}.bg`, rectPath(0, 0, options.width, options.height), { fill: "#0f172a" }),
    text(`${id}.title`, options.title, options.width / 2, options.height * 0.43, 42, "#ffffff", "center"),
  ];
  if (options.subtitle) children.push(text(`${id}.subtitle`, options.subtitle, options.width / 2, options.height * 0.57, 20, "#cbd5e1", "center"));
  return fragment([{ id, type: "group", x, y, width: options.width, height: options.height, children }]);
}

export function lowerThird(options: LowerThirdOptions): PresetFragment {
  const id = options.id ?? "lowerThird";
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const children: VisualElement[] = [
    path(`${id}.panel`, roundedRectPath(0, 0, options.width, options.height, 10), { fill: "#ffffff", stroke: "#cbd5e1", strokeWidth: 1 }),
    path(`${id}.accent`, roundedRectPath(0, 0, 8, options.height, 4), { fill: "#2563eb" }),
    text(`${id}.title`, options.title, 24, options.height * 0.38, 18, "#0f172a", "left")
  ];
  if (options.subtitle) children.push(text(`${id}.subtitle`, options.subtitle, 24, options.height * 0.68, 13, "#64748b", "left"));
  return fragment([{ id, type: "group", x, y, width: options.width, height: options.height, children }]);
}

export function captionBubble(options: CaptionBubbleOptions): PresetFragment {
  const id = options.id ?? "captionBubble";
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  return fragment([
    {
      id,
      type: "group",
      x,
      y,
      width: options.width,
      height: options.height,
      children: [
        path(`${id}.bubble`, roundedRectPath(0, 0, options.width, options.height, 14), { fill: "#ffffff", stroke: "#94a3b8", strokeWidth: 1 }),
        text(`${id}.text`, options.text, options.width / 2, options.height / 2, 16, "#111827", "center")
      ]
    }
  ]);
}

export function comparisonSplit(options: ComparisonSplitOptions): PresetFragment {
  const id = options.id ?? "comparisonSplit";
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const half = options.width / 2;
  return fragment([
    {
      id,
      type: "group",
      x,
      y,
      width: options.width,
      height: options.height,
      children: [
        path(`${id}.left`, rectPath(0, 0, half, options.height), { fill: "#eff6ff" }),
        path(`${id}.right`, rectPath(half, 0, half, options.height), { fill: "#f8fafc" }),
        path(`${id}.divider`, linePath([half, 0], [half, options.height]), { fill: "none", stroke: "#cbd5e1", strokeWidth: 2 }),
        text(`${id}.leftTitle`, options.leftTitle ?? "Before", half / 2, 32, 18, "#0f172a", "center"),
        text(`${id}.rightTitle`, options.rightTitle ?? "After", half + half / 2, 32, 18, "#0f172a", "center")
      ]
    }
  ]);
}

export function deviceFrame(options: DeviceFrameOptions): PresetFragment {
  const id = options.id ?? "deviceFrame";
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  return fragment([
    {
      id,
      type: "group",
      x,
      y,
      width: options.width,
      height: options.height,
      children: [
        path(`${id}.outer`, roundedRectPath(0, 0, options.width, options.height, 24), { fill: "#111827", stroke: "#020617", strokeWidth: 2 }),
        path(`${id}.screen`, roundedRectPath(14, 22, options.width - 28, options.height - 44, 14), { fill: "#f8fafc" }),
        path(`${id}.camera`, ellipsePath(options.width / 2, 11, 3, 3), { fill: "#475569" }),
        ...(options.label ? [text(`${id}.label`, options.label, options.width / 2, options.height - 18, 12, "#94a3b8", "center")] : [])
      ]
    }
  ]);
}

export function gridBackground(options: GridBackgroundOptions): PresetFragment {
  const id = options.id ?? "gridBackground";
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const step = options.step ?? 32;
  const stroke = options.stroke ?? "#e2e8f0";
  const children: VisualElement[] = [path(`${id}.bg`, rectPath(0, 0, options.width, options.height), { fill: "#ffffff" })];
  for (let gx = 0; gx <= options.width; gx += step) children.push(path(`${id}.v${Math.round(gx)}`, linePath([gx, 0], [gx, options.height]), { fill: "none", stroke, strokeWidth: 1 }));
  for (let gy = 0; gy <= options.height; gy += step) children.push(path(`${id}.h${Math.round(gy)}`, linePath([0, gy], [options.width, gy]), { fill: "none", stroke, strokeWidth: 1 }));
  return fragment([{ id, type: "group", x, y, width: options.width, height: options.height, children }]);
}

function path(id: string, d: string, options: { fill?: string; stroke?: string; strokeWidth?: number }): VisualElement {
  return {
    id,
    type: "path",
    d,
    ...(options.fill !== undefined ? { fill: options.fill } : {}),
    ...(options.stroke !== undefined ? { stroke: options.stroke } : {}),
    ...(options.strokeWidth !== undefined ? { strokeWidth: options.strokeWidth } : {})
  };
}

function text(id: string, content: string, x: number, y: number, fontSize: number, fill: string, align: "left" | "center"): VisualElement {
  return {
    id,
    type: "text",
    text: content,
    x,
    y,
    align,
    valign: "middle",
    fontSize,
    weight: 700,
    fill
  };
}
