const fs = require("fs");
const path = require("path");

const width = 1280;
const height = 720;
const duration = 18;
const fps = 30;
const bg = "#f8fafc";
const font = "Inter, system-ui, sans-serif";

const colors = {
  text: "#0f172a",
  textMuted: "#64748b",
  panelBg: "#ffffff",
  panelBorder: "#e2e8f0",
  inputBg: "#f8fafc",
  inputBorder: "#cbd5e1",
  btnPrimary: "#2563eb",
  btnPrimaryText: "#ffffff",
  btnSecondary: "#ffffff",
  btnSecondaryText: "#475569",
  btnSecondaryBorder: "#e2e8f0",
  accent: "#2563eb",
  success: "#10b981",
  successBg: "#ecfdf5",
  cursor: "#0f172a",
  cursorRing: "#3b82f6",
  backdrop: "#0f172a"
};

const curves = {
  ease: { type: "cubicBezier", x1: 0.4, y1: 0, x2: 0.2, y2: 1 },
  easeOut: { type: "cubicBezier", x1: 0, y1: 0, x2: 0.2, y2: 1 },
  gentle: { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }
};

const elements = [];

// Layout constants
const cardW = 520;
const cardH = 400;
const cardX = (width - cardW) / 2;
const cardY = (height - cardH) / 2;

// Button positions (for cursor targeting)
const uploadBtnX = cardX + cardW / 2;
const uploadBtnY = cardY + 260;
const fileBtnX = cardX + cardW / 2;
const fileBtnY = cardY + 200;
const confirmBtnX = cardX + cardW - 90;
const confirmBtnY = cardY + cardH - 52;

// === Card background (persistent) ===
elements.push({
  id: "main-card-bg",
  type: "path",
  d: roundedRect(cardX, cardY, cardW, cardH, 16),
  fill: colors.panelBg,
  stroke: colors.panelBorder,
  strokeWidth: 1,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0, value: 0, out: curves.ease },
          { time: 0.6, value: 1 },
          { time: 17, value: 1, out: curves.ease },
          { time: 17.5, value: 0 }
        ]
      }
    }
  }
});

// Card title (persistent)
elements.push({
  id: "card-title",
  type: "text",
  x: cardX + 32,
  y: cardY + 32,
  text: "Upload Document",
  align: "left",
  valign: "top",
  fontSize: 20,
  fontFamily: font,
  weight: 600,
  fill: colors.text,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0, value: 0, out: curves.ease },
          { time: 0.6, value: 1 },
          { time: 17, value: 1, out: curves.ease },
          { time: 17.5, value: 0 }
        ]
      }
    }
  }
});

// Card description (persistent until success)
elements.push({
  id: "card-desc",
  type: "text",
  x: cardX + 32,
  y: cardY + 62,
  text: "Add a file to get started with your project.",
  align: "left",
  valign: "top",
  fontSize: 14,
  fontFamily: font,
  weight: 400,
  fill: colors.textMuted,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0, value: 0, out: curves.ease },
          { time: 0.6, value: 1 },
          { time: 13.5, value: 1, out: curves.ease },
          { time: 14, value: 0 }
        ]
      }
    }
  }
});

// === SCENE 1: Empty state (0-6s) - upload zone ===
elements.push({
  id: "upload-zone",
  type: "group",
  x: cardX + 32,
  y: cardY + 100,
  children: [
    {
      id: "upload-zone-bg",
      type: "path",
      d: roundedRect(0, 0, cardW - 64, 140, 12),
      fill: colors.inputBg,
      stroke: colors.inputBorder,
      strokeWidth: 2,
      dashArray: [8, 4]
    },
    {
      id: "upload-icon",
      type: "path",
      d: "M 0 12 L 0 4 A 4 4 0 0 1 4 0 L 20 0 A 4 4 0 0 1 24 4 L 24 12 M 12 20 L 12 6 M 6 12 L 12 6 L 18 12",
      x: (cardW - 64) / 2 - 12,
      y: 40,
      fill: "none",
      stroke: colors.textMuted,
      strokeWidth: 2,
      strokeCap: "round",
      strokeJoin: "round"
    },
    {
      id: "upload-text",
      type: "text",
      x: (cardW - 64) / 2,
      y: 90,
      text: "Drop files here or click to browse",
      align: "center",
      valign: "top",
      fontSize: 13,
      fontFamily: font,
      weight: 400,
      fill: colors.textMuted
    }
  ],
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.3, value: 0, out: curves.ease },
          { time: 0.8, value: 1 },
          // Fade out when file is selected
          { time: 5.8, value: 1, out: curves.ease },
          { time: 6.3, value: 0 }
        ]
      }
    }
  }
});

