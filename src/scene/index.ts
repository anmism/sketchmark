// ============================================================
// sketchmark — Scene Graph
// ============================================================

import type {
  DiagramAST,
  ASTNode,
  ASTStepItem,
  StyleProps,
  GroupChildRef,
  RootItemRef,
  ASTTableRow,
} from "../ast/types";
import type { MarkdownLine } from '../markdown/parser';
import { parseMarkdownContent } from '../markdown/parser';
import { LAYOUT, TABLE, CHART } from '../config';

export type { GroupChildRef, RootItemRef };

export interface SceneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneNode extends SceneRect {
  id: string;
  shape: ASTNode["shape"];
  label: string;
  style: StyleProps;
  groupId?: string; // immediate parent group id
  width?: number; // user-specified size override
  height?: number;
  authoredX?: number;
  authoredY?: number;
  deg?: number;    // static rotation (degrees)
  dx?: number;     // static x translation
  dy?: number;     // static y translation
  factor?: number; // static scale factor
  imageUrl?: string;
  iconName?: string;
  pathData?: string;
  meta?: Record<string, string>;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneEdge {
  id: string;
  from: string;
  to: string;
  connector: string;
  label?: string;
  fromAnchor?: string;
  toAnchor?: string;
  dashed: boolean;
  bidirectional: boolean;
  style: StyleProps;
  points?: [number, number][];
}

export interface SceneGroup {
  id: string;
  label: string;
  parentId?: string; // parent group id (set for nested groups)
  children: GroupChildRef[]; // mixed node/group children — supports nesting
  // ── layout props ──────────────────────────────────────
  layout: "row" | "column" | "grid" | "absolute";
  columns: number;
  padding: number;
  gap: number;
  align: "start" | "center" | "end";
  justify: "start" | "center" | "end" | "space-between" | "space-around";
  // ── visual ───────────────────────────────────────────
  style: StyleProps;
  authoredX?: number;
  authoredY?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  width?:  number;
  height?: number;
}

export interface SceneTable {
  id: string;
  label: string;
  rows: ASTTableRow[];
  colWidths: number[]; // computed per column
  rowH: number; // data row height
  headerH: number; // header row height
  labelH: number; // label strip height
  style: StyleProps;
  authoredX?: number;
  authoredY?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneAnimation {
  steps: ASTStepItem[];
  currentStep: number;
}

export interface SceneChart {
  id: string;
  chartType: string;
  label?: string;
  data: { headers: string[]; rows: (string | number)[][] };
  style: StyleProps;
  authoredX?: number;
  authoredY?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneMarkdown {
  id:      string;
  content: string;
  lines:   MarkdownLine[];    // pre-parsed at build time
  style:   StyleProps;
  width?:  number;
  height?: number;
  authoredX?: number;
  authoredY?: number;
  x: number; y: number; w: number; h: number;
}

export interface SceneGraph {
  title?: string;
  description?: string;
  layout: string;
  style: StyleProps;
  nodes: SceneNode[];
  edges: SceneEdge[];
  tables: SceneTable[];
  charts: SceneChart[];
  markdowns: SceneMarkdown[];
  groups: SceneGroup[];
  animation: SceneAnimation;
  styles: Record<string, StyleProps>;
  config: Record<string, string | number | boolean>;
  rootOrder: RootItemRef[]; // declaration order of top-level items
  width: number;
  height: number;
  fixedWidth?: number;
  fixedHeight?: number;
}

// ── Build scene graph from AST ────────────────────────────
export function buildSceneGraph(ast: DiagramAST): SceneGraph {
  const nodeParentById = new Map<string, string>();
  const groupParentById = new Map<string, string>();

  for (const g of ast.groups) {
    for (const child of g.children) {
      if (child.kind === "node") nodeParentById.set(child.id, g.id);
      if (child.kind === "group") groupParentById.set(child.id, g.id);
    }
  }

  const nodes: SceneNode[] = ast.nodes.map((n) => {
    const themeStyle = n.theme ? (ast.themes[n.theme] ?? {}) : {};
    return {
      id: n.id,
      shape: n.shape,
      label: n.label,
      style: { ...ast.styles[n.id], ...themeStyle, ...n.style },
      groupId: nodeParentById.get(n.id),
      width: n.width,
      height: n.height,
      authoredX: n.x,
      authoredY: n.y,
      deg: n.deg,
      dx: n.dx,
      dy: n.dy,
      factor: n.factor,
      meta: n.meta,
      imageUrl: n.imageUrl,
      iconName: n.iconName,
      pathData: n.pathData,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    };
  });

  const groups: SceneGroup[] = ast.groups.map((g) => {
    const themeStyle = g.theme ? (ast.themes[g.theme] ?? {}) : {};
    return {
      id: g.id,
      label: g.label,
      parentId: groupParentById.get(g.id),
      children: g.children,
      layout: (g.layout ?? "column") as SceneGroup["layout"],
      columns: g.columns ?? 1,
      padding: g.padding ?? LAYOUT.groupPad,
      gap: g.gap ?? LAYOUT.groupGap,
      align: (g.align ?? "start") as SceneGroup["align"],
      justify: (g.justify ?? "start") as SceneGroup["justify"],
      style: { ...ast.styles[g.id], ...themeStyle, ...g.style },
      authoredX: g.x,
      authoredY: g.y,
      width: g.width,
      height: g.height,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    };
  });

  const tables: SceneTable[] = ast.tables.map((t) => {
    const themeStyle = t.theme ? (ast.themes[t.theme] ?? {}) : {};
    return {
      id: t.id,
      label: t.label,
      rows: t.rows,
      colWidths: [],
      rowH: TABLE.rowH,
      headerH: TABLE.headerH,
      labelH: TABLE.labelH,
      style: { ...ast.styles[t.id], ...themeStyle, ...t.style },
      authoredX: t.x,
      authoredY: t.y,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    };
  });

  const charts: SceneChart[] = ast.charts.map((c) => {
    const themeStyle = c.theme ? (ast.themes[c.theme] ?? {}) : {};
    return {
      id: c.id,
      chartType: c.chartType,
      label: c.label,
      data: c.data,
      style: { ...ast.styles[c.id], ...themeStyle, ...c.style },
      authoredX: c.x,
      authoredY: c.y,
      x: 0,
      y: 0,
      w: c.width ?? CHART.defaultW,
      h: c.height ?? CHART.defaultH,
    };
  });

  const markdowns: SceneMarkdown[] = (ast.markdowns ?? []).map((m) => {
    const themeStyle = m.theme ? (ast.themes[m.theme] ?? {}) : {};
    return {
      id: m.id,
      content: m.content,
      lines: parseMarkdownContent(m.content),
      style: { ...ast.styles[m.id], ...themeStyle, ...m.style },
      width: m.width,
      height: m.height,
      authoredX: m.x,
      authoredY: m.y,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    };
  });

  const edges: SceneEdge[] = ast.edges.map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    connector: e.connector,
    label: e.label,
    fromAnchor: e.fromAnchor,
    toAnchor: e.toAnchor,
    dashed: e.dashed ?? false,
    bidirectional: e.bidirectional ?? false,
    style: e.style ?? {},
  }));

