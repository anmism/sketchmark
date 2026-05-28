const fs = require("fs");
const path = require("path");

const width = 1280;
const height = 720;
const duration = 24;
const fps = 30;
const bg = "#f8fafc";
const font = "Inter, system-ui, sans-serif";

const colors = {
  hero: "#0f172a",
  heroSub: "#64748b",
  panelBg: "#ffffff",
  panelBorder: "#e2e8f0",
  panelTitle: "#1e293b",
  panelBody: "#475569",
  panelMuted: "#94a3b8",
  inputBg: "#f8fafc",
  inputBorder: "#cbd5e1",
  inputText: "#64748b",
  btnPrimaryBg: "#2563eb",
  btnPrimaryText: "#ffffff",
  btnSecondaryBg: "#ffffff",
  btnSecondaryText: "#475569",
  btnSecondaryBorder: "#e2e8f0",
  accent: "#2563eb",
  success: "#10b981",
  successBg: "#d1fae5",
  cursor: "#0f172a",
  cursorRing: "#3b82f6"
};

const curves = {
  ease: { type: "cubicBezier", x1: 0.4, y1: 0, x2: 0.2, y2: 1 },
  easeOut: { type: "cubicBezier", x1: 0, y1: 0, x2: 0.2, y2: 1 },
  snap: { type: "cubicBezier", x1: 0.2, y1: 1, x2: 0.2, y2: 1 }
};

const elements = [];

// Cursor elements stored separately, added at the end so they render on top
// Button positions (calculated from layout):
// Create button: dashX + dashW - 140 + 56 = 996, dashY + 24 + 20 = 164
// Input field: ~640, ~335 (center of input)
// Save button: modalX + modalW - 150 + 61 = 791, modalY + modalH - 68 + 20 = 482
const createBtnX = 996;
const createBtnY = 164;
const inputFieldX = 640;
const inputFieldY = 335;
const saveBtnX = 791;
const saveBtnY = 482;

const cursorElement = {
  id: "cursor",
  type: "group",
  x: -50,
  y: -50,
  children: [
    {
      id: "cursor-arrow",
      type: "path",
      d: "M 0 0 L 0 20 L 5 16 L 8 24 L 12 22 L 9 14 L 15 14 Z",
      fill: colors.cursor,
      stroke: "#ffffff",
      strokeWidth: 1.5
    }
  ],
  timeline: {
    tracks: {
      x: {
        keyframes: [
          { time: 0, value: -50 },
          // Move to Create button
          { time: 5.5, value: -50, out: curves.ease },
          { time: 6.5, value: createBtnX },
          { time: 8, value: createBtnX },
          // Move to input field
          { time: 10, value: createBtnX, out: curves.ease },
          { time: 11, value: inputFieldX },
          // Move to Save button
          { time: 16, value: inputFieldX, out: curves.ease },
          { time: 17, value: saveBtnX },
          // Exit
          { time: 20, value: saveBtnX, out: curves.ease },
          { time: 21, value: 1400 }
        ]
      },
      y: {
        keyframes: [
          { time: 0, value: -50 },
          { time: 5.5, value: -50, out: curves.ease },
          { time: 6.5, value: createBtnY },
          { time: 8, value: createBtnY },
          { time: 10, value: createBtnY, out: curves.ease },
          { time: 11, value: inputFieldY },
          { time: 16, value: inputFieldY, out: curves.ease },
          { time: 17, value: saveBtnY },
          { time: 20, value: saveBtnY, out: curves.ease },
          { time: 21, value: 800 }
        ]
      }
    }
  }
};

const clickRingElement = {
  id: "click-ring",
  type: "path",
  d: "M 0 0 m -16 0 a 16 16 0 1 1 32 0 a 16 16 0 1 1 -32 0",
  x: createBtnX,
  y: createBtnY,
  fill: "none",
  stroke: colors.cursorRing,
  strokeWidth: 2,
  opacity: 0,
  origin: [0, 0],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          // Click 1: Create button
          { time: 7, value: 0 },
          { time: 7.1, value: 0.6 },
          { time: 7.5, value: 0 },
          // Click 2: Save button
          { time: 17.5, value: 0 },
          { time: 17.6, value: 0.6 },
          { time: 18, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 7, value: 0.5, out: curves.easeOut },
          { time: 7.5, value: 1.5 },
          { time: 17.5, value: 0.5, out: curves.easeOut },
          { time: 18, value: 1.5 }
        ]
      },
      x: {
        keyframes: [
          { time: 7, value: createBtnX },
          { time: 17.5, value: saveBtnX }
        ]
      },
      y: {
        keyframes: [
          { time: 7, value: createBtnY },
          { time: 17.5, value: saveBtnY }
        ]
      }
    }
  }
};