// Upload button (in empty state)
elements.push({
  id: "upload-btn",
  type: "group",
  x: cardX + cardW / 2 - 70,
  y: cardY + 280,
  children: [
    {
      id: "upload-btn-bg",
      type: "path",
      d: roundedRect(0, 0, 140, 40, 8),
      fill: colors.btnPrimary,
      stroke: "none"
    },
    {
      id: "upload-btn-text",
      type: "text",
      x: 70,
      y: 20,
      text: "Choose File",
      align: "center",
      valign: "middle",
      fontSize: 14,
      fontFamily: font,
      weight: 600,
      fill: colors.btnPrimaryText
    }
  ],
  opacity: 0,
  origin: [70, 20],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.5, value: 0, out: curves.ease },
          { time: 1, value: 1 },
          // Fade out with upload zone
          { time: 5.8, value: 1, out: curves.ease },
          { time: 6.3, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 4.8, value: 1, out: curves.ease },
          { time: 4.95, value: 0.95 },
          { time: 5.1, value: 1 }
        ]
      }
    }
  }
});

// === SCENE 2: File selected state (6-14s) ===
elements.push({
  id: "file-item",
  type: "group",
  x: cardX + 32,
  y: cardY + 100,
  children: [
    {
      id: "file-bg",
      type: "path",
      d: roundedRect(0, 0, cardW - 64, 64, 10),
      fill: colors.panelBg,
      stroke: colors.accent,
      strokeWidth: 2
    },
    // File icon
    {
      id: "file-icon-bg",
      type: "path",
      d: roundedRect(16, 14, 36, 36, 6),
      fill: colors.successBg,
      stroke: "none"
    },
    {
      id: "file-icon",
      type: "path",
      d: "M 28 24 L 28 40 M 28 32 L 22 32 L 28 26 L 34 32 L 28 32",
      fill: "none",
      stroke: colors.success,
      strokeWidth: 2,
      strokeCap: "round",
      strokeJoin: "round"
    },
    {
      id: "file-name",
      type: "text",
      x: 68,
      y: 22,
      text: "quarterly-report.pdf",
      align: "left",
      valign: "top",
      fontSize: 14,
      fontFamily: font,
      weight: 500,
      fill: colors.text
    },
    {
      id: "file-size",
      type: "text",
      x: 68,
      y: 42,
      text: "2.4 MB · PDF Document",
      align: "left",
      valign: "top",
      fontSize: 12,
      fontFamily: font,
      weight: 400,
      fill: colors.textMuted
    },
    // Checkmark
    {
      id: "file-check",
      type: "path",
      d: "M 0 0 m -10 0 a 10 10 0 1 1 20 0 a 10 10 0 1 1 -20 0",
      x: cardW - 64 - 32,
      y: 32,
      fill: colors.success,
      stroke: "none"
    },
    {
      id: "file-check-mark",
      type: "path",
      d: "M -4 0 L -1 3 L 4 -3",
      x: cardW - 64 - 32,
      y: 32,
      fill: "none",
      stroke: "#ffffff",
      strokeWidth: 2,
      strokeCap: "round",
      strokeJoin: "round"
    }
  ],
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          // Fade in after upload zone fades out
          { time: 6.3, value: 0, out: curves.ease },
          { time: 6.8, value: 1 },
          // Stay visible until success state
          { time: 13.5, value: 1, out: curves.ease },
          { time: 14, value: 0 }
        ]
      },
      y: {
        keyframes: [
          { time: 6.3, value: cardY + 110, out: curves.ease },
          { time: 6.8, value: cardY + 100 }
        ]
      }
    }
  }
});

// Status text - ready
elements.push({
  id: "status-text",
  type: "text",
  x: cardX + cardW / 2,
  y: cardY + 190,
  text: "File ready to upload",
  align: "center",
  valign: "top",
  fontSize: 13,
  fontFamily: font,
  weight: 500,
  fill: colors.success,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 7, value: 0, out: curves.ease },
          { time: 7.4, value: 1 },
          // Fade out when uploading starts
          { time: 10.5, value: 1, out: curves.ease },
          { time: 11, value: 0 }
        ]
      }
    }
  }
});

