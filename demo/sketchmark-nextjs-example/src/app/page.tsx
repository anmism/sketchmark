// This is a SERVER component (no 'use client').
// It can import DSL strings safely because diagrams.ts has no browser APIs.
// The actual rendering happens inside SketchmarkDiagram which IS a client component.

import SketchmarkDiagram from '@/components/SketchmarkDiagram';
import { ARCHITECTURE_DSL, SIMPLE_DSL } from './diagrams';

export default function Home() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px' }}>

    <h1>✏ sketchmark</h1>
      <p style={{ fontSize: 13, color: '#9a7848', marginBottom: 48 }}>
        Hand-drawn diagrams from plain text — Next.js example
      </p>

      {/* ── Example 1: full architecture diagram ── */}
      <section style={{ marginBottom: 64 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1a1208', marginBottom: 16 }}>
          Architecture diagram with animation
        </h2>
        <SketchmarkDiagram
          dsl={ARCHITECTURE_DSL}
          showTitle
          showControls
        />
      </section>

      {/* ── Example 2: simple diagram, no controls ── */}
      <section style={{ marginBottom: 64 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1a1208', marginBottom: 16 }}>
          Simple diagram (no controls)
        </h2>
        <SketchmarkDiagram
          dsl={SIMPLE_DSL}
          showTitle={false}
          showControls={false}
        />
      </section>

      {/* ── Example 3: inline DSL ── */}
      <section style={{ marginBottom: 64 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1a1208', marginBottom: 16 }}>
          Inline DSL (sketch theme)
        </h2>
        {/*
          When writing DSL inline, use .trim() and keep lines flush-left.
          The backtick must be on its own line so the first DSL line
          has no leading whitespace.
        */}
        <SketchmarkDiagram
          showControls
          dsl={`
diagram
config theme=sketch
config font=caveat
layout row
config gap=50

box client  label="Browser"   width=130 height=52
box server  label="Next.js"   width=130 height=52
cylinder db label="Database"  width=130 height=62

client --> server label="request"
server --> db     label="query"
db     --> server label="rows"
server --> client label="response"

step highlight client
step draw client-->server
step highlight server
step draw server-->db
step draw db-->server
step draw server-->client
step highlight client
end
`.trim()}
        />
      </section>

    </main>
  );
}
