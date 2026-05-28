const fs = require("fs");
const path = require("path");

const width = 1080;
const height = 1350;
const font = "Cormorant Garamond, Garamond, Georgia, serif";
const sansFont = "Montserrat, Helvetica Neue, Arial, sans-serif";

const colors = {
  bg: "#e8eef4",
  navy: "#1a2744",
  navyLight: "#2d3f5e",
  bodyText: "#3d4f6a",
  muted: "#6b7d96",
  accent: "#b8cad9",
  frost: "#d4e3ef",
  white: "#ffffff",
  stone: "#8a9bb0",
  gold: "#8b7355",
  divider: "#c5d4e2",
  ingredientDot: "#2d5a3d",
  priceStrike: "#8b9bb0"
};

const elements = [];

// Background wash - soft gradient feel via layered shapes
elements.push({
  id: "bg-wash",
  type: "path",
  d: `M 0 0 H ${width} V ${height} H 0 Z`,
  fill: {
    type: "linearGradient",
    from: [0, 0],
    to: [0, height],
    stops: [
      { offset: 0, color: "#dce8f2" },
      { offset: 0.4, color: "#e8eef4" },
      { offset: 1, color: "#f0f4f8" }
    ]
  },
  stroke: "none"
});

// Condensation/frost texture top area
elements.push({
  id: "frost-wash-top",
  type: "path",
  d: `M 0 0 H ${width} V 200 Q 800 180 600 200 Q 300 220 0 190 Z`,
  fill: {
    type: "linearGradient",
    from: [0, 0],
    to: [0, 200],
    stops: [
      { offset: 0, color: "#c8dced" },
      { offset: 1, color: "#e8eef4" }
    ]
  },
  stroke: "none",
  opacity: 0.5
});

// --- HEADER: Product Name (right side, editorial serif) ---
elements.push({
  id: "title-glacier",
  type: "text",
  x: 640,
  y: 68,
  text: "Glacier Repair",
  align: "left",
  valign: "top",
  fontSize: 56,
  fontFamily: font,
  weight: 400,
  fontStyle: "italic",
  fill: colors.navy
});

elements.push({
  id: "title-barrier",
  type: "text",
  x: 640,
  y: 130,
  text: "Barrier Cream",
  align: "left",
  valign: "top",
  fontSize: 56,
  fontFamily: font,
  weight: 400,
  fontStyle: "italic",
  fill: colors.navy
});

// Tagline
elements.push({
  id: "tagline",
  type: "text",
  x: 640,
  y: 210,
  text: "Rebuild. Calm. Hydrate for 72 Hours.",
  align: "left",
  valign: "top",
  fontSize: 18,
  fontFamily: font,
  weight: 400,
  fontStyle: "italic",
  fill: colors.bodyText
});

// Generation label pill
elements.push({
  id: "gen-label-border",
  type: "path",
  d: roundedRect(640, 258, 360, 36, 4),
  fill: "none",
  stroke: colors.navy,
  strokeWidth: 1.2
});

elements.push({
  id: "gen-label-text",
  type: "text",
  x: 820,
  y: 276,
  text: "THIRD-GENERATION BILAYER FORMULA",
  align: "center",
  valign: "middle",
  fontSize: 11,
  fontFamily: sansFont,
  weight: 600,
  letterSpacing: 1.8,
  fill: colors.navy
});

// --- LEFT SIDE: Product visual area ---
// Stone slab (angular shape)
elements.push({
  id: "stone-slab",
  type: "path",
  d: "M 60 580 L 120 520 L 480 500 L 520 560 L 500 680 L 80 700 Z",
  fill: {
    type: "linearGradient",
    from: [60, 500],
    to: [520, 700],
    stops: [
      { offset: 0, color: "#7a8fa6" },
      { offset: 0.5, color: "#9bafc2" },
      { offset: 1, color: "#6b809a" }
    ]
  },
  stroke: "none"
});

// Stone highlight edge
elements.push({
  id: "stone-edge",
  type: "path",
  d: "M 120 520 L 480 500 L 520 560 L 500 548 L 130 565 Z",
  fill: "#aec3d4",
  stroke: "none",
  opacity: 0.6
});

