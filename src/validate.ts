import type { ClipShape, ImageFit, ImageElement, MaskShape, Paint, ValidationIssue, ValidationResult, ValidationWarning, VisualDocument, VisualElement, VisualEffects } from "./types";
import type { ShapeDefinition, ShapeValidationContext } from "./shapes";
import { getInternalShapeDefinition, isFollowableAuthoringShape } from "./shapes";
import { ANCHORS, COMPOUND_TYPES, elementBox, flattenElements, isFiniteNumber, isPoint2, isPoint2Array, parseReference } from "./utils";

const POSITION_ANIMATION_PROPERTIES = new Set(["positionX", "positionY", "positionZ"]);

export function validateVisualDocument(document: VisualDocument): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationWarning[] = [];

  if (!document || typeof document !== "object") {
    issues.push(issue("/", "invalid_document", "Document must be an object."));
    return { ok: false, issues, warnings };
  }

  if (document.version !== 1) issues.push(issue("/version", "invalid_version", "Document version must be 1."));
  if (!document.canvas || typeof document.canvas !== "object") {
    issues.push(issue("/canvas", "missing_canvas", "Document must define canvas."));
  } else {
    if (!isFiniteNumber(document.canvas.width)) issues.push(issue("/canvas/width", "missing_canvas_width", "Canvas width must be a number."));
    if (!isFiniteNumber(document.canvas.height)) issues.push(issue("/canvas/height", "missing_canvas_height", "Canvas height must be a number."));
    if (document.canvas.background !== undefined && typeof document.canvas.background !== "string") {
      issues.push(issue(
        "/canvas/background",
        "invalid_canvas_background",
        "Canvas background must be a color string.",
        "For gradient, pattern, or image backgrounds, keep canvas.background as a fallback color string and add a full-canvas rect/image as the first element."
      ));
    }
    if (document.canvas.space === "3d" && document.canvas.renderer !== "three") {
      issues.push(issue("/canvas/renderer", "3d_requires_three", "3D documents must set canvas.renderer to 'three'."));
    }
    if (document.canvas.renderer === "three" && document.canvas.space !== "3d") {
      issues.push(issue("/canvas/space", "three_requires_3d", "Three renderer requires canvas.space to be '3d'."));
    }
  }

  const elements = document.elements ?? [];
  if (document.elements !== undefined && !Array.isArray(elements)) issues.push(issue("/elements", "invalid_elements", "Document elements must be an array."));

  const allElements = Array.isArray(elements) ? flattenElements(elements) : [];
  const ids = new Map<string, VisualElement>();
  for (const [index, element] of allElements.entries()) {
    const path = `/elements/${index}`;
    if (typeof element.id === "string") {
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(element.id)) {
        issues.push(issue(`${path}/id`, "invalid_id", `Invalid id '${element.id}'. Use letters, numbers, '_' or '-'.`));
      } else if (ids.has(element.id)) {
        issues.push(issue(`${path}/id`, "duplicate_id", `Duplicate element id '${element.id}'.`));
      } else {
        ids.set(element.id, element);
      }
    }
  }

  for (const [index, element] of allElements.entries()) {
    validateElement(element, `/elements/${index}`, document, ids, issues, warnings);
  }

  for (const [sceneId, scene] of Object.entries(document.scenes ?? {})) {
    if (!Array.isArray(scene.elements)) issues.push(issue(`/scenes/${sceneId}/elements`, "invalid_scene_elements", `Scene '${sceneId}' elements must be an array.`));
    const sceneDoc = { ...document, canvas: { ...document.canvas, ...(scene.canvas ?? {}) }, elements: scene.elements, scenes: undefined, sequences: undefined };
    const sceneResult = validateVisualDocument(sceneDoc as VisualDocument);
    issues.push(...sceneResult.issues.map((item) => ({ ...item, path: `/scenes/${sceneId}${item.path}` })));
    warnings.push(...sceneResult.warnings.map((item) => ({ ...item, path: `/scenes/${sceneId}${item.path}` })));
  }

  for (const [sequenceId, sequence] of Object.entries(document.sequences ?? {})) {
    if (!Array.isArray(sequence.clips)) issues.push(issue(`/sequences/${sequenceId}/clips`, "invalid_sequence_clips", `Sequence '${sequenceId}' clips must be an array.`));
    for (const [index, clip] of (sequence.clips ?? []).entries()) {
      if (!document.scenes?.[clip.scene]) issues.push(issue(`/sequences/${sequenceId}/clips/${index}/scene`, "unknown_sequence_scene", `Unknown scene '${clip.scene}' in sequence '${sequenceId}'.`));
      if (!isFiniteNumber(clip.duration) || clip.duration <= 0) issues.push(issue(`/sequences/${sequenceId}/clips/${index}/duration`, "invalid_clip_duration", "Clip duration must be a positive number."));
      validateTransition(clip.transition, `/sequences/${sequenceId}/clips/${index}/transition`, issues);
    }
  }

  return { ok: issues.length === 0, issues, warnings };
}

