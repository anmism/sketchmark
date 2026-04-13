import type { SceneNode } from "../../scene";
export declare function getPathIntrinsicSize(pathData?: string): {
    width: number;
    height: number;
};
export declare function getRenderablePathData(pathData: string | undefined, width: number, height: number): string | null;
export declare function getRenderableNodePathData(node: Pick<SceneNode, "pathData" | "w" | "h">): string | null;
//# sourceMappingURL=path-geometry.d.ts.map