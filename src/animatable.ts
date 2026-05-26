import type { MotionValue, Paint, Point2, VisualElement } from "./types";
import { clone, isFiniteNumber, isPoint2 } from "./utils";

export type AnimatableValueKind = "number" | "string" | "numberOrString" | "point2" | "numberArray" | "stringArray" | "object";
export type AnimatableInterpolation = "number" | "color" | "point2" | "numberArray" | "discrete";

export interface AnimatablePropertySpec {
  property: string;
  valueKind: AnimatableValueKind;
  interpolation: AnimatableInterpolation;
  elementTypes: readonly string[];
  defaultValue?: MotionValue | ((element: VisualElement, property: string) => MotionValue | undefined);
  ensure?: (element: VisualElement, property: string) => void;
}

const POSITION_TYPES = ["path", "point", "text", "image", "group"] as const;
const VISIBLE_TYPES = ["path", "text", "image", "group"] as const;
const PAINT_FILL_TYPES = ["path", "text"] as const;
const PATH_TYPES = ["path"] as const;
const TEXT_TYPES = ["text"] as const;
const IMAGE_TYPES = ["image"] as const;

const BASE_SPECS: AnimatablePropertySpec[] = [
  { property: "position", valueKind: "point2", interpolation: "point2", elementTypes: POSITION_TYPES, defaultValue: (element) => canUsePosition(element) ? [Number(element.x ?? 0), Number(element.y ?? 0)] : undefined },
  { property: "x", valueKind: "number", interpolation: "number", elementTypes: POSITION_TYPES, defaultValue: 0 },
  { property: "y", valueKind: "number", interpolation: "number", elementTypes: POSITION_TYPES, defaultValue: 0 },
  { property: "rotation", valueKind: "number", interpolation: "number", elementTypes: VISIBLE_TYPES, defaultValue: 0 },
  { property: "scale", valueKind: "number", interpolation: "number", elementTypes: VISIBLE_TYPES, defaultValue: 1 },
  { property: "scaleX", valueKind: "number", interpolation: "number", elementTypes: VISIBLE_TYPES, defaultValue: 1 },
  { property: "scaleY", valueKind: "number", interpolation: "number", elementTypes: VISIBLE_TYPES, defaultValue: 1 },
  { property: "origin", valueKind: "point2", interpolation: "point2", elementTypes: VISIBLE_TYPES },
  { property: "opacity", valueKind: "number", interpolation: "number", elementTypes: VISIBLE_TYPES, defaultValue: 1 },
  { property: "fill", valueKind: "string", interpolation: "color", elementTypes: PAINT_FILL_TYPES },
  { property: "stroke", valueKind: "string", interpolation: "color", elementTypes: PATH_TYPES },
  { property: "strokeWidth", valueKind: "number", interpolation: "number", elementTypes: PATH_TYPES, defaultValue: 1 },
  { property: "strokeCap", valueKind: "string", interpolation: "discrete", elementTypes: PATH_TYPES },
  { property: "strokeJoin", valueKind: "string", interpolation: "discrete", elementTypes: PATH_TYPES },
  { property: "miterLimit", valueKind: "number", interpolation: "number", elementTypes: PATH_TYPES },
  { property: "dashArray", valueKind: "numberArray", interpolation: "numberArray", elementTypes: PATH_TYPES },
  { property: "dashOffset", valueKind: "number", interpolation: "number", elementTypes: PATH_TYPES, defaultValue: 0 },
  { property: "drawStart", valueKind: "number", interpolation: "number", elementTypes: PATH_TYPES, defaultValue: 0 },
  { property: "drawEnd", valueKind: "number", interpolation: "number", elementTypes: PATH_TYPES, defaultValue: 1 },
  { property: "text", valueKind: "string", interpolation: "discrete", elementTypes: TEXT_TYPES },
  { property: "lines", valueKind: "stringArray", interpolation: "discrete", elementTypes: TEXT_TYPES },
  { property: "fontSize", valueKind: "number", interpolation: "number", elementTypes: TEXT_TYPES, defaultValue: 16 },
  { property: "lineHeight", valueKind: "number", interpolation: "number", elementTypes: TEXT_TYPES, defaultValue: 1.2 },
  { property: "letterSpacing", valueKind: "number", interpolation: "number", elementTypes: TEXT_TYPES, defaultValue: 0 },
  { property: "maxWidth", valueKind: "number", interpolation: "number", elementTypes: TEXT_TYPES },
  { property: "weight", valueKind: "numberOrString", interpolation: "discrete", elementTypes: TEXT_TYPES, defaultValue: 400 },
  { property: "width", valueKind: "number", interpolation: "number", elementTypes: ["image", "group"], defaultValue: 0 },
  { property: "height", valueKind: "number", interpolation: "number", elementTypes: ["image", "group"], defaultValue: 0 },
  { property: "src", valueKind: "string", interpolation: "discrete", elementTypes: IMAGE_TYPES },
  { property: "fit", valueKind: "string", interpolation: "discrete", elementTypes: IMAGE_TYPES },
  { property: "blendMode", valueKind: "string", interpolation: "discrete", elementTypes: VISIBLE_TYPES },
  { property: "clip.d", valueKind: "string", interpolation: "discrete", elementTypes: VISIBLE_TYPES, ensure: ensureClip },
  { property: "mask.d", valueKind: "string", interpolation: "discrete", elementTypes: VISIBLE_TYPES, ensure: ensureMask },
  { property: "mask.opacity", valueKind: "number", interpolation: "number", elementTypes: VISIBLE_TYPES, defaultValue: 1, ensure: ensureMask }
];

