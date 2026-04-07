'use strict';

const SUPPORTED_COMMANDS = new Set([
    "comp",
    "port",
    "junction",
    "wire",
]);
const SUPPORTED_COMPONENTS = new Set([
    "resistor",
    "capacitor",
    "inductor",
    "diode",
    "source",
    "ground",
    "switch",
]);
const DEFAULTS = {
    autoAbsoluteLayout: true,
    stroke: "#2b190d",
    strokeWidth: 2,
    labelColor: "#5f4937",
    labelOffset: 16,
    valueOffset: 18,
    portRadius: 4,
    junctionRadius: 5,
    wireMode: "auto",
};
function circuit(options = {}) {
    return {
        name: "circuit",
        preprocess(source) {
            return compileCircuit(source, options);
        },
    };
}
function compileCircuit(source, options = {}) {
    const settings = { ...DEFAULTS, ...options };
    const lines = source.split(/\r?\n/);
    const commandByLine = new Map();
    const entities = new Map();
    let hasCircuit = false;
    let inTripleQuoteBlock = false;
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index]?.trim() ?? "";
        if (trimmed === '"""') {
            inTripleQuoteBlock = !inTripleQuoteBlock;
            continue;
        }
        if (inTripleQuoteBlock || !trimmed.startsWith("ckt."))
            continue;
        const command = parseCircuitCommand(trimmed, index + 1);
        commandByLine.set(index, command);
        hasCircuit = true;
        if (command.type === "comp") {
            if (entities.has(command.id)) {
                throw new Error(`Duplicate ckt.comp "${command.id}" on line ${command.lineNumber}`);
            }
            entities.set(command.id, buildComponentSpec(command));
        }
        else if (command.type === "port" || command.type === "junction") {
            if (entities.has(command.id)) {
                throw new Error(`Duplicate ckt.${command.type} "${command.id}" on line ${command.lineNumber}`);
            }
            entities.set(command.id, buildPointEntity(command));
        }
    }
    if (!hasCircuit)
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
        output.push(...emitCommand(command, entities, settings));
    }
    return output.join("\n");
}
function parseCircuitCommand(line, lineNumber) {
    const tokens = tokenizeLine(line);
    if (tokens.length < 2) {
        throw new Error(`Invalid circuit command on line ${lineNumber}`);
    }
    const commandToken = tokens[0] ?? "";
    const type = commandToken.slice("ckt.".length);
    if (!SUPPORTED_COMMANDS.has(type)) {
        throw new Error(`Unsupported circuit command "${commandToken}" on line ${lineNumber}`);
    }
    const id = tokens[1] ?? "";
    if (!id || id.includes("=")) {
        throw new Error(`Circuit command "${commandToken}" requires an explicit id on line ${lineNumber}`);
    }
    const props = {};
    for (const token of tokens.slice(2)) {
        const eqIndex = token.indexOf("=");
        if (eqIndex < 1) {
            throw new Error(`Invalid circuit property "${token}" on line ${lineNumber}`);
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
    const diagramIndex = lines.findIndex((line) => (line.trim() ?? "") === "diagram");
    if (diagramIndex < 0) {
        throw new Error('Circuit plugin requires a root "diagram" block');
    }
    const layoutIndex = lines.findIndex((line, index) => {
        if (index <= diagramIndex)
            return false;
        return line.trim().startsWith("layout ");
    });
    if (layoutIndex < 0) {
        if (!autoAbsoluteLayout) {
            throw new Error('Circuit plugin requires "layout absolute"');
        }
        return { insertAfterDiagramIndex: diagramIndex };
    }
    if (lines[layoutIndex]?.trim() !== "layout absolute") {
        throw new Error('Circuit commands require the root diagram to use "layout absolute"');
    }
    return {};
}
function buildComponentSpec(command) {
    const kind = normalizeComponentKind(command.props.kind, command.lineNumber);
    const orient = normalizeOrientation(command.props.orient, kind);
    const x = requireNumber(command.props, "x", command.lineNumber);
    const y = requireNumber(command.props, "y", command.lineNumber);
    const dims = componentDimensions(kind, orient, readNumber(command.props.length), readNumber(command.props.size));
    const left = x - dims.w / 2;
    const top = y - dims.h / 2;
    const pins = buildPins(kind, orient, x, y, left, top, dims.w, dims.h);
    return {
        id: command.id,
        kind,
        orient,
        x,
        y,
        w: dims.w,
        h: dims.h,
        left,
        top,
        pins,
        props: command.props,
    };
}
function buildPointEntity(command) {
    if (command.type !== "port" && command.type !== "junction") {
        throw new Error(`Expected ckt.port or ckt.junction, received ckt.${command.type}`);
    }
    return {
        id: command.id,
        kind: command.type,
        x: requireNumber(command.props, "x", command.lineNumber),
        y: requireNumber(command.props, "y", command.lineNumber),
        props: command.props,
    };
}
function componentDimensions(kind, orient, length, size) {
    switch (kind) {
        case "resistor":
            return orient === "h"
                ? { w: Math.round(length ?? 120), h: 24 }
                : { w: 24, h: Math.round(length ?? 120) };
        case "capacitor":
            return orient === "h"
                ? { w: Math.round(length ?? 100), h: 28 }
                : { w: 28, h: Math.round(length ?? 100) };
        case "inductor":
            return orient === "h"
                ? { w: Math.round(length ?? 116), h: 24 }
                : { w: 24, h: Math.round(length ?? 116) };
        case "diode":
            return orient === "h"
                ? { w: Math.round(length ?? 100), h: 24 }
                : { w: 24, h: Math.round(length ?? 100) };
        case "switch":
            return orient === "h"
                ? { w: Math.round(length ?? 116), h: 24 }
                : { w: 24, h: Math.round(length ?? 116) };
        case "source": {
            const base = Math.round(size ?? 64);
            return { w: base, h: base };
        }
        case "ground":
            return { w: 36, h: 26 };
    }
}
function buildPins(kind, orient, x, y, left, top, w, h) {
    const pins = {
        left: { x: left, y },
        right: { x: left + w, y },
        top: { x, y: top },
        bottom: { x, y: top + h },
        center: { x, y },
    };
    if (kind === "ground") {
        pins.pin = { ...pins.top };
    }
    if (kind === "diode") {
        if (orient === "h") {
            pins.anode = { ...pins.left };
            pins.cathode = { ...pins.right };
        }
        else {
            pins.anode = { ...pins.top };
            pins.cathode = { ...pins.bottom };
        }
    }
    return pins;
}
function emitCommand(command, entities, settings) {
    switch (command.type) {
        case "comp":
            return emitComponent(entities.get(command.id), settings);
        case "port":
            return emitPort(entities.get(command.id), settings);
        case "junction":
            return emitJunction(entities.get(command.id), settings);
        case "wire":
            return emitWire(command, entities, settings);
    }
}
function emitComponent(spec, settings) {
    const bodyId = helperId(spec.id, "body");
    const items = [bodyId];
    const output = [];
    const stroke = spec.props.stroke ?? settings.stroke;
    const strokeWidth = spec.props["stroke-width"] ?? String(settings.strokeWidth);
    const theme = spec.props.theme;
    output.push(emitPathNode(bodyId, {
        x: 0,
        y: 0,
        width: spec.w,
        height: spec.h,
        pathData: componentPath(spec.kind, spec.orient, spec.w, spec.h),
        stroke,
        strokeWidth,
        fill: spec.props.fill ?? "none",
        opacity: spec.props.opacity,
        dash: spec.props.dash,
        theme,
    }));
    if (spec.props.label) {
        const labelId = helperId(spec.id, "label");
        items.push(labelId);
        const labelDx = readNumber(spec.props["label-dx"]) ?? 0;
        const labelDy = readNumber(spec.props["label-dy"]) ?? 0;
        output.push(emitTextNode(labelId, {
            label: spec.props.label,
            x: -40 + labelDx,
            y: -Math.round(settings.labelOffset + 12) + labelDy,
            width: spec.w + 80,
            color: spec.props.color ?? settings.labelColor,
            fontSize: spec.props["font-size"],
            fontWeight: spec.props["font-weight"],
            font: spec.props.font,
            opacity: spec.props.opacity,
            theme,
        }));
    }
    if (spec.props.value) {
        const valueId = helperId(spec.id, "value");
        items.push(valueId);
        output.push(emitTextNode(valueId, {
            label: spec.props.value,
            x: -40,
            y: spec.h + settings.valueOffset - 10,
            width: spec.w + 80,
            color: spec.props.color ?? settings.labelColor,
            fontSize: spec.props["value-size"] ?? spec.props["font-size"],
            fontWeight: spec.props["font-weight"],
            font: spec.props.font,
            opacity: spec.props.opacity,
            theme,
        }));
    }
    output.push(emitBareGroup(spec.id, {
        x: spec.left,
        y: spec.top,
        width: spec.w,
        height: spec.h,
        items,
    }));
    return output;
}
function emitPort(entity, settings) {
    const r = readNumber(entity.props.r) ?? settings.portRadius;
    const bodyId = helperId(entity.id, "body");
    const items = [bodyId];
    const output = [
        emitCircleNode(bodyId, {
            x: 0,
            y: 0,
            size: r * 2,
            stroke: entity.props.stroke ?? settings.stroke,
            strokeWidth: entity.props["stroke-width"] ?? String(settings.strokeWidth),
            fill: entity.props.fill ?? settings.stroke,
            opacity: entity.props.opacity,
            theme: entity.props.theme,
        }),
    ];
    if (entity.props.label) {
        const labelId = helperId(entity.id, "label");
        items.push(labelId);
        const side = entity.props.side ?? "right";
        const pos = portLabelPosition(side, r);
        const labelDx = readNumber(entity.props["label-dx"]) ?? 0;
        const labelDy = readNumber(entity.props["label-dy"]) ?? 0;
        output.push(emitTextNode(labelId, {
            label: entity.props.label,
            x: pos.x + labelDx,
            y: pos.y + labelDy,
            width: pos.width,
            color: entity.props.color ?? settings.labelColor,
            fontSize: entity.props["font-size"],
            fontWeight: entity.props["font-weight"],
            font: entity.props.font,
            opacity: entity.props.opacity,
            textAlign: side === "left" ? "right" : side === "right" ? "left" : "center",
            theme: entity.props.theme,
        }));
    }
    output.push(emitBareGroup(entity.id, {
        x: entity.x - r,
        y: entity.y - r,
        width: r * 2,
        height: r * 2,
        items,
    }));
    return output;
}
function emitJunction(entity, settings) {
    const r = readNumber(entity.props.r) ?? settings.junctionRadius;
    const bodyId = helperId(entity.id, "body");
    const items = [bodyId];
    const output = [
        emitCircleNode(bodyId, {
            x: 0,
            y: 0,
            size: r * 2,
            stroke: entity.props.stroke ?? settings.stroke,
            strokeWidth: entity.props["stroke-width"] ?? "1",
            fill: entity.props.fill ?? settings.stroke,
            opacity: entity.props.opacity,
            theme: entity.props.theme,
        }),
    ];
    if (entity.props.label) {
        const labelId = helperId(entity.id, "label");
        items.push(labelId);
        const labelDx = readNumber(entity.props["label-dx"]) ?? 0;
        const labelDy = readNumber(entity.props["label-dy"]) ?? 0;
        output.push(emitTextNode(labelId, {
            label: entity.props.label,
            x: 8 + labelDx,
            y: -18 + labelDy,
            width: 100,
            color: entity.props.color ?? settings.labelColor,
            fontSize: entity.props["font-size"],
            fontWeight: entity.props["font-weight"],
            font: entity.props.font,
            opacity: entity.props.opacity,
            textAlign: "left",
            theme: entity.props.theme,
        }));
    }
    output.push(emitBareGroup(entity.id, {
        x: entity.x - r,
        y: entity.y - r,
        width: r * 2,
        height: r * 2,
        items,
    }));
    return output;
}
function emitWire(command, entities, settings) {
    const fromRef = command.props.from;
    const toRef = command.props.to;
    if (!fromRef || !toRef) {
        throw new Error(`ckt.wire "${command.id}" requires from= and to= on line ${command.lineNumber}`);
    }
    const from = resolveCircuitRef(fromRef, entities, command.lineNumber);
    const to = resolveCircuitRef(toRef, entities, command.lineNumber);
    const mode = normalizeWireMode(command.props.mode ?? settings.wireMode, command.lineNumber);
    const points = routeWire(from, to, mode);
    const bounds = wireBounds(points);
    const localPoints = points.map((point) => ({
        x: point.x - bounds.minX,
        y: point.y - bounds.minY,
    }));
    const bodyId = helperId(command.id, "body");
    const items = [bodyId];
    const output = [
        emitPathNode(bodyId, {
            x: 0,
            y: 0,
            width: Math.max(1, bounds.maxX - bounds.minX),
            height: Math.max(1, bounds.maxY - bounds.minY),
            pathData: pointsToPath(localPoints),
            stroke: command.props.stroke ?? settings.stroke,
            strokeWidth: command.props["stroke-width"] ?? String(settings.strokeWidth),
            fill: "none",
            opacity: command.props.opacity,
            dash: command.props.dash,
            theme: command.props.theme,
        }),
    ];
    if (command.props.label) {
        const labelId = helperId(command.id, "label");
        items.push(labelId);
        const labelPoint = wireLabelPoint(localPoints);
        const labelDx = readNumber(command.props["label-dx"]) ?? 0;
        const labelDy = readNumber(command.props["label-dy"]) ?? 0;
        output.push(emitTextNode(labelId, {
            label: command.props.label,
            x: labelPoint.x - 60 + labelDx,
            y: labelPoint.y - 20 + labelDy,
            width: 120,
            color: command.props.color ?? settings.labelColor,
            fontSize: command.props["font-size"],
            fontWeight: command.props["font-weight"],
            font: command.props.font,
            opacity: command.props.opacity,
            theme: command.props.theme,
        }));
    }
    output.push(emitBareGroup(command.id, {
        x: bounds.minX,
        y: bounds.minY,
        width: Math.max(1, bounds.maxX - bounds.minX),
        height: Math.max(1, bounds.maxY - bounds.minY),
        items,
    }));
    return output;
}
function emitPathNode(id, options) {
    const parts = ["path", id];
    appendProp(parts, "label", "");
    appendProp(parts, "x", String(Math.round(options.x)));
    appendProp(parts, "y", String(Math.round(options.y)));
    appendProp(parts, "width", String(Math.max(1, Math.round(options.width))));
    appendProp(parts, "height", String(Math.max(1, Math.round(options.height))));
    appendProp(parts, "value", options.pathData);
    appendProp(parts, "fill", options.fill);
    appendProp(parts, "stroke", options.stroke);
    appendProp(parts, "stroke-width", options.strokeWidth);
    appendProp(parts, "opacity", options.opacity);
    appendProp(parts, "dash", options.dash);
    appendProp(parts, "theme", options.theme);
    return parts.join(" ");
}
function emitCircleNode(id, options) {
    const parts = ["circle", id];
    appendProp(parts, "label", "");
    appendProp(parts, "x", String(Math.round(options.x)));
    appendProp(parts, "y", String(Math.round(options.y)));
    appendProp(parts, "width", String(Math.max(1, Math.round(options.size))));
    appendProp(parts, "height", String(Math.max(1, Math.round(options.size))));
    appendProp(parts, "fill", options.fill);
    appendProp(parts, "stroke", options.stroke);
    appendProp(parts, "stroke-width", options.strokeWidth);
    appendProp(parts, "opacity", options.opacity);
    appendProp(parts, "theme", options.theme);
    return parts.join(" ");
}
function emitTextNode(id, options) {
    const parts = ["text", id];
    appendProp(parts, "label", options.label);
    appendProp(parts, "x", String(Math.round(options.x)));
    appendProp(parts, "y", String(Math.round(options.y)));
    appendProp(parts, "width", String(Math.max(1, Math.round(options.width))));
    appendProp(parts, "color", options.color);
    appendProp(parts, "font-size", options.fontSize);
    appendProp(parts, "font-weight", options.fontWeight);
    appendProp(parts, "font", options.font);
    appendProp(parts, "opacity", options.opacity);
    appendProp(parts, "text-align", options.textAlign ?? "center");
    appendProp(parts, "theme", options.theme);
    return parts.join(" ");
}
function emitBareGroup(id, options) {
    const parts = ["bare", id];
    appendProp(parts, "layout", "absolute");
    appendProp(parts, "padding", "0");
    appendProp(parts, "gap", "0");
    appendProp(parts, "x", String(Math.round(options.x)));
    appendProp(parts, "y", String(Math.round(options.y)));
    appendProp(parts, "width", String(Math.max(1, Math.round(options.width))));
    appendProp(parts, "height", String(Math.max(1, Math.round(options.height))));
    appendProp(parts, "items", `[${options.items.join(",")}]`);
    return parts.join(" ");
}
function componentPath(kind, orient, w, h) {
    switch (kind) {
        case "resistor":
            return orient === "h" ? resistorPathH(w, h) : resistorPathV(w, h);
        case "capacitor":
            return orient === "h" ? capacitorPathH(w, h) : capacitorPathV(w, h);
        case "inductor":
            return orient === "h" ? inductorPathH(w, h) : inductorPathV(w, h);
        case "diode":
            return orient === "h" ? diodePathH(w, h) : diodePathV(w, h);
        case "source":
            return orient === "h" ? sourcePathH(w, h) : sourcePathV(w, h);
        case "ground":
            return groundPath(w);
        case "switch":
            return orient === "h" ? switchPathH(w, h) : switchPathV(w, h);
    }
}
function resistorPathH(w, h) {
    const cy = h / 2;
    const lead = Math.round(w * 0.15);
    const bodyStart = lead;
    const bodyEnd = w - lead;
    const bodyWidth = bodyEnd - bodyStart;
    const amp = h / 2 - 2;
    const step = bodyWidth / 6;
    const points = [
        [0, cy],
        [bodyStart, cy],
        [bodyStart + step * 0.5, cy - amp],
        [bodyStart + step * 1.5, cy + amp],
        [bodyStart + step * 2.5, cy - amp],
        [bodyStart + step * 3.5, cy + amp],
        [bodyStart + step * 4.5, cy - amp],
        [bodyStart + step * 5.5, cy + amp],
        [bodyEnd, cy],
        [w, cy],
    ];
    return pointsToPath(points.map(([x, y]) => ({ x, y })));
}
function resistorPathV(w, h) {
    const cx = w / 2;
    const lead = Math.round(h * 0.15);
    const bodyStart = lead;
    const bodyEnd = h - lead;
    const bodyHeight = bodyEnd - bodyStart;
    const amp = w / 2 - 2;
    const step = bodyHeight / 6;
    const points = [
        [cx, 0],
        [cx, bodyStart],
        [cx - amp, bodyStart + step * 0.5],
        [cx + amp, bodyStart + step * 1.5],
        [cx - amp, bodyStart + step * 2.5],
        [cx + amp, bodyStart + step * 3.5],
        [cx - amp, bodyStart + step * 4.5],
        [cx + amp, bodyStart + step * 5.5],
        [cx, bodyEnd],
        [cx, h],
    ];
    return pointsToPath(points.map(([x, y]) => ({ x, y })));
}
function capacitorPathH(w, h) {
    const cy = h / 2;
    const a = Math.round(w * 0.36);
    const b = Math.round(w * 0.52);
    return `M 0 ${cy} L ${a} ${cy} M ${a} 0 L ${a} ${h} M ${b} 0 L ${b} ${h} M ${b} ${cy} L ${w} ${cy}`;
}
function capacitorPathV(w, h) {
    const cx = w / 2;
    const a = Math.round(h * 0.36);
    const b = Math.round(h * 0.52);
    return `M ${cx} 0 L ${cx} ${a} M 0 ${a} L ${w} ${a} M 0 ${b} L ${w} ${b} M ${cx} ${b} L ${cx} ${h}`;
}
function inductorPathH(w, h) {
    const cy = h / 2;
    const lead = 16;
    const bodyEnd = w - lead;
    const bodyStart = lead;
    const section = (bodyEnd - bodyStart) / 4;
    return [
        `M 0 ${cy} L ${bodyStart} ${cy}`,
        `C ${bodyStart} ${cy - h / 2} ${bodyStart + section} ${cy - h / 2} ${bodyStart + section} ${cy}`,
        `C ${bodyStart + section} ${cy + h / 2} ${bodyStart + section * 2} ${cy + h / 2} ${bodyStart + section * 2} ${cy}`,
        `C ${bodyStart + section * 2} ${cy - h / 2} ${bodyStart + section * 3} ${cy - h / 2} ${bodyStart + section * 3} ${cy}`,
        `C ${bodyStart + section * 3} ${cy + h / 2} ${bodyEnd} ${cy + h / 2} ${bodyEnd} ${cy}`,
        `L ${w} ${cy}`,
    ].join(" ");
}
function inductorPathV(w, h) {
    const cx = w / 2;
    const lead = 16;
    const bodyEnd = h - lead;
    const bodyStart = lead;
    const section = (bodyEnd - bodyStart) / 4;
    return [
        `M ${cx} 0 L ${cx} ${bodyStart}`,
        `C ${cx - w / 2} ${bodyStart} ${cx - w / 2} ${bodyStart + section} ${cx} ${bodyStart + section}`,
        `C ${cx + w / 2} ${bodyStart + section} ${cx + w / 2} ${bodyStart + section * 2} ${cx} ${bodyStart + section * 2}`,
        `C ${cx - w / 2} ${bodyStart + section * 2} ${cx - w / 2} ${bodyStart + section * 3} ${cx} ${bodyStart + section * 3}`,
        `C ${cx + w / 2} ${bodyStart + section * 3} ${cx + w / 2} ${bodyEnd} ${cx} ${bodyEnd}`,
        `L ${cx} ${h}`,
    ].join(" ");
}
function diodePathH(w, h) {
    const cy = h / 2;
    const start = 24;
    const bar = 60;
    return `M 0 ${cy} L ${start} ${cy} M ${start} 0 L ${bar - 8} ${cy} L ${start} ${h} Z M ${bar} 0 L ${bar} ${h} M ${bar} ${cy} L ${w} ${cy}`;
}
function diodePathV(w, h) {
    const cx = w / 2;
    const start = 24;
    const bar = 60;
    return `M ${cx} 0 L ${cx} ${start} M 0 ${start} L ${cx} ${bar - 8} L ${w} ${start} Z M 0 ${bar} L ${w} ${bar} M ${cx} ${bar} L ${cx} ${h}`;
}
function sourcePathH(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(10, Math.min(w, h) / 2 - 18);
    return [
        `M 0 ${cy} L ${cx - r} ${cy}`,
        `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
        `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
        `M ${cx + r} ${cy} L ${w} ${cy}`,
        `M ${cx} ${cy - 10} L ${cx} ${cy + 10}`,
        `M ${cx - 10} ${cy} L ${cx + 10} ${cy}`,
    ].join(" ");
}
function sourcePathV(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(10, Math.min(w, h) / 2 - 18);
    return [
        `M ${cx} 0 L ${cx} ${cy - r}`,
        `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
        `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
        `M ${cx} ${cy + r} L ${cx} ${h}`,
        `M ${cx} ${cy - 10} L ${cx} ${cy + 10}`,
        `M ${cx - 10} ${cy} L ${cx + 10} ${cy}`,
    ].join(" ");
}
function groundPath(w, h) {
    const cx = w / 2;
    return [
        `M ${cx} 0 L ${cx} 8`,
        `M 2 8 L ${w - 2} 8`,
        `M 6 14 L ${w - 6} 14`,
        `M 10 20 L ${w - 10} 20`,
    ].join(" ");
}
function switchPathH(w, h) {
    const cy = h / 2;
    return `M 0 ${cy} L 34 ${cy} M 34 ${cy} L 76 2 M ${w - 34} ${cy} L ${w} ${cy}`;
}
function switchPathV(w, h) {
    const cx = w / 2;
    return `M ${cx} 0 L ${cx} 34 M ${cx} 34 L 2 76 M ${cx} ${h - 34} L ${cx} ${h}`;
}
function resolveCircuitRef(ref, entities, lineNumber) {
    if (entities.has(ref)) {
        const entity = entities.get(ref);
        if ("pins" in entity) {
            throw new Error(`Component "${ref}" requires an explicit pin like ${ref}.left on line ${lineNumber}`);
        }
        return { x: entity.x, y: entity.y };
    }
    const dot = ref.lastIndexOf(".");
    if (dot > 0) {
        const base = ref.slice(0, dot);
        const pin = ref.slice(dot + 1);
        const entity = entities.get(base);
        if (entity && "pins" in entity) {
            const point = entity.pins[pin];
            if (!point) {
                throw new Error(`Unknown pin "${pin}" on "${base}" on line ${lineNumber}`);
            }
            return point;
        }
    }
    throw new Error(`Unknown circuit reference "${ref}" on line ${lineNumber}`);
}
function normalizeComponentKind(value, lineNumber) {
    if (!value) {
        throw new Error(`ckt.comp requires kind= on line ${lineNumber}`);
    }
    if (!SUPPORTED_COMPONENTS.has(value)) {
        throw new Error(`Unsupported circuit component kind "${value}" on line ${lineNumber}`);
    }
    return value;
}
function normalizeOrientation(value, kind) {
    if (!value)
        return kind === "ground" ? "v" : "h";
    return value === "v" || value === "vertical" ? "v" : "h";
}
function normalizeWireMode(value, lineNumber) {
    if (value === "auto" || value === "straight" || value === "hv" || value === "vh") {
        return value;
    }
    throw new Error(`Unsupported wire mode "${value}" on line ${lineNumber}`);
}
function routeWire(from, to, mode) {
    const resolvedMode = mode === "auto"
        ? from.x === to.x || from.y === to.y
            ? "straight"
            : Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
                ? "hv"
                : "vh"
        : mode;
    if (resolvedMode === "straight")
        return [from, to];
    if (resolvedMode === "hv")
        return [from, { x: to.x, y: from.y }, to];
    return [from, { x: from.x, y: to.y }, to];
}
function wireBounds(points) {
    return {
        minX: Math.min(...points.map((point) => point.x)),
        minY: Math.min(...points.map((point) => point.y)),
        maxX: Math.max(...points.map((point) => point.x)),
        maxY: Math.max(...points.map((point) => point.y)),
    };
}
function pointsToPath(points) {
    return points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${formatNumber(point.x)} ${formatNumber(point.y)}`)
        .join(" ");
}
function wireLabelPoint(points) {
    if (points.length === 2) {
        return {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2,
        };
    }
    const midIndex = Math.floor((points.length - 1) / 2);
    const a = points[midIndex];
    const b = points[midIndex + 1] ?? a;
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
    };
}
function portLabelPosition(side, r) {
    switch (side) {
        case "left":
            return { x: -124, y: -10, width: 120 };
        case "top":
            return { x: -40, y: -24, width: 80 };
        case "bottom":
            return { x: -40, y: r * 2 + 4, width: 80 };
        default:
            return { x: r * 2 + 6, y: -10, width: 120 };
    }
}
function appendProp(parts, key, value) {
    if (value === undefined)
        return;
    parts.push(`${key}=${formatDslValue(value)}`);
}
function formatDslValue(value) {
    if (/^-?\d+(?:\.\d+)?$/.test(value))
        return value;
    if (value === "true" || value === "false")
        return value;
    if (/^\[[^\]]*]$/.test(value))
        return value;
    if (/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value))
        return value;
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function readNumber(value) {
    if (value === undefined)
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function requireNumber(props, key, lineNumber) {
    const value = readNumber(props[key]);
    if (value === undefined) {
        throw new Error(`Circuit command requires ${key}=<number> on line ${lineNumber}`);
    }
    return value;
}
function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
function helperId(baseId, suffix) {
    return `__ckt_${baseId.replace(/[^A-Za-z0-9_-]/g, "_")}_${suffix}`;
}

exports.circuit = circuit;
exports.compileCircuit = compileCircuit;
//# sourceMappingURL=index.cjs.map