// === SCENE 1: Hero (0-5s) ===
elements.push({
  id: "hero-title",
  type: "text",
  x: width / 2,
  y: 280,
  text: "Build beautiful interfaces",
  align: "center",
  valign: "middle",
  fontSize: 56,
  fontFamily: font,
  weight: 800,
  fill: colors.hero,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.2, value: 0, out: curves.ease },
          { time: 0.8, value: 1 },
          { time: 4, value: 1, out: curves.ease },
          { time: 4.6, value: 0 }
        ]
      },
      y: {
        keyframes: [
          { time: 0.2, value: 300, out: curves.ease },
          { time: 0.8, value: 280 }
        ]
      },
      scale: {
        keyframes: [
          { time: 0.2, value: 0.95, out: curves.ease },
          { time: 0.8, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "hero-sub",
  type: "text",
  x: width / 2,
  y: 360,
  text: "Design, prototype, and ship — all in one place.",
  align: "center",
  valign: "middle",
  fontSize: 22,
  fontFamily: font,
  weight: 400,
  fill: colors.heroSub,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.6, value: 0, out: curves.ease },
          { time: 1.2, value: 1 },
          { time: 4, value: 1, out: curves.ease },
          { time: 4.6, value: 0 }
        ]
      }
    }
  }
});

// === SCENE 2: Dashboard panel (5-10s) ===
const dashX = 200;
const dashY = 120;
const dashW = 880;
const dashH = 480;

elements.push({
  id: "dash-panel",
  type: "group",
  x: dashX,
  y: dashY,
  opacity: 0,
  children: [
    {
      id: "dash-bg",
      type: "path",
      d: roundedRect(0, 0, dashW, dashH, 12),
      fill: colors.panelBg,
      stroke: colors.panelBorder,
      strokeWidth: 1
    },
    // Panel header
    {
      id: "dash-title",
      type: "text",
      x: 28,
      y: 28,
      text: "Your Projects",
      align: "left",
      valign: "top",
      fontSize: 20,
      fontFamily: font,
      weight: 600,
      fill: colors.panelTitle
    },
    {
      id: "dash-subtitle",
      type: "text",
      x: 28,
      y: 56,
      text: "3 projects · Last updated 2 hours ago",
      align: "left",
      valign: "top",
      fontSize: 13,
      fontFamily: font,
      weight: 400,
      fill: colors.panelMuted
    },
    // Divider
    {
      id: "dash-divider",
      type: "path",
      d: `M 0 90 L ${dashW} 90`,
      stroke: colors.panelBorder,
      strokeWidth: 1,
      fill: "none"
    },
    // Project rows
    ...projectRow(0, "Marketing Website", "12 screens · Published", 110),
    ...projectRow(1, "Mobile App v2", "8 screens · Draft", 170),
    ...projectRow(2, "Dashboard Redesign", "24 screens · In review", 230)
  ],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 5, value: 0, out: curves.ease },
          { time: 5.6, value: 1 },
          { time: 9, value: 1, out: curves.ease },
          { time: 9.6, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 5, value: 0.96, out: curves.ease },
          { time: 5.6, value: 1 }
        ]
      }
    }
  }
});

// Create button (separate for zoom effect on click)
elements.push({
  id: "create-btn",
  type: "group",
  x: dashX + dashW - 140,
  y: dashY + 24,
  opacity: 0,
  children: [
    {
      id: "create-btn-bg",
      type: "path",
      d: roundedRect(0, 0, 112, 40, 8),
      fill: colors.btnPrimaryBg,
      stroke: "none"
    },
    {
      id: "create-btn-text",
      type: "text",
      x: 56,
      y: 20,
      text: "Create New",
      align: "center",
      valign: "middle",
      fontSize: 14,
      fontFamily: font,
      weight: 600,
      fill: colors.btnPrimaryText
    }
  ],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 5.3, value: 0, out: curves.ease },
          { time: 5.8, value: 1 },
          { time: 9, value: 1, out: curves.ease },
          { time: 9.6, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 7, value: 1, out: curves.snap },
          { time: 7.15, value: 0.95 },
          { time: 7.3, value: 1 }
        ]
      }
    }
  },
  origin: [56, 20]
});

// === SCENE 3: Create form modal (10-17s) ===
const modalW = 480;
const modalH = 340;
const modalX = (width - modalW) / 2;
const modalY = (height - modalH) / 2;

