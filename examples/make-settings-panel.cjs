const fs = require("fs");
const path = require("path");

const width = 960;
const height = 1200;
const bg = "#f8fafc";
const font = "Inter, system-ui, sans-serif";

const colors = {
  title: "#0f172a",
  section: "#1e293b",
  label: "#334155",
  helper: "#64748b",
  placeholder: "#94a3b8",
  inputBg: "#ffffff",
  inputBorder: "#cbd5e1",
  toggleOn: "#2563eb",
  toggleOff: "#d1d5db",
  toggleKnob: "#ffffff",
  warningBg: "#fef3c7",
  warningBorder: "#f59e0b",
  warningText: "#92400e",
  btnPrimaryBg: "#2563eb",
  btnPrimaryText: "#ffffff",
  btnSecondaryBg: "#ffffff",
  btnSecondaryText: "#475569",
  btnSecondaryBorder: "#cbd5e1",
  divider: "#e2e8f0",
  cardBg: "#ffffff",
  cardBorder: "#e2e8f0"
};

const padX = 64;
const contentW = width - padX * 2;
let y = 48;

const elements = [];

// Panel title
elements.push({
  id: "panel-title",
  type: "text",
  x: padX,
  y: y,
  text: "Settings",
  align: "left",
  valign: "top",
  fontSize: 32,
  fontFamily: font,
  weight: 700,
  fill: colors.title
});
y += 48;

elements.push({
  id: "panel-desc",
  type: "text",
  x: padX,
  y: y,
  text: "Manage your account preferences and application configuration.",
  align: "left",
  valign: "top",
  fontSize: 14,
  fontFamily: font,
  weight: 400,
  fill: colors.helper
});
y += 40;

// === Section 1: Profile ===
y = renderSectionCard("profile", "Profile", y, function(startY) {
  let cy = startY;

  // Display Name field
  cy = renderTextField("display-name", "Display Name", "Your public-facing name shown across the application.", "Jane Doe", cy);
  cy += 24;

  // Email field
  cy = renderTextField("email", "Email Address", "Used for notifications and account recovery.", "jane@example.com", cy);

  return cy;
});
y += 32;

// === Section 2: Notifications ===
y = renderSectionCard("notif", "Notifications", y, function(startY) {
  let cy = startY;

  // Toggle: Email notifications
  cy = renderToggle("email-notif", "Email Notifications", "Receive updates about activity in your projects.", true, cy);
  cy += 24;

  // Toggle: Marketing
  cy = renderToggle("marketing", "Marketing Emails", "Occasional product announcements and feature previews.", false, cy);
  cy += 24;

  // Toggle: Slack integration
  cy = renderToggle("slack", "Slack Integration", "Push real-time alerts to your connected Slack workspace.", true, cy);

  return cy;
});
y += 32;

// === Section 3: Security ===
y = renderSectionCard("security", "Security", y, function(startY) {
  let cy = startY;

  // Toggle: 2FA
  cy = renderToggle("twofa", "Two-Factor Authentication", "Adds an extra layer of protection to your account.", true, cy);
  cy += 24;

  // Session timeout field
  cy = renderTextField("session", "Session Timeout", "Automatically log out after this period of inactivity.", "30 minutes", cy);
  cy += 24;

  // Warning note
  cy = renderWarning("security-warn", "Disabling 2FA will immediately remove the second factor from\nyour account. You will not be prompted again until re-enabled.", cy);

  return cy;
});
y += 40;

// === Buttons row ===
const btnH = 42;
const btnR = 8;
const saveBtnW = 120;
const resetBtnW = 100;
const btnGap = 16;
const btnRowX = padX;

// Reset button (secondary, left)
elements.push({
  id: "btn-reset-bg",
  type: "path",
  d: roundedRect(btnRowX, y, resetBtnW, btnH, btnR),
  fill: colors.btnSecondaryBg,
  stroke: colors.btnSecondaryBorder,
  strokeWidth: 1
});
elements.push({
  id: "btn-reset-label",
  type: "text",
  x: btnRowX + resetBtnW / 2,
  y: y + btnH / 2,
  text: "Reset",
  align: "center",
  valign: "middle",
  fontSize: 14,
  fontFamily: font,
  weight: 500,
  fill: colors.btnSecondaryText
});

// Save button (primary, next to reset)
const saveBtnX = btnRowX + resetBtnW + btnGap;
elements.push({
  id: "btn-save-bg",
  type: "path",
  d: roundedRect(saveBtnX, y, saveBtnW, btnH, btnR),
  fill: colors.btnPrimaryBg,
  stroke: "none"
});
elements.push({
  id: "btn-save-label",
  type: "text",
  x: saveBtnX + saveBtnW / 2,
  y: y + btnH / 2,
  text: "Save Changes",
  align: "center",
  valign: "middle",
  fontSize: 14,
  fontFamily: font,
  weight: 600,
  fill: colors.btnPrimaryText
});

// --- Helpers ---

