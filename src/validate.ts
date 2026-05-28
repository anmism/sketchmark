import type {
  ClipShape,
  ElementTimeline,
  ImageElement,
  ImageFit,
  MaskShape,
  Paint,
  TimelineCurve,
  TimelineKeyframe,
  TimelineTrack,
  ValidationIssue,
  ValidationResult,
  ValidationWarning,
  VisualDocument,
  VisualEffects,
  VisualElement
} from "./types";
import { animatablePropertySpec, conflictWarningsForTracks, isTimelineValue, knownAnimatableProperty, validateMotionValueForProperty } from "./animatable";
import { flattenElements, isFiniteNumber, isPoint2 } from "./utils";

const ELEMENT_TYPES = new Set(["path", "text", "image", "point", "group"]);
const TOP_LEVEL_FIELDS = new Set(["version", "canvas", "elements"]);
const CANVAS_FIELDS = new Set(["width", "height", "background", "duration", "fps"]);
const COMMON_ELEMENT_FIELDS = new Set([
  "id",
  "type",
  "opacity",
  "fill",
  "stroke",
  "strokeWidth",
  "strokeCap",
  "strokeJoin",
  "miterLimit",
  "dashArray",
  "dashOffset",
  "drawStart",
  "drawEnd",
  "effects",
  "blendMode",
  "rotation",
  "scale",
  "scaleX",
  "scaleY",
  "origin",
  "clip",
  "mask",
  "timeline"
]);
const TYPE_FIELDS: Record<string, Set<string>> = {
  path: new Set(["d", "x", "y"]),
  text: new Set(["x", "y", "text", "lines", "align", "valign", "fontSize", "fontFamily", "weight", "fontStyle", "lineHeight", "letterSpacing", "maxWidth", "wrap"]),
  image: new Set(["src", "x", "y", "width", "height", "fit", "source"]),
  point: new Set(["x", "y"]),
  group: new Set(["x", "y", "width", "height", "children"])
};
const TIMELINE_TRACK_FIELDS = new Set(["keyframes", "curve", "ease"]);
const TIMELINE_KEYFRAME_FIELDS = new Set(["time", "value", "in", "out", "interpolation"]);

export function validateVisualDocument(document: VisualDocument): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationWarning[] = [];

  if (!document || typeof document !== "object") {
    issues.push(issue("/", "invalid_document", "Document must be an object."));
    return { ok: false, issues, warnings };
  }

  for (const key of Object.keys(document as unknown as Record<string, unknown>)) {
    if (!TOP_LEVEL_FIELDS.has(key)) issues.push(issue(`/${key}`, "non_kernel_field", `Field '${key}' is not part of the render kernel.`));
  }

  if (document.version !== 1) issues.push(issue("/version", "invalid_version", "Document version must be 1."));
  validateCanvas((document as VisualDocument).canvas, issues);

  const elements = document.elements ?? [];
  if (document.elements !== undefined && !Array.isArray(elements)) issues.push(issue("/elements", "invalid_elements", "Document elements must be an array."));

  const allElements = Array.isArray(elements) ? flattenElements(elements) : [];
  const ids = new Set<string>();
  for (const [index, element] of allElements.entries()) {
    const path = `/elements/${index}`;
    if (typeof element.id === "string") {
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(element.id)) {
        issues.push(issue(`${path}/id`, "invalid_id", `Invalid id '${element.id}'. Use letters, numbers, '_' or '-'.`));
      } else if (ids.has(element.id)) {
        issues.push(issue(`${path}/id`, "duplicate_id", `Duplicate element id '${element.id}'.`));
      } else {
        ids.add(element.id);
      }
    }
  }

  if (Array.isArray(elements)) validateElementList(elements, "/elements", issues, warnings);
  return { ok: issues.length === 0, issues, warnings };
}

