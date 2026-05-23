import type { KernelElement, VisualElement } from "../types";
import { builtInShapeLowerers } from "./builtins";
import type { ShapeDefinition, ShapeLoweringContext } from "./types";

const shapeLowerers = new Map<string, ShapeDefinition>();

for (const lowerer of builtInShapeLowerers) registerInternalShapeLowerer(lowerer);

export function registerInternalShapeLowerer(lowerer: ShapeDefinition): void {
  shapeLowerers.set(lowerer.type, lowerer);
}

export function getInternalShapeLowerer(type: string): ShapeDefinition | undefined {
  return shapeLowerers.get(type);
}

export function getInternalShapeDefinition(type: string): ShapeDefinition | undefined {
  return getInternalShapeLowerer(type);
}

export function lowerAuthoringElement(element: VisualElement, context: ShapeLoweringContext): KernelElement | KernelElement[] {
  const lowerer = getInternalShapeLowerer(element.type);
  return lowerer ? lowerer.lower(element, context) : [];
}

export function registeredAuthoringShapeTypes(): string[] {
  return [...shapeLowerers.keys()].sort();
}

export function registeredAuthoringShapeDefinitions(): ShapeDefinition[] {
  return [...shapeLowerers.values()];
}

export function isFollowableAuthoringShape(type: string): boolean {
  return Boolean(shapeLowerers.get(type)?.followable);
}