function renderSectionCard(prefix, title, startY, contentFn) {
  const headerH = 44;
  const innerPad = 24;

  // We render content first to measure, then wrap in card
  const tempY = startY + headerH + innerPad;
  const endY = contentFn(tempY);
  const cardH = (endY - startY) + innerPad;

  // Card bg
  elements.push({
    id: `${prefix}-card`,
    type: "path",
    d: roundedRect(padX, startY, contentW, cardH, 10),
    fill: colors.cardBg,
    stroke: colors.cardBorder,
    strokeWidth: 1
  });

  // Section title
  elements.push({
    id: `${prefix}-title`,
    type: "text",
    x: padX + innerPad,
    y: startY + 18,
    text: title,
    align: "left",
    valign: "top",
    fontSize: 18,
    fontFamily: font,
    weight: 600,
    fill: colors.section
  });

  // Divider under title
  elements.push({
    id: `${prefix}-div`,
    type: "path",
    d: `M ${padX} ${startY + headerH} L ${padX + contentW} ${startY + headerH}`,
    stroke: colors.divider,
    strokeWidth: 1,
    fill: "none"
  });

  return startY + cardH;
}

function renderTextField(id, label, helper, placeholder, cy) {
  const innerPad = 24;
  const fieldX = padX + innerPad;
  const fieldW = contentW - innerPad * 2;

  // Label
  elements.push({
    id: `${id}-label`,
    type: "text",
    x: fieldX,
    y: cy,
    text: label,
    align: "left",
    valign: "top",
    fontSize: 14,
    fontFamily: font,
    weight: 500,
    fill: colors.label
  });
  cy += 22;

  // Helper text
  elements.push({
    id: `${id}-helper`,
    type: "text",
    x: fieldX,
    y: cy,
    text: helper,
    align: "left",
    valign: "top",
    fontSize: 12,
    fontFamily: font,
    weight: 400,
    fill: colors.helper
  });
  cy += 24;

  // Input field background
  const inputH = 38;
  elements.push({
    id: `${id}-input-bg`,
    type: "path",
    d: roundedRect(fieldX, cy, fieldW, inputH, 6),
    fill: colors.inputBg,
    stroke: colors.inputBorder,
    strokeWidth: 1
  });

  // Placeholder text
  elements.push({
    id: `${id}-placeholder`,
    type: "text",
    x: fieldX + 12,
    y: cy + inputH / 2,
    text: placeholder,
    align: "left",
    valign: "middle",
    fontSize: 13,
    fontFamily: font,
    weight: 400,
    fill: colors.placeholder
  });
  cy += inputH;

  return cy;
}

function renderToggle(id, label, helper, isOn, cy) {
  const innerPad = 24;
  const fieldX = padX + innerPad;

  // Label
  elements.push({
    id: `${id}-label`,
    type: "text",
    x: fieldX,
    y: cy,
    text: label,
    align: "left",
    valign: "top",
    fontSize: 14,
    fontFamily: font,
    weight: 500,
    fill: colors.label
  });

  // Toggle track (right-aligned)
  const toggleW = 40;
  const toggleH = 22;
  const toggleX = padX + contentW - innerPad - toggleW;
  const toggleY = cy - 2;
  const trackR = toggleH / 2;

  elements.push({
    id: `${id}-track`,
    type: "path",
    d: roundedRect(toggleX, toggleY, toggleW, toggleH, trackR),
    fill: isOn ? colors.toggleOn : colors.toggleOff,
    stroke: "none"
  });

  // Toggle knob
  const knobR = 8;
  const knobCx = isOn ? toggleX + toggleW - trackR : toggleX + trackR;
  const knobCy = toggleY + toggleH / 2;
  elements.push({
    id: `${id}-knob`,
    type: "path",
    d: `M ${knobCx} ${knobCy - knobR} A ${knobR} ${knobR} 0 1 1 ${knobCx} ${knobCy + knobR} A ${knobR} ${knobR} 0 1 1 ${knobCx} ${knobCy - knobR} Z`,
    fill: colors.toggleKnob,
    stroke: "none"
  });

  cy += 22;

  // Helper text
  elements.push({
    id: `${id}-helper`,
    type: "text",
    x: fieldX,
    y: cy,
    text: helper,
    align: "left",
    valign: "top",
    fontSize: 12,
    fontFamily: font,
    weight: 400,
    fill: colors.helper
  });
  cy += 20;

  return cy;
}

function renderWarning(id, text, cy) {
  const innerPad = 24;
  const fieldX = padX + innerPad;
  const fieldW = contentW - innerPad * 2;
  const warnPadX = 14;
  const warnPadY = 12;
  const lineCount = text.split("\n").length;
  const warnH = lineCount * 20 + warnPadY * 2;

  elements.push({
    id: `${id}-bg`,
    type: "path",
    d: roundedRect(fieldX, cy, fieldW, warnH, 6),
    fill: colors.warningBg,
    stroke: colors.warningBorder,
    strokeWidth: 1
  });

  elements.push({
    id: `${id}-icon`,
    type: "text",
    x: fieldX + warnPadX,
    y: cy + warnPadY,
    text: "⚠",
    align: "left",
    valign: "top",
    fontSize: 14,
    fontFamily: font,
    weight: 400,
    fill: colors.warningText
  });

  elements.push({
    id: `${id}-text`,
    type: "text",
    x: fieldX + warnPadX + 22,
    y: cy + warnPadY + 1,
    text: text,
    align: "left",
    valign: "top",
    fontSize: 12,
    fontFamily: font,
    weight: 400,
    lineHeight: 1.65,
    fill: colors.warningText,
    maxWidth: fieldW - warnPadX * 2 - 22
  });

  cy += warnH;
  return cy;
}

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

const outPath = path.join(__dirname, "settings-panel.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
