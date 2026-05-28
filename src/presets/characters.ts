import type { VisualElement } from "../types";
import type { BasePresetOptions, PresetFragment } from "./types";
import { ellipsePath, fragment, linePath, polygonPath, rectPath, roundedRectPath } from "./helpers";

export interface CharacterOptions extends BasePresetOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}

export function stickPerson(options: CharacterOptions = {}): PresetFragment {
  const id = options.id ?? "person";
  const height = options.height ?? 180;
  const stroke = options.stroke ?? "#111827";
  const headRadius = height * 0.12;
  const hipY = height * 0.58;
  return group(id, options, height * 0.5, height, [
    path(`${id}.head`, ellipsePath(height * 0.5, headRadius + 2, headRadius, headRadius), { fill: "#ffffff", stroke, strokeWidth: 5 }),
    path(`${id}.body`, linePath([height * 0.5, headRadius * 2 + 4], [height * 0.48, hipY]), { stroke, strokeWidth: 7 }),
    path(`${id}.leftArm`, linePath([height * 0.49, height * 0.25], [height * 0.27, height * 0.48]), { stroke, strokeWidth: 6 }),
    path(`${id}.rightArm`, linePath([height * 0.5, height * 0.25], [height * 0.72, height * 0.48]), { stroke: "#64748b", strokeWidth: 6 }),
    path(`${id}.leftLeg`, linePath([height * 0.48, hipY], [height * 0.3, height * 0.96]), { stroke: "#64748b", strokeWidth: 7 }),
    path(`${id}.rightLeg`, linePath([height * 0.48, hipY], [height * 0.68, height * 0.96]), { stroke, strokeWidth: 7 })
  ]);
}

export function talkingHead(options: CharacterOptions = {}): PresetFragment {
  const id = options.id ?? "talkingHead";
  const size = options.width ?? options.height ?? 140;
  const stroke = options.stroke ?? "#111827";
  return group(id, options, size, size * 1.1, [
    path(`${id}.shoulders`, `M ${size * 0.18} ${size} C ${size * 0.32} ${size * 0.82} ${size * 0.68} ${size * 0.82} ${size * 0.82} ${size}`, { fill: "none", stroke, strokeWidth: 8 }),
    path(`${id}.head`, ellipsePath(size * 0.5, size * 0.38, size * 0.28, size * 0.31), { fill: options.fill ?? "#ffffff", stroke, strokeWidth: 5 }),
    path(`${id}.leftEye`, ellipsePath(size * 0.4, size * 0.34, 3, 3), { fill: stroke }),
    path(`${id}.rightEye`, ellipsePath(size * 0.6, size * 0.34, 3, 3), { fill: stroke }),
    path(`${id}.mouth`, `M ${size * 0.4} ${size * 0.48} Q ${size * 0.5} ${size * 0.56} ${size * 0.62} ${size * 0.48}`, { fill: "none", stroke, strokeWidth: 4 })
  ]);
}

export function simpleDog(options: CharacterOptions = {}): PresetFragment {
  const id = options.id ?? "dog";
  const width = options.width ?? 180;
  const height = options.height ?? 100;
  const stroke = options.stroke ?? "#111827";
  const fur = options.fill ?? "#fbbf24";
  return group(id, options, width, height, [
    path(`${id}.body`, roundedRectPath(width * 0.18, height * 0.32, width * 0.5, height * 0.28, 18), { fill: fur, stroke, strokeWidth: 4 }),
    path(`${id}.head`, ellipsePath(width * 0.78, height * 0.35, width * 0.16, height * 0.18), { fill: fur, stroke, strokeWidth: 4 }),
    path(`${id}.ear`, polygonPath([[width * 0.7, height * 0.22], [width * 0.64, height * 0.02], [width * 0.82, height * 0.2]]), { fill: "#92400e", stroke, strokeWidth: 3 }),
    path(`${id}.tail`, `M ${width * 0.18} ${height * 0.38} Q ${width * 0.04} ${height * 0.22} ${width * 0.08} ${height * 0.12}`, { fill: "none", stroke, strokeWidth: 5 }),
    path(`${id}.frontLeg`, linePath([width * 0.58, height * 0.58], [width * 0.63, height * 0.95]), { stroke, strokeWidth: 5 }),
    path(`${id}.backLeg`, linePath([width * 0.3, height * 0.58], [width * 0.24, height * 0.95]), { stroke, strokeWidth: 5 }),
    path(`${id}.eye`, ellipsePath(width * 0.84, height * 0.32, 3, 3), { fill: stroke })
  ]);
}

