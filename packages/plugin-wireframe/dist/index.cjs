'use strict';

const SUPPORTED_COMMANDS = new Set([
    "screen",
    "panel",
    "text",
    "media",
    "control",
    "divider",
]);
const DEFAULTS = {
    surfaceFill: "#f7f0e3",
    surfaceStroke: "#8b7156",
    controlFill: "#fcf8ef",
    mutedTextColor: "#6d5844",
    placeholderStroke: "#7b6a58",
    screenGap: 16,
    screenPadding: 20,
    panelGap: 12,
    panelPadding: 16,
    textGap: 8,
    choiceGap: 12,
};
const TEXT_KIND_DEFAULTS = {
    heading: { width: 280, lines: 2, fontSize: 24, fontWeight: 700 },
    body: { width: 260, lines: 3, fontSize: 14, fontWeight: 400 },
    caption: { width: 160, lines: 1, fontSize: 12, fontWeight: 400 },
    label: { width: 120, lines: 1, fontSize: 12, fontWeight: 600 },
};
const TEXT_PLACEHOLDER_RATIOS = {
    heading: [1, 0.72, 0.58],
    body: [1, 0.93, 0.78, 0.62],
    caption: [0.76, 0.58],
    label: [0.54, 0.42],
};
const GROUP_PROP_KEYS = [
    "layout",
    "gap",
    "padding",
    "columns",
    "align",
    "justify",
    "theme",
    "fill",
    "stroke",
    "stroke-width",
    "opacity",
    "x",
    "y",
    "width",
    "height",
    "items",
];
const TEXT_PROP_KEYS = [
    "theme",
    "opacity",
    "font",
    "letter-spacing",
    "padding",
    "vertical-align",
    "line-height",
    "x",
    "y",
    "height",
];
const NODE_PROP_KEYS = [
    "theme",
    "color",
    "opacity",
    "font-size",
    "font-weight",
    "font",
    "letter-spacing",
    "padding",
    "text-align",
    "vertical-align",
    "line-height",
    "x",
    "y",
    "deg",
];
function wireframe(options = {}) {
    return {
        name: "wireframe",
        preprocess(source) {
            return compileWireframe(source, options);
        },
    };
}
function compileWireframe(source, options = {}) {
    const settings = { ...DEFAULTS, ...options };
    const lines = source.split(/\r?\n/);
    const commandByLine = new Map();
    let hasWireframe = false;
    let inTripleQuoteBlock = false;
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index]?.trim() ?? "";
        if (trimmed === '"""') {
            inTripleQuoteBlock = !inTripleQuoteBlock;
            continue;
        }
        if (inTripleQuoteBlock || !trimmed.startsWith("wf."))
            continue;
        commandByLine.set(index, parseWireframeCommand(trimmed, index + 1));
        hasWireframe = true;
    }
    if (!hasWireframe)
        return source;
    const output = [];
    for (let index = 0; index < lines.length; index += 1) {
        const command = commandByLine.get(index);
        if (!command) {
            output.push(lines[index] ?? "");
            continue;
        }
        output.push(...emitCommand(command, settings));
    }
    return output.join("\n");
}
function parseWireframeCommand(line, lineNumber) {
    const tokens = tokenizeLine(line);
    if (tokens.length < 2) {
        throw new Error(`Invalid wireframe command on line ${lineNumber}`);
    }
    const commandToken = tokens[0] ?? "";
    const type = commandToken.slice("wf.".length);
    if (!SUPPORTED_COMMANDS.has(type)) {
        throw new Error(`Unsupported wireframe command "${commandToken}" on line ${lineNumber}`);
    }
    const id = tokens[1] ?? "";
    if (!id || id.includes("=")) {
        throw new Error(`Wireframe command "${commandToken}" requires an explicit id on line ${lineNumber}`);
    }
    const props = {};
    for (const token of tokens.slice(2)) {
        const eqIndex = token.indexOf("=");
        if (eqIndex < 1) {
            throw new Error(`Invalid wireframe property "${token}" on line ${lineNumber}`);
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
function emitCommand(command, settings) {
    switch (command.type) {
        case "screen":
            return [emitScreen(command, settings)];
        case "panel":
            return [emitPanel(command, settings)];
        case "text":
            return emitText(command, settings);
        case "media":
            return [emitMedia(command, settings)];
        case "control":
            return emitControl(command, settings);
        case "divider":
            return [emitDivider(command, settings)];
    }
}
function emitScreen(command, settings) {
    const frame = normalizeScreenFrame(command.props.frame ?? "browser", command.lineNumber);
    const props = {
        layout: command.props.layout ?? "column",
        gap: command.props.gap ?? String(settings.screenGap),
        padding: command.props.padding ?? String(settings.screenPadding),
        width: command.props.width ?? String(defaultScreenWidth(frame)),
        height: command.props.height ?? String(defaultScreenHeight(frame)),
        fill: command.props.fill ?? settings.surfaceFill,
        stroke: command.props.stroke ?? settings.surfaceStroke,
        "stroke-width": command.props["stroke-width"] ?? "2",
    };
    copyPropsToObject(command.props, props, GROUP_PROP_KEYS);
    const parts = ["group", command.id];
    if (command.props.label)
        appendProp(parts, "label", command.props.label);
    appendKnownProps(parts, props, GROUP_PROP_KEYS);
    return parts.join(" ");
}
function emitPanel(command, settings) {
    const props = {
        layout: command.props.layout ?? "column",
        gap: command.props.gap ?? String(settings.panelGap),
        padding: command.props.padding ?? String(settings.panelPadding),
        width: command.props.width ?? "280",
        height: command.props.height ?? "180",
        fill: command.props.fill ?? settings.surfaceFill,
        stroke: command.props.stroke ?? settings.surfaceStroke,
        "stroke-width": command.props["stroke-width"] ?? "1.5",
    };
    copyPropsToObject(command.props, props, GROUP_PROP_KEYS);
    const parts = ["group", command.id];
    if (command.props.label)
        appendProp(parts, "label", command.props.label);
    appendKnownProps(parts, props, GROUP_PROP_KEYS);
    return parts.join(" ");
}
function emitText(command, settings) {
    const kind = normalizeTextKind(command.props.kind ?? "body", command.lineNumber);
    const defaults = TEXT_KIND_DEFAULTS[kind];
    if (command.props.label) {
        const parts = ["text", command.id];
        appendProp(parts, "label", command.props.label);
        appendProp(parts, "width", command.props.width ?? String(defaults.width));
        appendProp(parts, "font-size", command.props["font-size"] ?? String(defaults.fontSize));
        appendProp(parts, "font-weight", command.props["font-weight"] ?? String(defaults.fontWeight));
        appendProp(parts, "text-align", command.props["text-align"] ?? "left");
        appendProp(parts, "color", command.props.color ?? (kind === "caption" || kind === "label" ? settings.mutedTextColor : undefined));
        copyPropsToArray(command.props, parts, TEXT_PROP_KEYS);
        return [parts.join(" ")];
    }
    const width = readNumber(command.props.width) ?? defaults.width;
    const lineCount = Math.max(1, Math.round(readNumber(command.props.lines) ?? defaults.lines));
    const ratios = buildPlaceholderRatios(kind, lineCount);
    const gap = readNumber(command.props.gap) ?? settings.textGap;
    const stroke = command.props.stroke ?? command.props.color ?? settings.placeholderStroke;
    const opacity = command.props.opacity ?? "0.92";
    const lineIds = [];
    const output = [];
    for (let index = 0; index < lineCount; index += 1) {
        const lineId = helperId(command.id, `line${index + 1}`);
        const lineWidth = Math.max(36, Math.round(width * (ratios[index] ?? 0.7)));
        lineIds.push(lineId);
        const parts = ["line", lineId];
        appendProp(parts, "width", String(lineWidth));
        appendProp(parts, "stroke", stroke);
        appendProp(parts, "opacity", opacity);
        output.push(parts.join(" "));
    }
    const groupParts = ["bare", command.id];
    appendProp(groupParts, "layout", "column");
    appendProp(groupParts, "align", "start");
    appendProp(groupParts, "gap", String(gap));
    appendProp(groupParts, "items", `[${lineIds.join(",")}]`);
    copyPropsToArray(command.props, groupParts, ["x", "y"]);
    output.push(groupParts.join(" "));
    return output;
}
function emitMedia(command, settings) {
    const kind = normalizeMediaKind(command.props.kind ?? "image", command.lineNumber);
    const parts = [kind === "avatar" ? "circle" : "box", command.id];
    if (kind === "image") {
        appendProp(parts, "label", command.props.label ?? "Image");
        appendProp(parts, "width", command.props.width ?? "220");
        appendProp(parts, "height", command.props.height ?? "140");
    }
    else {
        const size = command.props.size ?? command.props.width ?? "48";
        appendProp(parts, "label", command.props.label ?? "");
        appendProp(parts, "width", size);
        appendProp(parts, "height", command.props.height ?? size);
    }
    appendProp(parts, "fill", command.props.fill ?? settings.controlFill);
    appendProp(parts, "stroke", command.props.stroke ?? settings.surfaceStroke);
    copyPropsToArray(command.props, parts, NODE_PROP_KEYS);
    return parts.join(" ");
}
function emitControl(command, settings) {
    const kind = normalizeControlKind(command.props.kind ?? "button", command.lineNumber);
    if (kind === "checkbox" || kind === "radio") {
        return emitChoiceControl(command, kind, settings);
    }
    const parts = ["box", command.id];
    appendProp(parts, "label", controlLabel(command, kind));
    appendProp(parts, "width", controlWidth(command, kind));
    appendProp(parts, "height", controlHeight(command, kind));
    appendProp(parts, "fill", command.props.fill ?? settings.controlFill);
    appendProp(parts, "stroke", command.props.stroke ?? settings.surfaceStroke);
    if (kind === "button") {
        appendProp(parts, "font-weight", command.props["font-weight"] ?? "600");
    }
    else {
        appendProp(parts, "text-align", command.props["text-align"] ?? "left");
        appendProp(parts, "padding", command.props.padding ?? "12");
        appendProp(parts, "color", command.props.color ?? settings.mutedTextColor);
        if (kind === "textarea") {
            appendProp(parts, "vertical-align", command.props["vertical-align"] ?? "top");
        }
    }
    copyPropsToArray(command.props, parts, NODE_PROP_KEYS);
    return [parts.join(" ")];
}
function emitChoiceControl(command, kind, settings) {
    const markerId = helperId(command.id, "marker");
    const labelId = helperId(command.id, "label");
    const markerParts = [kind === "checkbox" ? "box" : "circle", markerId];
    const labelParts = ["text", labelId];
    const groupParts = ["bare", command.id];
    const size = command.props.size ?? "18";
    const labelFontSize = command.props["font-size"] ?? "14";
    const labelHeight = String(Math.max(readNumber(size) ?? 18, Math.round((readNumber(labelFontSize) ?? 14) * 1.2)));
    appendProp(markerParts, "label", command.props.checked === "true" ? "x" : "");
    appendProp(markerParts, "width", size);
    appendProp(markerParts, "height", size);
    appendProp(markerParts, "fill", command.props.fill ?? settings.controlFill);
    appendProp(markerParts, "stroke", command.props.stroke ?? settings.surfaceStroke);
    appendProp(markerParts, "font-size", "11");
    const label = command.props.label ?? "Option";
    appendProp(labelParts, "label", label);
    appendProp(labelParts, "width", command.props["text-width"] ?? compactChoiceLabelWidth(label, command.props));
    appendProp(labelParts, "height", labelHeight);
    appendProp(labelParts, "font-size", labelFontSize);
    appendProp(labelParts, "text-align", "left");
    appendProp(labelParts, "vertical-align", "middle");
    appendProp(labelParts, "color", command.props.color ?? settings.mutedTextColor);
    appendProp(groupParts, "layout", "row");
    appendProp(groupParts, "align", "start");
    appendProp(groupParts, "gap", command.props.gap ?? String(settings.choiceGap));
    appendProp(groupParts, "items", `[${markerId},${labelId}]`);
    copyPropsToArray(command.props, groupParts, ["x", "y"]);
    return [markerParts.join(" "), labelParts.join(" "), groupParts.join(" ")];
}
function emitDivider(command, settings) {
    const orientation = command.props.orientation ?? "horizontal";
    if (orientation !== "horizontal" && orientation !== "vertical") {
        throw new Error(`Unsupported wf.divider orientation "${orientation}" on line ${command.lineNumber}`);
    }
    const parts = ["line", command.id];
    appendProp(parts, "label", command.props.label ?? "");
    appendProp(parts, "width", command.props.width ?? command.props.length ?? "240");
    appendProp(parts, "stroke", command.props.stroke ?? settings.placeholderStroke);
    appendProp(parts, "opacity", command.props.opacity ?? "0.75");
    if (orientation === "vertical") {
        appendProp(parts, "deg", command.props.deg ?? "90");
    }
    copyPropsToArray(command.props, parts, NODE_PROP_KEYS);
    return parts.join(" ");
}
function copyPropsToObject(source, target, keys) {
    for (const key of keys) {
        if (source[key] !== undefined)
            target[key] = source[key];
    }
}
function copyPropsToArray(source, target, keys) {
    for (const key of keys) {
        if (source[key] !== undefined)
            appendProp(target, key, source[key]);
    }
}
function appendKnownProps(parts, props, keys) {
    for (const key of keys) {
        if (props[key] !== undefined)
            appendProp(parts, key, props[key]);
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
function compactChoiceLabelWidth(label, props) {
    const fontSize = readNumber(props["font-size"]) ?? 14;
    const estimatedWidth = Math.round(label.length * fontSize * 0.58 + 12);
    return String(Math.min(160, Math.max(48, estimatedWidth)));
}
function defaultScreenWidth(frame) {
    switch (frame) {
        case "browser":
            return 960;
        case "phone":
            return 390;
        case "plain":
            return 360;
    }
}
function defaultScreenHeight(frame) {
    switch (frame) {
        case "browser":
            return 640;
        case "phone":
            return 844;
        case "plain":
            return 640;
    }
}
function buildPlaceholderRatios(kind, lineCount) {
    const seed = TEXT_PLACEHOLDER_RATIOS[kind];
    return Array.from({ length: lineCount }, (_, index) => {
        if (index < seed.length)
            return seed[index];
        return Math.max(0.38, 0.72 - index * 0.08);
    });
}
function controlLabel(command, kind) {
    if (kind === "button")
        return command.props.label ?? "Button";
    if (kind === "textarea") {
        return command.props.placeholder ?? command.props.label ?? "Write something";
    }
    if (kind === "select") {
        const base = command.props.placeholder ?? command.props.label ?? "Select";
        return `${base} v`;
    }
    return command.props.placeholder ?? command.props.label ?? "Input";
}
function controlWidth(command, kind) {
    if (command.props.width)
        return command.props.width;
    switch (kind) {
        case "button":
            return "120";
        case "input":
            return "240";
        case "textarea":
            return "280";
        case "select":
            return "220";
    }
}
function controlHeight(command, kind) {
    if (command.props.height)
        return command.props.height;
    return kind === "textarea" ? "96" : "44";
}
function normalizeTextKind(value, lineNumber) {
    if (value === "heading" || value === "body" || value === "caption" || value === "label") {
        return value;
    }
    throw new Error(`Unsupported wf.text kind "${value}" on line ${lineNumber}`);
}
function normalizeMediaKind(value, lineNumber) {
    if (value === "image" || value === "avatar" || value === "icon") {
        return value;
    }
    throw new Error(`Unsupported wf.media kind "${value}" on line ${lineNumber}`);
}
function normalizeControlKind(value, lineNumber) {
    if (value === "button" ||
        value === "input" ||
        value === "textarea" ||
        value === "select" ||
        value === "checkbox" ||
        value === "radio") {
        return value;
    }
    throw new Error(`Unsupported wf.control kind "${value}" on line ${lineNumber}`);
}
function normalizeScreenFrame(value, lineNumber) {
    if (value === "browser" || value === "phone" || value === "plain") {
        return value;
    }
    throw new Error(`Unsupported wf.screen frame "${value}" on line ${lineNumber}`);
}
function helperId(baseId, suffix) {
    return `__wf_${baseId.replace(/[^A-Za-z0-9_-]/g, "_")}_${suffix}`;
}

exports.compileWireframe = compileWireframe;
exports.wireframe = wireframe;
//# sourceMappingURL=index.cjs.map
