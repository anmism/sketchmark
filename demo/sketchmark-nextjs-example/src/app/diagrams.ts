// ── Keep all DSL strings in one file ─────────────────────────────────────
// Rules:
//   1. Always use .trim() — strips the leading newline from the opening backtick
//   2. Never indent the DSL content — leading spaces break the parser
//   3. This file has no imports so it's safe to use in both server and client components

export const ARCHITECTURE_DSL = `
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

export const SIMPLE_DSL = `
diagram
box a label="Hello"
box b label="World"
a -> b label="connects"
end
`.trim();
