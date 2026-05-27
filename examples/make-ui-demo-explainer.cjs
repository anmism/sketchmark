const fs = require("node:fs");
const path = require("node:path");

const width = 1280;
const height = 720;
const duration = 24;
const fps = 30;
const bg = "#07111f";
const font = "Roboto, Arial, sans-serif";

const colors = {
  bg,
  shell: "#f8fafc",
  shellBorder: "#dbe4f0",
  topBar: "#ffffff",
  sidebar: "#0f172a",
  sidebarMuted: "#94a3b8",
  sidebarActive: "#eff6ff",
  sidebarActiveText: "#2563eb",
  pageTitle: "#0f172a",
  body: "#475569",
  muted: "#64748b",
  card: "#ffffff",
  cardBorder: "#dbe4f0",
  accent: "#2563eb",
  accentSoft: "#dbeafe",
  success: "#10b981",
  successSoft: "#d1fae5",
  warning: "#f59e0b",
  warningSoft: "#fef3c7",
  toggleOff: "#dbe3ee",
  toggleKnob: "#ffffff",
  divider: "#e5edf6",
  chipBg: "#102444",
  chipStroke: "#264b87",
  chipText: "#93c5fd",
  captionBg: "#09192e",
  captionBorder: "#173054",
  captionText: "#e2e8f0",
  captionMuted: "#94a3b8",
  cursor: "#0f172a",
  cursorRing: "#38bdf8",
  focus: "#22d3ee",
  ghost: "#cbd5e1"
};

const curves = {
  ease: { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  easeOut: { type: "cubicBezier", x1: 0, y1: 0, x2: 0.2, y2: 1 },
  snap: { type: "cubicBezier", x1: 0.2, y1: 1, x2: 0.2, y2: 1 }
};

const screen = { x: 0, y: 0, w: 1120, h: 580 };
const contentX = 236;

const notificationsCard = { x: 618, y: 96, w: 430, h: 198 };
const billingCard = { x: 236, y: 316, w: 400, h: 188 };
const reviewCard = { x: 658, y: 332, w: 390, h: 172 };

const weeklyToggleCenter = { x: notificationsCard.x + 352, y: notificationsCard.y + 105 };
const annualPillCenter = { x: billingCard.x + 160, y: billingCard.y + 103 };
const saveButtonCenter = { x: reviewCard.x + 94, y: reviewCard.y + 128 };

const overviewPose = {
  x: (width - screen.w * 0.92) / 2,
  y: 92,
  scale: 0.92
};
const notifPose = cameraPose(notificationsCard.x + notificationsCard.w / 2, notificationsCard.y + notificationsCard.h / 2, 1.23);
const billingPose = cameraPose(billingCard.x + billingCard.w / 2, billingCard.y + billingCard.h / 2, 1.26);
const reviewPose = cameraPose(reviewCard.x + reviewCard.w / 2, reviewCard.y + reviewCard.h / 2, 1.34);

const elements = [];

elements.push({
  id: "intro-title",
  type: "text",
  x: width / 2,
  y: 92,
  text: "Explaining a UI demo with cursor + zoom",
  align: "center",
  valign: "middle",
  fontSize: 42,
  fontFamily: font,
  weight: 700,
  fill: "#f8fafc",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0, value: 0, out: curves.ease },
          { time: 0.8, value: 1 },
          { time: 2.8, value: 1, out: curves.ease },
          { time: 3.4, value: 0 }
        ]
      },
      y: {
        keyframes: [
          { time: 0, value: 108, out: curves.easeOut },
          { time: 0.8, value: 92 }
        ]
      }
    }
  }
});

elements.push({
  id: "intro-subtitle",
  type: "text",
  x: width / 2,
  y: 138,
  text: "One clean screen. One action at a time.",
  align: "center",
  valign: "middle",
  fontSize: 18,
  fontFamily: font,
  weight: 400,
  fill: "#93a9c7",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.2, value: 0, out: curves.ease },
          { time: 1, value: 1 },
          { time: 2.8, value: 1, out: curves.ease },
          { time: 3.4, value: 0 }
        ]
      }
    }
  }
});

