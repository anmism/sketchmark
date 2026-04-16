import type { SceneNode } from "../../scene";
import { NODE } from "../../config";

const MEDIA_LABEL_SHAPES = new Set(["icon", "image", "line"]);

export function usesBottomLabelStrip(shape: string): boolean {
  return MEDIA_LABEL_SHAPES.has(shape);
}

export function getBottomLabelStripHeight(
  node: Pick<SceneNode, "shape" | "label">,
): number {
  return usesBottomLabelStrip(node.shape) && node.label ? NODE.mediaLabelH : 0;
}

export function getBottomLabelContentHeight(
  node: Pick<SceneNode, "shape" | "label" | "h">,
): number {
  return node.h - getBottomLabelStripHeight(node);
}

export function getBottomLabelCenterY(
  node: Pick<SceneNode, "shape" | "label" | "y" | "h">,
): number {
  const stripH = getBottomLabelStripHeight(node);
  return stripH > 0 ? node.y + node.h - stripH / 2 : node.y + node.h / 2;
}
