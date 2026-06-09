const fs = require("node:fs");
const path = require("node:path");

const visualPath = path.join(__dirname, "embed-demo.visual.json");
const embedPath = path.join(__dirname, "embed-demo.embed.html");
const hostPath = path.join(__dirname, "embed-demo.host.html");

let renderToEmbedHtml;
try {
  ({ renderToEmbedHtml } = require("../dist/src"));
} catch (error) {
  console.error("Could not load sketchmark from dist/. Run `npm run build` in the sketchmark package first.");
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}

const document = {
  version: 1,
  canvas: {
    width: 640,
    height: 360,
    background: "#f8fafc",
    duration: 2.4,
    fps: 24
  },
  elements: [
    {
      id: "frame",
      type: "path",
      d: roundedRectPath(44, 44, 552, 272, 26),
      fill: "#ffffff",
      stroke: "#d7deea",
      strokeWidth: 2
    },
    {
      id: "title",
      type: "text",
      text: "AI Agent Embed Preview",
      x: 92,
      y: 96,
      fontSize: 26,
      weight: 700,
      fill: "#0f172a"
    },
    {
      id: "copy",
      type: "text",
      lines: [
        "This demo is rendered by renderToEmbedHtml().",
        "The marker moves, the bar grows, and the HTML can be dropped into an iframe."
      ],
      x: 92,
      y: 136,
      fontSize: 15,
      lineHeight: 1.35,
      fill: "#475569"
    },
    {
      id: "track",
      type: "path",
      d: "M 96 228 L 544 228",
      stroke: "#cbd5e1",
      strokeWidth: 12,
      strokeCap: "round"
    },
    {
      id: "progress",
      type: "path",
      d: "M 96 228 L 544 228",
      stroke: "#2563eb",
      strokeWidth: 12,
      strokeCap: "round",
      drawStart: 0,
      drawEnd: 0,
      timeline: {
        tracks: {
          drawEnd: {
            keyframes: [[0, 0], [2.4, 1]],
            ease: "linear"
          }
        }
      }
    },
    {
      id: "marker",
      type: "path",
      d: circlePath(0, 0, 18),
      fill: "#ffffff",
      stroke: "#2563eb",
      strokeWidth: 6,
      x: 96,
      y: 228,
      timeline: {
        tracks: {
          position: {
            keyframes: [[0, [96, 228]], [2.4, [544, 228]]],
            ease: "linear"
          }
        }
      }
    },
    {
      id: "marker.dot",
      type: "path",
      d: circlePath(0, 0, 5),
      fill: "#2563eb",
      x: 96,
      y: 228,
      timeline: {
        tracks: {
          position: {
            keyframes: [[0, [96, 228]], [2.4, [544, 228]]],
            ease: "linear"
          }
        }
      }
    },
    {
      id: "footer",
      type: "text",
      text: "Open embed-demo.host.html to see a parent page controlling the preview.",
      x: 92,
      y: 286,
      fontSize: 13,
      fill: "#64748b"
    }
  ]
};

const embedHtml = renderToEmbedHtml(document, {
  title: "Embed Demo",
  maxFrames: 48
});

const hostHtml = hostDemoHtml(embedHtml);

fs.writeFileSync(visualPath, JSON.stringify(document, null, 2) + "\n", "utf8");
fs.writeFileSync(embedPath, embedHtml, "utf8");
fs.writeFileSync(hostPath, hostHtml, "utf8");

console.log(`Wrote ${path.basename(visualPath)}`);
console.log(`Wrote ${path.basename(embedPath)}`);
console.log(`Wrote ${path.basename(hostPath)}`);

