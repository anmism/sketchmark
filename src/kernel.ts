import type {
  KernelElement,
  KernelVisualDocument,
  ResolvedVisualDocument,
  ValidationResult,
  VisualDocument,
  VisualElement
} from "./types";
import { normalizeVisualDocument, resolveVisualFrame, type NormalizeOptions } from "./normalize";
import { clone } from "./utils";
import { lowerAuthoringElement } from "./shapes";

export interface LowerOptions extends NormalizeOptions {}

const KERNEL_2D_TYPES = new Set(["group", "path", "text", "image", "point"]);
const KERNEL_3D_TYPES = new Set(["group3d", "mesh3d", "line3d", "text3d", "point3d", "light"]);

export function lowerVisualDocument(document: VisualDocument, options: LowerOptions = {}): KernelVisualDocument {
  return lowerResolvedVisualDocument(normalizeVisualDocument(document, options));
}

export function resolveKernelFrame(document: VisualDocument, time = 0): KernelVisualDocument {
  return lowerResolvedVisualDocument(resolveVisualFrame(document, time));
}

export function lowerResolvedVisualDocument(document: ResolvedVisualDocument): KernelVisualDocument {
  return {
    version: document.version,
    canvas: clone(document.canvas),
    imports: cloneOptional(document.imports),
    assets: cloneOptional(document.assets),
    exports: cloneOptional(document.exports),
    elements: lowerElements(document.elements ?? [])
  };
}

export function validateKernelVisualDocument(document: KernelVisualDocument): ValidationResult {
  const issues: ValidationResult["issues"] = [];
  const visit = (element: KernelElement, path: string): void => {
    if (!KERNEL_2D_TYPES.has(element.type) && !KERNEL_3D_TYPES.has(element.type)) {
      issues.push({ path, code: "unsupported_kernel_type", message: `Kernel element type '${element.type}' is not supported.` });
      return;
    }
    if (element.type === "path" && typeof element.d !== "string") {
      issues.push({ path, code: "missing_kernel_path", message: "Kernel path requires string 'd'." });
    }
    if (element.type === "text" && (!isFiniteNumber(element.x) || !isFiniteNumber(element.y))) {
      issues.push({ path, code: "missing_kernel_text_position", message: "Kernel text requires numeric x and y." });
    }
    if (element.type === "image" && (!isFiniteNumber(element.x) || !isFiniteNumber(element.y) || !isFiniteNumber(element.width) || !isFiniteNumber(element.height))) {
      issues.push({ path, code: "missing_kernel_image_box", message: "Kernel image requires numeric x, y, width, and height." });
    }
    if (element.type === "point" && (!isFiniteNumber(element.x) || !isFiniteNumber(element.y))) {
      issues.push({ path, code: "missing_kernel_point", message: "Kernel point requires numeric x and y." });
    }
    if (element.type === "mesh3d" && (!Array.isArray(element.vertices) || !Array.isArray(element.indices))) {
      issues.push({ path, code: "missing_kernel_mesh", message: "Kernel mesh3d requires vertices and indices." });
    }
    if ((element.type === "group" || element.type === "group3d") && Array.isArray(element.children)) {
      element.children.forEach((child, index) => visit(child, `${path}/children/${index}`));
    }
  };
  (document.elements ?? []).forEach((element, index) => visit(element, `/elements/${index}`));
  return { ok: issues.length === 0, issues, warnings: [] };
}

function lowerElements(elements: VisualElement[]): KernelElement[] {
  return elements.flatMap((element) => lowerElement(element));
}

function lowerElement(element: VisualElement): KernelElement | KernelElement[] {
  return lowerAuthoringElement(element, { lowerElements });
}

function cloneOptional<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
