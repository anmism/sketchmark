export declare const LAYOUT: {
    readonly margin: 60;
    readonly gap: 80;
    readonly groupLabelH: 22;
    readonly groupPad: 26;
    readonly groupGap: 10;
};
export declare const NODE: {
    readonly minW: 90;
    readonly maxW: 180;
    readonly defaultH: 52;
    readonly fontPxPerChar: 8.6;
    readonly basePad: 26;
};
export declare const SHAPES: {
    readonly cylinder: {
        readonly defaultH: 66;
        readonly ellipseH: 18;
    };
    readonly diamond: {
        readonly minW: 130;
        readonly minH: 62;
        readonly aspect: 0.46;
        readonly labelPad: 30;
    };
    readonly hexagon: {
        readonly minW: 126;
        readonly minH: 54;
        readonly aspect: 0.44;
        readonly labelPad: 20;
        readonly inset: 0.56;
    };
    readonly triangle: {
        readonly minW: 108;
        readonly minH: 64;
        readonly aspect: 0.6;
        readonly labelPad: 10;
    };
    readonly parallelogram: {
        readonly defaultH: 50;
        readonly labelPad: 28;
        readonly skew: 18;
    };
};
export declare const TABLE: {
    readonly cellPad: 20;
    readonly minColW: 50;
    readonly fontPxPerChar: 7.5;
    readonly rowH: 30;
    readonly headerH: 34;
    readonly labelH: 22;
};
export declare const NOTE: {
    readonly lineH: 20;
    readonly padX: 16;
    readonly padY: 12;
    readonly fontPxPerChar: 7.5;
    readonly fold: 14;
    readonly minW: 120;
};
export declare const TYPOGRAPHY: {
    readonly defaultFontSize: 14;
    readonly defaultFontWeight: 500;
    readonly defaultLineHeight: 1.3;
    readonly defaultPadding: 8;
    readonly defaultAlign: "center";
    readonly defaultVAlign: "middle";
};
export declare const TITLE: {
    readonly y: 26;
    readonly fontSize: 18;
    readonly fontWeight: 600;
};
export declare const GROUP_LABEL: {
    readonly fontSize: 12;
    readonly fontWeight: 500;
    readonly padding: 14;
};
export declare const EDGE: {
    readonly arrowSize: 12;
    readonly headInset: 13;
    readonly labelOffset: 14;
    readonly labelFontSize: 11;
    readonly labelFontWeight: 400;
    readonly dashPattern: readonly number[];
};
export declare const MARKDOWN: {
    readonly fontSize: {
        readonly h1: 40;
        readonly h2: 28;
        readonly h3: 20;
        readonly p: 15;
        readonly blank: 0;
    };
    readonly fontWeight: {
        readonly h1: 700;
        readonly h2: 600;
        readonly h3: 600;
        readonly p: 400;
        readonly blank: 400;
    };
    readonly spacing: {
        readonly h1: 52;
        readonly h2: 38;
        readonly h3: 28;
        readonly p: 22;
        readonly blank: 10;
    };
    readonly defaultPad: 16;
};
export declare const ROUGH: {
    readonly roughness: 1.3;
    readonly chartRoughness: 1.2;
    readonly bowing: 0.7;
};
export declare const CHART: {
    readonly titleH: 24;
    readonly titleHEmpty: 8;
    readonly padL: 44;
    readonly padR: 12;
    readonly padT: 6;
    readonly padB: 28;
    readonly defaultW: 320;
    readonly defaultH: 240;
};
export declare const ANIMATION: {
    readonly strokeDur: 360;
    readonly arrowReveal: 120;
    readonly dashClear: 160;
    readonly nodeStrokeDur: 420;
    readonly nodeStagger: 55;
    readonly groupStrokeDur: 550;
    readonly groupStagger: 40;
    readonly tableStrokeDur: 500;
    readonly tableStagger: 40;
    readonly textFade: 200;
    readonly fillFadeOffset: -60;
    readonly textDelay: 80;
    readonly chartFade: 500;
};
export declare const EXPORT: {
    readonly pngScale: 2;
    readonly fallbackW: 400;
    readonly fallbackH: 300;
    readonly fallbackBg: "#f8f4ea";
    readonly revokeDelay: 5000;
    readonly defaultFps: 30;
};
export declare const SVG_NS = "http://www.w3.org/2000/svg";
//# sourceMappingURL=config.d.ts.map