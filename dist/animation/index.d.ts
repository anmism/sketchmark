import type { ASTStep } from "../ast/types";
export type AnimationEventType = "step-change" | "step-complete" | "animation-reset" | "animation-start" | "animation-end";
export interface AnimationEvent {
    type: AnimationEventType;
    stepIndex: number;
    step?: ASTStep;
    total: number;
}
export type AnimationListener = (e: AnimationEvent) => void;
export declare function getDrawTargetEdgeIds(steps: ASTStep[]): Set<string>;
export declare function getDrawTargetNodeIds(steps: ASTStep[]): Set<string>;
export declare function getDrawTargetTableIds(steps: ASTStep[]): Set<string>;
export declare function getDrawTargetNoteIds(steps: ASTStep[]): Set<string>;
export declare function getDrawTargetChartIds(steps: ASTStep[]): Set<string>;
export declare class AnimationController {
    private svg;
    readonly steps: ASTStep[];
    private _step;
    private _transforms;
    private _listeners;
    readonly drawTargetEdges: Set<string>;
    readonly drawTargetNodes: Set<string>;
    readonly drawTargetGroups: Set<string>;
    readonly drawTargetTables: Set<string>;
    readonly drawTargetNotes: Set<string>;
    readonly drawTargetCharts: Set<string>;
    readonly drawTargetMarkdowns: Set<string>;
    get drawTargets(): Set<string>;
    constructor(svg: SVGSVGElement, steps: ASTStep[]);
    get currentStep(): number;
    get total(): number;
    get canNext(): boolean;
    get canPrev(): boolean;
    get atEnd(): boolean;
    on(listener: AnimationListener): () => void;
    private emit;
    reset(): void;
    next(): boolean;
    prev(): boolean;
    play(msPerStep?: number): Promise<void>;
    goTo(index: number): void;
    private _clearAll;
    private _applyStep;
    private _doHighlight;
    private _doFade;
    private _writeTransform;
    private _doMove;
    private _doScale;
    private _doRotate;
    private _doDraw;
    private _doErase;
    private _doShowHide;
    private _doPulse;
    private _doColor;
}
export declare const ANIMATION_CSS = "\n.ng, .gg, .tg, .ntg, .cg, .eg, .mdg {\n  transform-box: fill-box;\n  transform-origin: center;\n  transition: filter 0.3s, opacity 0.35s;\n}\n\n/* highlight */\n.ng.hl path, .ng.hl rect, .ng.hl ellipse, .ng.hl polygon,\n.tg.hl path, .tg.hl rect,\n.ntg.hl path, .ntg.hl polygon,\n.cg.hl path, .cg.hl rect,\n.mdg.hl text,\n.eg.hl path, .eg.hl line, .eg.hl polygon { stroke-width: 2.8 !important; }\n\n.ng.hl, .tg.hl, .ntg.hl, .cg.hl, .mdg.hl, .eg.hl {\n  animation: ng-pulse 1.4s ease-in-out infinite;\n}\n@keyframes ng-pulse {\n  0%, 100% { filter: drop-shadow(0 0 7px rgba(200,84,40,.6)); }\n  50%       { filter: drop-shadow(0 0 14px rgba(200,84,40,.9)); }\n}\n\n/* fade */\n.ng.faded, .gg.faded, .tg.faded, .ntg.faded,\n.cg.faded, .eg.faded, .mdg.faded { opacity: 0.22; }\n\n.ng.hidden { opacity: 0; pointer-events: none; }\n.eg.draw-hidden { opacity: 0; }\n.eg.draw-reveal { opacity: 1; }\n.gg.gg-hidden  { opacity: 0; }\n.tg.gg-hidden  { opacity: 0; }\n.ntg.gg-hidden { opacity: 0; }\n.cg.gg-hidden  { opacity: 0; }\n.mdg.gg-hidden { opacity: 0; }\n";
//# sourceMappingURL=index.d.ts.map