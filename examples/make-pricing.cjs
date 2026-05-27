const fs = require("fs");
const path = require("path");

const width = 1280;
const height = 820;
const bg = "#f9fafb";
const font = "Inter, system-ui, sans-serif";

const colors = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  accent: "#2563eb",
  accentLight: "#eff6ff",
  white: "#ffffff",
  pillBg: "#2563eb",
  pillText: "#ffffff",
  pillOutlineBg: "#ffffff",
  pillOutlineText: "#2563eb",
  pillOutlineBorder: "#2563eb"
};

const colW = 340;
const colGap = 32;
const totalW = colW * 3 + colGap * 2;
const startX = (width - totalW) / 2;

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    period: "/month",
    pill: null,
    features: [
      "Up to 3 projects",
      "Basic analytics",
      "Community support",
      "1 GB storage",
      "Single user"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "/month",
    pill: { label: "Most popular", filled: true },
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Priority email support",
      "50 GB storage",
      "Up to 10 team members",
      "Custom integrations"
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    pill: { label: "Contact sales", filled: false },
    features: [
      "Everything in Pro",
      "Dedicated account manager",
      "99.99% uptime SLA",
      "Unlimited storage",
      "SSO & SAML",
      "On-premise deployment",
      "Custom contracts"
    ]
  }
];

const elements = [];

// Page title
elements.push({
  id: "page-title",
  type: "text",
  x: width / 2,
  y: 48,
  text: "Choose Your Plan",
  align: "center",
  valign: "top",
  fontSize: 32,
  fontFamily: font,
  weight: 700,
  fill: colors.text
});

elements.push({
  id: "page-subtitle",
  type: "text",
  x: width / 2,
  y: 92,
  text: "Simple, transparent pricing that grows with you.",
  align: "center",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 400,
  fill: colors.muted
});

const cardTop = 148;

plans.forEach((plan, col) => {
  const cx = startX + col * (colW + colGap);
  const centerX = cx + colW / 2;
  const isPro = plan.id === "pro";
  const cardH = 620;
  const r = 12;

  // Card background
  elements.push({
    id: `${plan.id}-card`,
    type: "path",
    d: roundedRect(cx, cardTop, colW, cardH, r),
    fill: colors.white,
    stroke: isPro ? colors.accent : colors.border,
    strokeWidth: isPro ? 2 : 1,
    effects: isPro ? { shadow: { dx: 0, dy: 4, blur: 24, color: "#2563eb", opacity: 0.1 } } : undefined
  });

  let y = cardTop + 32;

  // Pill (if any)
  if (plan.pill) {
    const pillW = plan.pill.label.length * 8 + 24;
    const pillH = 26;
    const pillX = centerX - pillW / 2;
    const pillR = 13;

    elements.push({
      id: `${plan.id}-pill-bg`,
      type: "path",
      d: roundedRect(pillX, y, pillW, pillH, pillR),
      fill: plan.pill.filled ? colors.pillBg : colors.pillOutlineBg,
      stroke: plan.pill.filled ? "none" : colors.pillOutlineBorder,
      strokeWidth: plan.pill.filled ? 0 : 1.5
    });

    elements.push({
      id: `${plan.id}-pill-text`,
      type: "text",
      x: centerX,
      y: y + pillH / 2,
      text: plan.pill.label,
      align: "center",
      valign: "middle",
      fontSize: 12,
      fontFamily: font,
      weight: 600,
      fill: plan.pill.filled ? colors.pillText : colors.pillOutlineText
    });

    y += pillH + 20;
  } else {
    y += 46;
  }

  // Plan name (centered)
  elements.push({
    id: `${plan.id}-name`,
    type: "text",
    x: centerX,
    y: y,
    text: plan.name,
    align: "center",
    valign: "top",
    fontSize: 22,
    fontFamily: font,
    weight: 600,
    fill: colors.text
  });
  y += 40;

  // Price (centered)
  elements.push({
    id: `${plan.id}-price`,
    type: "text",
    x: centerX,
    y: y,
    text: plan.price,
    align: "center",
    valign: "top",
    fontSize: 42,
    fontFamily: font,
    weight: 700,
    fill: colors.text
  });
  y += 56;

  // Period (centered)
  if (plan.period) {
    elements.push({
      id: `${plan.id}-period`,
      type: "text",
      x: centerX,
      y: y,
      text: plan.period,
      align: "center",
      valign: "top",
      fontSize: 14,
      fontFamily: font,
      weight: 400,
      fill: colors.muted
    });
  }
  y += 32;

  // Divider
  elements.push({
    id: `${plan.id}-divider`,
    type: "path",
    d: `M ${cx + 24} ${y} L ${cx + colW - 24} ${y}`,
    stroke: colors.border,
    strokeWidth: 1,
    fill: "none"
  });
  y += 24;

  // Feature list (left-aligned)
  const listX = cx + 32;
  plan.features.forEach((feat, i) => {
    const fy = y + i * 32;

    // Checkmark
    elements.push({
      id: `${plan.id}-check-${i}`,
      type: "path",
      d: `M ${listX} ${fy + 7} L ${listX + 5} ${fy + 12} L ${listX + 12} ${fy + 3}`,
      stroke: colors.accent,
      strokeWidth: 2,
      strokeCap: "round",
      strokeJoin: "round",
      fill: "none"
    });

    elements.push({
      id: `${plan.id}-feat-${i}`,
      type: "text",
      x: listX + 22,
      y: fy,
      text: feat,
      align: "left",
      valign: "top",
      fontSize: 14,
      fontFamily: font,
      weight: 400,
      fill: colors.text
    });
  });
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
  elements: elements.map(el => {
    const cleaned = { ...el };
    if (cleaned.effects === undefined) delete cleaned.effects;
    if (cleaned.strokeWidth === 0) delete cleaned.strokeWidth;
    return cleaned;
  })
};

const outPath = path.join(__dirname, "pricing.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
