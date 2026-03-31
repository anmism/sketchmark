// ============================================================
// Shape Registry — Strategy pattern for extensible shapes
// ============================================================

import type { ShapeDefinition } from "./types";

const shapes = new Map<string, ShapeDefinition>();

export function registerShape(name: string, def: ShapeDefinition): void {
  shapes.set(name, def);
}

export function getShape(name: string): ShapeDefinition | undefined {
  return shapes.get(name);
}

export function hasShape(name: string): boolean {
  return shapes.has(name);
}
