import type { ClipShape, GradientStop, ImageFit, ImageElement, MaskShape, Paint, Point2, RenderOptions, ResolvedVisualDocument, TextElement, VisualDocument, VisualEffects, VisualElement } from "../types";
import { resolveVisualFrame } from "../normalize";
import { elementBox, isFiniteNumber, isPoint2, textLines } from "../utils";

interface SvgContext {
  defs: string[];
  nextId: number;
}

interface CommonAttrParts {
  id: string;
  opacity: string;
  filter: string;
  clip: string;
  mask: string;
  blend: string;
  transform: string;
}

const DEFAULT_FONT_FAMILY = "Roboto, Arial, sans-serif";
const LEGACY_DEFAULT_FONT_STACKS = new Set([
  "inter,system-ui,sans-serif",
  "system-ui,sans-serif",
  "arial,helvetica,sans-serif"
]);

export function renderToSvg(document: VisualDocument, options: RenderOptions = {}): string {
  return renderResolvedSvg(resolveVisualFrame(document, options.time ?? 0), options);
}

export function renderResolvedSvg(document: ResolvedVisualDocument, options: RenderOptions = {}): string {
  const width = document.canvas.width;
  const height = document.canvas.height;
  const background = document.canvas.background ?? "#ffffff";
  const context: SvgContext = { defs: [], nextId: 0 };
  const elements = document.elements.map((element) => renderElement(element, context)).join("");
  const backdrop = options.transparent ? "" : `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeAttr(background)}"/>`;
  const defs = context.defs.length ? `<defs>${context.defs.join("")}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${defs}${backdrop}${elements}</svg>`;
}

function renderElement(element: VisualElement, context: SvgContext): string {
  const attrs = commonAttrParts(element, context);
  const fill = paintValue(element.fill, context, element.type === "text" ? "#111827" : "none");
  const stroke = strokeAttrs(element, context, "none");

  switch (element.type) {
    case "point":
      return "";
    case "path":
      return `<path${joinCommonAttrs(attrs)} d="${escapeAttr(element.d)}" fill="${fill}"${stroke}${drawAttrs(element)}/>`;
    case "text":
      return renderText(element, joinCommonAttrs(attrs), fill);
    case "image":
      return renderImage(element, attrs, context);
    case "group": {
      const children = element.children.map((child) => renderElement(child, context)).join("");
      return `<g${joinCommonAttrs(attrs)}${groupTransform(element)}>${children}</g>`;
    }
    default:
      return "";
  }
}

function renderImage(element: ImageElement, attrs: CommonAttrParts, context: SvgContext): string {
  const imageClip = imageSourceClipAttr(element, context);
  const wrapped = !!attrs.clip;
  const imageAttrs = joinCommonAttrs(attrs, wrapped ? ["clip", "transform"] : []);
  if (element.source) {
    const scaleX = element.width / element.source.width;
    const scaleY = element.height / element.source.height;
    const imageX = element.x - element.source.x * scaleX;
    const imageY = element.y - element.source.y * scaleY;
    const imageWidth = element.source.imageWidth * scaleX;
    const imageHeight = element.source.imageHeight * scaleY;
    const image = `<image${imageAttrs} href="${escapeAttr(element.src)}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="none"${imageClip}/>`;
    return wrapped ? `<g${attrs.clip}${attrs.transform}>${image}</g>` : image;
  }
  const image = `<image${imageAttrs} href="${escapeAttr(element.src)}" x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" preserveAspectRatio="${imageFit(element.fit)}"${imageClip}/>`;
  return wrapped ? `<g${attrs.clip}${attrs.transform}>${image}</g>` : image;
}

