import { render } from 'sketchmark';

// ── DSL string — keep it at the top level of the file,
//   NOT indented inside render({}) or you get leading spaces
//   that confuse the parser.
const dsl = `
diagram
title label="System Architecture"
layout row
config gap=60

theme primary fill="#e8f4ff" stroke="#0044cc" color="#003399"
theme success fill="#e8ffe8" stroke="#007700" color="#004400"
theme warning fill="#fff9e6" stroke="#f0a500" color="#7a5000"
theme muted   fill="#f5f5f5" stroke="#999999" color="#444444"

box client  label="Client App"   theme=primary width=140 height=55
box gateway label="API Gateway"  theme=warning width=140 height=55

group services label="Services" layout=column gap=16 padding=30 theme=muted
{
  box auth  label="Auth Service"  theme=primary width=130 height=50
  box data  label="Data Service"  theme=primary width=130 height=50
}

cylinder db label="PostgreSQL" theme=success width=140 height=65

client  --> gateway label="HTTPS"
gateway --> auth
gateway --> data
auth    --> db label="SQL"
data    --> db label="SQL"

step highlight client
step draw client-->gateway
step highlight gateway
step draw gateway-->auth
step draw gateway-->data
step highlight auth
step draw auth-->db
step highlight db
end
`.trim();

// ── Render ────────────────────────────────────────────────
const instance = render({
  container:  document.getElementById('diagram') as HTMLElement,
  dsl,
  renderer:   'svg',
  svgOptions: {
    showTitle:   true,
    interactive: true,
    theme:       'light',
    transparent: true,
    onNodeClick: (id) => console.log('clicked:', id),
  },
});

// ── Wire up the animation controls ───────────────────────
const { anim } = instance;

const stepInfo = document.getElementById('step-info')!;
const btnPrev  = document.getElementById('btn-prev')  as HTMLButtonElement;
const btnNext  = document.getElementById('btn-next')  as HTMLButtonElement;
const btnPlay  = document.getElementById('btn-play')  as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;

function syncUI() {
  btnPrev.disabled = !anim.canPrev;
  btnNext.disabled = !anim.canNext;

  if (!anim.total) {
    stepInfo.textContent = 'no steps';
  } else if (anim.currentStep < 0) {
    stepInfo.textContent = `${anim.total} steps`;
  } else {
    stepInfo.textContent = `${anim.currentStep + 1} / ${anim.total}`;
  }
}

syncUI();

btnReset.addEventListener('click', () => { anim.reset(); syncUI(); });
btnPrev .addEventListener('click', () => { anim.prev();  syncUI(); });
btnNext .addEventListener('click', () => { anim.next();  syncUI(); });

btnPlay.addEventListener('click', async () => {
  btnPlay.disabled = true;
  btnPlay.textContent = '⏳ Playing';
  await anim.play(700);   // 700ms per step
  syncUI();
  btnPlay.disabled    = false;
  btnPlay.textContent = '▶ Play';
});

// optional — listen to step events
anim.on((event) => {
  console.log(event.type, event.stepIndex, event.step);
});
