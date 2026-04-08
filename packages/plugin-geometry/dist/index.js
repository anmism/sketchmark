const SUPPORTED_COMMANDS = new Set([
    "point",
    "segment",
    "ray",
    "line",
    "circle",
    "arc",
    "ellipse",
    "polygon",
    "triangle",
]);
const DEFAULTS = {
    pointRadius: 4,
    pointLabelDx: 12,
    pointLabelDy: -16,
    lineExtend: 80,
    autoAbsoluteLayout: true,
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
];
function geometry(options = {}) {
    return {
        name: "geometry",
        preprocess(source) {
            return compileGeometry(source, options);
        },
    };
}
function compileGeometry(source, options = {}) {
    const settings = { ...DEFAULTS, ...options };
    const lines = source.split(/\r?\n/);
    const commandByLine = new Map();
    const pointMap = new Map();
    let hasGeometry = false;
    let inTripleQuoteBlock = false;
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index]?.trim() ?? "";
        if (trimmed === '"""') {
            inTripleQuoteBlock = !inTripleQuoteBlock;
            continue;
        }
        if (inTripleQuoteBlock || !trimmed.startsWith("geo."))
            continue;
        const command = parseGeometryCommand(trimmed, index + 1);
        commandByLine.set(index, command);
        hasGeometry = true;
        if (command.type === "point") {
            if (pointMap.has(command.id)) {
                throw new Error(`Duplicate geo.point "${command.id}" on line ${command.lineNumber}`);
            }
            pointMap.set(command.id, buildPointSpec(command, settings));
        }
    }
    if (!hasGeometry)
        return source;
    const layoutDecision = resolveLayout(lines, settings.autoAbsoluteLayout);
    const output = [];
    for (let index = 0; index < lines.length; index += 1) {
        output.push(lines[index] ?? "");
        if (layoutDecision.insertAfterDiagramIndex === index) {
            output.push("layout absolute");
        }
        const command = commandByLine.get(index);
        if (!command)
            continue;
        output.pop();
        output.push(...emitCommand(command, pointMap, settings));
    }
    return output.join("\n");
}
function parseGeometryCommand(line, lineNumber) {
    const tokens = tokenizeLine(line);
    if (tokens.length < 2) {
        throw new Error(`Invalid geometry command on line ${lineNumber}`);
    }
    const commandToken = tokens[0] ?? "";
    const type = commandToken.slice("geo.".length);
    if (!SUPPORTED_COMMANDS.has(type)) {
        throw new Error(`Unsupported geometry command "${commandToken}" on line ${lineNumber}`);
    }
    const id = tokens[1] ?? "";
    if (!id || id.includes("=")) {
        throw new Error(`Geometry command "${commandToken}" requires an explicit id on line ${lineNumber}`);
    }
    const props = {};
    for (const token of tokens.slice(2)) {
        const eqIndex = token.indexOf("=");
        if (eqIndex < 1) {
            throw new Error(`Invalid geometry property "${token}" on line ${lineNumber}`);
        }
        const key = token.slice(0, eqIndex);
        const value = stripWrapping(token.slice(eqIndex + 1));
        props[key] = value;
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
    const diagramIndex = lines.findIndex((line) => (line.trim() ?? "") === "diagram");
    if (diagramIndex < 0) {
        throw new Error('Geometry plugin requires a root "diagram" block');
    }
    const layoutIndex = lines.findIndex((line, index) => {
        if (index <= diagramIndex)
            return false;
        return line.trim().startsWith("layout ");
    });
    if (layoutIndex < 0) {
        if (!autoAbsoluteLayout) {
            throw new Error('Geometry plugin requires "layout absolute"');
        }
        return { insertAfterDiagramIndex: diagramIndex };
    }
    if (lines[layoutIndex]?.trim() !== "layout absolute") {
        throw new Error('Geometry commands require the root diagram to use "layout absolute"');
    }
    return {};
}
function buildPointSpec(command, settings) {
    const x = requireNumber(command.props, "x", command.lineNumber);
    const y = requireNumber(command.props, "y", command.lineNumber);
    const radius = readNumber(command.props.r ?? command.props.radius) ?? settings.pointRadius;
    const labelDx = readNumber(command.props["label-dx"]) ?? settings.pointLabelDx;
    const labelDy = readNumber(command.props["label-dy"]) ?? settings.pointLabelDy;
    return {
        id: command.id,
        x,
        y,
        radius,
        label: command.props.label ?? command.id,
        labelDx,
        labelDy,
        props: command.props,
    };
}
function emitCommand(command, pointMap, settings) {
    switch (command.type) {
        case "point":
            return emitPoint(pointMap.get(command.id));
        case "segment":
            return emitLinear(command, pointMap, "segment", settings.lineExtend);
        case "ray":
            return emitLinear(command, pointMap, "ray", settings.lineExtend);
        case "line":
            return emitLinear(command, pointMap, "line", settings.lineExtend);
        case "circle":
            return emitCircle(command, pointMap);
        case "arc":
            return emitArc(command, pointMap);
        case "ellipse":
            return emitEllipse(command, pointMap);
        case "polygon":
            return emitPolygon(command, pointMap, false);
        case "triangle":
            return emitPolygon(command, pointMap, true);
    }
}
function emitPoint(point) {
    const fill = point.props.fill ?? "#1a1208";
    const stroke = point.props.stroke ?? fill;
    const strokeWidth = readNumber(point.props["stroke-width"]) ?? 1;
    const lines = [
        serializeNode("circle", point.id, "", {
            x: point.x - point.radius,
            y: point.y - point.radius,
            width: point.radius * 2,
            height: point.radius * 2,
            fill,
            stroke,
            "stroke-width": strokeWidth,
            ...pickKeys(point.props, ["theme", "opacity", "dash", "stroke-dash"]),
        }),
    ];
    if (point.label) {
        lines.push(serializeNode("text", labelNodeId(point.id), point.label, {
            x: point.x + point.labelDx,
            y: point.y + point.labelDy,
            "animation-parent": point.id,
            color: point.props.color ?? stroke,
            ...pickKeys(point.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function emitLinear(command, pointMap, mode, defaultExtend) {
    const from = requirePoint(pointMap, command.props.from, "from", command.lineNumber);
    const to = requirePoint(pointMap, command.props.to, "to", command.lineNumber);
    const length = distance(from, to);
    if (length === 0) {
        throw new Error(`Geometry command "${command.id}" on line ${command.lineNumber} needs distinct points`);
    }
    const extend = readNumber(command.props.extend) ?? defaultExtend;
    const unit = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    const start = mode === "line"
        ? { x: from.x - unit.x * extend, y: from.y - unit.y * extend }
        : { x: from.x, y: from.y };
    const end = mode === "segment"
        ? { x: to.x, y: to.y }
        : { x: to.x + unit.x * extend, y: to.y + unit.y * extend };
    const lines = [serializePathNode(command.id, [start, end], false, command.props)];
    if (mode === "ray") {
        lines.push(serializeArrowHeadNode(arrowNodeId(command.id), end, unit, command.props, command.id));
    }
    if (command.props.label) {
        const labelDx = readNumber(command.props["label-dx"]) ?? 0;
        const labelDy = readNumber(command.props["label-dy"]) ?? 0;
        const labelOffset = readNumber(command.props["label-offset"]) ?? 18;
        const anchor = lineLabelAnchor(start, end, labelOffset);
        lines.push(serializeNode("text", labelNodeId(command.id), command.props.label, {
            x: anchor.x + labelDx,
            y: anchor.y + labelDy,
            "animation-parent": command.id,
            color: command.props.color ?? command.props.stroke ?? "#1a1208",
            ...pickKeys(command.props, TEXT_KEYS),
        }));
    }
    return lines;
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
        ...pickKeys(props, ["theme", "opacity"]),
        fill: props.stroke ?? "#1a1208",
        stroke: props.stroke ?? "#1a1208",
        "stroke-width": String(Math.max(1, strokeWidth * 0.75)),
        "animation-parent": animationParent,
    });
}
function emitCircle(command, pointMap) {
    const center = requirePoint(pointMap, command.props.center, "center", command.lineNumber);
    const radius = requireNumber(command.props, "r", command.lineNumber, "radius");
    const diameter = radius * 2;
    const lines = [
        serializeNode("circle", command.id, "", {
            x: center.x - radius,
            y: center.y - radius,
            width: diameter,
            height: diameter,
            fill: command.props.fill ?? "none",
            stroke: command.props.stroke ?? "#1a1208",
            "stroke-width": readNumber(command.props["stroke-width"]) ?? 1.5,
            ...pickKeys(command.props, ["theme", "opacity", "dash", "stroke-dash"]),
        }),
    ];
    if (command.props.label) {
        const labelDx = readNumber(command.props["label-dx"]) ?? radius + 10;
        const labelDy = readNumber(command.props["label-dy"]) ?? -radius - 10;
        lines.push(serializeNode("text", labelNodeId(command.id), command.props.label, {
            x: center.x + labelDx,
            y: center.y + labelDy,
            "animation-parent": command.id,
            color: command.props.color ?? command.props.stroke ?? "#1a1208",
            ...pickKeys(command.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function emitArc(command, pointMap) {
    const center = requirePoint(pointMap, command.props.center, "center", command.lineNumber);
    const radius = requireNumber(command.props, "r", command.lineNumber, "radius");
    const startDeg = requireNumber(command.props, "start", command.lineNumber);
    const endDeg = requireNumber(command.props, "end", command.lineNumber);
    const closeMode = normalizeArcClose(command.props.close, command.lineNumber);
    const arcPoints = sampleArcPoints(center, radius, startDeg, endDeg);
    const pathPoints = closeMode === "center" ? [center, ...arcPoints] : arcPoints;
    const lines = [
        serializePathNode(command.id, pathPoints, closeMode !== "none", {
            ...command.props,
            fill: closeMode === "none" ? "none" : (command.props.fill ?? "none"),
        }),
    ];
    if (command.props.label) {
        const labelDx = readNumber(command.props["label-dx"]) ?? 0;
        const labelDy = readNumber(command.props["label-dy"]) ?? 0;
        const labelOffset = readNumber(command.props["label-offset"])
            ?? (closeMode === "center" ? 0 : 12);
        const labelAngle = startDeg + (endDeg - startDeg) / 2;
        const anchor = polarPoint(center, radius + labelOffset, labelAngle);
        lines.push(serializeNode("text", labelNodeId(command.id), command.props.label, {
            x: anchor.x + labelDx,
            y: anchor.y + labelDy,
            "animation-parent": command.id,
            color: command.props.color ?? command.props.stroke ?? "#1a1208",
            ...pickKeys(command.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function emitEllipse(command, pointMap) {
    const center = requirePoint(pointMap, command.props.center, "center", command.lineNumber);
    const rx = requireNumber(command.props, "rx", command.lineNumber, "radius");
    const ry = requireNumber(command.props, "ry", command.lineNumber, "radius");
    const points = sampleEllipsePoints(center, rx, ry);
    const lines = [
        serializePathNode(command.id, points, true, {
            ...command.props,
            fill: command.props.fill ?? "none",
        }),
    ];
    if (command.props.label) {
        const labelDx = readNumber(command.props["label-dx"]) ?? rx + 10;
        const labelDy = readNumber(command.props["label-dy"]) ?? -ry - 10;
        lines.push(serializeNode("text", labelNodeId(command.id), command.props.label, {
            x: center.x + labelDx,
            y: center.y + labelDy,
            "animation-parent": command.id,
            color: command.props.color ?? command.props.stroke ?? "#1a1208",
            ...pickKeys(command.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function emitPolygon(command, pointMap, isTriangle) {
    const ids = parseList(command.props.points, command.lineNumber, "points");
    if (isTriangle && ids.length !== 3) {
        throw new Error(`geo.triangle "${command.id}" on line ${command.lineNumber} needs exactly 3 points`);
    }
    if (!isTriangle && ids.length < 3) {
        throw new Error(`geo.polygon "${command.id}" on line ${command.lineNumber} needs at least 3 points`);
    }
    const points = ids.map((id) => requirePoint(pointMap, id, "points", command.lineNumber));
    const lines = [serializePathNode(command.id, points, true, command.props)];
    if (command.props.label) {
        const labelDx = readNumber(command.props["label-dx"]) ?? 0;
        const labelDy = readNumber(command.props["label-dy"]) ?? -26;
        const labelX = (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2;
        const labelY = Math.min(...points.map((point) => point.y));
        lines.push(serializeNode("text", labelNodeId(command.id), command.props.label, {
            x: labelX + labelDx,
            y: labelY + labelDy,
            "animation-parent": command.id,
            color: command.props.color ?? command.props.stroke ?? "#1a1208",
            ...pickKeys(command.props, TEXT_KEYS),
        }));
    }
    return lines;
}
function serializePathNode(id, points, closePath, props) {
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxX = Math.max(...points.map((point) => point.x));
    const maxY = Math.max(...points.map((point) => point.y));
    const d = points
        .map((point, index) => {
        const prefix = index === 0 ? "M" : "L";
        return `${prefix} ${formatNumber(point.x - minX)} ${formatNumber(point.y - minY)}`;
    })
        .join(" ");
    return serializeNode("path", id, "", {
        value: `${d}${closePath ? " Z" : ""}`,
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        fill: props.fill ?? "none",
        stroke: props.stroke ?? "#1a1208",
        "stroke-width": readNumber(props["stroke-width"]) ?? 1.5,
        ...pickKeys(props, ["theme", "opacity", "dash", "stroke-dash", "animation-parent"]),
    });
}
function requirePoint(pointMap, id, propName, lineNumber) {
    if (!id) {
        throw new Error(`Geometry command on line ${lineNumber} requires "${propName}"`);
    }
    const point = pointMap.get(id);
    if (!point) {
        throw new Error(`Unknown point "${id}" referenced by "${propName}" on line ${lineNumber}`);
    }
    return point;
}
function parseList(value, lineNumber, propName) {
    if (!value || value[0] !== "[" || value[value.length - 1] !== "]") {
        throw new Error(`Geometry command on line ${lineNumber} requires ${propName}=[...]`);
    }
    return value
        .slice(1, -1)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
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
    return `"${value
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
function labelNodeId(id) {
    return `__geo_${sanitizeId(id)}_label`;
}
function arrowNodeId(id) {
    return `__geo_${sanitizeId(id)}_tip`;
}
function sanitizeId(value) {
    return value.replace(/[^A-Za-z0-9_-]/g, "_");
}
function pickKeys(props, keys) {
    const next = {};
    for (const key of keys) {
        if (props[key] !== undefined)
            next[key] = props[key];
    }
    return next;
}
function requireNumber(props, key, lineNumber, alias) {
    const value = readNumber(props[key] ?? (alias ? props[alias] : undefined));
    if (value === undefined || Number.isNaN(value)) {
        throw new Error(`Geometry command on line ${lineNumber} requires numeric "${key}"`);
    }
    return value;
}
function readNumber(value) {
    if (value === undefined || value === "")
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function distance(from, to) {
    return Math.hypot(to.x - from.x, to.y - from.y);
}
function polarPoint(center, radius, deg) {
    const radians = (deg * Math.PI) / 180;
    return {
        x: center.x + Math.cos(radians) * radius,
        y: center.y - Math.sin(radians) * radius,
    };
}
function sampleArcPoints(center, radius, startDeg, endDeg) {
    const delta = endDeg - startDeg;
    const segments = Math.max(8, Math.ceil(Math.abs(delta) / 12));
    return Array.from({ length: segments + 1 }, (_, index) => polarPoint(center, radius, startDeg + (delta * index) / segments));
}
function sampleEllipsePoints(center, rx, ry) {
    const segments = 36;
    return Array.from({ length: segments }, (_, index) => {
        const deg = (index / segments) * 360;
        const radians = (deg * Math.PI) / 180;
        return {
            x: center.x + Math.cos(radians) * rx,
            y: center.y - Math.sin(radians) * ry,
        };
    });
}
function normalizeArcClose(value, lineNumber) {
    if (!value || value === "none")
        return "none";
    if (value === "chord" || value === "center")
        return value;
    throw new Error(`Invalid geo.arc close "${value}" on line ${lineNumber}; expected none, chord, or center`);
}
function lineLabelAnchor(start, end, offset) {
    const mid = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
    };
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

export { compileGeometry, geometry };
//# sourceMappingURL=index.js.map