function validateCanvas(canvas: VisualDocument["canvas"], issues: ValidationIssue[]): void {
  if (!canvas || typeof canvas !== "object") {
    issues.push(issue("/canvas", "missing_canvas", "Document must define canvas."));
    return;
  }
  for (const key of Object.keys(canvas as unknown as Record<string, unknown>)) {
    if (!CANVAS_FIELDS.has(key)) issues.push(issue(`/canvas/${key}`, "non_kernel_canvas_field", `Canvas field '${key}' is not part of the render kernel.`));
  }
  if (!isFiniteNumber(canvas.width)) issues.push(issue("/canvas/width", "missing_canvas_width", "Canvas width must be a number."));
  if (!isFiniteNumber(canvas.height)) issues.push(issue("/canvas/height", "missing_canvas_height", "Canvas height must be a number."));
  if (canvas.background !== undefined && typeof canvas.background !== "string") {
    issues.push(issue("/canvas/background", "invalid_canvas_background", "Canvas background must be a color string."));
  }
  if (canvas.duration !== undefined && (!isFiniteNumber(canvas.duration) || canvas.duration < 0)) {
    issues.push(issue("/canvas/duration", "invalid_canvas_duration", "Canvas duration must be a non-negative number."));
  }
  if (canvas.fps !== undefined && (!isFiniteNumber(canvas.fps) || canvas.fps <= 0)) {
    issues.push(issue("/canvas/fps", "invalid_canvas_fps", "Canvas fps must be a positive number."));
  }
}

function validateElementList(elements: VisualElement[], path: string, issues: ValidationIssue[], warnings: ValidationWarning[]): void {
  for (const [index, element] of elements.entries()) validateElement(element, `${path}/${index}`, issues, warnings);
}

function validateElement(element: VisualElement, path: string, issues: ValidationIssue[], warnings: ValidationWarning[]): void {
  if (!element || typeof element !== "object" || Array.isArray(element)) {
    issues.push(issue(path, "invalid_element", "Element must be an object."));
    return;
  }
  const type = String((element as { type?: unknown }).type ?? "");
  if (!ELEMENT_TYPES.has(type)) {
    issues.push(issue(`${path}/type`, "unsupported_type", `Unsupported kernel element type '${type}'.`));
    return;
  }
  validateElementFields(element, type, path, issues);

  if (type === "path") {
    if (typeof (element as { d?: unknown }).d !== "string" || !(element as { d?: string }).d?.trim()) {
      issues.push(issue(`${path}/d`, "missing_path_d", "Path elements require a non-empty d string."));
    }
    if ((element as { x?: unknown }).x !== undefined) requireNumber((element as { x?: unknown }).x, `${path}/x`, issues);
    if ((element as { y?: unknown }).y !== undefined) requireNumber((element as { y?: unknown }).y, `${path}/y`, issues);
  }
  if (type === "text") {
    requireNumber((element as { x?: unknown }).x, `${path}/x`, issues);
    requireNumber((element as { y?: unknown }).y, `${path}/y`, issues);
    if ((element as { text?: unknown }).text !== undefined && typeof (element as { text?: unknown }).text !== "string") {
      issues.push(issue(`${path}/text`, "invalid_text", "Text must be a string."));
    }
    const lines = (element as { lines?: unknown }).lines;
    if (lines !== undefined && (!Array.isArray(lines) || lines.some((line) => typeof line !== "string"))) {
      issues.push(issue(`${path}/lines`, "invalid_lines", "Text lines must be an array of strings."));
    }
    if (typeof (element as { text?: unknown }).text === "string" && (element as { text: string }).text.length > 80 && !(element as { wrap?: boolean }).wrap && !isFiniteNumber((element as { maxWidth?: unknown }).maxWidth)) {
      warnings.push(warning(`${path}/text`, "long_text_no_wrap", "Long text should use maxWidth/wrap or explicit line breaks."));
    }
  }
  if (type === "image") validateImage(element as ImageElement, path, issues);
  if (type === "point") {
    requireNumber((element as { x?: unknown }).x, `${path}/x`, issues);
    requireNumber((element as { y?: unknown }).y, `${path}/y`, issues);
  }
  if (type === "group") {
    requireNumber((element as { x?: unknown }).x, `${path}/x`, issues);
    requireNumber((element as { y?: unknown }).y, `${path}/y`, issues);
    if ((element as { width?: unknown }).width !== undefined) requireNumber((element as { width?: unknown }).width, `${path}/width`, issues);
    if ((element as { height?: unknown }).height !== undefined) requireNumber((element as { height?: unknown }).height, `${path}/height`, issues);
    const children = (element as { children?: unknown }).children;
    if (!Array.isArray(children)) issues.push(issue(`${path}/children`, "invalid_group_children", "Group children must be an array."));
    else validateElementList(children as VisualElement[], `${path}/children`, issues, warnings);
  }

  validateStyle(element, path, issues);
  validateTimeline(element, element.timeline, `${path}/timeline`, issues, warnings);
}