elements.push(captionCard(
  "caption_overview",
  2.4,
  7.4,
  "Overview",
  "Start wide, show the whole product, and establish where the user is."
));
elements.push(captionCard(
  "caption_notifications",
  7.2,
  13,
  "Interaction",
  "Zoom into the control, move the cursor with intent, and make a single change."
));
elements.push(captionCard(
  "caption_billing",
  12.8,
  18.2,
  "Plan change",
  "Use camera zoom to spotlight one setting instead of crowding the screen."
));
elements.push(captionCard(
  "caption_save",
  18,
  23.4,
  "Confirmation",
  "End on the save action and a visible success state so the flow feels complete."
));

elements.push(buildAppCamera());

const doc = {
  version: 1,
  canvas: { width, height, background: bg, duration, fps },
  elements
};

const outPath = path.join(__dirname, "ui-demo-explainer.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);

function buildAppCamera() {
  return {
    id: "app-camera",
    type: "group",
    x: overviewPose.x,
    y: overviewPose.y,
    scale: overviewPose.scale,
    origin: [0, 0],
    opacity: 0,
    children: [
      buildAppShell(),
      buildSidebar(),
      buildTopBar(),
      buildPageHeader(),
      buildProfileCard(),
      buildNotificationsCard(),
      buildBillingCard(),
      buildReviewCard(),
      buildToast(),
      buildFocusOutline("focus_notifications", notificationsCard, 7.2, 12.9),
      buildFocusOutline("focus_billing", billingCard, 12.8, 18.1),
      buildFocusOutline("focus_review", reviewCard, 18, 22.4),
      buildClickRing("click_weekly", weeklyToggleCenter, 8.9),
      buildClickRing("click_annual", annualPillCenter, 14.1),
      buildClickRing("click_save", saveButtonCenter, 19.6),
      buildCursor()
    ],
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: 1.8, value: 0, out: curves.ease },
            { time: 2.6, value: 1 }
          ]
        },
        x: {
          keyframes: [
            { time: 2.2, value: overviewPose.x, out: curves.ease },
            { time: 3, value: overviewPose.x },
            { time: 7.1, value: overviewPose.x, out: curves.easeOut },
            { time: 8, value: notifPose.x },
            { time: 12.6, value: notifPose.x, out: curves.easeOut },
            { time: 13.4, value: billingPose.x },
            { time: 17.8, value: billingPose.x, out: curves.easeOut },
            { time: 18.6, value: reviewPose.x },
            { time: 21.4, value: reviewPose.x, out: curves.easeOut },
            { time: 22.2, value: overviewPose.x }
          ]
        },
        y: {
          keyframes: [
            { time: 2.2, value: overviewPose.y, out: curves.ease },
            { time: 3, value: overviewPose.y },
            { time: 7.1, value: overviewPose.y, out: curves.easeOut },
            { time: 8, value: notifPose.y },
            { time: 12.6, value: notifPose.y, out: curves.easeOut },
            { time: 13.4, value: billingPose.y },
            { time: 17.8, value: billingPose.y, out: curves.easeOut },
            { time: 18.6, value: reviewPose.y },
            { time: 21.4, value: reviewPose.y, out: curves.easeOut },
            { time: 22.2, value: overviewPose.y }
          ]
        },
        scale: {
          keyframes: [
            { time: 2.2, value: 0.88, out: curves.ease },
            { time: 3, value: overviewPose.scale },
            { time: 7.1, value: overviewPose.scale, out: curves.easeOut },
            { time: 8, value: notifPose.scale },
            { time: 12.6, value: notifPose.scale, out: curves.easeOut },
            { time: 13.4, value: billingPose.scale },
            { time: 17.8, value: billingPose.scale, out: curves.easeOut },
            { time: 18.6, value: reviewPose.scale },
            { time: 21.4, value: reviewPose.scale, out: curves.easeOut },
            { time: 22.2, value: overviewPose.scale }
          ]
        }
      }
    }
  };
}