function validateTransition(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value === undefined) return;
  if (value === "cut" || value === "fade") return;
  if (!value || typeof value !== "object") {
    issues.push(issue(path, "invalid_transition", "Transition must be 'cut', 'fade', or an object with type/duration."));
    return;
  }
  const transition = value as { type?: unknown; duration?: unknown };
  if (transition.type !== "cut" && transition.type !== "fade") {
    issues.push(issue(`${path}/type`, "invalid_transition_type", "Transition type must be 'cut' or 'fade'."));
  }
  if (transition.duration !== undefined && (!isFiniteNumber(transition.duration) || transition.duration < 0)) {
    issues.push(issue(`${path}/duration`, "invalid_transition_duration", "Transition duration must be a non-negative number."));
  }
}

function validateElement(
  element: VisualElement,
  path: string,
  document: VisualDocument,
  ids: Map<string, VisualElement>,
  issues: ValidationIssue[],
  warnings: ValidationWarning[]
): void {
  if (!element || typeof element !== "object") {
    issues.push(issue(path, "invalid_element", "Element must be an object."));
    return;
  }

  const type = String(element.type || "");
  if (COMPOUND_TYPES.has(type)) {
    issues.push(issue(`${path}/type`, "compound_type_not_allowed", `Compound type '${type}' is not valid in canonical JSON. Use builders to expand it into primitives first.`));
    return;
  }
  const definition = getInternalShapeDefinition(type);
  if (!definition) {
    issues.push(issue(`${path}/type`, "unsupported_type", `Unsupported primitive type '${type}'.`));
    return;
  }
  if (definition.kind === "3d" && (document.canvas.space !== "3d" || document.canvas.renderer !== "three")) {
    issues.push(issue(path, "three_primitive_requires_three_canvas", `Primitive '${type}' requires canvas.space '3d' and canvas.renderer 'three'.`));
  }

  const context = createShapeValidationContext(document, path, ids, issues, warnings);
  definition.validateGeometry(element, context);
  validateStyle(element, path, issues);
  validateAnimation(element, path, definition, issues);
  definition.validateReferences?.(element, context);
  definition.validateWarnings?.(element, context);
}

function createShapeValidationContext(
  document: VisualDocument,
  path: string,
  ids: Map<string, VisualElement>,
  issues: ValidationIssue[],
  warnings: ValidationWarning[]
): ShapeValidationContext {
  return {
    document,
    path,
    ids,
    issues,
    warnings,
    addIssue(issuePath, code, message, suggestion) {
      issues.push(issue(issuePath, code, message, suggestion));
    },
    addWarning(warningPath, code, message, suggestion) {
      warnings.push(warning(warningPath, code, message, suggestion));
    },
    requireNumber(value, numberPath) {
      requireNumber(value, numberPath, issues);
    },
    requirePoint2(value, pointPath, code, message) {
      if (!isPoint2(value)) issues.push(issue(pointPath, code, message));
    },
    requirePoint2Array(value, minLength, pointPath, code, message) {
      if (!isPoint2Array(value, minLength)) issues.push(issue(pointPath, code, message));
    },
    requirePoint3(value, pointPath, code, message) {
      if (!isPoint3(value)) issues.push(issue(pointPath, code, message));
    },
    validateEndpoint(value, endpointPath) {
      validateEndpoint(value, endpointPath, ids, issues);
    },
    validateImageOptions(element) {
      validateImageOptions(element as ImageElement, path, issues);
    },
    isFollowable(type) {
      return isFollowableAuthoringShape(type);
    }
  };
}

