const fs = require("fs");
const path = require("path");

const width = 1000;
const height = 920;
const duration = 8;
const fps = 30;
const bg = "#ffffff";
const font = "Inter, system-ui, sans-serif";
const monoFont = "JetBrains Mono, Fira Code, monospace";
const altFont = "Roboto, Arial, sans-serif";

const colors = {
  headline: "#0f172a",
  subtitle: "#475569",
  body: "#334155",
  muted: "#64748b",
  number: "#2563eb",
  codeBg: "#1e293b",
  codeText: "#e2e8f0",
  pillBg: "#f1f5f9",
  pillBorder: "#cbd5e1",
  pillText: "#475569",
  note: "#94a3b8",
  divider: "#e2e8f0"
};

const curves = {
  ease: { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }
};

const padX = 72;
const contentW = width - padX * 2;
let y = 56;

const elements = [];

function kf(time, value, out) {
  return out ? { time, value, out } : { time, value };
}

function animated(tracks) {
  return { timeline: { tracks } };
}

// === 1. Centered headline ===
elements.push({
  id: "headline",
  type: "text",
  x: width / 2,
  y: y,
  text: "Typography Stress Test",
  align: "center",
  valign: "top",
  fontSize: 40,
  fontFamily: font,
  weight: 700,
  fill: colors.headline,
  ...animated({
    fontSize: {
      keyframes: [
        kf(0, 40, curves.ease),
        kf(1.6, 46, curves.ease),
        kf(3.3, 36, curves.ease),
        kf(4.8, 44, curves.ease),
        kf(6.5, 40)
      ]
    },
    letterSpacing: {
      keyframes: [
        kf(0, 0, curves.ease),
        kf(1.6, 1.5, curves.ease),
        kf(3.3, 4, curves.ease),
        kf(4.8, 0.8, curves.ease),
        kf(6.5, 0)
      ]
    },
    weight: {
      keyframes: [
        kf(0, 700),
        kf(2.2, 300),
        kf(4.4, 700),
        kf(6.5, 700)
      ]
    }
  })
});
y += 56;

// === 2. Centered subtitle ===
elements.push({
  id: "subtitle",
  type: "text",
  x: width / 2,
  y: y,
  text: "Demonstrating multiple alignment modes, text styles, and layout patterns\nin a single cohesive document without visual overlap.",
  align: "center",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.55,
  fill: colors.subtitle,
  maxWidth: contentW,
  ...animated({
    lineHeight: {
      keyframes: [
        kf(0, 1.55, curves.ease),
        kf(2, 1.9, curves.ease),
        kf(4.2, 1.3, curves.ease),
        kf(6.4, 1.55)
      ]
    }
  })
});
y += 64;

// Divider
elements.push({
  id: "divider-1",
  type: "path",
  d: `M ${padX} ${y} L ${width - padX} ${y}`,
  stroke: colors.divider,
  strokeWidth: 1,
  fill: "none"
});
y += 40;

// === 3. Left-aligned paragraph block ===
elements.push({
  id: "para-heading",
  type: "text",
  x: padX,
  y: y,
  text: "Overview",
  align: "left",
  valign: "top",
  fontSize: 20,
  fontFamily: font,
  weight: 700,
  fill: colors.headline
});
y += 32;

elements.push({
  id: "para-body",
  type: "text",
  x: padX,
  y: y,
  text: "This document tests the render kernel's ability to handle diverse typographic\nscenarios. Each section exercises a different combination of alignment, weight,\nsize, and line height. The goal is to verify that spacing remains predictable\nand that no elements collide regardless of content length or style variation.",
  align: "left",
  valign: "top",
  fontSize: 14,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.7,
  fill: colors.body,
  maxWidth: contentW,
  ...animated({
    letterSpacing: {
      keyframes: [
        kf(0, 0, curves.ease),
        kf(2.6, 0.6, curves.ease),
        kf(5.1, 0.15, curves.ease),
        kf(7, 0)
      ]
    }
  })
});
y += 110;

// === 4. Left-aligned numbered list ===
elements.push({
  id: "list-heading",
  type: "text",
  x: padX,
  y: y,
  text: "Validation Checklist",
  align: "left",
  valign: "top",
  fontSize: 20,
  fontFamily: font,
  weight: 700,
  fill: colors.headline
});
y += 32;

const listItems = [
  "Confirm that centered text remains horizontally balanced at all font sizes.",
  "Verify left-aligned blocks maintain consistent left edge across line breaks.",
  "Check that right-aligned notes anchor correctly without drifting.",
  "Ensure code blocks preserve whitespace and monospace character width.",
  "Validate that pill components center their labels within fixed bounds."
];