function renderText(element: TextElement, attrs: string, fill: string): string {
  const anchor = element.align === "center" ? "middle" : element.align === "right" ? "end" : "start";
  const fontSize = Number(element.fontSize ?? 16);
  const lineHeight = fontSize * Number(element.lineHeight ?? 1.2);
  const lines = textLines(element);
  const weight = escapeAttr(String(element.weight ?? 400));
  const fontFamily = escapeAttr(resolveFontFamily(element.fontFamily));
  const fontStyle = element.fontStyle ? ` font-style="${escapeAttr(String(element.fontStyle))}"` : "";
  const letterSpacing = isFiniteNumber(element.letterSpacing) ? ` letter-spacing="${element.letterSpacing}"` : "";
  const firstY = textFirstLineY(element, lines.length, fontSize, lineHeight);
  const content = lines.map((line, index) => `<tspan x="${element.x}" y="${firstY + index * lineHeight}">${escapeTextLine(line)}</tspan>`).join("");
  return `<text${attrs} xml:space="preserve" text-anchor="${anchor}" dominant-baseline="middle" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}"${fontStyle}${letterSpacing} fill="${fill}">${content}</text>`;
}

function resolveFontFamily(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return DEFAULT_FONT_FAMILY;
  const normalized = normalizeFontStack(text);
  if (LEGACY_DEFAULT_FONT_STACKS.has(normalized)) return DEFAULT_FONT_FAMILY;
  return text;
}

