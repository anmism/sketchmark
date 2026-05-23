import type { ExportOptions, VisualDocument } from "../types";
import { renderToHtml } from "../render/html";
import { renderToSvg } from "../render/svg";

export interface ExportResult {
  format: string;
  content: string;
  mimeType: string;
  warnings?: string[];
}

export function exportVisual(document: VisualDocument, options: ExportOptions = {}): ExportResult {
  const format = options.format ?? "svg";
  if (format === "svg") {
    return { format, content: renderToSvg(document, options), mimeType: "image/svg+xml" };
  }
  if (format === "html") {
    return { format, content: renderToHtml(document, options), mimeType: "text/html" };
  }
  throw new Error(`${format.toUpperCase()} export is reserved for the advanced renderer/export adapter. The primitive JSON core currently exports svg and html directly.`);
}
