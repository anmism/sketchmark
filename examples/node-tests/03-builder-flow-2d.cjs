const { saveVisual } = require("./_helpers.cjs");
const { scene, node, flow, packet, animate, callout } = require("../../dist/src/builders");

const browser = node({ id: "browser", label: "Browser", x: 110, y: 170, width: 170, height: 80, stroke: "#2563eb" });
const resolver = node({ id: "resolver", label: "Resolver", x: 390, y: 170, width: 170, height: 80, stroke: "#16a34a" });
const server = node({ id: "server", label: "Server", x: 670, y: 170, width: 170, height: 80, stroke: "#f59e0b" });

const doc = scene({
  canvas: { width: 960, height: 540, background: "#f8fafc", duration: 4, fps: 30 },
  elements: [
    { id: "title", type: "text", text: "Builder helpers expand to primitives", x: 480, y: 60, align: "center", valign: "middle", fontSize: 32, weight: 800, fill: "#111827" },
    ...browser,
    ...resolver,
    ...server,
    ...flow({ id: "query", from: "browser_box.right", to: "resolver_box.left", label: "query", labelX: 335, labelY: 150, stroke: "#2563eb", strokeWidth: 4 }),
    ...flow({ id: "lookup", from: "resolver_box.right", to: "server_box.left", label: "lookup", labelX: 615, labelY: 150, stroke: "#16a34a", strokeWidth: 4 }),
    packet({ id: "query_packet", on: "query", fill: "#ef4444", progress: animate(0, 1, { duration: 1.6, delay: 0.2, ease: "ease-in-out" }) }),
    packet({ id: "lookup_packet", on: "lookup", fill: "#f59e0b", progress: animate(0, 1, { duration: 1.6, delay: 1.8, ease: "ease-in-out" }) }),
    ...callout({ id: "tip", text: "No compound JSON is emitted", x: 360, y: 330, width: 240, height: 64, target: "resolver_box.bottom", fill: "#111827", stroke: "#ef4444" })
  ]
});

saveVisual("03-builder-flow-2d", doc);