const BASE_BY_PROPERTY = new Map(BASE_SPECS.map((spec) => [spec.property, spec]));

export function animatablePropertySpec(element: VisualElement, property: string): AnimatablePropertySpec | undefined {
  const base = BASE_BY_PROPERTY.get(property);
  if (base) return supportsType(base, element.type) ? base : undefined;
  const dynamic = dynamicPropertySpec(property);
  return dynamic && supportsType(dynamic, element.type) ? dynamic : undefined;
}

export function knownAnimatableProperty(property: string): boolean {
  return BASE_BY_PROPERTY.has(property) || dynamicPropertySpec(property) !== undefined;
}

export function animatablePropertiesForElement(element: VisualElement): AnimatablePropertySpec[] {
  const out = BASE_SPECS.filter((spec) => supportsType(spec, element.type));
  for (const property of dynamicPropertiesForElement(element)) {
    const spec = animatablePropertySpec(element, property);
    if (spec) out.push(spec);
  }
  return out;
}

export function validateMotionValueForProperty(spec: AnimatablePropertySpec, value: unknown): boolean {
  switch (spec.valueKind) {
    case "number":
      return isFiniteNumber(value);
    case "string":
      return typeof value === "string";
    case "numberOrString":
      return isFiniteNumber(value) || typeof value === "string";
    case "point2":
      return isPoint2(value);
    case "numberArray":
      return isNumberArray(value);
    case "stringArray":
      return isStringArray(value);
    case "object":
      return isJsonObject(value);
  }
}

export function isTimelineValue(value: unknown): value is MotionValue {
  return isFiniteNumber(value) || typeof value === "string" || isPoint2(value) || isNumberArray(value) || isStringArray(value) || isJsonObject(value);
}

export function getPropertyValue(element: VisualElement, property: string): MotionValue | undefined {
  if (property === "position" && canUsePosition(element)) return [Number(element.x ?? 0), Number(element.y ?? 0)];
  const stop = parseGradientStopProperty(property);
  if (stop) return getGradientStopValue(element, stop);
  const value = getPathValue(element as unknown as Record<string, unknown>, parsePropertyPath(property));
  return isTimelineValue(value) ? clone(value) : undefined;
}

export function baseValueForProperty(element: VisualElement, property: string): MotionValue | undefined {
  const value = getPropertyValue(element, property);
  if (value !== undefined) return value;
  const spec = animatablePropertySpec(element, property);
  if (!spec || spec.defaultValue === undefined) return undefined;
  return typeof spec.defaultValue === "function" ? spec.defaultValue(element, property) : clone(spec.defaultValue);
}

