import type { SceneGraph, SceneNode } from "../scene";
import type { EdgeAnchor } from "../ast/types";
export declare function connPoint(n: SceneNode, other: SceneNode): [number, number];
export declare function anchoredConnPoint(entity: {
    x: number;
    y: number;
    w: number;
    h: number;
    shape?: string;
}, anchor?: EdgeAnchor | string, otherCX?: number, otherCY?: number): [number, number];
export declare function layout(sg: SceneGraph): SceneGraph;
//# sourceMappingURL=index.d.ts.map