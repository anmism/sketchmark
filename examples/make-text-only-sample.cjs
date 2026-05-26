const fs = require("node:fs");
const path = require("node:path");

const width = 1280;
const height = 720;
const duration = 8;
const fps = 30;

function textElement(id, x, y, text, style = {}, tracks = null) {
  const out = { id, type: "text", x, y, text, ...style };
  if (tracks && Object.keys(tracks).length) out.timeline = { tracks };
  return out;
}

function track(keyframes) {
  return { keyframes };
}

const doc = {
  version: 1,
  canvas: {
    width,
    height,
    background: "#0f172a",
    duration,
    fps
  },
  elements: [
    textElement("title", width / 2, 54, "Text Only Animation Sample", {
      align: "center",
      fontFamily: "Roboto, Arial, sans-serif",
      fontSize: 46,
      weight: 800,
      fill: "#f8fafc"
    }),
    textElement("subtitle", width / 2, 128, "No paths, no images, no groups", {
      align: "center",
      fontFamily: "Roboto, Arial, sans-serif",
      fontSize: 18,
      fill: "#93c5fd"
    }),
    textElement("charset", width / 2, 178, "The quick brown fox jumps over 13 lazy dogs.", {
      align: "center",
      fontFamily: "Roboto, Arial, sans-serif",
      fontSize: 24,
      fill: "#e2e8f0"
    }),
    textElement("symbols", width / 2, 208, "0123456789 ! ? @ # $ % ^ & * ( ) [ ] { } + - = / : ; , .", {
      align: "center",
      fontFamily: "Roboto, Arial, sans-serif",
      fontSize: 18,
      fill: "#cbd5e1"
    }),

    textElement(
      "status",
      width / 2,
      252,
      "Draft",
      {
        align: "center",
        fontFamily: "Roboto, Arial, sans-serif",
        fontSize: 52,
        weight: 800,
        fill: "#facc15"
      },
      {
        text: track([
          [0, "Draft"],
          [2, "Design"],
          [4, "Animate"],
          [6, "Export"],
          [8, "Done"]
        ])
      }
    ),

    textElement(
      "ticker",
      80,
      320,
      "This line moves left to right using a position track.",
      {
        align: "left",
        fontFamily: "Roboto, Arial, sans-serif",
        fontSize: 24,
        fill: "#f8fafc"
      },
      {
        position: track([
          [0, [80, 320]],
          [8, [840, 320]]
        ])
      }
    ),

    textElement(
      "fill_cycle",
      width / 2,
      378,
      "Fill color animation",
      {
        align: "center",
        fontFamily: "Roboto, Arial, sans-serif",
        fontSize: 32,
        weight: 700,
        fill: "#22d3ee"
      },
      {
        fill: track([
          [0, "#22d3ee"],
          [2, "#a78bfa"],
          [4, "#f97316"],
          [6, "#22c55e"],
          [8, "#22d3ee"]
        ])
      }
    ),

    textElement(
      "weight_cycle",
      width / 2,
      426,
      "Weight: 300 -> 400 -> 700 -> 400",
      {
        align: "center",
        fontFamily: "Roboto, Arial, sans-serif",
        fontSize: 28,
        weight: 300,
        fill: "#e2e8f0"
      },
      {
        weight: track([
          [0, 300],
          [2, 400],
          [4, 700],
          [6, 400],
          [8, 300]
        ])
      }
    ),

    textElement(
      "size_spacing",
      width / 2,
      474,
      "Font size + letter spacing",
      {
        align: "center",
        fontFamily: "Roboto, Arial, sans-serif",
        fontSize: 30,
        letterSpacing: 0,
        fill: "#bfdbfe"
      },
      {
        fontSize: track([
          [0, 30],
          [4, 46],
          [8, 30]
        ]),
        letterSpacing: track([
          [0, 0],
          [4, 4],
          [8, 0]
        ])
      }
    ),

    textElement(
      "font_stack_switch",
      width / 2,
      522,
      "Font stack track: Roboto -> Arial -> Roboto",
      {
        align: "center",
        fontFamily: "Roboto, Arial, sans-serif",
        fontSize: 24,
        weight: 700,
        fill: "#f1f5f9"
      },
      {
        fontFamily: track([
          [0, "Roboto, Arial, sans-serif"],
          [4, "Arial, Helvetica, sans-serif"],
          [8, "Roboto, Arial, sans-serif"]
        ])
      }
    ),

    textElement(
      "paragraph",
      width / 2,
      590,
      "This paragraph is text only and animates lineHeight and opacity. It helps compare editor, SVG, PNG, and MP4 output consistency.",
      {
        align: "center",
        fontFamily: "Roboto, Arial, sans-serif",
        fontSize: 20,
        lineHeight: 1.2,
        maxWidth: 960,
        wrap: true,
        fill: "#cbd5e1"
      },
      {
        lineHeight: track([
          [0, 1.1],
          [4, 1.8],
          [8, 1.1]
        ]),
        opacity: track([
          [0, 0.7],
          [2, 1],
          [6, 1],
          [8, 0.7]
        ])
      }
    ),

    textElement(
      "spin_origin",
      width / 2,
      680,
      "Origin + rotation test",
      {
        align: "center",
        fontFamily: "Roboto, Arial, sans-serif",
        fontSize: 22,
        weight: 700,
        origin: [width / 2, 680],
        fill: "#facc15"
      },
      {
        rotation: track([
          [0, 0],
          [8, 360]
        ])
      }
    )
  ]
};

const outPath = path.join(__dirname, "text-only-sample.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