export function applyPropertyValue(element: VisualElement, property: string, value: MotionValue): void {
  if (property === "position") {
    if (!isPoint2(value)) return;
    if (canUsePosition(element)) {
      const record = element as unknown as Record<string, unknown>;
      record.x = value[0];
      record.y = value[1];
    }
    return;
  }
  const spec = animatablePropertySpec(element, property);
  if (spec?.ensure) spec.ensure(element, property);
  const stop = parseGradientStopProperty(property);
  if (stop) {
    setGradientStopValue(element, stop, value);
    return;
  }
  const path = parsePropertyPath(property);
  if (path.length > 1) {
    setPathValue(element as unknown as Record<string, unknown>, path, clone(value), !!spec);
    return;
  }
  (element as unknown as Record<string, unknown>)[property] = clone(value);
}

export function parsePropertyPath(property: string): Array<string | number> {
  return property.split(".").filter(Boolean).map((segment) => /^\d+$/.test(segment) ? Number(segment) : segment);
}

export function conflictWarningsForTracks(trackNames: string[]): string[] {
  const tracks = new Set(trackNames);
  const warnings: string[] = [];
  if (tracks.has("position") && (tracks.has("x") || tracks.has("y"))) warnings.push("position overlaps with x/y tracks; prefer one representation.");
  if (tracks.has("scale") && (tracks.has("scaleX") || tracks.has("scaleY"))) warnings.push("scale overlaps with scaleX/scaleY tracks; prefer one representation.");
  for (const root of ["fill", "stroke"] as const) {
    if (tracks.has(root) && trackNames.some((name) => name.startsWith(`${root}.`))) warnings.push(`${root} overlaps with nested ${root}.* tracks; prefer whole-paint switching or nested paint animation, not both.`);
  }
  return warnings;
}

function dynamicPropertySpec(property: string): AnimatablePropertySpec | undefined {
  const gradient = parseGradientProperty(property);
  if (gradient) return gradient;
  if (/^effects\.(blur|brightness|contrast|saturate|hueRotate)$/.test(property)) {
    return { property, valueKind: "number", interpolation: "number", elementTypes: VISIBLE_TYPES, defaultValue: effectDefault(property), ensure: ensureEffects };
  }
  if (/^effects\.shadow\.(dx|dy|blur|opacity)$/.test(property)) {
    return { property, valueKind: "number", interpolation: "number", elementTypes: VISIBLE_TYPES, defaultValue: shadowDefault(property), ensure: ensureShadow };
  }
  if (property === "effects.shadow.color") {
    return { property, valueKind: "string", interpolation: "color", elementTypes: VISIBLE_TYPES, defaultValue: "#000000", ensure: ensureShadow };
  }
  if (/^source\.(x|y|width|height)$/.test(property)) {
    return { property, valueKind: "number", interpolation: "number", elementTypes: IMAGE_TYPES, defaultValue: sourceDefault(property), ensure: ensureImageSource };
  }
  return undefined;
}

function parseGradientProperty(property: string): AnimatablePropertySpec | undefined {
  const rootMatch = /^(fill|stroke)\.(from|to)$/.exec(property);
  if (rootMatch) {
    return { property, valueKind: "point2", interpolation: "point2", elementTypes: paintElementTypes(rootMatch[1]!), ensure: ensureLinearPaint };
  }
  const radialPoint = /^(fill|stroke)\.(center|focus)$/.exec(property);
  if (radialPoint) {
    return { property, valueKind: "point2", interpolation: "point2", elementTypes: paintElementTypes(radialPoint[1]!), ensure: ensureRadialPaint };
  }
  const radialRadius = /^(fill|stroke)\.radius$/.exec(property);
  if (radialRadius) {
    return { property, valueKind: "number", interpolation: "number", elementTypes: paintElementTypes(radialRadius[1]!), defaultValue: 40, ensure: ensureRadialPaint };
  }
  const stop = parseGradientStopProperty(property);
  if (!stop) return undefined;
  return {
    property,
    valueKind: stop.channel === "offset" ? "number" : "string",
    interpolation: stop.channel === "offset" ? "number" : "color",
    elementTypes: paintElementTypes(stop.root),
    ensure: ensureGradientStops
  };
}

