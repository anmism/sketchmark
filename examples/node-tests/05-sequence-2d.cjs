const { core, saveVisual, writeText } = require("./_helpers.cjs");

const doc = {
  version: 1,
  canvas: { width: 960, height: 540, background: "#f8fafc", duration: 6, fps: 30 },
  scenes: {
    problem: {
      elements: [
        { id: "title", type: "text", text: "Problem", x: 480, y: 90, align: "center", valign: "middle", fontSize: 48, weight: 800, fill: "#dc2626" },
        { id: "copy", type: "text", text: "User types example.com, but the browser needs an IP address.", x: 480, y: 250, align: "center", valign: "middle", fontSize: 24, fill: "#334155", maxWidth: 700, wrap: true }
      ]
    },
    lookup: {
      elements: [
        { id: "title", type: "text", text: "Lookup", x: 480, y: 90, align: "center", valign: "middle", fontSize: 48, weight: 800, fill: "#2563eb" },
        { id: "browser", type: "rect", x: 160, y: 220, width: 180, height: 80, radius: 12, fill: "#ffffff", stroke: "#2563eb", strokeWidth: 3 },
        { id: "resolver", type: "rect", x: 620, y: 220, width: 180, height: 80, radius: 12, fill: "#ffffff", stroke: "#16a34a", strokeWidth: 3 },
        { id: "arrow", type: "arrow", from: "browser.right", to: "resolver.left", stroke: "#2563eb", strokeWidth: 4 }
      ]
    },
    result: {
      elements: [
        { id: "title", type: "text", text: "Result", x: 480, y: 90, align: "center", valign: "middle", fontSize: 48, weight: 800, fill: "#16a34a" },
        { id: "ip", type: "text", text: "93.184.216.34", x: 480, y: 270, align: "center", valign: "middle", fontSize: 54, weight: 900, fill: "#166534" }
      ]
    }
  },
  sequences: {
    main: {
      id: "main",
      clips: [
        { scene: "problem", duration: 2 },
        { scene: "lookup", duration: 2, transition: { type: "fade", duration: 0.5 } },
        { scene: "result", duration: 2, transition: { type: "fade", duration: 0.5 } }
      ]
    }
  }
};

saveVisual("05-sequence-2d", doc);
writeText("05-sequence-2d.timeline.json", JSON.stringify(core.sequenceTimeline(doc, "main", 2), null, 2));
