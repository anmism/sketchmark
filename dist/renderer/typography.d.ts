export interface TypographyConfig {
    fontSize: number;
    fontWeight: number | string;
    textColor: string;
    font: string;
    textAlign: "left" | "center" | "right";
    textAnchor: "start" | "middle" | "end";
    letterSpacing: number | undefined;
    lineHeight: number;
    verticalAlign: "top" | "middle" | "bottom";
    padding: number;
}
export interface TypographyDefaults {
    fontSize?: number;
    fontWeight?: number | string;
    textColor?: string;
    textAlign?: "left" | "center" | "right";
    lineHeight?: number;
    padding?: number;
    verticalAlign?: "top" | "middle" | "bottom";
}
export declare function resolveTypography(style: Record<string, unknown> | undefined, defaults: TypographyDefaults, diagramFont: string, fallbackTextColor: string): TypographyConfig;
/** Compute the x coordinate for text based on alignment within a box. */
export declare function computeTextX(typo: TypographyConfig, x: number, w: number): number;
/** Compute the vertical center for a block of text lines within a box. */
export declare function computeTextCY(typo: TypographyConfig, y: number, h: number, lineCount: number, topOffset?: number): number;
//# sourceMappingURL=typography.d.ts.map