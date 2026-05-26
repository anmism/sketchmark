const fs = require("node:fs");
const path = require("node:path");

let compileKeyframeStates;
try {
  ({ compileKeyframeStates } = require("../dist/src"));
} catch {
  throw new Error("Run `npm run build` before this example so dist/src is available.");
}

const width = 1920;
const height = 1080;
const duration = 60;

function roundedRect(x, y, w, h, r) {
  return `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}

function circlePath(cx, cy, r) {
  const c = r * 0.5522847498;
  return [
    `M ${cx + r} ${cy}`,
    `C ${cx + r} ${cy + c} ${cx + c} ${cy + r} ${cx} ${cy + r}`,
    `C ${cx - c} ${cy + r} ${cx - r} ${cy + c} ${cx - r} ${cy}`,
    `C ${cx - r} ${cy - c} ${cx - c} ${cy - r} ${cx} ${cy - r}`,
    `C ${cx + c} ${cy - r} ${cx + r} ${cy - c} ${cx + r} ${cy}`,
    "Z"
  ].join(" ");
}

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function textElement(id, x, y, text, style = {}) {
  return { id, type: "text", x, y, text, ...style };
}

function group(id, x, y, children, extra = {}) {
  return { id, type: "group", x, y, children, ...extra };
}

// Logo mark - a pen/brush stroke that forms an "S"
const logoPath = "M -30 -40 Q -10 -50 10 -30 Q 30 -10 10 10 Q -10 30 10 40 Q 20 45 30 40";

const c = {
  bg: "#0a0a0f",
  accent: "#6366f1",    // indigo
  accent2: "#a78bfa",   // purple
  accent3: "#38bdf8",   // sky
  green: "#34d399",
  amber: "#fbbf24",
  rose: "#fb7185",
  text: "#f8fafc",
  dim: "#64748b",
  card: "#1e1b4b",
  code: "#1e293b"
};

const baseDocument = {
  version: 1,
  canvas: { width, height, background: c.bg, duration, fps: 30 },
  elements: [
    // ===================== SCENE 1: TITLE REVEAL (0-8s) =====================

    // Background glow
    group("bg_glow", width / 2, height / 2, [
      pathElement("bg_glow_circle", circlePath(0, 0, 400), {
        fill: { type: "radialGradient", center: [0, 0], radius: 400, stops: [[0, "#6366f140"], [1, "#6366f100"]] },
        opacity: 0
      })
    ]),

    // Logo
    group("logo", width / 2, height / 2 - 80, [
      pathElement("logo_mark", logoPath, {
        fill: "none", stroke: c.accent, strokeWidth: 6, strokeCap: "round",
        drawEnd: 0, opacity: 0, origin: [0, 0]
      })
    ]),

    // Title text
    group("title_main", width / 2, height / 2 + 20, [
      textElement("title_text", 0, 0, "sketchmark", {
        fill: c.text, fontSize: 72, fontFamily: "Inter, sans-serif", weight: 700,
        align: "center", opacity: 0
      })
    ]),

    // Tagline
    group("tagline", width / 2, height / 2 + 80, [
      textElement("tagline_text", 0, 0, "The world's first visual language for AI agents", {
        fill: c.accent2, fontSize: 28, fontFamily: "Inter, sans-serif", weight: 400,
        align: "center", opacity: 0
      })
    ]),

    // ===================== SCENE 2: THE PROBLEM (8-18s) =====================

    // "The Problem" header
    group("problem_header", width / 2, 120, [
      textElement("problem_title", 0, 0, "The Problem", {
        fill: c.rose, fontSize: 42, fontFamily: "Inter, sans-serif", weight: 700,
        align: "center", opacity: 0
      })
    ]),

    // AI agent icon (robot head)
    group("ai_agent", 500, 500, [
      pathElement("agent_head", roundedRect(-60, -70, 120, 120, 16), {
        fill: "none", stroke: c.dim, strokeWidth: 3, opacity: 0
      }),
      pathElement("agent_eye_l", circlePath(-25, -30, 10), { fill: c.dim, opacity: 0 }),
      pathElement("agent_eye_r", circlePath(25, -30, 10), { fill: c.dim, opacity: 0 }),
      pathElement("agent_mouth", `M -25 15 L 25 15`, { fill: "none", stroke: c.dim, strokeWidth: 3, strokeCap: "round", opacity: 0 }),
      pathElement("agent_antenna", `M 0 -70 L 0 -90 M -8 -90 L 8 -90`, { fill: "none", stroke: c.dim, strokeWidth: 3, strokeCap: "round", opacity: 0 }),
    ]),

    // Text output (what AI currently does)
    group("text_output", 500, 680, [
      textElement("text_out_1", 0, 0, "{ \"response\": \"Here's a chart...\" }", {
        fill: c.dim, fontSize: 16, fontFamily: "monospace", align: "center", opacity: 0
      }),
      textElement("text_out_2", 0, 25, "// But no actual visual output", {
        fill: c.rose, fontSize: 14, fontFamily: "monospace", align: "center", opacity: 0
      })
    ]),

    // Red X over visual attempt
    group("no_visual", 1400, 500, [
      pathElement("no_vis_box", roundedRect(-150, -120, 300, 240, 12), {
        fill: "none", stroke: c.dim, strokeWidth: 2, dashArray: [6, 4], opacity: 0
      }),
      textElement("no_vis_text", 0, -80, "Visual Output", {
        fill: c.dim, fontSize: 18, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      }),
      pathElement("no_vis_x1", `M -60 -30 L 60 70`, { fill: "none", stroke: c.rose, strokeWidth: 4, opacity: 0, strokeCap: "round" }),
      pathElement("no_vis_x2", `M 60 -30 L -60 70`, { fill: "none", stroke: c.rose, strokeWidth: 4, opacity: 0, strokeCap: "round" }),
      textElement("no_vis_label", 0, 120, "No standard format exists", {
        fill: c.rose, fontSize: 16, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      }),
    ]),

    // Arrow from agent to outputs
    group("problem_arrow", 700, 500, [
      pathElement("p_arrow_path", `M 0 0 L 180 0 M 170 -10 L 180 0 L 170 10`, {
        fill: "none", stroke: c.dim, strokeWidth: 2, strokeCap: "round", opacity: 0
      })
    ]),

    // ===================== SCENE 3: THE SOLUTION (18-30s) =====================

    // "The Solution" header
    group("solution_header", width / 2, 120, [
      textElement("solution_title", 0, 0, "The Solution", {
        fill: c.green, fontSize: 42, fontFamily: "Inter, sans-serif", weight: 700,
        align: "center", opacity: 0
      })
    ]),

    // JSON code block
    group("json_block", 350, 400, [
      pathElement("json_bg", roundedRect(-200, -180, 400, 500, 12), {
        fill: c.code, opacity: 0
      }),
      textElement("json_header", 0, -155, "visual.json", {
        fill: c.accent3, fontSize: 14, fontFamily: "monospace", align: "center", opacity: 0
      }),
      textElement("json_l1", -170, -120, "{", { fill: c.dim, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l2", -170, -95, '  "version": 1,', { fill: c.text, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l3", -170, -70, '  "canvas": {', { fill: c.text, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l4", -170, -45, '    "width": 1920,', { fill: c.amber, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l5", -170, -20, '    "height": 1080', { fill: c.amber, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l6", -170, 5, "  },", { fill: c.text, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l7", -170, 30, '  "elements": [', { fill: c.text, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l8", -170, 55, "    {", { fill: c.text, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l9", -170, 80, '      "type": "path",', { fill: c.accent2, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l10", -170, 105, '      "fill": "#6366f1",', { fill: c.accent, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l11", -170, 130, '      "rotation": 45,', { fill: c.green, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l12", -170, 155, '      "origin": [0, 0]', { fill: c.amber, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l13", -170, 180, "    }", { fill: c.text, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l14", -170, 205, "  ]", { fill: c.text, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
      textElement("json_l15", -170, 230, "}", { fill: c.dim, fontSize: 14, fontFamily: "monospace", opacity: 0 }),
    ]),

    // Transform arrow
    group("transform_arrow", width / 2 + 50, height / 2, [
      pathElement("t_arrow", `M 0 0 L 120 0 M 110 -10 L 120 0 L 110 10`, {
        fill: "none", stroke: c.accent, strokeWidth: 3, strokeCap: "round", opacity: 0
      }),
      textElement("t_arrow_label", 60, -25, "render", {
        fill: c.accent, fontSize: 14, fontFamily: "monospace", align: "center", opacity: 0
      })
    ]),

    // Visual output - animated shapes
    group("visual_output", 1350, height / 2 - 30, [
      pathElement("vis_bg", roundedRect(-250, -220, 500, 500, 12), {
        fill: "#0f0f1a", opacity: 0
      }),
      // A rotating square
      group("demo_square", -80, -60, [
        pathElement("demo_sq_path", roundedRect(-40, -40, 80, 80, 8), {
          fill: c.accent, opacity: 0, origin: [0, 0]
        })
      ]),
      // A circle
      group("demo_circle", 80, -60, [
        pathElement("demo_circle_path", circlePath(0, 0, 40), {
          fill: c.green, opacity: 0, origin: [0, 0]
        })
      ]),
      // A text element
      group("demo_text", 0, 60, [
        textElement("demo_text_el", 0, 0, "Hello World", {
          fill: c.text, fontSize: 24, fontFamily: "Inter, sans-serif", weight: 600,
          align: "center", opacity: 0
        })
      ]),
      // Animated path with drawEnd
      group("demo_path_draw", 0, 140, [
        pathElement("demo_drawn_path", `M -100 0 Q -50 -40 0 0 Q 50 40 100 0`, {
          fill: "none", stroke: c.amber, strokeWidth: 3, strokeCap: "round",
          drawEnd: 0, opacity: 0, origin: [0, 0]
        })
      ]),
    ]),

    // ===================== SCENE 4: FEATURES (30-45s) =====================

    // Features header
    group("features_header", width / 2, 100, [
      textElement("features_title", 0, 0, "Built for AI Agents", {
        fill: c.text, fontSize: 42, fontFamily: "Inter, sans-serif", weight: 700,
        align: "center", opacity: 0
      })
    ]),

    // Feature cards
    // Card 1: JSON Schema
    group("feat_card1", 300, 350, [
      pathElement("fc1_bg", roundedRect(-140, -100, 280, 200, 12), { fill: c.card, opacity: 0 }),
      pathElement("fc1_border", roundedRect(-140, -100, 280, 200, 12), { fill: "none", stroke: c.accent, strokeWidth: 2, opacity: 0 }),
      pathElement("fc1_icon", `M -20 -50 L -20 -30 L 20 -30 L 20 -50 M -30 -30 L 30 -30 L 30 20 L -30 20 Z`, {
        fill: "none", stroke: c.accent, strokeWidth: 2, strokeCap: "round", opacity: 0
      }),
      textElement("fc1_title", 0, 40, "Structured JSON", {
        fill: c.text, fontSize: 18, fontFamily: "Inter, sans-serif", weight: 600, align: "center", opacity: 0
      }),
      textElement("fc1_desc", 0, 68, "Strict schema validation", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      }),
    ]),

    // Card 2: Animation
    group("feat_card2", 700, 350, [
      pathElement("fc2_bg", roundedRect(-140, -100, 280, 200, 12), { fill: c.card, opacity: 0 }),
      pathElement("fc2_border", roundedRect(-140, -100, 280, 200, 12), { fill: "none", stroke: c.accent2, strokeWidth: 2, opacity: 0 }),
      pathElement("fc2_icon", `M -25 -40 L -25 -55 L 25 -55 L 25 -40 L -25 -40 M -25 -40 L -25 10 M 25 -40 L 25 10 M -25 10 L 25 10`, {
        fill: "none", stroke: c.accent2, strokeWidth: 2, strokeCap: "round", opacity: 0
      }),
      // Play triangle
      pathElement("fc2_play", `M -8 -50 L -8 -30 L 8 -40 Z`, {
        fill: c.accent2, opacity: 0
      }),
      textElement("fc2_title", 0, 40, "Timeline Animation", {
        fill: c.text, fontSize: 18, fontFamily: "Inter, sans-serif", weight: 600, align: "center", opacity: 0
      }),
      textElement("fc2_desc", 0, 68, "Keyframes & easing curves", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      }),
    ]),

    // Card 3: Export
    group("feat_card3", 1100, 350, [
      pathElement("fc3_bg", roundedRect(-140, -100, 280, 200, 12), { fill: c.card, opacity: 0 }),
      pathElement("fc3_border", roundedRect(-140, -100, 280, 200, 12), { fill: "none", stroke: c.accent3, strokeWidth: 2, opacity: 0 }),
      pathElement("fc3_icon", `M -20 -55 L -20 -25 L 20 -25 L 20 -55 Z M 0 -25 L 0 10 M -10 0 L 0 10 L 10 0`, {
        fill: "none", stroke: c.accent3, strokeWidth: 2, strokeCap: "round", opacity: 0
      }),
      textElement("fc3_title", 0, 40, "Multi-Format Export", {
        fill: c.text, fontSize: 18, fontFamily: "Inter, sans-serif", weight: 600, align: "center", opacity: 0
      }),
      textElement("fc3_desc", 0, 68, "SVG, HTML, Video, PNG", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      }),
    ]),

    // Card 4: Gradients & Effects
    group("feat_card4", 1500, 350, [
      pathElement("fc4_bg", roundedRect(-140, -100, 280, 200, 12), { fill: c.card, opacity: 0 }),
      pathElement("fc4_border", roundedRect(-140, -100, 280, 200, 12), { fill: "none", stroke: c.amber, strokeWidth: 2, opacity: 0 }),
      pathElement("fc4_icon", circlePath(0, -40, 20), {
        fill: { type: "radialGradient", center: [0, -40], radius: 20, stops: [[0, c.amber], [1, c.rose]] },
        opacity: 0
      }),
      textElement("fc4_title", 0, 40, "Rich Styling", {
        fill: c.text, fontSize: 18, fontFamily: "Inter, sans-serif", weight: 600, align: "center", opacity: 0
      }),
      textElement("fc4_desc", 0, 68, "Gradients, effects, masks", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      }),
    ]),

    // Feature list below cards
    group("feature_list", width / 2, 600, [
      textElement("fl1", 0, 0, "Paths  ·  Text  ·  Images  ·  Groups  ·  Transforms", {
        fill: c.text, fontSize: 20, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      }),
      textElement("fl2", 0, 35, "Rotation with origin anchors  ·  Scale  ·  Opacity  ·  Draw animation", {
        fill: c.dim, fontSize: 16, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      }),
      textElement("fl3", 0, 70, "Linear & radial gradients  ·  Blur  ·  Shadow  ·  Clip & mask", {
        fill: c.dim, fontSize: 16, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      }),
    ]),

    // ===================== SCENE 5: PIPELINE (45-52s) =====================

    group("pipeline_header", width / 2, 150, [
      textElement("pipeline_title", 0, 0, "How It Works", {
        fill: c.text, fontSize: 42, fontFamily: "Inter, sans-serif", weight: 700,
        align: "center", opacity: 0
      })
    ]),

    // Pipeline: AI Agent -> JSON -> Render Engine -> Output
    group("pipe_ai", 250, 500, [
      pathElement("pipe_ai_bg", roundedRect(-100, -60, 200, 120, 12), { fill: c.card, opacity: 0 }),
      pathElement("pipe_ai_border", roundedRect(-100, -60, 200, 120, 12), { fill: "none", stroke: c.accent3, strokeWidth: 2, opacity: 0 }),
      textElement("pipe_ai_icon", 0, -10, "AI", { fill: c.accent3, fontSize: 32, fontFamily: "Inter, sans-serif", weight: 700, align: "center", opacity: 0 }),
      textElement("pipe_ai_label", 0, 30, "Agent", { fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center", opacity: 0 }),
    ]),

    group("pipe_arrow1", 450, 500, [
      pathElement("pipe_a1", `M 0 0 L 80 0 M 70 -10 L 80 0 L 70 10`, {
        fill: "none", stroke: c.dim, strokeWidth: 2, strokeCap: "round", opacity: 0
      })
    ]),

    group("pipe_json", 650, 500, [
      pathElement("pipe_json_bg", roundedRect(-100, -60, 200, 120, 12), { fill: c.card, opacity: 0 }),
      pathElement("pipe_json_border", roundedRect(-100, -60, 200, 120, 12), { fill: "none", stroke: c.accent, strokeWidth: 2, opacity: 0 }),
      textElement("pipe_json_icon", 0, -10, "{ }", { fill: c.accent, fontSize: 28, fontFamily: "monospace", weight: 700, align: "center", opacity: 0 }),
      textElement("pipe_json_label", 0, 30, "Sketchmark JSON", { fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center", opacity: 0 }),
    ]),

    group("pipe_arrow2", 850, 500, [
      pathElement("pipe_a2", `M 0 0 L 80 0 M 70 -10 L 80 0 L 70 10`, {
        fill: "none", stroke: c.dim, strokeWidth: 2, strokeCap: "round", opacity: 0
      })
    ]),

    group("pipe_render", 1050, 500, [
      pathElement("pipe_render_bg", roundedRect(-100, -60, 200, 120, 12), { fill: c.card, opacity: 0 }),
      pathElement("pipe_render_border", roundedRect(-100, -60, 200, 120, 12), { fill: "none", stroke: c.accent2, strokeWidth: 2, opacity: 0 }),
      textElement("pipe_render_icon", 0, -10, "▶", { fill: c.accent2, fontSize: 28, fontFamily: "Inter, sans-serif", align: "center", opacity: 0 }),
      textElement("pipe_render_label", 0, 30, "Render Engine", { fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center", opacity: 0 }),
    ]),

    group("pipe_arrow3", 1250, 500, [
      pathElement("pipe_a3", `M 0 0 L 80 0 M 70 -10 L 80 0 L 70 10`, {
        fill: "none", stroke: c.dim, strokeWidth: 2, strokeCap: "round", opacity: 0
      })
    ]),

    group("pipe_output", 1450, 500, [
      pathElement("pipe_out_bg", roundedRect(-120, -60, 240, 120, 12), { fill: c.card, opacity: 0 }),
      pathElement("pipe_out_border", roundedRect(-120, -60, 240, 120, 12), { fill: "none", stroke: c.green, strokeWidth: 2, opacity: 0 }),
      textElement("pipe_out_icon", 0, -10, "SVG MP4 PNG", { fill: c.green, fontSize: 18, fontFamily: "monospace", align: "center", opacity: 0 }),
      textElement("pipe_out_label", 0, 30, "Visual Output", { fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center", opacity: 0 }),
    ]),

    // Pipeline description
    group("pipe_desc", width / 2, 700, [
      textElement("pipe_desc_text", 0, 0, "AI generates JSON → Sketchmark validates & renders → Pixel-perfect output", {
        fill: c.text, fontSize: 20, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      })
    ]),

    // ===================== SCENE 6: CLOSING (52-60s) =====================

    group("close_logo", width / 2, height / 2 - 60, [
      pathElement("close_logo_mark", logoPath, {
        fill: "none", stroke: c.accent, strokeWidth: 8, strokeCap: "round",
        opacity: 0, origin: [0, 0]
      })
    ]),

    group("close_name", width / 2, height / 2 + 40, [
      textElement("close_name_text", 0, 0, "sketchmark", {
        fill: c.text, fontSize: 80, fontFamily: "Inter, sans-serif", weight: 700,
        align: "center", opacity: 0
      })
    ]),

    group("close_tagline", width / 2, height / 2 + 110, [
      textElement("close_tagline_text", 0, 0, "The visual language for AI agents", {
        fill: c.accent2, fontSize: 30, fontFamily: "Inter, sans-serif",
        align: "center", opacity: 0
      })
    ]),

    group("close_url", width / 2, height / 2 + 170, [
      textElement("close_url_text", 0, 0, "github.com/sketchmark", {
        fill: c.dim, fontSize: 20, fontFamily: "monospace",
        align: "center", opacity: 0
      })
    ]),

    // ===================== ANIMATED DECORATIONS =====================

    // Floating particles
    group("particle1", 100, 200, [
      pathElement("p1", circlePath(0, 0, 4), { fill: c.accent, opacity: 0 })
    ]),
    group("particle2", 1800, 300, [
      pathElement("p2", circlePath(0, 0, 3), { fill: c.accent2, opacity: 0 })
    ]),
    group("particle3", 200, 800, [
      pathElement("p3", circlePath(0, 0, 5), { fill: c.accent3, opacity: 0 })
    ]),
    group("particle4", 1700, 850, [
      pathElement("p4", circlePath(0, 0, 3), { fill: c.green, opacity: 0 })
    ]),

    // Rotating decoration elements (use origin!)
    group("deco_ring1", 1750, 150, [
      pathElement("deco_r1", circlePath(0, 0, 30), {
        fill: "none", stroke: c.accent, strokeWidth: 1, dashArray: [4, 8],
        opacity: 0, origin: [0, 0]
      })
    ]),
    group("deco_ring2", 150, 900, [
      pathElement("deco_r2", roundedRect(-20, -20, 40, 40, 4), {
        fill: "none", stroke: c.accent2, strokeWidth: 1,
        opacity: 0, origin: [0, 0]
      })
    ]),
  ]
};

// ===================== ANIMATION SEQUENCE =====================
const sequence = [];

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function fadeIn(t, start, dur) { return Math.max(0, Math.min(1, (t - start) / dur)); }
function fadeOut(t, start, dur) { return Math.max(0, 1 - (t - start) / dur); }
function fadeInOut(t, inStart, inDur, outStart, outDur) {
  if (t < inStart) return 0;
  if (t < inStart + inDur) return (t - inStart) / inDur;
  if (t < outStart) return 1;
  if (t < outStart + outDur) return 1 - (t - outStart) / outDur;
  return 0;
}

const fps = 2; // keyframes per second for manageable file size
const totalFrames = duration * fps;

for (let i = 0; i <= totalFrames; i++) {
  const t = (i / totalFrames) * duration;
  const set = {};

  // Particles float throughout
  const particleOp = t > 2 ? 0.3 + 0.2 * Math.sin(t * 0.5) : 0;
  set.particle1 = { position: [100 + Math.sin(t * 0.3) * 30, 200 + Math.cos(t * 0.4) * 20], opacity: particleOp };
  set.particle2 = { position: [1800 + Math.sin(t * 0.4) * 25, 300 + Math.cos(t * 0.3) * 30], opacity: particleOp };
  set.particle3 = { position: [200 + Math.cos(t * 0.35) * 20, 800 + Math.sin(t * 0.45) * 25], opacity: particleOp };
  set.particle4 = { position: [1700 + Math.cos(t * 0.4) * 30, 850 + Math.sin(t * 0.3) * 20], opacity: particleOp };

  // Decorative rings rotate
  const decoOp = t > 3 ? 0.2 : 0;
  set.deco_r1 = { rotation: t * 20, opacity: decoOp };
  set.deco_r2 = { rotation: -t * 15, opacity: decoOp };

  // ===== SCENE 1: TITLE (0-8s) =====
  const s1 = fadeInOut(t, 0, 0.5, 6.5, 1.5);
  set.bg_glow_circle = { opacity: s1 * 0.6 };
  set.logo_mark = { opacity: s1, drawEnd: Math.min(1, fadeIn(t, 0.5, 2)) };
  set.title_text = { opacity: fadeInOut(t, 1.5, 0.8, 6.5, 1.5) };
  set.tagline_text = { opacity: fadeInOut(t, 2.5, 0.8, 6.5, 1.5) };

  // ===== SCENE 2: PROBLEM (8-18s) =====
  const s2_in = 8, s2_out = 16;
  set.problem_title = { opacity: fadeInOut(t, s2_in, 0.8, s2_out, 1.5) };
  set.agent_head = { opacity: fadeInOut(t, s2_in + 1, 0.6, s2_out, 1.5) };
  set.agent_eye_l = { opacity: fadeInOut(t, s2_in + 1.2, 0.4, s2_out, 1.5) };
  set.agent_eye_r = { opacity: fadeInOut(t, s2_in + 1.2, 0.4, s2_out, 1.5) };
  set.agent_mouth = { opacity: fadeInOut(t, s2_in + 1.4, 0.4, s2_out, 1.5) };
  set.agent_antenna = { opacity: fadeInOut(t, s2_in + 1.4, 0.4, s2_out, 1.5) };
  set.text_out_1 = { opacity: fadeInOut(t, s2_in + 2, 0.6, s2_out, 1.5) };
  set.text_out_2 = { opacity: fadeInOut(t, s2_in + 2.5, 0.6, s2_out, 1.5) };
  set.p_arrow_path = { opacity: fadeInOut(t, s2_in + 3, 0.5, s2_out, 1.5) };
  set.no_vis_box = { opacity: fadeInOut(t, s2_in + 3.5, 0.6, s2_out, 1.5) };
  set.no_vis_text = { opacity: fadeInOut(t, s2_in + 3.5, 0.6, s2_out, 1.5) };
  set.no_vis_x1 = { opacity: fadeInOut(t, s2_in + 4.5, 0.4, s2_out, 1.5) };
  set.no_vis_x2 = { opacity: fadeInOut(t, s2_in + 4.5, 0.4, s2_out, 1.5) };
  set.no_vis_label = { opacity: fadeInOut(t, s2_in + 5, 0.6, s2_out, 1.5) };

  // ===== SCENE 3: SOLUTION (18-30s) =====
  const s3_in = 18, s3_out = 28;
  set.solution_title = { opacity: fadeInOut(t, s3_in, 0.8, s3_out, 1.5) };
  set.json_bg = { opacity: fadeInOut(t, s3_in + 1, 0.6, s3_out, 1.5) };
  set.json_header = { opacity: fadeInOut(t, s3_in + 1.2, 0.5, s3_out, 1.5) };

  // JSON lines appear one by one
  for (let ln = 1; ln <= 15; ln++) {
    set[`json_l${ln}`] = { opacity: fadeInOut(t, s3_in + 1.5 + ln * 0.3, 0.4, s3_out, 1.5) };
  }

  set.t_arrow = { opacity: fadeInOut(t, s3_in + 6, 0.5, s3_out, 1.5) };
  set.t_arrow_label = { opacity: fadeInOut(t, s3_in + 6, 0.5, s3_out, 1.5) };
  set.vis_bg = { opacity: fadeInOut(t, s3_in + 6.5, 0.5, s3_out, 1.5) };

  // Animated demo shapes
  const demoVis = fadeInOut(t, s3_in + 7, 0.5, s3_out, 1.5);
  set.demo_sq_path = { opacity: demoVis, rotation: t > s3_in + 7 ? (t - s3_in - 7) * 30 : 0 };
  set.demo_circle_path = { opacity: demoVis, scale: t > s3_in + 7.5 ? 0.8 + 0.3 * Math.sin((t - s3_in) * 2) : 1 };
  set.demo_text_el = { opacity: fadeInOut(t, s3_in + 8, 0.5, s3_out, 1.5) };
  set.demo_drawn_path = { opacity: demoVis, drawEnd: t > s3_in + 8 ? Math.min(1, (t - s3_in - 8) / 2) : 0 };

  // ===== SCENE 4: FEATURES (30-45s) =====
  const s4_in = 30, s4_out = 43;
  set.features_title = { opacity: fadeInOut(t, s4_in, 0.8, s4_out, 1.5) };

  // Cards pop in with slight scale
  set.fc1_bg = { opacity: fadeInOut(t, s4_in + 1, 0.5, s4_out, 1.5) };
  set.fc1_border = { opacity: fadeInOut(t, s4_in + 1, 0.5, s4_out, 1.5) };
  set.fc1_icon = { opacity: fadeInOut(t, s4_in + 1.3, 0.4, s4_out, 1.5) };
  set.fc1_title = { opacity: fadeInOut(t, s4_in + 1.5, 0.4, s4_out, 1.5) };
  set.fc1_desc = { opacity: fadeInOut(t, s4_in + 1.7, 0.4, s4_out, 1.5) };

  set.fc2_bg = { opacity: fadeInOut(t, s4_in + 2, 0.5, s4_out, 1.5) };
  set.fc2_border = { opacity: fadeInOut(t, s4_in + 2, 0.5, s4_out, 1.5) };
  set.fc2_icon = { opacity: fadeInOut(t, s4_in + 2.3, 0.4, s4_out, 1.5) };
  set.fc2_play = { opacity: fadeInOut(t, s4_in + 2.3, 0.4, s4_out, 1.5) };
  set.fc2_title = { opacity: fadeInOut(t, s4_in + 2.5, 0.4, s4_out, 1.5) };
  set.fc2_desc = { opacity: fadeInOut(t, s4_in + 2.7, 0.4, s4_out, 1.5) };

  set.fc3_bg = { opacity: fadeInOut(t, s4_in + 3, 0.5, s4_out, 1.5) };
  set.fc3_border = { opacity: fadeInOut(t, s4_in + 3, 0.5, s4_out, 1.5) };
  set.fc3_icon = { opacity: fadeInOut(t, s4_in + 3.3, 0.4, s4_out, 1.5) };
  set.fc3_title = { opacity: fadeInOut(t, s4_in + 3.5, 0.4, s4_out, 1.5) };
  set.fc3_desc = { opacity: fadeInOut(t, s4_in + 3.7, 0.4, s4_out, 1.5) };

  set.fc4_bg = { opacity: fadeInOut(t, s4_in + 4, 0.5, s4_out, 1.5) };
  set.fc4_border = { opacity: fadeInOut(t, s4_in + 4, 0.5, s4_out, 1.5) };
  set.fc4_icon = { opacity: fadeInOut(t, s4_in + 4.3, 0.4, s4_out, 1.5) };
  set.fc4_title = { opacity: fadeInOut(t, s4_in + 4.5, 0.4, s4_out, 1.5) };
  set.fc4_desc = { opacity: fadeInOut(t, s4_in + 4.7, 0.4, s4_out, 1.5) };

  set.fl1 = { opacity: fadeInOut(t, s4_in + 6, 0.6, s4_out, 1.5) };
  set.fl2 = { opacity: fadeInOut(t, s4_in + 7, 0.6, s4_out, 1.5) };
  set.fl3 = { opacity: fadeInOut(t, s4_in + 8, 0.6, s4_out, 1.5) };

  // ===== SCENE 5: PIPELINE (45-52s) =====
  const s5_in = 45, s5_out = 51;
  set.pipeline_title = { opacity: fadeInOut(t, s5_in, 0.8, s5_out, 1.5) };

  set.pipe_ai_bg = { opacity: fadeInOut(t, s5_in + 1, 0.5, s5_out, 1.5) };
  set.pipe_ai_border = { opacity: fadeInOut(t, s5_in + 1, 0.5, s5_out, 1.5) };
  set.pipe_ai_icon = { opacity: fadeInOut(t, s5_in + 1.2, 0.4, s5_out, 1.5) };
  set.pipe_ai_label = { opacity: fadeInOut(t, s5_in + 1.2, 0.4, s5_out, 1.5) };

  set.pipe_a1 = { opacity: fadeInOut(t, s5_in + 1.5, 0.4, s5_out, 1.5) };

  set.pipe_json_bg = { opacity: fadeInOut(t, s5_in + 2, 0.5, s5_out, 1.5) };
  set.pipe_json_border = { opacity: fadeInOut(t, s5_in + 2, 0.5, s5_out, 1.5) };
  set.pipe_json_icon = { opacity: fadeInOut(t, s5_in + 2.2, 0.4, s5_out, 1.5) };
  set.pipe_json_label = { opacity: fadeInOut(t, s5_in + 2.2, 0.4, s5_out, 1.5) };

  set.pipe_a2 = { opacity: fadeInOut(t, s5_in + 2.5, 0.4, s5_out, 1.5) };

  set.pipe_render_bg = { opacity: fadeInOut(t, s5_in + 3, 0.5, s5_out, 1.5) };
  set.pipe_render_border = { opacity: fadeInOut(t, s5_in + 3, 0.5, s5_out, 1.5) };
  set.pipe_render_icon = { opacity: fadeInOut(t, s5_in + 3.2, 0.4, s5_out, 1.5) };
  set.pipe_render_label = { opacity: fadeInOut(t, s5_in + 3.2, 0.4, s5_out, 1.5) };

  set.pipe_a3 = { opacity: fadeInOut(t, s5_in + 3.5, 0.4, s5_out, 1.5) };

  set.pipe_out_bg = { opacity: fadeInOut(t, s5_in + 4, 0.5, s5_out, 1.5) };
  set.pipe_out_border = { opacity: fadeInOut(t, s5_in + 4, 0.5, s5_out, 1.5) };
  set.pipe_out_icon = { opacity: fadeInOut(t, s5_in + 4.2, 0.4, s5_out, 1.5) };
  set.pipe_out_label = { opacity: fadeInOut(t, s5_in + 4.2, 0.4, s5_out, 1.5) };

  set.pipe_desc_text = { opacity: fadeInOut(t, s5_in + 5, 0.6, s5_out, 1.5) };

  // ===== SCENE 6: CLOSING (52-60s) =====
  const s6_in = 52;
  set.close_logo_mark = { opacity: fadeIn(t, s6_in, 1), drawEnd: Math.min(1, fadeIn(t, s6_in, 2)) };
  set.close_name_text = { opacity: fadeIn(t, s6_in + 1.5, 1) };
  set.close_tagline_text = { opacity: fadeIn(t, s6_in + 3, 1) };
  set.close_url_text = { opacity: fadeIn(t, s6_in + 4.5, 1) };

  // Background glow returns for closing
  if (t > s6_in) {
    set.bg_glow_circle = { opacity: fadeIn(t, s6_in, 2) * 0.8 };
  }

  sequence.push({ time: t, ease: "linear", set });
}

const document = compileKeyframeStates(baseDocument, sequence, {
  defaultCurve: { type: "graph", points: [[0, 0], [0.4, 0.4], [0.6, 0.6], [1, 1]] }
});
const outPath = path.join(__dirname, "product-demo.visual.json");
fs.writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