listItems.forEach((text, i) => {
  const itemY = y + i * 28;

  // Number
  elements.push({
    id: `list-num-${i}`,
    type: "text",
    x: padX,
    y: itemY,
    text: `${i + 1}.`,
    align: "left",
    valign: "top",
    fontSize: 14,
    fontFamily: font,
    weight: 600,
    fill: colors.number
  });

  // Item text
  elements.push({
    id: `list-item-${i}`,
    type: "text",
    x: padX + 24,
    y: itemY,
    text: text,
    align: "left",
    valign: "top",
    fontSize: 14,
    fontFamily: font,
    weight: 400,
    fill: colors.body,
    maxWidth: contentW - 24
  });
});
y += listItems.length * 28 + 32;

// === 5. Multiline code block ===
const codeLines = `function validateLayout(elements) {
  const bounds = elements.map(el => getBounds(el));
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      if (intersects(bounds[i], bounds[j])) {
        return { valid: false, collision: [i, j] };
      }
    }
  }
  return { valid: true };
}`;

const codeBlockH = 200;
const codeBlockR = 8;
const codePad = 20;

elements.push({
  id: "code-bg",
  type: "path",
  d: roundedRect(padX, y, contentW, codeBlockH, codeBlockR),
  fill: colors.codeBg,
  stroke: "none"
});

elements.push({
  id: "code-text",
  type: "text",
  x: padX + codePad,
  y: y + codePad,
  text: codeLines,
  align: "left",
  valign: "top",
  fontSize: 12,
  fontFamily: monoFont,
  weight: 400,
  lineHeight: 1.55,
  fill: colors.codeText,
  maxWidth: contentW - codePad * 2,
  ...animated({
    fontFamily: {
      keyframes: [
        kf(0, monoFont),
        kf(2.7, altFont),
        kf(5.2, monoFont)
      ]
    }
  })
});
y += codeBlockH + 28;

// === 6. Right-aligned note ===
elements.push({
  id: "note-text",
  type: "text",
  x: width - padX,
  y: y,
  text: "Note: All measurements are in logical pixels.\nActual rendering may vary by display density.",
  align: "right",
  valign: "top",
  fontSize: 12,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.5,
  fill: colors.note,
  maxWidth: 320,
  ...animated({
    fontSize: {
      keyframes: [
        kf(0, 12, curves.ease),
        kf(2.5, 14, curves.ease),
        kf(5.3, 12)
      ]
    },
    letterSpacing: {
      keyframes: [
        kf(0, 0, curves.ease),
        kf(2.5, 1.2, curves.ease),
        kf(5.3, 0.2, curves.ease),
        kf(7.1, 0)
      ]
    }
  })
});
y += 52;

// === 7. Three small centered pills ===
const pills = ["Centered", "Balanced", "Verified"];
const pillH = 28;
const pillR = 14;
const pillPadX = 16;
const pillGap = 12;

let totalPillW = 0;
const pillWidths = pills.map(label => {
  const w = label.length * 8 + pillPadX * 2;
  totalPillW += w;
  return w;
});
totalPillW += pillGap * (pills.length - 1);

let pillX = (width - totalPillW) / 2;

pills.forEach((label, i) => {
  const pw = pillWidths[i];

  elements.push({
    id: `pill-bg-${i}`,
    type: "path",
    d: roundedRect(pillX, y, pw, pillH, pillR),
    fill: colors.pillBg,
    stroke: colors.pillBorder,
    strokeWidth: 1
  });

  elements.push({
    id: `pill-text-${i}`,
    type: "text",
    x: pillX + pw / 2,
    y: y + pillH / 2,
    text: label,
    align: "center",
    valign: "middle",
    fontSize: 12,
    fontFamily: font,
    weight: 500,
    fill: colors.pillText,
    ...animated({
      weight: {
        keyframes: [
          kf(0, 500),
          kf(1.8 + i * 0.18, 700),
          kf(4.1 + i * 0.18, 300),
          kf(6.2 + i * 0.18, 500)
        ]
      }
    })
  });

  pillX += pw + pillGap;
});

function roundedRect(x, y, w, h, r) {
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z"
  ].join(" ");
}

const doc = {
  version: 1,
  canvas: { width, height, background: bg, duration, fps },
  elements
};

const outPath = path.join(__dirname, "typography-test.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
