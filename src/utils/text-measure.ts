// ============================================================
// sketchmark — Text Measurement (pretext-powered)
//
// Standalone module with no dependency on layout or renderer,
// safe to import from any layer without circular deps.
// ============================================================

import { prepareWithSegments, layoutWithLines, walkLineRanges, layoutNextLine } from '@chenglou/pretext';
import type { LayoutCursor } from '@chenglou/pretext';
export { prepareWithSegments, layoutWithLines };

/** Build a CSS font shorthand from fontSize, fontWeight and fontFamily */
export function buildFontStr(fontSize: number, fontWeight: number | string, fontFamily: string): string {
  return `${fontWeight} ${fontSize}px ${fontFamily}`;
}

/** Measure the natural (unwrapped) width of text using pretext */
export function measureTextWidth(text: string, font: string): number {
  const prepared = prepareWithSegments(text, font);
  let maxW = 0;
  walkLineRanges(prepared, 1e6, line => { if (line.width > maxW) maxW = line.width; });
  return maxW;
}

/** Word-wrap text using pretext, with fallback to character approximation */
export function wrapText(text: string, maxWidth: number, fontSize: number, font?: string): string[] {
  if (font) {
    try {
      const prepared = prepareWithSegments(text, font);
      const lineHeight = fontSize * 1.5;
      const { lines } = layoutWithLines(prepared, maxWidth, lineHeight);
      return lines.length ? lines.map(l => l.text) : [text];
    } catch (_) {
      // fall through to approximation
    }
  }
  // Fallback: character-width approximation
  const charWidth = fontSize * 0.55;
  const maxChars  = Math.floor(maxWidth / charWidth);
  const words     = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

// ── Shape-aware text wrapping ─────────────────────────────────────────
// Uses layoutNextLine() to give each line a different maxWidth based on
// its vertical position within the shape.

export interface ShapeLine {
  text: string;
  width: number;
}

/** Returns the chord width at vertical fraction t (0=top, 1=bottom) for a circle/ellipse */
function circleChordWidth(w: number, h: number, t: number): number {
  // Ellipse equation: x²/a² + y²/b² = 1, where y = b*(2t-1)
  const a = w / 2, b = h / 2;
  const y = b * (2 * t - 1);
  const x2 = a * a * (1 - (y * y) / (b * b));
  return x2 > 0 ? 2 * Math.sqrt(x2) : 0;
}

/** Returns the usable width at vertical fraction t for a diamond */
function diamondChordWidth(w: number, _h: number, t: number): number {
  // Diamond: widest at center (t=0.5), zero at t=0 and t=1
  const f = t <= 0.5 ? t * 2 : (1 - t) * 2;
  return w * f;
}

/** Returns the usable width at vertical fraction t for a hexagon */
function hexagonChordWidth(w: number, _h: number, t: number): number {
  const inset = 0.56; // from SHAPES.hexagon.inset
  // Top/bottom 25% tapers, middle 50% is full width
  if (t < 0.25) return w * inset + (w - w * inset) * (t / 0.25);
  if (t > 0.75) return w * inset + (w - w * inset) * ((1 - t) / 0.25);
  return w;
}

/** Returns the usable width at vertical fraction t for a triangle (point at top) */
function triangleChordWidth(w: number, _h: number, t: number): number {
  return w * t; // zero at top, full width at bottom
}

type ShapeWidthFn = (w: number, h: number, t: number) => number;

const SHAPE_WIDTH_FN: Record<string, ShapeWidthFn> = {
  circle:   circleChordWidth,
  diamond:  diamondChordWidth,
  hexagon:  hexagonChordWidth,
  triangle: triangleChordWidth,
};

/**
 * Wrap text to conform to the interior of a shape.
 * Returns lines with their text + measured width, plus a startY
 * offset (from shape top) where the first line's center sits.
 */
export function wrapTextInShape(
  text: string,
  font: string,
  fontSize: number,
  lineHeight: number,
  shape: string,
  shapeW: number,
  shapeH: number,
  padding: number,
): { lines: ShapeLine[]; startY: number } {
  const widthFn = SHAPE_WIDTH_FN[shape];
  if (!widthFn) {
    const wrapped = wrapText(text, shapeW - padding * 2, fontSize, font);
    return {
      lines: wrapped.map(t => ({ text: t, width: 0 })),
      startY: shapeH / 2,
    };
  }

  const prepared = prepareWithSegments(text, font);
  const maxSlots = Math.floor(shapeH / lineHeight);

  // Try laying out text starting from each possible vertical offset.
  // Iterate from the center outward to prefer centered placement.
  const attempts: number[] = [];
  const mid = Math.floor(maxSlots / 2);
  for (let d = 0; d <= mid; d++) {
    if (mid - d >= 0) attempts.push(mid - d);
    if (d > 0 && mid + d < maxSlots) attempts.push(mid + d);
  }

  let bestLines: ShapeLine[] | null = null;
  let bestStartSlot = 0;

  for (const startSlot of attempts) {
    const lines: ShapeLine[] = [];
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };

    for (let i = startSlot; i < maxSlots; i++) {
      const t = (i + 0.5) * lineHeight / shapeH;
      const chordW = widthFn(shapeW, shapeH, t) - padding * 2;
      if (chordW < fontSize) {
        if (lines.length === 0) continue;
        break;
      }

      const line = layoutNextLine(prepared, cursor, chordW);
      if (line === null) break;
      lines.push({ text: line.text, width: line.width });
      cursor = line.end;
    }

    // Check if all text was consumed
    const allConsumed = layoutNextLine(prepared, cursor, 1e6) === null;

    if (allConsumed && lines.length > 0) {
      bestLines = lines;
      bestStartSlot = startSlot;
      break; // centered attempt first, so first fit is the most centered
    }
  }

  if (!bestLines || bestLines.length === 0) {
    // Fallback: just return the text as-is
    return { lines: [{ text, width: 0 }], startY: shapeH / 2 };
  }

  // startY = the Y position (from shape top) of the first line's center
  const startY = (bestStartSlot + 0.5) * lineHeight;
  return { lines: bestLines, startY };
}
