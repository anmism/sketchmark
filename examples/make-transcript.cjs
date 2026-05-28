const fs = require("fs");
const path = require("path");

const width = 900;
const height = 1140;
const bg = "#ffffff";
const font = "Inter, system-ui, sans-serif";

const colors = {
  title: "#0f172a",
  subtitle: "#64748b",
  speaker: "#1e293b",
  timestamp: "#94a3b8",
  messageBg: "#f8fafc",
  messageBorder: "#e2e8f0",
  messageText: "#334155",
  divider: "#e2e8f0",
  btnBg: "#1e293b",
  btnText: "#ffffff"
};

const padX = 56;
const contentW = width - padX * 2;
let y = 44;

const elements = [];

// Title
elements.push({
  id: "title",
  type: "text",
  x: padX,
  y: y,
  text: "Meeting Transcript",
  align: "left",
  valign: "top",
  fontSize: 30,
  fontFamily: font,
  weight: 700,
  fill: colors.title
});
y += 42;

// Subtitle
elements.push({
  id: "subtitle",
  type: "text",
  x: padX,
  y: y,
  text: "Product Sync — May 27, 2026 · 10:00 AM · 4 participants",
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: font,
  weight: 400,
  fill: colors.subtitle
});
y += 32;

// Divider
elements.push({
  id: "divider-top",
  type: "path",
  d: `M ${padX} ${y} L ${width - padX} ${y}`,
  stroke: colors.divider,
  strokeWidth: 1,
  fill: "none"
});
y += 32;

// Transcript messages
const messages = [
  {
    speaker: "Sarah Chen",
    time: "10:01",
    text: "Alright, let's get started. The main topic today is the timeline\nfor the v2.4 release. We need to finalize which features ship\nand which get pushed to the next cycle."
  },
  {
    speaker: "Marcus Taylor",
    time: "10:02",
    text: "From the backend side, the API gateway migration is on track.\nWe finished the schema federation layer last week and rate\nlimiting is in review right now."
  },
  {
    speaker: "Priya Nair",
    time: "10:03",
    text: "Design system updates are about 80% done. The new tokens\nare merged but we still need to audit accessibility on the\nrefactored form components before release."
  },
  {
    speaker: "Sarah Chen",
    time: "10:04",
    text: "Good. Let's set a hard cutoff for Friday on the a11y audit.\nIf it's not passing by then we defer the form components\nand ship everything else on schedule."
  },
  {
    speaker: "James Olsen",
    time: "10:05",
    text: "I can help with the audit. I've been running automated scans\non the onboarding flow already so I know the tooling well.\nShould have results by Thursday."
  },
  {
    speaker: "Priya Nair",
    time: "10:06",
    text: "That would be great. I'll share the component list and the\ntest matrix with you after this call so we don't duplicate work."
  },
  {
    speaker: "Sarah Chen",
    time: "10:07",
    text: "Perfect. Let's reconvene Thursday afternoon to review the\naudit results and make the final call. I'll send a calendar\ninvite. Anything else before we wrap?"
  }
];

const speakerX = padX;
const timeX = padX + 136;
const bubbleX = padX;
const bubbleW = contentW;
const bubblePad = 14;
const bubbleR = 8;

messages.forEach((msg, i) => {
  // Speaker name
  elements.push({
    id: `msg-${i}-speaker`,
    type: "text",
    x: speakerX,
    y: y,
    text: msg.speaker,
    align: "left",
    valign: "top",
    fontSize: 13,
    fontFamily: font,
    weight: 600,
    fill: colors.speaker
  });

  // Timestamp (right-aligned to a fixed column)
  elements.push({
    id: `msg-${i}-time`,
    type: "text",
    x: width - padX,
    y: y,
    text: msg.time,
    align: "right",
    valign: "top",
    fontSize: 12,
    fontFamily: font,
    weight: 400,
    fill: colors.timestamp
  });
  y += 24;

  // Message bubble
  const lineCount = msg.text.split("\n").length;
  const bubbleH = lineCount * 21 + bubblePad * 2;

  elements.push({
    id: `msg-${i}-bg`,
    type: "path",
    d: roundedRect(bubbleX, y, bubbleW, bubbleH, bubbleR),
    fill: colors.messageBg,
    stroke: colors.messageBorder,
    strokeWidth: 1
  });

  elements.push({
    id: `msg-${i}-text`,
    type: "text",
    x: bubbleX + bubblePad,
    y: y + bubblePad,
    text: msg.text,
    align: "left",
    valign: "top",
    fontSize: 13,
    fontFamily: font,
    weight: 400,
    lineHeight: 1.6,
    fill: colors.messageText,
    maxWidth: bubbleW - bubblePad * 2
  });

  y += bubbleH + 20;
});

y += 12;

// Centered Export button
const btnW = 140;
const btnH = 42;
const btnX = (width - btnW) / 2;
const btnR = 8;

elements.push({
  id: "btn-export-bg",
  type: "path",
  d: roundedRect(btnX, y, btnW, btnH, btnR),
  fill: colors.btnBg,
  stroke: "none"
});

elements.push({
  id: "btn-export-label",
  type: "text",
  x: width / 2,
  y: y + btnH / 2,
  text: "Export Transcript",
  align: "center",
  valign: "middle",
  fontSize: 14,
  fontFamily: font,
  weight: 600,
  fill: colors.btnText
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
  canvas: { width, height, background: bg },
  elements
};

const outPath = path.join(__dirname, "transcript.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
