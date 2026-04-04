import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
export { prepareWithSegments, layoutWithLines };
/** Build a CSS font shorthand from fontSize, fontWeight and fontFamily */
export declare function buildFontStr(fontSize: number, fontWeight: number | string, fontFamily: string): string;
/** Measure the natural (unwrapped) width of text using pretext */
export declare function measureTextWidth(text: string, font: string): number;
/** Word-wrap text using pretext, with fallback to character approximation */
export declare function wrapText(text: string, maxWidth: number, fontSize: number, font?: string): string[];
export interface ShapeLine {
    text: string;
    width: number;
}
/**
 * Wrap text to conform to the interior of a shape.
 * Returns lines with their text + measured width, plus a startY
 * offset (from shape top) where the first line's center sits.
 */
export declare function wrapTextInShape(text: string, font: string, fontSize: number, lineHeight: number, shape: string, shapeW: number, shapeH: number, padding: number): {
    lines: ShapeLine[];
    startY: number;
};
//# sourceMappingURL=text-measure.d.ts.map