function circlePath(cx, cy, r) {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

function roundedRectPath(x, y, width, height, radius) {
  const right = x + width;
  const bottom = y + height;
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return [
    `M ${x + r} ${y}`,
    `H ${right - r}`,
    `Q ${right} ${y} ${right} ${y + r}`,
    `V ${bottom - r}`,
    `Q ${right} ${bottom} ${right - r} ${bottom}`,
    `H ${x + r}`,
    `Q ${x} ${bottom} ${x} ${bottom - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z"
  ].join(" ");
}

function hostDemoHtml(embedMarkup) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Sketchmark Embed Host Demo</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #e8eefc;
      --panel: rgba(255, 255, 255, 0.82);
      --line: rgba(15, 23, 42, 0.12);
      --text: #0f172a;
      --muted: #475569;
      --accent: #2563eb;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      font: 14px/1.5 Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.14), transparent 34%),
        radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.14), transparent 28%),
        var(--bg);
    }
    .shell {
      width: min(1120px, calc(100vw - 32px));
      margin: 24px auto;
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
      gap: 18px;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 22px;
      background: var(--panel);
      backdrop-filter: blur(18px);
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
    }
    .sidebar {
      padding: 20px;
      display: grid;
      gap: 14px;
      align-content: start;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      line-height: 1.15;
    }
    p {
      margin: 0;
      color: var(--muted);
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    button {
      border: 1px solid rgba(37, 99, 235, 0.18);
      border-radius: 12px;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.9);
      color: var(--text);
      font: inherit;
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
    }
    button:hover {
      transform: translateY(-1px);
      border-color: rgba(37, 99, 235, 0.42);
      background: #ffffff;
    }
    code, pre {
      font: 12px/1.45 Consolas, monospace;
    }
    pre {
      margin: 0;
      min-height: 128px;
      padding: 14px;
      overflow: auto;
      border-radius: 16px;
      background: #0f172a;
      color: #dbeafe;
    }
    .preview {
      min-height: 680px;
      padding: 14px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08)),
        radial-gradient(circle at top, rgba(37, 99, 235, 0.14), transparent 58%);
    }
    iframe {
      width: 100%;
      height: 100%;
      min-height: 650px;
      border: 0;
      border-radius: 18px;
      background: transparent;
    }
    @media (max-width: 920px) {
      .shell {
        grid-template-columns: 1fr;
      }
      .preview {
        min-height: 480px;
      }
      iframe {
        min-height: 450px;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="panel sidebar">
      <div>
        <h1>Sketchmark Embed Host Demo</h1>
        <p>This page embeds the generated HTML in an iframe and controls it with postMessage.</p>
      </div>
      <div class="actions">
        <button type="button" data-action="play">Play</button>
        <button type="button" data-action="pause">Pause</button>
        <button type="button" data-action="start">Jump to 0.00s</button>
        <button type="button" data-action="middle">Jump to 1.20s</button>
        <button type="button" data-export="svg">Export SVG</button>
        <button type="button" data-export="mp4">Export MP4</button>
        <button type="button" data-export="html">Export HTML</button>
      </div>
      <p>The status below is driven by the embed's <code>sketchmark-rendered</code> event. MP4 export needs a browser with WebCodecs support.</p>
      <pre id="status">Waiting for preview...</pre>
    </section>
    <section class="panel preview">
      <iframe id="preview" sandbox="allow-scripts allow-downloads"></iframe>
    </section>
  </div>

  <script>
    const preview = document.getElementById("preview");
    const status = document.getElementById("status");
    const embedHtml = ${JSON.stringify(embedMarkup)};

    preview.srcdoc = embedHtml;

    function send(message) {
      if (preview.contentWindow) preview.contentWindow.postMessage(message, "*");
    }

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || !target.dataset) return;
      if (target.dataset.action === "play") send({ type: "sketchmark-play" });
      if (target.dataset.action === "pause") send({ type: "sketchmark-pause" });
      if (target.dataset.action === "start") send({ type: "sketchmark-show", time: 0 });
      if (target.dataset.action === "middle") send({ type: "sketchmark-show", time: 1.2 });
      if (target.dataset.export) send({ type: "sketchmark-export", format: target.dataset.export });
    });

    window.addEventListener("message", (event) => {
      if (!event.data || event.data.type !== "sketchmark-rendered") return;
      status.textContent = JSON.stringify(event.data, null, 2);
    });
  </script>
</body>
</html>`;
}
