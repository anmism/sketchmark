const fs = require("fs");
const path = require("path");

const width = 800;
const height = 600;
const bg = "rgba(15, 23, 42, 0.6)";
const font = "Inter, system-ui, sans-serif";

const colors = {
  overlay: "#0f172a",
  modalBg: "#ffffff",
  modalBorder: "#e2e8f0",
  title: "#0f172a",
  description: "#475569",
  label: "#1e293b",
  helper: "#64748b",
  inputBg: "#ffffff",
  inputBorder: "#cbd5e1",
  placeholder: "#94a3b8",
  warningBg: "#fef2f2",
  warningBorder: "#fecaca",
  warningText: "#991b1b",
  footerBg: "#f8fafc",
  footerBorder: "#e2e8f0",
  btnPrimaryBg: "#dc2626",
  btnPrimaryText: "#ffffff",
  btnSecondaryBg: "#ffffff",
  btnSecondaryText: "#475569",
  btnSecondaryBorder: "#cbd5e1"
};

const elements = [];

// Overlay background
elements.push({
  id: "overlay",
  type: "path",
  d: `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`,
  fill: colors.overlay,
  opacity: 0.5,
  stroke: "none"
});

// Modal dimensions
const modalW = 520;
const modalH = 480;
const modalX = (width - modalW) / 2;
const modalY = (height - modalH) / 2;
const modalR = 12;
const modalPad = 28;

// Modal background
elements.push({
  id: "modal-bg",
  type: "path",
  d: roundedRect(modalX, modalY, modalW, modalH, modalR),
  fill: colors.modalBg,
  stroke: colors.modalBorder,
  strokeWidth: 1,
  effects: { shadow: { dx: 0, dy: 8, blur: 32, color: "#000000", opacity: 0.15 } }
});

let y = modalY + modalPad;
const contentX = modalX + modalPad;
const contentW = modalW - modalPad * 2;

// Title (left aligned)
elements.push({
  id: "modal-title",
  type: "text",
  x: contentX,
  y: y,
  text: "Delete Project",
  align: "left",
  valign: "top",
  fontSize: 20,
  fontFamily: font,
  weight: 700,
  fill: colors.title
});
y += 32;

// Description (left aligned)
elements.push({
  id: "modal-desc",
  type: "text",
  x: contentX,
  y: y,
  text: "This action will permanently remove the project and all associated\ndata. This cannot be undone.",
  align: "left",
  valign: "top",
  fontSize: 14,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.55,
  fill: colors.description,
  maxWidth: contentW
});
y += 56;

// Warning note
const warnH = 56;
const warnR = 6;
const warnPad = 14;

elements.push({
  id: "warning-bg",
  type: "path",
  d: roundedRect(contentX, y, contentW, warnH, warnR),
  fill: colors.warningBg,
  stroke: colors.warningBorder,
  strokeWidth: 1
});

elements.push({
  id: "warning-text",
  type: "text",
  x: contentX + warnPad,
  y: y + warnPad,
  text: "Warning: 3 team members will lose access immediately. Any\nactive integrations connected to this project will stop working.",
  align: "left",
  valign: "top",
  fontSize: 12,
  fontFamily: font,
  weight: 500,
  lineHeight: 1.5,
  fill: colors.warningText,
  maxWidth: contentW - warnPad * 2
});
y += warnH + 24;

// Field 1: Project name
elements.push({
  id: "field1-label",
  type: "text",
  x: contentX,
  y: y,
  text: "Project Name",
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: font,
  weight: 600,
  fill: colors.label
});
y += 22;

elements.push({
  id: "field1-helper",
  type: "text",
  x: contentX,
  y: y,
  text: "Enter the project name exactly as shown to confirm deletion.\nThis helps prevent accidental removal of important data.",
  align: "left",
  valign: "top",
  fontSize: 12,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.5,
  fill: colors.helper,
  maxWidth: contentW
});
y += 42;

// Input field 1
const inputH = 38;
const inputR = 6;

elements.push({
  id: "field1-input-bg",
  type: "path",
  d: roundedRect(contentX, y, contentW, inputH, inputR),
  fill: colors.inputBg,
  stroke: colors.inputBorder,
  strokeWidth: 1
});