function validateStyle(element: VisualElement, path: string, issues: ValidationIssue[]): void {
  validatePaint(element.fill, `${path}/fill`, issues);
  validatePaint(element.stroke, `${path}/stroke`, issues);

  if (element.strokeCap !== undefined && !["butt", "round", "square"].includes(String(element.strokeCap))) {
    issues.push(issue(`${path}/strokeCap`, "invalid_stroke_cap", "strokeCap must be 'butt', 'round', or 'square'."));
  }
  if (element.strokeJoin !== undefined && !["miter", "round", "bevel"].includes(String(element.strokeJoin))) {
    issues.push(issue(`${path}/strokeJoin`, "invalid_stroke_join", "strokeJoin must be 'miter', 'round', or 'bevel'."));
  }
  if (element.miterLimit !== undefined && !isFiniteNumber(element.miterLimit)) issues.push(issue(`${path}/miterLimit`, "invalid_miter_limit", "miterLimit must be a finite number."));
  if (element.dashOffset !== undefined && !isFiniteNumber(element.dashOffset)) issues.push(issue(`${path}/dashOffset`, "invalid_dash_offset", "dashOffset must be a finite number."));
  if (element.drawStart !== undefined && (!isFiniteNumber(element.drawStart) || element.drawStart < 0 || element.drawStart > 1)) {
    issues.push(issue(`${path}/drawStart`, "invalid_draw_start", "drawStart must be a number between 0 and 1."));
  }
  if (element.drawEnd !== undefined && (!isFiniteNumber(element.drawEnd) || element.drawEnd < 0 || element.drawEnd > 1)) {
    issues.push(issue(`${path}/drawEnd`, "invalid_draw_end", "drawEnd must be a number between 0 and 1."));
  }
  if (isFiniteNumber(element.drawStart) && isFiniteNumber(element.drawEnd) && element.drawStart > element.drawEnd) {
    issues.push(issue(`${path}/drawStart`, "invalid_draw_range", "drawStart must be less than or equal to drawEnd."));
  }
  if (element.rotation !== undefined && !isFiniteNumber(element.rotation)) issues.push(issue(`${path}/rotation`, "invalid_rotation", "rotation must be a finite number in degrees."));
  if (element.scale !== undefined && !isFiniteNumber(element.scale)) issues.push(issue(`${path}/scale`, "invalid_scale", "scale must be a finite number."));
  if (element.scaleX !== undefined && !isFiniteNumber(element.scaleX)) issues.push(issue(`${path}/scaleX`, "invalid_scale_x", "scaleX must be a finite number."));
  if (element.scaleY !== undefined && !isFiniteNumber(element.scaleY)) issues.push(issue(`${path}/scaleY`, "invalid_scale_y", "scaleY must be a finite number."));
  if (element.origin !== undefined && !(typeof element.origin === "string" && ANCHORS.has(element.origin)) && !isPoint2(element.origin)) {
    issues.push(issue(`${path}/origin`, "invalid_origin", "origin must be an anchor name or [x,y]."));
  }
  validateEffects(element.effects, `${path}/effects`, issues);
  validateClip(element.clip, `${path}/clip`, issues);
  validateMask(element.mask, `${path}/mask`, issues);
}

function validatePaint(value: Paint | undefined, path: string, issues: ValidationIssue[]): void {
  if (value === undefined || typeof value === "string") return;
  if (!value || typeof value !== "object") {
    issues.push(issue(path, "invalid_paint", "Paint must be a color string or a structured gradient object."));
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
    if (!isFiniteNumber(value.radius) || value.radius < 0) issues.push(issue(`${path}/radius`, "invalid_gradient_radius", "Radial gradient radius must be a non-negative number."));
    if (value.focus !== undefined && !isPoint2(value.focus)) issues.push(issue(`${path}/focus`, "invalid_gradient_focus", "Radial gradient focus must be [x,y]."));
    validateGradientStops(value.stops, `${path}/stops`, issues);
    return;
  }
  if (value.type === "pattern") {
    if (typeof value.src !== "string" || !value.src) issues.push(issue(`${path}/src`, "invalid_pattern_src", "Pattern src must be a string."));
    if (!isFiniteNumber(value.width) || value.width <= 0) issues.push(issue(`${path}/width`, "invalid_pattern_width", "Pattern width must be a positive number."));
    if (!isFiniteNumber(value.height) || value.height <= 0) issues.push(issue(`${path}/height`, "invalid_pattern_height", "Pattern height must be a positive number."));
    if (value.x !== undefined && !isFiniteNumber(value.x)) issues.push(issue(`${path}/x`, "invalid_pattern_x", "Pattern x must be a finite number."));
    if (value.y !== undefined && !isFiniteNumber(value.y)) issues.push(issue(`${path}/y`, "invalid_pattern_y", "Pattern y must be a finite number."));
    validateImageFit(value.fit, `${path}/fit`, issues);
    if (value.opacity !== undefined && (!isFiniteNumber(value.opacity) || value.opacity < 0 || value.opacity > 1)) {
      issues.push(issue(`${path}/opacity`, "invalid_pattern_opacity", "Pattern opacity must be between 0 and 1."));
    }
    return;
  }
  issues.push(issue(`${path}/type`, "invalid_paint_type", "Paint object type must be 'linearGradient', 'radialGradient', or 'pattern'."));
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
    } else {
      requireNumber(shadow.dx, `${path}/shadow/dx`, issues);
      requireNumber(shadow.dy, `${path}/shadow/dy`, issues);
      requireNumber(shadow.blur, `${path}/shadow/blur`, issues);
      if (typeof shadow.color !== "string") issues.push(issue(`${path}/shadow/color`, "invalid_shadow_color", "shadow color must be a string."));
      if (shadow.opacity !== undefined && (!isFiniteNumber(shadow.opacity) || shadow.opacity < 0 || shadow.opacity > 1)) {
        issues.push(issue(`${path}/shadow/opacity`, "invalid_shadow_opacity", "shadow opacity must be between 0 and 1."));
      }
    }
  }
}

