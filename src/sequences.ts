import type { ResolvedVisualDocument, SequenceTransition, VisualDocument, VisualElement } from "./types";
import { documentForScene } from "./scenes";
import { normalizeVisualDocument, resolveVisualFrame } from "./normalize";
import { clone } from "./utils";

export interface CompiledVisualSequence {
  id: string;
  duration: number;
  clips: Array<{ scene: string; start: number; duration: number; transition: NormalizedTransition }>;
}

export interface SequenceFrame {
  document: VisualDocument;
  scene: string;
  localTime: number;
  globalTime: number;
  transition?: {
    type: "fade";
    fromScene: string;
    toScene: string;
    progress: number;
    duration: number;
  };
}

export interface ResolvedSequenceFrame extends Omit<SequenceFrame, "document"> {
  document: ResolvedVisualDocument;
}

export interface SequenceTimelineFrame {
  index: number;
  time: number;
  scene: string;
  localTime: number;
  transition?: SequenceFrame["transition"];
}

export interface NormalizedTransition {
  type: "cut" | "fade";
  duration: number;
}

export function compileVisualSequence(document: VisualDocument, sequenceId: string): CompiledVisualSequence {
  const sequence = document.sequences?.[sequenceId];
  if (!sequence) throw new Error(`Unknown sequence '${sequenceId}'.`);
  let cursor = 0;
  const clips = sequence.clips.map((clip) => {
    if (!document.scenes?.[clip.scene]) throw new Error(`Unknown scene '${clip.scene}' in sequence '${sequenceId}'.`);
    const item = { scene: clip.scene, start: cursor, duration: clip.duration, transition: normalizeTransition(clip.transition) };
    cursor += clip.duration;
    return item;
  });
  return { id: sequenceId, duration: cursor, clips };
}

export function defaultSequenceId(document: VisualDocument): string | undefined {
  return Object.keys(document.sequences ?? {})[0];
}

export function documentForSequenceTime(document: VisualDocument, sequenceId: string, time: number): SequenceFrame {
  const sequence = compileVisualSequence(document, sequenceId);
  const clamped = Math.max(0, Math.min(sequence.duration || 0, time));
  const clipIndex = sequence.clips.findIndex((item) => clamped >= item.start && clamped < item.start + item.duration);
  const index = clipIndex === -1 ? sequence.clips.length - 1 : clipIndex;
  const clip = sequence.clips[index];
  if (!clip) throw new Error(`Sequence '${sequenceId}' has no clips.`);
  const localTime = Math.max(0, clamped - clip.start);
  const previous = index > 0 ? sequence.clips[index - 1] : undefined;
  if (previous && clip.transition.type === "fade" && clip.transition.duration > 0 && localTime < clip.transition.duration) {
    const progress = Math.max(0, Math.min(1, localTime / clip.transition.duration));
    return {
      document: fadeDocuments(documentForScene(document, previous.scene), documentForScene(document, clip.scene), progress),
      scene: clip.scene,
      localTime,
      globalTime: clamped,
      transition: { type: "fade", fromScene: previous.scene, toScene: clip.scene, progress, duration: clip.transition.duration }
    };
  }
  return {
    document: documentForScene(document, clip.scene),
    scene: clip.scene,
    localTime,
    globalTime: clamped
  };
}

export function resolvedFrameForSequenceTime(document: VisualDocument, sequenceId: string, time: number): ResolvedSequenceFrame {
  const frame = documentForSequenceTime(document, sequenceId, time);
  return {
    ...frame,
    document: resolveVisualFrame(frame.document, frame.localTime)
  };
}

export function sequenceTimeline(document: VisualDocument, sequenceId: string, fps: number): SequenceTimelineFrame[] {
  const sequence = compileVisualSequence(document, sequenceId);
  const safeFps = Math.max(1, Math.round(fps));
  const frameCount = Math.max(1, Math.ceil(sequence.duration * safeFps));
  const frames: SequenceTimelineFrame[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const time = index / safeFps;
    const frame = documentForSequenceTime(document, sequenceId, time);
    frames.push({
      index,
      time,
      scene: frame.scene,
      localTime: frame.localTime,
      ...(frame.transition ? { transition: frame.transition } : {})
    });
  }
  return frames;
}

function normalizeTransition(transition: SequenceTransition | undefined): NormalizedTransition {
  if (!transition || transition === "cut") return { type: "cut", duration: 0 };
  if (transition === "fade") return { type: "fade", duration: 0.4 };
  return { type: transition.type, duration: Math.max(0, Number(transition.duration ?? (transition.type === "fade" ? 0.4 : 0))) };
}

function fadeDocuments(from: VisualDocument, to: VisualDocument, progress: number): VisualDocument {
  const resolvedFrom = normalizeVisualDocument(from);
  const resolvedTo = normalizeVisualDocument(to);
  return {
    ...to,
    elements: [
      ...withOpacity(resolvedFrom.elements ?? [], 1 - progress, "fade_from"),
      ...withOpacity(resolvedTo.elements ?? [], progress, "fade_to")
    ]
  };
}

function withOpacity(elements: VisualElement[], multiplier: number, prefix: string): VisualElement[] {
  return elements.map((element) => {
    const next = clone(element);
    if (next.id) next.id = `${prefix}_${next.id}`;
    next.opacity = Number(next.opacity ?? 1) * multiplier;
    if (next.type === "group" && Array.isArray(next.children)) {
      next.children = withOpacity(next.children, multiplier, prefix);
    }
    return next;
  });
}
