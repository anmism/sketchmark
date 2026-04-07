import type { SketchmarkPlugin } from "sketchmark";
export interface ChemMoleculePluginOptions {
    autoAbsoluteLayout?: boolean;
    bondStroke?: string;
    bondStrokeWidth?: number;
    bondSpacing?: number;
    atomColor?: string;
    labelColor?: string;
    fontSize?: number;
    labelOffset?: number;
    atomInset?: number;
    ringLabelOffset?: number;
    aromaticRadiusRatio?: number;
}
export declare function chemMolecule(options?: ChemMoleculePluginOptions): SketchmarkPlugin;
export declare function compileChemMolecule(source: string, options?: ChemMoleculePluginOptions): string;
//# sourceMappingURL=index.d.ts.map