function validateClip(value: ClipShape | undefined, path: string, issues: ValidationIssue[]): void {
  validateShape(value, path, "clip", issues);
}

function validateMask(value: MaskShape | undefined, path: string, issues: ValidationIssue[]): void {
  validateShape(value, path, "mask", issues);
  if (value && typeof value === "object" && value.opacity !== undefined && (!isFiniteNumber(value.opacity) || value.opacity < 0 || value.opacity > 1)) {
    issues.push(issue(`${path}/opacity`, "invalid_mask_opacity", "mask opacity must be between 0 and 1."));
  }
}

function validateShape(value: ClipShape | MaskShape | undefined, path: string, label: string, issues: ValidationIssue[]): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object") {
    issues.push(issue(path, `invalid_${label}`, `${label} must be a rect, circle, or path object.`));
    return;
  }
  if (value.type === "rect") {
    requireNumber(value.x, `${path}/x`, issues);
    requireNumber(value.y, `${path}/y`, issues);
    requireNumber(value.width, `${path}/width`, issues);
    requireNumber(value.height, `${path}/height`, issues);
    return;
  }
  if (value.type === "circle") {
    requireNumber(value.cx, `${path}/cx`, issues);
    requireNumber(value.cy, `${path}/cy`, issues);
    requireNumber(value.radius, `${path}/radius`, issues);
    return;
  }
  if (value.type === "path") {
    if (typeof value.d !== "string" || !value.d.trim()) issues.push(issue(`${path}/d`, `missing_${label}_path`, `Path ${label} requires d.`));
    return;
  }
  issues.push(issue(`${path}/type`, `invalid_${label}_type`, `${label} type must be 'rect', 'circle', or 'path'.`));
}

function validateImageOptions(element: ImageElement, path: string, issues: ValidationIssue[]): void {
  validateImageFit(element.fit, `${path}/fit`, issues);
  if (!element.source) return;
  requireNumber(element.source.x, `${path}/source/x`, issues);
  requireNumber(element.source.y, `${path}/source/y`, issues);
  requireNumber(element.source.width, `${path}/source/width`, issues);
  requireNumber(element.source.height, `${path}/source/height`, issues);
  requireNumber(element.source.imageWidth, `${path}/source/imageWidth`, issues);
  requireNumber(element.source.imageHeight, `${path}/source/imageHeight`, issues);
  if (isFiniteNumber(element.source.width) && element.source.width <= 0) issues.push(issue(`${path}/source/width`, "invalid_source_width", "Image source width must be positive."));
  if (isFiniteNumber(element.source.height) && element.source.height <= 0) issues.push(issue(`${path}/source/height`, "invalid_source_height", "Image source height must be positive."));
  if (isFiniteNumber(element.source.imageWidth) && element.source.imageWidth <= 0) issues.push(issue(`${path}/source/imageWidth`, "invalid_source_image_width", "Image source imageWidth must be positive."));
  if (isFiniteNumber(element.source.imageHeight) && element.source.imageHeight <= 0) issues.push(issue(`${path}/source/imageHeight`, "invalid_source_image_height", "Image source imageHeight must be positive."));
}

function validateImageFit(value: ImageFit | undefined, path: string, issues: ValidationIssue[]): void {
  if (value !== undefined && value !== "fill" && value !== "contain" && value !== "cover") {
    issues.push(issue(path, "invalid_image_fit", "fit must be 'fill', 'contain', or 'cover'."));
  }
}

