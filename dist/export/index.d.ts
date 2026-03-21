export type ExportFormat = 'svg' | 'png' | 'html' | 'canvas' | 'gif' | 'mp4';
export interface ExportOptions {
    filename?: string;
    scale?: number;
    background?: string;
    quality?: number;
}
export declare function exportSVG(svg: SVGSVGElement, opts?: ExportOptions): void;
export declare function getSVGString(svg: SVGSVGElement): string;
export declare function getSVGBlob(svg: SVGSVGElement): Blob;
export declare function exportPNG(svg: SVGSVGElement, opts?: ExportOptions): Promise<void>;
export declare function svgToPNGDataURL(svg: SVGSVGElement, opts?: ExportOptions): Promise<string>;
export declare function exportCanvasPNG(canvas: HTMLCanvasElement, opts?: ExportOptions): Promise<void>;
export declare function exportHTML(svg: SVGSVGElement, dslSource: string, opts?: ExportOptions): void;
export declare function exportGIF(frames: HTMLCanvasElement[], opts?: ExportOptions & {
    fps?: number;
}): Promise<void>;
export declare function exportMP4(canvas: HTMLCanvasElement, durationMs: number, opts?: ExportOptions & {
    fps?: number;
}): Promise<Blob>;
//# sourceMappingURL=index.d.ts.map