// Jar body (rounded rectangle representing the ceramic jar)
elements.push({
  id: "jar-body",
  type: "path",
  d: roundedRect(160, 340, 280, 220, 20),
  fill: {
    type: "linearGradient",
    from: [160, 340],
    to: [440, 560],
    stops: [
      { offset: 0, color: "#f5f8fb" },
      { offset: 0.3, color: "#e8eef5" },
      { offset: 0.7, color: "#dce5ef" },
      { offset: 1, color: "#c8d6e4" }
    ]
  },
  stroke: "#bccad8",
  strokeWidth: 0.8
});

// Jar lid (brushed steel)
elements.push({
  id: "jar-lid",
  type: "path",
  d: roundedRect(150, 320, 300, 35, 6),
  fill: {
    type: "linearGradient",
    from: [150, 320],
    to: [150, 355],
    stops: [
      { offset: 0, color: "#d4dce6" },
      { offset: 0.3, color: "#b8c8d8" },
      { offset: 0.6, color: "#a0b4c6" },
      { offset: 1, color: "#8a9eb4" }
    ]
  },
  stroke: "#94a8bc",
  strokeWidth: 0.5
});

// Jar label text
elements.push({
  id: "jar-brand",
  type: "text",
  x: 300,
  y: 410,
  text: "GLACIER",
  align: "center",
  valign: "middle",
  fontSize: 28,
  fontFamily: sansFont,
  weight: 300,
  letterSpacing: 6,
  fill: colors.navy
});

elements.push({
  id: "jar-product",
  type: "text",
  x: 300,
  y: 448,
  text: "REPAIR BARRIER CREAM",
  align: "center",
  valign: "middle",
  fontSize: 13,
  fontFamily: sansFont,
  weight: 400,
  letterSpacing: 2.5,
  fill: colors.navyLight
});

elements.push({
  id: "jar-gen",
  type: "text",
  x: 300,
  y: 480,
  text: "THIRD-GENERATION BILAYER FORMULA",
  align: "center",
  valign: "middle",
  fontSize: 8.5,
  fontFamily: sansFont,
  weight: 400,
  letterSpacing: 1.2,
  fill: colors.muted
});

elements.push({
  id: "jar-size",
  type: "text",
  x: 300,
  y: 530,
  text: "50 mL  e  1.7 FL OZ.",
  align: "center",
  valign: "middle",
  fontSize: 9,
  fontFamily: sansFont,
  weight: 400,
  fill: colors.muted
});

// --- Floating lipid structure illustrations ---
// Circle 1 (top-left, larger)
elements.push({
  id: "lipid-circle-1",
  type: "path",
  d: circlePath(130, 180, 60),
  fill: "none",
  stroke: colors.accent,
  strokeWidth: 0.8,
  opacity: 0.7
});

elements.push({
  id: "lipid-dots-1a",
  type: "path",
  d: circlePath(115, 170, 4),
  fill: colors.frost,
  stroke: "none",
  opacity: 0.8
});

elements.push({
  id: "lipid-dots-1b",
  type: "path",
  d: circlePath(145, 185, 3),
  fill: colors.frost,
  stroke: "none",
  opacity: 0.6
});

elements.push({
  id: "lipid-dots-1c",
  type: "path",
  d: circlePath(125, 200, 5),
  fill: colors.frost,
  stroke: "none",
  opacity: 0.5
});

// Circle 2 (mid-left, smaller)
elements.push({
  id: "lipid-circle-2",
  type: "path",
  d: circlePath(80, 340, 35),
  fill: "none",
  stroke: colors.accent,
  strokeWidth: 0.6,
  opacity: 0.5
});

elements.push({
  id: "lipid-dots-2a",
  type: "path",
  d: circlePath(75, 335, 3),
  fill: colors.frost,
  stroke: "none",
  opacity: 0.6
});

// Circle 3 (water droplet near jar)
elements.push({
  id: "lipid-circle-3",
  type: "path",
  d: circlePath(460, 280, 28),
  fill: "none",
  stroke: colors.accent,
  strokeWidth: 0.6,
  opacity: 0.5
});

