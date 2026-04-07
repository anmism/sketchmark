import type { SketchmarkPlugin } from "sketchmark";
export interface CircuitPluginOptions {
    autoAbsoluteLayout?: boolean;
    stroke?: string;
    strokeWidth?: number;
    labelColor?: string;
    labelOffset?: number;
    valueOffset?: number;
    portRadius?: number;
    junctionRadius?: number;
    wireMode?: "auto" | "straight" | "hv" | "vh";
}
export declare function circuit(options?: CircuitPluginOptions): SketchmarkPlugin;
export declare function compileCircuit(source: string, options?: CircuitPluginOptions): string;
//# sourceMappingURL=index.d.ts.map