function normalizeFontStack(value: string): string {
  return value
    .split(",")
    .map((item) => item.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
    .filter(Boolean)
    .join(",");
}

function textFirstLineY(element: TextElement, lineCount: number, fontSize: number, lineHeight: number): number {
  if (element.valign === "middle") return element.y - ((lineCount - 1) * lineHeight) / 2;
  if (element.valign === "bottom") return element.y - fontSize / 2 - (lineCount - 1) * lineHeight;
  return element.y + fontSize / 2;
}

function commonAttrParts(element: VisualElement, context: SvgContext): CommonAttrParts {
  return {
    id: element.id ? ` id="${escapeAttr(element.id)}"` : "",
    opacity: element.opacity === undefined ? "" : ` opacity="${Number(element.opacity)}"`,
    filter: effectFilter(element.effects, context),
    clip: clipPath(element.clip, context),
    mask: maskPath(element.mask, context),
    blend: element.blendMode && element.blendMode !== "normal" ? ` style="mix-blend-mode:${escapeAttr(element.blendMode)}"` : "",
    transform: element.type === "group" ? "" : elementTransform(element)
  };
}

function joinCommonAttrs(parts: CommonAttrParts, omit: Array<keyof CommonAttrParts> = []): string {
  const skipped = new Set(omit);
  return `${skipped.has("id") ? "" : parts.id}${skipped.has("opacity") ? "" : parts.opacity}${skipped.has("filter") ? "" : parts.filter}${skipped.has("clip") ? "" : parts.clip}${skipped.has("mask") ? "" : parts.mask}${skipped.has("blend") ? "" : parts.blend}${skipped.has("transform") ? "" : parts.transform}`;
}

function strokeAttrs(element: VisualElement, context: SvgContext, fallback: string): string {
  const hasStroke = element.stroke !== undefined || element.strokeWidth !== undefined || fallback !== "none";
  if (!hasStroke) return "";
  const stroke = paintValue(element.stroke, context, fallback);
  const width = Number(element.strokeWidth ?? (element.stroke !== undefined || fallback !== "none" ? 1 : 0));
  const cap = element.strokeCap ? ` stroke-linecap="${escapeAttr(element.strokeCap)}"` : "";
  const join = element.strokeJoin ? ` stroke-linejoin="${escapeAttr(element.strokeJoin)}"` : "";
  const miter = isFiniteNumber(element.miterLimit) ? ` stroke-miterlimit="${element.miterLimit}"` : "";
  const dash = element.drawStart !== undefined || element.drawEnd !== undefined ? "" : dashAttrs(element);
  return ` stroke="${stroke}" stroke-width="${width}"${cap}${join}${miter}${dash}`;
}

function dashAttrs(element: VisualElement): string {
  const dash = Array.isArray(element.dashArray) ? ` stroke-dasharray="${element.dashArray.join(" ")}"` : "";
  const offset = isFiniteNumber(element.dashOffset) ? ` stroke-dashoffset="${element.dashOffset}"` : "";
  return `${dash}${offset}`;
}

function drawAttrs(element: VisualElement): string {
  if (element.drawStart === undefined && element.drawEnd === undefined) return "";
  const start = clamp(Number(element.drawStart ?? 0), 0, 1);
  const end = clamp(Number(element.drawEnd ?? 1), 0, 1);
  const visible = Math.max(0, end - start);
  return ` pathLength="1" stroke-dasharray="${visible} 1" stroke-dashoffset="${-start}"`;
}

function paintValue(paint: Paint | undefined, context: SvgContext, fallback: string): string {
  if (paint === undefined) return escapeAttr(fallback);
  if (typeof paint === "string") return escapeAttr(paint);
  const id = nextId(context, paint.type === "linearGradient" ? "linear-gradient" : paint.type === "radialGradient" ? "radial-gradient" : "pattern");
  if (paint.type === "linearGradient") {
    context.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${paint.from[0]}" y1="${paint.from[1]}" x2="${paint.to[0]}" y2="${paint.to[1]}">${gradientStops(paint.stops)}</linearGradient>`);
  } else if (paint.type === "radialGradient") {
    const focus = paint.focus ?? paint.center;
    context.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${paint.center[0]}" cy="${paint.center[1]}" r="${paint.radius}" fx="${focus[0]}" fy="${focus[1]}">${gradientStops(paint.stops)}</radialGradient>`);
  } else {
    const opacity = paint.opacity === undefined ? "" : ` opacity="${Number(paint.opacity)}"`;
    context.defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" x="${Number(paint.x ?? 0)}" y="${Number(paint.y ?? 0)}" width="${paint.width}" height="${paint.height}"><image href="${escapeAttr(paint.src)}" x="0" y="0" width="${paint.width}" height="${paint.height}" preserveAspectRatio="${imageFit(paint.fit)}"${opacity}/></pattern>`);
  }
  return `url(#${id})`;
}

function gradientStops(stops: GradientStop[]): string {
  return stops.map((stop) => {
    const offset = Array.isArray(stop) ? stop[0] : stop.offset;
    const color = Array.isArray(stop) ? stop[1] : stop.color;
    return `<stop offset="${Number(offset) * 100}%" stop-color="${escapeAttr(String(color))}"/>`;
  }).join("");
}

function effectFilter(effects: VisualEffects | undefined, context: SvgContext): string {
  if (!effects) return "";
  const parts: string[] = [];
  if (isFiniteNumber(effects.blur) && effects.blur > 0) parts.push(`<feGaussianBlur stdDeviation="${effects.blur}" result="blur"/>`);
  if (isFiniteNumber(effects.brightness) || isFiniteNumber(effects.contrast)) {
    const brightness = effects.brightness ?? 1;
    const contrast = effects.contrast ?? 1;
    const intercept = 0.5 - contrast * 0.5;
    parts.push(`<feComponentTransfer><feFuncR type="linear" slope="${brightness * contrast}" intercept="${intercept}"/><feFuncG type="linear" slope="${brightness * contrast}" intercept="${intercept}"/><feFuncB type="linear" slope="${brightness * contrast}" intercept="${intercept}"/></feComponentTransfer>`);
  }
  if (isFiniteNumber(effects.saturate)) parts.push(`<feColorMatrix type="saturate" values="${effects.saturate}"/>`);
  if (isFiniteNumber(effects.hueRotate)) parts.push(`<feColorMatrix type="hueRotate" values="${effects.hueRotate}"/>`);
  if (effects.shadow) {
    const opacity = effects.shadow.opacity ?? 1;
    parts.push(`<feDropShadow dx="${effects.shadow.dx}" dy="${effects.shadow.dy}" stdDeviation="${effects.shadow.blur}" flood-color="${escapeAttr(effects.shadow.color)}" flood-opacity="${opacity}"/>`);
  }
  if (!parts.length) return "";
  const id = nextId(context, "filter");
  context.defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">${parts.join("")}</filter>`);
  return ` filter="url(#${id})"`;
}

function clipPath(clip: ClipShape | undefined, context: SvgContext): string {
  if (!clip) return "";
  const id = nextId(context, "clip");
  context.defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${escapeAttr(clip.d)}"/></clipPath>`);
  return ` clip-path="url(#${id})"`;
}

function imageSourceClipAttr(element: ImageElement, context: SvgContext): string {
  if (!element.source) return "";
  const id = nextId(context, "image-clip");
  context.defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}"/></clipPath>`);
  return ` clip-path="url(#${id})"`;
}

