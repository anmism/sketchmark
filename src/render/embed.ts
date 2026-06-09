import type { RenderOptions, VisualDocument } from "../types";
import { MP4_MUXER_SOURCE } from "../mp4-muxer-source";
import { clamp } from "../utils";
import { renderToSvg } from "./svg";

export interface EmbedHtmlOptions extends RenderOptions {
  title?: string;
  fps?: number;
  maxFrames?: number;
  autoplay?: boolean;
  loop?: boolean;
  includeExportControls?: boolean;
  chromeBackground?: string;
}

export function renderToEmbedHtml(document: VisualDocument, options: EmbedHtmlOptions = {}): string {
  const title = String(options.title ?? "Sketchmark Embed");
  const duration = Math.max(0, Number(document.canvas.duration ?? 0) || 0);
  const initialTime = clamp(Number(options.time ?? 0) || 0, 0, duration);
  const fps = normalizePositiveInteger(options.fps, normalizePositiveInteger(document.canvas.fps, 24));
  const maxFrames = normalizePositiveInteger(options.maxFrames, 180);
  const frameCount = sampledFrameCount(duration, fps, maxFrames);
  const frameTimes = Array.from({ length: frameCount }, (_, index) => frameTimeAt(index, frameCount, duration));
  const frames = frameTimes.map((time) =>
    renderToSvg(document, {
      time,
      transparent: options.transparent
    })
  );
  const initialFrameIndex = frameIndexForTime(initialTime, frameTimes);
  const initialFrame = frames[initialFrameIndex] ?? frames[0] ?? renderToSvg(document, options);
  const chromeBackground = escapeHtml(String(options.chromeBackground ?? "transparent"));
  const mp4MuxerRuntimeSource = inlineMp4MuxerRuntime(MP4_MUXER_SOURCE);
  const statusLabel = escapeHtml(title || "Sketchmark embed");
  const payload = {
    title,
    fileBase: safeFileName(title),
    canvas: {
      width: Math.max(1, Math.round(Number(document.canvas.width) || 1)),
      height: Math.max(1, Math.round(Number(document.canvas.height) || 1))
    },
    document,
    duration,
    initialTime,
    frameTimes,
    autoplay: options.autoplay ?? duration > 0,
    loop: options.loop ?? true,
    includeExportControls: options.includeExportControls !== false,
    frames
  };

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)} - Sketchmark Embed</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: ${chromeBackground};
      color-scheme: light dark;
      color: #0f172a;
      font: 12px/1.4 Roboto, Arial, sans-serif;
    }
    body {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      overflow: hidden;
      --embed-surface: rgba(255, 255, 255, 0.78);
      --embed-surface-strong: rgba(255, 255, 255, 0.94);
      --embed-border: rgba(15, 23, 42, 0.14);
      --embed-border-strong: rgba(15, 23, 42, 0.18);
      --embed-text: #0f172a;
      --embed-muted: #475569;
      --embed-button: rgba(255, 255, 255, 0.72);
      --embed-button-hover: rgba(255, 255, 255, 0.92);
      --embed-shadow: 0 18px 50px rgba(15, 23, 42, 0.14);
      --embed-accent: #2563eb;
    }
    @media (prefers-color-scheme: dark) {
      body {
        --embed-surface: rgba(15, 23, 42, 0.74);
        --embed-surface-strong: rgba(15, 23, 42, 0.92);
        --embed-border: rgba(255, 255, 255, 0.12);
        --embed-border-strong: rgba(255, 255, 255, 0.16);
        --embed-text: #e5edf7;
        --embed-muted: #b6c2d1;
        --embed-button: rgba(255, 255, 255, 0.08);
        --embed-button-hover: rgba(255, 255, 255, 0.14);
        --embed-shadow: 0 18px 50px rgba(2, 6, 23, 0.32);
        --embed-accent: #7dd3fc;
      }
    }
    #stage {
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 14px;
      box-sizing: border-box;
    }
    #stage svg {
      display: block;
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      box-shadow: 0 18px 60px rgba(15, 23, 42, 0.28);
    }
    #controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin: 0 14px 14px;
      padding: 10px 12px;
      border: 1px solid var(--embed-border);
      border-radius: 14px;
      background: var(--embed-surface);
      color: var(--embed-text);
      backdrop-filter: blur(16px) saturate(140%);
      -webkit-backdrop-filter: blur(16px) saturate(140%);
      box-shadow: var(--embed-shadow);
      box-sizing: border-box;
    }
    button,
    summary,
    input {
      font: inherit;
    }
    button,
    summary {
      border: 1px solid var(--embed-border-strong);
      border-radius: 8px;
      background: var(--embed-button);
      color: inherit;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }
    button {
      padding: 8px 12px;
    }
    button:hover,
    summary:hover {
      background: var(--embed-button-hover);
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    #play {
      min-width: 68px;
    }
    #time {
      flex: 1 1 180px;
      min-width: 140px;
      accent-color: var(--embed-accent);
    }
    #clock {
      min-width: 110px;
      font-variant-numeric: tabular-nums;
      color: var(--embed-muted);
      text-align: right;
    }
    #meta {
      min-width: 0;
      flex: 1 1 160px;
      color: var(--embed-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: right;
    }
    details {
      position: relative;
    }
    summary {
      list-style: none;
      padding: 8px 12px;
      user-select: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    .exportMenu {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      display: grid;
      gap: 6px;
      min-width: 110px;
      padding: 8px;
      border: 1px solid var(--embed-border);
      border-radius: 10px;
      background: var(--embed-surface-strong);
      box-shadow: var(--embed-shadow);
      backdrop-filter: blur(18px) saturate(150%);
      -webkit-backdrop-filter: blur(18px) saturate(150%);
    }
    .exportMenu button {
      width: 100%;
      text-align: left;
      padding: 8px 10px;
    }
    @media (max-width: 720px) {
      #controls {
        gap: 8px;
      }
      #meta {
        order: 10;
        width: 100%;
        text-align: left;
      }
      details {
        margin-left: auto;
      }
    }
  </style>
