export type NodeShape = 'box' | 'circle' | 'diamond' | 'hexagon' | 'triangle' | 'cylinder' | 'parallelogram' | 'text' | 'image' | 'icon' | 'note' | 'line' | 'path';
export type EdgeConnector = '->' | '<-' | '<->' | '-->' | '<-->' | '---' | '--';
export type EdgeAnchor = 'top' | 'right' | 'bottom' | 'left' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type LayoutType = 'row' | 'column' | 'grid' | 'absolute';
export type AlignItems = 'start' | 'center' | 'end';
export type JustifyContent = 'start' | 'center' | 'end' | 'space-between' | 'space-around';
export type AnimationAction = 'highlight' | 'fade' | 'unfade' | 'draw' | 'erase' | 'show' | 'hide' | 'pulse' | 'move' | 'color' | 'scale' | 'rotate' | 'narrate' | 'circle' | 'underline' | 'crossout' | 'bracket' | 'tick' | 'strikeoff';
export type AnimationTrigger = 'on-click';
export type StepPace = 'slow' | 'fast' | 'pause';
export interface StyleProps {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    color?: string;
    opacity?: number;
    fontSize?: number;
    fontWeight?: number | string;
    font?: string;
    strokeDash?: number[];
    padding?: number;
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    lineHeight?: number;
    letterSpacing?: number;
}
export type GroupChildRef = {
    kind: 'node';
    id: string;
} | {
    kind: 'group';
    id: string;
} | {
    kind: 'table';
    id: string;
} | {
    kind: 'chart';
    id: string;
} | {
    kind: 'markdown';
    id: string;
};
export type RootItemRef = {
    kind: 'node';
    id: string;
} | {
    kind: 'group';
    id: string;
} | {
    kind: 'table';
    id: string;
} | {
    kind: 'chart';
    id: string;
} | {
    kind: 'markdown';
    id: string;
};
export interface ASTNode {
    kind: 'node';
    id: string;
    shape: NodeShape;
    label: string;
    groupId?: string;
    imageUrl?: string;
    iconName?: string;
    pathData?: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    deg?: number;
    dx?: number;
    dy?: number;
    factor?: number;
    theme?: string;
    style?: StyleProps;
    meta?: Record<string, string>;
}
export interface ASTEdge {
    kind: 'edge';
    id: string;
    from: string;
    to: string;
    connector: EdgeConnector;
    label?: string;
    fromAnchor?: EdgeAnchor;
    toAnchor?: EdgeAnchor;
    dashed?: boolean;
    bidirectional?: boolean;
    theme?: string;
    style?: StyleProps;
}
export interface ASTGroup {
    kind: 'group';
    id: string;
    label: string;
    children: GroupChildRef[];
    layout?: LayoutType;
    columns?: number;
    padding?: number;
    gap?: number;
    align?: AlignItems;
    justify?: JustifyContent;
    theme?: string;
    style?: StyleProps;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}
export interface ASTStep {
    kind: 'step';
    action: AnimationAction;
    target: string;
    trigger?: AnimationTrigger;
    delay?: number;
    duration?: number;
    value?: string;
    dx?: number;
    dy?: number;
    factor?: number;
    deg?: number;
    pace?: StepPace;
    target2?: string;
}
export interface ASTBeat {
    kind: 'beat';
    children: ASTStep[];
}
export type ASTStepItem = ASTStep | ASTBeat;
export interface ASTChartData {
    headers: string[];
    rows: (string | number)[][];
}
export interface ASTChart {
    kind: 'chart';
    id: string;
    chartType: 'bar' | 'line' | 'pie' | 'donut' | 'scatter' | 'area';
    label?: string;
    data: ASTChartData;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    theme?: string;
    style?: StyleProps;
}
export interface ASTTableRow {
    kind: 'header' | 'data';
    cells: string[];
}
export interface ASTTable {
    kind: 'table';
    id: string;
    label: string;
    rows: ASTTableRow[];
    x?: number;
    y?: number;
    theme?: string;
    style?: StyleProps;
}
export interface ASTMarkdown {
    kind: 'markdown';
    id: string;
    content: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    theme?: string;
    style?: StyleProps;
}
export interface DiagramAST {
    kind: 'diagram';
    title?: string;
    description?: string;
    layout: LayoutType;
    nodes: ASTNode[];
    edges: ASTEdge[];
    groups: ASTGroup[];
    tables: ASTTable[];
    steps: ASTStepItem[];
    charts: ASTChart[];
    markdowns: ASTMarkdown[];
    styles: Record<string, StyleProps>;
    themes: Record<string, StyleProps>;
    config: Record<string, string | number | boolean>;
    rootOrder: RootItemRef[];
}
//# sourceMappingURL=types.d.ts.map