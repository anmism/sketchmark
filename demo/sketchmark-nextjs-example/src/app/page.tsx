import SketchmarkDiagram from "@/components/SketchmarkDiagram";
import { ARCHITECTURE_DSL, SIMPLE_DSL } from "./diagrams";

const sectionTitle = {
  fontFamily: "Georgia, serif",
  fontSize: 22,
  color: "#1a1208",
  marginBottom: 14,
} as const;

const sectionText = {
  margin: "0 0 18px",
  color: "#6d5332",
  fontSize: 14,
  lineHeight: 1.6,
  maxWidth: 720,
} as const;

export default function Home() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 24px 72px" }}>
      <p
        style={{
          margin: "0 0 12px",
          color: "#9a7848",
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Next.js App Router
      </p>

      <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.05, color: "#1a1208" }}>
        Sketchmark embeds in React
      </h1>

      <p style={{ ...sectionText, marginTop: 14, marginBottom: 52 }}>
        These examples mount the reusable <code>SketchmarkEmbed</code> widget from a
        client component. The diagram stays inside a fixed frame, clips overflow,
        and can keep the active animation target in view.
      </p>

      <section style={{ marginBottom: 68 }}>
        <h2 style={sectionTitle}>Animated architecture embed</h2>
        <p style={sectionText}>
          This example keeps the built-in playback controls visible and uses a
          taller frame so the camera has room to follow the highlighted steps.
        </p>
        <SketchmarkDiagram
          dsl={ARCHITECTURE_DSL}
          showTitle
          showControls
          width="min(100%, 960px)"
          height={560}
        />
      </section>

      <section style={{ marginBottom: 68 }}>
        <h2 style={sectionTitle}>Static clipped embed</h2>
        <p style={sectionText}>
          The same component can also render a smaller static frame with controls
          hidden when you only want an inline diagram.
        </p>
        <SketchmarkDiagram
          dsl={SIMPLE_DSL}
          showTitle={false}
          showControls={false}
          showExports={false}
          width="min(100%, 420px)"
          height={220}
        />
      </section>

      <section>
        <h2 style={sectionTitle}>Inline DSL example</h2>
        <p style={sectionText}>
          You can still pass raw DSL directly to the component. Just keep the DSL
          lines flush-left before calling <code>.trim()</code>.
        </p>
        <SketchmarkDiagram
          showControls
          width="min(100%, 860px)"
          height={460}
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
