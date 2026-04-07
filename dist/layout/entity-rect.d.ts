import type { SceneGraph } from "../scene";
export interface EntityRect {
    x: number;
    y: number;
    w: number;
    h: number;
    authoredX?: number;
    authoredY?: number;
}
export declare function buildEntityMap(sg: SceneGraph): Map<string, EntityRect>;
//# sourceMappingURL=entity-rect.d.ts.map