// --- Callout annotations (editorial style) ---
elements.push({
  id: "callout-line-1",
  type: "path",
  d: "M 140 240 L 140 270 L 200 270",
  fill: "none",
  stroke: colors.muted,
  strokeWidth: 0.8
});

elements.push({
  id: "callout-title-1",
  type: "text",
  x: 60,
  y: 244,
  text: "ADVANCED LIPID",
  align: "left",
  valign: "top",
  fontSize: 9,
  fontFamily: sansFont,
  weight: 700,
  letterSpacing: 0.5,
  fill: colors.navy
});

elements.push({
  id: "callout-title-1b",
  type: "text",
  x: 60,
  y: 258,
  text: "BILAYER SYSTEM",
  align: "left",
  valign: "top",
  fontSize: 9,
  fontFamily: sansFont,
  weight: 700,
  letterSpacing: 0.5,
  fill: colors.navy
});

elements.push({
  id: "callout-body-1",
  type: "text",
  x: 60,
  y: 276,
  text: "Strengthens barrier.\nReduces water loss.",
  align: "left",
  valign: "top",
  fontSize: 9,
  fontFamily: sansFont,
  weight: 400,
  lineHeight: 1.4,
  fill: colors.muted
});

// --- RIGHT COLUMN: Ingredients ---
const ingredientY = 340;
const ingredientGap = 90;
const ingredients = [
  { name: "CERAMIDE NP", desc: "Reinforces skin barrier\nand prevents moisture loss." },
  { name: "SQUALANE", desc: "Mimics skin lipids to\nnourish and protect." },
  { name: "BETA-GLUCAN", desc: "Hydrates deeply and\nsupports barrier repair." },
  { name: "CICA", desc: "Calms visible redness\nand irritation." }
];

ingredients.forEach((ing, i) => {
  const iy = ingredientY + i * ingredientGap;

  // Ingredient dot
  elements.push({
    id: `ing-dot-${i}`,
    type: "path",
    d: circlePath(650, iy + 12, 5),
    fill: colors.ingredientDot,
    stroke: "none"
  });

  // Ingredient name
  elements.push({
    id: `ing-name-${i}`,
    type: "text",
    x: 672,
    y: iy,
    text: ing.name,
    align: "left",
    valign: "top",
    fontSize: 14,
    fontFamily: sansFont,
    weight: 700,
    letterSpacing: 0.5,
    fill: colors.navy
  });

  // Ingredient description
  elements.push({
    id: `ing-desc-${i}`,
    type: "text",
    x: 672,
    y: iy + 22,
    text: ing.desc,
    align: "left",
    valign: "top",
    fontSize: 12,
    fontFamily: sansFont,
    weight: 400,
    lineHeight: 1.45,
    fill: colors.bodyText
  });
});

// --- INTENDED FOR section ---
const intendedY = 720;

elements.push({
  id: "intended-label",
  type: "text",
  x: 640,
  y: intendedY,
  text: "INTENDED FOR",
  align: "left",
  valign: "top",
  fontSize: 11,
  fontFamily: sansFont,
  weight: 600,
  letterSpacing: 1.5,
  fill: colors.navy
});

// Divider lines beside "INTENDED FOR"
elements.push({
  id: "intended-line-left",
  type: "path",
  d: `M 640 ${intendedY + 22} L 640 ${intendedY + 22}`,
  fill: "none",
  stroke: colors.divider,
  strokeWidth: 1
});

elements.push({
  id: "intended-line-right",
  type: "path",
  d: `M 760 ${intendedY + 7} L 1020 ${intendedY + 7}`,
  fill: "none",
  stroke: colors.divider,
  strokeWidth: 0.8
});

const profiles = ["POST-PROCEDURE", "WINTER-STRESSED", "REACTIVE"];
const profileX = 640;
const profileGap = 130;

profiles.forEach((label, i) => {
  const px = profileX + i * profileGap;

  elements.push({
    id: `profile-${i}`,
    type: "text",
    x: px + 14,
    y: intendedY + 38,
    text: label,
    align: "left",
    valign: "top",
    fontSize: 9,
    fontFamily: sansFont,
    weight: 500,
    letterSpacing: 0.3,
    fill: colors.bodyText
  });
});

