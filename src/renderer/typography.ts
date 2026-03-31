// ============================================================
// Shared Typography Resolution
//
// Extracts the repeated pattern of resolving fontSize, fontWeight,
// textColor, font, textAlign, letterSpacing, lineHeight, padding,
// verticalAlign from a style object with entity-specific defaults.
// ============================================================

import { resolveStyleFont } from "./shared";
import { TYPOGRAPHY } from "../config";

export interface TypographyConfig {
  fontSize: number;
  fontWeight: number | string;
  textColor: string;
  font: string;
  textAlign: "left" | "center" | "right";
  textAnchor: "start" | "middle" | "end";
  letterSpacing: number | undefined;
  lineHeight: number;
  verticalAlign: "top" | "middle" | "bottom";
  padding: number;
}

export interface TypographyDefaults {
  fontSize?: number;
  fontWeight?: number | string;
  textColor?: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;       // multiplier (e.g. 1.3)
  padding?: number;
  verticalAlign?: "top" | "middle" | "bottom";
}

const ANCHOR_MAP: Record<string, "start" | "middle" | "end"> = {
  left: "start",
  center: "middle",
  right: "end",
};

export function resolveTypography(
  style: Record<string, unknown> | undefined,
  defaults: TypographyDefaults,
  diagramFont: string,
  fallbackTextColor: string,
): TypographyConfig {
  const s = (style ?? {}) as Record<string, unknown>;

  const fontSize = Number(s.fontSize ?? defaults.fontSize ?? TYPOGRAPHY.defaultFontSize);
  const fontWeight = (s.fontWeight ?? defaults.fontWeight ?? TYPOGRAPHY.defaultFontWeight) as number | string;
  const textColor = String(s.color ?? defaults.textColor ?? fallbackTextColor);
  const font = resolveStyleFont(s, diagramFont);
  const textAlign = String(s.textAlign ?? defaults.textAlign ?? TYPOGRAPHY.defaultAlign) as "left" | "center" | "right";
  const textAnchor = ANCHOR_MAP[textAlign] ?? "middle";
  const letterSpacing = s.letterSpacing as number | undefined;
  const lhMult = Number(s.lineHeight ?? defaults.lineHeight ?? TYPOGRAPHY.defaultLineHeight);
  const lineHeight = lhMult * fontSize;
  const verticalAlign = String(s.verticalAlign ?? defaults.verticalAlign ?? TYPOGRAPHY.defaultVAlign) as "top" | "middle" | "bottom";
  const padding = Number(s.padding ?? defaults.padding ?? TYPOGRAPHY.defaultPadding);

  return {
    fontSize, fontWeight, textColor, font,
    textAlign, textAnchor, letterSpacing,
    lineHeight, verticalAlign, padding,
  };
}

/** Compute the x coordinate for text based on alignment within a box. */
export function computeTextX(
  typo: TypographyConfig,
  x: number,
  w: number,
): number {
  return typo.textAlign === "left"  ? x + typo.padding
       : typo.textAlign === "right" ? x + w - typo.padding
       : x + w / 2;
}

/** Compute the vertical center for a block of text lines within a box. */
export function computeTextCY(
  typo: TypographyConfig,
  y: number,
  h: number,
  lineCount: number,
  topOffset?: number,
): number {
  const pad = typo.padding;
  const top = y + (topOffset ?? pad);
  const bottom = y + h - pad;
  const mid = (top + bottom) / 2;
  const blockH = (lineCount - 1) * typo.lineHeight;

  if (typo.verticalAlign === "top")    return top + blockH / 2;
  if (typo.verticalAlign === "bottom") return bottom - blockH / 2;
  return mid;
}