function validateElementFields(element: VisualElement, type: string, path: string, issues: ValidationIssue[]): void {
  const typeFields = TYPE_FIELDS[type] ?? new Set<string>();
  for (const key of Object.keys(element as unknown as Record<string, unknown>)) {
    if (!COMMON_ELEMENT_FIELDS.has(key) && !typeFields.has(key)) {
      issues.push(issue(`${path}/${key}`, "non_kernel_element_field", `Field '${key}' is not valid on kernel ${type} elements.`));
    }
  }
}

function validateImage(element: ImageElement, path: string, issues: ValidationIssue[]): void {
  if (typeof element.src !== "string" || !element.src) issues.push(issue(`${path}/src`, "missing_image_src", "Image src must be a string."));
  requireNumber(element.x, `${path}/x`, issues);
  requireNumber(element.y, `${path}/y`, issues);
  requireNumber(element.width, `${path}/width`, issues);
  requireNumber(element.height, `${path}/height`, issues);
  if (isFiniteNumber(element.width) && element.width <= 0) issues.push(issue(`${path}/width`, "invalid_image_width", "Image width must be positive."));
  if (isFiniteNumber(element.height) && element.height <= 0) issues.push(issue(`${path}/height`, "invalid_image_height", "Image height must be positive."));
  validateImageFit(element.fit, `${path}/fit`, issues);
  if (!element.source) return;
  requireNumber(element.source.x, `${path}/source/x`, issues);
  requireNumber(element.source.y, `${path}/source/y`, issues);
  requireNumber(element.source.width, `${path}/source/width`, issues);
  requireNumber(element.source.height, `${path}/source/height`, issues);
  requireNumber(element.source.imageWidth, `${path}/source/imageWidth`, issues);
  requireNumber(element.source.imageHeight, `${path}/source/imageHeight`, issues);
}

function validateStyle(element: VisualElement, path: string, issues: ValidationIssue[]): void {
  validatePaint(element.fill, `${path}/fill`, issues);
  validatePaint(element.stroke, `${path}/stroke`, issues);
  if (element.opacity !== undefined && (!isFiniteNumber(element.opacity) || element.opacity < 0 || element.opacity > 1)) issues.push(issue(`${path}/opacity`, "invalid_opacity", "Opacity must be between 0 and 1."));
  if (element.strokeWidth !== undefined && !isFiniteNumber(element.strokeWidth)) issues.push(issue(`${path}/strokeWidth`, "invalid_stroke_width", "strokeWidth must be a number."));
  if (element.strokeCap !== undefined && !["butt", "round", "square"].includes(String(element.strokeCap))) issues.push(issue(`${path}/strokeCap`, "invalid_stroke_cap", "strokeCap must be 'butt', 'round', or 'square'."));
  if (element.strokeJoin !== undefined && !["miter", "round", "bevel"].includes(String(element.strokeJoin))) issues.push(issue(`${path}/strokeJoin`, "invalid_stroke_join", "strokeJoin must be 'miter', 'round', or 'bevel'."));
  for (const key of ["miterLimit", "dashOffset", "rotation", "scale", "scaleX", "scaleY", "fontSize", "lineHeight", "letterSpacing", "maxWidth"] as const) {
    const value = (element as unknown as Record<string, unknown>)[key];
    if (value !== undefined && !isFiniteNumber(value)) issues.push(issue(`${path}/${key}`, "invalid_number", `${key} must be a finite number.`));
  }
  if (element.dashArray !== undefined && (!Array.isArray(element.dashArray) || element.dashArray.some((value) => !isFiniteNumber(value)))) issues.push(issue(`${path}/dashArray`, "invalid_dash_array", "dashArray must be an array of numbers."));
  if (element.drawStart !== undefined && (!isFiniteNumber(element.drawStart) || element.drawStart < 0 || element.drawStart > 1)) issues.push(issue(`${path}/drawStart`, "invalid_draw_start", "drawStart must be between 0 and 1."));
  if (element.drawEnd !== undefined && (!isFiniteNumber(element.drawEnd) || element.drawEnd < 0 || element.drawEnd > 1)) issues.push(issue(`${path}/drawEnd`, "invalid_draw_end", "drawEnd must be between 0 and 1."));
  if (isFiniteNumber(element.drawStart) && isFiniteNumber(element.drawEnd) && element.drawStart > element.drawEnd) issues.push(issue(`${path}/drawStart`, "invalid_draw_range", "drawStart must be less than or equal to drawEnd."));
  if (element.origin !== undefined && !isPoint2(element.origin)) issues.push(issue(`${path}/origin`, "invalid_origin", "origin must be [x,y]."));
  validateEffects(element.effects, `${path}/effects`, issues);
  validateClip(element.clip, `${path}/clip`, issues);
  validateMask(element.mask, `${path}/mask`, issues);
}