function dynamicPropertiesForElement(element: VisualElement): string[] {
  const out = [
    "effects.blur",
    "effects.brightness",
    "effects.contrast",
    "effects.saturate",
    "effects.hueRotate",
    "effects.shadow.dx",
    "effects.shadow.dy",
    "effects.shadow.blur",
    "effects.shadow.color",
    "effects.shadow.opacity"
  ];
  if (element.type === "image") out.push("source.x", "source.y", "source.width", "source.height");
  for (const root of ["fill", "stroke"] as const) {
    if (!supportsType({ elementTypes: paintElementTypes(root) } as AnimatablePropertySpec, element.type)) continue;
    const paint = (element as unknown as Record<string, unknown>)[root] as Paint | undefined;
    if (isStructuredPaint(paint)) {
      if (paint.type === "linearGradient") out.push(`${root}.from`, `${root}.to`);
      if (paint.type === "radialGradient") out.push(`${root}.center`, `${root}.focus`, `${root}.radius`);
      for (let index = 0; index < paint.stops.length; index += 1) {
        out.push(`${root}.stops.${index}.offset`, `${root}.stops.${index}.color`);
      }
    }
  }
  return out;
}

function supportsType(spec: AnimatablePropertySpec, type: string): boolean {
  return spec.elementTypes.includes(type);
}

function canUsePosition(element: VisualElement): element is VisualElement & { x?: number; y?: number } {
  return element.type === "path" || element.type === "point" || element.type === "text" || element.type === "image" || element.type === "group";
}

function paintElementTypes(root: string): readonly string[] {
  return root === "fill" ? PAINT_FILL_TYPES : PATH_TYPES;
}

function getPathValue(target: Record<string, unknown>, path: Array<string | number>): unknown {
  let cursor: unknown = target;
  for (const segment of path) {
    if (cursor === undefined || cursor === null) return undefined;
    cursor = readSegment(cursor, segment);
  }
  return cursor;
}

function setPathValue(target: Record<string, unknown>, path: Array<string | number>, value: unknown, create: boolean): void {
  let cursor: unknown = target;
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index]!;
    const next = path[index + 1]!;
    const current = readSegment(cursor, segment);
    if (current === undefined || current === null) {
      if (!create) return;
      writeSegment(cursor, segment, typeof next === "number" ? [] : {});
    }
    cursor = readSegment(cursor, segment);
  }
  writeSegment(cursor, path[path.length - 1]!, value);
}

function readSegment(target: unknown, segment: string | number): unknown {
  if (Array.isArray(target) && typeof segment === "number") return target[segment];
  if (isRecord(target)) return target[String(segment)];
  return undefined;
}

function writeSegment(target: unknown, segment: string | number, value: unknown): void {
  if (Array.isArray(target) && typeof segment === "number") {
    target[segment] = value;
    return;
  }
  if (isRecord(target)) target[String(segment)] = value;
}

interface GradientStopPath {
  root: "fill" | "stroke";
  index: number;
  channel: "offset" | "color";
}

function parseGradientStopProperty(property: string): GradientStopPath | undefined {
  const match = /^(fill|stroke)\.stops\.(\d+)\.(offset|color)$/.exec(property);
  if (!match) return undefined;
  return { root: match[1] as "fill" | "stroke", index: Number(match[2]), channel: match[3] as "offset" | "color" };
}

function getGradientStopValue(element: VisualElement, stopPath: GradientStopPath): MotionValue | undefined {
  const paint = (element as unknown as Record<string, unknown>)[stopPath.root] as Paint | undefined;
  if (!isStructuredPaint(paint)) return undefined;
  const stop = paint.stops[stopPath.index];
  if (!stop) return undefined;
  const value = Array.isArray(stop) ? (stopPath.channel === "offset" ? stop[0] : stop[1]) : stop[stopPath.channel];
  return isTimelineValue(value) ? clone(value) : undefined;
}

function setGradientStopValue(element: VisualElement, stopPath: GradientStopPath, value: MotionValue): void {
  const paint = (element as unknown as Record<string, unknown>)[stopPath.root] as Paint | undefined;
  if (!isStructuredPaint(paint)) return;
  const stop = paint.stops[stopPath.index];
  if (!stop) return;
  if (Array.isArray(stop)) {
    if (stopPath.channel === "offset" && isFiniteNumber(value)) stop[0] = value;
    if (stopPath.channel === "color" && typeof value === "string") stop[1] = value;
  } else {
    (stop as Record<string, unknown>)[stopPath.channel] = clone(value);
  }
}

