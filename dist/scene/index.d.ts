import type { DiagramAST, ASTNode, ASTStep, StyleProps, GroupChildRef, RootItemRef, ASTTableRow } from "../ast/types";
import type { MarkdownLine } from '../markdown/parser';
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
    groupId?: string;
    width?: number;
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
    parentId?: string;
    children: GroupChildRef[];
    layout: "row" | "column" | "grid";
    columns: number;
    padding: number;
    gap: number;
    align: "start" | "center" | "end";
    justify: "start" | "center" | "end" | "space-between" | "space-around";
    style: StyleProps;
    x: number;
    y: number;
    w: number;
    h: number;
    width?: number;
    height?: number;
}
export interface SceneTable {
    id: string;
    label: string;
    rows: ASTTableRow[];
    colWidths: number[];
    rowH: number;
    headerH: number;
    labelH: number;
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
    lines: string[];
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
    data: {
        headers: string[];
        rows: (string | number)[][];
    };
    style: StyleProps;
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface SceneMarkdown {
    id: string;
    content: string;
    lines: MarkdownLine[];
    style: StyleProps;
    width?: number;
    height?: number;
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
    markdowns: SceneMarkdown[];
    groups: SceneGroup[];
    animation: SceneAnimation;
    styles: Record<string, StyleProps>;
    config: Record<string, string | number | boolean>;
    rootOrder: RootItemRef[];
    width: number;
    height: number;
}
export declare function buildSceneGraph(ast: DiagramAST): SceneGraph;
export declare function nodeMap(sg: SceneGraph): Map<string, SceneNode>;
export declare function groupMap(sg: SceneGraph): Map<string, SceneGroup>;
export declare function tableMap(sg: SceneGraph): Map<string, SceneTable>;
export declare function noteMap(sg: SceneGraph): Map<string, SceneNote>;
export declare function chartMap(sg: SceneGraph): Map<string, SceneChart>;
export declare function markdownMap(sg: SceneGraph): Map<string, SceneMarkdown>;
//# sourceMappingURL=index.d.ts.map