function buildAppShell() {
  return {
    id: "shell",
    type: "group",
    x: screen.x,
    y: screen.y,
    children: [
      {
        id: "shell-bg",
        type: "path",
        d: roundedRect(0, 0, screen.w, screen.h, 24),
        fill: colors.shell,
        stroke: colors.shellBorder,
        strokeWidth: 1.5
      },
      {
        id: "shell-top",
        type: "path",
        d: roundedRect(0, 0, screen.w, 58, 24),
        fill: colors.topBar,
        stroke: colors.shellBorder,
        strokeWidth: 1
      },
      {
        id: "shell-sidebar",
        type: "path",
        d: roundedRect(0, 0, 208, screen.h, 24),
        fill: colors.sidebar,
        stroke: "none"
      },
      {
        id: "shell-content-bg",
        type: "path",
        d: roundedRect(208, 58, screen.w - 208, screen.h - 58, 0),
        fill: "#eff4fb",
        stroke: "none"
      }
    ]
  };
}

function buildSidebar() {
  return {
    id: "sidebar",
    type: "group",
    x: 0,
    y: 0,
    children: [
      text("brand-mark", 32, 24, "sketchmark", {
        fontSize: 19,
        weight: 700,
        fill: "#f8fafc"
      }),
      text("brand-sub", 32, 46, "workspace demo", {
        fontSize: 11,
        weight: 500,
        fill: "#9fb3cf"
      }),
      navItem("nav-home", 20, 108, "Overview", false),
      navItem("nav-projects", 20, 154, "Projects", false),
      navItem("nav-settings", 20, 200, "Team Settings", true),
      navItem("nav-billing", 20, 246, "Billing", false),
      navItem("nav-audit", 20, 292, "Audit Log", false),
      {
        id: "sidebar-footer-chip",
        type: "group",
        x: 28,
        y: screen.h - 92,
        children: [
          {
            id: "sidebar-chip-bg",
            type: "path",
            d: roundedRect(0, 0, 152, 40, 12),
            fill: "#112544",
            stroke: "#20406f",
            strokeWidth: 1
          },
          text("sidebar-chip-text", 16, 12, "4 teammates online", {
            fontSize: 12,
            weight: 500,
            fill: "#bfdbfe"
          })
        ]
      }
    ]
  };
}

function buildTopBar() {
  return {
    id: "topbar",
    type: "group",
    x: 232,
    y: 12,
    children: [
      {
        id: "search-bg",
        type: "path",
        d: roundedRect(0, 0, 300, 34, 10),
        fill: "#f8fafc",
        stroke: "#d7e2f0",
        strokeWidth: 1
      },
      text("search-text", 16, 10, "Search settings, billing, teammates", {
        fontSize: 12,
        weight: 400,
        fill: "#94a3b8"
      }),
      pillGroup("top-chip", 724, 2, 128, 30, "Preview mode", colors.chipBg, colors.chipStroke, colors.chipText),
      avatarGroup("top-avatar", 974, 0, 34, "#c7d2fe", "JD")
    ]
  };
}

function buildPageHeader() {
  return {
    id: "page-header",
    type: "group",
    x: contentX,
    y: 92,
    children: [
      text("page-eyebrow", 0, 0, "Team workspace", {
        fontSize: 12,
        weight: 600,
        fill: "#2563eb"
      }),
      text("page-title", 0, 22, "Settings that stay easy to explain", {
        fontSize: 30,
        weight: 700,
        fill: colors.pageTitle
      }),
      text("page-body", 0, 64, "A demo flow works best when the camera and cursor both guide attention.", {
        fontSize: 15,
        weight: 400,
        fill: colors.body
      })
    ]
  };
}

function buildProfileCard() {
  return cardGroup("profile-card", 236, 96, 358, 198, [
    text("profile-title", 24, 20, "Workspace profile", {
      fontSize: 17,
      weight: 600,
      fill: colors.pageTitle
    }),
    text("profile-body", 24, 44, "Show identity details before you zoom into smaller controls.", {
      fontSize: 13,
      weight: 400,
      fill: colors.body
    }),
    avatarGroup("profile-avatar", 24, 88, 48, "#bfdbfe", "NS"),
    text("profile-name", 86, 90, "Northstar Studio", {
      fontSize: 18,
      weight: 600,
      fill: colors.pageTitle
    }),
    text("profile-meta", 86, 116, "8 members  •  EU region", {
      fontSize: 12,
      weight: 500,
      fill: colors.muted
    }),
    fieldLine("profile-field-1", 24, 152, 150, "Workspace name"),
    fieldLine("profile-field-2", 186, 152, 148, "Support email")
  ]);
}

