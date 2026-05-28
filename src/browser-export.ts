import { renderToHtml } from "./render/html";
import { renderToSvg } from "./render/svg";
import type { VisualDocument } from "./types";

export type BrowserExportFormat = "svg" | "png" | "jpg" | "html" | "json" | "mp4" | "webm";

export type BrowserExportOptions = {
  format: BrowserExportFormat;
  title: string;
  time?: number;
  sourceDocument?: VisualDocument;
  onProgress?: (progress: number) => void;
};

type VideoEncoderLike = {
  configure(config: Record<string, unknown>): void;
  encode(frame: unknown, options?: Record<string, unknown>): void;
  flush(): Promise<void>;
  close(): void;
};

type VideoFrameLike = {
  close(): void;
};

type Mp4MuxerModule = {
  Muxer: new (options: Record<string, unknown>) => {
    addVideoChunk(chunk: unknown, metadata: unknown): void;
    finalize(): void;
  };
  ArrayBufferTarget: new () => { buffer: ArrayBuffer };
};

export async function exportVisualInBrowser(document: VisualDocument, options: BrowserExportOptions): Promise<void> {
  const format = options.format;
  const time = Math.max(0, Number(options.time ?? 0));
  const title = safeFileName(options.title);

  if (format === "json") {
    downloadBlob(
      new Blob([JSON.stringify(options.sourceDocument ?? document, null, 2)], { type: "application/json" }),
      `${title}.json`
    );
    options.onProgress?.(100);
    return;
  }

  if (format === "svg") {
    downloadBlob(new Blob([renderToSvg(document, { time })], { type: "image/svg+xml;charset=utf-8" }), `${title}.svg`);
    options.onProgress?.(100);
    return;
  }

  if (format === "html") {
    downloadBlob(new Blob([renderToHtml(document, { time })], { type: "text/html;charset=utf-8" }), `${title}.html`);
    options.onProgress?.(100);
    return;
  }

  if (format === "png" || format === "jpg") {
    await exportRasterFrame(document, { format, title, time });
    options.onProgress?.(100);
    return;
  }

  if (format === "mp4") {
    await exportMp4(document, { title, onProgress: options.onProgress });
    return;
  }

  throw new Error("Browser WebM export is not implemented yet. Use MP4 or a server exporter.");
}

async function exportRasterFrame(
  document: VisualDocument,
  options: { format: "png" | "jpg"; title: string; time: number }
): Promise<void> {
  const { width, height } = canvasSize(document);
  const canvas = documentCanvas(width, height);
  const svg = renderToSvg(document, { time: options.time });
  await drawSvgToCanvas(svg, canvas, width, height);
  const mimeType = options.format === "jpg" ? "image/jpeg" : "image/png";
  const blob = await canvasToBlob(canvas, mimeType, options.format === "jpg" ? 0.92 : undefined);
  downloadBlob(blob, `${options.title}.${options.format}`);
}

async function exportMp4(
  document: VisualDocument,
  options: { title: string; onProgress?: (progress: number) => void }
): Promise<void> {
  const globalApi = globalThis as typeof globalThis & {
    VideoEncoder?: new (init: Record<string, unknown>) => VideoEncoderLike;
    VideoFrame?: new (source: HTMLCanvasElement, init: Record<string, unknown>) => VideoFrameLike;
  };
  const VideoEncoderCtor = globalApi.VideoEncoder;
  const VideoFrameCtor = globalApi.VideoFrame;

  if (!VideoEncoderCtor || !VideoFrameCtor) {
    throw new Error("Browser MP4 export requires WebCodecs. Try Chrome or Edge, or use a server exporter.");
  }

  const duration = Number(document.canvas.duration ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("MP4 export requires a positive canvas.duration.");
  }

  const fps = Math.max(1, Math.round(Number(document.canvas.fps ?? 30) || 30));
  const { width, height } = canvasSize(document);
  const encodeWidth = evenDimension(width);
  const encodeHeight = evenDimension(height);
  const totalFrames = Math.max(1, Math.ceil(duration * fps));

  const { Muxer, ArrayBufferTarget } = await loadMp4Muxer();
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: encodeWidth, height: encodeHeight },
    fastStart: "in-memory"
  });

  let encoderError: unknown;
  const encoder = new VideoEncoderCtor({
    output: (chunk: unknown, metadata: unknown) => muxer.addVideoChunk(chunk, metadata),
    error: (error: unknown) => {
      encoderError = error;
    }
  });

  encoder.configure({
    codec: "avc1.640028",
    width: encodeWidth,
    height: encodeHeight,
    bitrate: 5_000_000,
    framerate: fps
  });

  const canvas = documentCanvas(encodeWidth, encodeHeight);

  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const frameTime = Math.min(duration, frameIndex / fps);
      const svg = renderToSvg(document, { time: frameTime });
      await drawSvgToCanvas(svg, canvas, encodeWidth, encodeHeight);

      const frame = new VideoFrameCtor(canvas, {
        timestamp: Math.round((frameIndex / fps) * 1_000_000),
        duration: Math.round((1 / fps) * 1_000_000)
      });

      encoder.encode(frame, { keyFrame: frameIndex % Math.max(1, fps * 2) === 0 });
      frame.close();

      if (encoderError) throw encoderError;
      if (frameIndex % 5 === 0 || frameIndex === totalFrames - 1) {
        options.onProgress?.(Math.round(((frameIndex + 1) / totalFrames) * 100));
        await yieldToBrowser();
      }
    }

    await encoder.flush();
    if (encoderError) throw encoderError;
    encoder.close();
    muxer.finalize();

    downloadBlob(new Blob([target.buffer], { type: "video/mp4" }), `${options.title}.mp4`);
    options.onProgress?.(100);
  } catch (error) {
    try {
      encoder.close();
    } catch {
      // Ignore close failures after encoder errors.
    }
    throw error;
  }
}

async function loadMp4Muxer(): Promise<Mp4MuxerModule> {
  return import("mp4-muxer") as Promise<Mp4MuxerModule>;
}

function documentCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function drawSvgToCanvas(svg: string, canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create a 2D canvas context.");
  const image = await loadSvgImage(svg);
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not rasterize the SVG frame in the browser."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export the canvas frame. Cross-origin images can block browser raster export."));
    }, type, quality);
  });
}

function canvasSize(document: VisualDocument): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(Number(document.canvas.width) || 1)),
    height: Math.max(1, Math.round(Number(document.canvas.height) || 1))
  };
}

function evenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "sketchmark";
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
