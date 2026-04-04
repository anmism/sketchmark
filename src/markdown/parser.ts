// ============================================================
// sketchmark — Markdown inline parser
// Supports: # h1  ## h2  ### h3  **bold**  *italic*  blank lines
// ============================================================

export type LineKind = 'h1' | 'h2' | 'h3' | 'p' | 'blank';

export interface MarkdownRun {
  text:    string;
  bold?:   boolean;
  italic?: boolean;
}

export interface MarkdownLine {
  kind: LineKind;
  runs: MarkdownRun[];
}

import { MARKDOWN } from "../config";
import { measureTextWidth, buildFontStr } from "../utils/text-measure";
import { DEFAULT_FONT } from "../fonts";

// ── Font sizes per line kind (re-exported from config) ───
export const LINE_FONT_SIZE: Record<LineKind, number>   = { ...MARKDOWN.fontSize };
export const LINE_FONT_WEIGHT: Record<LineKind, number> = { ...MARKDOWN.fontWeight };
export const LINE_SPACING: Record<LineKind, number>     = { ...MARKDOWN.spacing };

// ── Parse a full markdown string into lines ───────────────
export function parseMarkdownContent(content: string): MarkdownLine[] {
  const raw   = content.split('\n');
  const lines: MarkdownLine[] = [];

  for (const line of raw) {
    const t = line.trim();

    if (!t) {
      lines.push({ kind: 'blank', runs: [] });
      continue;
    }

    if (t.startsWith('### ')) {
      lines.push({ kind: 'h3', runs: parseInline(t.slice(4)) });
    } else if (t.startsWith('## ')) {
      lines.push({ kind: 'h2', runs: parseInline(t.slice(3)) });
    } else if (t.startsWith('# ')) {
      lines.push({ kind: 'h1', runs: parseInline(t.slice(2)) });
    } else {
      lines.push({ kind: 'p', runs: parseInline(t) });
    }
  }

  // strip leading/trailing blank lines
  while (lines.length && lines[0].kind  === 'blank') lines.shift();
  while (lines.length && lines[lines.length-1].kind === 'blank') lines.pop();

  return lines;
}

// ── Parse inline bold/italic spans ───────────────────────
function parseInline(text: string): MarkdownRun[] {
  const runs: MarkdownRun[] = [];
  // Order matters: check ** before *
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|[^*]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].startsWith('**')) {
      runs.push({ text: m[2], bold: true });
    } else if (m[0].startsWith('*')) {
      runs.push({ text: m[3], italic: true });
    } else {
      if (m[0]) runs.push({ text: m[0] });
    }
  }
  return runs;
}

// ── Calculate natural height of a parsed block ────────────
export function calcMarkdownHeight(lines: MarkdownLine[], pad: number = MARKDOWN.defaultPad): number {
  let h = pad * 2;   // top + bottom
  for (const line of lines) h += LINE_SPACING[line.kind];
  return h;
}

// ── Calculate natural width of a parsed block using pretext ──
export function calcMarkdownWidth(lines: MarkdownLine[], fontFamily: string = DEFAULT_FONT, pad: number = MARKDOWN.defaultPad): number {
  let maxW = 0;
  for (const line of lines) {
    if (line.kind === 'blank') continue;
    const text = line.runs.map(r => r.text).join('');
    const font = buildFontStr(LINE_FONT_SIZE[line.kind], LINE_FONT_WEIGHT[line.kind], fontFamily);
    const w = measureTextWidth(text, font);
    if (w > maxW) maxW = w;
  }
  return Math.ceil(maxW) + pad * 2;
}