// ============================================================
// sketchmark — Design Tokens (single source of truth)
//
// All layout, sizing, typography, and rendering constants live
// here. Import from this file instead of scattering magic
// numbers across modules.
// ============================================================

// ── Layout ─────────────────────────────────────────────────
export const LAYOUT = {
  margin:       60,    // default canvas margin (px)
  gap:          80,    // default gap between root-level items (px)
  groupLabelH:  22,    // height reserved for group label strip (px)
  groupPad:     26,    // default group inner padding (px)
  groupGap:     10,    // default gap between items inside a group (px)
} as const;

// ── Node sizing ────────────────────────────────────────────
export const NODE = {
  minW:         90,    // minimum auto-sized node width (px)
  maxW:         300,   // maximum auto-sized node width (px)
  defaultH:     52,    // default node height (px)
  fontPxPerChar: 8.6,  // approximate px per character for label width
  basePad:      26,    // base padding added to label width (px)
} as const;

// ── Shape-specific sizing ──────────────────────────────────
export const SHAPES = {
  cylinder:      { defaultH: 66,  ellipseH: 18 },
  diamond:       { minW: 130, minH: 62, aspect: 0.46, labelPad: 30 },
  hexagon:       { minW: 126, minH: 54, aspect: 0.44, labelPad: 20, inset: 0.56 },
  triangle:      { minW: 108, minH: 64, aspect: 0.6,  labelPad: 10 },
  parallelogram: { defaultH: 50, labelPad: 28, skew: 18 },
} as const;

// ── Table sizing ───────────────────────────────────────────
export const TABLE = {
  cellPad:      20,    // total horizontal padding per cell (px)
  minColW:      50,    // minimum column width (px)
  fontPxPerChar: 7.5,  // approx px per char at 12px sans-serif
  rowH:         30,    // data row height (px)
  headerH:      34,    // header row height (px)
  labelH:       22,    // label strip height (px)
} as const;

// ── Note shape ─────────────────────────────────────────────
export const NOTE = {
  lineH:        20,    // line height for note text (px)
  padX:         16,    // horizontal padding (px)
  padY:         12,    // vertical padding (px)
  fontPxPerChar: 7.5,  // approx px per char for note text
  fold:         14,    // fold corner size (px)
  minW:         120,   // minimum note width (px)
} as const;

// ── Typography defaults ────────────────────────────────────
export const TYPOGRAPHY = {
  defaultFontSize:   14,
  defaultFontWeight: 500,
  defaultLineHeight: 1.3,   // multiplier (× fontSize = px)
  defaultPadding:    8,
  defaultAlign:      "center" as const,
  defaultVAlign:     "middle" as const,
} as const;

// ── Title ──────────────────────────────────────────────────
export const TITLE = {
  y:            26,     // baseline Y position (px)
  fontSize:     18,     // default title font size
  fontWeight:   600,    // default title font weight
} as const;

// ── Group label typography ─────────────────────────────────
export const GROUP_LABEL = {
  fontSize:     12,
  fontWeight:   500,
  padding:      14,
} as const;

// ── Edge / arrow ───────────────────────────────────────────
export const EDGE = {
  arrowSize:    12,     // arrowhead polygon size (px)
  headInset:    13,     // line shortening for arrowhead overlap (px)
  labelOffset:  14,     // perpendicular offset of label from edge line (px)
  labelFontSize: 11,    // default edge label font size
  labelFontWeight: 400, // default edge label font weight
  dashPattern:  [6, 5] as readonly number[], // stroke-dasharray for dashed edges
} as const;

// ── Markdown typography ────────────────────────────────────
export const MARKDOWN = {
  fontSize:   { h1: 40, h2: 28, h3: 20, p: 15, blank: 0 },
  fontWeight: { h1: 700, h2: 600, h3: 600, p: 400, blank: 400 },
  spacing:    { h1: 52, h2: 38, h3: 28, p: 22, blank: 10 },
  defaultPad: 0,
} as const;

// ── Rough.js rendering ─────────────────────────────────────
export const ROUGH = {
  roughness:       1.3,    // default roughness for nodes/edges
  chartRoughness:  1.2,    // slightly smoother for chart elements
  bowing:          0.7,
} as const;

// ── Chart layout ───────────────────────────────────────────
export const CHART = {
  titleH:       24,     // title strip height when label present (px)
  titleHEmpty:  8,      // title strip height when no label (px)
  padL:         44,     // left padding for plot area (px)
  padR:         12,     // right padding (px)
  padT:         6,      // top padding (px)
  padB:         28,     // bottom padding (px)
  defaultW:     320,    // default chart width (px)
  defaultH:     240,    // default chart height (px)
} as const;

// ── Animation timing ───────────────────────────────────────
export const ANIMATION = {
  // Edge drawing
  strokeDur:       360,   // edge stroke-draw duration (ms)
  arrowReveal:     120,   // arrow fade-in delay after stroke (ms)
  dashClear:       160,   // delay before clearing dash overrides (ms)

  // Shape drawing (per entity type)
  nodeStrokeDur:   420,   // node stroke-draw duration (ms)
  nodeStagger:     55,    // stagger between node paths (ms)
  groupStrokeDur:  550,   // group stroke-draw duration (ms)
  groupStagger:    40,    // stagger between group paths (ms)
  tableStrokeDur:  500,   // table stroke-draw duration (ms)
  tableStagger:    40,    // stagger between table paths (ms)

  // Text / misc
  textFade:        200,   // text opacity fade-in duration (ms)
  fillFadeOffset:  -60,   // fill-opacity start relative to stroke end (ms)
  textDelay:       80,    // extra buffer before text reveals (ms)
  chartFade:       500,   // chart/markdown opacity transition (ms)

  // Pace
  paceSlowMul:     2.0,   // slow pace duration multiplier
  paceFastMul:     0.5,   // fast pace duration multiplier
  pauseHoldMs:     1500,  // extra hold time for pause pace (ms)

  // Narration
  narrationFadeMs: 300,   // caption fade-in/out duration (ms)
  narrationTypeMs: 30,    // per-character typing speed for narration (ms)

  // Text writing reveal
  textRevealMs:    400,   // text clip-reveal duration (ms)

  // Annotations
  annotationStrokeDur: 300,    // annotation draw-in duration (ms)
  annotationColor:     '#c85428', // default annotation color
  annotationStrokeW:   2.5,    // annotation stroke width

  // Pointer
  pointerMoveMs:   350,   // pointer travel duration (ms)
  pointerPreStepMs: 120,  // pause after pointer arrives before step fires (ms)
  pointerSize:     8,     // default pointer dot radius
} as const;

// ── Export defaults ────────────────────────────────────────
export const EXPORT = {
  pngScale:     2,           // default PNG pixel density multiplier
  fallbackW:    400,         // fallback SVG width when not set (px)
  fallbackH:    300,         // fallback SVG height when not set (px)
  fallbackBg:   "#f8f4ea",  // default PNG/HTML background color
  revokeDelay:  5000,        // blob URL revocation delay (ms)
  defaultFps:   30,          // default video FPS
} as const;

// ── SVG namespace ──────────────────────────────────────────
export const SVG_NS = "http://www.w3.org/2000/svg";