function buildNotificationsCard() {
  return cardGroup("notifications-card", notificationsCard.x, notificationsCard.y, notificationsCard.w, notificationsCard.h, [
    text("notif-title", 24, 20, "Notifications", {
      fontSize: 17,
      weight: 600,
      fill: colors.pageTitle
    }),
    text("notif-body", 24, 44, "Zooming here turns a tiny toggle into a clear, narrated moment.", {
      fontSize: 13,
      weight: 400,
      fill: colors.body
    }),
    toggleRow("notif-weekly", 24, 82, "Weekly summary", "Send one digest every Monday morning.", false, true),
    divider("notif-divider-1", 24, 128, notificationsCard.w - 48),
    toggleRow("notif-incidents", 24, 140, "Critical incidents", "Always enabled for admins and owners.", true, false)
  ]);
}

function buildBillingCard() {
  return cardGroup("billing-card", billingCard.x, billingCard.y, billingCard.w, billingCard.h, [
    text("billing-title", 24, 20, "Billing", {
      fontSize: 17,
      weight: 600,
      fill: colors.pageTitle
    }),
    text("billing-body", 24, 44, "Use a small motion change to make plan selection feel deliberate.", {
      fontSize: 13,
      weight: 400,
      fill: colors.body
    }),
    {
      id: "billing-segment-bg",
      type: "path",
      d: roundedRect(24, 82, 186, 42, 14),
      fill: "#edf3fb",
      stroke: "#d8e4f2",
      strokeWidth: 1
    },
    {
      id: "billing-segment-highlight",
      type: "path",
      d: roundedRect(30, 88, 82, 30, 12),
      x: 0,
      y: 0,
      fill: colors.accentSoft,
      stroke: "#93c5fd",
      strokeWidth: 1,
      timeline: {
        tracks: {
          x: {
            keyframes: [
              { time: 0, value: 0 },
              { time: 14.05, value: 0, out: curves.snap },
              { time: 14.25, value: 89 }
            ]
          }
        }
      }
    },
    text("billing-monthly-label", 71, 103, "Monthly", {
      align: "center",
      valign: "middle",
      fontSize: 13,
      weight: 600,
      fill: colors.accent,
      timeline: {
        tracks: {
          fill: {
            keyframes: [
              { time: 0, value: colors.accent },
              { time: 14.2, value: colors.muted }
            ]
          }
        }
      }
    }),
    text("billing-annual-label", 160, 103, "Annual", {
      align: "center",
      valign: "middle",
      fontSize: 13,
      weight: 600,
      fill: colors.muted,
      timeline: {
        tracks: {
          fill: {
            keyframes: [
              { time: 0, value: colors.muted },
              { time: 14.2, value: colors.accent }
            ]
          }
        }
      }
    }),
    text("billing-price", 24, 140, "$49 / seat / month", {
      fontSize: 28,
      weight: 700,
      fill: colors.pageTitle,
      timeline: {
        tracks: {
          text: {
            keyframes: [
              { time: 0, value: "$49 / seat / month" },
              { time: 14.2, value: "$39 / seat / month" }
            ]
          }
        }
      }
    }),
    text("billing-price-note", 24, 170, "Annual billing unlocks a 20% savings and a cleaner renewal cycle.", {
      fontSize: 12,
      weight: 500,
      fill: colors.success
    })
  ]);
}

