const { saveVisual } = require("./_helpers.cjs");

const doc = {
  version: 1,
  canvas: { width: 960, height: 540, background: "#ffffff", duration: 5, fps: 30 },
  elements: [
    { id: "title", type: "text", text: "Animated follower and point references", x: 480, y: 52, align: "center", valign: "middle", fontSize: 32, weight: 800, fill: "#111827" },
    { id: "route", type: "curve", from: [110, 360], control1: [250, 110], control2: [560, 470], to: [830, 170], fill: "none", stroke: "#2563eb", strokeWidth: 6, strokeCap: "round", drawEnd: 1 },
    { id: "packet", type: "circle", radius: 13, fill: "#ef4444", stroke: "#7f1d1d", strokeWidth: 3, follow: "route", progress: { from: 0, to: 1, duration: 5, ease: "ease-in-out" } },
    { id: "moving_anchor", type: "point", x: 110, y: 455, animate: { x: { from: 110, to: 830, duration: 5, ease: "linear" } } },
    { id: "anchor_dot", type: "circle", cx: 110, cy: 455, radius: 8, fill: "#16a34a", animate: { cx: { from: 110, to: 830, duration: 5, ease: "linear" } } },
    { id: "tether", type: "line", from: "moving_anchor", to: [480, 270], stroke: "#94a3b8", strokeWidth: 2, dashArray: [8, 8] },
    { id: "note", type: "text", text: "circle.follow samples the curve; line endpoints resolve animated point references", x: 480, y: 485, align: "center", valign: "middle", fontSize: 18, fill: "#475569" }
  ]
};

saveVisual("02-animated-follow-2d", doc);
