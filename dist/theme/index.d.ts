export interface DiagramPalette {
    nodeFill: string;
    nodeStroke: string;
    nodeText: string;
    edgeStroke: string;
    edgeLabelBg: string;
    edgeLabelText: string;
    groupFill: string;
    groupStroke: string;
    groupDash: number[];
    groupLabel: string;
    tableFill: string;
    tableStroke: string;
    tableText: string;
    tableHeaderFill: string;
    tableHeaderText: string;
    tableDivider: string;
    noteFill: string;
    noteStroke: string;
    noteText: string;
    noteFold: string;
    chartFill: string;
    chartStroke: string;
    chartAxisStroke: string;
    chartText: string;
    chartTitleText: string;
    background: string;
    titleText: string;
}
export declare const PALETTES: Record<string, DiagramPalette>;
export declare function resolvePalette(name?: string): DiagramPalette;
export declare const THEME_CONFIG_KEY = "theme";
export declare function listThemes(): string[];
export declare const THEME_NAMES: string[];
//# sourceMappingURL=index.d.ts.map