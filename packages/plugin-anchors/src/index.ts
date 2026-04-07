import type { SketchmarkPlugin } from "sketchmark";

export interface AnchorsPluginOptions {}

const EDGE_LINE_RE =
  /^(\s*)([A-Za-z_][A-Za-z0-9_.-]*)(?:@([A-Za-z][A-Za-z0-9_-]*))?\s*(<-->|<->|-->|<--|->|<-|---|--)\s*([A-Za-z_][A-Za-z0-9_.-]*)(?:@([A-Za-z][A-Za-z0-9_-]*))?(.*)$/;

const SUPPORTED_ANCHORS = new Set([
  "top",
  "right",
  "bottom",
  "left",
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);

export function anchors(_options: AnchorsPluginOptions = {}): SketchmarkPlugin {
  return {
    name: "anchors",
    preprocess(source) {
      return compileAnchors(source);
    },
  };
}

export function compileAnchors(source: string): string {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  let inTripleQuoteBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (trimmed === '"""') {
      inTripleQuoteBlock = !inTripleQuoteBlock;
      output.push(line);
      continue;
    }

    if (
      inTripleQuoteBlock ||
      !trimmed ||
      trimmed.startsWith("step ") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("//")
    ) {
      output.push(line);
      continue;
    }

    output.push(rewriteAnchoredEdge(line, index + 1));
  }

  return output.join("\n");
}

function rewriteAnchoredEdge(line: string, lineNumber: number): string {
  const match = EDGE_LINE_RE.exec(line);
  if (!match) return line;

  const indent = match[1] ?? "";
  const fromId = match[2] ?? "";
  const fromAnchor = match[3];
  const connector = match[4] ?? "";
  const toId = match[5] ?? "";
  const toAnchor = match[6];
  const rest = match[7] ?? "";

  if (fromAnchor) assertAnchor(fromAnchor, lineNumber);
  if (toAnchor) assertAnchor(toAnchor, lineNumber);

  if (!fromAnchor && !toAnchor) return line;

  const anchorProps: string[] = [];
  if (fromAnchor && !/\banchor-from\s*=/.test(rest)) {
    anchorProps.push(`anchor-from=${fromAnchor}`);
  }
  if (toAnchor && !/\banchor-to\s*=/.test(rest)) {
    anchorProps.push(`anchor-to=${toAnchor}`);
  }

  const suffix = anchorProps.length ? ` ${anchorProps.join(" ")}` : "";
  return `${indent}${fromId} ${connector} ${toId}${rest}${suffix}`;
}

function assertAnchor(anchor: string, lineNumber: number): void {
  if (!SUPPORTED_ANCHORS.has(anchor)) {
    throw new Error(`Unsupported edge anchor "${anchor}" on line ${lineNumber}`);
  }
}
