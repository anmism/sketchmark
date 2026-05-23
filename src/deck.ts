import type { ResolvedVisualDocument, VisualDocument, VisualElement } from "./types";
import { documentForScene } from "./scenes";
import { resolveVisualFrame } from "./normalize";
import { clone } from "./utils";
import { renderToSvg } from "./render/svg";

export function documentForDeckStep(document: VisualDocument, sceneId: string, stepIndex: number): VisualDocument {
  const scene = document.scenes?.[sceneId];
  if (!scene) throw new Error(`Unknown scene '${sceneId}'.`);
  const frame = documentForScene(document, sceneId);
  const activeSteps = (scene.steps ?? []).slice(0, Math.max(0, stepIndex + 1));
  if (!activeSteps.length) return frame;
  const hidden = new Set<string>();
  const shown = new Set<string>();
  for (const step of activeSteps) {
    for (const id of step.hide ?? []) hidden.add(id);
    for (const id of step.show ?? []) {
      hidden.delete(id);
      shown.add(id);
    }
  }
  frame.elements = applyDeckVisibility(frame.elements ?? [], hidden, shown);
  return frame;
}

export function resolvedFrameForDeckStep(document: VisualDocument, sceneId: string, stepIndex: number, time = 0): ResolvedVisualDocument {
  return resolveVisualFrame(documentForDeckStep(document, sceneId, stepIndex), time);
}

export function renderDeckToHtml(document: VisualDocument, sceneId: string): string {
  const scene = document.scenes?.[sceneId];
  if (!scene) throw new Error(`Unknown scene '${sceneId}'.`);
  const steps = scene.steps ?? [];
  const frameCount = Math.max(1, steps.length + 1);
  const frames = Array.from({ length: frameCount }, (_, index) => {
    const stepIndex = index - 1;
    const frame = stepIndex < 0 ? documentForScene(document, sceneId) : documentForDeckStep(document, sceneId, stepIndex);
    return renderToSvg(frame);
  });
  const labels = ["Base", ...steps.map((step) => step.id)];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(sceneId)} Deck</title><style>
html,body{margin:0;width:100%;height:100%;background:#111827;color:#e5e7eb;font-family:Inter,Arial,sans-serif}
body{display:grid;grid-template-rows:1fr auto}
main{display:grid;place-items:center;padding:24px}
#stage svg{max-width:min(100vw,${document.canvas.width}px);max-height:calc(100vh - 112px);background:white;box-shadow:0 20px 50px rgba(0,0,0,.35)}
footer{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#020617;border-top:1px solid #1f2937}
button{border:0;border-radius:6px;padding:8px 12px;background:#2563eb;color:#fff;font-weight:700}
button:disabled{opacity:.45}
code{color:#93c5fd}
</style></head><body><main><div id="stage"></div></main><footer><button id="prev">Prev</button><button id="next">Next</button><span id="count"></span><code id="label"></code></footer><script>
const frames=${JSON.stringify(frames)};
const labels=${JSON.stringify(labels)};
let index=0;
const stage=document.getElementById("stage");
const prev=document.getElementById("prev");
const next=document.getElementById("next");
const count=document.getElementById("count");
const label=document.getElementById("label");
function show(){
  stage.innerHTML=frames[index];
  prev.disabled=index===0;
  next.disabled=index===frames.length-1;
  count.textContent=(index+1)+" / "+frames.length;
  label.textContent=labels[index] || "";
}
prev.addEventListener("click",()=>{ index=Math.max(0,index-1); show(); });
next.addEventListener("click",()=>{ index=Math.min(frames.length-1,index+1); show(); });
window.addEventListener("keydown",(event)=>{ if(event.key==="ArrowRight") next.click(); if(event.key==="ArrowLeft") prev.click(); });
show();
</script></body></html>`;
}

function applyDeckVisibility(elements: VisualElement[], hidden: Set<string>, shown: Set<string>): VisualElement[] {
  return elements.map((element) => {
    const next = clone(element);
    if (next.id && hidden.has(next.id)) next.opacity = 0;
    if (next.id && shown.has(next.id) && next.opacity === 0) next.opacity = 1;
    if (next.type === "group" && Array.isArray(next.children)) next.children = applyDeckVisibility(next.children, hidden, shown);
    return next;
  });
}

function escapeHtml(value: string): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