  return {
    title: ast.title,
    description: ast.description,
    layout: ast.layout,
    style: ast.style ?? {},
    nodes,
    edges,
    groups,
    tables,
    charts,
    markdowns,
    animation: { steps: ast.steps, currentStep: -1 },
    styles: ast.styles,
    config: ast.config,
    rootOrder: ast.rootOrder ?? [],
    width: 0,
    height: 0,
    fixedWidth: ast.width,
    fixedHeight: ast.height,
  };
}

// ── Helpers ───────────────────────────────────────────────
export function nodeMap(sg: SceneGraph): Map<string, SceneNode> {
  return new Map(sg.nodes.map((n) => [n.id, n]));
}

export function groupMap(sg: SceneGraph): Map<string, SceneGroup> {
  return new Map(sg.groups.map((g) => [g.id, g]));
}

export function tableMap(sg: SceneGraph): Map<string, SceneTable> {
  return new Map(sg.tables.map((t) => [t.id, t]));
}

export function chartMap(sg: SceneGraph): Map<string, SceneChart> {
  return new Map(sg.charts.map((c) => [c.id, c]));
}

export function markdownMap(sg: SceneGraph): Map<string, SceneMarkdown> {
  return new Map((sg.markdowns ?? []).map(m => [m.id, m]));
}