// Modal backdrop
elements.push({
  id: "modal-backdrop",
  type: "path",
  d: `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`,
  fill: colors.hero,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 10, value: 0, out: curves.ease },
          { time: 10.4, value: 0.4 },
          { time: 19, value: 0.4, out: curves.ease },
          { time: 19.5, value: 0 }
        ]
      }
    }
  }
});

elements.push({
  id: "modal",
  type: "group",
  x: modalX,
  y: modalY,
  opacity: 0,
  children: [
    {
      id: "modal-bg",
      type: "path",
      d: roundedRect(0, 0, modalW, modalH, 12),
      fill: colors.panelBg,
      stroke: "none"
    },
    {
      id: "modal-title",
      type: "text",
      x: 28,
      y: 28,
      text: "Create new project",
      align: "left",
      valign: "top",
      fontSize: 18,
      fontFamily: font,
      weight: 600,
      fill: colors.panelTitle
    },
    {
      id: "modal-desc",
      type: "text",
      x: 28,
      y: 56,
      text: "Give your project a name and choose a template to get started.",
      align: "left",
      valign: "top",
      fontSize: 13,
      fontFamily: font,
      weight: 400,
      fill: colors.panelBody,
      maxWidth: modalW - 56
    },
    // Project name field
    {
      id: "field-label",
      type: "text",
      x: 28,
      y: 100,
      text: "Project name",
      align: "left",
      valign: "top",
      fontSize: 13,
      fontFamily: font,
      weight: 500,
      fill: colors.panelTitle
    },
    {
      id: "field-input-bg",
      type: "path",
      d: roundedRect(28, 124, modalW - 56, 42, 6),
      fill: colors.inputBg,
      stroke: colors.inputBorder,
      strokeWidth: 1
    },
    {
      id: "field-placeholder",
      type: "text",
      x: 40,
      y: 145,
      text: "Enter project name...",
      align: "left",
      valign: "middle",
      fontSize: 14,
      fontFamily: font,
      weight: 400,
      fill: colors.inputText
    },
    // Template selector
    {
      id: "template-label",
      type: "text",
      x: 28,
      y: 186,
      text: "Template",
      align: "left",
      valign: "top",
      fontSize: 13,
      fontFamily: font,
      weight: 500,
      fill: colors.panelTitle
    },
    ...templateOption(0, "Blank", 28, 210, true),
    ...templateOption(1, "Dashboard", 138, 210, false),
    ...templateOption(2, "Landing", 268, 210, false)
  ],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 10, value: 0, out: curves.ease },
          { time: 10.5, value: 1 },
          { time: 19, value: 1, out: curves.ease },
          { time: 19.5, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 10, value: 0.9, out: curves.ease },
          { time: 10.5, value: 1 },
          { time: 19, value: 1, out: curves.ease },
          { time: 19.5, value: 0.95 }
        ]
      },
      y: {
        keyframes: [
          { time: 10, value: modalY + 30, out: curves.ease },
          { time: 10.5, value: modalY }
        ]
      }
    }
  },
  origin: [modalW / 2, modalH / 2]
});

// Typing animation - text appears
elements.push({
  id: "typed-text",
  type: "text",
  x: modalX + 40,
  y: modalY + 145,
  text: "Product Launch 2024",
  align: "left",
  valign: "middle",
  fontSize: 14,
  fontFamily: font,
  weight: 400,
  fill: colors.panelTitle,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 12, value: 0 },
          { time: 12.5, value: 1 },
          { time: 19, value: 1, out: curves.ease },
          { time: 19.5, value: 0 }
        ]
      }
    }
  }
});

// Modal buttons
elements.push({
  id: "cancel-btn",
  type: "group",
  x: modalX + 28,
  y: modalY + modalH - 68,
  opacity: 0,
  children: [
    {
      id: "cancel-btn-bg",
      type: "path",
      d: roundedRect(0, 0, 90, 40, 8),
      fill: colors.btnSecondaryBg,
      stroke: colors.btnSecondaryBorder,
      strokeWidth: 1
    },
    {
      id: "cancel-btn-text",
      type: "text",
      x: 45,
      y: 20,
      text: "Cancel",
      align: "center",
      valign: "middle",
      fontSize: 14,
      fontFamily: font,
      weight: 500,
      fill: colors.btnSecondaryText
    }
  ],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 10.6, value: 0, out: curves.ease },
          { time: 11, value: 1 },
          { time: 19, value: 1, out: curves.ease },
          { time: 19.5, value: 0 }
        ]
      }
    }
  }
});

