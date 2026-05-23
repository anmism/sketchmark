export interface RawThreeModuleOptions {
  width: number;
  height: number;
  moduleUrl: string;
  background?: string;
}

export function renderRawThreeModuleHtml(options: RawThreeModuleOptions): string {
  const background = options.background ?? "#ffffff";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sketchmark Raw Three Module</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${escapeCss(background)}}canvas{display:block}</style></head><body><canvas id="stage"></canvas><script type="module">
import { createSketchmarkThreeScene } from ${JSON.stringify(options.moduleUrl)};
const canvas = document.getElementById("stage");
const runtime = await createSketchmarkThreeScene({ canvas, width: ${Number(options.width)}, height: ${Number(options.height)}, background: ${JSON.stringify(background)} });
if (runtime && typeof runtime.render === "function") runtime.render(0);
window.__SKETCHMARK_SHOW_TIME__ = (time) => runtime && typeof runtime.render === "function" ? runtime.render(time || 0) : undefined;
window.__SKETCHMARK_READY__ = true;
</script></body></html>`;
}

function escapeCss(value: string): string {
  return String(value).replace(/[<>"'()\\]/g, "");
}