function validatePaint(value: Paint | undefined, path: string, issues: ValidationIssue[]): void {
  if (value === undefined || typeof value === "string") return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(issue(path, "invalid_paint", "Paint must be a color string or structured paint object."));
    return;
  }
  if (value.type === "linearGradient") {
    if (!isPoint2(value.from)) issues.push(issue(`${path}/from`, "invalid_gradient_from", "Linear gradient from must be [x,y]."));
    if (!isPoint2(value.to)) issues.push(issue(`${path}/to`, "invalid_gradient_to", "Linear gradient to must be [x,y]."));
    validateGradientStops(value.stops, `${path}/stops`, issues);
    return;
  }
  if (value.type === "radialGradient") {
    if (!isPoint2(value.center)) issues.push(issue(`${path}/center`, "invalid_gradient_center", "Radial gradient center must be [x,y]."));
    if (!isFiniteNumber(value.radius) || value.radius < 0) issues.push(issue(`${path}/radius`, "invalid_gradient_radius", "Radial gradient radius must be non-negative."));
    if (value.focus !== undefined && !isPoint2(value.focus)) issues.push(issue(`${path}/focus`, "invalid_gradient_focus", "Radial gradient focus must be [x,y]."));
    validateGradientStops(value.stops, `${path}/stops`, issues);
    return;
  }
  if (value.type === "pattern") {
    if (typeof value.src !== "string" || !value.src) issues.push(issue(`${path}/src`, "invalid_pattern_src", "Pattern src must be a string."));
    if (!isFiniteNumber(value.width) || value.width <= 0) issues.push(issue(`${path}/width`, "invalid_pattern_width", "Pattern width must be positive."));
    if (!isFiniteNumber(value.height) || value.height <= 0) issues.push(issue(`${path}/height`, "invalid_pattern_height", "Pattern height must be positive."));
    validateImageFit(value.fit, `${path}/fit`, issues);
    return;
  }
  issues.push(issue(`${path}/type`, "invalid_paint_type", "Paint object type must be linearGradient, radialGradient, or pattern."));
}

function validateGradientStops(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value) || value.length < 2) {
    issues.push(issue(path, "invalid_gradient_stops", "Gradient stops must include at least two stops."));
    return;
  }
  for (const [index, stop] of value.entries()) {
    const offset = Array.isArray(stop) ? stop[0] : typeof stop === "object" && stop ? (stop as { offset?: unknown }).offset : undefined;
    const color = Array.isArray(stop) ? stop[1] : typeof stop === "object" && stop ? (stop as { color?: unknown }).color : undefined;
    if (!isFiniteNumber(offset) || offset < 0 || offset > 1) issues.push(issue(`${path}/${index}/offset`, "invalid_gradient_stop_offset", "Gradient stop offset must be between 0 and 1."));
    if (typeof color !== "string") issues.push(issue(`${path}/${index}/color`, "invalid_gradient_stop_color", "Gradient stop color must be a string."));
  }
}