function buildReviewCard() {
  return cardGroup("review-card", reviewCard.x, reviewCard.y, reviewCard.w, reviewCard.h, [
    text("review-title", 24, 20, "Review changes", {
      fontSize: 17,
      weight: 600,
      fill: colors.pageTitle
    }),
    text("review-body", 24, 44, "End the sequence on a single confident action: save and show success.", {
      fontSize: 13,
      weight: 400,
      fill: colors.body
    }),
    pillGroup("review-pill-1", 24, 78, 110, 30, "Weekly summary", "#eff6ff", "#bfdbfe", colors.accent),
    pillGroup("review-pill-2", 144, 78, 88, 30, "Annual", "#ecfdf5", "#a7f3d0", colors.success),
    {
      id: "save-button",
      type: "group",
      x: 24,
      y: 106,
      origin: [70, 22],
      children: [
        {
          id: "save-button-bg",
          type: "path",
          d: roundedRect(0, 0, 140, 44, 14),
          fill: colors.accent,
          stroke: "none"
        },
        text("save-button-label", 70, 22, "Save changes", {
          align: "center",
          valign: "middle",
          fontSize: 14,
          weight: 600,
          fill: "#ffffff",
          timeline: {
            tracks: {
              text: {
                keyframes: [
                  { time: 0, value: "Save changes" },
                  { time: 19.9, value: "Saved" }
                ]
              }
            }
          }
        })
      ],
      timeline: {
        tracks: {
          scale: {
            keyframes: [
              { time: 19.5, value: 1, out: curves.snap },
              { time: 19.7, value: 0.95 },
              { time: 19.95, value: 1 }
            ]
          }
        }
      }
    },
    {
      id: "ghost-button",
      type: "group",
      x: 176,
      y: 106,
      children: [
        {
          id: "ghost-button-bg",
          type: "path",
          d: roundedRect(0, 0, 110, 44, 14),
          fill: "#ffffff",
          stroke: "#d4e0ee",
          strokeWidth: 1
        },
        text("ghost-button-label", 55, 22, "Cancel", {
          align: "center",
          valign: "middle",
          fontSize: 14,
          weight: 500,
          fill: colors.muted
        })
      ]
    }
  ]);
}

function buildToast() {
  return {
    id: "toast",
    type: "group",
    x: 760,
    y: 20,
    opacity: 0,
    children: [
      {
        id: "toast-bg",
        type: "path",
        d: roundedRect(0, 0, 292, 62, 16),
        fill: colors.card,
        stroke: "#bfe9d8",
        strokeWidth: 1.5
      },
      {
        id: "toast-dot",
        type: "path",
        d: circlePath(24, 31, 9),
        fill: colors.successSoft,
        stroke: "none"
      },
      text("toast-title", 42, 16, "Changes saved", {
        fontSize: 14,
        weight: 700,
        fill: colors.pageTitle
      }),
      text("toast-body", 42, 34, "Notifications and billing have been updated.", {
        fontSize: 12,
        weight: 400,
        fill: colors.body
      })
    ],
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: 19.9, value: 0, out: curves.easeOut },
            { time: 20.3, value: 1 },
            { time: 23.1, value: 1, out: curves.easeOut },
            { time: 23.7, value: 0 }
          ]
        },
        y: {
          keyframes: [
            { time: 19.9, value: 8, out: curves.easeOut },
            { time: 20.3, value: 20 }
          ]
        }
      }
    }
  };
}

function buildFocusOutline(id, box, start, end) {
  return {
    id,
    type: "path",
    d: roundedRect(box.x - 8, box.y - 8, box.w + 16, box.h + 16, 24),
    fill: "none",
    stroke: colors.focus,
    strokeWidth: 2,
    dashArray: [8, 6],
    opacity: 0,
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: start - 0.2, value: 0, out: curves.ease },
            { time: start, value: 0.85 },
            { time: end, value: 0.85, out: curves.ease },
            { time: end + 0.3, value: 0 }
          ]
        }
      }
    }
  };
}

function buildClickRing(id, center, start) {
  return {
    id,
    type: "path",
    d: circlePath(center.x, center.y, 16),
    fill: "none",
    stroke: colors.cursorRing,
    strokeWidth: 2,
    opacity: 0,
    origin: [center.x, center.y],
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: start, value: 0 },
            { time: start + 0.1, value: 0.7 },
            { time: start + 0.55, value: 0 }
          ]
        },
        scale: {
          keyframes: [
            { time: start, value: 0.4, out: curves.easeOut },
            { time: start + 0.55, value: 1.5 }
          ]
        }
      }
    }
  };
}

