// ── Keep all DSL strings in one file ─────────────────────────────────────
// Rules:
//   1. Always use .trim() — strips the leading newline from the opening backtick
//   2. Never indent the DSL content — leading spaces break the parser
//   3. This file has no imports so it's safe to use in both server and client components

export const ARCHITECTURE_DSL = `
diagram
title label="How the Internet Delivers a Webpage"
layout row
config gap=50
config pointer=chalk
config tts=on

# Define named themes
theme primary fill="#e8f4ff" stroke="#0044cc" color="#003399"
theme success fill="#e8ffe8" stroke="#007700" color="#004400"
theme warning fill="#fff9e6" stroke="#f0a500" color="#7a5000"
theme muted   fill="#f5f5f5" stroke="#999999" color="#444444"

box you     label="You"              theme=warning width=120 height=50
box browser label="Browser"          theme=primary width=120 height=50
box dns     label="DNS\nServer"      theme=muted   width=120 height=55
box server  label="Web\nServer"      theme=success width=120 height=55
box html    label="HTML\nCSS JS"     theme=primary width=120 height=55
box screen  label="Rendered\nPage"   theme=warning width=120 height=55

you     --> browser label="types URL"
browser --> dns     label="lookup"
dns     --> browser label="IP address"
browser --> server  label="request"
server  --> html    label="responds"
html    --> screen  label="renders"

# Animation with narration, annotations, beats, and pacing
step narrate "You type a website address into your browser" pace=slow
step draw you
step draw browser
step draw you-->browser
step underline you
step narrate "The browser asks a DNS server — the internet's phone book"
step draw dns
step draw browser-->dns
step circle dns
step narrate "DNS translates the domain name into an IP address"
step draw dns-->browser
step narrate "Now the browser knows WHERE to go" pace=slow
beat {
  step draw server
  step draw browser-->server
}
step narrate "It sends a request to the web server at that address"
step underline server
step narrate "The server responds with HTML, CSS, and JavaScript" pace=slow
beat {
  step draw html
  step draw server-->html
}
step circle html
step narrate "The browser assembles everything into the page you see"
step draw html-->screen
step draw screen pace=slow
step bracket html screen
step narrate "All of this happens in under a second!" pace=pause
end
`.trim();

export const SIMPLE_DSL = `
diagram
box a label="Hello"
box b label="World"
a -> b label="connects"
end
`.trim();
