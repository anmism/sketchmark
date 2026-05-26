const fs = require("node:fs");
const path = require("node:path");

const canvas = {
  width: 420,
  height: 620,
  background: "#f5f5f5"
};

const ink = "#000000";
const strokeWidth = 6;

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function stroke(width = strokeWidth) {
  return {
    fill: "none",
    stroke: ink,
    strokeWidth: width,
    strokeCap: "round",
    strokeJoin: "round"
  };
}

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function groupElement(id, x, y, children, extra = {}) {
  return { id, type: "group", x, y, children, ...extra };
}

function circlePath(cx, cy, r) {
  const c = round(r * 0.5522847498);
  return [
    `M ${round(cx + r)} ${round(cy)}`,
    `C ${round(cx + r)} ${round(cy + c)} ${round(cx + c)} ${round(cy + r)} ${round(cx)} ${round(cy + r)}`,
    `C ${round(cx - c)} ${round(cy + r)} ${round(cx - r)} ${round(cy + c)} ${round(cx - r)} ${round(cy)}`,
    `C ${round(cx - r)} ${round(cy - c)} ${round(cx - c)} ${round(cy - r)} ${round(cx)} ${round(cy - r)}`,
    `C ${round(cx + c)} ${round(cy - r)} ${round(cx + r)} ${round(cy - c)} ${round(cx + r)} ${round(cy)}`,
    "Z"
  ].join(" ");
}

function ellipsePath(cx, cy, rx, ry) {
  const c = 0.5522847498;
  const ox = round(rx * c);
  const oy = round(ry * c);
  return [
    `M ${round(cx + rx)} ${round(cy)}`,
    `C ${round(cx + rx)} ${round(cy + oy)} ${round(cx + ox)} ${round(cy + ry)} ${round(cx)} ${round(cy + ry)}`,
    `C ${round(cx - ox)} ${round(cy + ry)} ${round(cx - rx)} ${round(cy + oy)} ${round(cx - rx)} ${round(cy)}`,
    `C ${round(cx - rx)} ${round(cy - oy)} ${round(cx - ox)} ${round(cy - ry)} ${round(cx)} ${round(cy - ry)}`,
    `C ${round(cx + ox)} ${round(cy - ry)} ${round(cx + rx)} ${round(cy - oy)} ${round(cx + rx)} ${round(cy)}`,
    "Z"
  ].join(" ");
}

function polylinePath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${round(point[0])} ${round(point[1])}`).join(" ");
}

function quadPath(x1, y1, cx, cy, x2, y2) {
  return `M ${round(x1)} ${round(y1)} Q ${round(cx)} ${round(cy)} ${round(x2)} ${round(y2)}`;
}

const figure = groupElement(
  "stickman",
  20,
  18,
  [
    groupElement(
      "head",
      0,
      0,
      [
        pathElement("head_outline", circlePath(110, 82, 58), { fill: "#fafafa", stroke: ink, strokeWidth }),
        pathElement("hair_left", quadPath(84, 28, 92, 8, 118, 8), stroke(4)),
        pathElement("hair_mid", quadPath(102, 20, 122, -6, 150, 6), stroke(4)),
        pathElement("hair_right", quadPath(124, 24, 150, 2, 176, 22), stroke(4)),
        pathElement("eye_open", circlePath(84, 80, 7), { fill: ink }),
        pathElement("eye_wink", polylinePath([[134, 74], [144, 66], [152, 72]]), stroke(5)),
        pathElement("smile", quadPath(82, 116, 110, 136, 142, 104), stroke(5))
      ],
      { width: 190, height: 150 }
    ),
    pathElement("neck", polylinePath([[112, 140], [114, 174]]), stroke()),
    pathElement("torso", quadPath(114, 174, 124, 250, 116, 314), stroke()),
    pathElement("left_arm", polylinePath([[116, 188], [36, 246], [98, 284]]), stroke()),
    pathElement("left_hand_loop", ellipsePath(104, 308, 14, 7), stroke(4)),
    pathElement("right_arm", polylinePath([[116, 188], [194, 220], [280, 128]]), stroke()),
    groupElement(
      "right_hand",
      264,
      100,
      [
        pathElement("hand_palm", polylinePath([[16, 18], [16, 46]]), stroke()),
        pathElement("hand_index", polylinePath([[16, 28], [58, 22]]), stroke()),
        pathElement("hand_thumb", polylinePath([[18, 32], [34, 40]]), stroke()),
        pathElement("hand_curve", quadPath(14, 22, 4, 28, 14, 38), stroke(5)),
        pathElement("hand_knuckle_top", polylinePath([[20, 26], [20, 10]]), stroke(5)),
        pathElement("hand_knuckle_mid", polylinePath([[26, 27], [26, 12]]), stroke(5))
      ],
      { width: 62, height: 50, origin: [16, 28] }
    ),
    groupElement(
      "finger_marks",
      264,
      100,
      [
        pathElement("mark_top", polylinePath([[64, 14], [68, 0]]), stroke(4)),
        pathElement("mark_mid", polylinePath([[74, 26], [86, 20]]), stroke(4)),
        pathElement("mark_low", polylinePath([[72, 36], [82, 42]]), stroke(4))
      ],
      { width: 90, height: 44 }
    ),
    pathElement("hip_mark", ellipsePath(116, 316, 10, 5), { fill: ink }),
    pathElement("left_leg", polylinePath([[116, 316], [64, 560]]), stroke()),
    pathElement("right_leg", polylinePath([[116, 316], [188, 456], [146, 558]]), stroke()),
    pathElement("left_foot", ellipsePath(58, 562, 18, 6), stroke(5)),
    pathElement("right_foot", ellipsePath(152, 560, 18, 6), stroke(5))
  ],
  { width: 340, height: 570 }
);

const document = {
  version: 1,
  canvas,
  elements: [figure]
};

const outPath = path.join(__dirname, "stickman-pointing.visual.json");
fs.writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
