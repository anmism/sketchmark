import type { ASTStepItem } from "../ast/types";
export type AnimationEventType = "step-change" | "step-complete" | "animation-reset" | "animation-start" | "animation-end";
export interface AnimationEvent {
    type: AnimationEventType;
    stepIndex: number;
    step?: ASTStepItem;
    total: number;
}
export type AnimationListener = (e: AnimationEvent) => void;
export declare function getDrawTargetEdgeIds(steps: ASTStepItem[]): Set<string>;
export declare function getDrawTargetNodeIds(steps: ASTStepItem[]): Set<string>;
export declare function getDrawTargetTableIds(steps: ASTStepItem[]): Set<string>;
export declare function getDrawTargetNoteIds(steps: ASTStepItem[]): Set<string>;
export declare function getDrawTargetChartIds(steps: ASTStepItem[]): Set<string>;
export declare class AnimationController {
    private svg;
    readonly steps: ASTStepItem[];
    private _container?;
    private _rc?;
    private _config?;
    private _step;
    private _isPlaying;
    private _playRunId;
    private _pendingStepTimers;
    private _pendingNarrationTimers;
    private _playbackDelayTimerId;
    private _resolvePlaybackDelay;
    private _transforms;
    private _listeners;
    readonly drawTargetEdges: Set<string>;
    readonly drawTargetNodes: Set<string>;
    readonly drawTargetGroups: Set<string>;
    readonly drawTargetTables: Set<string>;
    readonly drawTargetNotes: Set<string>;
    readonly drawTargetCharts: Set<string>;
    readonly drawTargetMarkdowns: Set<string>;
    private readonly _drawStepIndexByElementId;
    private readonly _relatedElementIdsByPrimaryId;
    private readonly _parentGroupByElementId;
    private readonly _groupDescendantIds;
    private _captionEl;
    private _captionTextEl;
    private _narrationRunId;
    private _annotationLayer;
    private _annotations;
    private _pointerEl;
    private _pointerType;
    private _tts;
    private _speechDone;
    private _resolveSpeechDone;
    get drawTargets(): Set<string>;
    constructor(svg: SVGSVGElement, steps: ASTStepItem[], _container?: HTMLElement | undefined, _rc?: any | undefined, _config?: Record<string, string | number | boolean> | undefined);
    private _buildDrawStepIndex;
    private _buildRelatedElementIndex;
    private _buildGroupVisibilityIndex;
    private _hideGroupDescendants;
    private _isDeferredForGroupReveal;
    private _revealGroupSubtree;
    private _resolveCascadeTargets;
    /** The narration caption element — mount it anywhere via `yourContainer.appendChild(anim.captionElement)` */
    get captionElement(): HTMLDivElement | null;
    /** Enable/disable browser text-to-speech for narrate steps */
    get tts(): boolean;
    set tts(on: boolean);
    get currentStep(): number;
    get total(): number;
    get canNext(): boolean;
    get canPrev(): boolean;
    get atEnd(): boolean;
    get isPlaying(): boolean;
    on(listener: AnimationListener): () => void;
    private emit;
    reset(): void;
    /** Remove caption and annotation layer from the DOM */
    destroy(): void;
    next(): boolean;
    prev(): boolean;
    play(msPerStep?: number): Promise<void>;
    goTo(index: number): void;
    stop(): void;
    private _advanceNext;
    private _clearTimerBucket;
    private _clearPendingStepTimers;
    private _cancelNarrationTyping;
    private _scheduleTimer;
    private _scheduleStep;
    private _waitForPlaybackDelay;
    private _cancelPlaybackDelay;
    private _stepWaitMs;
    private _playbackWaitMs;
    private _clearAll;
    private _applyStep;
    private _runStepItem;
    private _runStep;
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
    private _initCaption;
    private _doNarrate;
    private _speak;
    private _cancelSpeech;
    /** Pre-warm the speech engine with a silent utterance to eliminate cold-start delay */
    private _warmUpSpeech;
    private _nodeMetrics;
    /**
     * Animate an annotation using the same guide-path approach as node draw:
     * 1. Hide the rough.js element (opacity=0)
     * 2. Create a clean single guide path and animate it with stroke-dashoffset
     * 3. Pointer follows the guide path
     * 4. After guide finishes → fade in rough.js element, remove guide
     */
    private _animateAnnotation;
    private _doAnnotationCircle;
    private _doAnnotationUnderline;
    private _doAnnotationCrossout;
    private _doAnnotationTick;
    private _doAnnotationStrikeoff;
    private _doAnnotationBracket;
    private _initPointer;
}
export declare const ANIMATION_CSS = "\n.ng, .gg, .tg, .ntg, .cg, .eg, .mdg {\n  transform-box: fill-box;\n  transform-origin: center;\n  transition: filter 0.3s, opacity 0.35s;\n}\n\n/* highlight */\n.ng.hl path, .ng.hl rect, .ng.hl ellipse, .ng.hl polygon,\n.tg.hl path, .tg.hl rect,\n.ntg.hl path, .ntg.hl polygon,\n.cg.hl path, .cg.hl rect,\n.mdg.hl text,\n.eg.hl path, .eg.hl line, .eg.hl polygon { stroke-width: 2.8 !important; }\n\n.ng.hl, .tg.hl, .ntg.hl, .cg.hl, .mdg.hl, .eg.hl {\n  animation: ng-pulse 1.4s ease-in-out infinite;\n}\n@keyframes ng-pulse {\n  0%, 100% { filter: drop-shadow(0 0 7px rgba(200,84,40,.6)); }\n  50%       { filter: drop-shadow(0 0 14px rgba(200,84,40,.9)); }\n}\n\n/* fade */\n.ng.faded, .gg.faded, .tg.faded, .ntg.faded,\n.cg.faded, .eg.faded, .mdg.faded { opacity: 0.22; }\n\n.ng.hidden { opacity: 0; pointer-events: none; }\n.gg.gg-hidden  { opacity: 0; }\n.tg.gg-hidden  { opacity: 0; }\n.ntg.gg-hidden { opacity: 0; }\n.cg.gg-hidden  { opacity: 0; }\n.eg.gg-hidden  { opacity: 0; }\n.mdg.gg-hidden { opacity: 0; }\n\n/* narration caption */\n.skm-caption { pointer-events: none; user-select: none; }\n";
//# sourceMappingURL=index.d.ts.map