import type { VisualDocument, VisualElement, VisualPatchOperation } from "./types";
import { clone, flattenElements } from "./utils";
import { validateVisualDocument } from "./validate";

export interface PatchResult {
  document: VisualDocument;
}

export function applyVisualPatch(document: VisualDocument, operations: VisualPatchOperation | VisualPatchOperation[]): PatchResult {
  const ops = Array.isArray(operations) ? operations : [operations];
  const next = clone(document);
  next.elements = next.elements ?? [];

  for (const operation of ops) {
    applyOperation(next, operation);
  }

  const result = validateVisualDocument(next);
  if (!result.ok) {
    const first = result.issues[0];
    throw new Error(first ? `${first.path}: ${first.message}` : "Patch produced an invalid document.");
  }

  return { document: next };
}

function applyOperation(document: VisualDocument, operation: VisualPatchOperation): void {
  const elements = document.elements ?? [];
  if (operation.op === "add") {
    if (operation.element.id && findElement(elements, operation.element.id)) throw new Error(`Element '${operation.element.id}' already exists.`);
    const index = clampIndex(operation.index ?? elements.length, elements.length);
    elements.splice(index, 0, clone(operation.element));
    return;
  }

  const target = "id" in operation ? findElement(elements, operation.id) : undefined;
  if (!target) throw new Error(`Element '${"id" in operation ? operation.id : ""}' was not found.`);

  if (operation.op === "update") {
    Object.assign(target.element, clone(operation.set));
    return;
  }
  if (operation.op === "remove") {
    target.parent.splice(target.index, 1);
    return;
  }
  if (operation.op === "replace") {
    target.parent[target.index] = clone(operation.element);
    return;
  }
  if (operation.op === "move") {
    const record = target.element as unknown as Record<string, unknown>;
    for (const key of ["x", "y", "cx", "cy"] as const) {
      if (typeof operation[key] === "number") record[key] = operation[key];
    }
    return;
  }
  if (operation.op === "reorder") {
    const [item] = target.parent.splice(target.index, 1);
    target.parent.splice(clampIndex(operation.index, target.parent.length), 0, item!);
  }
}

function findElement(elements: VisualElement[], id: string): { element: VisualElement; parent: VisualElement[]; index: number } | undefined {
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index]!;
    if (element.id === id) return { element, parent: elements, index };
    if (element.type === "group" && Array.isArray(element.children)) {
      const found = findElement(element.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length, Math.floor(index)));
}
