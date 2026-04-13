'use strict';

// @ts-nocheck
const SUPPORTED_COMMANDS = new Set([
    "axes",
    "plot",
    "point",
    "label",
    "line",
    "arrow",
    "region",
    "tangent",
    "area",
]);
const DEFAULTS = {
    autoAbsoluteLayout: true,
    axisStroke: "#2b190d",
    axisStrokeWidth: 2,
    gridStroke: "#cbbba3",
    gridOpacity: 0.55,
    labelColor: "#5f4937",
    pointRadius: 4,
    pointLabelDx: 10,
    pointLabelDy: -14,
    tickFontSize: 12,
    samples: 96,
    tickLength: 6,
    plotStroke: "#c85428",
    plotStrokeWidth: 2,
    areaFill: "rgba(200, 84, 40, 0.18)",
    regionFill: "rgba(43, 25, 13, 0.1)",
};
const TEXT_KEYS = [
    "color",
    "opacity",
    "font-size",
    "font-weight",
    "font",
    "letter-spacing",
    "text-align",
    "vertical-align",
    "line-height",
    "theme",
];
function graph(options = {}) {
    return {
        name: "graph",
        preprocess(source) {
            return compileGraph(source, options);
        },
    };
}
function compileGraph(source, options = {}) {
    const settings = { ...DEFAULTS, ...options };
    const lines = source.split(/\r?\n/);
    const commandByLine = new Map();
    const axesById = new Map();
    const pointsById = new Map();
    const plotsById = new Map();
    let hasGraph = false;
    let inTripleQuoteBlock = false;
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = (lines[index] ?? "").trim();
        if (trimmed === '"""') {
            inTripleQuoteBlock = !inTripleQuoteBlock;
            continue;
        }
        if (inTripleQuoteBlock || !trimmed.startsWith("graph."))
            continue;
        const command = parseGraphCommand(trimmed, index + 1);
        commandByLine.set(index, command);
        hasGraph = true;
        if (command.type === "axes") {
            if (axesById.has(command.id)) {
                throw new Error(`Duplicate graph.axes "${command.id}" on line ${command.lineNumber}`);
            }
            axesById.set(command.id, buildAxesSpec(command));
            continue;
        }
        if (command.type === "point") {
            if (pointsById.has(command.id)) {
                throw new Error(`Duplicate graph.point "${command.id}" on line ${command.lineNumber}`);
            }
            pointsById.set(command.id, buildPointSpec(command, settings));
            continue;
        }
        if (command.type === "plot") {
            if (plotsById.has(command.id)) {
                throw new Error(`Duplicate graph.plot "${command.id}" on line ${command.lineNumber}`);
            }
            plotsById.set(command.id, buildPlotSpec(command, settings));
        }
    }
    if (!hasGraph)
        return source;
    resolveLayout(lines, settings.autoAbsoluteLayout);
    const plotGeometryCache = new Map();
    const output = [];
    for (let index = 0; index < lines.length; index += 1) {
        output.push(lines[index] ?? "");
        const command = commandByLine.get(index);
        if (!command)
            continue;
        output.pop();
        output.push(...emitCommand(command, axesById, pointsById, plotsById, plotGeometryCache, settings));
    }
    return output.join("\n");
}
function parseGraphCommand(line, lineNumber) {
    const tokens = tokenizeLine(line);
    if (tokens.length < 2) {
        throw new Error(`Invalid graph command on line ${lineNumber}`);
    }
    const commandToken = tokens[0] ?? "";
    const type = commandToken.slice("graph.".length);
    if (!SUPPORTED_COMMANDS.has(type)) {
        throw new Error(`Unsupported graph command "${commandToken}" on line ${lineNumber}`);
    }
    const id = tokens[1] ?? "";
    if (!id || id.includes("=")) {
        throw new Error(`Graph command "${commandToken}" requires an explicit id on line ${lineNumber}`);
    }
    const props = {};
    for (const token of tokens.slice(2)) {
        const eqIndex = token.indexOf("=");
        if (eqIndex < 1) {
            throw new Error(`Invalid graph property "${token}" on line ${lineNumber}`);
        }
        props[token.slice(0, eqIndex)] = stripWrapping(token.slice(eqIndex + 1));
    }
    return { type, id, props, lineNumber };
}
function tokenizeLine(line) {
    const tokens = [];
    let index = 0;
    while (index < line.length) {
        while (index < line.length && /\s/.test(line[index] ?? ""))
            index += 1;
        if (index >= line.length)
            break;
        const start = index;
        let inQuote = false;
        let listDepth = 0;
        while (index < line.length) {
            const ch = line[index] ?? "";
            if (ch === '"' && line[index - 1] !== "\\") {
                inQuote = !inQuote;
                index += 1;
                continue;
            }
            if (!inQuote) {
                if (ch === "[")
                    listDepth += 1;
                if (ch === "]" && listDepth > 0)
                    listDepth -= 1;
                if (/\s/.test(ch) && listDepth === 0)
                    break;
            }
            index += 1;
        }
        tokens.push(line.slice(start, index));
    }
    return tokens;
}
function stripWrapping(value) {
    if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
        return value.slice(1, -1).replace(/\\"/g, '"');
    }
    return value;
}
function resolveLayout(lines, autoAbsoluteLayout) {
    const diagramIndex = lines.findIndex((line) => (line.trim() ?? "").startsWith("diagram"));
    if (diagramIndex < 0) {
        throw new Error('Graph plugin requires a root "diagram" block');
    }
    const diagramLine = lines[diagramIndex]?.trim() ?? "";
    const layoutMatch = diagramLine.match(/\blayout=([A-Za-z-]+)/);
    if (!layoutMatch) {
        if (!autoAbsoluteLayout) {
            throw new Error('Graph plugin requires "diagram layout=absolute"');
        }
        lines[diagramIndex] = `${lines[diagramIndex] ?? "diagram"} layout=absolute`;
        return { diagramIndex };
    }
    if (layoutMatch[1] !== "absolute") {
        throw new Error('Graph commands require the root diagram to use "diagram layout=absolute"');
    }
    return { diagramIndex };
}
function buildAxesSpec(command) {
    const x = requireNumber(command.props, "x", command.lineNumber);
    const y = requireNumber(command.props, "y", command.lineNumber);
    const width = requireNumber(command.props, "width", command.lineNumber);
    const height = requireNumber(command.props, "height", command.lineNumber);
    const xmin = requireNumber(command.props, "xmin", command.lineNumber);
    const xmax = requireNumber(command.props, "xmax", command.lineNumber);
    const ymin = requireNumber(command.props, "ymin", command.lineNumber);
    const ymax = requireNumber(command.props, "ymax", command.lineNumber);
    if (xmax === xmin || ymax === ymin) {
        throw new Error(`graph.axes "${command.id}" on line ${command.lineNumber} needs non-zero ranges`);
    }
    return {
        id: command.id,
        x,
        y,
        width,
        height,
        xmin,
        xmax,
        ymin,
        ymax,
        grid: parseBool(command.props.grid, false),
        ticks: parseBool(command.props.ticks, true),
        tickStepX: readNumber(command.props["tick-step-x"]),
        tickStepY: readNumber(command.props["tick-step-y"]),
        props: command.props,
    };
}
function buildPointSpec(command, settings) {
    return {
        id: command.id,
        axesId: requireProp(command.props, "axes", command.lineNumber),
        at: parseCoordinateToken(command.props.at, command.lineNumber, "at"),
        radius: readNumber(command.props.r ?? command.props.radius) ?? settings.pointRadius,
        label: command.props.label !== undefined ? command.props.label : command.id,
        labelDx: readNumber(command.props["label-dx"]) ?? settings.pointLabelDx,
        labelDy: readNumber(command.props["label-dy"]) ?? settings.pointLabelDy,
        props: command.props,
    };
}
function buildPlotSpec(command, settings) {
    return {
        id: command.id,
        axesId: requireProp(command.props, "axes", command.lineNumber),
        expr: command.props.expr ?? command.props.fn ?? command.props.function,
        from: readNumber(command.props.from),
        to: readNumber(command.props.to),
        samples: Math.max(16, Math.round(readNumber(command.props.samples) ?? settings.samples)),
        props: command.props,
        lineNumber: command.lineNumber,
    };
}
function emitCommand(command, axesById, pointsById, plotsById, plotGeometryCache, settings) {
    switch (command.type) {
        case "axes":
            return emitAxes(axesById.get(command.id), settings);
        case "point":
            return emitPoint(pointsById.get(command.id), axesById, settings);
        case "label":
            return emitLabel(command, axesById, pointsById, settings);
        case "plot":
            return emitPlot(command, axesById, plotsById, plotGeometryCache, settings);
        case "line":
            return emitLinear(command, axesById, pointsById, "line", settings);
        case "arrow":
            return emitLinear(command, axesById, pointsById, "arrow", settings);
        case "region":
            return emitRegion(command, axesById, pointsById, settings);
        case "tangent":
            return emitTangent(command, axesById, plotsById, plotGeometryCache, settings);
        case "area":
            return emitArea(command, axesById, plotsById, plotGeometryCache, settings);
        default:
            return [];
    }
}
function emitAxes(spec, settings) {
    const output = [];
    const stepX = spec.tickStepX ?? niceStep((spec.xmax - spec.xmin) / 6);
    const stepY = spec.tickStepY ?? niceStep((spec.ymax - spec.ymin) / 6);
    const xTicks = buildTicks(spec.xmin, spec.xmax, stepX);
    const yTicks = buildTicks(spec.ymin, spec.ymax, stepY);
    const xAxisValue = axisValue(spec.ymin, spec.ymax);
    const yAxisValue = axisValue(spec.xmin, spec.xmax);
    const axisSegments = [
        [mapGraphToCanvas(spec, { x: spec.xmin, y: xAxisValue }), mapGraphToCanvas(spec, { x: spec.xmax, y: xAxisValue })],
        [mapGraphToCanvas(spec, { x: yAxisValue, y: spec.ymin }), mapGraphToCanvas(spec, { x: yAxisValue, y: spec.ymax })],
    ];
    if (spec.grid) {
        const gridSegments = [];
        for (const value of xTicks) {
            if (almostEqual(value, yAxisValue))
                continue;
            gridSegments.push([
                mapGraphToCanvas(spec, { x: value, y: spec.ymin }),
                mapGraphToCanvas(spec, { x: value, y: spec.ymax }),
            ]);
        }
        for (const value of yTicks) {
            if (almostEqual(value, xAxisValue))
                continue;
            gridSegments.push([
                mapGraphToCanvas(spec, { x: spec.xmin, y: value }),
                mapGraphToCanvas(spec, { x: spec.xmax, y: value }),
            ]);
        }
        if (gridSegments.length) {
            output.push(serializeMultiPathNode(helperId(spec.id, "grid"), gridSegments, false, {
                stroke: spec.props["grid-stroke"] ?? settings.gridStroke,
                "stroke-width": spec.props["grid-stroke-width"] ?? "1",
                opacity: spec.props["grid-opacity"] ?? String(settings.gridOpacity),
                theme: spec.props.theme,
                "animation-parent": spec.id,
            }));
        }
    }
    if (spec.ticks) {
        const tickSegments = [];
        for (const value of xTicks) {
            const p = mapGraphToCanvas(spec, { x: value, y: xAxisValue });
            tickSegments.push([
                { x: p.x, y: p.y - settings.tickLength / 2 },
                { x: p.x, y: p.y + settings.tickLength / 2 },
            ]);
            output.push(serializeNode("text", helperId(spec.id, `xtick_${safeNumberToken(value)}`), formatTickValue(value), {
                x: p.x - 18,
                y: p.y + 10,
                width: 36,
                "font-size": readNumber(spec.props["tick-font-size"]) ?? settings.tickFontSize,
                color: spec.props.color ?? settings.labelColor,
                "text-align": "center",
                theme: spec.props.theme,
                "animation-parent": spec.id,
            }));
        }
        for (const value of yTicks) {
            const p = mapGraphToCanvas(spec, { x: yAxisValue, y: value });
            tickSegments.push([
                { x: p.x - settings.tickLength / 2, y: p.y },
                { x: p.x + settings.tickLength / 2, y: p.y },
            ]);
            output.push(serializeNode("text", helperId(spec.id, `ytick_${safeNumberToken(value)}`), formatTickValue(value), {
                x: p.x - 50,
                y: p.y - 9,
                width: 42,
                "font-size": readNumber(spec.props["tick-font-size"]) ?? settings.tickFontSize,
                color: spec.props.color ?? settings.labelColor,
                "text-align": "right",
                theme: spec.props.theme,
                "animation-parent": spec.id,
            }));
        }
        if (tickSegments.length) {
            output.push(serializeMultiPathNode(helperId(spec.id, "ticks"), tickSegments, false, {
                stroke: spec.props.stroke ?? settings.axisStroke,
                "stroke-width": spec.props["stroke-width"] ?? String(settings.axisStrokeWidth),
                theme: spec.props.theme,
                "animation-parent": spec.id,
            }));
        }
    }
    output.push(serializeMultiPathNode(spec.id, axisSegments, false, {
        stroke: spec.props.stroke ?? settings.axisStroke,
        "stroke-width": spec.props["stroke-width"] ?? String(settings.axisStrokeWidth),
        theme: spec.props.theme,
        opacity: spec.props.opacity,
    }));
    const xAxisEnd = mapGraphToCanvas(spec, { x: spec.xmax, y: xAxisValue });
    const yAxisEnd = mapGraphToCanvas(spec, { x: yAxisValue, y: spec.ymax });
    output.push(serializeArrowHeadNode(helperId(spec.id, "x_tip"), xAxisEnd, { x: 1, y: 0 }, {
        stroke: spec.props.stroke ?? settings.axisStroke,
        "stroke-width": spec.props["stroke-width"] ?? String(settings.axisStrokeWidth),
        theme: spec.props.theme,
        opacity: spec.props.opacity,
    }, spec.id));
    output.push(serializeArrowHeadNode(helperId(spec.id, "y_tip"), yAxisEnd, { x: 0, y: -1 }, {
        stroke: spec.props.stroke ?? settings.axisStroke,
        "stroke-width": spec.props["stroke-width"] ?? String(settings.axisStrokeWidth),
        theme: spec.props.theme,
        opacity: spec.props.opacity,
    }, spec.id));
    if (spec.props.label) {
        output.push(serializeNode("text", helperId(spec.id, "title"), spec.props.label, {
            x: spec.x + spec.width / 2 - 100,
            y: spec.y - 30,
            width: 200,
            "font-size": readNumber(spec.props["label-size"]) ?? 14,
            "font-weight": spec.props["label-weight"] ?? "600",
            color: spec.props.color ?? settings.labelColor,
            "text-align": "center",
            theme: spec.props.theme,
            "animation-parent": spec.id,
        }));
    }
    if (spec.props.xlabel) {
        output.push(serializeNode("text", helperId(spec.id, "xlabel"), spec.props.xlabel, {
            x: spec.x + spec.width - 24,
            y: mapGraphToCanvas(spec, { x: spec.xmax, y: xAxisValue }).y + 12,
            width: 48,
            color: spec.props.color ?? settings.labelColor,
            "text-align": "center",
            theme: spec.props.theme,
            "animation-parent": spec.id,
        }));
    }
    if (spec.props.ylabel) {
        output.push(serializeNode("text", helperId(spec.id, "ylabel"), spec.props.ylabel, {
            x: mapGraphToCanvas(spec, { x: yAxisValue, y: spec.ymax }).x + 12,
            y: spec.y - 4,
            width: 48,
            color: spec.props.color ?? settings.labelColor,
            "text-align": "left",
            theme: spec.props.theme,
            "animation-parent": spec.id,
        }));
    }
    return output;
}
function emitPoint(spec, axesById, settings) {
    const axes = requireAxes(axesById, spec.axesId, spec.id, "axes");
    const center = mapGraphToCanvas(axes, spec.at);
    const lines = [
        serializeNode("circle", spec.id, "", {
            x: center.x - spec.radius,
            y: center.y - spec.radius,
            width: spec.radius * 2,
            height: spec.radius * 2,
            fill: spec.props.fill ?? spec.props.stroke ?? DEFAULTS.axisStroke,
            stroke: spec.props.stroke ?? spec.props.fill ?? DEFAULTS.axisStroke,
            "stroke-width": readNumber(spec.props["stroke-width"]) ?? 1,
            theme: spec.props.theme,
            opacity: spec.props.opacity,
        }),
    ];
    if (spec.label) {
        lines.push(serializeNode("text", labelNodeId(spec.id), spec.label, {
            x: center.x + spec.labelDx,
            y: center.y + spec.labelDy,
            color: spec.props.color ?? settings.labelColor,
            theme: spec.props.theme,
            "animation-parent": spec.id,
            ...pickKeys(spec.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function emitLabel(command, axesById, pointsById, settings) {
    const text = command.props.text ?? command.props.label;
    if (!text) {
        throw new Error(`graph.label "${command.id}" on line ${command.lineNumber} requires text=`);
    }
    let position = null;
    let theme = command.props.theme;
    if (command.props.target) {
        const target = resolveGraphRef(command.props.target, command, axesById, pointsById, "target");
        position = target.canvas;
        theme = theme ?? target.theme;
    }
    else {
        const axesId = requireProp(command.props, "axes", command.lineNumber);
        const axes = requireAxes(axesById, axesId, command.id, "axes");
        position = mapGraphToCanvas(axes, parseCoordinateToken(command.props.at, command.lineNumber, "at"));
    }
    const dx = readNumber(command.props.dx ?? command.props["label-dx"]) ?? 0;
    const dy = readNumber(command.props.dy ?? command.props["label-dy"]) ?? 0;
    return [
        serializeNode("text", command.id, text, {
            x: position.x + dx,
            y: position.y + dy,
            width: readNumber(command.props.width) ?? 140,
            color: command.props.color ?? settings.labelColor,
            "text-align": command.props["text-align"] ?? "center",
            theme,
            ...pickKeys(command.props, TEXT_KEYS),
        }),
    ];
}
function emitPlot(command, axesById, plotsById, plotGeometryCache, settings) {
    const geometry = resolvePlotGeometry(command.id, axesById, plotsById, plotGeometryCache);
    const lines = [
        serializePlotPathNode(command.id, geometry.canvasSegments, {
            stroke: command.props.stroke ?? settings.plotStroke,
            "stroke-width": command.props["stroke-width"] ?? String(settings.plotStrokeWidth),
            fill: "none",
            opacity: command.props.opacity,
            dash: command.props.dash,
            theme: command.props.theme,
        }),
    ];
    if (command.props.label) {
        const anchor = geometry.labelPoint ?? geometry.lastPoint;
        const labelDx = readNumber(command.props["label-dx"]) ?? 10;
        const labelDy = readNumber(command.props["label-dy"]) ?? -10;
        lines.push(serializeNode("text", labelNodeId(command.id), command.props.label, {
            x: anchor.x + labelDx,
            y: anchor.y + labelDy,
            color: command.props.color ?? command.props.stroke ?? settings.labelColor,
            theme: command.props.theme,
            "animation-parent": command.id,
            ...pickKeys(command.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function emitLinear(command, axesById, pointsById, mode, settings) {
    const from = resolveGraphRef(command.props.from, command, axesById, pointsById, "from");
    const to = resolveGraphRef(command.props.to, command, axesById, pointsById, "to");
    const lines = [
        serializePathNode(command.id, [from.canvas, to.canvas], false, {
            stroke: command.props.stroke ?? settings.axisStroke,
            "stroke-width": command.props["stroke-width"] ?? String(settings.axisStrokeWidth),
            fill: "none",
            theme: command.props.theme ?? from.theme ?? to.theme,
            opacity: command.props.opacity,
            dash: command.props.dash,
        }),
    ];
    if (mode === "arrow") {
        const direction = normalize(subtract(to.canvas, from.canvas), command.lineNumber, command.id);
        lines.push(serializeArrowHeadNode(arrowNodeId(command.id), to.canvas, direction, {
            stroke: command.props.stroke ?? settings.axisStroke,
            "stroke-width": command.props["stroke-width"] ?? String(settings.axisStrokeWidth),
            theme: command.props.theme ?? from.theme ?? to.theme,
            opacity: command.props.opacity,
        }, command.id));
    }
    if (command.props.label) {
        const labelDx = readNumber(command.props["label-dx"]) ?? 0;
        const labelDy = readNumber(command.props["label-dy"]) ?? 0;
        const labelOffset = readNumber(command.props["label-offset"]) ?? 18;
        const anchor = lineLabelAnchor(from.canvas, to.canvas, labelOffset);
        lines.push(serializeNode("text", labelNodeId(command.id), command.props.label, {
            x: anchor.x + labelDx,
            y: anchor.y + labelDy,
            color: command.props.color ?? command.props.stroke ?? settings.labelColor,
            theme: command.props.theme ?? from.theme ?? to.theme,
            "animation-parent": command.id,
            ...pickKeys(command.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function emitRegion(command, axesById, pointsById, settings) {
    const axes = requireAxes(axesById, command.props.axes ?? inferAxesIdFromPointList(command.props.points, pointsById), command.id, "axes");
    const refs = parseCoordinateRefList(command.props.points, command.lineNumber, "points");
    if (refs.length < 3) {
        throw new Error(`graph.region "${command.id}" on line ${command.lineNumber} needs at least 3 points`);
    }
    const graphPoints = refs.map((ref) => resolveCoordinateRef(ref, axes, pointsById, command.lineNumber));
    const canvasPoints = graphPoints.map((point) => mapGraphToCanvas(axes, point));
    const lines = [
        serializePathNode(command.id, canvasPoints, true, {
            fill: command.props.fill ?? settings.regionFill,
            stroke: command.props.stroke ?? settings.axisStroke,
            "stroke-width": command.props["stroke-width"] ?? "1.5",
            opacity: command.props.opacity ?? "0.8",
            theme: command.props.theme,
        }),
    ];
    if (command.props.label) {
        const center = centroid(canvasPoints);
        const labelDx = readNumber(command.props["label-dx"]) ?? 0;
        const labelDy = readNumber(command.props["label-dy"]) ?? -8;
        lines.push(serializeNode("text", labelNodeId(command.id), command.props.label, {
            x: center.x + labelDx,
            y: center.y + labelDy,
            color: command.props.color ?? settings.labelColor,
            theme: command.props.theme,
            "animation-parent": command.id,
            ...pickKeys(command.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function emitTangent(command, axesById, plotsById, plotGeometryCache, settings) {
    const target = resolvePlotTarget(command, axesById, plotsById, plotGeometryCache);
    const axes = target.axes;
    const at = requireNumber(command.props, "at", command.lineNumber);
    const span = readNumber(command.props.span) ?? (axes.xmax - axes.xmin) / 4;
    const derivative = estimateDerivative(target.fn, at, axes);
    const y = target.fn(at);
    if (!Number.isFinite(y)) {
        throw new Error(`graph.tangent "${command.id}" on line ${command.lineNumber} evaluated to a non-finite point`);
    }
    const x1 = at - span / 2;
    const x2 = at + span / 2;
    const graphStart = { x: x1, y: y + derivative * (x1 - at) };
    const graphEnd = { x: x2, y: y + derivative * (x2 - at) };
    const start = mapGraphToCanvas(axes, clampGraphPointToAxes(axes, graphStart));
    const end = mapGraphToCanvas(axes, clampGraphPointToAxes(axes, graphEnd));
    const lines = [
        serializePathNode(command.id, [start, end], false, {
            stroke: command.props.stroke ?? settings.axisStroke,
            "stroke-width": command.props["stroke-width"] ?? "1.5",
            fill: "none",
            opacity: command.props.opacity,
            dash: command.props.dash ?? "6,4",
            theme: command.props.theme,
        }),
    ];
    if (command.props.label) {
        const labelDx = readNumber(command.props["label-dx"]) ?? 0;
        const labelDy = readNumber(command.props["label-dy"]) ?? -12;
        const anchor = lineLabelAnchor(start, end, 12);
        lines.push(serializeNode("text", labelNodeId(command.id), command.props.label, {
            x: anchor.x + labelDx,
            y: anchor.y + labelDy,
            color: command.props.color ?? command.props.stroke ?? settings.labelColor,
            theme: command.props.theme,
            "animation-parent": command.id,
            ...pickKeys(command.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function emitArea(command, axesById, plotsById, plotGeometryCache, settings) {
    const target = resolvePlotTarget(command, axesById, plotsById, plotGeometryCache);
    const axes = target.axes;
    const from = readNumber(command.props.from) ?? target.from ?? axes.xmin;
    const to = readNumber(command.props.to) ?? target.to ?? axes.xmax;
    const baseline = readNumber(command.props.baseline) ?? 0;
    const geometry = samplePlotGeometry(axes, target.fn, from, to, Math.max(16, Math.round(readNumber(command.props.samples) ?? target.samples ?? settings.samples)));
    if (!geometry.graphPoints.length) {
        throw new Error(`graph.area "${command.id}" on line ${command.lineNumber} produced no drawable points`);
    }
    const polygon = [
        mapGraphToCanvas(axes, { x: geometry.graphPoints[0].x, y: baseline }),
        ...geometry.graphPoints.map((point) => mapGraphToCanvas(axes, clampGraphPointToAxes(axes, point))),
        mapGraphToCanvas(axes, { x: geometry.graphPoints[geometry.graphPoints.length - 1].x, y: baseline }),
    ];
    const lines = [
        serializePathNode(command.id, polygon, true, {
            fill: command.props.fill ?? settings.areaFill,
            stroke: command.props.stroke ?? target.stroke ?? settings.plotStroke,
            "stroke-width": command.props["stroke-width"] ?? "1.5",
            opacity: command.props.opacity ?? "0.9",
            theme: command.props.theme ?? target.theme,
        }),
    ];
    if (command.props.label) {
        const center = centroid(polygon);
        const labelDx = readNumber(command.props["label-dx"]) ?? 0;
        const labelDy = readNumber(command.props["label-dy"]) ?? -8;
        lines.push(serializeNode("text", labelNodeId(command.id), command.props.label, {
            x: center.x + labelDx,
            y: center.y + labelDy,
            color: command.props.color ?? settings.labelColor,
            theme: command.props.theme ?? target.theme,
            "animation-parent": command.id,
            ...pickKeys(command.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function resolvePlotGeometry(plotId, axesById, plotsById, plotGeometryCache) {
    if (plotGeometryCache.has(plotId)) {
        return plotGeometryCache.get(plotId);
    }
    const spec = plotsById.get(plotId);
    if (!spec) {
        throw new Error(`Unknown plot "${plotId}"`);
    }
    if (!spec.expr) {
        throw new Error(`graph.plot "${plotId}" requires expr=`);
    }
    const axes = requireAxes(axesById, spec.axesId, plotId, "axes");
    const fn = compileExpression(spec.expr, spec.lineNumber, plotId);
    const from = spec.from ?? axes.xmin;
    const to = spec.to ?? axes.xmax;
    const geometry = samplePlotGeometry(axes, fn, from, to, spec.samples);
    const lastSegment = geometry.canvasSegments[geometry.canvasSegments.length - 1] ?? [];
    const lastPoint = lastSegment[lastSegment.length - 1] ?? mapGraphToCanvas(axes, { x: from, y: 0 });
    const result = {
        ...geometry,
        axes,
        fn,
        from,
        to,
        samples: spec.samples,
        labelPoint: lastPoint,
        lastPoint,
        stroke: spec.props.stroke,
        theme: spec.props.theme,
    };
    plotGeometryCache.set(plotId, result);
    return result;
}
function samplePlotGeometry(axes, fn, from, to, samples) {
    const graphPoints = [];
    const canvasSegments = [];
    let currentSegment = [];
    for (let index = 0; index <= samples; index += 1) {
        const x = from + ((to - from) * index) / samples;
        const y = fn(x);
        if (!Number.isFinite(y)) {
            if (currentSegment.length > 1)
                canvasSegments.push(currentSegment);
            currentSegment = [];
            continue;
        }
        const graphPoint = { x, y };
        graphPoints.push(graphPoint);
        const canvasPoint = mapGraphToCanvas(axes, clampGraphPointToAxes(axes, graphPoint));
        currentSegment.push(canvasPoint);
    }
    if (currentSegment.length > 1) {
        canvasSegments.push(currentSegment);
    }
    return { graphPoints, canvasSegments };
}
function resolvePlotTarget(command, axesById, plotsById, plotGeometryCache) {
    if (command.props.plot) {
        return resolvePlotGeometry(command.props.plot, axesById, plotsById, plotGeometryCache);
    }
    const axesId = requireProp(command.props, "axes", command.lineNumber);
    const axes = requireAxes(axesById, axesId, command.id, "axes");
    const expr = requireProp(command.props, "expr", command.lineNumber);
    const fn = compileExpression(expr, command.lineNumber, command.id);
    return {
        axes,
        fn,
        from: readNumber(command.props.from),
        to: readNumber(command.props.to),
        samples: Math.max(16, Math.round(readNumber(command.props.samples) ?? DEFAULTS.samples)),
        theme: command.props.theme,
        stroke: command.props.stroke,
    };
}
function resolveGraphRef(value, command, axesById, pointsById, propName) {
    if (!value) {
        throw new Error(`graph.${command.type} "${command.id}" on line ${command.lineNumber} requires ${propName}=`);
    }
    if (value.trim().startsWith("[")) {
        const axesId = requireProp(command.props, "axes", command.lineNumber);
        const axes = requireAxes(axesById, axesId, command.id, "axes");
        const graphPoint = parseCoordinateToken(value, command.lineNumber, propName);
        return {
            graph: graphPoint,
            canvas: mapGraphToCanvas(axes, graphPoint),
            theme: command.props.theme,
        };
    }
    const point = pointsById.get(value);
    if (!point) {
        throw new Error(`Unknown graph.point "${value}" referenced by ${propName} on line ${command.lineNumber}`);
    }
    const axes = requireAxes(axesById, point.axesId, point.id, "axes");
    return {
        graph: point.at,
        canvas: mapGraphToCanvas(axes, point.at),
        theme: point.props.theme,
    };
}
function resolveCoordinateRef(ref, axes, pointsById, lineNumber) {
    if (ref.kind === "coord")
        return ref.value;
    const point = pointsById.get(ref.value);
    if (!point) {
        throw new Error(`Unknown graph.point "${ref.value}" on line ${lineNumber}`);
    }
    if (point.axesId !== axes.id) {
        throw new Error(`graph.point "${ref.value}" belongs to axes "${point.axesId}", not "${axes.id}"`);
    }
    return point.at;
}
function requireAxes(axesById, id, ownerId, propName) {
    if (!id) {
        throw new Error(`Graph command "${ownerId}" requires ${propName}=`);
    }
    const axes = axesById.get(id);
    if (!axes) {
        throw new Error(`Unknown graph.axes "${id}" referenced by "${ownerId}"`);
    }
    return axes;
}
function requireProp(props, key, lineNumber) {
    const value = props[key];
    if (!value) {
        throw new Error(`Graph command on line ${lineNumber} requires ${key}=`);
    }
    return value;
}
function parseCoordinateToken(value, lineNumber, propName) {
    if (!value || value[0] !== "[" || value[value.length - 1] !== "]") {
        throw new Error(`Graph command on line ${lineNumber} requires ${propName}=[x,y]`);
    }
    const inner = value.slice(1, -1);
    const parts = splitTopLevel(inner);
    if (parts.length !== 2) {
        throw new Error(`Graph command on line ${lineNumber} requires ${propName}=[x,y]`);
    }
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`Graph command on line ${lineNumber} requires numeric ${propName}=[x,y]`);
    }
    return { x, y };
}
function parseCoordinateRefList(value, lineNumber, propName) {
    if (!value || value[0] !== "[" || value[value.length - 1] !== "]") {
        throw new Error(`Graph command on line ${lineNumber} requires ${propName}=[...]`);
    }
    const items = splitTopLevel(value.slice(1, -1));
    return items
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
        if (item.startsWith("[")) {
            return { kind: "coord", value: parseCoordinateToken(item, lineNumber, propName) };
        }
        return { kind: "point", value: item };
    });
}
function inferAxesIdFromPointList(value, pointsById) {
    if (!value || value[0] !== "[" || value[value.length - 1] !== "]")
        return undefined;
    const refs = splitTopLevel(value.slice(1, -1))
        .map((item) => item.trim())
        .filter(Boolean);
    for (const ref of refs) {
        if (ref.startsWith("["))
            continue;
        const point = pointsById.get(ref);
        if (point)
            return point.axesId;
    }
    return undefined;
}
function splitTopLevel(value) {
    const parts = [];
    let start = 0;
    let depth = 0;
    let inQuote = false;
    for (let index = 0; index < value.length; index += 1) {
        const ch = value[index];
        if (ch === '"' && value[index - 1] !== "\\") {
            inQuote = !inQuote;
            continue;
        }
        if (inQuote)
            continue;
        if (ch === "[")
            depth += 1;
        if (ch === "]" && depth > 0)
            depth -= 1;
        if (ch === "," && depth === 0) {
            parts.push(value.slice(start, index).trim());
            start = index + 1;
        }
    }
    parts.push(value.slice(start).trim());
    return parts.filter(Boolean);
}
function mapGraphToCanvas(axes, point) {
    return {
        x: axes.x + ((point.x - axes.xmin) / (axes.xmax - axes.xmin)) * axes.width,
        y: axes.y + axes.height - ((point.y - axes.ymin) / (axes.ymax - axes.ymin)) * axes.height,
    };
}
function clampGraphPointToAxes(axes, point) {
    return {
        x: clamp(point.x, axes.xmin, axes.xmax),
        y: clamp(point.y, axes.ymin, axes.ymax),
    };
}
function axisValue(min, max) {
    if (min <= 0 && max >= 0)
        return 0;
    return min > 0 ? min : max;
}
function buildTicks(min, max, step) {
    const ticks = [];
    const start = Math.ceil(min / step) * step;
    for (let value = start; value <= max + step * 0.5; value += step) {
        ticks.push(normalizeZero(value));
    }
    return dedupeNumbers(ticks);
}
function niceStep(value) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value || 1))));
    const normalized = Math.abs(value) / magnitude;
    let step = 1;
    if (normalized > 1)
        step = 2;
    if (normalized > 2)
        step = 5;
    if (normalized > 5)
        step = 10;
    return step * magnitude;
}
function dedupeNumbers(values) {
    const result = [];
    for (const value of values) {
        if (!result.some((entry) => almostEqual(entry, value))) {
            result.push(value);
        }
    }
    return result;
}
function formatTickValue(value) {
    const normalized = normalizeZero(value);
    if (Number.isInteger(normalized))
        return String(normalized);
    return String(Math.round(normalized * 100) / 100).replace(/\.?0+$/, "");
}
function safeNumberToken(value) {
    return formatTickValue(value).replace(/[^A-Za-z0-9_-]/g, "_");
}
function compileExpression(expr, lineNumber, id) {
    const raw = normalizeExpression(expr);
    if (!/^[0-9+\-*/%^()., xA-Za-z_]+$/.test(raw)) {
        throw new Error(`Unsupported expression "${expr}" for "${id}" on line ${lineNumber}`);
    }
    const prepared = raw
        .replace(/\^/g, "**")
        .replace(/\bpi\b/gi, "PI")
        .replace(/\btau\b/gi, "(PI*2)")
        .replace(/\be\b/g, "E");
    const fn = new Function("x", `"use strict";
const { PI, E, sin, cos, tan, asin, acos, atan, sqrt, abs, log, exp, pow, min, max, floor, ceil, round } = Math;
const ln = Math.log;
return (${prepared});`);
    return (x) => {
        const value = fn(x);
        return Number.isFinite(value) ? value : NaN;
    };
}
function normalizeExpression(expr) {
    let next = expr.trim();
    const equals = next.indexOf("=");
    if (equals >= 0) {
        next = next.slice(equals + 1).trim();
    }
    return next;
}
function estimateDerivative(fn, x, axes) {
    const epsilon = (axes.xmax - axes.xmin) / 1000;
    const left = fn(x - epsilon);
    const right = fn(x + epsilon);
    if (!Number.isFinite(left) || !Number.isFinite(right))
        return 0;
    return (right - left) / (2 * epsilon);
}
function serializePlotPathNode(id, segments, props) {
    const points = segments.flat();
    if (!points.length) {
        return serializeNode("path", id, "", {
            value: "M 0 0",
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            fill: props.fill,
            stroke: props.stroke ?? DEFAULTS.plotStroke,
            "stroke-width": readNumber(props["stroke-width"]) ?? DEFAULTS.plotStrokeWidth,
            theme: props.theme,
            opacity: props.opacity,
            dash: props.dash,
        });
    }
    return serializeMultiPathNode(id, segments, false, props);
}
function serializeMultiPathNode(id, segments, closePath, props) {
    const points = segments.flat();
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxX = Math.max(...points.map((point) => point.x));
    const maxY = Math.max(...points.map((point) => point.y));
    const d = segments
        .map((segment) => segment
        .map((point, index) => {
        const prefix = index === 0 ? "M" : "L";
        return `${prefix} ${formatNumber(point.x - minX)} ${formatNumber(point.y - minY)}`;
    })
        .join(" "))
        .join(" ");
    return serializeNode("path", id, "", {
        value: `${d}${closePath ? " Z" : ""}`,
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        fill: props.fill ?? "none",
        stroke: props.stroke ?? DEFAULTS.axisStroke,
        "stroke-width": readNumber(props["stroke-width"]) ?? 1.5,
        theme: props.theme,
        opacity: props.opacity,
        dash: props.dash,
        "animation-parent": props["animation-parent"],
    });
}
function serializePathNode(id, points, closePath, props) {
    return serializeMultiPathNode(id, [points], closePath, props);
}
function serializeArrowHeadNode(id, tip, direction, props, animationParent) {
    const strokeWidth = readNumber(props["stroke-width"]) ?? 1.5;
    const arrowLength = readNumber(props["tip-size"]) ?? Math.max(10, strokeWidth * 6.5);
    const arrowWidth = arrowLength * 0.65;
    const base = {
        x: tip.x - direction.x * arrowLength,
        y: tip.y - direction.y * arrowLength,
    };
    const normal = { x: -direction.y, y: direction.x };
    const left = {
        x: base.x + normal.x * (arrowWidth / 2),
        y: base.y + normal.y * (arrowWidth / 2),
    };
    const right = {
        x: base.x - normal.x * (arrowWidth / 2),
        y: base.y - normal.y * (arrowWidth / 2),
    };
    return serializePathNode(id, [left, tip, right], true, {
        fill: props.stroke ?? DEFAULTS.axisStroke,
        stroke: props.stroke ?? DEFAULTS.axisStroke,
        "stroke-width": String(Math.max(1, strokeWidth * 0.75)),
        theme: props.theme,
        opacity: props.opacity,
        "animation-parent": animationParent,
    });
}
function serializeNode(shape, id, label, props) {
    const parts = [shape, id, `label=${quote(label)}`];
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined)
            continue;
        parts.push(`${key}=${formatPropValue(value)}`);
    }
    return parts.join(" ");
}
function quote(value) {
    return `"${String(value)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")}"`;
}
function formatPropValue(value) {
    if (typeof value === "number")
        return formatNumber(value);
    return quote(value);
}
function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}
function pickKeys(props, keys) {
    const next = {};
    for (const key of keys) {
        if (props[key] !== undefined)
            next[key] = props[key];
    }
    return next;
}
function labelNodeId(id) {
    return `__graph_${sanitizeId(id)}_label`;
}
function arrowNodeId(id) {
    return `__graph_${sanitizeId(id)}_tip`;
}
function helperId(id, suffix) {
    return `__graph_${sanitizeId(id)}_${suffix}`;
}
function sanitizeId(value) {
    return value.replace(/[^A-Za-z0-9_-]/g, "_");
}
function readNumber(value) {
    if (value === undefined || value === "")
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function requireNumber(props, key, lineNumber) {
    const value = readNumber(props[key]);
    if (value === undefined) {
        throw new Error(`Graph command on line ${lineNumber} requires numeric "${key}"`);
    }
    return value;
}
function parseBool(value, fallback) {
    if (value === undefined)
        return fallback;
    switch (String(value).toLowerCase()) {
        case "true":
        case "1":
        case "yes":
        case "on":
            return true;
        case "false":
        case "0":
        case "no":
        case "off":
            return false;
        default:
            return fallback;
    }
}
function subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
function normalize(point, lineNumber, id) {
    const length = Math.hypot(point.x, point.y);
    if (!length) {
        throw new Error(`Graph command "${id}" on line ${lineNumber} requires distinct points`);
    }
    return { x: point.x / length, y: point.y / length };
}
function lerp(a, b, t) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
    };
}
function lineLabelAnchor(start, end, offset) {
    const mid = lerp(start, end, 0.5);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const unit = { x: dx / length, y: dy / length };
    const normalA = { x: unit.y, y: -unit.x };
    const normalB = { x: -unit.y, y: unit.x };
    const normal = normalScore(normalA) >= normalScore(normalB) ? normalA : normalB;
    return {
        x: mid.x + normal.x * offset,
        y: mid.y + normal.y * offset,
    };
}
function normalScore(normal) {
    let score = 0;
    if (normal.y < 0)
        score += 2;
    if (Math.abs(normal.x) > 0.6)
        score += 1;
    if (normal.x > 0)
        score += 0.25;
    return score;
}
function centroid(points) {
    const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return {
        x: total.x / points.length,
        y: total.y / points.length,
    };
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function normalizeZero(value) {
    return Math.abs(value) < 1e-8 ? 0 : value;
}
function almostEqual(a, b) {
    return Math.abs(a - b) < 1e-8;
}

exports.compileGraph = compileGraph;
exports.graph = graph;
//# sourceMappingURL=index.cjs.map
