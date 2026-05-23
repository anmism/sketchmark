declare const require: (id: string) => any;

import type { ValidationResult, VisualDocument, VisualElement, VisualSymbol } from "./types";
import { validateVisualDocument } from "./validate";
import { flattenElements } from "./utils";

const fs = require("node:fs");
const path = require("node:path");

export interface VisualProject {
  root: string;
  entry: string;
  document: VisualDocument;
  files: Record<string, VisualDocument>;
  symbols: VisualSymbol[];
}

export function loadVisualProject(entryPath: string): VisualProject {
  const entry = path.resolve(entryPath);
  const root = path.dirname(entry);
  const files: Record<string, VisualDocument> = {};
  const document = loadRecursive(entry, root, files, new Set<string>());
  const project: VisualProject = { root, entry, document, files, symbols: [] };
  project.symbols = buildSymbolIndex(project);
  const result = validateVisualProject(project);
  if (!result.ok) {
    const first = result.issues[0];
    throw new Error(first ? `${first.path}: ${first.message}` : "Invalid visual project.");
  }
  return project;
}

export function buildSymbolIndex(project: Pick<VisualProject, "files" | "document">): VisualSymbol[] {
  const symbols: VisualSymbol[] = [];
  const addElements = (elements: VisualElement[] | undefined, file: string | undefined, scene: string | undefined, prefix: string): void => {
    for (const [index, element] of flattenElements(elements ?? []).entries()) {
      if (!element.id) continue;
      symbols.push({
        id: element.id,
        type: element.type,
        ...(file ? { file } : {}),
        ...(scene ? { scene } : {}),
        path: `${prefix}/${index}`
      });
    }
  };

  for (const [file, document] of Object.entries(project.files ?? {})) {
    addElements(document.elements, file, undefined, `/files/${file}/elements`);
    for (const [sceneId, scene] of Object.entries(document.scenes ?? {})) {
      addElements(scene.elements, file, sceneId, `/files/${file}/scenes/${sceneId}/elements`);
    }
  }
  if (!project.files || !Object.keys(project.files).length) {
    addElements(project.document.elements, undefined, undefined, "/elements");
    for (const [sceneId, scene] of Object.entries(project.document.scenes ?? {})) {
      addElements(scene.elements, undefined, sceneId, `/scenes/${sceneId}/elements`);
    }
  }
  return symbols;
}

export function validateVisualProject(project: Pick<VisualProject, "document" | "files" | "symbols">): ValidationResult {
  const merged = validateVisualDocument(project.document);
  const issues = [...merged.issues];
  const warnings = [...merged.warnings];
  for (const [file, document] of Object.entries(project.files ?? {})) {
    const result = validateVisualDocument({ ...document, sequences: undefined });
    issues.push(...result.issues.map((item) => ({ ...item, path: `/files/${file}${item.path}` })));
    warnings.push(...result.warnings.map((item) => ({ ...item, path: `/files/${file}${item.path}` })));
  }
  const seen = new Set<string>();
  for (const symbol of project.symbols ?? []) {
    const scope = `${symbol.file ?? "<merged>"}:${symbol.scene ?? "<root>"}:${symbol.id}`;
    if (seen.has(scope)) {
      issues.push({
        path: symbol.path,
        code: "duplicate_symbol",
        message: `Duplicate id '${symbol.id}' in the same file/scene scope.`,
        suggestion: "Use stable unique ids so AI patches can target one primitive."
      });
    }
    seen.add(scope);
  }
  return { ok: issues.length === 0, issues, warnings };
}

function loadRecursive(filePath: string, root: string, files: Record<string, VisualDocument>, seen: Set<string>): VisualDocument {
  const absolute = path.resolve(filePath);
  const relative = normalizePath(path.relative(root, absolute));
  if (seen.has(absolute)) throw new Error(`Circular import detected at '${relative}'.`);
  seen.add(absolute);
  const source = JSON.parse(fs.readFileSync(absolute, "utf8")) as VisualDocument;
  files[relative] = source;

  const merged: VisualDocument = {
    ...source,
    elements: [...(source.elements ?? [])],
    scenes: { ...(source.scenes ?? {}) },
    sequences: { ...(source.sequences ?? {}) },
    assets: { ...(source.assets ?? {}) }
  };

  for (const [key, importPath] of Object.entries(source.imports ?? {})) {
    const child = loadRecursive(path.resolve(path.dirname(absolute), importPath), root, files, seen);
    if (child.elements?.length) {
      merged.scenes = merged.scenes ?? {};
      merged.scenes[key] = { id: key, canvas: child.canvas, elements: child.elements };
    }
    merged.scenes = { ...(merged.scenes ?? {}), ...(child.scenes ?? {}) };
    merged.sequences = { ...(merged.sequences ?? {}), ...(child.sequences ?? {}) };
    merged.assets = { ...(merged.assets ?? {}), ...(child.assets ?? {}) };
  }

  seen.delete(absolute);
  return merged;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}