function buildCursor() {
  return {
    id: "cursor",
    type: "group",
    x: -80,
    y: -80,
    children: [
      {
        id: "cursor-arrow",
        type: "path",
        d: "M 0 0 L 0 22 L 6 18 L 10 28 L 15 26 L 11 16 L 20 16 Z",
        fill: colors.cursor,
        stroke: "#ffffff",
        strokeWidth: 1.6
      }
    ],
    timeline: {
      tracks: {
        x: {
          keyframes: [
            { time: 0, value: -80 },
            { time: 6.7, value: -80, out: curves.easeOut },
            { time: 7.8, value: weeklyToggleCenter.x },
            { time: 9.3, value: weeklyToggleCenter.x },
            { time: 12.7, value: weeklyToggleCenter.x, out: curves.easeOut },
            { time: 13.9, value: annualPillCenter.x },
            { time: 14.5, value: annualPillCenter.x },
            { time: 17.8, value: annualPillCenter.x, out: curves.easeOut },
            { time: 19.1, value: saveButtonCenter.x },
            { time: 20.1, value: saveButtonCenter.x },
            { time: 22.2, value: saveButtonCenter.x, out: curves.easeOut },
            { time: 23.1, value: screen.w + 180 }
          ]
        },
        y: {
          keyframes: [
            { time: 0, value: -80 },
            { time: 6.7, value: -80, out: curves.easeOut },
            { time: 7.8, value: weeklyToggleCenter.y },
            { time: 9.3, value: weeklyToggleCenter.y },
            { time: 12.7, value: weeklyToggleCenter.y, out: curves.easeOut },
            { time: 13.9, value: annualPillCenter.y },
            { time: 14.5, value: annualPillCenter.y },
            { time: 17.8, value: annualPillCenter.y, out: curves.easeOut },
            { time: 19.1, value: saveButtonCenter.y },
            { time: 20.1, value: saveButtonCenter.y },
            { time: 22.2, value: saveButtonCenter.y, out: curves.easeOut },
            { time: 23.1, value: screen.h + 140 }
          ]
        }
      }
    }
  };
}

function cardGroup(id, x, y, w, h, children) {
  return {
    id,
    type: "group",
    x,
    y,
    children: [
      {
        id: `${id}-bg`,
        type: "path",
        d: roundedRect(0, 0, w, h, 20),
        fill: colors.card,
        stroke: colors.cardBorder,
        strokeWidth: 1
      },
      ...children
    ]
  };
}

function pillGroup(id, x, y, w, h, label, fill, stroke, textFill) {
  return {
    id,
    type: "group",
    x,
    y,
    children: [
      {
        id: `${id}-bg`,
        type: "path",
        d: roundedRect(0, 0, w, h, h / 2),
        fill,
        stroke,
        strokeWidth: 1
      },
      text(`${id}-text`, w / 2, h / 2, label, {
        align: "center",
        valign: "middle",
        fontSize: 12,
        weight: 600,
        fill: textFill
      })
    ]
  };
}

function avatarGroup(id, x, y, size, fill, label) {
  return {
    id,
    type: "group",
    x,
    y,
    children: [
      {
        id: `${id}-circle`,
        type: "path",
        d: circlePath(size / 2, size / 2, size / 2),
        fill,
        stroke: "none"
      },
      text(`${id}-label`, size / 2, size / 2, label, {
        align: "center",
        valign: "middle",
        fontSize: Math.max(11, Math.round(size * 0.32)),
        weight: 700,
        fill: "#1e3a8a"
      })
    ]
  };
}

function navItem(id, x, y, label, active) {
  return {
    id,
    type: "group",
    x,
    y,
    children: [
      {
        id: `${id}-bg`,
        type: "path",
        d: roundedRect(0, 0, 164, 36, 12),
        fill: active ? colors.sidebarActive : "none",
        stroke: active ? "#bfdbfe" : "none",
        strokeWidth: 1
      },
      text(`${id}-text`, 16, 10, label, {
        fontSize: 13,
        weight: active ? 700 : 500,
        fill: active ? colors.sidebarActiveText : "#dbe5f2"
      })
    ]
  };
}