function maskPath(mask: MaskShape | undefined, context: SvgContext): string {
  if (!mask) return "";
  const id = nextId(context, "mask");
  const opacity = mask.opacity === undefined ? "" : ` opacity="${Number(mask.opacity)}"`;
  context.defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><path d="${escapeAttr(mask.d)}" fill="#ffffff"${opacity}/></mask>`);
  return ` mask="url(#${id})"`;
}

function elementTransform(element: VisualElement): string {
  const x = element.type === "path" ? Number(element.x ?? 0) : 0;
  const y = element.type === "path" ? Number(element.y ?? 0) : 0;
  const rotation = Number(element.rotation ?? 0);
  const scaleX = Number(element.scaleX ?? element.scale ?? 1);
  const scaleY = Number(element.scaleY ?? element.scale ?? 1);
  if (x === 0 && y === 0 && rotation === 0 && scaleX === 1 && scaleY === 1) return "";
  const origin = originPoint(element);
  const transforms: string[] = [];
  if (x !== 0 || y !== 0) transforms.push(`translate(${x} ${y})`);
  if (rotation !== 0) transforms.push(`rotate(${rotation} ${origin[0]} ${origin[1]})`);
  if (scaleX !== 1 || scaleY !== 1) transforms.push(`translate(${origin[0]} ${origin[1]}) scale(${scaleX} ${scaleY}) translate(${-origin[0]} ${-origin[1]})`);
  return transforms.length ? ` transform="${transforms.join(" ")}"` : "";
}

function groupTransform(element: Extract<VisualElement, { type: "group" }>): string {
  const transforms = [`translate(${element.x} ${element.y})`];
  const rotation = Number(element.rotation ?? 0);
  const scaleX = Number(element.scaleX ?? element.scale ?? 1);
  const scaleY = Number(element.scaleY ?? element.scale ?? 1);
  const origin = groupOrigin(element);
  if (rotation !== 0) transforms.push(`rotate(${rotation} ${origin[0]} ${origin[1]})`);
  if (scaleX !== 1 || scaleY !== 1) transforms.push(`translate(${origin[0]} ${origin[1]}) scale(${scaleX} ${scaleY}) translate(${-origin[0]} ${-origin[1]})`);
  return ` transform="${transforms.join(" ")}"`;
}

function originPoint(element: VisualElement): Point2 {
  if (isPoint2(element.origin)) return element.origin;
  if (element.type === "text" || element.type === "point") {
    return [Number(element.x ?? 0), Number(element.y ?? 0)];
  }
  const box = elementBox(element);
  return box ? [box.x + box.width / 2, box.y + box.height / 2] : [0, 0];
}

function groupOrigin(element: Extract<VisualElement, { type: "group" }>): Point2 {
  if (isPoint2(element.origin)) return [element.origin[0] - element.x, element.origin[1] - element.y];
  return [Number(element.width ?? 0) / 2, Number(element.height ?? 0) / 2];
}

function imageFit(fit: ImageFit | undefined): string {
  if (fit === "contain") return "xMidYMid meet";
  if (fit === "cover") return "xMidYMid slice";
  return "none";
}

function nextId(context: SvgContext, prefix: string): string {
  const id = `sketchmark-${prefix}-${context.nextId}`;
  context.nextId += 1;
  return id;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeTextLine(value: string): string {
  return escapeText(value.replace(/\t/g, "    ")).replace(/ /g, "&#160;");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
