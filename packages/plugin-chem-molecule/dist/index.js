const SUPPORTED_COMMANDS = new Set([
    "atom",
    "bond",
    "ring",
    "label",
]);
const DEFAULTS = {
    autoAbsoluteLayout: true,
    bondStroke: "#2b190d",
    bondStrokeWidth: 2,
    bondSpacing: 6,
    atomColor: "#2b190d",
    labelColor: "#5f4937",
    fontSize: 22,
    labelOffset: 18,
    atomInset: 12,
    ringLabelOffset: 14,
    aromaticRadiusRatio: 0.48,
};
export function chemMolecule(options = {}) {
    return {
        name: "chem-molecule",
        preprocess(source) {
            return compileChemMolecule(source, options);
        },
    };
}
export function compileChemMolecule(source, options = {}) {
    const settings = { ...DEFAULTS, ...options };
    const lines = source.split(/\r?\n/);
    const commandByLine = new Map();
    const entities = new Map();
    let hasChem = false;
    let inTripleQuoteBlock = false;
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index]?.trim() ?? "";
        if (trimmed === '"""') {
            inTripleQuoteBlock = !inTripleQuoteBlock;
            continue;
        }
        if (inTripleQuoteBlock || !trimmed.startsWith("chem."))
            continue;
        const command = parseChemCommand(trimmed, index + 1);
        commandByLine.set(index, command);
        hasChem = true;
        if (command.type === "atom") {
            if (entities.has(command.id)) {
                throw new Error(`Duplicate chem.atom "${command.id}" on line ${command.lineNumber}`);
            }
            entities.set(command.id, buildAtomEntity(command));
        }
        else if (command.type === "ring") {
            if (entities.has(command.id)) {
                throw new Error(`Duplicate chem.ring "${command.id}" on line ${command.lineNumber}`);
            }
            entities.set(command.id, buildRingEntity(command));
        }
    }
    if (!hasChem)
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
function parseChemCommand(line, lineNumber) {
    const tokens = tokenizeLine(line);
    if (tokens.length < 2) {
        throw new Error(`Invalid chemistry command on line ${lineNumber}`);
    }
    const commandToken = tokens[0] ?? "";
    const type = commandToken.slice("chem.".length);
    if (!SUPPORTED_COMMANDS.has(type)) {
        throw new Error(`Unsupported chemistry command "${commandToken}" on line ${lineNumber}`);
    }
    const id = tokens[1] ?? "";
    if (!id || id.includes("=")) {
        throw new Error(`Chemistry command "${commandToken}" requires an explicit id on line ${lineNumber}`);
    }
    const props = {};
    for (const token of tokens.slice(2)) {
        const eqIndex = token.indexOf("=");
        if (eqIndex < 1) {
            throw new Error(`Invalid chemistry property "${token}" on line ${lineNumber}`);
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
    const diagramIndex = lines.findIndex((line) => line.trim() === "diagram");
    if (diagramIndex < 0) {
        throw new Error('Chemistry plugin requires a root "diagram" block');
    }
    const layoutIndex = lines.findIndex((line, index) => {
        if (index <= diagramIndex)
            return false;
        return line.trim().startsWith("layout ");
    });
    if (layoutIndex < 0) {
        if (!autoAbsoluteLayout) {
            throw new Error('Chemistry plugin requires "layout absolute"');
        }
        return { insertAfterDiagramIndex: diagramIndex };
    }
    if (lines[layoutIndex]?.trim() !== "layout absolute") {
        throw new Error('Chemistry commands require the root diagram to use "layout absolute"');
    }
    return {};
}
function buildAtomEntity(command) {
    const x = requireNumber(command.props, "x", command.lineNumber);
    const y = requireNumber(command.props, "y", command.lineNumber);
    const hidden = parseBoolean(command.props.hidden) ?? false;
    const explicitLabel = command.props.label;
    const element = command.props.element ?? "C";
    const label = explicitLabel !== undefined ? explicitLabel : `${element}${formatCharge(command.props.charge)}`;
    return {
        kind: "atom",
        id: command.id,
        x,
        y,
        label,
        visible: !hidden && label.length > 0,
        props: command.props,
    };
}
function buildRingEntity(command) {
    const kind = (command.props.kind ?? "").toLowerCase();
    const defaultSides = kind === "pentagon" ? 5 : 6;
    const sides = Math.max(3, Math.round(readNumber(command.props.sides) ?? defaultSides));
    const cx = requireNumber(command.props, "x", command.lineNumber);
    const cy = requireNumber(command.props, "y", command.lineNumber);
    const radius = Math.max(12, readNumber(command.props.radius) ?? 56);
    const rotation = readNumber(command.props.rotation) ?? -90;
    const labels = parseList(command.props.labels);
    const aromatic = parseBoolean(command.props.aromatic) ?? kind === "benzene";
    const order = normalizeBondOrder(command.props.order ?? command.props.bonds ?? (kind === "benzene" && !aromatic ? "alternating" : "1"), command.lineNumber);
    return {
        kind: "ring",
        id: command.id,
        cx,
        cy,
        radius,
        sides,
        rotation,
        aromatic,
        order,
        labels,
        vertices: buildRingVertices(cx, cy, radius, sides, rotation),
        props: command.props,
    };
}
function buildRingVertices(cx, cy, radius, sides, rotation) {
    const vertices = [];
    for (let index = 0; index < sides; index += 1) {
        const angle = ((rotation + (360 / sides) * index) * Math.PI) / 180;
        vertices.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
        });
    }
    return vertices;
}
function emitCommand(command, entities, settings) {
    switch (command.type) {
        case "atom":
            return emitAtom(entities.get(command.id), settings);
        case "bond":
            return emitBond(command, entities, settings);
        case "ring":
            return emitRing(entities.get(command.id), settings);
        case "label":
            return emitLabel(command, entities, settings);
    }
}
function emitAtom(atom, settings) {
    const fontSize = readNumber(atom.props["font-size"]) ?? settings.fontSize;
    const width = Math.max(18, readNumber(atom.props.width) ?? estimateTextWidth(atom.label || "C", fontSize) + 10);
    const height = Math.max(20, readNumber(atom.props.height) ?? Math.round(fontSize * 1.55));
    const x = atom.x - width / 2;
    const y = atom.y - height / 2;
    const items = [];
    const primitives = [];
    if (atom.visible) {
        const bodyId = helperId(atom.id, "body");
        items.push(bodyId);
        primitives.push({
            kind: "text",
            id: bodyId,
            x,
            y,
            width,
            height,
            label: atom.label,
            color: atom.props.color ?? settings.atomColor,
            fontSize: String(fontSize),
            fontWeight: atom.props["font-weight"] ?? "600",
            font: atom.props.font,
            opacity: atom.props.opacity,
            textAlign: atom.props["text-align"] ?? "center",
            theme: atom.props.theme,
        });
    }
    return emitBareCommand(atom.id, primitives, { x: atom.x, y: atom.y, items });
}
function emitBond(command, entities, settings) {
    const fromRef = command.props.from;
    const toRef = command.props.to;
    if (!fromRef || !toRef) {
        throw new Error(`chem.bond "${command.id}" requires from= and to= on line ${command.lineNumber}`);
    }
    const from = resolveChemRef(fromRef, entities, command.lineNumber, settings);
    const to = resolveChemRef(toRef, entities, command.lineNumber, settings);
    const order = normalizeBondOrder(command.props.order ?? command.props.kind ?? "1", command.lineNumber);
    if (order === "alternating") {
        throw new Error(`chem.bond "${command.id}" does not support order=alternating on line ${command.lineNumber}`);
    }
    const stroke = command.props.stroke ?? settings.bondStroke;
    const strokeWidth = String(readNumber(command.props["stroke-width"]) ?? settings.bondStrokeWidth);
    const spacing = readNumber(command.props.spacing) ?? settings.bondSpacing;
    const trimmed = trimSegment(from, to);
    const primitives = createBondPrimitives(command.id, trimmed.from, trimmed.to, order, spacing, {
        stroke,
        strokeWidth,
        dash: command.props.dash,
        opacity: command.props.opacity,
        theme: command.props.theme,
    });
    if (command.props.label) {
        const labelId = helperId(command.id, "label");
        const labelPoint = bondLabelPoint(trimmed.from, trimmed.to, spacing, settings.labelOffset);
        const fontSize = readNumber(command.props["font-size"]) ?? settings.fontSize - 4;
        const width = Math.max(40, estimateTextWidth(command.props.label, fontSize) + 12);
        const height = Math.max(20, Math.round(fontSize * 1.45));
        primitives.push({
            kind: "text",
            id: labelId,
            x: labelPoint.x - width / 2,
            y: labelPoint.y - height / 2,
            width,
            height,
            label: command.props.label,
            color: command.props.color ?? settings.labelColor,
            fontSize: String(fontSize),
            fontWeight: command.props["font-weight"],
            font: command.props.font,
            opacity: command.props.opacity,
            textAlign: "center",
            theme: command.props.theme,
        });
    }
    return emitBareCommand(command.id, primitives, { x: trimmed.from.x, y: trimmed.from.y });
}
function emitRing(ring, settings) {
    const primitives = [];
    const stroke = ring.props.stroke ?? settings.bondStroke;
    const strokeWidth = String(readNumber(ring.props["stroke-width"]) ?? settings.bondStrokeWidth);
    const spacing = readNumber(ring.props.spacing) ?? settings.bondSpacing;
    const orderMode = ring.order;
    for (let index = 0; index < ring.vertices.length; index += 1) {
        const from = ring.vertices[index];
        const to = ring.vertices[(index + 1) % ring.vertices.length];
        const order = orderMode === "alternating" ? (index % 2 === 0 ? 2 : 1) : orderMode;
        primitives.push(...createBondPrimitives(`${ring.id}_${index + 1}`, from, to, order, spacing, {
            stroke,
            strokeWidth,
            dash: ring.props.dash,
            opacity: ring.props.opacity,
            theme: ring.props.theme,
        }));
    }
    if (ring.aromatic) {
        const aromaticRadius = Math.max(8, ring.radius * settings.aromaticRadiusRatio);
        primitives.push({
            kind: "path",
            id: helperId(ring.id, "aromatic"),
            x: ring.cx - aromaticRadius,
            y: ring.cy - aromaticRadius,
            width: aromaticRadius * 2,
            height: aromaticRadius * 2,
            pathData: circlePath(aromaticRadius),
            stroke,
            strokeWidth,
            fill: "none",
            opacity: ring.props.opacity,
            dash: ring.props["aromatic-dash"] ?? ring.props.dash,
            theme: ring.props.theme,
        });
    }
    if (ring.labels.length > 0) {
        for (let index = 0; index < ring.vertices.length; index += 1) {
            const label = ring.labels[index] ?? "";
            if (!label)
                continue;
            const vertex = ring.vertices[index];
            const direction = normalizeVector({
                x: vertex.x - ring.cx,
                y: vertex.y - ring.cy,
            });
            const labelPoint = {
                x: vertex.x + direction.x * settings.ringLabelOffset,
                y: vertex.y + direction.y * settings.ringLabelOffset,
            };
            const fontSize = readNumber(ring.props["font-size"]) ?? settings.fontSize;
            const width = Math.max(18, estimateTextWidth(label, fontSize) + 10);
            const height = Math.max(20, Math.round(fontSize * 1.55));
            primitives.push({
                kind: "text",
                id: helperId(ring.id, `label_${index + 1}`),
                x: labelPoint.x - width / 2,
                y: labelPoint.y - height / 2,
                width,
                height,
                label,
                color: ring.props.color ?? settings.atomColor,
                fontSize: String(fontSize),
                fontWeight: ring.props["font-weight"] ?? "600",
                font: ring.props.font,
                opacity: ring.props.opacity,
                textAlign: "center",
                theme: ring.props.theme,
            });
        }
    }
    return emitBareCommand(ring.id, primitives, { x: ring.cx, y: ring.cy });
}
function emitLabel(command, entities, settings) {
    const label = command.props.text ?? command.props.label;
    if (!label) {
        throw new Error(`chem.label "${command.id}" requires text= or label= on line ${command.lineNumber}`);
    }
    let point;
    if (command.props.target) {
        point = resolveChemRef(command.props.target, entities, command.lineNumber, settings).point;
    }
    else {
        point = {
            x: requireNumber(command.props, "x", command.lineNumber),
            y: requireNumber(command.props, "y", command.lineNumber),
        };
    }
    const side = normalizeLabelSide(command.props.side);
    const offset = readNumber(command.props.offset) ?? settings.labelOffset;
    const dx = readNumber(command.props.dx) ?? 0;
    const dy = readNumber(command.props.dy) ?? 0;
    const fontSize = readNumber(command.props["font-size"]) ?? settings.fontSize - 4;
    const width = Math.max(36, readNumber(command.props.width) ?? estimateTextWidth(label, fontSize) + 14);
    const height = Math.max(20, readNumber(command.props.height) ?? Math.round(fontSize * 1.45));
    const labelPoint = positionLabel(point, side, offset, width, height, dx, dy);
    return emitBareCommand(command.id, [
        {
            kind: "text",
            id: helperId(command.id, "body"),
            x: labelPoint.x,
            y: labelPoint.y,
            width,
            height,
            label,
            color: command.props.color ?? settings.labelColor,
            fontSize: String(fontSize),
            fontWeight: command.props["font-weight"],
            font: command.props.font,
            opacity: command.props.opacity,
            textAlign: side === "left" ? "right" : side === "right" ? "left" : "center",
            theme: command.props.theme,
        },
    ], point);
}
function resolveChemRef(ref, entities, lineNumber, settings) {
    const direct = entities.get(ref);
    if (direct) {
        if (direct.kind === "atom") {
            return {
                point: { x: direct.x, y: direct.y },
                trimInset: direct.visible ? settings.atomInset : 0,
            };
        }
        return {
            point: { x: direct.cx, y: direct.cy },
            trimInset: 0,
        };
    }
    const dot = ref.lastIndexOf(".");
    if (dot > 0) {
        const base = ref.slice(0, dot);
        const part = ref.slice(dot + 1);
        const entity = entities.get(base);
        if (entity?.kind === "ring") {
            if (part === "center") {
                return { point: { x: entity.cx, y: entity.cy }, trimInset: 0 };
            }
            const match = /^v(\d+)$/.exec(part);
            if (match) {
                const index = Number(match[1]) - 1;
                const vertex = entity.vertices[index];
                if (!vertex) {
                    throw new Error(`Unknown ring vertex "${part}" on "${base}" on line ${lineNumber}`);
                }
                return { point: vertex, trimInset: 0 };
            }
        }
        if (entity?.kind === "atom" && part === "center") {
            return {
                point: { x: entity.x, y: entity.y },
                trimInset: entity.visible ? settings.atomInset : 0,
            };
        }
    }
    throw new Error(`Unknown chemistry reference "${ref}" on line ${lineNumber}`);
}
function normalizeBondOrder(value, lineNumber) {
    switch ((value ?? "1").toLowerCase()) {
        case "1":
        case "single":
            return 1;
        case "2":
        case "double":
            return 2;
        case "3":
        case "triple":
            return 3;
        case "alternating":
            return "alternating";
        default:
            throw new Error(`Unsupported bond order "${value}" on line ${lineNumber}`);
    }
}
function normalizeLabelSide(value) {
    switch ((value ?? "top").toLowerCase()) {
        case "top":
        case "right":
        case "bottom":
        case "left":
        case "center":
            return value?.toLowerCase() ?? "top";
        default:
            return "top";
    }
}
function createBondPrimitives(baseId, from, to, order, spacing, style) {
    const direction = { x: to.x - from.x, y: to.y - from.y };
    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) {
        throw new Error("Bond endpoints cannot be identical");
    }
    const perp = {
        x: -direction.y / length,
        y: direction.x / length,
    };
    const offsets = order === 1
        ? [0]
        : order === 2
            ? [-spacing / 2, spacing / 2]
            : [-spacing, 0, spacing];
    return offsets.map((offset, index) => segmentPrimitive(helperId(baseId, `seg_${index + 1}`), shiftPoint(from, perp, offset), shiftPoint(to, perp, offset), style));
}
function segmentPrimitive(id, from, to, style) {
    const bounds = {
        minX: Math.min(from.x, to.x),
        minY: Math.min(from.y, to.y),
        maxX: Math.max(from.x, to.x),
        maxY: Math.max(from.y, to.y),
    };
    const localFrom = {
        x: from.x - bounds.minX,
        y: from.y - bounds.minY,
    };
    const localTo = {
        x: to.x - bounds.minX,
        y: to.y - bounds.minY,
    };
    return {
        kind: "path",
        id,
        x: bounds.minX,
        y: bounds.minY,
        width: Math.max(1, bounds.maxX - bounds.minX),
        height: Math.max(1, bounds.maxY - bounds.minY),
        pathData: `M ${formatNumber(localFrom.x)} ${formatNumber(localFrom.y)} L ${formatNumber(localTo.x)} ${formatNumber(localTo.y)}`,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        fill: "none",
        opacity: style.opacity,
        dash: style.dash,
        theme: style.theme,
    };
}
function trimSegment(from, to) {
    const dx = to.point.x - from.point.x;
    const dy = to.point.y - from.point.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
        return { from: from.point, to: to.point };
    }
    const totalInset = from.trimInset + to.trimInset;
    if (totalInset + 2 >= length) {
        return { from: from.point, to: to.point };
    }
    const ux = dx / length;
    const uy = dy / length;
    return {
        from: {
            x: from.point.x + ux * from.trimInset,
            y: from.point.y + uy * from.trimInset,
        },
        to: {
            x: to.point.x - ux * to.trimInset,
            y: to.point.y - uy * to.trimInset,
        },
    };
}
function bondLabelPoint(from, to, spacing, offset) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
        return from;
    }
    return {
        x: (from.x + to.x) / 2 + (-dy / length) * (offset + spacing / 2),
        y: (from.y + to.y) / 2 + (dx / length) * (offset + spacing / 2),
    };
}
function positionLabel(point, side, offset, width, height, dx, dy) {
    switch (side) {
        case "left":
            return { x: point.x - width - offset + dx, y: point.y - height / 2 + dy };
        case "right":
            return { x: point.x + offset + dx, y: point.y - height / 2 + dy };
        case "bottom":
            return { x: point.x - width / 2 + dx, y: point.y + offset + dy };
        case "center":
            return { x: point.x - width / 2 + dx, y: point.y - height / 2 + dy };
        case "top":
        default:
            return { x: point.x - width / 2 + dx, y: point.y - height - offset + dy };
    }
}
function emitBareCommand(id, primitives, fallback) {
    const items = fallback.items ?? primitives.map((primitive) => primitive.id);
    if (primitives.length === 0) {
        return [emitBareGroup(id, fallback.x, fallback.y, 1, 1, items)];
    }
    const bounds = primitiveBounds(primitives);
    const output = primitives.map((primitive) => emitPrimitive(primitive, bounds.minX, bounds.minY));
    output.push(emitBareGroup(id, bounds.minX, bounds.minY, Math.max(1, bounds.maxX - bounds.minX), Math.max(1, bounds.maxY - bounds.minY), items));
    return output;
}
function emitPrimitive(primitive, offsetX, offsetY) {
    if (primitive.kind === "path") {
        const parts = ["path", primitive.id];
        appendProp(parts, "label", "");
        appendProp(parts, "x", String(Math.round(primitive.x - offsetX)));
        appendProp(parts, "y", String(Math.round(primitive.y - offsetY)));
        appendProp(parts, "width", String(Math.max(1, Math.round(primitive.width))));
        appendProp(parts, "height", String(Math.max(1, Math.round(primitive.height))));
        appendProp(parts, "value", primitive.pathData);
        appendProp(parts, "fill", primitive.fill);
        appendProp(parts, "stroke", primitive.stroke);
        appendProp(parts, "stroke-width", primitive.strokeWidth);
        appendProp(parts, "opacity", primitive.opacity);
        appendProp(parts, "dash", primitive.dash);
        appendProp(parts, "theme", primitive.theme);
        return parts.join(" ");
    }
    const parts = ["text", primitive.id];
    appendProp(parts, "label", primitive.label);
    appendProp(parts, "x", String(Math.round(primitive.x - offsetX)));
    appendProp(parts, "y", String(Math.round(primitive.y - offsetY)));
    appendProp(parts, "width", String(Math.max(1, Math.round(primitive.width))));
    appendProp(parts, "height", String(Math.max(1, Math.round(primitive.height))));
    appendProp(parts, "color", primitive.color);
    appendProp(parts, "font-size", primitive.fontSize);
    appendProp(parts, "font-weight", primitive.fontWeight);
    appendProp(parts, "font", primitive.font);
    appendProp(parts, "opacity", primitive.opacity);
    appendProp(parts, "text-align", primitive.textAlign ?? "center");
    appendProp(parts, "theme", primitive.theme);
    return parts.join(" ");
}
function emitBareGroup(id, x, y, width, height, items) {
    const parts = ["bare", id];
    appendProp(parts, "layout", "absolute");
    appendProp(parts, "padding", "0");
    appendProp(parts, "gap", "0");
    appendProp(parts, "x", String(Math.round(x)));
    appendProp(parts, "y", String(Math.round(y)));
    appendProp(parts, "width", String(Math.max(1, Math.round(width))));
    appendProp(parts, "height", String(Math.max(1, Math.round(height))));
    appendProp(parts, "items", `[${items.join(",")}]`);
    return parts.join(" ");
}
function primitiveBounds(primitives) {
    return primitives.reduce((bounds, primitive) => ({
        minX: Math.min(bounds.minX, primitive.x),
        minY: Math.min(bounds.minY, primitive.y),
        maxX: Math.max(bounds.maxX, primitive.x + primitive.width),
        maxY: Math.max(bounds.maxY, primitive.y + primitive.height),
    }), {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    });
}
function circlePath(radius) {
    const r = formatNumber(radius);
    return `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${formatNumber(radius * 2)} A ${r} ${r} 0 1 1 ${r} 0`;
}
function normalizeVector(point) {
    const length = Math.hypot(point.x, point.y);
    if (length === 0)
        return { x: 0, y: -1 };
    return { x: point.x / length, y: point.y / length };
}
function shiftPoint(point, direction, amount) {
    return {
        x: point.x + direction.x * amount,
        y: point.y + direction.y * amount,
    };
}
function parseList(value) {
    if (!value)
        return [];
    const trimmed = value.trim();
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]"))
        return [trimmed];
    const content = trimmed.slice(1, -1);
    const result = [];
    let current = "";
    let inQuote = false;
    for (let index = 0; index < content.length; index += 1) {
        const ch = content[index] ?? "";
        if (ch === '"' && content[index - 1] !== "\\") {
            inQuote = !inQuote;
            continue;
        }
        if (ch === "," && !inQuote) {
            result.push(stripWrapping(current.trim()));
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.length > 0 || content.endsWith(",")) {
        result.push(stripWrapping(current.trim()));
    }
    return result;
}
function formatCharge(value) {
    if (!value)
        return "";
    const trimmed = value.trim();
    if (trimmed === "+" || trimmed === "-")
        return trimmed;
    if (/^\d+[+-]$/.test(trimmed))
        return trimmed;
    if (/^[+-]\d+$/.test(trimmed)) {
        return `${trimmed.slice(1)}${trimmed[0]}`;
    }
    return trimmed;
}
function parseBoolean(value) {
    if (value === undefined)
        return undefined;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    return undefined;
}
function estimateTextWidth(text, fontSize) {
    return Math.max(8, Math.round(text.length * fontSize * 0.62));
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
        throw new Error(`Chemistry command requires ${key}=<number> on line ${lineNumber}`);
    }
    return value;
}
function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
function helperId(baseId, suffix) {
    return `__chem_${baseId.replace(/[^A-Za-z0-9_-]/g, "_")}_${suffix}`;
}
//# sourceMappingURL=index.js.map