function fieldLine(id, x, y, w, label) {
  return {
    id,
    type: "group",
    x,
    y,
    children: [
      text(`${id}-label`, 0, 0, label, {
        fontSize: 11,
        weight: 600,
        fill: colors.muted
      }),
      {
        id: `${id}-line`,
        type: "path",
        d: `M 0 24 L ${w} 24`,
        stroke: colors.divider,
        strokeWidth: 2,
        fill: "none"
      }
    ]
  };
}

function toggleRow(id, x, y, label, description, on, animatesOn) {
  const knobStart = on ? 334 : 308;
  const bgStart = on ? colors.accent : colors.toggleOff;
  return {
    id,
    type: "group",
    x,
    y,
    children: [
      text(`${id}-label`, 0, 0, label, {
        fontSize: 15,
        weight: 600,
        fill: colors.pageTitle
      }),
      text(`${id}-body`, 0, 22, description, {
        fontSize: 12,
        weight: 400,
        fill: colors.body
      }),
      {
        id: `${id}-toggle-bg`,
        type: "path",
        d: roundedRect(300, 8, 56, 30, 15),
        fill: bgStart,
        stroke: "none",
        timeline: animatesOn ? {
          tracks: {
            fill: {
              keyframes: [
                { time: 0, value: colors.toggleOff },
                { time: 8.95, value: colors.toggleOff, out: curves.snap },
                { time: 9.15, value: colors.accent }
              ]
            }
          }
        } : undefined
      },
      {
        id: `${id}-toggle-knob`,
        type: "path",
        d: circlePath(knobStart, 23, 11),
        fill: colors.toggleKnob,
        stroke: "none",
        timeline: animatesOn ? {
          tracks: {
            x: {
              keyframes: [
                { time: 0, value: 0 },
                { time: 8.95, value: 0, out: curves.snap },
                { time: 9.15, value: 26 }
              ]
            }
          }
        } : undefined
      }
    ]
  };
}

function divider(id, x, y, w) {
  return {
    id,
    type: "path",
    d: `M ${x} ${y} L ${x + w} ${y}`,
    stroke: colors.divider,
    strokeWidth: 1,
    fill: "none"
  };
}

function captionCard(id, start, end, label, body) {
  const boxW = 620;
  const boxH = 92;
  const chipW = 96;
  const x = (width - boxW) / 2;
  const y = 584;
  return {
    id,
    type: "group",
    x,
    y,
    opacity: 0,
    children: [
      {
        id: `${id}-bg`,
        type: "path",
        d: roundedRect(0, 0, boxW, boxH, 22),
        fill: colors.captionBg,
        stroke: colors.captionBorder,
        strokeWidth: 1.5
      },
      {
        id: `${id}-chip`,
        type: "group",
        x: 20,
        y: 18,
        children: [
          {
            id: `${id}-chip-bg`,
            type: "path",
            d: roundedRect(0, 0, chipW, 28, 14),
            fill: "#0b2648",
            stroke: "#1d4c7f",
            strokeWidth: 1
          },
          text(`${id}-chip-text`, chipW / 2, 14, label, {
            align: "center",
            valign: "middle",
            fontSize: 12,
            weight: 700,
            fill: "#7dd3fc"
          })
        ]
      },
      text(`${id}-body`, 20, 56, body, {
        fontSize: 15,
        weight: 400,
        fill: colors.captionText,
        maxWidth: boxW - 40
      })
    ],
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: start - 0.3, value: 0, out: curves.easeOut },
            { time: start, value: 1 },
            { time: end, value: 1, out: curves.easeOut },
            { time: end + 0.35, value: 0 }
          ]
        },
        y: {
          keyframes: [
            { time: start - 0.3, value: y + 20, out: curves.easeOut },
            { time: start, value: y }
          ]
        }
      }
    }
  };
}

function text(id, x, y, value, extra) {
  return {
    id,
    type: "text",
    x,
    y,
    text: value,
    align: "left",
    valign: "top",
    fontSize: 14,
    fontFamily: font,
    weight: 400,
    fill: colors.pageTitle,
    ...extra
  };
}

function cameraPose(targetX, targetY, scale) {
  return {
    x: width / 2 - targetX * scale,
    y: height / 2 - targetY * scale,
    scale
  };
}

function circlePath(cx, cy, r) {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
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