function validateEffects(value: VisualEffects | undefined, path: string, issues: ValidationIssue[]): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(issue(path, "invalid_effects", "effects must be an object."));
    return;
  }
  for (const key of ["blur", "brightness", "contrast", "saturate", "hueRotate"] as const) {
    const effectValue = value[key];
    if (effectValue !== undefined && !isFiniteNumber(effectValue)) issues.push(issue(`${path}/${key}`, "invalid_effect_value", `${key} must be a finite number.`));
  }
  if (value.shadow !== undefined) {
    const shadow = value.shadow;
    if (!shadow || typeof shadow !== "object" || Array.isArray(shadow)) {
      issues.push(issue(`${path}/shadow`, "invalid_shadow", "shadow must be an object."));
      return;
    }
    requireNumber(shadow.dx, `${path}/shadow/dx`, issues);
    requireNumber(shadow.dy, `${path}/shadow/dy`, issues);
    requireNumber(shadow.blur, `${path}/shadow/blur`, issues);
    if (typeof shadow.color !== "string") issues.push(issue(`${path}/shadow/color`, "invalid_shadow_color", "shadow color must be a string."));
    if (shadow.opacity !== undefined && (!isFiniteNumber(shadow.opacity) || shadow.opacity < 0 || shadow.opacity > 1)) issues.push(issue(`${path}/shadow/opacity`, "invalid_shadow_opacity", "shadow opacity must be between 0 and 1."));
  }
}

function validateClip(value: ClipShape | undefined, path: string, issues: ValidationIssue[]): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || value.type !== "path" || typeof value.d !== "string" || !value.d.trim()) issues.push(issue(path, "invalid_clip", "clip must be { type:'path', d:string }."));
}

function validateMask(value: MaskShape | undefined, path: string, issues: ValidationIssue[]): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || value.type !== "path" || typeof value.d !== "string" || !value.d.trim()) issues.push(issue(path, "invalid_mask", "mask must be { type:'path', d:string, opacity?:number }."));
  if (value && value.opacity !== undefined && (!isFiniteNumber(value.opacity) || value.opacity < 0 || value.opacity > 1)) issues.push(issue(`${path}/opacity`, "invalid_mask_opacity", "mask opacity must be between 0 and 1."));
}

function validateTimeline(element: VisualElement, value: ElementTimeline | undefined, path: string, issues: ValidationIssue[], warnings: ValidationWarning[]): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(issue(path, "invalid_timeline", "timeline must be an object."));
    return;
  }
  if (value.start !== undefined && (!isFiniteNumber(value.start) || value.start < 0)) issues.push(issue(`${path}/start`, "invalid_timeline_start", "timeline.start must be a non-negative number."));
  if (value.end !== undefined && (!isFiniteNumber(value.end) || value.end < 0)) issues.push(issue(`${path}/end`, "invalid_timeline_end", "timeline.end must be a non-negative number."));
  if (isFiniteNumber(value.start) && isFiniteNumber(value.end) && value.end < value.start) issues.push(issue(`${path}/end`, "invalid_timeline_range", "timeline.end must be greater than or equal to timeline.start."));
  if (value.tracks === undefined) return;
  if (!value.tracks || typeof value.tracks !== "object" || Array.isArray(value.tracks)) {
    issues.push(issue(`${path}/tracks`, "invalid_timeline_tracks", "timeline.tracks must be an object."));
    return;
  }
  for (const [property, track] of Object.entries(value.tracks)) validateTrack(element, property, track, `${path}/tracks/${property}`, issues, warnings);
  for (const message of conflictWarningsForTracks(Object.keys(value.tracks))) {
    warnings.push(warning(`${path}/tracks`, "conflicting_timeline_tracks", message));
  }
}