// Confirm button
const confirmBtnW = 140;
const confirmBtnH = 42;
elements.push({
  id: "confirm-btn",
  type: "group",
  x: cardX + cardW - 32 - confirmBtnW,
  y: cardY + cardH - 32 - confirmBtnH,
  children: [
    {
      id: "confirm-btn-bg",
      type: "path",
      d: roundedRect(0, 0, confirmBtnW, confirmBtnH, 8),
      fill: colors.btnPrimary,
      stroke: "none"
    },
    {
      id: "confirm-btn-text",
      type: "text",
      x: confirmBtnW / 2,
      y: confirmBtnH / 2,
      text: "Upload Now",
      align: "center",
      valign: "middle",
      fontSize: 14,
      fontFamily: font,
      weight: 600,
      fill: colors.btnPrimaryText
    }
  ],
  opacity: 0,
  origin: [confirmBtnW / 2, confirmBtnH / 2],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 7.2, value: 0, out: curves.ease },
          { time: 7.6, value: 1 },
          // Fade out when upload starts
          { time: 10.5, value: 1, out: curves.ease },
          { time: 11, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 9.8, value: 1, out: curves.ease },
          { time: 9.95, value: 0.95 },
          { time: 10.1, value: 1 }
        ]
      }
    }
  }
});

// Cancel button
elements.push({
  id: "cancel-btn",
  type: "group",
  x: cardX + 32,
  y: cardY + cardH - 32 - confirmBtnH,
  children: [
    {
      id: "cancel-btn-bg",
      type: "path",
      d: roundedRect(0, 0, 100, confirmBtnH, 8),
      fill: colors.btnSecondary,
      stroke: colors.btnSecondaryBorder,
      strokeWidth: 1
    },
    {
      id: "cancel-btn-text",
      type: "text",
      x: 50,
      y: confirmBtnH / 2,
      text: "Cancel",
      align: "center",
      valign: "middle",
      fontSize: 14,
      fontFamily: font,
      weight: 500,
      fill: colors.btnSecondaryText
    }
  ],
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 7.2, value: 0, out: curves.ease },
          { time: 7.6, value: 1 },
          // Fade out when upload starts
          { time: 10.5, value: 1, out: curves.ease },
          { time: 11, value: 0 }
        ]
      }
    }
  }
});

// === SCENE 3: Uploading state (11-14s) ===
elements.push({
  id: "uploading-text",
  type: "text",
  x: cardX + cardW / 2,
  y: cardY + 190,
  text: "Uploading...",
  align: "center",
  valign: "top",
  fontSize: 13,
  fontFamily: font,
  weight: 500,
  fill: colors.accent,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 11, value: 0, out: curves.ease },
          { time: 11.4, value: 1 },
          { time: 13.5, value: 1, out: curves.ease },
          { time: 14, value: 0 }
        ]
      }
    }
  }
});

// Progress bar track
elements.push({
  id: "progress-track",
  type: "path",
  d: roundedRect(cardX + 80, cardY + 220, cardW - 160, 8, 4),
  fill: colors.inputBg,
  stroke: colors.inputBorder,
  strokeWidth: 1,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 11, value: 0, out: curves.ease },
          { time: 11.4, value: 1 },
          { time: 13.5, value: 1, out: curves.ease },
          { time: 14, value: 0 }
        ]
      }
    }
  }
});

// Progress bar fill (using drawEnd for animation)
elements.push({
  id: "progress-fill",
  type: "path",
  d: `M ${cardX + 82} ${cardY + 222} L ${cardX + cardW - 82} ${cardY + 222} L ${cardX + cardW - 82} ${cardY + 226} L ${cardX + 82} ${cardY + 226} Z`,
  fill: colors.accent,
  stroke: "none",
  opacity: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 11.2, value: 0, out: curves.ease },
          { time: 11.5, value: 1 },
          { time: 13.5, value: 1, out: curves.ease },
          { time: 14, value: 0 }
        ]
      },
      drawEnd: {
        keyframes: [
          { time: 11.5, value: 0, out: curves.gentle },
          { time: 13.5, value: 1 }
        ]
      }
    }
  }
});

