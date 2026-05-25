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
        suggestion: "Move it inside the canvas or intentionally clip it."
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
