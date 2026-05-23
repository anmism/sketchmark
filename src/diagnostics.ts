import type { ValidationWarning, VisualDocument, VisualElement } from "./types";
import { elementBox, flattenElements } from "./utils";

export interface VisualDiagnosticReport {
  warnings: ValidationWarning[];
}

export function lintVisualDocument(document: VisualDocument): VisualDiagnosticReport {
  const warnings: ValidationWarning[] = [];
  const elements = flattenElements(document.elements ?? []);
  const boxes = elements
    .map((element) => ({ element, box: elementBox(element) }))
    .filter((item): item is { element: VisualElement; box: NonNullable<ReturnType<typeof elementBox>> } => Boolean(item.box));

  for (const { element, box } of boxes) {
    const path = element.id ? `/elements/${element.id}` : "/elements";
    if (box.x < 0 || box.y < 0 || box.x + box.width > document.canvas.width || box.y + box.height > document.canvas.height) {
      warnings.push({
        path,
        code: "element_outside_canvas",
        message: `Element '${element.id ?? element.type}' extends outside the canvas.`,
        suggestion: "Move it inside the canvas or intentionally clip it with a group/mask later."
      });
    }
    if (element.type === "text" && Number(element.fontSize ?? 16) < 10) {
      warnings.push({
        path,
        code: "tiny_text",
        message: `Text '${element.id ?? ""}' may be unreadable below 10px.`,
        suggestion: "Use fontSize 12 or larger for explainer visuals."
      });
    }
    if (element.type === "text") {
      const containingBox = boxes.find((item) => item.element.type === "rect" && item.element.id !== element.id && pointInside(element.x, element.y, item.box));
      if (containingBox && !boxInside(box, containingBox.box)) {
        warnings.push({
          path,
          code: "text_likely_outside_box",
          message: `Text '${element.id ?? ""}' is anchored inside '${containingBox.element.id ?? "rect"}' but its estimated bounds extend outside.`,
          suggestion: "Move the text explicitly, reduce fontSize, or set maxWidth/wrap intentionally."
        });
      }
      const contrastAgainst = containingBox?.element.fill ?? document.canvas.background ?? "#ffffff";
      const ratio = contrastRatio(String(element.fill ?? "#111827"), String(contrastAgainst));
      if (ratio !== undefined && ratio < 3) {
        warnings.push({
          path,
          code: "low_text_contrast",
          message: `Text '${element.id ?? ""}' may not have enough contrast.`,
          suggestion: "Choose a darker or lighter explicit fill color; diagnostics do not recolor text."
        });
      }
    }
  }

  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left]!;
      const b = boxes[right]!;
      if (a.element.type !== "text" || b.element.type !== "text") continue;
      if (overlaps(a.box, b.box)) {
        warnings.push({
          path: "/elements",
          code: "possible_text_overlap",
          message: `Text may overlap between '${a.element.id ?? a.element.type}' and '${b.element.id ?? b.element.type}'.`,
          suggestion: "Move one text element explicitly; diagnostics do not auto-layout."
        });
      }
    }
  }

  return { warnings };
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function pointInside(x: number, y: number, box: { x: number; y: number; width: number; height: number }): boolean {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

function boxInside(inner: { x: number; y: number; width: number; height: number }, outer: { x: number; y: number; width: number; height: number }): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function contrastRatio(foreground: string, background: string): number | undefined {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  if (!fg || !bg) return undefined;
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function parseHexColor(value: string): [number, number, number] | undefined {
  const text = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(text)) {
    return [
      parseInt(text[1]! + text[1]!, 16),
      parseInt(text[2]! + text[2]!, 16),
      parseInt(text[3]! + text[3]!, 16)
    ];
  }
  if (/^#[0-9a-fA-F]{6}$/.test(text)) {
    return [
      parseInt(text.slice(1, 3), 16),
      parseInt(text.slice(3, 5), 16),
      parseInt(text.slice(5, 7), 16)
    ];
  }
  return undefined;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const values = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * values[0]! + 0.7152 * values[1]! + 0.0722 * values[2]!;
}