// === SCENE 4: Success state (14-18s) ===
elements.push({
  id: "success-overlay",
  type: "group",
  x: cardX + cardW / 2,
  y: cardY + cardH / 2 - 20,
  children: [
    // Large checkmark circle
    {
      id: "success-circle",
      type: "path",
      d: "M 0 0 m -40 0 a 40 40 0 1 1 80 0 a 40 40 0 1 1 -80 0",
      fill: colors.successBg,
      stroke: colors.success,
      strokeWidth: 2
    },
    {
      id: "success-check",
      type: "path",
      d: "M -14 0 L -4 10 L 14 -10",
      fill: "none",
      stroke: colors.success,
      strokeWidth: 3,
      strokeCap: "round",
      strokeJoin: "round"
    },
    {
      id: "success-title",
      type: "text",
      x: 0,
      y: 70,
      text: "Upload Complete",
      align: "center",
      valign: "top",
      fontSize: 18,
      fontFamily: font,
      weight: 600,
      fill: colors.text
    },
    {
      id: "success-desc",
      type: "text",
      x: 0,
      y: 98,
      text: "Your document has been uploaded successfully.",
      align: "center",
      valign: "top",
      fontSize: 13,
      fontFamily: font,
      weight: 400,
      fill: colors.textMuted
    }
  ],
  opacity: 0,
  origin: [0, 0],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 14, value: 0, out: curves.ease },
          { time: 14.6, value: 1 },
          { time: 17, value: 1, out: curves.ease },
          { time: 17.5, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 14, value: 0.8, out: curves.ease },
          { time: 14.6, value: 1 }
        ]
      }
    }
  }
});

// === CURSOR (added last to render on top) ===

// Calculated positions:
// Upload button: x = cardX + cardW/2 = 640, y = cardY + 280 + 20 = 460
// Confirm button: x = cardX + cardW - 32 - confirmBtnW/2 = 798, y = cardY + cardH - 32 - confirmBtnH/2 = 507
const uploadBtnCenter = { x: cardX + cardW / 2, y: cardY + 280 + 20 };
const confirmBtnCenter = { x: cardX + cardW - 32 - confirmBtnW / 2, y: cardY + cardH - 32 - confirmBtnH / 2 };

// Click ring
elements.push({
  id: "click-ring",
  type: "path",
  d: "M 0 0 m -18 0 a 18 18 0 1 1 36 0 a 18 18 0 1 1 -36 0",
  x: uploadBtnCenter.x,
  y: uploadBtnCenter.y,
  fill: "none",
  stroke: colors.cursorRing,
  strokeWidth: 2,
  opacity: 0,
  origin: [0, 0],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          // Click 1: Upload button
          { time: 4.8, value: 0 },
          { time: 4.9, value: 0.5 },
          { time: 5.3, value: 0 },
          // Click 2: Confirm button
          { time: 9.8, value: 0 },
          { time: 9.9, value: 0.5 },
          { time: 10.3, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 4.8, value: 0.5, out: curves.easeOut },
          { time: 5.3, value: 1.8 },
          { time: 9.8, value: 0.5, out: curves.easeOut },
          { time: 10.3, value: 1.8 }
        ]
      },
      x: {
        keyframes: [
          { time: 4.8, value: uploadBtnCenter.x },
          { time: 9.8, value: confirmBtnCenter.x }
        ]
      },
      y: {
        keyframes: [
          { time: 4.8, value: uploadBtnCenter.y },
          { time: 9.8, value: confirmBtnCenter.y }
        ]
      }
    }
  }
});

// Cursor
elements.push({
  id: "cursor",
  type: "group",
  x: -50,
  y: height / 2,
  children: [
    {
      id: "cursor-arrow",
      type: "path",
      d: "M 0 0 L 0 18 L 4.5 14.5 L 7.5 22 L 11 20.5 L 8 13 L 13.5 13 Z",
      fill: colors.cursor,
      stroke: "#ffffff",
      strokeWidth: 1.5
    }
  ],
  timeline: {
    tracks: {
      x: {
        keyframes: [
          // Enter from left
          { time: 2, value: -50, out: curves.ease },
          { time: 3, value: uploadBtnCenter.x },
          // Stay on upload button, click at 4.8
          { time: 5.5, value: uploadBtnCenter.x },
          // Move to confirm button
          { time: 7.5, value: uploadBtnCenter.x, out: curves.ease },
          { time: 8.5, value: confirmBtnCenter.x },
          // Stay on confirm button, click at 9.8
          { time: 10.5, value: confirmBtnCenter.x },
          // Exit
          { time: 13, value: confirmBtnCenter.x, out: curves.ease },
          { time: 14, value: width + 50 }
        ]
      },
      y: {
        keyframes: [
          { time: 2, value: height / 2, out: curves.ease },
          { time: 3, value: uploadBtnCenter.y },
          { time: 5.5, value: uploadBtnCenter.y },
          { time: 7.5, value: uploadBtnCenter.y, out: curves.ease },
          { time: 8.5, value: confirmBtnCenter.y },
          { time: 10.5, value: confirmBtnCenter.y },
          { time: 13, value: confirmBtnCenter.y, out: curves.ease },
          { time: 14, value: height + 50 }
        ]
      }
    }
  }
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

const outPath = path.join(__dirname, "ui-flow.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