function validateTrack(element: VisualElement, property: string, track: TimelineTrack, path: string, issues: ValidationIssue[], warnings: ValidationWarning[]): void {
  if (!track || typeof track !== "object" || Array.isArray(track)) {
    issues.push(issue(path, "invalid_timeline_track", "Timeline track must be an object."));
    return;
  }
  for (const key of Object.keys(track as unknown as Record<string, unknown>)) {
    if (!TIMELINE_TRACK_FIELDS.has(key)) issues.push(issue(`${path}/${key}`, "non_kernel_timeline_track_field", `Timeline track field '${key}' is not part of the render kernel.`));
  }
  validateTimelineCurve(track.curve, `${path}/curve`, issues);
  if (track.ease !== undefined && typeof track.ease !== "string") issues.push(issue(`${path}/ease`, "invalid_timeline_ease", "Timeline ease must be a string."));
  const propertySpec = animatablePropertySpec(element, property);
  if (!propertySpec) {
    const code = knownAnimatableProperty(property) ? "unsupported_timeline_track_for_element" : "unknown_timeline_track";
    issues.push(issue(path, code, `Timeline track '${property}' is not a supported animatable property for ${element.type} elements.`));
  }
  if (!Array.isArray(track.keyframes) || !track.keyframes.length) {
    issues.push(issue(`${path}/keyframes`, "invalid_timeline_keyframes", "Track keyframes must be a non-empty array."));
    return;
  }
  let previous = Number.NEGATIVE_INFINITY;
  for (const [index, frame] of track.keyframes.entries()) {
    const time = validateKeyframe(frame, `${path}/keyframes/${index}`, issues, propertySpec);
    if (time === undefined) continue;
    if (time < previous) issues.push(issue(`${path}/keyframes/${index}/time`, "unsorted_timeline_keyframes", "Keyframe times must be sorted."));
    previous = time;
  }
}

function validateKeyframe(frame: TimelineKeyframe, path: string, issues: ValidationIssue[], propertySpec: ReturnType<typeof animatablePropertySpec>): number | undefined {
  if (Array.isArray(frame)) {
    if (frame.length !== 2) {
      issues.push(issue(path, "invalid_timeline_keyframe", "Keyframe tuple must be [time,value]."));
      return undefined;
    }
    if (!isFiniteNumber(frame[0])) {
      issues.push(issue(`${path}/0`, "invalid_timeline_keyframe_time", "Keyframe time must be finite seconds."));
      return undefined;
    }
    validateTimelineValue(frame[1], `${path}/1`, issues, propertySpec);
    return frame[0];
  }
  if (!frame || typeof frame !== "object") {
    issues.push(issue(path, "invalid_timeline_keyframe", "Keyframe must be [time,value] or { time, value }."));
    return undefined;
  }
  for (const key of Object.keys(frame as unknown as Record<string, unknown>)) {
    if (!TIMELINE_KEYFRAME_FIELDS.has(key)) issues.push(issue(`${path}/${key}`, "non_kernel_timeline_keyframe_field", `Timeline keyframe field '${key}' is not part of the render kernel.`));
  }
  if (!isFiniteNumber(frame.time)) {
    issues.push(issue(`${path}/time`, "invalid_timeline_keyframe_time", "Keyframe time must be finite seconds."));
    return undefined;
  }
  validateTimelineValue(frame.value, `${path}/value`, issues, propertySpec);
  validateTimelineCurve(frame.in, `${path}/in`, issues);
  validateTimelineCurve(frame.out, `${path}/out`, issues);
  validateTimelineCurve(frame.interpolation, `${path}/interpolation`, issues);
  return frame.time;
}

function validateTimelineValue(value: unknown, path: string, issues: ValidationIssue[], propertySpec: ReturnType<typeof animatablePropertySpec>): void {
  if (!isTimelineValue(value)) {
    issues.push(issue(path, "invalid_timeline_value", "Track value must be a JSON-safe timeline value."));
    return;
  }
  if (propertySpec && !validateMotionValueForProperty(propertySpec, value)) {
    issues.push(issue(path, "invalid_timeline_value_for_property", `Track value is not valid for '${propertySpec.property}'.`));
  }
}

