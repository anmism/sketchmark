// ============================================================
// sketchmark — Scene Graph
// ============================================================

import type {
  DiagramAST,
  ASTNode,
  ASTEdge,
  ASTGroup,
  ASTStep,
  StyleProps,
  GroupChildRef,
  RootItemRef,
  ASTTableRow,
} from "../ast/types";

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
  imageUrl?: string;
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
  layout: "row" | "column" | "grid";
  columns: number;
  padding: number;
  gap: number;
  align: "start" | "center" | "end";
  justify: "start" | "center" | "end" | "space-between" | "space-around";
  // ── visual ───────────────────────────────────────────
  style: StyleProps;
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
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneAnimation {
  steps: ASTStep[];
  currentStep: number;
}

export interface SceneNote {
  id: string;
  lines: string[]; // label split by \n
  style: StyleProps;
  x: number;
  y: number;
  w: number;
  h: number;
  width?: number;
  height?: number;
}

export interface SceneChart {
  id: string;
  chartType: string;
  title?: string;
  data: { headers: string[]; rows: (string | number)[][] };
  style: StyleProps;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneGraph {
  title?: string;
  description?: string;
  layout: string;
  nodes: SceneNode[];
  edges: SceneEdge[];
  tables: SceneTable[];
  notes: SceneNote[];
  charts: SceneChart[];
  groups: SceneGroup[];
  animation: SceneAnimation;
  styles: Record<string, StyleProps>;
  config: Record<string, string | number | boolean>;
  rootOrder: RootItemRef[]; // declaration order of top-level items
  width: number;
  height: number;
}

// ── Build scene graph from AST ────────────────────────────
export function buildSceneGraph(ast: DiagramAST): SceneGraph {
  const nodes: SceneNode[] = ast.nodes.map((n) => {
    const themeStyle = n.theme ? (ast.themes[n.theme] ?? {}) : {};
    return {
      id: n.id,
      shape: n.shape,
      label: n.label,
      style: { ...ast.styles[n.id], ...themeStyle, ...n.style },
      groupId: n.groupId,
      width: n.width,
      height: n.height,
      meta: n.meta,
      imageUrl: n.imageUrl,
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
      parentId: undefined, // set below
      children: g.children,
      layout: (g.layout ?? "column") as SceneGroup["layout"],
      columns: g.columns ?? 1,
      padding: g.padding ?? 26,
      gap: g.gap ?? 10,
      align: (g.align ?? "start") as SceneGroup["align"],
      justify: (g.justify ?? "start") as SceneGroup["justify"],
      style: { ...ast.styles[g.id], ...themeStyle, ...g.style },
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
      rowH: 30,
      headerH: 34,
      labelH: 22,
      style: { ...ast.styles[t.id], ...themeStyle, ...t.style },
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    };
  });

  const notes: SceneNote[] = ast.notes.map((n) => {
    const themeStyle = n.theme ? (ast.themes[n.theme] ?? {}) : {};
    return {
      id: n.id,
      lines: n.label.split("\n"),
      style: { ...ast.styles[n.id], ...themeStyle, ...n.style },
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      width: n.width,
      height: n.height,
    };
  });

  const charts: SceneChart[] = ast.charts.map((c) => {
    const themeStyle = c.theme ? (ast.themes[c.theme] ?? {}) : {};
    return {
      id: c.id,
      chartType: c.chartType,
      title: c.title,
      data: c.data,
      style: { ...ast.styles[c.id], ...themeStyle, ...c.style },
      x: 0,
      y: 0,
      w: c.width ?? 320,
      h: c.height ?? 240,
    };
  });

  // Set parentId for nested groups
  for (const g of groups) {
    for (const child of g.children) {
      if (child.kind === "group") {
        const nested = groups.find((gg) => gg.id === child.id);
        if (nested) nested.parentId = g.id;
      }
    }
  }

  const edges: SceneEdge[] = ast.edges.map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    connector: e.connector,
    label: e.label,
    dashed: e.dashed ?? false,
    bidirectional: e.bidirectional ?? false,
    style: e.style ?? {},
  }));

  return {
    title: ast.title,
    description: ast.description,
    layout: ast.layout,
    nodes,
    edges,
    groups,
    tables,
    notes,
    charts,
    animation: { steps: ast.steps, currentStep: -1 },
    styles: ast.styles,
    config: ast.config,
    rootOrder: ast.rootOrder ?? [],
    width: 0,
    height: 0,
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

export function noteMap(sg: SceneGraph): Map<string, SceneNote> {
  return new Map(sg.notes.map((n) => [n.id, n]));
}

export function chartMap(sg: SceneGraph): Map<string, SceneChart> {
  return new Map(sg.charts.map((c) => [c.id, c]));
}