export function simpleSpider(options: CharacterOptions = {}): PresetFragment {
  const id = options.id ?? "spider";
  const size = options.width ?? options.height ?? 150;
  const stroke = options.stroke ?? "#111827";
  const body = options.fill ?? "#334155";
  const children: VisualElement[] = [
    path(`${id}.body`, ellipsePath(size * 0.5, size * 0.48, size * 0.18, size * 0.16), { fill: body, stroke, strokeWidth: 4 }),
    path(`${id}.head`, ellipsePath(size * 0.68, size * 0.45, size * 0.1, size * 0.1), { fill: body, stroke, strokeWidth: 4 }),
    path(`${id}.eyeLeft`, ellipsePath(size * 0.7, size * 0.42, 2.5, 2.5), { fill: "#ffffff" }),
    path(`${id}.eyeRight`, ellipsePath(size * 0.75, size * 0.43, 2.5, 2.5), { fill: "#ffffff" })
  ];
  for (let i = 0; i < 4; i += 1) {
    const y = size * (0.33 + i * 0.08);
    children.push(path(`${id}.leftLeg${i + 1}`, `M ${size * 0.38} ${y} L ${size * 0.17} ${y - size * 0.08} L ${size * 0.08} ${y + size * 0.02}`, { fill: "none", stroke, strokeWidth: 4 }));
    children.push(path(`${id}.rightLeg${i + 1}`, `M ${size * 0.62} ${y} L ${size * 0.85} ${y - size * 0.08} L ${size * 0.94} ${y + size * 0.02}`, { fill: "none", stroke, strokeWidth: 4 }));
  }
  return group(id, options, size, size, children);
}

export function cursorHand(options: CharacterOptions = {}): PresetFragment {
  const id = options.id ?? "cursorHand";
  const size = options.width ?? options.height ?? 120;
  const stroke = options.stroke ?? "#111827";
  const d = [
    `M ${size * 0.22} ${size * 0.08}`,
    `L ${size * 0.78} ${size * 0.5}`,
    `L ${size * 0.53} ${size * 0.57}`,
    `L ${size * 0.66} ${size * 0.88}`,
    `L ${size * 0.5} ${size * 0.94}`,
    `L ${size * 0.38} ${size * 0.62}`,
    `L ${size * 0.18} ${size * 0.78}`,
    "Z"
  ].join(" ");
  return group(id, options, size, size, [path(`${id}.shape`, d, { fill: options.fill ?? "#ffffff", stroke, strokeWidth: 4 })]);
}

export function simpleMascot(options: CharacterOptions = {}): PresetFragment {
  const id = options.id ?? "mascot";
  const size = options.width ?? options.height ?? 150;
  const stroke = options.stroke ?? "#111827";
  return group(id, options, size, size, [
    path(`${id}.body`, roundedRectPath(size * 0.22, size * 0.4, size * 0.56, size * 0.44, 24), { fill: options.fill ?? "#bfdbfe", stroke, strokeWidth: 5 }),
    path(`${id}.head`, ellipsePath(size * 0.5, size * 0.28, size * 0.24, size * 0.22), { fill: "#ffffff", stroke, strokeWidth: 5 }),
    path(`${id}.leftEye`, ellipsePath(size * 0.42, size * 0.25, 4, 4), { fill: stroke }),
    path(`${id}.rightEye`, ellipsePath(size * 0.58, size * 0.25, 4, 4), { fill: stroke }),
    path(`${id}.smile`, `M ${size * 0.39} ${size * 0.36} Q ${size * 0.5} ${size * 0.43} ${size * 0.61} ${size * 0.36}`, { fill: "none", stroke, strokeWidth: 4 }),
    path(`${id}.leftArm`, linePath([size * 0.22, size * 0.5], [size * 0.06, size * 0.66]), { stroke, strokeWidth: 5 }),
    path(`${id}.rightArm`, linePath([size * 0.78, size * 0.5], [size * 0.94, size * 0.66]), { stroke, strokeWidth: 5 })
  ]);
}

function group(id: string, options: CharacterOptions, width: number, height: number, children: VisualElement[]): PresetFragment {
  return fragment([{ id, type: "group", x: options.x ?? 0, y: options.y ?? 0, width, height, children }]);
}

function path(id: string, d: string, options: { fill?: string; stroke?: string; strokeWidth?: number } = {}): VisualElement {
  return {
    id,
    type: "path",
    d,
    ...(options.fill !== undefined ? { fill: options.fill } : { fill: "none" }),
    ...(options.stroke !== undefined ? { stroke: options.stroke } : {}),
    ...(options.strokeWidth !== undefined ? { strokeWidth: options.strokeWidth } : {})
  };
}