function validateTimelineCurve(curve: TimelineCurve | undefined, path: string, issues: ValidationIssue[]): void {
  if (curve === undefined) return;
  if (!curve || typeof curve !== "object" || Array.isArray(curve)) {
    issues.push(issue(path, "invalid_timeline_curve", "Timeline curve must be an object."));
    return;
  }
  if (curve.type === "hold") {
    validateAllowedKeys(curve, path, new Set(["type"]), issues);
    return;
  }
  if (curve.type === "cubicBezier") {
    validateAllowedKeys(curve, path, new Set(["type", "x1", "y1", "x2", "y2"]), issues);
    if (!isFiniteNumber(curve.x1) || curve.x1 < 0 || curve.x1 > 1) issues.push(issue(`${path}/x1`, "invalid_curve_x1", "cubicBezier.x1 must be between 0 and 1."));
    if (!isFiniteNumber(curve.x2) || curve.x2 < 0 || curve.x2 > 1) issues.push(issue(`${path}/x2`, "invalid_curve_x2", "cubicBezier.x2 must be between 0 and 1."));
    if (!isFiniteNumber(curve.y1)) issues.push(issue(`${path}/y1`, "invalid_curve_y1", "cubicBezier.y1 must be a finite number."));
    if (!isFiniteNumber(curve.y2)) issues.push(issue(`${path}/y2`, "invalid_curve_y2", "cubicBezier.y2 must be a finite number."));
    return;
  }
  if (curve.type === "graph") {
    validateAllowedKeys(curve, path, new Set(["type", "points"]), issues);
    if (!Array.isArray(curve.points) || curve.points.length < 2) {
      issues.push(issue(`${path}/points`, "invalid_curve_points", "Graph curve points must contain at least two [x,y] points."));
      return;
    }
    let previousX = Number.NEGATIVE_INFINITY;
    for (const [index, point] of curve.points.entries()) {
      if (!isPoint2(point)) {
        issues.push(issue(`${path}/points/${index}`, "invalid_curve_point", "Graph curve points must be [x,y]."));
        continue;
      }
      if (point[0] < 0 || point[0] > 1) issues.push(issue(`${path}/points/${index}/0`, "invalid_curve_point_x", "Graph curve x values must be between 0 and 1."));
      if (point[0] <= previousX) issues.push(issue(`${path}/points/${index}/0`, "unsorted_curve_points", "Graph curve x values must be strictly increasing."));
      previousX = point[0];
    }
    const first = curve.points[0];
    const last = curve.points[curve.points.length - 1];
    if (isPoint2(first) && first[0] !== 0) issues.push(issue(`${path}/points/0/0`, "invalid_curve_start", "Graph curve must start at x=0."));
    if (isPoint2(last) && last[0] !== 1) issues.push(issue(`${path}/points/${curve.points.length - 1}/0`, "invalid_curve_end", "Graph curve must end at x=1."));
    return;
  }
  issues.push(issue(`${path}/type`, "invalid_timeline_curve_type", "Timeline curve type must be graph, cubicBezier, or hold."));
}

function validateAllowedKeys(value: object, path: string, allowed: Set<string>, issues: ValidationIssue[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push(issue(`${path}/${key}`, "non_kernel_timeline_curve_field", `Timeline curve field '${key}' is not part of this curve type.`));
  }
}

function validateImageFit(value: ImageFit | undefined, path: string, issues: ValidationIssue[]): void {
  if (value !== undefined && value !== "fill" && value !== "contain" && value !== "cover") issues.push(issue(path, "invalid_image_fit", "fit must be 'fill', 'contain', or 'cover'."));
}

function requireNumber(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isFiniteNumber(value)) issues.push(issue(path, "missing_number", "A finite number is required."));
}

function issue(path: string, code: string, message: string, suggestion?: string): ValidationIssue {
  return { path, code, message, ...(suggestion ? { suggestion } : {}) };
}

function warning(path: string, code: string, message: string, suggestion?: string): ValidationWarning {
  return { path, code, message, ...(suggestion ? { suggestion } : {}) };
}
