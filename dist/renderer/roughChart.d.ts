export declare const CHART_COLORS: string[];
export interface ChartLayout {
    px: number;
    py: number;
    pw: number;
    ph: number;
    titleH: number;
    cx: number;
    cy: number;
}
export declare function chartLayout(c: {
    x: number;
    y: number;
    w: number;
    h: number;
    title?: string;
}): ChartLayout;
export interface BarLineSeries {
    name: string;
    values: number[];
    color: string;
}
export interface BarLineData {
    labels: string[];
    series: BarLineSeries[];
}
export declare function parseBarLine(data: {
    headers: string[];
    rows: (string | number)[][];
}): BarLineData;
export interface PieSegment {
    label: string;
    value: number;
    color: string;
}
export interface PieData {
    segments: PieSegment[];
    total: number;
}
export declare function parsePie(data: {
    rows: (string | number)[][];
}): PieData;
export interface ScatterPoint {
    label: string;
    x: number;
    y: number;
}
export declare function parseScatter(data: {
    rows: (string | number)[][];
}): ScatterPoint[];
export declare function makeValueToY(allValues: number[], py: number, ph: number): (v: number) => number;
export declare function makeValueToX(allValues: number[], px: number, pw: number): (v: number) => number;
/** Nice round tick values for a Y axis. */
export declare function yTicks(allValues: number[]): number[];
export declare function pieArcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string;
export declare function donutArcPath(cx: number, cy: number, r: number, ir: number, startAngle: number, endAngle: number): string;
//# sourceMappingURL=roughChart.d.ts.map