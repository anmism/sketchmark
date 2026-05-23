import type { VisualDocument } from "../types";
import { documentForDeckStep } from "../deck";
import { documentForScene } from "../scenes";
import { compileVisualSequence, defaultSequenceId, documentForSequenceTime } from "../sequences";
import { renderToSvg } from "../render/svg";
import { renderThreePreviewSvg } from "../render/three-preview-svg";

export { documentForDeckStep };
export type { VisualDocument } from "../types";

export type BrowserExportFormat = "svg" | "png" | "jpg" | "html" | "json" | "mp4";
export type BrowserExportExtension = BrowserExportFormat | "webm";

export interface BrowserExportOptions {
  title?: string;
  filename?: string;
  time?: number;
  document?: VisualDocument;
  sourceDocument?: VisualDocument;
}

export interface BrowserExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  extension: BrowserExportExtension;
  fallback?: "webm";
}

type Mp4MuxerModule = {
  Muxer: new (options: Record<string, unknown>) => {
    addVideoChunk: (chunk: unknown, metadata?: unknown) => void;
    finalize: () => void;
    target: { buffer: ArrayBuffer };
  };
  ArrayBufferTarget: new () => unknown;
};

export interface VisualPlayerOptions {
  document: VisualDocument;
  autoplay?: boolean;
  loop?: boolean;
  onFrame?: (state: VisualPlayerState) => void;
  onError?: (error: Error) => void;
}

export interface VisualPlayerState {
  time: number;
  duration: number;
  playing: boolean;
}

export class VisualPlayer {
  readonly ready: Promise<VisualPlayer>;

  private root: HTMLElement;
  private document: VisualDocument;
  private loop: boolean;
  private onFrame?: (state: VisualPlayerState) => void;
  private onError?: (error: Error) => void;
  private raf = 0;
  private startedAt = 0;
  private startedTime = 0;
  private currentTime = 0;
  private playing = false;

  constructor(root: HTMLElement, options: VisualPlayerOptions) {
    this.root = root;
    this.document = options.document;
    this.loop = options.loop ?? true;
    this.onFrame = options.onFrame;
    this.onError = options.onError;
    this.ready = Promise.resolve(this);
    this.root.style.position ||= "relative";
    this.root.style.overflow ||= "hidden";
    this.render(0);
    if (options.autoplay) this.play();
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.startedAt = now();
    this.startedTime = this.currentTime;
    this.tick();
  }

  pause(): void {
    this.playing = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.emit();
  }

  seek(time: number): void {
    this.currentTime = clamp(time, 0, this.duration());
    this.render(this.currentTime);
  }

  render(time = this.currentTime): void {
    try {
      this.currentTime = clamp(time, 0, this.duration());
      this.root.innerHTML = this.toSvg(this.currentTime);
      this.emit();
    } catch (error) {
      this.handleError(error);
    }
  }

  setDocument(document: VisualDocument): void {
    this.document = document;
    this.seek(0);
  }

  getDocument(): VisualDocument {
    return this.document;
  }

  getState(): VisualPlayerState {
    return { time: this.currentTime, duration: this.duration(), playing: this.playing };
  }

  toSvg(time = this.currentTime): string {
    return renderFrameToSvg(this.document, clamp(time, 0, this.duration()));
  }