// --- PRICING ---
const priceY = 830;

elements.push({
  id: "price-launch",
  type: "text",
  x: 200,
  y: priceY,
  text: "$98",
  align: "center",
  valign: "top",
  fontSize: 52,
  fontFamily: font,
  weight: 400,
  fill: colors.navy
});

elements.push({
  id: "price-launch-label",
  type: "text",
  x: 200,
  y: priceY + 58,
  text: "LAUNCH PRICE",
  align: "center",
  valign: "top",
  fontSize: 10,
  fontFamily: sansFont,
  weight: 600,
  letterSpacing: 1.5,
  fill: colors.navy
});

// Vertical divider between prices
elements.push({
  id: "price-divider",
  type: "path",
  d: `M 340 ${priceY + 5} L 340 ${priceY + 65}`,
  fill: "none",
  stroke: colors.divider,
  strokeWidth: 1
});

elements.push({
  id: "price-member",
  type: "text",
  x: 480,
  y: priceY,
  text: "$82",
  align: "center",
  valign: "top",
  fontSize: 52,
  fontFamily: font,
  weight: 400,
  fill: colors.navy
});

elements.push({
  id: "price-member-label",
  type: "text",
  x: 480,
  y: priceY + 58,
  text: "MEMBER PRICE",
  align: "center",
  valign: "top",
  fontSize: 10,
  fontFamily: sansFont,
  weight: 600,
  letterSpacing: 1.5,
  fill: colors.navy
});

// --- GIFT SET BLOCK ---
const giftY = 970;

elements.push({
  id: "gift-border",
  type: "path",
  d: roundedRect(200, giftY, 680, 120, 8),
  fill: "none",
  stroke: colors.divider,
  strokeWidth: 1,
  dashArray: [4, 3]
});

// Gift set product thumbnails area (simplified rectangles)
elements.push({
  id: "gift-thumb-1",
  type: "path",
  d: roundedRect(240, giftY + 20, 50, 80, 4),
  fill: colors.frost,
  stroke: colors.accent,
  strokeWidth: 0.8
});

elements.push({
  id: "gift-thumb-2",
  type: "path",
  d: roundedRect(300, giftY + 30, 40, 70, 4),
  fill: colors.frost,
  stroke: colors.accent,
  strokeWidth: 0.8
});

elements.push({
  id: "gift-thumb-3",
  type: "path",
  d: roundedRect(350, giftY + 35, 35, 65, 4),
  fill: colors.frost,
  stroke: colors.accent,
  strokeWidth: 0.8
});

elements.push({
  id: "gift-title",
  type: "text",
  x: 540,
  y: giftY + 30,
  text: "GIFT SET AVAILABLE",
  align: "left",
  valign: "top",
  fontSize: 18,
  fontFamily: sansFont,
  weight: 700,
  letterSpacing: 0.5,
  fill: colors.navy
});

elements.push({
  id: "gift-desc",
  type: "text",
  x: 540,
  y: giftY + 60,
  text: "Limited quantities.\nWhile supplies last.",
  align: "left",
  valign: "top",
  fontSize: 12,
  fontFamily: sansFont,
  weight: 400,
  lineHeight: 1.5,
  fill: colors.bodyText
});

// --- FINE PRINT ---
elements.push({
  id: "fine-print",
  type: "text",
  x: width / 2,
  y: height - 40,
  text: "Results vary. Introduce gradually.",
  align: "center",
  valign: "middle",
  fontSize: 11,
  fontFamily: font,
  weight: 400,
  fontStyle: "italic",
  fill: colors.muted
});

// --- Bottom frost line ---
elements.push({
  id: "bottom-frost",
  type: "path",
  d: `M 0 ${height - 20} L ${width} ${height - 20}`,
  fill: "none",
  stroke: colors.frost,
  strokeWidth: 0.5,
  opacity: 0.6
});

const doc = {
  version: 1,
  canvas: { width, height, background: colors.bg },
  elements
};

const outPath = path.join(__dirname, "glacier-skincare.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);

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

function circlePath(cx, cy, r) {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
}
