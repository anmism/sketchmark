const fs = require("node:fs");
const path = require("node:path");

const width = 1920;
const height = 1080;
const duration = 60;
const fps = 30;

// Curves
const curves = {
  easeOut: { type: "cubicBezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
  easeIn: { type: "cubicBezier", x1: 0.7, y1: 0, x2: 0.84, y2: 0 },
  easeInOut: { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  spring: { type: "cubicBezier", x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
};

// Scenes timing
const scenes = {
  title:    { start: 0, end: 8 },
  problem:  { start: 8, end: 18 },
  solution: { start: 18, end: 30 },
  features: { start: 30, end: 45 },
  pipeline: { start: 45, end: 53 },
  closing:  { start: 53, end: 60 },
};

// Helpers
function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function textElement(id, x, y, text, style = {}) {
  return { id, type: "text", x, y, text, ...style };
}

function groupElement(id, x, y, children, extra = {}) {
  return { id, type: "group", x, y, children, ...extra };
}

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

// Track builders
function fadeTrack(inTime, outTime, holdOpacity = 1) {
  const fadeInEnd = inTime + 0.6;
  const kf = [{ time: inTime, value: 0 }];
  if (outTime === null || fadeInEnd < outTime) {
    kf.push({ time: fadeInEnd, value: holdOpacity, out: curves.easeOut });
  }
  if (outTime !== null) {
    const holdStart = Math.max(fadeInEnd + 0.01, outTime);
    kf.push({ time: holdStart, value: holdOpacity });
    kf.push({ time: holdStart + 1, value: 0, out: curves.easeIn });
  }
  return { keyframes: kf };
}

function enterFromBottom(inTime, outTime, distance = 40) {
  const kf = [
    { time: inTime - 0.01, value: distance },
    { time: inTime + 0.7, value: 0, out: curves.spring }
  ];
  if (outTime !== null) {
    kf.push({ time: outTime, value: 0 });
    kf.push({ time: outTime + 0.8, value: -distance, out: curves.easeIn });
  }
  return { keyframes: kf };
}

function drawTrack(inTime, drawDuration = 1.5) {
  return {
    keyframes: [
      { time: inTime, value: 0 },
      { time: inTime + drawDuration, value: 1, out: curves.easeOut }
    ]
  };
}

function rotateTrack(startTime, endTime, fromDeg, toDeg) {
  return {
    keyframes: [
      { time: startTime, value: fromDeg },
      { time: endTime, value: toDeg, out: curves.easeInOut }
    ]
  };
}

function scaleTrack(inTime, fromScale, toScale) {
  return {
    keyframes: [
      { time: inTime, value: fromScale },
      { time: inTime + 0.6, value: toScale, out: curves.spring }
    ]
  };
}

// Colors
const c = {
  bg: "#0a0a0f",
  accent: "#6366f1",
  accent2: "#a78bfa",
  accent3: "#38bdf8",
  green: "#34d399",
  amber: "#fbbf24",
  rose: "#fb7185",
  text: "#f8fafc",
  dim: "#64748b",
  card: "#1e1b4b",
  code: "#1e293b",
};

// Logo path (stylized "S" stroke)
const logoPath = "M -30 -40 Q -10 -50 10 -30 Q 30 -10 10 10 Q -10 30 10 40 Q 20 45 30 40";

// ==================== BUILD DOCUMENT ====================

const document = {
  version: 1,
  canvas: { width, height, background: c.bg, duration, fps },
  elements: [

    // ======================== SCENE 1: TITLE (0-8s) ========================

    // Background glow
    groupElement("bg_glow", width / 2, height / 2, [
      pathElement("bg_glow_shape", circlePath(0, 0, 450), {
        fill: { type: "radialGradient", center: [0, 0], radius: 450, stops: [[0, "#6366f130"], [1, "#6366f100"]] },
      })
    ], {
      origin: [width / 2, height / 2],
      opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.title.start + 0.5, scenes.title.end - 1.5, 0.7),
        scale: scaleTrack(scenes.title.start + 0.5, 0.6, 1.0),
      }}
    }),

    // Logo stroke
    groupElement("logo", width / 2, height / 2 - 80, [
      pathElement("logo_stroke", logoPath, {
        fill: "none", stroke: c.accent, strokeWidth: 7, strokeCap: "round",
        origin: [0, 0],
      })
    ], {
      origin: [width / 2, height / 2 - 80],
      opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.title.start + 0.3, scenes.title.end - 1.5),
      }}
    }),

    // Logo draw
    pathElement("logo_draw_anim", logoPath, {
      fill: "none", stroke: c.accent, strokeWidth: 7, strokeCap: "round",
      drawEnd: 0, opacity: 0,
      origin: [width / 2, height / 2 - 80],
      timeline: { tracks: {
        drawEnd: drawTrack(scenes.title.start + 0.5, 2),
        opacity: fadeTrack(scenes.title.start + 0.3, scenes.title.end - 1.5),
      }}
    }),

    // Title text
    textElement("title_text", width / 2, height / 2 + 30, "sketchmark", {
      fill: c.text, fontSize: 80, fontFamily: "Inter, sans-serif", weight: 700,
      align: "center", opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.title.start + 1.5, scenes.title.end - 1.5),
      }}
    }),

    // Tagline
    textElement("tagline", width / 2, height / 2 + 100, "The world's first visual language for AI agents", {
      fill: c.accent2, fontSize: 28, fontFamily: "Inter, sans-serif",
      align: "center", opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.title.start + 2.5, scenes.title.end - 1.5),
      }}
    }),

    // ======================== SCENE 2: PROBLEM (8-18s) ========================

    textElement("problem_title", width / 2, 140, "The Problem", {
      fill: c.rose, fontSize: 44, fontFamily: "Inter, sans-serif", weight: 700,
      align: "center", opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.problem.start, scenes.problem.end - 2),
      }}
    }),

    // AI Agent box
    groupElement("agent_box", 480, 500, [
      pathElement("agent_bg", roundedRect(-100, -120, 200, 240, 16), {
        fill: c.card,
      }),
      pathElement("agent_border", roundedRect(-100, -120, 200, 240, 16), {
        fill: "none", stroke: c.accent3, strokeWidth: 2,
      }),
      // Robot face
      pathElement("agent_eye_l", circlePath(-30, -40, 12), { fill: c.accent3 }),
      pathElement("agent_eye_r", circlePath(30, -40, 12), { fill: c.accent3 }),
      pathElement("agent_mouth", "M -30 20 L 30 20", {
        fill: "none", stroke: c.accent3, strokeWidth: 3, strokeCap: "round"
      }),
      pathElement("agent_antenna", "M 0 -120 L 0 -145 M -10 -145 L 10 -145", {
        fill: "none", stroke: c.accent3, strokeWidth: 3, strokeCap: "round"
      }),
      textElement("agent_label", 0, 90, "AI Agent", {
        fill: c.text, fontSize: 18, fontFamily: "Inter, sans-serif", weight: 600, align: "center"
      }),
    ], {
      origin: [480, 500], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.problem.start + 1, scenes.problem.end - 2),
        scale: scaleTrack(scenes.problem.start + 1, 0.8, 1),
      }}
    }),

    // Arrow from agent to output
    groupElement("problem_arrow", 700, 500, [
      pathElement("parrow_line", "M 0 0 L 200 0", {
        fill: "none", stroke: c.dim, strokeWidth: 2, strokeCap: "round", drawEnd: 0,
      }),
      pathElement("parrow_head", "M 190 -10 L 200 0 L 190 10", {
        fill: "none", stroke: c.dim, strokeWidth: 2, strokeCap: "round"
      }),
    ], {
      origin: [700, 500], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.problem.start + 2.5, scenes.problem.end - 2),
      }}
    }),

    // Output block - broken/missing
    groupElement("no_output", 1100, 500, [
      pathElement("no_out_box", roundedRect(-140, -120, 280, 240, 16), {
        fill: "none", stroke: c.dim, strokeWidth: 2, dashArray: [8, 6]
      }),
      textElement("no_out_label", 0, -70, "Visual Output?", {
        fill: c.dim, fontSize: 20, fontFamily: "Inter, sans-serif", align: "center"
      }),
      // Big red X
      pathElement("no_x1", "M -50 -20 L 50 60", {
        fill: "none", stroke: c.rose, strokeWidth: 5, strokeCap: "round", drawEnd: 0,
      }),
      pathElement("no_x2", "M 50 -20 L -50 60", {
        fill: "none", stroke: c.rose, strokeWidth: 5, strokeCap: "round", drawEnd: 0,
      }),
      textElement("no_out_msg", 0, 100, "No standard format for AI", {
        fill: c.rose, fontSize: 16, fontFamily: "Inter, sans-serif", align: "center", opacity: 0
      }),
    ], {
      origin: [1100, 500], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.problem.start + 3, scenes.problem.end - 2),
        scale: scaleTrack(scenes.problem.start + 3, 0.8, 1),
      }}
    }),


    // Problem summary text
    textElement("problem_sum", width / 2, 780, "AI agents generate text, but they can't produce visuals in a standard way.", {
      fill: c.text, fontSize: 22, fontFamily: "Inter, sans-serif", align: "center", opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.problem.start + 5.5, scenes.problem.end - 2),
      }}
    }),

    // ======================== SCENE 3: SOLUTION (18-30s) ========================

    textElement("solution_title", width / 2, 120, "The Solution", {
      fill: c.green, fontSize: 44, fontFamily: "Inter, sans-serif", weight: 700,
      align: "center", opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.solution.start, scenes.solution.end - 2),
      }}
    }),

    // JSON code block
    groupElement("code_block", 380, 480, [
      pathElement("code_bg", roundedRect(-220, -250, 440, 540, 12), { fill: c.code }),
      pathElement("code_border", roundedRect(-220, -250, 440, 540, 12), {
        fill: "none", stroke: c.accent, strokeWidth: 1, opacity: 0.4
      }),
      textElement("code_header", 0, -225, "visual.json", {
        fill: c.accent3, fontSize: 13, fontFamily: "monospace", align: "center"
      }),
      textElement("cl1", -190, -185, "{", { fill: c.dim, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl2", -190, -160, '  "version": 1,', { fill: c.text, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl3", -190, -135, '  "canvas": { "width": 1920 },', { fill: c.text, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl4", -190, -110, '  "elements": [{', { fill: c.text, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl5", -190, -85, '    "type": "path",', { fill: c.accent2, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl6", -190, -60, '    "d": "M 0 0 L 100 50",', { fill: c.text, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl7", -190, -35, '    "fill": "#6366f1",', { fill: c.accent, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl8", -190, -10, '    "origin": [50, 25],', { fill: c.amber, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl9", -190, 15, '    "rotation": 45,', { fill: c.green, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl10", -190, 40, '    "timeline": {', { fill: c.text, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl11", -190, 65, '      "tracks": {', { fill: c.text, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl12", -190, 90, '        "rotation": {', { fill: c.green, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl13", -190, 115, '          "keyframes": [', { fill: c.text, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl14", -190, 140, '            [0, 0], [2, 360]', { fill: c.amber, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl15", -190, 165, '          ]', { fill: c.text, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl16", -190, 190, '    }}}}]', { fill: c.dim, fontSize: 15, fontFamily: "monospace" }),
      textElement("cl17", -190, 215, "}", { fill: c.dim, fontSize: 15, fontFamily: "monospace" }),
    ], {
      origin: [380, 480], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.solution.start + 1, scenes.solution.end - 2),
        scale: scaleTrack(scenes.solution.start + 1, 0.9, 1),
      }}
    }),

    // Arrow from code to render
    groupElement("render_arrow", 700, 540, [
      pathElement("rarrow_line", "M 0 0 L 160 0", {
        fill: "none", stroke: c.accent, strokeWidth: 3, strokeCap: "round"
      }),
      pathElement("rarrow_head", "M 148 -10 L 160 0 L 148 10", {
        fill: "none", stroke: c.accent, strokeWidth: 3, strokeCap: "round"
      }),
      textElement("rarrow_label", 80, -20, "render", {
        fill: c.accent, fontSize: 14, fontFamily: "monospace", align: "center"
      }),
    ], {
      origin: [700, 540], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.solution.start + 4, scenes.solution.end - 2),
      }}
    }),

    // Visual output preview
    groupElement("vis_preview", 1200, 480, [
      pathElement("vis_frame", roundedRect(-250, -250, 500, 540, 12), {
        fill: "#0f0f1a",
      }),
      pathElement("vis_frame_border", roundedRect(-250, -250, 500, 540, 12), {
        fill: "none", stroke: c.green, strokeWidth: 2, opacity: 0.5
      }),
      textElement("vis_label", 0, -225, "Output", {
        fill: c.green, fontSize: 13, fontFamily: "monospace", align: "center"
      }),

      // Rotating square using origin as anchor
      groupElement("demo_square", -60, -80, [
        pathElement("sq_shape", roundedRect(-35, -35, 70, 70, 8), {
          fill: c.accent, origin: [0, 0],
        })
      ], {
        origin: [0, 0],
        timeline: { tracks: {
          rotation: {
            keyframes: [
              { time: scenes.solution.start + 5, value: 0 },
              { time: scenes.solution.end - 1, value: 360, out: curves.easeInOut }
            ]
          }
        }}
      }),

      // Pulsing circle using origin for scale
      groupElement("demo_circle", 100, -80, [
        pathElement("circle_shape", circlePath(0, 0, 35), {
          fill: c.green, origin: [0, 0],
        })
      ], {
        origin: [0, 0],
        timeline: { tracks: {
          scale: {
            keyframes: [
              { time: scenes.solution.start + 5.5, value: 0.8 },
              { time: scenes.solution.start + 7, value: 1.2, out: curves.easeInOut },
              { time: scenes.solution.start + 8.5, value: 0.8, out: curves.easeInOut },
              { time: scenes.solution.start + 10, value: 1.2, out: curves.easeInOut },
            ]
          }
        }}
      }),

      // Path draw animation
      pathElement("demo_wave", "M -120 60 Q -60 10 0 60 Q 60 110 120 60", {
        fill: "none", stroke: c.amber, strokeWidth: 3, strokeCap: "round",
        origin: [0, 60], drawEnd: 0,
        timeline: { tracks: {
          drawEnd: drawTrack(scenes.solution.start + 6, 2.5),
        }}
      }),

      // Text element
      textElement("demo_txt", 0, 150, "Hello, AI Visuals!", {
        fill: c.text, fontSize: 22, fontFamily: "Inter, sans-serif", weight: 600,
        align: "center", opacity: 0,
        timeline: { tracks: {
          opacity: fadeTrack(scenes.solution.start + 7, null),
        }}
      }),

      // Origin indicator dot
      groupElement("origin_dot", -60, -80, [
        pathElement("origin_ring", circlePath(0, 0, 6), {
          fill: "none", stroke: c.amber, strokeWidth: 2
        }),
        pathElement("origin_cross_h", "M -8 0 L 8 0", {
          fill: "none", stroke: c.amber, strokeWidth: 1
        }),
        pathElement("origin_cross_v", "M 0 -8 L 0 8", {
          fill: "none", stroke: c.amber, strokeWidth: 1
        }),
      ], { opacity: 0, timeline: { tracks: {
        opacity: fadeTrack(scenes.solution.start + 5, scenes.solution.end - 2, 0.8),
      }}}),

      // Origin label
      textElement("origin_label", -60, -110, "origin: [0, 0]", {
        fill: c.amber, fontSize: 11, fontFamily: "monospace", align: "center", opacity: 0,
        timeline: { tracks: {
          opacity: fadeTrack(scenes.solution.start + 5.5, scenes.solution.end - 2, 0.7),
        }}
      }),
    ], {
      origin: [1200, 480], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.solution.start + 4.5, scenes.solution.end - 2),
        scale: scaleTrack(scenes.solution.start + 4.5, 0.85, 1),
      }}
    }),

    // ======================== SCENE 4: FEATURES (30-45s) ========================

    textElement("features_title", width / 2, 120, "Built for AI Agents", {
      fill: c.text, fontSize: 44, fontFamily: "Inter, sans-serif", weight: 700,
      align: "center", opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.features.start, scenes.features.end - 2),
      }}
    }),

    // Feature card 1: Structured JSON
    groupElement("fcard1", 280, 380, [
      pathElement("fc1_bg", roundedRect(-130, -120, 260, 240, 14), { fill: c.card }),
      pathElement("fc1_border", roundedRect(-130, -120, 260, 240, 14), { fill: "none", stroke: c.accent, strokeWidth: 2 }),
      pathElement("fc1_icon", "M -20 -65 L -20 -45 L 20 -45 L 20 -65 M -30 -45 L 30 -45 L 30 -5 L -30 -5 Z", {
        fill: "none", stroke: c.accent, strokeWidth: 2.5, strokeCap: "round"
      }),
      textElement("fc1_t", 0, 30, "Structured JSON", {
        fill: c.text, fontSize: 20, fontFamily: "Inter, sans-serif", weight: 600, align: "center"
      }),
      textElement("fc1_d", 0, 60, "Strict schema validation", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center"
      }),
      textElement("fc1_d2", 0, 80, "AI-parseable format", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center"
      }),
    ], {
      origin: [280, 380], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.features.start + 1.5, scenes.features.end - 2),
        scale: scaleTrack(scenes.features.start + 1.5, 0.7, 1),
      }}
    }),

    // Feature card 2: Keyframe Animation
    groupElement("fcard2", 700, 380, [
      pathElement("fc2_bg", roundedRect(-130, -120, 260, 240, 14), { fill: c.card }),
      pathElement("fc2_border", roundedRect(-130, -120, 260, 240, 14), { fill: "none", stroke: c.accent2, strokeWidth: 2 }),
      // Timeline icon
      pathElement("fc2_icon", "M -30 -60 L 30 -60 M -30 -40 L 15 -40 M -30 -20 L 25 -20", {
        fill: "none", stroke: c.accent2, strokeWidth: 2.5, strokeCap: "round"
      }),
      pathElement("fc2_dots", circlePath(-30, -60, 4) + " " + circlePath(30, -60, 4) + " " + circlePath(-30, -40, 4) + " " + circlePath(15, -40, 4), {
        fill: c.accent2,
      }),
      textElement("fc2_t", 0, 30, "Keyframe Animation", {
        fill: c.text, fontSize: 20, fontFamily: "Inter, sans-serif", weight: 600, align: "center"
      }),
      textElement("fc2_d", 0, 60, "Easing curves & timelines", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center"
      }),
      textElement("fc2_d2", 0, 80, "Sparse tracks, not frames", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center"
      }),
    ], {
      origin: [700, 380], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.features.start + 2.5, scenes.features.end - 2),
        scale: scaleTrack(scenes.features.start + 2.5, 0.7, 1),
      }}
    }),

    // Feature card 3: Multi-format export
    groupElement("fcard3", 1120, 380, [
      pathElement("fc3_bg", roundedRect(-130, -120, 260, 240, 14), { fill: c.card }),
      pathElement("fc3_border", roundedRect(-130, -120, 260, 240, 14), { fill: "none", stroke: c.accent3, strokeWidth: 2 }),
      pathElement("fc3_icon", "M -20 -65 L -20 -30 L 20 -30 L 20 -65 Z M 0 -30 L 0 -5 M -10 -15 L 0 -5 L 10 -15", {
        fill: "none", stroke: c.accent3, strokeWidth: 2.5, strokeCap: "round"
      }),
      textElement("fc3_t", 0, 30, "Multi-Format Export", {
        fill: c.text, fontSize: 20, fontFamily: "Inter, sans-serif", weight: 600, align: "center"
      }),
      textElement("fc3_d", 0, 60, "SVG, HTML, Video, PNG", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center"
      }),
      textElement("fc3_d2", 0, 80, "One source, every output", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center"
      }),
    ], {
      origin: [1120, 380], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.features.start + 3.5, scenes.features.end - 2),
        scale: scaleTrack(scenes.features.start + 3.5, 0.7, 1),
      }}
    }),

    // Feature card 4: Rich Styling
    groupElement("fcard4", 1540, 380, [
      pathElement("fc4_bg", roundedRect(-130, -120, 260, 240, 14), { fill: c.card }),
      pathElement("fc4_border", roundedRect(-130, -120, 260, 240, 14), { fill: "none", stroke: c.amber, strokeWidth: 2 }),
      pathElement("fc4_grad_icon", circlePath(0, -45, 22), {
        fill: { type: "radialGradient", center: [0, -45], radius: 22, stops: [[0, c.amber], [1, c.rose]] }
      }),
      textElement("fc4_t", 0, 30, "Rich Styling", {
        fill: c.text, fontSize: 20, fontFamily: "Inter, sans-serif", weight: 600, align: "center"
      }),
      textElement("fc4_d", 0, 60, "Gradients, effects, masks", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center"
      }),
      textElement("fc4_d2", 0, 80, "Origin-based transforms", {
        fill: c.dim, fontSize: 14, fontFamily: "Inter, sans-serif", align: "center"
      }),
    ], {
      origin: [1540, 380], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.features.start + 4.5, scenes.features.end - 2),
        scale: scaleTrack(scenes.features.start + 4.5, 0.7, 1),
      }}
    }),

    // Feature list
    textElement("flist1", width / 2, 660, "path  ·  text  ·  image  ·  group  ·  transforms  ·  gradients  ·  effects", {
      fill: c.text, fontSize: 20, fontFamily: "Inter, sans-serif", align: "center", opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.features.start + 7, scenes.features.end - 2) }}
    }),
    textElement("flist2", width / 2, 700, "rotation with origin anchors  ·  scale  ·  drawStart/drawEnd  ·  clip & mask", {
      fill: c.dim, fontSize: 17, fontFamily: "Inter, sans-serif", align: "center", opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.features.start + 8, scenes.features.end - 2) }}
    }),
    textElement("flist3", width / 2, 740, "cubicBezier easing  ·  graph curves  ·  hold  ·  discrete text swap", {
      fill: c.dim, fontSize: 17, fontFamily: "Inter, sans-serif", align: "center", opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.features.start + 9, scenes.features.end - 2) }}
    }),

    // ======================== SCENE 5: PIPELINE (45-53s) ========================

    textElement("pipe_title", width / 2, 160, "How It Works", {
      fill: c.text, fontSize: 44, fontFamily: "Inter, sans-serif", weight: 700,
      align: "center", opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.pipeline.start, scenes.pipeline.end - 2) }}
    }),

    // AI Agent node
    groupElement("pipe_ai", 250, 540, [
      pathElement("pai_bg", roundedRect(-110, -70, 220, 140, 14), { fill: c.card }),
      pathElement("pai_border", roundedRect(-110, -70, 220, 140, 14), { fill: "none", stroke: c.accent3, strokeWidth: 2 }),
      textElement("pai_icon", 0, -15, "AI", { fill: c.accent3, fontSize: 36, fontFamily: "Inter, sans-serif", weight: 700, align: "center" }),
      textElement("pai_label", 0, 30, "Agent / LLM", { fill: c.dim, fontSize: 15, fontFamily: "Inter, sans-serif", align: "center" }),
    ], {
      origin: [250, 540], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.pipeline.start + 1, scenes.pipeline.end - 2),
        scale: scaleTrack(scenes.pipeline.start + 1, 0.7, 1),
      }}
    }),

    // Arrow 1
    groupElement("pipe_a1", 470, 540, [
      pathElement("pa1_line", "M 0 0 L 100 0 M 88 -10 L 100 0 L 88 10", {
        fill: "none", stroke: c.dim, strokeWidth: 2.5, strokeCap: "round"
      }),
    ], {
      opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.pipeline.start + 2, scenes.pipeline.end - 2) }}
    }),

    // Sketchmark JSON node
    groupElement("pipe_json", 680, 540, [
      pathElement("pj_bg", roundedRect(-110, -70, 220, 140, 14), { fill: c.card }),
      pathElement("pj_border", roundedRect(-110, -70, 220, 140, 14), { fill: "none", stroke: c.accent, strokeWidth: 2 }),
      textElement("pj_icon", 0, -15, "{ }", { fill: c.accent, fontSize: 32, fontFamily: "monospace", weight: 700, align: "center" }),
      textElement("pj_label", 0, 30, "Sketchmark JSON", { fill: c.dim, fontSize: 15, fontFamily: "Inter, sans-serif", align: "center" }),
    ], {
      origin: [680, 540], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.pipeline.start + 2.5, scenes.pipeline.end - 2),
        scale: scaleTrack(scenes.pipeline.start + 2.5, 0.7, 1),
      }}
    }),

    // Arrow 2
    groupElement("pipe_a2", 900, 540, [
      pathElement("pa2_line", "M 0 0 L 100 0 M 88 -10 L 100 0 L 88 10", {
        fill: "none", stroke: c.dim, strokeWidth: 2.5, strokeCap: "round"
      }),
    ], {
      opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.pipeline.start + 3.5, scenes.pipeline.end - 2) }}
    }),

    // Render Engine node
    groupElement("pipe_render", 1110, 540, [
      pathElement("pr_bg", roundedRect(-110, -70, 220, 140, 14), { fill: c.card }),
      pathElement("pr_border", roundedRect(-110, -70, 220, 140, 14), { fill: "none", stroke: c.accent2, strokeWidth: 2 }),
      textElement("pr_icon", 0, -15, "▶", { fill: c.accent2, fontSize: 32, fontFamily: "Inter, sans-serif", align: "center" }),
      textElement("pr_label", 0, 30, "Render Engine", { fill: c.dim, fontSize: 15, fontFamily: "Inter, sans-serif", align: "center" }),
    ], {
      origin: [1110, 540], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.pipeline.start + 4, scenes.pipeline.end - 2),
        scale: scaleTrack(scenes.pipeline.start + 4, 0.7, 1),
      }}
    }),

    // Arrow 3
    groupElement("pipe_a3", 1330, 540, [
      pathElement("pa3_line", "M 0 0 L 100 0 M 88 -10 L 100 0 L 88 10", {
        fill: "none", stroke: c.dim, strokeWidth: 2.5, strokeCap: "round"
      }),
    ], {
      opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.pipeline.start + 5, scenes.pipeline.end - 2) }}
    }),

    // Output node
    groupElement("pipe_out", 1560, 540, [
      pathElement("po_bg", roundedRect(-130, -70, 260, 140, 14), { fill: c.card }),
      pathElement("po_border", roundedRect(-130, -70, 260, 140, 14), { fill: "none", stroke: c.green, strokeWidth: 2 }),
      textElement("po_icon", 0, -15, "SVG  MP4  PNG", { fill: c.green, fontSize: 20, fontFamily: "monospace", align: "center" }),
      textElement("po_label", 0, 30, "Pixel-Perfect Output", { fill: c.dim, fontSize: 15, fontFamily: "Inter, sans-serif", align: "center" }),
    ], {
      origin: [1560, 540], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.pipeline.start + 5.5, scenes.pipeline.end - 2),
        scale: scaleTrack(scenes.pipeline.start + 5.5, 0.7, 1),
      }}
    }),

    // Pipeline description
    textElement("pipe_desc", width / 2, 740, "AI generates structured JSON  →  Sketchmark validates & renders  →  Any format", {
      fill: c.text, fontSize: 21, fontFamily: "Inter, sans-serif", align: "center", opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.pipeline.start + 6.5, scenes.pipeline.end - 2) }}
    }),

    // ======================== SCENE 6: CLOSING (53-60s) ========================

    // Large background glow
    groupElement("close_glow", width / 2, height / 2, [
      pathElement("close_glow_shape", circlePath(0, 0, 500), {
        fill: { type: "radialGradient", center: [0, 0], radius: 500, stops: [[0, "#6366f125"], [1, "#6366f100"]] },
      })
    ], {
      origin: [width / 2, height / 2], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.closing.start, null, 0.9),
        scale: scaleTrack(scenes.closing.start, 0.5, 1),
      }}
    }),

    // Logo mark
    groupElement("close_logo", width / 2, height / 2 - 100, [
      pathElement("close_logo_path", logoPath, {
        fill: "none", stroke: c.accent, strokeWidth: 8, strokeCap: "round",
        origin: [0, 0], drawEnd: 0,
        timeline: { tracks: {
          drawEnd: drawTrack(scenes.closing.start + 0.5, 2),
        }}
      })
    ], {
      origin: [width / 2, height / 2 - 100], opacity: 0,
      timeline: { tracks: {
        opacity: fadeTrack(scenes.closing.start + 0.3, null),
        scale: scaleTrack(scenes.closing.start + 0.3, 0.6, 1),
      }}
    }),

    // Name
    textElement("close_name", width / 2, height / 2 + 10, "sketchmark", {
      fill: c.text, fontSize: 88, fontFamily: "Inter, sans-serif", weight: 700,
      align: "center", opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.closing.start + 1.5, null) }}
    }),

    // Closing tagline
    textElement("close_tag", width / 2, height / 2 + 80, "The visual language for AI agents", {
      fill: c.accent2, fontSize: 30, fontFamily: "Inter, sans-serif",
      align: "center", opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.closing.start + 3, null) }}
    }),

    // URL
    textElement("close_url", width / 2, height / 2 + 150, "sketchmark.dev", {
      fill: c.dim, fontSize: 22, fontFamily: "monospace",
      align: "center", opacity: 0,
      timeline: { tracks: { opacity: fadeTrack(scenes.closing.start + 4.5, null) }}
    }),
  ]
};

const outPath = path.join(__dirname, "product-demo.visual.json");
fs.writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