function validateAnimation(
  element: VisualElement,
  path: string,
  definition: ShapeDefinition,
  issues: ValidationIssue[]
): void {
  if (!element.animate) return;
  const animatable = new Set(definition.animatable);
  for (const [property, animation] of Object.entries(element.animate)) {
    if (!animatable.has(property)) {
      issues.push(issue(`${path}/animate/${property}`, "unsupported_animation_property", `Property '${property}' is not animatable in the primitive JSON core.`));
      continue;
    }
    const hasStaticValue = property in element || (POSITION_ANIMATION_PROPERTIES.has(property) && "position" in element);
    if (!hasStaticValue && property !== "opacity") {
      issues.push(issue(`${path}/animate/${property}`, "missing_static_animation_property", `Animated property '${property}' must also have a static value.`));
    }
    if (!animation || typeof animation !== "object") {
      issues.push(issue(`${path}/animate/${property}`, "invalid_animation", "Animation must be an object with from/to or keyframes."));
      continue;
    }
    if (Array.isArray(animation)) {
      issues.push(issue(`${path}/animate/${property}`, "invalid_animation", "Animation must be an object. Use { keyframes: [...] }, not a raw keyframe array."));
      continue;
    }

    const values = [animation.from, animation.to].filter((value) => value !== undefined);
    let hasTimeline = animation.from !== undefined || animation.to !== undefined;

    if (animation.duration !== undefined && !isFiniteNumber(animation.duration)) {
      issues.push(issue(`${path}/animate/${property}/duration`, "invalid_animation_duration", "Animation duration must be a finite number."));
    }
    if (animation.delay !== undefined && !isFiniteNumber(animation.delay)) {
      issues.push(issue(`${path}/animate/${property}/delay`, "invalid_animation_delay", "Animation delay must be a finite number."));
    }

    if (animation.keyframes !== undefined) {
      if (!Array.isArray(animation.keyframes)) {
        issues.push(issue(`${path}/animate/${property}/keyframes`, "invalid_animation_keyframes", "Animation keyframes must be an array of [time,value] pairs."));
      } else {
        hasTimeline = hasTimeline || animation.keyframes.length > 0;
        for (const [index, frame] of animation.keyframes.entries()) {
          if (!Array.isArray(frame) || frame.length !== 2) {
            issues.push(issue(`${path}/animate/${property}/keyframes/${index}`, "invalid_animation_keyframe", "Animation keyframe must be [time,value]."));
            continue;
          }
          if (!isFiniteNumber(frame[0])) {
            issues.push(issue(`${path}/animate/${property}/keyframes/${index}/0`, "invalid_animation_keyframe_time", "Animation keyframe time must be a finite number of seconds."));
          }
          values.push(frame[1]);
        }
      }
    }

    if (!hasTimeline) {
      issues.push(issue(`${path}/animate/${property}`, "invalid_animation", "Animation must define from/to or keyframes."));
      continue;
    }

    for (const value of values) {
      if ((property === "fill" || property === "stroke") && typeof value === "string") continue;
      if (!isFiniteNumber(value)) {
        issues.push(issue(`${path}/animate/${property}`, "invalid_animation_value", `Animation values for '${property}' must be finite numbers${property === "fill" || property === "stroke" ? " or color strings" : ""}.`));
        break;
      }
    }
  }
}

function validateEndpoint(value: unknown, path: string, ids: Map<string, VisualElement>, issues: ValidationIssue[]): void {
  if (isPoint2(value)) return;
  if (typeof value !== "string") {
    issues.push(issue(path, "invalid_endpoint", "Endpoint must be [x,y] or a reference like 'box.right'."));
    return;
  }
  const { id, anchor } = parseReference(value);
  const target = ids.get(id);
  if (!target) {
    issues.push(issue(path, "unknown_reference", `Unknown reference '${value}'.`));
    return;
  }
  if (!ANCHORS.has(anchor)) issues.push(issue(path, "invalid_anchor", `Unknown anchor '${anchor}'.`));
  if (!elementBox(target)) {
    issues.push(issue(path, "unresolvable_reference", `Reference '${value}' points to an element without a resolvable 2D box.`));
  }
}

function requireNumber(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isFiniteNumber(value)) issues.push(issue(path, "missing_number", "A finite number is required."));
}

function isPoint3(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && isFiniteNumber(value[0]) && isFiniteNumber(value[1]) && isFiniteNumber(value[2]);
}

function issue(path: string, code: string, message: string, suggestion?: string): ValidationIssue {
  return { path, code, message, ...(suggestion ? { suggestion } : {}) };
}

function warning(path: string, code: string, message: string, suggestion?: string): ValidationWarning {
  return { path, code, message, ...(suggestion ? { suggestion } : {}) };
}
