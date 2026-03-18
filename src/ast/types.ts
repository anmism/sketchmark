// ============================================================
// sketchmark — AST Type Definitions
// ============================================================

export type NodeShape =
  | 'box' | 'circle' | 'diamond' | 'hexagon' | 'triangle'
  | 'cylinder' | 'parallelogram' | 'text' | 'image';

export type EdgeConnector =
  | '->' | '<-' | '<->' | '-->' | '<-->' | '---' | '--';

// export type LayoutDirection  = 'LR' | 'TB' | 'RL' | 'BT';
export type LayoutType       = 'row' | 'column' | 'grid';
export type AlignItems       = 'start' | 'center' | 'end';
export type JustifyContent   = 'start' | 'center' | 'end' | 'space-between' | 'space-around';
export type AnimationAction  = 'highlight' | 'fade' | 'unfade' | 'draw' | 'erase' | 'show' | 'hide' | 'pulse' | 'move' | 'color' | 'scale' | 'rotate';
export type AnimationTrigger = 'on-click'

export interface StyleProps {
  fill?: string; stroke?: string; strokeWidth?: number;
  color?: string; opacity?: number; radius?: number;
  shadow?: boolean; fontSize?: number; fontWeight?: number | string;
  labelColor?: string; [key: string]: unknown;
  strokeDash?: number[]; 
}

// A child inside a group — either a node or a nested group
export type GroupChildRef =
  | { kind: 'node';  id: string }
  | { kind: 'group'; id: string }
  | { kind: 'table'; id: string }
  | { kind: 'note'; id: string }
  | { kind: 'chart'; id: string }

// A root-level item (not inside any group)
export type RootItemRef =
  | { kind: 'node';  id: string }
  | { kind: 'group'; id: string }
  | { kind: 'table'; id: string }
  | { kind: 'note'; id: string }
  | { kind: 'chart'; id: string }

export interface ASTNode {
  kind: 'node'; id: string; shape: NodeShape; label: string;
  groupId?: string; imageUrl?: string;
  width?: number; height?: number;
  theme?: string;
  style?: StyleProps; meta?: Record<string, string>;
}

export interface ASTEdge {
  kind: 'edge'; id: string; from: string; to: string;
  connector: EdgeConnector; label?: string;
  dashed?: boolean; bidirectional?: boolean;
  theme?: string;
  style?: StyleProps;
}

export interface ASTGroup {
  kind:      'group';
  id:        string;
  label:     string;
  children:  GroupChildRef[];
  layout?:   LayoutType;
  columns?:  number;
  padding?:  number;
  gap?:      number;
  align?:    AlignItems;
  justify?:  JustifyContent;
  theme?:    string;
  style?:    StyleProps;
  width?:    number;
  height?:   number;
}

export interface ASTStep {
  kind: 'step'; action: AnimationAction; target: string;
  trigger?: AnimationTrigger; delay?: number; duration?: number; value?: string;
  dx?: number; dy?: number;
  factor?: number;  
  deg?: number;  
}

export interface ASTChartData { headers: string[]; rows: (string | number)[][]; }

export interface ASTChart {
  kind: 'chart'; id: string;
  chartType: 'bar' | 'line' | 'pie' | 'donut' | 'scatter' | 'area';
  title?: string; data: ASTChartData; width?: number; height?: number;
  theme?: string;
  style?: StyleProps;
}

export interface ASTTableRow {
  kind:  'header' | 'data';
  cells: string[];
}

export interface ASTTable {
  kind:   'table';
  id:     string;
  label:  string;
  rows:   ASTTableRow[];
  theme?: string;
  style?: StyleProps;
}

export interface ASTNote {
  kind:   'note';
  id:     string;
  label:  string;       
  theme?: string;
  style?: StyleProps;
}


export interface DiagramAST {
  kind: 'diagram'; title?: string; description?: string;
  layout: LayoutType;
  nodes:  ASTNode[];
  edges:  ASTEdge[];
  groups: ASTGroup[];
  tables: ASTTable[];
  notes: ASTNote[];
  steps:  ASTStep[];
  charts: ASTChart[];
  styles:    Record<string, StyleProps>;
  themes:    Record<string, StyleProps>;
  config:    Record<string, string | number | boolean>;
  rootOrder: RootItemRef[];   // ← declaration order of top-level items
}