  downloadSvg(filename = "sketchmark.svg", time = this.currentTime): void {
    if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") {
      throw new Error("downloadSvg is only available in a browser.");
    }
    const blob = new Blob([this.toSvg(time)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportBrowser(format: BrowserExportFormat, options: BrowserExportOptions = {}): Promise<BrowserExportResult> {
    return exportVisualFromBrowser(this, format, options);
  }

  async download(format: BrowserExportFormat, options: BrowserExportOptions = {}): Promise<BrowserExportResult> {
    const result = await this.exportBrowser(format, options);
    downloadBrowserExport(result);
    return result;
  }

  destroy(): void {
    this.pause();
    this.root.innerHTML = "";
  }

  private tick = (): void => {
    if (!this.playing) return;
    const duration = this.duration();
    const elapsed = (now() - this.startedAt) / 1000;
    let nextTime = this.startedTime + elapsed;
    if (duration > 0 && nextTime > duration) {
      if (this.loop) {
        nextTime = nextTime % duration;
        this.startedAt = now();
        this.startedTime = nextTime;
      } else {
        nextTime = duration;
        this.playing = false;
      }
    }
    this.render(nextTime);
    if (this.playing) this.raf = requestAnimationFrame(this.tick);
  };

  private duration(): number {
    return Math.max(0, visualDuration(this.document));
  }

  private emit(): void {
    this.onFrame?.({ time: this.currentTime, duration: this.duration(), playing: this.playing });
  }

  private handleError(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.onError?.(normalized);
  }
}

export function createVisualPlayer(root: HTMLElement, options: VisualPlayerOptions): VisualPlayer {
  return new VisualPlayer(root, options);
}

export class SketchmarkPlayer extends VisualPlayer {}

export function createSketchmarkPlayer(root: HTMLElement, options: VisualPlayerOptions): SketchmarkPlayer {
  return new SketchmarkPlayer(root, options);
}

export async function exportVisualFromBrowser(
  player: VisualPlayer,
  format: BrowserExportFormat,
  options: BrowserExportOptions = {}
): Promise<BrowserExportResult> {
  ensureBrowserExport();
  const document = options.document ?? player.getDocument();
  const sourceDocument = options.sourceDocument ?? document;
  const title = options.title ?? "visual";
  const duration = Math.max(0.1, visualDuration(document));
  const fps = Math.max(1, Math.min(60, Number(document.canvas.fps ?? 30)));
  const time = clamp(options.time ?? player.getState().time, 0, duration);
  const svg = renderFrameToSvg(document, time);
  const width = document.canvas.width;
  const height = document.canvas.height;

  if (format === "svg") {
    return makeExportResult(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), options.filename, title, "svg", "image/svg+xml;charset=utf-8");
  }

  if (format === "json") {
    const json = JSON.stringify(sourceDocument, null, 2);
    return makeExportResult(new Blob([json], { type: "application/json;charset=utf-8" }), options.filename, title, "json", "application/json;charset=utf-8");
  }

  if (format === "html") {
    const html = standaloneHtml(title, svg);
    return makeExportResult(new Blob([html], { type: "text/html;charset=utf-8" }), options.filename, title, "html", "text/html;charset=utf-8");
  }

  if (format === "png" || format === "jpg") {
    const canvas = await svgToCanvas(svg, width, height);
    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
    const blob = await canvasToBlob(canvas, mimeType, 0.92);
    return makeExportResult(blob, options.filename, title, format, mimeType);
  }

  const video = await recordVideo(document, title, duration, fps);
  const result = makeExportResult(video.blob, options.filename, title, video.extension, video.mimeType);
  if (video.extension === "webm") result.fallback = "webm";
  return result;
}

export function downloadBrowserExport(result: BrowserExportResult): void {
  ensureBrowserExport();
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function visualDuration(document: VisualDocument): number {
  const sequence = defaultSequenceId(document);
  if (sequence) return Math.max(0, compileVisualSequence(document, sequence).duration);
  const scene = firstSceneId(document);
  if (scene && !hasTopLevelElements(document)) {
    return Math.max(0, Number(document.scenes?.[scene]?.canvas?.duration ?? document.canvas.duration ?? 0));
  }
  return Math.max(0, Number(document.canvas.duration ?? 0));
}

function renderFrameToSvg(document: VisualDocument, time: number): string {
  const frame = frameDocument(document, time);
  if (frame.document.canvas.renderer === "three") {
    return renderThreePreviewSvg(frame.document, frame.localTime);
  }
  return renderToSvg(frame.document, { time: frame.localTime });
}

function frameDocument(document: VisualDocument, time: number): { document: VisualDocument; localTime: number } {
  const sequence = defaultSequenceId(document);
  if (sequence) {
    const frame = documentForSequenceTime(document, sequence, time);
    return { document: frame.document, localTime: frame.localTime };
  }
  const scene = firstSceneId(document);
  if (scene && !hasTopLevelElements(document)) {
    return { document: documentForScene(document, scene), localTime: time };
  }
  return { document, localTime: time };
}

function firstSceneId(document: VisualDocument): string | undefined {
  return Object.keys(document.scenes ?? {})[0];
}

function hasTopLevelElements(document: VisualDocument): boolean {
  return Array.isArray(document.elements) && document.elements.length > 0;
}

function ensureBrowserExport(): void {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") {
    throw new Error("Browser export is only available in a browser.");
  }
}

function makeExportResult(
  blob: Blob,
  filename: string | undefined,
  title: string,
  extension: BrowserExportExtension,
  mimeType: string
): BrowserExportResult {
  return {
    blob: blob.type === mimeType ? blob : new Blob([blob], { type: mimeType }),
    filename: withExtension(filename ?? slug(title), extension),
    mimeType,
    extension
  };
}

function withExtension(filename: string, extension: BrowserExportExtension): string {
  const cleaned = filename.trim() || "visual";
  return cleaned.toLowerCase().endsWith(`.${extension}`) ? cleaned : `${cleaned.replace(/\.[a-z0-9]+$/i, "")}.${extension}`;
}

function standaloneHtml(title: string, svg: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>html,body{margin:0;min-height:100%;display:grid;place-items:center;background:#f5f3ef}svg{max-width:100vw;max-height:100vh;width:auto;height:auto}</style>
</head>
<body>${svg}</body>
</html>`;
}

async function svgToCanvas(svg: string, width: number, height: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  await drawSvgToCanvas(svg, canvas, width, height);
  return canvas;
}

async function drawSvgToCanvas(svg: string, canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export is not supported in this browser.");
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(url);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not rasterize SVG. External images may block browser export."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create image export."));
    }, type, quality);
  });
}

async function recordVideo(
  visualDocument: VisualDocument,
  title: string,
  duration: number,
  fps: number
): Promise<{ blob: Blob; mimeType: string; extension: "mp4" | "webm" }> {
  const width = visualDocument.canvas.width;
  const height = visualDocument.canvas.height;
  try {
    return await recordMp4WithExternalMuxer(visualDocument, width, height, duration, fps);
  } catch (error) {
    console.warn("mp4-muxer WebCodecs export failed; trying built-in MP4 muxer.", error);
  }
  try {
    return await recordMp4WithWebCodecs(visualDocument, width, height, duration, fps);
  } catch (error) {
    console.warn("Built-in WebCodecs MP4 export failed; falling back to WebM.", error);
    return recordWebmWithMediaRecorder(visualDocument, width, height, duration, fps, title);
  }
}

async function recordMp4WithExternalMuxer(
  visualDocument: VisualDocument,
  width: number,
  height: number,
  duration: number,
  fps: number
): Promise<{ blob: Blob; mimeType: "video/mp4"; extension: "mp4" }> {
  const VideoEncoderCtor = (globalThis as { VideoEncoder?: any }).VideoEncoder;
  const VideoFrameCtor = (globalThis as { VideoFrame?: any }).VideoFrame;
  if (!VideoEncoderCtor || !VideoFrameCtor) {
    throw new Error("WebCodecs is not available.");
  }

  const { Muxer, ArrayBufferTarget } = await loadMp4Muxer();
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height },
    fastStart: "in-memory"
  });
  const encoder = new VideoEncoderCtor({
    output: (chunk: unknown, metadata: unknown) => muxer.addVideoChunk(chunk, metadata),
    error(error: Error) {
      throw error;
    }
  });

  encoder.configure({
    codec: "avc1.640028",
    width,
    height,
    bitrate: Math.max(1_500_000, Math.min(12_000_000, width * height * fps * 0.18)),
    framerate: fps
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const frameDurationUs = Math.round(1_000_000 / fps);
  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const time = Math.min(duration, frameIndex / fps);
      await drawSvgToCanvas(renderFrameToSvg(visualDocument, time), canvas, width, height);
      const frame = new VideoFrameCtor(canvas, {
        timestamp: frameIndex * frameDurationUs,
        duration: frameDurationUs
      });
      encoder.encode(frame, { keyFrame: frameIndex % Math.max(1, Math.round(fps * 2)) === 0 });
      frame.close();
      if (frameIndex % 8 === 0) await wait(0);
    }
    await encoder.flush();
  } finally {
    encoder.close();
  }

  muxer.finalize();
  return {
    blob: new Blob([muxer.target.buffer], { type: "video/mp4" }),
    mimeType: "video/mp4",
    extension: "mp4"
  };
}

async function recordMp4WithWebCodecs(
  visualDocument: VisualDocument,
  width: number,
  height: number,
  duration: number,
  fps: number
): Promise<{ blob: Blob; mimeType: "video/mp4"; extension: "mp4" }> {
  const VideoEncoderCtor = (globalThis as { VideoEncoder?: any }).VideoEncoder;
  const VideoFrameCtor = (globalThis as { VideoFrame?: any }).VideoFrame;
  if (!VideoEncoderCtor || !VideoFrameCtor) {
    throw new Error("WebCodecs is not available.");
  }

  const codec = "avc1.42001f";
  const config = {
    codec,
    width,
    height,
    framerate: fps,
    bitrate: Math.max(1_500_000, Math.min(8_000_000, width * height * fps * 0.08)),
    hardwareAcceleration: "prefer-hardware",
    avc: { format: "avc" }
  };
  const support = await VideoEncoderCtor.isConfigSupported(config);
  if (!support.supported) {
    throw new Error("H.264 WebCodecs MP4 export is not supported in this browser.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const samples: Mp4Sample[] = [];
  let avcConfig: Uint8Array | undefined;
  const timescale = 90000;
  const sampleDuration = Math.max(1, Math.round(timescale / fps));

  const encoder = new VideoEncoderCtor({
    output(chunk: any, metadata: any) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      const description = metadata?.decoderConfig?.description;
      if (description) avcConfig = new Uint8Array(description);
      samples.push({ data, duration: sampleDuration, isKey: chunk.type === "key" });
    },
    error(error: Error) {
      throw error;
    }
  });

  encoder.configure(support.config);
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const frameDurationUs = Math.round(1_000_000 / fps);
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const time = Math.min(duration, frameIndex / fps);
    await drawSvgToCanvas(renderFrameToSvg(visualDocument, time), canvas, width, height);
    const bitmap = typeof createImageBitmap === "function" ? await createImageBitmap(canvas) : canvas;
    const frame = new VideoFrameCtor(bitmap, {
      timestamp: frameIndex * frameDurationUs,
      duration: frameDurationUs
    });
    encoder.encode(frame, { keyFrame: frameIndex % Math.max(1, Math.round(fps)) === 0 });
    frame.close();
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  }
  await encoder.flush();
  encoder.close();

  if (!samples.length || !avcConfig) {
    throw new Error("WebCodecs did not produce H.264 MP4 data.");
  }
  const mp4Bytes = muxMp4({ width, height, timescale, samples, avcConfig });
  const mp4Buffer = new ArrayBuffer(mp4Bytes.byteLength);
  new Uint8Array(mp4Buffer).set(mp4Bytes);
  return {
    blob: new Blob([mp4Buffer], { type: "video/mp4" }),
    mimeType: "video/mp4",
    extension: "mp4"
  };
}

async function recordWebmWithMediaRecorder(
  visualDocument: VisualDocument,
  width: number,
  height: number,
  duration: number,
  fps: number,
  title: string
): Promise<{ blob: Blob; mimeType: string; extension: "mp4" | "webm" }> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Browser video export needs WebCodecs or MediaRecorder support.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  const mp4 = "video/mp4";
  const webm = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const mimeType = MediaRecorder.isTypeSupported(mp4) ? mp4 : webm;
  const extension = mimeType === mp4 ? "mp4" : "webm";
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType });
  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error(`Could not record "${title}".`));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  for (let frame = 0; frame <= totalFrames; frame += 1) {
    const time = Math.min(duration, frame / fps);
    await drawSvgToCanvas(renderFrameToSvg(visualDocument, time), canvas, width, height);
    track.requestFrame?.();
    await wait(1000 / fps);
  }
  recorder.stop();
  const blob = await stopped;
  track.stop();
  return { blob, mimeType, extension };
}

interface Mp4Sample {
  data: Uint8Array;
  duration: number;
  isKey: boolean;
}

function muxMp4(input: { width: number; height: number; timescale: number; samples: Mp4Sample[]; avcConfig: Uint8Array }): Uint8Array {
  const sampleBytes = concatBytes(input.samples.map((sample) => sample.data));
  const ftyp = box("ftyp", ascii("isom"), u32(0x200), ascii("isom"), ascii("iso2"), ascii("avc1"), ascii("mp41"));
  const placeholderMoov = moovBox(input, 0);
  const mdatHeaderSize = 8;
  const chunkOffset = ftyp.byteLength + placeholderMoov.byteLength + mdatHeaderSize;
  const moov = moovBox(input, chunkOffset);
  const mdat = box("mdat", sampleBytes);
  return concatBytes([ftyp, moov, mdat]);
}

function moovBox(input: { width: number; height: number; timescale: number; samples: Mp4Sample[]; avcConfig: Uint8Array }, chunkOffset: number): Uint8Array {
  const duration = input.samples.reduce((sum, sample) => sum + sample.duration, 0);
  return box("moov", mvhd(input.timescale, duration), trakBox(input, duration, chunkOffset));
}

function mvhd(timescale: number, duration: number): Uint8Array {
  return fullBox("mvhd", 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u32(0x00010000), u16(0x0100), u16(0), zeros(8), matrix(), zeros(24), u32(2));
}

function trakBox(input: { width: number; height: number; timescale: number; samples: Mp4Sample[]; avcConfig: Uint8Array }, duration: number, chunkOffset: number): Uint8Array {
  return box("trak", tkhd(input.width, input.height, duration), mdiaBox(input, duration, chunkOffset));
}

function tkhd(width: number, height: number, duration: number): Uint8Array {
  return fullBox("tkhd", 0, 0x000007, u32(0), u32(0), u32(1), u32(0), u32(duration), zeros(8), u16(0), u16(0), u16(0), u16(0), matrix(), u32(width * 65536), u32(height * 65536));
}

function mdiaBox(input: { width: number; height: number; timescale: number; samples: Mp4Sample[]; avcConfig: Uint8Array }, duration: number, chunkOffset: number): Uint8Array {
  return box("mdia", mdhd(input.timescale, duration), hdlr(), minfBox(input, chunkOffset));
}

function mdhd(timescale: number, duration: number): Uint8Array {
  return fullBox("mdhd", 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0));
}

function hdlr(): Uint8Array {
  return fullBox("hdlr", 0, 0, u32(0), ascii("vide"), zeros(12), ascii("VideoHandler\0"));
}

function minfBox(input: { width: number; height: number; samples: Mp4Sample[]; avcConfig: Uint8Array }, chunkOffset: number): Uint8Array {
  return box("minf", fullBox("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0)), dinf(), stblBox(input, chunkOffset));
}

function dinf(): Uint8Array {
  return box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1)));
}

function stblBox(input: { width: number; height: number; samples: Mp4Sample[]; avcConfig: Uint8Array }, chunkOffset: number): Uint8Array {
  return box("stbl", stsd(input.width, input.height, input.avcConfig), stts(input.samples), stss(input.samples), stsc(input.samples.length), stsz(input.samples), stco(chunkOffset));
}

function stsd(width: number, height: number, avcConfig: Uint8Array): Uint8Array {
  const avc1 = box(
    "avc1",
    zeros(6),
    u16(1),
    zeros(16),
    u16(width),
    u16(height),
    u32(0x00480000),
    u32(0x00480000),
    u32(0),
    u16(1),
    compressorName("Sketchmark WebCodecs"),
    u16(0x0018),
    u16(0xffff),
    box("avcC", avcConfig)
  );
  return fullBox("stsd", 0, 0, u32(1), avc1);
}

function stts(samples: Mp4Sample[]): Uint8Array {
  const groups: Array<{ count: number; duration: number }> = [];
  for (const sample of samples) {
    const last = groups[groups.length - 1];
    if (last && last.duration === sample.duration) last.count += 1;
    else groups.push({ count: 1, duration: sample.duration });
  }
  return fullBox("stts", 0, 0, u32(groups.length), ...groups.flatMap((group) => [u32(group.count), u32(group.duration)]));
}

function stss(samples: Mp4Sample[]): Uint8Array {
  const keys = samples.map((sample, index) => sample.isKey ? index + 1 : 0).filter(Boolean);
  return fullBox("stss", 0, 0, u32(keys.length), ...keys.map((index) => u32(index)));
}

function stsc(sampleCount: number): Uint8Array {
  return fullBox("stsc", 0, 0, u32(1), u32(1), u32(sampleCount), u32(1));
}

function stsz(samples: Mp4Sample[]): Uint8Array {
  return fullBox("stsz", 0, 0, u32(0), u32(samples.length), ...samples.map((sample) => u32(sample.data.byteLength)));
}

function stco(offset: number): Uint8Array {
  return fullBox("stco", 0, 0, u32(1), u32(offset));
}

function box(type: string, ...payloads: Uint8Array[]): Uint8Array {
  const size = 8 + payloads.reduce((sum, payload) => sum + payload.byteLength, 0);
  return concatBytes([u32(size), ascii(type), ...payloads]);
}

function fullBox(type: string, version: number, flags: number, ...payloads: Uint8Array[]): Uint8Array {
  return box(type, new Uint8Array([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...payloads);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function ascii(value: string): Uint8Array {
  const output = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) output[index] = value.charCodeAt(index) & 255;
  return output;
}

function u16(value: number): Uint8Array {
  const output = new Uint8Array(2);
  new DataView(output.buffer).setUint16(0, value);
  return output;
}

function u32(value: number): Uint8Array {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value >>> 0);
  return output;
}

function zeros(length: number): Uint8Array {
  return new Uint8Array(length);
}

function matrix(): Uint8Array {
  return concatBytes([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);
}

function compressorName(value: string): Uint8Array {
  const output = new Uint8Array(32);
  const text = ascii(value.slice(0, 31));
  output[0] = text.byteLength;
  output.set(text, 1);
  return output;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadMp4Muxer(): Promise<Mp4MuxerModule> {
  const dynamicImport = new Function("url", "return import(url)") as (url: string) => Promise<Mp4MuxerModule>;
  return dynamicImport("https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.mjs");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "visual";
}