elements.push({
  id: "save-btn",
  type: "group",
  x: modalX + modalW - 150,
  y: modalY + modalH - 68,
  opacity: 0,
  children: [
    {
      id: "save-btn-bg",
      type: "path",
      d: roundedRect(0, 0, 122, 40, 8),
      fill: colors.btnPrimaryBg,
      stroke: "none"
    },
    {
      id: "save-btn-text",
      type: "text",
      x: 61,
      y: 20,
      text: "Create Project",
      align: "center",
      valign: "middle",
      fontSize: 14,
      fontFamily: font,
      weight: 600,
      fill: colors.btnPrimaryText
    }
  ],
  origin: [61, 20],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 10.6, value: 0, out: curves.ease },
          { time: 11, value: 1 },
          { time: 19, value: 1, out: curves.ease },
          { time: 19.5, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 17.5, value: 1, out: curves.snap },
          { time: 17.65, value: 0.95 },
          { time: 17.8, value: 1 }
        ]
      }
    }
  }
});

// === SCENE 4: Success state (19-24s) ===
elements.push({
  id: "success-panel",
  type: "group",
  x: (width - 400) / 2,
  y: 240,
  opacity: 0,
  children: [
    {
      id: "success-bg",
      type: "path",
      d: roundedRect(0, 0, 400, 200, 12),
      fill: colors.panelBg,
      stroke: colors.panelBorder,
      strokeWidth: 1
    },
    // Checkmark circle
    {
      id: "success-circle",
      type: "path",
      d: "M 200 50 m -30 0 a 30 30 0 1 1 60 0 a 30 30 0 1 1 -60 0",
      fill: colors.successBg,
      stroke: "none"
    },
    {
      id: "success-check",
      type: "path",
      d: "M 186 50 L 196 60 L 214 42",
      fill: "none",
      stroke: colors.success,
      strokeWidth: 3,
      strokeCap: "round",
      strokeJoin: "round"
    },
    {
      id: "success-title",
      type: "text",
      x: 200,
      y: 105,
      text: "Project created!",
      align: "center",
      valign: "top",
      fontSize: 20,
      fontFamily: font,
      weight: 600,
      fill: colors.panelTitle
    },
    {
      id: "success-desc",
      type: "text",
      x: 200,
      y: 135,
      text: "Your new project is ready. Start designing\nyour first screen now.",
      align: "center",
      valign: "top",
      fontSize: 14,
      fontFamily: font,
      weight: 400,
      lineHeight: 1.5,
      fill: colors.panelBody,
      maxWidth: 340
    }
  ],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 19.5, value: 0, out: curves.ease },
          { time: 20.2, value: 1 },
          { time: 23, value: 1, out: curves.ease },
          { time: 23.6, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 19.5, value: 0.9, out: curves.ease },
          { time: 20.2, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 19.5, value: 260, out: curves.ease },
          { time: 20.2, value: 240 }
        ]
      }
    }
  },
  origin: [200, 100]
});

// --- Helpers ---

function projectRow(i, name, meta, yPos) {
  return [
    {
      id: `proj-${i}-name`,
      type: "text",
      x: 28,
      y: yPos,
      text: name,
      align: "left",
      valign: "top",
      fontSize: 15,
      fontFamily: font,
      weight: 500,
      fill: colors.panelTitle
    },
    {
      id: `proj-${i}-meta`,
      type: "text",
      x: 28,
      y: yPos + 22,
      text: meta,
      align: "left",
      valign: "top",
      fontSize: 12,
      fontFamily: font,
      weight: 400,
      fill: colors.panelMuted
    }
  ];
}

function templateOption(i, label, x, y, selected) {
  const w = 100;
  const h = 60;
  return [
    {
      id: `tpl-${i}-bg`,
      type: "path",
      d: roundedRect(x, y, w, h, 6),
      fill: selected ? colors.accent : colors.inputBg,
      stroke: selected ? colors.accent : colors.inputBorder,
      strokeWidth: selected ? 2 : 1,
      opacity: selected ? 0.1 : 1
    },
    {
      id: `tpl-${i}-border`,
      type: "path",
      d: roundedRect(x, y, w, h, 6),
      fill: "none",
      stroke: selected ? colors.accent : colors.inputBorder,
      strokeWidth: selected ? 2 : 1
    },
    {
      id: `tpl-${i}-label`,
      type: "text",
      x: x + w / 2,
      y: y + h / 2,
      text: label,
      align: "center",
      valign: "middle",
      fontSize: 13,
      fontFamily: font,
      weight: selected ? 600 : 400,
      fill: selected ? colors.accent : colors.panelBody
    }
  ];
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

// Add cursor elements last so they render on top of everything
elements.push(clickRingElement);
elements.push(cursorElement);

const doc = {
  version: 1,
  canvas: { width, height, background: bg, duration, fps },
  elements
};

const outPath = path.join(__dirname, "walkthrough.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
