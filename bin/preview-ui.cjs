"use strict";

function previewHtml(title) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sketchmark Preview - ${escapeHtml(title)}</title><style>
@font-face{font-family:'Roboto';src:url('/fonts/Roboto-Light.ttf') format('truetype');font-weight:300;font-style:normal;font-display:swap}
@font-face{font-family:'Roboto';src:url('/fonts/Roboto-Regular.ttf') format('truetype');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Roboto';src:url('/fonts/Roboto-Bold.ttf') format('truetype');font-weight:700;font-style:normal;font-display:swap}
html,body{margin:0;width:100%;height:100%;background:#0f172a;color:#e2e8f0;font:14px/1.4 Roboto,Arial,sans-serif}
body{display:grid;grid-template-rows:1fr auto}
#stage{display:grid;place-items:center;min-height:0;padding:24px}
#stage svg{max-width:100%;max-height:100%;box-shadow:0 24px 80px rgba(0,0,0,.35)}
#controls{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:14px 18px;background:#111827;border-top:1px solid rgba(255,255,255,.08)}
button{width:42px;height:34px;border:1px solid rgba(255,255,255,.18);border-radius:6px;background:#f8fafc;color:#0f172a;font-weight:800;cursor:pointer}
input{width:100%;accent-color:#38bdf8}
#clock{font-variant-numeric:tabular-nums;min-width:110px;text-align:right;color:#cbd5e1}
#error{position:absolute;left:16px;top:16px;right:16px;color:#fecaca}
</style></head><body><div id="stage"><div id="error"></div></div><div id="controls"><button id="play" aria-label="Play">Play</button><input id="time" type="range" min="0" max="1" step="0.001" value="0"><div id="clock">0.00 / 0.00</div></div><script>
const stage = document.getElementById("stage");
const errorBox = document.getElementById("error");
const play = document.getElementById("play");
const slider = document.getElementById("time");
const clock = document.getElementById("clock");
let duration = 0;
let current = 0;
let playing = false;
let last = 0;
async function frame(time) {
  const response = await fetch("/api/frame?time=" + encodeURIComponent(time), { cache: "no-store" });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Preview failed.");
  duration = Number(data.duration || 0);
  stage.innerHTML = data.svg + "<div id=\\"error\\"></div>";
  slider.max = String(Math.max(duration, 0.001));
  slider.value = String(time);
  clock.textContent = time.toFixed(2) + " / " + duration.toFixed(2);
}
async function draw(time) {
  try {
    errorBox.textContent = "";
    await frame(time);
  } catch (error) {
    const box = document.getElementById("error") || errorBox;
    box.textContent = error.message || String(error);
  }
}
function tick(now) {
  if (!playing) return;
  if (!last) last = now;
  current += (now - last) / 1000;
  last = now;
  if (duration > 0) current = current % duration;
  draw(current);
  requestAnimationFrame(tick);
}
play.addEventListener("click", () => {
  playing = !playing;
  play.textContent = playing ? "Pause" : "Play";
  last = 0;
  if (playing) requestAnimationFrame(tick);
});
slider.addEventListener("input", () => {
  current = Number(slider.value || 0);
  draw(current);
});
draw(0);
</script></body></html>`;
}


function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

module.exports = { previewHtml };