</head>
<body>
  <div id="stage">${initialFrame}</div>
  <div id="controls">
    <button id="play" type="button">Play</button>
    <input id="time" type="range" min="0" max="${Math.max(duration, 0.001)}" step="0.01" value="${initialTime}" />
    <div id="clock">0.00s / ${duration.toFixed(2)}s</div>
    ${options.includeExportControls !== false ? `<details id="exportRoot">
      <summary>Export</summary>
      <div class="exportMenu">
        <button type="button" data-export-format="svg">SVG</button>
        <button type="button" data-export-format="png">PNG</button>
        <button type="button" data-export-format="jpg">JPG</button>
        <button type="button" data-export-format="html">HTML</button>
        <button type="button" data-export-format="json">JSON</button>
        <button type="button" data-export-format="mp4">MP4</button>
      </div>
    </details>` : ""}
    <div id="meta">${statusLabel}</div>
  </div>
  <script>
    ${mp4MuxerRuntimeSource}
  </script>
  <script>
    const payload = ${serializeForScript(payload)};
    const stage = document.getElementById("stage");
    const playButton = document.getElementById("play");
    const slider = document.getElementById("time");
    const clock = document.getElementById("clock");
    const meta = document.getElementById("meta");
    const exportRoot = document.getElementById("exportRoot");
    const defaultMeta = meta ? meta.textContent || "" : "";
    const frameTimes = Array.isArray(payload.frameTimes) ? payload.frameTimes : [];
    const state = {
      time: clampTime(payload.initialTime),
      playing: false,
      raf: 0,
      lastTick: 0
    };
    let metaTimer = 0;
    let exportBusy = false;

    function clampTime(value) {
      if (!payload.duration) return 0;
      const number = Number(value) || 0;
      return Math.max(0, Math.min(payload.duration, number));
    }

    function frameIndexForTimeValue(time) {
      if (!frameTimes.length) return 0;
      const clamped = clampTime(time);
      let bestIndex = 0;
      let bestDelta = Number.POSITIVE_INFINITY;
      for (let index = 0; index < frameTimes.length; index += 1) {
        const delta = Math.abs(Number(frameTimes[index] || 0) - clamped);
        if (delta <= bestDelta) {
          bestIndex = index;
          bestDelta = delta;
        } else if (Number(frameTimes[index] || 0) > clamped) {
          break;
        }
      }
      return bestIndex;
    }

    function currentFrameSvg() {
      const frames = Array.isArray(payload.frames) ? payload.frames : [];
      return frames[frameIndexForTimeValue(state.time)] || frames[0] || "";
    }

    function timeLabel(value) {
      return clampTime(value).toFixed(2).replace(".", "-");
    }

    function flashMeta(message) {
      if (!meta) return;
      meta.textContent = message;
      if (metaTimer) window.clearTimeout(metaTimer);
      metaTimer = window.setTimeout(() => {
        meta.textContent = defaultMeta;
      }, 2200);
    }

    function notifyRendered() {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: "sketchmark-rendered",
            title: payload.title,
            duration: payload.duration,
            time: state.time
          },
          "*"
        );
      }
    }

    function render() {
      stage.innerHTML = currentFrameSvg();
      slider.max = String(Math.max(payload.duration, 0.001));
      slider.value = String(clampTime(state.time));
      slider.disabled = exportBusy || payload.duration <= 0;
      playButton.disabled = exportBusy || payload.duration <= 0;
      playButton.textContent = state.playing ? "Pause" : "Play";
      clock.textContent = payload.duration > 0
        ? state.time.toFixed(2) + "s / " + payload.duration.toFixed(2) + "s"
        : "Static preview";
    }

    function pause() {
      state.playing = false;
      if (state.raf) {
        window.cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
      render();
    }

    function play() {
      if (payload.duration <= 0 || state.playing) return;
      state.playing = true;
      state.lastTick = performance.now();
      render();
      state.raf = window.requestAnimationFrame(tick);
    }

    function seek(time, notify) {
      state.time = clampTime(time);
      render();
      if (notify) notifyRendered();
    }

    function tick(now) {
      if (!state.playing) return;
      const delta = (now - state.lastTick) / 1000;
      state.lastTick = now;
      let nextTime = state.time + delta;

      if (payload.duration > 0 && nextTime > payload.duration) {
        if (payload.loop) nextTime = nextTime % payload.duration;
        else {
          nextTime = payload.duration;
          state.playing = false;
        }
      }

      state.time = clampTime(nextTime);
      render();
      if (state.playing) state.raf = window.requestAnimationFrame(tick);
      else state.raf = 0;
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function downloadText(filename, text, mimeType) {
      downloadBlob(new Blob([text], { type: mimeType }), filename);
    }

    function loadSvgImage(svg) {
      return loadImage(svgDataUrl(svg));
    }

    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not rasterize the current SVG frame."));
        image.src = url;
      });
    }

    function svgDataUrl(svg) {
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    function canvasToBlob(canvas, type, quality) {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not export the current frame."));
        }, type, quality);
      });
    }

    function yieldToBrowser() {
      return new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    function evenDimension(value) {
      const rounded = Math.max(2, Math.round(Number(value) || 0));
      return rounded % 2 === 0 ? rounded : rounded + 1;
    }

    function sampleFrameDuration(index) {
      if (frameTimes.length >= 2) {
        if (index < frameTimes.length - 1) {
          return Math.max(1 / 240, Number(frameTimes[index + 1]) - Number(frameTimes[index]));
        }
        return Math.max(1 / 240, Number(frameTimes[index]) - Number(frameTimes[index - 1]));
      }
      const fallbackFps = Math.max(1, Number(payload.document && payload.document.canvas && payload.document.canvas.fps || 24));
      return 1 / fallbackFps;
    }

    function sampleFps() {
      if (payload.duration > 0 && frameTimes.length >= 2) {
        return Math.max(1, Math.round((frameTimes.length - 1) / payload.duration));
      }
      return Math.max(1, Number(payload.document && payload.document.canvas && payload.document.canvas.fps || 24));
    }

    async function drawSvgToCanvas(svg, canvas, width, height) {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not create a 2D canvas context.");
      const image = await loadSvgImage(svg);
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
    }

    async function loadMp4Muxer() {
      const module = globalThis.__SKETCHMARK_MP4_MUXER__;
      if (module && module.Muxer && module.ArrayBufferTarget) return module;
      throw new Error("MP4 runtime could not be initialized in this host.");
    }

    async function rasterBlob(format) {
      const canvas = document.createElement("canvas");
      canvas.width = payload.canvas.width;
      canvas.height = payload.canvas.height;
      await drawSvgToCanvas(currentFrameSvg(), canvas, canvas.width, canvas.height);
      return canvasToBlob(canvas, format === "jpg" ? "image/jpeg" : "image/png", format === "jpg" ? 0.92 : undefined);
    }

    async function exportMp4() {
      const globalApi = globalThis;
      const VideoEncoderCtor = globalApi.VideoEncoder;
      const VideoFrameCtor = globalApi.VideoFrame;
      if (!VideoEncoderCtor || !VideoFrameCtor) {
        throw new Error("MP4 export requires WebCodecs. Try Chrome or Edge.");
      }
      if (!(payload.duration > 0)) {
        throw new Error("MP4 export requires a positive duration.");
      }

      const frames = Array.isArray(payload.frames) ? payload.frames : [];
      if (!frames.length) {
        throw new Error("No frames are available for MP4 export.");
      }

      const { Muxer, ArrayBufferTarget } = await loadMp4Muxer();
      const encodeWidth = evenDimension(payload.canvas.width);
      const encodeHeight = evenDimension(payload.canvas.height);
      const fps = sampleFps();
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: "avc", width: encodeWidth, height: encodeHeight },
        fastStart: "in-memory"
      });

      let encoderError = null;
      const encoder = new VideoEncoderCtor({
        output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
        error: (error) => {
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

      const canvas = document.createElement("canvas");
      canvas.width = encodeWidth;
      canvas.height = encodeHeight;

      try {
        for (let index = 0; index < frames.length; index += 1) {
          await drawSvgToCanvas(frames[index], canvas, encodeWidth, encodeHeight);
          const frameTime = frameTimes.length ? Number(frameTimes[index] || 0) : Math.min(payload.duration, index / fps);
          const frameDuration = sampleFrameDuration(index);
          const frame = new VideoFrameCtor(canvas, {
            timestamp: Math.max(0, Math.round(frameTime * 1_000_000)),
            duration: Math.max(1, Math.round(frameDuration * 1_000_000))
          });

          encoder.encode(frame, { keyFrame: index % Math.max(1, fps * 2) === 0 });
          frame.close();

          if (encoderError) throw encoderError;
          if (index % 5 === 0 || index === frames.length - 1) {
            if (meta) meta.textContent = "Encoding MP4 " + Math.round(((index + 1) / frames.length) * 100) + "%";
            await yieldToBrowser();
          }
        }

        await encoder.flush();
        if (encoderError) throw encoderError;
        encoder.close();
        muxer.finalize();
        downloadBlob(new Blob([target.buffer], { type: "video/mp4" }), payload.fileBase + ".mp4");
      } catch (error) {
        try {
          encoder.close();
        } catch {}
        throw error;
      }
    }

    async function exportCurrent(format) {
      if (exportBusy) return;
      const resumePlayback = state.playing;
      if (resumePlayback) pause();
      exportBusy = true;
      render();
      try {
        if (format === "svg") {
          downloadText(payload.fileBase + "-t" + timeLabel(state.time) + ".svg", currentFrameSvg(), "image/svg+xml;charset=utf-8");
          flashMeta("Saved SVG");
          return;
        }
        if (format === "json") {
          downloadText(payload.fileBase + ".visual.json", JSON.stringify(payload.document, null, 2) + "\\n", "application/json;charset=utf-8");
          flashMeta("Saved JSON");
          return;
        }
        if (format === "html") {
          downloadText(payload.fileBase + ".embed.html", "<!doctype html>\\n" + document.documentElement.outerHTML, "text/html;charset=utf-8");
          flashMeta("Saved HTML");
          return;
        }
        if (format === "png" || format === "jpg") {
          const blob = await rasterBlob(format);
          downloadBlob(blob, payload.fileBase + "-t" + timeLabel(state.time) + "." + format);
          flashMeta("Saved " + format.toUpperCase());
          return;
        }
        if (format === "mp4") {
          await exportMp4();
          flashMeta("Saved MP4");
          return;
        }
        throw new Error("Unsupported export format: " + format);
      } catch (error) {
        flashMeta(error && error.message ? error.message : "Export failed.");
        throw error;
      } finally {
        exportBusy = false;
        render();
        if (resumePlayback && !state.playing) play();
        if (exportRoot) exportRoot.open = false;
      }
    }

    playButton.addEventListener("click", () => {
      if (state.playing) pause();
      else play();
    });

    slider.addEventListener("input", () => {
      seek(Number(slider.value || 0), false);
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      const button = target && typeof target.closest === "function"
        ? target.closest("[data-export-format]")
        : null;
      const format = button && button.getAttribute ? button.getAttribute("data-export-format") : "";
      if (format) {
        exportCurrent(format).catch(() => {});
      }
    });

    window.addEventListener("message", (event) => {
      const message = event.data || {};
      if (message.type === "sketchmark-show" && typeof message.time === "number") {
        seek(message.time, true);
        return;
      }
      if (message.type === "sketchmark-play") {
        play();
        return;
      }
      if (message.type === "sketchmark-pause") {
        pause();
        return;
      }
      if (message.type === "sketchmark-export" && typeof message.format === "string") {
        exportCurrent(message.format).catch(() => {});
      }
    });

    window.__SKETCHMARK_EMBED__ = {
      play,
      pause,
      seek,
      export: exportCurrent,
      getState: () => ({
        time: state.time,
        duration: payload.duration,
        playing: state.playing,
        frameCount: Array.isArray(payload.frames) ? payload.frames.length : 0
      })
    };

    render();
    notifyRendered();
    if (payload.autoplay && payload.duration > 0) play();
  </script>
</body>
</html>`;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sampledFrameCount(duration: number, fps: number, maxFrames: number): number {
  if (!(duration > 0)) return 1;
  return Math.max(2, Math.min(maxFrames, Math.ceil(duration * fps) + 1));
}

function frameTimeAt(index: number, frameCount: number, duration: number): number {
  if (frameCount <= 1 || duration <= 0) return 0;
  return (index / (frameCount - 1)) * duration;
}

function frameIndexForTime(time: number, frameTimes: number[]): number {
  if (!frameTimes.length) return 0;
  const clamped = clamp(time, 0, Math.max(0, Number(frameTimes[frameTimes.length - 1] ?? 0)));
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let index = 0; index < frameTimes.length; index += 1) {
    const delta = Math.abs(Number(frameTimes[index] ?? 0) - clamped);
    if (delta <= bestDelta) {
      bestIndex = index;
      bestDelta = delta;
    } else if (Number(frameTimes[index] ?? 0) > clamped) {
      break;
    }
  }
  return bestIndex;
}

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "sketchmark";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function inlineMp4MuxerRuntime(source: string): string {
  const withoutExportBlock = source.replace(/\s*export\s*\{[\s\S]*?\}\s*;?\s*$/, "");
  const runtime = `${withoutExportBlock}
globalThis.__SKETCHMARK_MP4_MUXER__ = {
  ArrayBufferTarget,
  FileSystemWritableFileStreamTarget,
  Muxer,
  StreamTarget
};`;
  return escapeInlineScript(runtime);
}

function escapeInlineScript(value: string): string {
  return value.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}