elements.push({
  id: "field1-placeholder",
  type: "text",
  x: contentX + 12,
  y: y + inputH / 2,
  text: "acme-dashboard-v2",
  align: "left",
  valign: "middle",
  fontSize: 13,
  fontFamily: font,
  weight: 400,
  fill: colors.placeholder
});
y += inputH + 20;

// Field 2: Confirmation phrase
elements.push({
  id: "field2-label",
  type: "text",
  x: contentX,
  y: y,
  text: "Confirmation Phrase",
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: font,
  weight: 600,
  fill: colors.label
});
y += 22;

elements.push({
  id: "field2-helper",
  type: "text",
  x: contentX,
  y: y,
  text: "Type \"delete my project\" to enable the delete button.",
  align: "left",
  valign: "top",
  fontSize: 12,
  fontFamily: font,
  weight: 400,
  fill: colors.helper,
  maxWidth: contentW
});
y += 26;

// Input field 2
elements.push({
  id: "field2-input-bg",
  type: "path",
  d: roundedRect(contentX, y, contentW, inputH, inputR),
  fill: colors.inputBg,
  stroke: colors.inputBorder,
  strokeWidth: 1
});

elements.push({
  id: "field2-placeholder",
  type: "text",
  x: contentX + 12,
  y: y + inputH / 2,
  text: "delete my project",
  align: "left",
  valign: "middle",
  fontSize: 13,
  fontFamily: font,
  weight: 400,
  fill: colors.placeholder
});

// Footer
const footerH = 68;
const footerY = modalY + modalH - footerH;
const footerR = modalR;

// Footer background (bottom rounded corners only)
elements.push({
  id: "footer-bg",
  type: "path",
  d: `M ${modalX} ${footerY} L ${modalX + modalW} ${footerY} L ${modalX + modalW} ${modalY + modalH - footerR} Q ${modalX + modalW} ${modalY + modalH} ${modalX + modalW - footerR} ${modalY + modalH} L ${modalX + footerR} ${modalY + modalH} Q ${modalX} ${modalY + modalH} ${modalX} ${modalY + modalH - footerR} Z`,
  fill: colors.footerBg,
  stroke: "none"
});

// Footer top border
elements.push({
  id: "footer-border",
  type: "path",
  d: `M ${modalX} ${footerY} L ${modalX + modalW} ${footerY}`,
  stroke: colors.footerBorder,
  strokeWidth: 1,
  fill: "none"
});

// Footer buttons (right-aligned group)
const btnH = 38;
const btnR = 6;
const btnGap = 12;
const cancelBtnW = 80;
const deleteBtnW = 120;
const btnGroupW = cancelBtnW + btnGap + deleteBtnW;
const btnGroupX = modalX + modalW - modalPad - btnGroupW;
const btnY = footerY + (footerH - btnH) / 2;

// Cancel button (secondary)
elements.push({
  id: "btn-cancel-bg",
  type: "path",
  d: roundedRect(btnGroupX, btnY, cancelBtnW, btnH, btnR),
  fill: colors.btnSecondaryBg,
  stroke: colors.btnSecondaryBorder,
  strokeWidth: 1
});

elements.push({
  id: "btn-cancel-label",
  type: "text",
  x: btnGroupX + cancelBtnW / 2,
  y: btnY + btnH / 2,
  text: "Cancel",
  align: "center",
  valign: "middle",
  fontSize: 13,
  fontFamily: font,
  weight: 500,
  fill: colors.btnSecondaryText
});

// Delete button (primary/destructive)
const deleteBtnX = btnGroupX + cancelBtnW + btnGap;

elements.push({
  id: "btn-delete-bg",
  type: "path",
  d: roundedRect(deleteBtnX, btnY, deleteBtnW, btnH, btnR),
  fill: colors.btnPrimaryBg,
  stroke: "none"
});

elements.push({
  id: "btn-delete-label",
  type: "text",
  x: deleteBtnX + deleteBtnW / 2,
  y: btnY + btnH / 2,
  text: "Delete Project",
  align: "center",
  valign: "middle",
  fontSize: 13,
  fontFamily: font,
  weight: 600,
  fill: colors.btnPrimaryText
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
  canvas: { width, height, background: "#64748b" },
  elements
};

const outPath = path.join(__dirname, "modal-dialog.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
