import type { ResolvedVisualDocument, VisualDocument } from "./types";
import { resolveVisualFrame } from "./normalize";
import { clone } from "./utils";

export function listScenes(document: VisualDocument): string[] {
  return Object.keys(document.scenes ?? {});
}

export function documentForScene(document: VisualDocument, sceneId: string): VisualDocument {
  const scene = document.scenes?.[sceneId];
  if (!scene) throw new Error(`Unknown scene '${sceneId}'.`);
  return {
    ...clone(document),
    canvas: { ...document.canvas, ...(scene.canvas ?? {}) },
    elements: clone(scene.elements),
    scenes: undefined,
    sequences: undefined
  };
}

export function resolvedFrameForScene(document: VisualDocument, sceneId: string, time = 0): ResolvedVisualDocument {
  return resolveVisualFrame(documentForScene(document, sceneId), time);
}