function ensureEffects(element: VisualElement): void {
  const record = element as unknown as Record<string, unknown>;
  if (!isRecord(record.effects)) record.effects = {};
}

function ensureShadow(element: VisualElement): void {
  ensureEffects(element);
  const effects = (element as unknown as Record<string, unknown>).effects as Record<string, unknown>;
  if (!isRecord(effects.shadow)) effects.shadow = { dx: 0, dy: 0, blur: 0, color: "#000000", opacity: 1 };
}

function ensureImageSource(element: VisualElement): void {
  if (element.type !== "image") return;
  if (!element.source) {
    element.source = {
      x: 0,
      y: 0,
      width: element.width,
      height: element.height,
      imageWidth: element.width,
      imageHeight: element.height
    };
  }
}

function ensureClip(element: VisualElement): void {
  if (!element.clip) element.clip = { type: "path", d: fullPlanePath() };
}

function ensureMask(element: VisualElement): void {
  if (!element.mask) element.mask = { type: "path", d: fullPlanePath(), opacity: 1 };
}

function ensureLinearPaint(element: VisualElement, property: string): void {
  const root = property.startsWith("stroke.") ? "stroke" : "fill";
  const record = element as unknown as Record<string, unknown>;
  const current = record[root] as Paint | undefined;
  if (isStructuredPaint(current) && current.type === "linearGradient") return;
  record[root] = { type: "linearGradient", from: [0, 0], to: [100, 0], stops: fallbackStops(current) };
}

function ensureRadialPaint(element: VisualElement, property: string): void {
  const root = property.startsWith("stroke.") ? "stroke" : "fill";
  const record = element as unknown as Record<string, unknown>;
  const current = record[root] as Paint | undefined;
  if (isStructuredPaint(current) && current.type === "radialGradient") return;
  record[root] = { type: "radialGradient", center: [50, 50], radius: 50, focus: [50, 50], stops: fallbackStops(current) };
}

function ensureGradientStops(element: VisualElement, property: string): void {
  const stop = parseGradientStopProperty(property);
  if (!stop) return;
  const record = element as unknown as Record<string, unknown>;
  const current = record[stop.root] as Paint | undefined;
  if (!isStructuredPaint(current)) record[stop.root] = { type: "linearGradient", from: [0, 0], to: [100, 0], stops: fallbackStops(current) };
  const paint = record[stop.root] as Extract<Paint, { stops: unknown[] }>;
  const minimum = Math.max(2, stop.index + 1);
  while (paint.stops.length < minimum) {
    const offset = paint.stops.length / Math.max(1, minimum - 1);
    paint.stops.push({ offset, color: paint.stops.length === 0 ? "#000000" : "#ffffff" });
  }
}

function fallbackStops(paint: Paint | undefined): Array<[number, string]> {
  if (isStructuredPaint(paint)) {
    return paint.stops.map((stop) => Array.isArray(stop) ? [Number(stop[0]), String(stop[1])] : [Number(stop.offset), String(stop.color)]);
  }
  if (typeof paint === "string") return [[0, paint], [1, paint]];
  return [[0, "#000000"], [1, "#ffffff"]];
}

function effectDefault(property: string): number {
  if (property === "effects.brightness" || property === "effects.contrast" || property === "effects.saturate") return 1;
  return 0;
}

function shadowDefault(property: string): number {
  return property === "effects.shadow.opacity" ? 1 : 0;
}

function sourceDefault(property: string): (element: VisualElement) => MotionValue | undefined {
  return (element) => {
    if (element.type !== "image") return undefined;
    if (property === "source.width") return element.width;
    if (property === "source.height") return element.height;
    return 0;
  };
}

function fullPlanePath(): string {
  return "M -100000 -100000 H 100000 V 100000 H -100000 Z";
}

function isStructuredPaint(value: unknown): value is Extract<Paint, { stops: unknown[] }> {
  return isRecord(value) && typeof value.type === "string" && Array.isArray(value.stops);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => isFiniteNumber(item));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "boolean" || isFiniteNumber(value) || (Array.isArray(value) && value.every(isJsonValue)) || isJsonObject(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
