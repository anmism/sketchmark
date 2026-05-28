import type { TimelineTrack, VisualDocument, VisualElement } from "../types";
import { validateVisualDocument } from "../validate";
import type { ApplyPresetOptions, PresetFragment, PresetTimelineMap } from "./types";
import { cloneElement, cloneTrack, cloneValue, mergeFragments, mergeTrack } from "./helpers";

export function applyPresetFragments(document: VisualDocument, fragments: PresetFragment | PresetFragment[], options: ApplyPresetOptions = {}): VisualDocument {
  const list = Array.isArray(fragments) ? fragments : [fragments];
  const next = cloneValue(document);
  next.elements ??= [];

  for (const item of list) {
    for (const element of item.elements ?? []) next.elements.push(cloneElement(element));
  }

  const byId = elementMap(next.elements);
  for (const item of list) {
    applyTimelineMap(byId, item.timelines ?? {});
  }

  if (options.validate !== false) {
    const result = validateVisualDocument(next);
    if (!result.ok) {
      const first = result.issues[0];
      throw new Error(first ? `${first.path}: ${first.message}` : "Preset output is not a valid Sketchmark kernel document.");
    }
  }
  return next;
}

export function mergePresetFragments(fragments: PresetFragment[]): PresetFragment {
  return mergeFragments(...fragments);
}

export function prefixPresetFragment(fragment: PresetFragment, prefix: string): PresetFragment {
  const normalizedPrefix = prefix.trim().replace(/\.+$/g, "");
  if (!normalizedPrefix) return cloneValue(fragment);
  const elements = (fragment.elements ?? []).map((element) => prefixElement(element, normalizedPrefix));
  const timelines: PresetTimelineMap = {};
  for (const [id, tracks] of Object.entries(fragment.timelines ?? {})) {
    timelines[`${normalizedPrefix}.${id}`] = cloneTracks(tracks);
  }
  return {
    ...(elements.length ? { elements } : {}),
    ...(Object.keys(timelines).length ? { timelines } : {})
  };
}

function applyTimelineMap(byId: Map<string, VisualElement>, timelines: PresetTimelineMap): void {
  for (const [id, tracks] of Object.entries(timelines)) {
    const element = byId.get(id);
    if (!element) throw new Error(`Cannot apply preset timeline to unknown element '${id}'.`);
    element.timeline ??= {};
    element.timeline.tracks ??= {};
    for (const [property, track] of Object.entries(tracks)) {
      element.timeline.tracks[property] = mergeTrack(element.timeline.tracks[property], track);
    }
  }
}

function elementMap(elements: VisualElement[]): Map<string, VisualElement> {
  const map = new Map<string, VisualElement>();
  const visit = (element: VisualElement): void => {
    if (element.id) map.set(element.id, element);
    if (element.type === "group") element.children.forEach(visit);
  };
  elements.forEach(visit);
  return map;
}

function prefixElement<T extends VisualElement>(element: T, prefix: string): T {
  const next = cloneElement(element);
  if (next.id) next.id = `${prefix}.${next.id}`;
  if (next.type === "group") next.children = next.children.map((child) => prefixElement(child, prefix));
  return next;
}

function cloneTracks(tracks: Record<string, TimelineTrack>): Record<string, TimelineTrack> {
  return Object.fromEntries(Object.entries(tracks).map(([property, track]) => [property, cloneTrack(track)]));
}
