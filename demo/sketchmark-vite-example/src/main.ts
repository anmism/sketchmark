import { SketchmarkEmbed } from "sketchmark";

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
box auth    label="Auth Service" theme=primary width=130 height=50
box data    label="Data Service" theme=primary width=130 height=50
group services label="Services" layout=column gap=16 padding=30 theme=muted items=[auth,data]

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

const embed = new SketchmarkEmbed({
  container: document.getElementById("embed-root") as HTMLElement,
  dsl,
  width: "min(100%, 920px)",
  height: 540,
  playStepDelay: 700,
  focusPadding: 28,
  focusDuration: 240,
  showControls: true,
  theme: "light",
  svgOptions: {
    showTitle: true,
    interactive: true,
    theme: "light",
    transparent: true,
  },
});

document.getElementById("btn-svg")?.addEventListener("click", () => {
  embed.exportSVG("vite-example.svg");
});

document.getElementById("btn-png")?.addEventListener("click", () => {
  void embed.exportPNG("vite-example.png");
});
