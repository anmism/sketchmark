export type LineKind = 'h1' | 'h2' | 'h3' | 'p' | 'blank';
export interface MarkdownRun {
    text: string;
    bold?: boolean;
    italic?: boolean;
}
export interface MarkdownLine {
    kind: LineKind;
    runs: MarkdownRun[];
}
export declare const LINE_FONT_SIZE: Record<LineKind, number>;
export declare const LINE_FONT_WEIGHT: Record<LineKind, number>;
export declare const LINE_SPACING: Record<LineKind, number>;
export declare function parseMarkdownContent(content: string): MarkdownLine[];
export declare function calcMarkdownHeight(lines: MarkdownLine[], pad?: number): number;
//# sourceMappingURL=parser.d.ts.map