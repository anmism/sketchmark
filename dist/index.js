// ============================================================
// sketchmark — Tokenizer
// ============================================================
const KEYWORDS = new Set([
    "diagram",
    "end",
    "direction",
    "layout",
    "title",
    "description",
    "box",
    "circle",
    "diamond",
    "hexagon",
    "triangle",
    "cylinder",
    "parallelogram",
    "text",
    "image",
    "icon",
    "line",
    "path",
    "group",
    "style",
    "step",
    "config",
    "theme",
    "bare",
    "bar-chart",
    "line-chart",
    "pie-chart",
    "donut-chart",
    "scatter-chart",
    "area-chart",
    "table",
    "align",
    "valign",
    "gap",
    "padding",
    "margin",
    "highlight",
    "fade",
    "unfade",
    "draw",
    "erase",
    "show",
    "hide",
    "pulse",
    "move",
    "scale",
    "rotate",
    "color",
    "after-previous",
    "with-previous",
    "on-click",
    "auto",
    "LR",
    "TB",
    "RL",
    "BT",
    "row",
    "column",
    "grid",
    "layer",
    "dag",
    "tree",
    "force",
    "markdown",
    "narrate",
    "pace",
    "slow",
    "fast",
    "pause",
    "beat",
    "underline",
    "crossout",
    "bracket",
    "tick",
    "strikeoff",
]);
const ARROW_PATTERNS = ["<-->", "<->", "-->", "<--", "->", "<-", "---", "--"];
// Characters that can start an arrow pattern — used to decide whether a '-'
// inside an identifier is part of a kebab-case name or the start of an arrow.
const ARROW_START_AFTER_DASH = new Set([">", "-", "."]);
function tokenize$1(src) {
    const tokens = [];
    let i = 0, line = 1, lineStart = 0;
    const col = () => i - lineStart + 1;
    const peek = (offset = 0) => src[i + offset] ?? "";
    const add = (type, value) => tokens.push({ type, value, line, col: col() - value.length });
    while (i < src.length) {
        const ch = src[i];
        // Skip comments
        if (ch === "#" || (ch === "/" && peek(1) === "/")) {
            while (i < src.length && src[i] !== "\n")
                i++;
            continue;
        }
        // Newlines
        if (ch === "\n") {
            add("NEWLINE", "\n");
            line++;
            lineStart = i + 1;
            i++;
            continue;
        }
        // Carriage return
        if (ch === "\r") {
            i++;
            continue;
        }
        // Whitespace (not newline)
        if (/[ \t]/.test(ch)) {
            i++;
            continue;
        }
        if (ch === '"' && peek(1) === '"' && peek(2) === '"') {
            i += 3; // skip opening """
            let raw = "";
            while (i < src.length) {
                if (src[i] === '"' && src[i + 1] === '"' && src[i + 2] === '"') {
                    i += 3; // skip closing """
                    break;
                }
                if (src[i] === "\n") {
                    line++;
                    lineStart = i + 1;
                }
                raw += src[i++];
            }
            add("STRING_BLOCK", raw);
            continue;
        }
        // Strings
        if (ch === '"' || ch === "'") {
            const q = ch;
            let val = "";
            i++;
            while (i < src.length && src[i] !== q) {
                if (src[i] === "\\") {
                    i++;
                    const esc = src[i] ?? "";
                    if (esc === "n")
                        val += "\n";
                    else if (esc === "t")
                        val += "\t";
                    else if (esc === "r")
                        val += "\r";
                    else if (esc === "\\")
                        val += "\\";
                    else if (esc === q)
                        val += q;
                    else if (esc)
                        val += `\\${esc}`;
                    else
                        val += "\\";
                }
                else
                    val += src[i];
                i++;
            }
            i++; // closing quote
            add("STRING", val);
            continue;
        }
        // Numbers
        if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(peek(1)))) {
            let num = "";
            if (ch === "-") {
                num = "-";
                i++;
            }
            while (i < src.length && /[0-9.]/.test(src[i]))
                num += src[i++];
            add("NUMBER", num);
            continue;
        }
        // Arrows — check longest match first
        let matchedArrow = "";
        for (const pat of ARROW_PATTERNS) {
            if (src.startsWith(pat, i)) {
                matchedArrow = pat;
                break;
            }
        }
        if (matchedArrow) {
            add("ARROW", matchedArrow);
            i += matchedArrow.length;
            continue;
        }
        // Brackets/punctuation
        const punct = {
            "{": "LBRACE",
            "}": "RBRACE",
            "[": "LBRACKET",
            "]": "RBRACKET",
            "(": "LPAREN",
            ")": "RPAREN",
            "=": "EQUALS",
            ",": "COMMA",
            ":": "COLON",
            ".": "DOT",
            "*": "STAR",
        };
        if (ch in punct) {
            add(punct[ch], ch);
            i++;
            continue;
        }
        // Identifiers & keywords
        // Hyphens are allowed inside identifiers for kebab-case (e.g. "api-gateway"),
        // BUT a hyphen that starts an arrow pattern ("->" / "-->" / "---") must NOT
        // be consumed as part of the identifier — it belongs to the next token.
        if (/[a-zA-Z_]/.test(ch)) {
            let id = "";
            while (i < src.length && /[a-zA-Z0-9_-]/.test(src[i])) {
                // Stop before consuming a '-' that begins an arrow pattern.
                // e.g. in "client->gateway": stop at '-' so '->' is lexed as ARROW.
                if (src[i] === "-" && ARROW_START_AFTER_DASH.has(src[i + 1] ?? ""))
                    break;
                id += src[i++];
            }
            add(KEYWORDS.has(id) ? "KEYWORD" : "IDENT", id);
            continue;
        }
        add("UNKNOWN", ch);
        i++;
    }
    add("EOF", "");
    return tokens;
}

function pluginMessage(plugin, stage, error) {
    const detail = error instanceof Error ? error.message : String(error);
    return `Plugin "${plugin.name}" ${stage} failed: ${detail}`;
}
function applyPluginPreprocessors(source, plugins = []) {
    let nextSource = source;
    for (const plugin of plugins) {
        if (!plugin.preprocess)
            continue;
        try {
            const transformed = plugin.preprocess(nextSource);
            if (typeof transformed !== "string") {
                throw new Error("preprocess must return a string");
            }
            nextSource = transformed;
        }
        catch (error) {
            throw new Error(pluginMessage(plugin, "preprocess", error));
        }
    }
    return nextSource;
}
function applyPluginAstTransforms(ast, plugins = []) {
    let nextAst = ast;
    for (const plugin of plugins) {
        if (!plugin.transformAst)
            continue;
        try {
            const transformed = plugin.transformAst(nextAst);
            if (!transformed || transformed.kind !== "diagram") {
                throw new Error('transformAst must return a DiagramAST with kind="diagram"');
            }
            nextAst = transformed;
        }
        catch (error) {
            throw new Error(pluginMessage(plugin, "transformAst", error));
        }
    }
    return nextAst;
}

// ============================================================
// sketchmark - Parser  (Tokens -> DiagramAST)
// ============================================================
let _uid = 0;
function uid(prefix) {
    return `${prefix}_${++_uid}`;
}
function resetUid() {
    _uid = 0;
}
const SHAPES$1 = [
    "box",
    "circle",
    "diamond",
    "hexagon",
    "triangle",
    "cylinder",
    "parallelogram",
    "text",
    "image",
    "icon",
    "line",
    "path",
];
const CHART_TYPES = [
    "bar-chart",
    "line-chart",
    "pie-chart",
    "donut-chart",
    "scatter-chart",
    "area-chart",
];
class ParseError extends Error {
    constructor(msg, line, col) {
        super(`[ParseError L${line}:${col}] ${msg}`);
        this.line = line;
        this.col = col;
        this.name = "ParseError";
    }
}
function propsToStyle(p) {
    const s = {};
    if (p.fill)
        s.fill = p.fill;
    if (p.stroke)
        s.stroke = p.stroke;
    if (p["stroke-width"])
        s.strokeWidth = parseFloat(p["stroke-width"]);
    if (p.color)
        s.color = p.color;
    if (p.opacity)
        s.opacity = parseFloat(p.opacity);
    if (p["font-size"])
        s.fontSize = parseFloat(p["font-size"]);
    if (p["font-weight"])
        s.fontWeight = p["font-weight"];
    if (p["text-align"])
        s.textAlign = p["text-align"];
    if (p.padding)
        s.padding = parseFloat(p.padding);
    if (p["vertical-align"]) {
        s.verticalAlign = p["vertical-align"];
    }
    if (p["line-height"])
        s.lineHeight = parseFloat(p["line-height"]);
    if (p["letter-spacing"])
        s.letterSpacing = parseFloat(p["letter-spacing"]);
    if (p.font)
        s.font = p.font;
    const dashVal = p.dash || p["stroke-dash"];
    if (dashVal) {
        const parts = dashVal
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n));
        if (parts.length)
            s.strokeDash = parts;
    }
    return s;
}
function isValueToken(t) {
    return !!t && (t.type === "IDENT" || t.type === "STRING" || t.type === "KEYWORD");
}
function isPropKeyToken(t) {
    return !!t && (t.type === "IDENT" || t.type === "KEYWORD");
}
function parse(src, options = {}) {
    resetUid();
    const preparedSource = applyPluginPreprocessors(src, options.plugins);
    const tokens = tokenize$1(preparedSource).filter((t) => t.type !== "NEWLINE" || t.value === "\n");
    const flat = [];
    let lastNL = false;
    for (const t of tokens) {
        if (t.type === "NEWLINE") {
            if (!lastNL)
                flat.push(t);
            lastNL = true;
        }
        else {
            flat.push(t);
            lastNL = false;
        }
    }
    const ast = {
        kind: "diagram",
        layout: "column",
        style: {},
        nodes: [],
        edges: [],
        groups: [],
        steps: [],
        charts: [],
        tables: [],
        markdowns: [],
        styles: {},
        themes: {},
        config: {},
        rootOrder: [],
    };
    const authoredEntityKinds = new Map();
    const unresolvedGroupItems = new Map();
    const groupTokens = new Map();
    let i = 0;
    const cur = () => flat[i] ?? flat[flat.length - 1];
    const peek1 = () => flat[i + 1] ?? flat[flat.length - 1];
    const skip = () => i++;
    const skipNL = () => {
        while (cur().type === "NEWLINE")
            skip();
    };
    function lineTokens() {
        const acc = [];
        while (cur().type !== "NEWLINE" && cur().type !== "EOF") {
            acc.push(cur());
            skip();
        }
        if (cur().type === "NEWLINE")
            skip();
        return acc;
    }
    function requireExplicitId(keywordTok, toks) {
        const first = toks[0];
        if (!isValueToken(first) || toks[1]?.type === "EQUALS") {
            throw new ParseError(`${keywordTok.value} requires an explicit id before properties`, keywordTok.line, keywordTok.col);
        }
        return first.value;
    }
    function parseSimpleProps(toks, startIndex) {
        const props = {};
        let j = startIndex;
        while (j < toks.length - 1) {
            const key = toks[j];
            const eq = toks[j + 1];
            if (isPropKeyToken(key) && eq?.type === "EQUALS" && j + 2 < toks.length) {
                props[key.value] = toks[j + 2].value;
                j += 3;
            }
            else {
                j++;
            }
        }
        return props;
    }
    function parseConfigValue(value) {
        if (value === "true" || value === "on")
            return true;
        if (value === "false" || value === "off")
            return false;
        const numeric = Number(value);
        return Number.isNaN(numeric) ? value : numeric;
    }
    function applyRootProps(props) {
        const styleProps = propsToStyle(props);
        const styleKeys = new Set([
            "fill",
            "stroke",
            "stroke-width",
            "color",
            "opacity",
            "font-size",
            "font-weight",
            "font",
            "dash",
            "stroke-dash",
            "padding",
            "text-align",
            "vertical-align",
            "line-height",
            "letter-spacing",
        ]);
        ast.style = { ...(ast.style ?? {}), ...styleProps };
        if (props.layout) {
            ast.layout = props.layout;
        }
        if (props.width !== undefined) {
            ast.width = parseFloat(props.width);
        }
        if (props.height !== undefined) {
            ast.height = parseFloat(props.height);
        }
        if (props.font !== undefined) {
            ast.config.font = parseConfigValue(props.font);
        }
        for (const [key, value] of Object.entries(props)) {
            if (key === "layout" || key === "width" || key === "height")
                continue;
            if (styleKeys.has(key))
                continue;
            ast.config[key] = parseConfigValue(value);
        }
    }
    function parseGroupProps(toks, startIndex) {
        const props = {};
        const itemIds = [];
        let j = startIndex;
        while (j < toks.length) {
            const key = toks[j];
            const eq = toks[j + 1];
            if (!isPropKeyToken(key) || eq?.type !== "EQUALS") {
                j++;
                continue;
            }
            if (key.value === "items") {
                const open = toks[j + 2];
                if (open?.type !== "LBRACKET") {
                    throw new ParseError(`items must use bracket syntax like items=[a,b]`, key.line, key.col);
                }
                j += 3;
                while (j < toks.length && toks[j].type !== "RBRACKET") {
                    const tok = toks[j];
                    if (tok.type === "COMMA") {
                        j++;
                        continue;
                    }
                    if (!isValueToken(tok)) {
                        const invalidTok = toks[j];
                        throw new ParseError(`items can only contain ids like items=[a,b]`, invalidTok.line, invalidTok.col);
                    }
                    itemIds.push(tok.value);
                    j++;
                    if (toks[j]?.type === "COMMA") {
                        j++;
                    }
                    else if (toks[j] && toks[j].type !== "RBRACKET") {
                        throw new ParseError(`Expected ',' or ']' in items list`, toks[j].line, toks[j].col);
                    }
                }
                if (toks[j]?.type !== "RBRACKET") {
                    throw new ParseError(`Unterminated items list; expected ']'`, key.line, key.col);
                }
                j++;
                continue;
            }
            if (j + 2 < toks.length) {
                props[key.value] = toks[j + 2].value;
                j += 3;
            }
            else {
                j++;
            }
        }
        return { props, itemIds };
    }
    function registerAuthoredId(id, kind, tok) {
        const existing = authoredEntityKinds.get(id);
        if (existing) {
            throw new ParseError(`Duplicate id "${id}" already declared as a ${existing}`, tok.line, tok.col);
        }
        authoredEntityKinds.set(id, kind);
    }
    function parseDataArray() {
        const rows = [];
        while (cur().type !== "LBRACKET" && cur().type !== "EOF")
            skip();
        skip();
        skipNL();
        while (cur().type !== "RBRACKET" && cur().type !== "EOF") {
            skipNL();
            if (cur().type === "RBRACKET" || cur().type === "EOF")
                break;
            if (cur().type === "LBRACKET") {
                skip();
                const row = [];
                while (cur().type !== "RBRACKET" && cur().type !== "EOF") {
                    const v = cur();
                    if (v.type === "STRING" || v.type === "IDENT" || v.type === "KEYWORD") {
                        row.push(v.value);
                        skip();
                    }
                    else if (v.type === "NUMBER") {
                        row.push(parseFloat(v.value));
                        skip();
                    }
                    else if (v.type === "COMMA" || v.type === "NEWLINE") {
                        skip();
                    }
                    else {
                        break;
                    }
                }
                if (cur().type === "RBRACKET")
                    skip();
                rows.push(row);
            }
            else if (cur().type === "COMMA" || cur().type === "NEWLINE") {
                skip();
            }
            else {
                skip();
            }
        }
        if (cur().type === "RBRACKET")
            skip();
        return rows;
    }
    function parseNode(shape) {
        const keywordTok = cur();
        skip();
        const toks = lineTokens();
        const id = requireExplicitId(keywordTok, toks);
        const props = parseSimpleProps(toks, 1);
        const meta = extractNodeMeta(props);
        const node = {
            kind: "node",
            id,
            shape,
            label: props.label || "",
            ...(props.width ? { width: parseFloat(props.width) } : {}),
            ...(props.height ? { height: parseFloat(props.height) } : {}),
            ...(props.x ? { x: parseFloat(props.x) } : {}),
            ...(props.y ? { y: parseFloat(props.y) } : {}),
            ...(props.deg ? { deg: parseFloat(props.deg) } : {}),
            ...(props.dx ? { dx: parseFloat(props.dx) } : {}),
            ...(props.dy ? { dy: parseFloat(props.dy) } : {}),
            ...(props.factor ? { factor: parseFloat(props.factor) } : {}),
            ...(props.theme ? { theme: props.theme } : {}),
            ...(meta ? { meta } : {}),
            style: propsToStyle(props),
        };
        if (props.url)
            node.imageUrl = props.url;
        if (props.name)
            node.iconName = props.name;
        if (props.value)
            node.pathData = props.value;
        return node;
    }
    function parseNote() {
        const keywordTok = cur();
        skip();
        const toks = lineTokens();
        const id = requireExplicitId(keywordTok, toks);
        const props = {};
        let j = 1;
        if (toks[1] &&
            (toks[1].type === "STRING" ||
                (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))) {
            props.label = toks[1].value;
            j = 2;
        }
        Object.assign(props, parseSimpleProps(toks, j));
        const meta = extractNodeMeta(props);
        return {
            kind: "node",
            id,
            shape: "note",
            label: (props.label ?? "").replace(/\\n/g, "\n"),
            theme: props.theme,
            ...(meta ? { meta } : {}),
            style: propsToStyle(props),
            ...(props.width ? { width: parseFloat(props.width) } : {}),
            ...(props.height ? { height: parseFloat(props.height) } : {}),
            ...(props.x ? { x: parseFloat(props.x) } : {}),
            ...(props.y ? { y: parseFloat(props.y) } : {}),
            ...(props.deg ? { deg: parseFloat(props.deg) } : {}),
            ...(props.dx ? { dx: parseFloat(props.dx) } : {}),
            ...(props.dy ? { dy: parseFloat(props.dy) } : {}),
            ...(props.factor ? { factor: parseFloat(props.factor) } : {}),
        };
    }
    function extractNodeMeta(props) {
        const meta = {};
        if (props["animation-parent"]) {
            meta.animationParent = props["animation-parent"];
        }
        return Object.keys(meta).length ? meta : undefined;
    }
    function parseGroup() {
        const keywordTok = cur();
        skip();
        const toks = lineTokens();
        if (toks.some((t) => t.type === "LBRACE" || t.type === "RBRACE")) {
            throw new ParseError(`Nested group blocks were removed. Use ${keywordTok.value} <id> items=[...] instead.`, keywordTok.line, keywordTok.col);
        }
        const id = requireExplicitId(keywordTok, toks);
        const props = {};
        let j = 1;
        if (toks[1] &&
            (toks[1].type === "STRING" ||
                (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))) {
            props.label = toks[1].value;
            j = 2;
        }
        const parsed = parseGroupProps(toks, j);
        Object.assign(props, parsed.props);
        skipNL();
        if (cur().type === "LBRACE") {
            throw new ParseError(`Nested group blocks were removed. Use ${keywordTok.value} ${id} items=[...] instead.`, cur().line, cur().col);
        }
        unresolvedGroupItems.set(id, parsed.itemIds);
        groupTokens.set(id, keywordTok);
        return {
            kind: "group",
            id,
            label: props.label ?? "",
            children: [],
            layout: props.layout,
            columns: props.columns !== undefined ? parseInt(props.columns, 10) : undefined,
            padding: props.padding !== undefined ? parseInt(props.padding, 10) : undefined,
            gap: props.gap !== undefined ? parseInt(props.gap, 10) : undefined,
            align: props.align,
            justify: props.justify,
            theme: props.theme,
            style: propsToStyle(props),
            x: props.x !== undefined ? parseFloat(props.x) : undefined,
            y: props.y !== undefined ? parseFloat(props.y) : undefined,
            width: props.width !== undefined ? parseFloat(props.width) : undefined,
            height: props.height !== undefined ? parseFloat(props.height) : undefined,
        };
    }
    function parseEdge(fromId, connector, rest) {
        const toTok = rest.shift();
        if (!toTok)
            throw new ParseError("Expected edge target", 0, 0);
        const props = {};
        let j = 0;
        while (j < rest.length) {
            const t = rest[j];
            if ((t.type === "IDENT" || t.type === "KEYWORD") &&
                j + 1 < rest.length &&
                rest[j + 1].type === "EQUALS") {
                props[t.value] = rest[j + 2]?.value ?? "";
                j += 3;
            }
            else {
                j++;
            }
        }
        const dashed = connector.includes("--") ||
            connector.includes(".-") ||
            connector.includes("-.");
        const bidirectional = connector.includes("<") && connector.includes(">");
        return {
            kind: "edge",
            id: uid("edge"),
            from: fromId,
            to: toTok.value,
            connector: connector,
            label: props.label,
            fromAnchor: props["anchor-from"],
            toAnchor: props["anchor-to"],
            dashed,
            bidirectional,
            style: propsToStyle(props),
        };
    }
    function parseStep() {
        skip();
        const toks = lineTokens();
        const action = (toks[0]?.value ?? "highlight");
        let target = toks[1]?.value ?? "";
        if (toks[2]?.type === "ARROW" && toks[3]) {
            target = `${toks[1].value}${toks[2].value}${toks[3].value}`;
        }
        const step = { kind: "step", action, target };
        if (action === "narrate") {
            step.target = "";
            step.value = toks[1]?.value ?? "";
        }
        if (action === "bracket" && toks.length >= 3) {
            step.target = toks[1]?.value ?? "";
            step.target2 = toks[2]?.value ?? "";
        }
        const kvStart = action === "bracket" ? 3 : 2;
        for (let j = kvStart; j < toks.length; j++) {
            const k = toks[j]?.value;
            const eq = toks[j + 1];
            const vt = toks[j + 2];
            if (eq?.type === "EQUALS" && vt) {
                if (k === "dx") {
                    step.dx = parseFloat(vt.value);
                    j += 2;
                    continue;
                }
                if (k === "dy") {
                    step.dy = parseFloat(vt.value);
                    j += 2;
                    continue;
                }
                if (k === "duration") {
                    step.duration = parseFloat(vt.value);
                    j += 2;
                    continue;
                }
                if (k === "delay") {
                    step.delay = parseFloat(vt.value);
                    j += 2;
                    continue;
                }
                if (k === "factor") {
                    step.factor = parseFloat(vt.value);
                    j += 2;
                    continue;
                }
                if (k === "deg") {
                    step.deg = parseFloat(vt.value);
                    j += 2;
                    continue;
                }
                if (k === "fill" || k === "color") {
                    step.value = vt.value;
                    j += 2;
                    continue;
                }
                if (k === "pace") {
                    step.pace = vt.value;
                    j += 2;
                    continue;
                }
            }
            if (k === "delay" && eq?.type === "NUMBER") {
                step.delay = parseFloat(eq.value);
                j++;
                continue;
            }
            if (k === "duration" && eq?.type === "NUMBER") {
                step.duration = parseFloat(eq.value);
                j++;
                continue;
            }
            if (k === "trigger") {
                step.trigger = eq?.value;
                j++;
            }
        }
        return step;
    }
    function parseChart(chartType) {
        const keywordTok = cur();
        skip();
        const toks = lineTokens();
        const id = requireExplicitId(keywordTok, toks);
        const props = parseSimpleProps(toks, 1);
        let dataRows = [];
        skipNL();
        while (cur().type !== "EOF" && cur().value !== "end") {
            skipNL();
            if (cur().type === "RBRACE")
                break;
            const v = cur().value;
            if (v === "data") {
                dataRows = parseDataArray();
            }
            else if ((cur().type === "IDENT" || cur().type === "KEYWORD") &&
                peek1().type === "EQUALS") {
                const key = cur().value;
                skip();
                skip();
                props[key] = cur().value;
                skip();
            }
            else if (SHAPES$1.includes(v) ||
                v === "step" ||
                v === "group" ||
                v === "bare" ||
                v === "note" ||
                v === "table" ||
                v === "config" ||
                v === "theme" ||
                v === "style" ||
                v === "markdown" ||
                CHART_TYPES.includes(v)) {
                break;
            }
            else if (peek1().type === "ARROW") {
                break;
            }
            else {
                skip();
            }
        }
        const headers = dataRows[0]?.map(String) ?? [];
        const rows = dataRows.slice(1);
        return {
            kind: "chart",
            id,
            chartType: chartType.replace("-chart", ""),
            label: props.label ?? props.title,
            data: { headers, rows },
            x: props.x ? parseFloat(props.x) : undefined,
            y: props.y ? parseFloat(props.y) : undefined,
            width: props.width ? parseFloat(props.width) : undefined,
            height: props.height ? parseFloat(props.height) : undefined,
            theme: props.theme,
            style: propsToStyle(props),
        };
    }
    function parseTable() {
        const keywordTok = cur();
        skip();
        const toks = lineTokens();
        const id = requireExplicitId(keywordTok, toks);
        const props = {};
        let j = 1;
        if (toks[1] &&
            (toks[1].type === "STRING" ||
                (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))) {
            props.label = toks[1].value;
            j = 2;
        }
        Object.assign(props, parseSimpleProps(toks, j));
        const table = {
            kind: "table",
            id,
            label: props.label ?? "",
            rows: [],
            x: props.x ? parseFloat(props.x) : undefined,
            y: props.y ? parseFloat(props.y) : undefined,
            theme: props.theme,
            style: propsToStyle(props),
        };
        skipNL();
        if (cur().type === "LBRACE") {
            skip();
            skipNL();
        }
        while (cur().type !== "RBRACE" &&
            cur().value !== "end" &&
            cur().type !== "EOF") {
            skipNL();
            if (cur().type === "RBRACE")
                break;
            const v = cur().value;
            if (v === "header" || v === "row") {
                skip();
                const cells = [];
                while (cur().type !== "NEWLINE" && cur().type !== "EOF") {
                    if (cur().type === "STRING" ||
                        cur().type === "IDENT" ||
                        cur().type === "NUMBER" ||
                        cur().type === "KEYWORD") {
                        cells.push(cur().value);
                    }
                    skip();
                }
                if (cur().type === "NEWLINE")
                    skip();
                table.rows.push({ kind: v === "header" ? "header" : "data", cells });
            }
            else {
                skip();
            }
        }
        if (cur().type === "RBRACE")
            skip();
        return table;
    }
    function parseMarkdown() {
        const keywordTok = cur();
        skip();
        const toks = lineTokens();
        const id = requireExplicitId(keywordTok, toks);
        const props = parseSimpleProps(toks, 1);
        skipNL();
        let content = "";
        if (cur().type === "STRING_BLOCK") {
            content = cur().value;
            skip();
        }
        return {
            kind: "markdown",
            id,
            content: content.trim(),
            x: props.x ? parseFloat(props.x) : undefined,
            y: props.y ? parseFloat(props.y) : undefined,
            width: props.width ? parseFloat(props.width) : undefined,
            height: props.height ? parseFloat(props.height) : undefined,
            theme: props.theme,
            style: propsToStyle(props),
        };
    }
    skipNL();
    if (cur().value === "diagram") {
        skip();
        const toks = lineTokens();
        const props = parseSimpleProps(toks, 0);
        applyRootProps(props);
    }
    skipNL();
    while (cur().type !== "EOF" && cur().value !== "end") {
        skipNL();
        const t = cur();
        const v = t.value;
        if (t.type === "NEWLINE") {
            skip();
            continue;
        }
        if (v === "diagram") {
            lineTokens();
            continue;
        }
        if (v === "end")
            break;
        if (v === "direction") {
            lineTokens();
            continue;
        }
        if (v === "layout") {
            throw new ParseError(`Root layout must be declared on the diagram line, e.g. diagram layout=absolute`, t.line, t.col);
        }
        if (v === "title") {
            skip();
            const toks = lineTokens();
            const labelProp = toks.find((t2, idx) => t2.value === "label" && toks[idx + 1]?.type === "EQUALS");
            if (labelProp) {
                const idx = toks.indexOf(labelProp);
                ast.title = toks[idx + 2]?.value ?? "";
            }
            else {
                ast.title = toks.map((t2) => t2.value).join(" ").replace(/"/g, "");
            }
            continue;
        }
        if (v === "description") {
            skip();
            ast.description = lineTokens()
                .map((t2) => t2.value)
                .join(" ")
                .replace(/"/g, "");
            continue;
        }
        if (v === "config") {
            throw new ParseError(`Root config must be declared on the diagram line, e.g. diagram gap=40 margin=0 tts=true`, t.line, t.col);
        }
        if (v === "style") {
            skip();
            const targetId = cur().value;
            skip();
            const props = parseSimpleProps(lineTokens(), 0);
            ast.styles[targetId] = { ...ast.styles[targetId], ...propsToStyle(props) };
            continue;
        }
        if (v === "theme") {
            skip();
            const toks = lineTokens();
            const themeId = toks[0]?.value;
            if (!themeId)
                continue;
            ast.themes[themeId] = propsToStyle(parseSimpleProps(toks, 1));
            continue;
        }
        if (v === "group" || v === "bare") {
            const isBare = v === "bare";
            const grp = parseGroup();
            registerAuthoredId(grp.id, "group", t);
            if (isBare) {
                grp.label = "";
                grp.padding = grp.padding ?? 0;
                grp.style = {
                    ...grp.style,
                    fill: grp.style?.fill ?? "none",
                    stroke: grp.style?.stroke ?? "none",
                    strokeWidth: grp.style?.strokeWidth ?? 0,
                };
            }
            ast.groups.push(grp);
            ast.rootOrder.push({ kind: "group", id: grp.id });
            continue;
        }
        if (v === "table") {
            const tbl = parseTable();
            registerAuthoredId(tbl.id, "table", t);
            ast.tables.push(tbl);
            ast.rootOrder.push({ kind: "table", id: tbl.id });
            continue;
        }
        if (v === "note") {
            const note = parseNote();
            registerAuthoredId(note.id, "node", t);
            ast.nodes.push(note);
            ast.rootOrder.push({ kind: "node", id: note.id });
            continue;
        }
        if (v === "beat") {
            skip();
            skipNL();
            if (cur().type === "LBRACE") {
                skip();
                skipNL();
            }
            const children = [];
            while (cur().type !== "RBRACE" &&
                cur().value !== "end" &&
                cur().type !== "EOF") {
                skipNL();
                if (cur().type === "RBRACE")
                    break;
                if (cur().value === "step") {
                    children.push(parseStep());
                }
                else {
                    skip();
                }
            }
            if (cur().type === "RBRACE")
                skip();
            ast.steps.push({ kind: "beat", children });
            continue;
        }
        if (v === "step") {
            ast.steps.push(parseStep());
            continue;
        }
        if (CHART_TYPES.includes(v)) {
            const chart = parseChart(v);
            registerAuthoredId(chart.id, "chart", t);
            ast.charts.push(chart);
            ast.rootOrder.push({ kind: "chart", id: chart.id });
            continue;
        }
        if (v === "markdown") {
            const md = parseMarkdown();
            registerAuthoredId(md.id, "markdown", t);
            ast.markdowns.push(md);
            ast.rootOrder.push({ kind: "markdown", id: md.id });
            continue;
        }
        if (t.type === "IDENT" || t.type === "STRING" || t.type === "KEYWORD") {
            const nextTok = flat[i + 1];
            if (nextTok && nextTok.type === "ARROW") {
                const lineToks = lineTokens();
                if (lineToks.length >= 3 && lineToks[1].type === "ARROW") {
                    const fromId = lineToks[0].value;
                    const connector = lineToks[1].value;
                    ast.edges.push(parseEdge(fromId, connector, lineToks.slice(2)));
                    continue;
                }
            }
        }
        if (SHAPES$1.includes(v)) {
            const node = parseNode(v);
            registerAuthoredId(node.id, "node", t);
            ast.nodes.push(node);
            ast.rootOrder.push({ kind: "node", id: node.id });
            continue;
        }
        skip();
    }
    const allKnownIds = new Set(authoredEntityKinds.keys());
    for (const edge of ast.edges) {
        for (const id of [edge.from, edge.to]) {
            if (allKnownIds.has(id))
                continue;
            allKnownIds.add(id);
            ast.nodes.push({
                kind: "node",
                id,
                shape: "box",
                label: id,
                style: {},
            });
        }
    }
    const entityKindById = new Map();
    ast.nodes.forEach((node) => entityKindById.set(node.id, "node"));
    ast.groups.forEach((group) => entityKindById.set(group.id, "group"));
    ast.tables.forEach((table) => entityKindById.set(table.id, "table"));
    ast.charts.forEach((chart) => entityKindById.set(chart.id, "chart"));
    ast.markdowns.forEach((md) => entityKindById.set(md.id, "markdown"));
    for (const group of ast.groups) {
        const itemIds = unresolvedGroupItems.get(group.id) ?? [];
        group.children = itemIds.map((itemId) => {
            if (itemId === group.id) {
                const tok = groupTokens.get(group.id) ?? cur();
                throw new ParseError(`Group "${group.id}" cannot include itself in items=[...]`, tok.line, tok.col);
            }
            const kind = entityKindById.get(itemId);
            if (!kind) {
                const tok = groupTokens.get(group.id) ?? cur();
                throw new ParseError(`Group "${group.id}" references unknown item "${itemId}" in items=[...]`, tok.line, tok.col);
            }
            return { kind, id: itemId };
        });
    }
    const parentByItemId = new Map();
    for (const group of ast.groups) {
        for (const child of group.children) {
            const existingParent = parentByItemId.get(child.id);
            if (existingParent) {
                const tok = groupTokens.get(group.id) ?? cur();
                throw new ParseError(`Item "${child.id}" cannot belong to both "${existingParent}" and "${group.id}"`, tok.line, tok.col);
            }
            parentByItemId.set(child.id, group.id);
        }
    }
    const groupsById = new Map(ast.groups.map((group) => [group.id, group]));
    const visiting = new Set();
    const visited = new Set();
    const stack = [];
    function visitGroup(groupId) {
        if (visiting.has(groupId)) {
            const start = stack.indexOf(groupId);
            const cycle = (start >= 0 ? stack.slice(start) : stack).concat(groupId);
            const tok = groupTokens.get(groupId) ?? cur();
            throw new ParseError(`Group cycle detected: ${cycle.join(" -> ")}`, tok.line, tok.col);
        }
        if (visited.has(groupId))
            return;
        visiting.add(groupId);
        stack.push(groupId);
        const group = groupsById.get(groupId);
        if (group) {
            for (const child of group.children) {
                if (child.kind === "group")
                    visitGroup(child.id);
            }
        }
        stack.pop();
        visiting.delete(groupId);
        visited.add(groupId);
    }
    for (const group of ast.groups)
        visitGroup(group.id);
    for (const node of ast.nodes) {
        if (ast.styles[node.id]) {
            node.style = { ...ast.styles[node.id], ...node.style };
        }
    }
    return applyPluginAstTransforms(ast, options.plugins);
}

// ============================================================
// sketchmark — Design Tokens (single source of truth)
//
// All layout, sizing, typography, and rendering constants live
// here. Import from this file instead of scattering magic
// numbers across modules.
// ============================================================
// ── Layout ─────────────────────────────────────────────────
const LAYOUT = {
    margin: 60, // default canvas margin (px)
    gap: 80, // default gap between root-level items (px)
    groupLabelH: 22, // height reserved for group label strip (px)
    groupPad: 26, // default group inner padding (px)
    groupGap: 10, // default gap between items inside a group (px)
};
// ── Node sizing ────────────────────────────────────────────
const NODE = {
    minW: 90, // minimum auto-sized node width (px)
    maxW: 300, // maximum auto-sized node width (px)
    basePad: 26, // base padding added to label width (px)
};
// ── Shape-specific sizing ──────────────────────────────────
const SHAPES = {
    cylinder: { defaultH: 66, ellipseH: 18 },
    diamond: { minW: 130, minH: 62, aspect: 0.46, labelPad: 30 },
    hexagon: { minW: 126, minH: 54, aspect: 0.44, labelPad: 20, inset: 0.56 },
    triangle: { minW: 108, minH: 64, aspect: 0.6, labelPad: 10 },
    parallelogram: { defaultH: 50, labelPad: 28, skew: 18 },
};
// ── Table sizing ───────────────────────────────────────────
const TABLE = {
    cellPad: 20, // total horizontal padding per cell (px)
    minColW: 50, // minimum column width (px)
    fontPxPerChar: 7.5, // approx px per char at 12px sans-serif
    rowH: 30, // data row height (px)
    headerH: 34, // header row height (px)
    labelH: 22, // label strip height (px)
};
// ── Note shape ─────────────────────────────────────────────
const NOTE = {
    lineH: 20, // line height for note text (px)
    padX: 16, // horizontal padding (px)
    padY: 12, // vertical padding (px)
    fold: 14, // fold corner size (px)
    minW: 120, // minimum note width (px)
};
// ── Typography defaults ────────────────────────────────────
const TYPOGRAPHY = {
    defaultFontSize: 14,
    defaultFontWeight: 500,
    defaultLineHeight: 1.3, // multiplier (× fontSize = px)
    defaultPadding: 8,
    defaultAlign: "center",
    defaultVAlign: "middle",
};
// ── Title ──────────────────────────────────────────────────
const TITLE = {
    y: 26, // baseline Y position (px)
    fontSize: 18, // default title font size
    fontWeight: 600, // default title font weight
};
// ── Group label typography ─────────────────────────────────
const GROUP_LABEL = {
    fontSize: 12,
    fontWeight: 500,
    padding: 14,
};
// ── Edge / arrow ───────────────────────────────────────────
const EDGE = {
    arrowSize: 12, // arrowhead polygon size (px)
    headInset: 13, // line shortening for arrowhead overlap (px)
    labelOffset: 14, // perpendicular offset of label from edge line (px)
    labelFontSize: 11, // default edge label font size
    labelFontWeight: 400, // default edge label font weight
    dashPattern: [6, 5], // stroke-dasharray for dashed edges
};
// ── Markdown typography ────────────────────────────────────
const MARKDOWN = {
    fontSize: { h1: 40, h2: 28, h3: 20, p: 15, blank: 0 },
    fontWeight: { h1: 700, h2: 600, h3: 600, p: 400, blank: 400 },
    spacing: { h1: 52, h2: 38, h3: 28, p: 22, blank: 10 },
    defaultPad: 0,
};
// ── Rough.js rendering ─────────────────────────────────────
const ROUGH = {
    roughness: 1.3, // default roughness for nodes/edges
    chartRoughness: 1.2, // slightly smoother for chart elements
    bowing: 0.7,
};
// ── Chart layout ───────────────────────────────────────────
const CHART = {
    titleH: 24, // title strip height when label present (px)
    titleHEmpty: 8, // title strip height when no label (px)
    padL: 44, // left padding for plot area (px)
    padR: 12, // right padding (px)
    padT: 6, // top padding (px)
    padB: 28, // bottom padding (px)
    defaultW: 320, // default chart width (px)
    defaultH: 240, // default chart height (px)
};
// ── Animation timing ───────────────────────────────────────
const ANIMATION = {
    // Edge drawing
    strokeDur: 360, // edge stroke-draw duration (ms)
    arrowReveal: 120, // arrow fade-in delay after stroke (ms)
    dashClear: 160, // delay before clearing dash overrides (ms)
    // Shape drawing (per entity type)
    nodeStrokeDur: 420, // node stroke-draw duration (ms)
    nodeStagger: 55, // stagger between node paths (ms)
    groupStrokeDur: 550, // group stroke-draw duration (ms)
    groupStagger: 40, // stagger between group paths (ms)
    tableStrokeDur: 500, // table stroke-draw duration (ms)
    tableStagger: 40, // stagger between table paths (ms)
    // Text / misc
    textFade: 200, // text opacity fade-in duration (ms)
    fillFadeOffset: -60, // fill-opacity start relative to stroke end (ms)
    textDelay: 80, // extra buffer before text reveals (ms)
    chartFade: 500, // chart/markdown opacity transition (ms)
    // Pace
    paceSlowMul: 2.0, // slow pace duration multiplier
    paceFastMul: 0.5, // fast pace duration multiplier
    pauseHoldMs: 1500, // extra hold time for pause pace (ms)
    // Narration
    narrationFadeMs: 300, // caption fade-in/out duration (ms)
    narrationTypeMs: 30, // per-character typing speed for narration (ms)
    // Text writing reveal
    textRevealMs: 400, // text clip-reveal duration (ms)
    // Annotations
    annotationStrokeDur: 300, // annotation draw-in duration (ms)
    annotationColor: '#c85428', // default annotation color
    annotationStrokeW: 2.5, // annotation stroke width
    pointerSize: 8, // default pointer dot radius
};
// ── Export defaults ────────────────────────────────────────
const EXPORT = {
    pngScale: 2, // default PNG pixel density multiplier
    fallbackW: 400, // fallback SVG width when not set (px)
    fallbackH: 300, // fallback SVG height when not set (px)
    fallbackBg: "#f8f4ea", // default PNG/HTML background color
    revokeDelay: 5000, // blob URL revocation delay (ms)
    defaultFps: 30, // default video FPS
};
// ── SVG namespace ──────────────────────────────────────────
const SVG_NS$1 = "http://www.w3.org/2000/svg";

// Simplified bidi metadata helper for the rich prepareWithSegments() path,
// forked from pdf.js via Sebastian's text-layout. It classifies characters
// into bidi types, computes embedding levels, and maps them onto prepared
// segments for custom rendering. The line-breaking engine does not consume
// these levels.
const baseTypes = [
    'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'S', 'B', 'S', 'WS',
    'B', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN',
    'BN', 'BN', 'B', 'B', 'B', 'S', 'WS', 'ON', 'ON', 'ET', 'ET', 'ET', 'ON',
    'ON', 'ON', 'ON', 'ON', 'ON', 'CS', 'ON', 'CS', 'ON', 'EN', 'EN', 'EN',
    'EN', 'EN', 'EN', 'EN', 'EN', 'EN', 'EN', 'ON', 'ON', 'ON', 'ON', 'ON',
    'ON', 'ON', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L',
    'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'ON', 'ON',
    'ON', 'ON', 'ON', 'ON', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L',
    'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L',
    'L', 'ON', 'ON', 'ON', 'ON', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'B', 'BN',
    'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN',
    'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN',
    'BN', 'CS', 'ON', 'ET', 'ET', 'ET', 'ET', 'ON', 'ON', 'ON', 'ON', 'L', 'ON',
    'ON', 'ON', 'ON', 'ON', 'ET', 'ET', 'EN', 'EN', 'ON', 'L', 'ON', 'ON', 'ON',
    'EN', 'L', 'ON', 'ON', 'ON', 'ON', 'ON', 'L', 'L', 'L', 'L', 'L', 'L', 'L',
    'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L',
    'L', 'ON', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L',
    'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L',
    'L', 'L', 'L', 'ON', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'
];
const arabicTypes = [
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'CS', 'AL', 'ON', 'ON', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM',
    'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AN', 'AN', 'AN', 'AN', 'AN', 'AN', 'AN', 'AN', 'AN',
    'AN', 'ET', 'AN', 'AN', 'AL', 'AL', 'AL', 'NSM', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM',
    'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'NSM', 'ON', 'NSM',
    'NSM', 'NSM', 'NSM', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL',
    'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL', 'AL'
];
function classifyChar(charCode) {
    if (charCode <= 0x00ff)
        return baseTypes[charCode];
    if (0x0590 <= charCode && charCode <= 0x05f4)
        return 'R';
    if (0x0600 <= charCode && charCode <= 0x06ff)
        return arabicTypes[charCode & 0xff];
    if (0x0700 <= charCode && charCode <= 0x08AC)
        return 'AL';
    return 'L';
}
function computeBidiLevels(str) {
    const len = str.length;
    if (len === 0)
        return null;
    // eslint-disable-next-line unicorn/no-new-array
    const types = new Array(len);
    let numBidi = 0;
    for (let i = 0; i < len; i++) {
        const t = classifyChar(str.charCodeAt(i));
        if (t === 'R' || t === 'AL' || t === 'AN')
            numBidi++;
        types[i] = t;
    }
    if (numBidi === 0)
        return null;
    const startLevel = (len / numBidi) < 0.3 ? 0 : 1;
    const levels = new Int8Array(len);
    for (let i = 0; i < len; i++)
        levels[i] = startLevel;
    const e = (startLevel & 1) ? 'R' : 'L';
    const sor = e;
    // W1-W7
    let lastType = sor;
    for (let i = 0; i < len; i++) {
        if (types[i] === 'NSM')
            types[i] = lastType;
        else
            lastType = types[i];
    }
    lastType = sor;
    for (let i = 0; i < len; i++) {
        const t = types[i];
        if (t === 'EN')
            types[i] = lastType === 'AL' ? 'AN' : 'EN';
        else if (t === 'R' || t === 'L' || t === 'AL')
            lastType = t;
    }
    for (let i = 0; i < len; i++) {
        if (types[i] === 'AL')
            types[i] = 'R';
    }
    for (let i = 1; i < len - 1; i++) {
        if (types[i] === 'ES' && types[i - 1] === 'EN' && types[i + 1] === 'EN') {
            types[i] = 'EN';
        }
        if (types[i] === 'CS' &&
            (types[i - 1] === 'EN' || types[i - 1] === 'AN') &&
            types[i + 1] === types[i - 1]) {
            types[i] = types[i - 1];
        }
    }
    for (let i = 0; i < len; i++) {
        if (types[i] !== 'EN')
            continue;
        let j;
        for (j = i - 1; j >= 0 && types[j] === 'ET'; j--)
            types[j] = 'EN';
        for (j = i + 1; j < len && types[j] === 'ET'; j++)
            types[j] = 'EN';
    }
    for (let i = 0; i < len; i++) {
        const t = types[i];
        if (t === 'WS' || t === 'ES' || t === 'ET' || t === 'CS')
            types[i] = 'ON';
    }
    lastType = sor;
    for (let i = 0; i < len; i++) {
        const t = types[i];
        if (t === 'EN')
            types[i] = lastType === 'L' ? 'L' : 'EN';
        else if (t === 'R' || t === 'L')
            lastType = t;
    }
    // N1-N2
    for (let i = 0; i < len; i++) {
        if (types[i] !== 'ON')
            continue;
        let end = i + 1;
        while (end < len && types[end] === 'ON')
            end++;
        const before = i > 0 ? types[i - 1] : sor;
        const after = end < len ? types[end] : sor;
        const bDir = before !== 'L' ? 'R' : 'L';
        const aDir = after !== 'L' ? 'R' : 'L';
        if (bDir === aDir) {
            for (let j = i; j < end; j++)
                types[j] = bDir;
        }
        i = end - 1;
    }
    for (let i = 0; i < len; i++) {
        if (types[i] === 'ON')
            types[i] = e;
    }
    // I1-I2
    for (let i = 0; i < len; i++) {
        const t = types[i];
        if ((levels[i] & 1) === 0) {
            if (t === 'R')
                levels[i]++;
            else if (t === 'AN' || t === 'EN')
                levels[i] += 2;
        }
        else if (t === 'L' || t === 'AN' || t === 'EN') {
            levels[i]++;
        }
    }
    return levels;
}
function computeSegmentLevels(normalized, segStarts) {
    const bidiLevels = computeBidiLevels(normalized);
    if (bidiLevels === null)
        return null;
    const segLevels = new Int8Array(segStarts.length);
    for (let i = 0; i < segStarts.length; i++) {
        segLevels[i] = bidiLevels[segStarts[i]];
    }
    return segLevels;
}

const collapsibleWhitespaceRunRe = /[ \t\n\r\f]+/g;
const needsWhitespaceNormalizationRe = /[\t\n\r\f]| {2,}|^ | $/;
function getWhiteSpaceProfile(whiteSpace) {
    const mode = whiteSpace ?? 'normal';
    return mode === 'pre-wrap'
        ? { mode, preserveOrdinarySpaces: true, preserveHardBreaks: true }
        : { mode, preserveOrdinarySpaces: false, preserveHardBreaks: false };
}
function normalizeWhitespaceNormal(text) {
    if (!needsWhitespaceNormalizationRe.test(text))
        return text;
    let normalized = text.replace(collapsibleWhitespaceRunRe, ' ');
    if (normalized.charCodeAt(0) === 0x20) {
        normalized = normalized.slice(1);
    }
    if (normalized.length > 0 && normalized.charCodeAt(normalized.length - 1) === 0x20) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}
function normalizeWhitespacePreWrap(text) {
    if (!/[\r\f]/.test(text))
        return text.replace(/\r\n/g, '\n');
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[\r\f]/g, '\n');
}
let sharedWordSegmenter = null;
let segmenterLocale;
function getSharedWordSegmenter() {
    if (sharedWordSegmenter === null) {
        sharedWordSegmenter = new Intl.Segmenter(segmenterLocale, { granularity: 'word' });
    }
    return sharedWordSegmenter;
}
const arabicScriptRe = /\p{Script=Arabic}/u;
const combiningMarkRe = /\p{M}/u;
const decimalDigitRe = /\p{Nd}/u;
function containsArabicScript(text) {
    return arabicScriptRe.test(text);
}
function isCJK(s) {
    for (const ch of s) {
        const c = ch.codePointAt(0);
        if ((c >= 0x4E00 && c <= 0x9FFF) ||
            (c >= 0x3400 && c <= 0x4DBF) ||
            (c >= 0x20000 && c <= 0x2A6DF) ||
            (c >= 0x2A700 && c <= 0x2B73F) ||
            (c >= 0x2B740 && c <= 0x2B81F) ||
            (c >= 0x2B820 && c <= 0x2CEAF) ||
            (c >= 0x2CEB0 && c <= 0x2EBEF) ||
            (c >= 0x30000 && c <= 0x3134F) ||
            (c >= 0xF900 && c <= 0xFAFF) ||
            (c >= 0x2F800 && c <= 0x2FA1F) ||
            (c >= 0x3000 && c <= 0x303F) ||
            (c >= 0x3040 && c <= 0x309F) ||
            (c >= 0x30A0 && c <= 0x30FF) ||
            (c >= 0xAC00 && c <= 0xD7AF) ||
            (c >= 0xFF00 && c <= 0xFFEF)) {
            return true;
        }
    }
    return false;
}
const kinsokuStart = new Set([
    '\uFF0C',
    '\uFF0E',
    '\uFF01',
    '\uFF1A',
    '\uFF1B',
    '\uFF1F',
    '\u3001',
    '\u3002',
    '\u30FB',
    '\uFF09',
    '\u3015',
    '\u3009',
    '\u300B',
    '\u300D',
    '\u300F',
    '\u3011',
    '\u3017',
    '\u3019',
    '\u301B',
    '\u30FC',
    '\u3005',
    '\u303B',
    '\u309D',
    '\u309E',
    '\u30FD',
    '\u30FE',
]);
const kinsokuEnd = new Set([
    '"',
    '(', '[', '{',
    '“', '‘', '«', '‹',
    '\uFF08',
    '\u3014',
    '\u3008',
    '\u300A',
    '\u300C',
    '\u300E',
    '\u3010',
    '\u3016',
    '\u3018',
    '\u301A',
]);
const forwardStickyGlue = new Set([
    "'", '’',
]);
const leftStickyPunctuation = new Set([
    '.', ',', '!', '?', ':', ';',
    '\u060C',
    '\u061B',
    '\u061F',
    '\u0964',
    '\u0965',
    '\u104A',
    '\u104B',
    '\u104C',
    '\u104D',
    '\u104F',
    ')', ']', '}',
    '%',
    '"',
    '”', '’', '»', '›',
    '…',
]);
const arabicNoSpaceTrailingPunctuation = new Set([
    ':',
    '.',
    '\u060C',
    '\u061B',
]);
const myanmarMedialGlue = new Set([
    '\u104F',
]);
const closingQuoteChars = new Set([
    '”', '’', '»', '›',
    '\u300D',
    '\u300F',
    '\u3011',
    '\u300B',
    '\u3009',
    '\u3015',
    '\uFF09',
]);
function isLeftStickyPunctuationSegment(segment) {
    if (isEscapedQuoteClusterSegment(segment))
        return true;
    let sawPunctuation = false;
    for (const ch of segment) {
        if (leftStickyPunctuation.has(ch)) {
            sawPunctuation = true;
            continue;
        }
        if (sawPunctuation && combiningMarkRe.test(ch))
            continue;
        return false;
    }
    return sawPunctuation;
}
function isCJKLineStartProhibitedSegment(segment) {
    for (const ch of segment) {
        if (!kinsokuStart.has(ch) && !leftStickyPunctuation.has(ch))
            return false;
    }
    return segment.length > 0;
}
function isForwardStickyClusterSegment(segment) {
    if (isEscapedQuoteClusterSegment(segment))
        return true;
    for (const ch of segment) {
        if (!kinsokuEnd.has(ch) && !forwardStickyGlue.has(ch) && !combiningMarkRe.test(ch))
            return false;
    }
    return segment.length > 0;
}
function isEscapedQuoteClusterSegment(segment) {
    let sawQuote = false;
    for (const ch of segment) {
        if (ch === '\\' || combiningMarkRe.test(ch))
            continue;
        if (kinsokuEnd.has(ch) || leftStickyPunctuation.has(ch) || forwardStickyGlue.has(ch)) {
            sawQuote = true;
            continue;
        }
        return false;
    }
    return sawQuote;
}
function splitTrailingForwardStickyCluster(text) {
    const chars = Array.from(text);
    let splitIndex = chars.length;
    while (splitIndex > 0) {
        const ch = chars[splitIndex - 1];
        if (combiningMarkRe.test(ch)) {
            splitIndex--;
            continue;
        }
        if (kinsokuEnd.has(ch) || forwardStickyGlue.has(ch)) {
            splitIndex--;
            continue;
        }
        break;
    }
    if (splitIndex <= 0 || splitIndex === chars.length)
        return null;
    return {
        head: chars.slice(0, splitIndex).join(''),
        tail: chars.slice(splitIndex).join(''),
    };
}
function isRepeatedSingleCharRun(segment, ch) {
    if (segment.length === 0)
        return false;
    for (const part of segment) {
        if (part !== ch)
            return false;
    }
    return true;
}
function endsWithArabicNoSpacePunctuation(segment) {
    if (!containsArabicScript(segment) || segment.length === 0)
        return false;
    return arabicNoSpaceTrailingPunctuation.has(segment[segment.length - 1]);
}
function endsWithMyanmarMedialGlue(segment) {
    if (segment.length === 0)
        return false;
    return myanmarMedialGlue.has(segment[segment.length - 1]);
}
function splitLeadingSpaceAndMarks(segment) {
    if (segment.length < 2 || segment[0] !== ' ')
        return null;
    const marks = segment.slice(1);
    if (/^\p{M}+$/u.test(marks)) {
        return { space: ' ', marks };
    }
    return null;
}
function endsWithClosingQuote(text) {
    for (let i = text.length - 1; i >= 0; i--) {
        const ch = text[i];
        if (closingQuoteChars.has(ch))
            return true;
        if (!leftStickyPunctuation.has(ch))
            return false;
    }
    return false;
}
function classifySegmentBreakChar(ch, whiteSpaceProfile) {
    if (whiteSpaceProfile.preserveOrdinarySpaces || whiteSpaceProfile.preserveHardBreaks) {
        if (ch === ' ')
            return 'preserved-space';
        if (ch === '\t')
            return 'tab';
        if (whiteSpaceProfile.preserveHardBreaks && ch === '\n')
            return 'hard-break';
    }
    if (ch === ' ')
        return 'space';
    if (ch === '\u00A0' || ch === '\u202F' || ch === '\u2060' || ch === '\uFEFF') {
        return 'glue';
    }
    if (ch === '\u200B')
        return 'zero-width-break';
    if (ch === '\u00AD')
        return 'soft-hyphen';
    return 'text';
}
function joinTextParts(parts) {
    return parts.length === 1 ? parts[0] : parts.join('');
}
function splitSegmentByBreakKind(segment, isWordLike, start, whiteSpaceProfile) {
    const pieces = [];
    let currentKind = null;
    let currentTextParts = [];
    let currentStart = start;
    let currentWordLike = false;
    let offset = 0;
    for (const ch of segment) {
        const kind = classifySegmentBreakChar(ch, whiteSpaceProfile);
        const wordLike = kind === 'text' && isWordLike;
        if (currentKind !== null && kind === currentKind && wordLike === currentWordLike) {
            currentTextParts.push(ch);
            offset += ch.length;
            continue;
        }
        if (currentKind !== null) {
            pieces.push({
                text: joinTextParts(currentTextParts),
                isWordLike: currentWordLike,
                kind: currentKind,
                start: currentStart,
            });
        }
        currentKind = kind;
        currentTextParts = [ch];
        currentStart = start + offset;
        currentWordLike = wordLike;
        offset += ch.length;
    }
    if (currentKind !== null) {
        pieces.push({
            text: joinTextParts(currentTextParts),
            isWordLike: currentWordLike,
            kind: currentKind,
            start: currentStart,
        });
    }
    return pieces;
}
function isTextRunBoundary(kind) {
    return (kind === 'space' ||
        kind === 'preserved-space' ||
        kind === 'zero-width-break' ||
        kind === 'hard-break');
}
const urlSchemeSegmentRe = /^[A-Za-z][A-Za-z0-9+.-]*:$/;
function isUrlLikeRunStart(segmentation, index) {
    const text = segmentation.texts[index];
    if (text.startsWith('www.'))
        return true;
    return (urlSchemeSegmentRe.test(text) &&
        index + 1 < segmentation.len &&
        segmentation.kinds[index + 1] === 'text' &&
        segmentation.texts[index + 1] === '//');
}
function isUrlQueryBoundarySegment(text) {
    return text.includes('?') && (text.includes('://') || text.startsWith('www.'));
}
function mergeUrlLikeRuns(segmentation) {
    const texts = segmentation.texts.slice();
    const isWordLike = segmentation.isWordLike.slice();
    const kinds = segmentation.kinds.slice();
    const starts = segmentation.starts.slice();
    for (let i = 0; i < segmentation.len; i++) {
        if (kinds[i] !== 'text' || !isUrlLikeRunStart(segmentation, i))
            continue;
        const mergedParts = [texts[i]];
        let j = i + 1;
        while (j < segmentation.len && !isTextRunBoundary(kinds[j])) {
            mergedParts.push(texts[j]);
            isWordLike[i] = true;
            const endsQueryPrefix = texts[j].includes('?');
            kinds[j] = 'text';
            texts[j] = '';
            j++;
            if (endsQueryPrefix)
                break;
        }
        texts[i] = joinTextParts(mergedParts);
    }
    let compactLen = 0;
    for (let read = 0; read < texts.length; read++) {
        const text = texts[read];
        if (text.length === 0)
            continue;
        if (compactLen !== read) {
            texts[compactLen] = text;
            isWordLike[compactLen] = isWordLike[read];
            kinds[compactLen] = kinds[read];
            starts[compactLen] = starts[read];
        }
        compactLen++;
    }
    texts.length = compactLen;
    isWordLike.length = compactLen;
    kinds.length = compactLen;
    starts.length = compactLen;
    return {
        len: compactLen,
        texts,
        isWordLike,
        kinds,
        starts,
    };
}
function mergeUrlQueryRuns(segmentation) {
    const texts = [];
    const isWordLike = [];
    const kinds = [];
    const starts = [];
    for (let i = 0; i < segmentation.len; i++) {
        const text = segmentation.texts[i];
        texts.push(text);
        isWordLike.push(segmentation.isWordLike[i]);
        kinds.push(segmentation.kinds[i]);
        starts.push(segmentation.starts[i]);
        if (!isUrlQueryBoundarySegment(text))
            continue;
        const nextIndex = i + 1;
        if (nextIndex >= segmentation.len ||
            isTextRunBoundary(segmentation.kinds[nextIndex])) {
            continue;
        }
        const queryParts = [];
        const queryStart = segmentation.starts[nextIndex];
        let j = nextIndex;
        while (j < segmentation.len && !isTextRunBoundary(segmentation.kinds[j])) {
            queryParts.push(segmentation.texts[j]);
            j++;
        }
        if (queryParts.length > 0) {
            texts.push(joinTextParts(queryParts));
            isWordLike.push(true);
            kinds.push('text');
            starts.push(queryStart);
            i = j - 1;
        }
    }
    return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts,
    };
}
const numericJoinerChars = new Set([
    ':', '-', '/', '×', ',', '.', '+',
    '\u2013',
    '\u2014',
]);
const asciiPunctuationChainSegmentRe = /^[A-Za-z0-9_]+[,:;]*$/;
const asciiPunctuationChainTrailingJoinersRe = /[,:;]+$/;
function segmentContainsDecimalDigit(text) {
    for (const ch of text) {
        if (decimalDigitRe.test(ch))
            return true;
    }
    return false;
}
function isNumericRunSegment(text) {
    if (text.length === 0)
        return false;
    for (const ch of text) {
        if (decimalDigitRe.test(ch) || numericJoinerChars.has(ch))
            continue;
        return false;
    }
    return true;
}
function mergeNumericRuns(segmentation) {
    const texts = [];
    const isWordLike = [];
    const kinds = [];
    const starts = [];
    for (let i = 0; i < segmentation.len; i++) {
        const text = segmentation.texts[i];
        const kind = segmentation.kinds[i];
        if (kind === 'text' && isNumericRunSegment(text) && segmentContainsDecimalDigit(text)) {
            const mergedParts = [text];
            let j = i + 1;
            while (j < segmentation.len &&
                segmentation.kinds[j] === 'text' &&
                isNumericRunSegment(segmentation.texts[j])) {
                mergedParts.push(segmentation.texts[j]);
                j++;
            }
            texts.push(joinTextParts(mergedParts));
            isWordLike.push(true);
            kinds.push('text');
            starts.push(segmentation.starts[i]);
            i = j - 1;
            continue;
        }
        texts.push(text);
        isWordLike.push(segmentation.isWordLike[i]);
        kinds.push(kind);
        starts.push(segmentation.starts[i]);
    }
    return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts,
    };
}
function mergeAsciiPunctuationChains(segmentation) {
    const texts = [];
    const isWordLike = [];
    const kinds = [];
    const starts = [];
    for (let i = 0; i < segmentation.len; i++) {
        const text = segmentation.texts[i];
        const kind = segmentation.kinds[i];
        const wordLike = segmentation.isWordLike[i];
        if (kind === 'text' && wordLike && asciiPunctuationChainSegmentRe.test(text)) {
            const mergedParts = [text];
            let endsWithJoiners = asciiPunctuationChainTrailingJoinersRe.test(text);
            let j = i + 1;
            while (endsWithJoiners &&
                j < segmentation.len &&
                segmentation.kinds[j] === 'text' &&
                segmentation.isWordLike[j] &&
                asciiPunctuationChainSegmentRe.test(segmentation.texts[j])) {
                const nextText = segmentation.texts[j];
                mergedParts.push(nextText);
                endsWithJoiners = asciiPunctuationChainTrailingJoinersRe.test(nextText);
                j++;
            }
            texts.push(joinTextParts(mergedParts));
            isWordLike.push(true);
            kinds.push('text');
            starts.push(segmentation.starts[i]);
            i = j - 1;
            continue;
        }
        texts.push(text);
        isWordLike.push(wordLike);
        kinds.push(kind);
        starts.push(segmentation.starts[i]);
    }
    return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts,
    };
}
function splitHyphenatedNumericRuns(segmentation) {
    const texts = [];
    const isWordLike = [];
    const kinds = [];
    const starts = [];
    for (let i = 0; i < segmentation.len; i++) {
        const text = segmentation.texts[i];
        if (segmentation.kinds[i] === 'text' && text.includes('-')) {
            const parts = text.split('-');
            let shouldSplit = parts.length > 1;
            for (let j = 0; j < parts.length; j++) {
                const part = parts[j];
                if (!shouldSplit)
                    break;
                if (part.length === 0 ||
                    !segmentContainsDecimalDigit(part) ||
                    !isNumericRunSegment(part)) {
                    shouldSplit = false;
                }
            }
            if (shouldSplit) {
                let offset = 0;
                for (let j = 0; j < parts.length; j++) {
                    const part = parts[j];
                    const splitText = j < parts.length - 1 ? `${part}-` : part;
                    texts.push(splitText);
                    isWordLike.push(true);
                    kinds.push('text');
                    starts.push(segmentation.starts[i] + offset);
                    offset += splitText.length;
                }
                continue;
            }
        }
        texts.push(text);
        isWordLike.push(segmentation.isWordLike[i]);
        kinds.push(segmentation.kinds[i]);
        starts.push(segmentation.starts[i]);
    }
    return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts,
    };
}
function mergeGlueConnectedTextRuns(segmentation) {
    const texts = [];
    const isWordLike = [];
    const kinds = [];
    const starts = [];
    let read = 0;
    while (read < segmentation.len) {
        const textParts = [segmentation.texts[read]];
        let wordLike = segmentation.isWordLike[read];
        let kind = segmentation.kinds[read];
        let start = segmentation.starts[read];
        if (kind === 'glue') {
            const glueParts = [textParts[0]];
            const glueStart = start;
            read++;
            while (read < segmentation.len && segmentation.kinds[read] === 'glue') {
                glueParts.push(segmentation.texts[read]);
                read++;
            }
            const glueText = joinTextParts(glueParts);
            if (read < segmentation.len && segmentation.kinds[read] === 'text') {
                textParts[0] = glueText;
                textParts.push(segmentation.texts[read]);
                wordLike = segmentation.isWordLike[read];
                kind = 'text';
                start = glueStart;
                read++;
            }
            else {
                texts.push(glueText);
                isWordLike.push(false);
                kinds.push('glue');
                starts.push(glueStart);
                continue;
            }
        }
        else {
            read++;
        }
        if (kind === 'text') {
            while (read < segmentation.len && segmentation.kinds[read] === 'glue') {
                const glueParts = [];
                while (read < segmentation.len && segmentation.kinds[read] === 'glue') {
                    glueParts.push(segmentation.texts[read]);
                    read++;
                }
                const glueText = joinTextParts(glueParts);
                if (read < segmentation.len && segmentation.kinds[read] === 'text') {
                    textParts.push(glueText, segmentation.texts[read]);
                    wordLike = wordLike || segmentation.isWordLike[read];
                    read++;
                    continue;
                }
                textParts.push(glueText);
            }
        }
        texts.push(joinTextParts(textParts));
        isWordLike.push(wordLike);
        kinds.push(kind);
        starts.push(start);
    }
    return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts,
    };
}
function carryTrailingForwardStickyAcrossCJKBoundary(segmentation) {
    const texts = segmentation.texts.slice();
    const isWordLike = segmentation.isWordLike.slice();
    const kinds = segmentation.kinds.slice();
    const starts = segmentation.starts.slice();
    for (let i = 0; i < texts.length - 1; i++) {
        if (kinds[i] !== 'text' || kinds[i + 1] !== 'text')
            continue;
        if (!isCJK(texts[i]) || !isCJK(texts[i + 1]))
            continue;
        const split = splitTrailingForwardStickyCluster(texts[i]);
        if (split === null)
            continue;
        texts[i] = split.head;
        texts[i + 1] = split.tail + texts[i + 1];
        starts[i + 1] = starts[i] + split.head.length;
    }
    return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts,
    };
}
function buildMergedSegmentation(normalized, profile, whiteSpaceProfile) {
    const wordSegmenter = getSharedWordSegmenter();
    let mergedLen = 0;
    const mergedTexts = [];
    const mergedWordLike = [];
    const mergedKinds = [];
    const mergedStarts = [];
    for (const s of wordSegmenter.segment(normalized)) {
        for (const piece of splitSegmentByBreakKind(s.segment, s.isWordLike ?? false, s.index, whiteSpaceProfile)) {
            const isText = piece.kind === 'text';
            if (profile.carryCJKAfterClosingQuote &&
                isText &&
                mergedLen > 0 &&
                mergedKinds[mergedLen - 1] === 'text' &&
                isCJK(piece.text) &&
                isCJK(mergedTexts[mergedLen - 1]) &&
                endsWithClosingQuote(mergedTexts[mergedLen - 1])) {
                mergedTexts[mergedLen - 1] += piece.text;
                mergedWordLike[mergedLen - 1] = mergedWordLike[mergedLen - 1] || piece.isWordLike;
            }
            else if (isText &&
                mergedLen > 0 &&
                mergedKinds[mergedLen - 1] === 'text' &&
                isCJKLineStartProhibitedSegment(piece.text) &&
                isCJK(mergedTexts[mergedLen - 1])) {
                mergedTexts[mergedLen - 1] += piece.text;
                mergedWordLike[mergedLen - 1] = mergedWordLike[mergedLen - 1] || piece.isWordLike;
            }
            else if (isText &&
                mergedLen > 0 &&
                mergedKinds[mergedLen - 1] === 'text' &&
                endsWithMyanmarMedialGlue(mergedTexts[mergedLen - 1])) {
                mergedTexts[mergedLen - 1] += piece.text;
                mergedWordLike[mergedLen - 1] = mergedWordLike[mergedLen - 1] || piece.isWordLike;
            }
            else if (isText &&
                mergedLen > 0 &&
                mergedKinds[mergedLen - 1] === 'text' &&
                piece.isWordLike &&
                containsArabicScript(piece.text) &&
                endsWithArabicNoSpacePunctuation(mergedTexts[mergedLen - 1])) {
                mergedTexts[mergedLen - 1] += piece.text;
                mergedWordLike[mergedLen - 1] = true;
            }
            else if (isText &&
                !piece.isWordLike &&
                mergedLen > 0 &&
                mergedKinds[mergedLen - 1] === 'text' &&
                piece.text.length === 1 &&
                piece.text !== '-' &&
                piece.text !== '—' &&
                isRepeatedSingleCharRun(mergedTexts[mergedLen - 1], piece.text)) {
                mergedTexts[mergedLen - 1] += piece.text;
            }
            else if (isText &&
                !piece.isWordLike &&
                mergedLen > 0 &&
                mergedKinds[mergedLen - 1] === 'text' &&
                (isLeftStickyPunctuationSegment(piece.text) ||
                    (piece.text === '-' && mergedWordLike[mergedLen - 1]))) {
                mergedTexts[mergedLen - 1] += piece.text;
            }
            else {
                mergedTexts[mergedLen] = piece.text;
                mergedWordLike[mergedLen] = piece.isWordLike;
                mergedKinds[mergedLen] = piece.kind;
                mergedStarts[mergedLen] = piece.start;
                mergedLen++;
            }
        }
    }
    for (let i = 1; i < mergedLen; i++) {
        if (mergedKinds[i] === 'text' &&
            !mergedWordLike[i] &&
            isEscapedQuoteClusterSegment(mergedTexts[i]) &&
            mergedKinds[i - 1] === 'text') {
            mergedTexts[i - 1] += mergedTexts[i];
            mergedWordLike[i - 1] = mergedWordLike[i - 1] || mergedWordLike[i];
            mergedTexts[i] = '';
        }
    }
    for (let i = mergedLen - 2; i >= 0; i--) {
        if (mergedKinds[i] === 'text' && !mergedWordLike[i] && isForwardStickyClusterSegment(mergedTexts[i])) {
            let j = i + 1;
            while (j < mergedLen && mergedTexts[j] === '')
                j++;
            if (j < mergedLen && mergedKinds[j] === 'text') {
                mergedTexts[j] = mergedTexts[i] + mergedTexts[j];
                mergedStarts[j] = mergedStarts[i];
                mergedTexts[i] = '';
            }
        }
    }
    let compactLen = 0;
    for (let read = 0; read < mergedLen; read++) {
        const text = mergedTexts[read];
        if (text.length === 0)
            continue;
        if (compactLen !== read) {
            mergedTexts[compactLen] = text;
            mergedWordLike[compactLen] = mergedWordLike[read];
            mergedKinds[compactLen] = mergedKinds[read];
            mergedStarts[compactLen] = mergedStarts[read];
        }
        compactLen++;
    }
    mergedTexts.length = compactLen;
    mergedWordLike.length = compactLen;
    mergedKinds.length = compactLen;
    mergedStarts.length = compactLen;
    const compacted = mergeGlueConnectedTextRuns({
        len: compactLen,
        texts: mergedTexts,
        isWordLike: mergedWordLike,
        kinds: mergedKinds,
        starts: mergedStarts,
    });
    const withMergedUrls = carryTrailingForwardStickyAcrossCJKBoundary(mergeAsciiPunctuationChains(splitHyphenatedNumericRuns(mergeNumericRuns(mergeUrlQueryRuns(mergeUrlLikeRuns(compacted))))));
    for (let i = 0; i < withMergedUrls.len - 1; i++) {
        const split = splitLeadingSpaceAndMarks(withMergedUrls.texts[i]);
        if (split === null)
            continue;
        if ((withMergedUrls.kinds[i] !== 'space' && withMergedUrls.kinds[i] !== 'preserved-space') ||
            withMergedUrls.kinds[i + 1] !== 'text' ||
            !containsArabicScript(withMergedUrls.texts[i + 1])) {
            continue;
        }
        withMergedUrls.texts[i] = split.space;
        withMergedUrls.isWordLike[i] = false;
        withMergedUrls.kinds[i] = withMergedUrls.kinds[i] === 'preserved-space' ? 'preserved-space' : 'space';
        withMergedUrls.texts[i + 1] = split.marks + withMergedUrls.texts[i + 1];
        withMergedUrls.starts[i + 1] = withMergedUrls.starts[i] + split.space.length;
    }
    return withMergedUrls;
}
function compileAnalysisChunks(segmentation, whiteSpaceProfile) {
    if (segmentation.len === 0)
        return [];
    if (!whiteSpaceProfile.preserveHardBreaks) {
        return [{
                startSegmentIndex: 0,
                endSegmentIndex: segmentation.len,
                consumedEndSegmentIndex: segmentation.len,
            }];
    }
    const chunks = [];
    let startSegmentIndex = 0;
    for (let i = 0; i < segmentation.len; i++) {
        if (segmentation.kinds[i] !== 'hard-break')
            continue;
        chunks.push({
            startSegmentIndex,
            endSegmentIndex: i,
            consumedEndSegmentIndex: i + 1,
        });
        startSegmentIndex = i + 1;
    }
    if (startSegmentIndex < segmentation.len) {
        chunks.push({
            startSegmentIndex,
            endSegmentIndex: segmentation.len,
            consumedEndSegmentIndex: segmentation.len,
        });
    }
    return chunks;
}
function analyzeText(text, profile, whiteSpace = 'normal') {
    const whiteSpaceProfile = getWhiteSpaceProfile(whiteSpace);
    const normalized = whiteSpaceProfile.mode === 'pre-wrap'
        ? normalizeWhitespacePreWrap(text)
        : normalizeWhitespaceNormal(text);
    if (normalized.length === 0) {
        return {
            normalized,
            chunks: [],
            len: 0,
            texts: [],
            isWordLike: [],
            kinds: [],
            starts: [],
        };
    }
    const segmentation = buildMergedSegmentation(normalized, profile, whiteSpaceProfile);
    return {
        normalized,
        chunks: compileAnalysisChunks(segmentation, whiteSpaceProfile),
        ...segmentation,
    };
}

let measureContext = null;
const segmentMetricCaches = new Map();
let cachedEngineProfile = null;
const emojiPresentationRe = /\p{Emoji_Presentation}/u;
const maybeEmojiRe = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u;
let sharedGraphemeSegmenter$1 = null;
const emojiCorrectionCache = new Map();
function getMeasureContext() {
    if (measureContext !== null)
        return measureContext;
    if (typeof OffscreenCanvas !== 'undefined') {
        measureContext = new OffscreenCanvas(1, 1).getContext('2d');
        return measureContext;
    }
    if (typeof document !== 'undefined') {
        measureContext = document.createElement('canvas').getContext('2d');
        return measureContext;
    }
    throw new Error('Text measurement requires OffscreenCanvas or a DOM canvas context.');
}
function getSegmentMetricCache(font) {
    let cache = segmentMetricCaches.get(font);
    if (!cache) {
        cache = new Map();
        segmentMetricCaches.set(font, cache);
    }
    return cache;
}
function getSegmentMetrics(seg, cache) {
    let metrics = cache.get(seg);
    if (metrics === undefined) {
        const ctx = getMeasureContext();
        metrics = {
            width: ctx.measureText(seg).width,
            containsCJK: isCJK(seg),
        };
        cache.set(seg, metrics);
    }
    return metrics;
}
function getEngineProfile() {
    if (cachedEngineProfile !== null)
        return cachedEngineProfile;
    if (typeof navigator === 'undefined') {
        cachedEngineProfile = {
            lineFitEpsilon: 0.005,
            carryCJKAfterClosingQuote: false,
            preferPrefixWidthsForBreakableRuns: false,
            preferEarlySoftHyphenBreak: false,
        };
        return cachedEngineProfile;
    }
    const ua = navigator.userAgent;
    const vendor = navigator.vendor;
    const isSafari = vendor === 'Apple Computer, Inc.' &&
        ua.includes('Safari/') &&
        !ua.includes('Chrome/') &&
        !ua.includes('Chromium/') &&
        !ua.includes('CriOS/') &&
        !ua.includes('FxiOS/') &&
        !ua.includes('EdgiOS/');
    const isChromium = ua.includes('Chrome/') ||
        ua.includes('Chromium/') ||
        ua.includes('CriOS/') ||
        ua.includes('Edg/');
    cachedEngineProfile = {
        lineFitEpsilon: isSafari ? 1 / 64 : 0.005,
        carryCJKAfterClosingQuote: isChromium,
        preferPrefixWidthsForBreakableRuns: isSafari,
        preferEarlySoftHyphenBreak: isSafari,
    };
    return cachedEngineProfile;
}
function parseFontSize(font) {
    const m = font.match(/(\d+(?:\.\d+)?)\s*px/);
    return m ? parseFloat(m[1]) : 16;
}
function getSharedGraphemeSegmenter$1() {
    if (sharedGraphemeSegmenter$1 === null) {
        sharedGraphemeSegmenter$1 = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    }
    return sharedGraphemeSegmenter$1;
}
function isEmojiGrapheme(g) {
    return emojiPresentationRe.test(g) || g.includes('\uFE0F');
}
function textMayContainEmoji(text) {
    return maybeEmojiRe.test(text);
}
function getEmojiCorrection(font, fontSize) {
    let correction = emojiCorrectionCache.get(font);
    if (correction !== undefined)
        return correction;
    const ctx = getMeasureContext();
    ctx.font = font;
    const canvasW = ctx.measureText('\u{1F600}').width;
    correction = 0;
    if (canvasW > fontSize + 0.5 &&
        typeof document !== 'undefined' &&
        document.body !== null) {
        const span = document.createElement('span');
        span.style.font = font;
        span.style.display = 'inline-block';
        span.style.visibility = 'hidden';
        span.style.position = 'absolute';
        span.textContent = '\u{1F600}';
        document.body.appendChild(span);
        const domW = span.getBoundingClientRect().width;
        document.body.removeChild(span);
        if (canvasW - domW > 0.5) {
            correction = canvasW - domW;
        }
    }
    emojiCorrectionCache.set(font, correction);
    return correction;
}
function countEmojiGraphemes(text) {
    let count = 0;
    const graphemeSegmenter = getSharedGraphemeSegmenter$1();
    for (const g of graphemeSegmenter.segment(text)) {
        if (isEmojiGrapheme(g.segment))
            count++;
    }
    return count;
}
function getEmojiCount(seg, metrics) {
    if (metrics.emojiCount === undefined) {
        metrics.emojiCount = countEmojiGraphemes(seg);
    }
    return metrics.emojiCount;
}
function getCorrectedSegmentWidth(seg, metrics, emojiCorrection) {
    if (emojiCorrection === 0)
        return metrics.width;
    return metrics.width - getEmojiCount(seg, metrics) * emojiCorrection;
}
function getSegmentGraphemeWidths(seg, metrics, cache, emojiCorrection) {
    if (metrics.graphemeWidths !== undefined)
        return metrics.graphemeWidths;
    const widths = [];
    const graphemeSegmenter = getSharedGraphemeSegmenter$1();
    for (const gs of graphemeSegmenter.segment(seg)) {
        const graphemeMetrics = getSegmentMetrics(gs.segment, cache);
        widths.push(getCorrectedSegmentWidth(gs.segment, graphemeMetrics, emojiCorrection));
    }
    metrics.graphemeWidths = widths.length > 1 ? widths : null;
    return metrics.graphemeWidths;
}
function getSegmentGraphemePrefixWidths(seg, metrics, cache, emojiCorrection) {
    if (metrics.graphemePrefixWidths !== undefined)
        return metrics.graphemePrefixWidths;
    const prefixWidths = [];
    const graphemeSegmenter = getSharedGraphemeSegmenter$1();
    let prefix = '';
    for (const gs of graphemeSegmenter.segment(seg)) {
        prefix += gs.segment;
        const prefixMetrics = getSegmentMetrics(prefix, cache);
        prefixWidths.push(getCorrectedSegmentWidth(prefix, prefixMetrics, emojiCorrection));
    }
    metrics.graphemePrefixWidths = prefixWidths.length > 1 ? prefixWidths : null;
    return metrics.graphemePrefixWidths;
}
function getFontMeasurementState(font, needsEmojiCorrection) {
    const ctx = getMeasureContext();
    ctx.font = font;
    const cache = getSegmentMetricCache(font);
    const fontSize = parseFontSize(font);
    const emojiCorrection = needsEmojiCorrection ? getEmojiCorrection(font, fontSize) : 0;
    return { cache, fontSize, emojiCorrection };
}

function canBreakAfter(kind) {
    return (kind === 'space' ||
        kind === 'preserved-space' ||
        kind === 'tab' ||
        kind === 'zero-width-break' ||
        kind === 'soft-hyphen');
}
function normalizeSimpleLineStartSegmentIndex(prepared, segmentIndex) {
    while (segmentIndex < prepared.widths.length) {
        const kind = prepared.kinds[segmentIndex];
        if (kind !== 'space' && kind !== 'zero-width-break' && kind !== 'soft-hyphen')
            break;
        segmentIndex++;
    }
    return segmentIndex;
}
function getTabAdvance(lineWidth, tabStopAdvance) {
    if (tabStopAdvance <= 0)
        return 0;
    const remainder = lineWidth % tabStopAdvance;
    if (Math.abs(remainder) <= 1e-6)
        return tabStopAdvance;
    return tabStopAdvance - remainder;
}
function getBreakableAdvance(graphemeWidths, graphemePrefixWidths, graphemeIndex, preferPrefixWidths) {
    if (!preferPrefixWidths || graphemePrefixWidths === null) {
        return graphemeWidths[graphemeIndex];
    }
    return graphemePrefixWidths[graphemeIndex] - (graphemeIndex > 0 ? graphemePrefixWidths[graphemeIndex - 1] : 0);
}
function fitSoftHyphenBreak(graphemeWidths, initialWidth, maxWidth, lineFitEpsilon, discretionaryHyphenWidth, cumulativeWidths) {
    let fitCount = 0;
    let fittedWidth = initialWidth;
    while (fitCount < graphemeWidths.length) {
        const nextWidth = cumulativeWidths
            ? initialWidth + graphemeWidths[fitCount]
            : fittedWidth + graphemeWidths[fitCount];
        const nextLineWidth = fitCount + 1 < graphemeWidths.length
            ? nextWidth + discretionaryHyphenWidth
            : nextWidth;
        if (nextLineWidth > maxWidth + lineFitEpsilon)
            break;
        fittedWidth = nextWidth;
        fitCount++;
    }
    return { fitCount, fittedWidth };
}
function walkPreparedLinesSimple(prepared, maxWidth, onLine) {
    const { widths, kinds, breakableWidths, breakablePrefixWidths } = prepared;
    if (widths.length === 0)
        return 0;
    const engineProfile = getEngineProfile();
    const lineFitEpsilon = engineProfile.lineFitEpsilon;
    let lineCount = 0;
    let lineW = 0;
    let hasContent = false;
    let lineStartSegmentIndex = 0;
    let lineStartGraphemeIndex = 0;
    let lineEndSegmentIndex = 0;
    let lineEndGraphemeIndex = 0;
    let pendingBreakSegmentIndex = -1;
    let pendingBreakPaintWidth = 0;
    function clearPendingBreak() {
        pendingBreakSegmentIndex = -1;
        pendingBreakPaintWidth = 0;
    }
    function emitCurrentLine(endSegmentIndex = lineEndSegmentIndex, endGraphemeIndex = lineEndGraphemeIndex, width = lineW) {
        lineCount++;
        onLine?.({
            startSegmentIndex: lineStartSegmentIndex,
            startGraphemeIndex: lineStartGraphemeIndex,
            endSegmentIndex,
            endGraphemeIndex,
            width,
        });
        lineW = 0;
        hasContent = false;
        clearPendingBreak();
    }
    function startLineAtSegment(segmentIndex, width) {
        hasContent = true;
        lineStartSegmentIndex = segmentIndex;
        lineStartGraphemeIndex = 0;
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
        lineW = width;
    }
    function startLineAtGrapheme(segmentIndex, graphemeIndex, width) {
        hasContent = true;
        lineStartSegmentIndex = segmentIndex;
        lineStartGraphemeIndex = graphemeIndex;
        lineEndSegmentIndex = segmentIndex;
        lineEndGraphemeIndex = graphemeIndex + 1;
        lineW = width;
    }
    function appendWholeSegment(segmentIndex, width) {
        if (!hasContent) {
            startLineAtSegment(segmentIndex, width);
            return;
        }
        lineW += width;
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
    }
    function updatePendingBreak(segmentIndex, segmentWidth) {
        if (!canBreakAfter(kinds[segmentIndex]))
            return;
        pendingBreakSegmentIndex = segmentIndex + 1;
        pendingBreakPaintWidth = lineW - segmentWidth;
    }
    function appendBreakableSegment(segmentIndex) {
        appendBreakableSegmentFrom(segmentIndex, 0);
    }
    function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
        const gWidths = breakableWidths[segmentIndex];
        const gPrefixWidths = breakablePrefixWidths[segmentIndex] ?? null;
        for (let g = startGraphemeIndex; g < gWidths.length; g++) {
            const gw = getBreakableAdvance(gWidths, gPrefixWidths, g, engineProfile.preferPrefixWidthsForBreakableRuns);
            if (!hasContent) {
                startLineAtGrapheme(segmentIndex, g, gw);
                continue;
            }
            if (lineW + gw > maxWidth + lineFitEpsilon) {
                emitCurrentLine();
                startLineAtGrapheme(segmentIndex, g, gw);
            }
            else {
                lineW += gw;
                lineEndSegmentIndex = segmentIndex;
                lineEndGraphemeIndex = g + 1;
            }
        }
        if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === gWidths.length) {
            lineEndSegmentIndex = segmentIndex + 1;
            lineEndGraphemeIndex = 0;
        }
    }
    let i = 0;
    while (i < widths.length) {
        if (!hasContent) {
            i = normalizeSimpleLineStartSegmentIndex(prepared, i);
            if (i >= widths.length)
                break;
        }
        const w = widths[i];
        const kind = kinds[i];
        if (!hasContent) {
            if (w > maxWidth && breakableWidths[i] !== null) {
                appendBreakableSegment(i);
            }
            else {
                startLineAtSegment(i, w);
            }
            updatePendingBreak(i, w);
            i++;
            continue;
        }
        const newW = lineW + w;
        if (newW > maxWidth + lineFitEpsilon) {
            if (canBreakAfter(kind)) {
                appendWholeSegment(i, w);
                emitCurrentLine(i + 1, 0, lineW - w);
                i++;
                continue;
            }
            if (pendingBreakSegmentIndex >= 0) {
                if (lineEndSegmentIndex > pendingBreakSegmentIndex ||
                    (lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0)) {
                    emitCurrentLine();
                    continue;
                }
                emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
                continue;
            }
            if (w > maxWidth && breakableWidths[i] !== null) {
                emitCurrentLine();
                appendBreakableSegment(i);
                i++;
                continue;
            }
            emitCurrentLine();
            continue;
        }
        appendWholeSegment(i, w);
        updatePendingBreak(i, w);
        i++;
    }
    if (hasContent)
        emitCurrentLine();
    return lineCount;
}
function walkPreparedLines(prepared, maxWidth, onLine) {
    if (prepared.simpleLineWalkFastPath) {
        return walkPreparedLinesSimple(prepared, maxWidth, onLine);
    }
    const { widths, lineEndFitAdvances, lineEndPaintAdvances, kinds, breakableWidths, breakablePrefixWidths, discretionaryHyphenWidth, tabStopAdvance, chunks, } = prepared;
    if (widths.length === 0 || chunks.length === 0)
        return 0;
    const engineProfile = getEngineProfile();
    const lineFitEpsilon = engineProfile.lineFitEpsilon;
    let lineCount = 0;
    let lineW = 0;
    let hasContent = false;
    let lineStartSegmentIndex = 0;
    let lineStartGraphemeIndex = 0;
    let lineEndSegmentIndex = 0;
    let lineEndGraphemeIndex = 0;
    let pendingBreakSegmentIndex = -1;
    let pendingBreakFitWidth = 0;
    let pendingBreakPaintWidth = 0;
    let pendingBreakKind = null;
    function clearPendingBreak() {
        pendingBreakSegmentIndex = -1;
        pendingBreakFitWidth = 0;
        pendingBreakPaintWidth = 0;
        pendingBreakKind = null;
    }
    function emitCurrentLine(endSegmentIndex = lineEndSegmentIndex, endGraphemeIndex = lineEndGraphemeIndex, width = lineW) {
        lineCount++;
        onLine?.({
            startSegmentIndex: lineStartSegmentIndex,
            startGraphemeIndex: lineStartGraphemeIndex,
            endSegmentIndex,
            endGraphemeIndex,
            width,
        });
        lineW = 0;
        hasContent = false;
        clearPendingBreak();
    }
    function startLineAtSegment(segmentIndex, width) {
        hasContent = true;
        lineStartSegmentIndex = segmentIndex;
        lineStartGraphemeIndex = 0;
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
        lineW = width;
    }
    function startLineAtGrapheme(segmentIndex, graphemeIndex, width) {
        hasContent = true;
        lineStartSegmentIndex = segmentIndex;
        lineStartGraphemeIndex = graphemeIndex;
        lineEndSegmentIndex = segmentIndex;
        lineEndGraphemeIndex = graphemeIndex + 1;
        lineW = width;
    }
    function appendWholeSegment(segmentIndex, width) {
        if (!hasContent) {
            startLineAtSegment(segmentIndex, width);
            return;
        }
        lineW += width;
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
    }
    function updatePendingBreakForWholeSegment(segmentIndex, segmentWidth) {
        if (!canBreakAfter(kinds[segmentIndex]))
            return;
        const fitAdvance = kinds[segmentIndex] === 'tab' ? 0 : lineEndFitAdvances[segmentIndex];
        const paintAdvance = kinds[segmentIndex] === 'tab' ? segmentWidth : lineEndPaintAdvances[segmentIndex];
        pendingBreakSegmentIndex = segmentIndex + 1;
        pendingBreakFitWidth = lineW - segmentWidth + fitAdvance;
        pendingBreakPaintWidth = lineW - segmentWidth + paintAdvance;
        pendingBreakKind = kinds[segmentIndex];
    }
    function appendBreakableSegment(segmentIndex) {
        appendBreakableSegmentFrom(segmentIndex, 0);
    }
    function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
        const gWidths = breakableWidths[segmentIndex];
        const gPrefixWidths = breakablePrefixWidths[segmentIndex] ?? null;
        for (let g = startGraphemeIndex; g < gWidths.length; g++) {
            const gw = getBreakableAdvance(gWidths, gPrefixWidths, g, engineProfile.preferPrefixWidthsForBreakableRuns);
            if (!hasContent) {
                startLineAtGrapheme(segmentIndex, g, gw);
                continue;
            }
            if (lineW + gw > maxWidth + lineFitEpsilon) {
                emitCurrentLine();
                startLineAtGrapheme(segmentIndex, g, gw);
            }
            else {
                lineW += gw;
                lineEndSegmentIndex = segmentIndex;
                lineEndGraphemeIndex = g + 1;
            }
        }
        if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === gWidths.length) {
            lineEndSegmentIndex = segmentIndex + 1;
            lineEndGraphemeIndex = 0;
        }
    }
    function continueSoftHyphenBreakableSegment(segmentIndex) {
        if (pendingBreakKind !== 'soft-hyphen')
            return false;
        const gWidths = breakableWidths[segmentIndex];
        if (gWidths === null)
            return false;
        const fitWidths = engineProfile.preferPrefixWidthsForBreakableRuns
            ? breakablePrefixWidths[segmentIndex] ?? gWidths
            : gWidths;
        const usesPrefixWidths = fitWidths !== gWidths;
        const { fitCount, fittedWidth } = fitSoftHyphenBreak(fitWidths, lineW, maxWidth, lineFitEpsilon, discretionaryHyphenWidth, usesPrefixWidths);
        if (fitCount === 0)
            return false;
        lineW = fittedWidth;
        lineEndSegmentIndex = segmentIndex;
        lineEndGraphemeIndex = fitCount;
        clearPendingBreak();
        if (fitCount === gWidths.length) {
            lineEndSegmentIndex = segmentIndex + 1;
            lineEndGraphemeIndex = 0;
            return true;
        }
        emitCurrentLine(segmentIndex, fitCount, fittedWidth + discretionaryHyphenWidth);
        appendBreakableSegmentFrom(segmentIndex, fitCount);
        return true;
    }
    function emitEmptyChunk(chunk) {
        lineCount++;
        onLine?.({
            startSegmentIndex: chunk.startSegmentIndex,
            startGraphemeIndex: 0,
            endSegmentIndex: chunk.consumedEndSegmentIndex,
            endGraphemeIndex: 0,
            width: 0,
        });
        clearPendingBreak();
    }
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        if (chunk.startSegmentIndex === chunk.endSegmentIndex) {
            emitEmptyChunk(chunk);
            continue;
        }
        hasContent = false;
        lineW = 0;
        lineStartSegmentIndex = chunk.startSegmentIndex;
        lineStartGraphemeIndex = 0;
        lineEndSegmentIndex = chunk.startSegmentIndex;
        lineEndGraphemeIndex = 0;
        clearPendingBreak();
        let i = chunk.startSegmentIndex;
        while (i < chunk.endSegmentIndex) {
            const kind = kinds[i];
            const w = kind === 'tab' ? getTabAdvance(lineW, tabStopAdvance) : widths[i];
            if (kind === 'soft-hyphen') {
                if (hasContent) {
                    lineEndSegmentIndex = i + 1;
                    lineEndGraphemeIndex = 0;
                    pendingBreakSegmentIndex = i + 1;
                    pendingBreakFitWidth = lineW + discretionaryHyphenWidth;
                    pendingBreakPaintWidth = lineW + discretionaryHyphenWidth;
                    pendingBreakKind = kind;
                }
                i++;
                continue;
            }
            if (!hasContent) {
                if (w > maxWidth && breakableWidths[i] !== null) {
                    appendBreakableSegment(i);
                }
                else {
                    startLineAtSegment(i, w);
                }
                updatePendingBreakForWholeSegment(i, w);
                i++;
                continue;
            }
            const newW = lineW + w;
            if (newW > maxWidth + lineFitEpsilon) {
                const currentBreakFitWidth = lineW + (kind === 'tab' ? 0 : lineEndFitAdvances[i]);
                const currentBreakPaintWidth = lineW + (kind === 'tab' ? w : lineEndPaintAdvances[i]);
                if (pendingBreakKind === 'soft-hyphen' &&
                    engineProfile.preferEarlySoftHyphenBreak &&
                    pendingBreakFitWidth <= maxWidth + lineFitEpsilon) {
                    emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
                    continue;
                }
                if (pendingBreakKind === 'soft-hyphen' && continueSoftHyphenBreakableSegment(i)) {
                    i++;
                    continue;
                }
                if (canBreakAfter(kind) && currentBreakFitWidth <= maxWidth + lineFitEpsilon) {
                    appendWholeSegment(i, w);
                    emitCurrentLine(i + 1, 0, currentBreakPaintWidth);
                    i++;
                    continue;
                }
                if (pendingBreakSegmentIndex >= 0 && pendingBreakFitWidth <= maxWidth + lineFitEpsilon) {
                    if (lineEndSegmentIndex > pendingBreakSegmentIndex ||
                        (lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0)) {
                        emitCurrentLine();
                        continue;
                    }
                    const nextSegmentIndex = pendingBreakSegmentIndex;
                    emitCurrentLine(nextSegmentIndex, 0, pendingBreakPaintWidth);
                    i = nextSegmentIndex;
                    continue;
                }
                if (w > maxWidth && breakableWidths[i] !== null) {
                    emitCurrentLine();
                    appendBreakableSegment(i);
                    i++;
                    continue;
                }
                emitCurrentLine();
                continue;
            }
            appendWholeSegment(i, w);
            updatePendingBreakForWholeSegment(i, w);
            i++;
        }
        if (hasContent) {
            const finalPaintWidth = pendingBreakSegmentIndex === chunk.consumedEndSegmentIndex
                ? pendingBreakPaintWidth
                : lineW;
            emitCurrentLine(chunk.consumedEndSegmentIndex, 0, finalPaintWidth);
        }
    }
    return lineCount;
}

// Text measurement for browser environments using canvas measureText.
//
// Problem: DOM-based text measurement (getBoundingClientRect, offsetHeight)
// forces synchronous layout reflow. When components independently measure text,
// each measurement triggers a reflow of the entire document. This creates
// read/write interleaving that can cost 30ms+ per frame for 500 text blocks.
//
// Solution: two-phase measurement centered around canvas measureText.
//   prepare(text, font) — segments text via Intl.Segmenter, measures each word
//     via canvas, caches widths, and does one cached DOM calibration read per
//     font when emoji correction is needed. Call once when text first appears.
//   layout(prepared, maxWidth, lineHeight) — walks cached word widths with pure
//     arithmetic to count lines and compute height. Call on every resize.
//     ~0.0002ms per text.
//
// i18n: Intl.Segmenter handles CJK (per-character breaking), Thai, Arabic, etc.
//   Bidi: simplified rich-path metadata for mixed LTR/RTL custom rendering.
//   Punctuation merging: "better." measured as one unit (matches CSS behavior).
//   Trailing whitespace: hangs past line edge without triggering breaks (CSS behavior).
//   overflow-wrap: pre-measured grapheme widths enable character-level word breaking.
//
// Emoji correction: Chrome/Firefox canvas measures emoji wider than DOM at font
//   sizes <24px on macOS (Apple Color Emoji). The inflation is constant per emoji
//   grapheme at a given size, font-independent. Auto-detected by comparing canvas
//   vs actual DOM emoji width (one cached DOM read per font). Safari canvas and
//   DOM agree (both wider than fontSize), so correction = 0 there.
//
// Limitations:
//   - system-ui font: canvas resolves to different optical variants than DOM on macOS.
//     Use named fonts (Helvetica, Inter, etc.) for guaranteed accuracy.
//     See RESEARCH.md "Discovery: system-ui font resolution mismatch".
//
// Based on Sebastian Markbage's text-layout research (github.com/chenglou/text-layout).
let sharedGraphemeSegmenter = null;
// Rich-path only. Reuses grapheme splits while materializing multiple lines
// from the same prepared handle, without pushing that cache into the API.
let sharedLineTextCaches = new WeakMap();
function getSharedGraphemeSegmenter() {
    if (sharedGraphemeSegmenter === null) {
        sharedGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    }
    return sharedGraphemeSegmenter;
}
// --- Public API ---
function createEmptyPrepared(includeSegments) {
    {
        return {
            widths: [],
            lineEndFitAdvances: [],
            lineEndPaintAdvances: [],
            kinds: [],
            simpleLineWalkFastPath: true,
            segLevels: null,
            breakableWidths: [],
            breakablePrefixWidths: [],
            discretionaryHyphenWidth: 0,
            tabStopAdvance: 0,
            chunks: [],
            segments: [],
        };
    }
}
function measureAnalysis(analysis, font, includeSegments) {
    const graphemeSegmenter = getSharedGraphemeSegmenter();
    const engineProfile = getEngineProfile();
    const { cache, emojiCorrection } = getFontMeasurementState(font, textMayContainEmoji(analysis.normalized));
    const discretionaryHyphenWidth = getCorrectedSegmentWidth('-', getSegmentMetrics('-', cache), emojiCorrection);
    const spaceWidth = getCorrectedSegmentWidth(' ', getSegmentMetrics(' ', cache), emojiCorrection);
    const tabStopAdvance = spaceWidth * 8;
    if (analysis.len === 0)
        return createEmptyPrepared();
    const widths = [];
    const lineEndFitAdvances = [];
    const lineEndPaintAdvances = [];
    const kinds = [];
    let simpleLineWalkFastPath = analysis.chunks.length <= 1;
    const segStarts = [] ;
    const breakableWidths = [];
    const breakablePrefixWidths = [];
    const segments = includeSegments ? [] : null;
    const preparedStartByAnalysisIndex = Array.from({ length: analysis.len });
    const preparedEndByAnalysisIndex = Array.from({ length: analysis.len });
    function pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, breakable, breakablePrefix) {
        if (kind !== 'text' && kind !== 'space' && kind !== 'zero-width-break') {
            simpleLineWalkFastPath = false;
        }
        widths.push(width);
        lineEndFitAdvances.push(lineEndFitAdvance);
        lineEndPaintAdvances.push(lineEndPaintAdvance);
        kinds.push(kind);
        segStarts?.push(start);
        breakableWidths.push(breakable);
        breakablePrefixWidths.push(breakablePrefix);
        if (segments !== null)
            segments.push(text);
    }
    for (let mi = 0; mi < analysis.len; mi++) {
        preparedStartByAnalysisIndex[mi] = widths.length;
        const segText = analysis.texts[mi];
        const segWordLike = analysis.isWordLike[mi];
        const segKind = analysis.kinds[mi];
        const segStart = analysis.starts[mi];
        if (segKind === 'soft-hyphen') {
            pushMeasuredSegment(segText, 0, discretionaryHyphenWidth, discretionaryHyphenWidth, segKind, segStart, null, null);
            preparedEndByAnalysisIndex[mi] = widths.length;
            continue;
        }
        if (segKind === 'hard-break') {
            pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, null);
            preparedEndByAnalysisIndex[mi] = widths.length;
            continue;
        }
        if (segKind === 'tab') {
            pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, null);
            preparedEndByAnalysisIndex[mi] = widths.length;
            continue;
        }
        const segMetrics = getSegmentMetrics(segText, cache);
        if (segKind === 'text' && segMetrics.containsCJK) {
            let unitText = '';
            let unitStart = 0;
            for (const gs of graphemeSegmenter.segment(segText)) {
                const grapheme = gs.segment;
                if (unitText.length === 0) {
                    unitText = grapheme;
                    unitStart = gs.index;
                    continue;
                }
                if (kinsokuEnd.has(unitText) ||
                    kinsokuStart.has(grapheme) ||
                    leftStickyPunctuation.has(grapheme) ||
                    (engineProfile.carryCJKAfterClosingQuote &&
                        isCJK(grapheme) &&
                        endsWithClosingQuote(unitText))) {
                    unitText += grapheme;
                    continue;
                }
                const unitMetrics = getSegmentMetrics(unitText, cache);
                const w = getCorrectedSegmentWidth(unitText, unitMetrics, emojiCorrection);
                pushMeasuredSegment(unitText, w, w, w, 'text', segStart + unitStart, null, null);
                unitText = grapheme;
                unitStart = gs.index;
            }
            if (unitText.length > 0) {
                const unitMetrics = getSegmentMetrics(unitText, cache);
                const w = getCorrectedSegmentWidth(unitText, unitMetrics, emojiCorrection);
                pushMeasuredSegment(unitText, w, w, w, 'text', segStart + unitStart, null, null);
            }
            preparedEndByAnalysisIndex[mi] = widths.length;
            continue;
        }
        const w = getCorrectedSegmentWidth(segText, segMetrics, emojiCorrection);
        const lineEndFitAdvance = segKind === 'space' || segKind === 'preserved-space' || segKind === 'zero-width-break'
            ? 0
            : w;
        const lineEndPaintAdvance = segKind === 'space' || segKind === 'zero-width-break'
            ? 0
            : w;
        if (segWordLike && segText.length > 1) {
            const graphemeWidths = getSegmentGraphemeWidths(segText, segMetrics, cache, emojiCorrection);
            const graphemePrefixWidths = engineProfile.preferPrefixWidthsForBreakableRuns
                ? getSegmentGraphemePrefixWidths(segText, segMetrics, cache, emojiCorrection)
                : null;
            pushMeasuredSegment(segText, w, lineEndFitAdvance, lineEndPaintAdvance, segKind, segStart, graphemeWidths, graphemePrefixWidths);
        }
        else {
            pushMeasuredSegment(segText, w, lineEndFitAdvance, lineEndPaintAdvance, segKind, segStart, null, null);
        }
        preparedEndByAnalysisIndex[mi] = widths.length;
    }
    const chunks = mapAnalysisChunksToPreparedChunks(analysis.chunks, preparedStartByAnalysisIndex, preparedEndByAnalysisIndex);
    const segLevels = segStarts === null ? null : computeSegmentLevels(analysis.normalized, segStarts);
    if (segments !== null) {
        return {
            widths,
            lineEndFitAdvances,
            lineEndPaintAdvances,
            kinds,
            simpleLineWalkFastPath,
            segLevels,
            breakableWidths,
            breakablePrefixWidths,
            discretionaryHyphenWidth,
            tabStopAdvance,
            chunks,
            segments,
        };
    }
    return {
        widths,
        lineEndFitAdvances,
        lineEndPaintAdvances,
        kinds,
        simpleLineWalkFastPath,
        segLevels,
        breakableWidths,
        breakablePrefixWidths,
        discretionaryHyphenWidth,
        tabStopAdvance,
        chunks,
    };
}
function mapAnalysisChunksToPreparedChunks(chunks, preparedStartByAnalysisIndex, preparedEndByAnalysisIndex) {
    const preparedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const startSegmentIndex = chunk.startSegmentIndex < preparedStartByAnalysisIndex.length
            ? preparedStartByAnalysisIndex[chunk.startSegmentIndex]
            : preparedEndByAnalysisIndex[preparedEndByAnalysisIndex.length - 1] ?? 0;
        const endSegmentIndex = chunk.endSegmentIndex < preparedStartByAnalysisIndex.length
            ? preparedStartByAnalysisIndex[chunk.endSegmentIndex]
            : preparedEndByAnalysisIndex[preparedEndByAnalysisIndex.length - 1] ?? 0;
        const consumedEndSegmentIndex = chunk.consumedEndSegmentIndex < preparedStartByAnalysisIndex.length
            ? preparedStartByAnalysisIndex[chunk.consumedEndSegmentIndex]
            : preparedEndByAnalysisIndex[preparedEndByAnalysisIndex.length - 1] ?? 0;
        preparedChunks.push({
            startSegmentIndex,
            endSegmentIndex,
            consumedEndSegmentIndex,
        });
    }
    return preparedChunks;
}
function prepareInternal(text, font, includeSegments, options) {
    const analysis = analyzeText(text, getEngineProfile(), options?.whiteSpace);
    return measureAnalysis(analysis, font, includeSegments);
}
// Rich variant used by callers that need enough information to render the
// laid-out lines themselves.
function prepareWithSegments(text, font, options) {
    return prepareInternal(text, font, true, options);
}
function getInternalPrepared(prepared) {
    return prepared;
}
function getSegmentGraphemes(segmentIndex, segments, cache) {
    let graphemes = cache.get(segmentIndex);
    if (graphemes !== undefined)
        return graphemes;
    graphemes = [];
    const graphemeSegmenter = getSharedGraphemeSegmenter();
    for (const gs of graphemeSegmenter.segment(segments[segmentIndex])) {
        graphemes.push(gs.segment);
    }
    cache.set(segmentIndex, graphemes);
    return graphemes;
}
function getLineTextCache(prepared) {
    let cache = sharedLineTextCaches.get(prepared);
    if (cache !== undefined)
        return cache;
    cache = new Map();
    sharedLineTextCaches.set(prepared, cache);
    return cache;
}
function lineHasDiscretionaryHyphen(kinds, startSegmentIndex, startGraphemeIndex, endSegmentIndex) {
    return (endSegmentIndex > 0 &&
        kinds[endSegmentIndex - 1] === 'soft-hyphen' &&
        !(startSegmentIndex === endSegmentIndex && startGraphemeIndex > 0));
}
function buildLineTextFromRange(segments, kinds, cache, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
    let text = '';
    const endsWithDiscretionaryHyphen = lineHasDiscretionaryHyphen(kinds, startSegmentIndex, startGraphemeIndex, endSegmentIndex);
    for (let i = startSegmentIndex; i < endSegmentIndex; i++) {
        if (kinds[i] === 'soft-hyphen' || kinds[i] === 'hard-break')
            continue;
        if (i === startSegmentIndex && startGraphemeIndex > 0) {
            text += getSegmentGraphemes(i, segments, cache).slice(startGraphemeIndex).join('');
        }
        else {
            text += segments[i];
        }
    }
    if (endGraphemeIndex > 0) {
        if (endsWithDiscretionaryHyphen)
            text += '-';
        text += getSegmentGraphemes(endSegmentIndex, segments, cache).slice(startSegmentIndex === endSegmentIndex ? startGraphemeIndex : 0, endGraphemeIndex).join('');
    }
    else if (endsWithDiscretionaryHyphen) {
        text += '-';
    }
    return text;
}
function createLayoutLine(prepared, cache, width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
    return {
        text: buildLineTextFromRange(prepared.segments, prepared.kinds, cache, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex),
        width,
        start: {
            segmentIndex: startSegmentIndex,
            graphemeIndex: startGraphemeIndex,
        },
        end: {
            segmentIndex: endSegmentIndex,
            graphemeIndex: endGraphemeIndex,
        },
    };
}
function materializeLayoutLine(prepared, cache, line) {
    return createLayoutLine(prepared, cache, line.width, line.startSegmentIndex, line.startGraphemeIndex, line.endSegmentIndex, line.endGraphemeIndex);
}
function toLayoutLineRange(line) {
    return {
        width: line.width,
        start: {
            segmentIndex: line.startSegmentIndex,
            graphemeIndex: line.startGraphemeIndex,
        },
        end: {
            segmentIndex: line.endSegmentIndex,
            graphemeIndex: line.endGraphemeIndex,
        },
    };
}
// Batch low-level line geometry pass. This is the non-materializing counterpart
// to layoutWithLines(), useful for shrinkwrap and other aggregate geometry work.
function walkLineRanges(prepared, maxWidth, onLine) {
    if (prepared.widths.length === 0)
        return 0;
    return walkPreparedLines(getInternalPrepared(prepared), maxWidth, line => {
        onLine(toLayoutLineRange(line));
    });
}
// Rich layout API for callers that want the actual line contents and widths.
// Caller still supplies lineHeight at layout time. Mirrors layout()'s break
// decisions, but keeps extra per-line bookkeeping so it should stay off the
// resize hot path.
function layoutWithLines(prepared, maxWidth, lineHeight) {
    const lines = [];
    if (prepared.widths.length === 0)
        return { lineCount: 0, height: 0, lines };
    const graphemeCache = getLineTextCache(prepared);
    const lineCount = walkPreparedLines(getInternalPrepared(prepared), maxWidth, line => {
        lines.push(materializeLayoutLine(prepared, graphemeCache, line));
    });
    return { lineCount, height: lineCount * lineHeight, lines };
}

// ============================================================
// sketchmark — Text Measurement (pretext-powered)
//
// Standalone module with no dependency on layout or renderer,
// safe to import from any layer without circular deps.
// ============================================================
/** Build a CSS font shorthand from fontSize, fontWeight and fontFamily */
function buildFontStr(fontSize, fontWeight, fontFamily) {
    return `${fontWeight} ${fontSize}px ${fontFamily}`;
}
/** Measure the natural (unwrapped) width of text using pretext */
function measureTextWidth(text, font) {
    const prepared = prepareWithSegments(text, font);
    let maxW = 0;
    walkLineRanges(prepared, 1e6, line => { if (line.width > maxW)
        maxW = line.width; });
    return maxW;
}
/** Word-wrap text using pretext, with fallback to character approximation */
function wrapText(text, maxWidth, fontSize, font) {
    if (font) {
        try {
            const prepared = prepareWithSegments(text, font);
            const lineHeight = fontSize * 1.5;
            const { lines } = layoutWithLines(prepared, maxWidth, lineHeight);
            return lines.length ? lines.map(l => l.text) : [text];
        }
        catch (_) {
            // fall through to approximation
        }
    }
    // Fallback: character-width approximation
    const charWidth = fontSize * 0.55;
    const maxChars = Math.floor(maxWidth / charWidth);
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (test.length > maxChars && current) {
            lines.push(current);
            current = word;
        }
        else {
            current = test;
        }
    }
    if (current)
        lines.push(current);
    return lines.length ? lines : [text];
}

// ============================================================
// sketchmark — Font Registry
// ============================================================
// built-in named fonts — user can reference these by short name
const BUILTIN_FONTS = {
    // hand-drawn
    caveat: {
        family: "'Caveat', cursive",
        url: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600&display=swap',
    },
    handlee: {
        family: "'Handlee', cursive",
        url: 'https://fonts.googleapis.com/css2?family=Handlee&display=swap',
    },
    'indie-flower': {
        family: "'Indie Flower', cursive",
        url: 'https://fonts.googleapis.com/css2?family=Indie+Flower&display=swap',
    },
    'patrick-hand': {
        family: "'Patrick Hand', cursive",
        url: 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap',
    },
    // clean / readable
    'dm-mono': {
        family: "'DM Mono', monospace",
        url: 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap',
    },
    'jetbrains': {
        family: "'JetBrains Mono', monospace",
        url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap',
    },
    'instrument': {
        family: "'Instrument Serif', serif",
        url: 'https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap',
    },
    'playfair': {
        family: "'Playfair Display', serif",
        url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&display=swap',
    },
    // system fallbacks (no URL needed)
    system: { family: 'system-ui, sans-serif' },
    mono: { family: "'Courier New', monospace" },
    serif: { family: 'Georgia, serif' },
};
// default — what renders when no font is specified
const DEFAULT_FONT = 'system-ui, sans-serif';
// resolve a short name or pass-through a quoted CSS family
function resolveFont(nameOrFamily) {
    const key = nameOrFamily.toLowerCase().trim();
    if (BUILTIN_FONTS[key])
        return BUILTIN_FONTS[key].family;
    return nameOrFamily; // treat as raw CSS font-family
}
// inject a <link> into <head> for a built-in font (browser only)
function loadFont(name) {
    if (typeof document === 'undefined')
        return;
    const key = name.toLowerCase().trim();
    const def = BUILTIN_FONTS[key];
    if (!def?.url || def.loaded)
        return;
    if (document.querySelector(`link[data-sketchmark-font="${key}"]`))
        return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = def.url;
    link.setAttribute('data-sketchmark-font', key);
    document.head.appendChild(link);
    def.loaded = true;
}
// user registers their own font (already loaded via CSS/link)
function registerFont(name, family, url) {
    BUILTIN_FONTS[name.toLowerCase()] = { family, url };
    if (url)
        loadFont(name);
}

// ============================================================
// sketchmark — Markdown inline parser
// Supports: # h1  ## h2  ### h3  **bold**  *italic*  blank lines
// ============================================================
// ── Font sizes per line kind (re-exported from config) ───
const LINE_FONT_SIZE = { ...MARKDOWN.fontSize };
const LINE_FONT_WEIGHT = { ...MARKDOWN.fontWeight };
const LINE_SPACING = { ...MARKDOWN.spacing };
// ── Parse a full markdown string into lines ───────────────
function parseMarkdownContent(content) {
    const raw = content.split('\n');
    const lines = [];
    for (const line of raw) {
        const t = line.trim();
        if (!t) {
            lines.push({ kind: 'blank', runs: [] });
            continue;
        }
        if (t.startsWith('### ')) {
            lines.push({ kind: 'h3', runs: parseInline(t.slice(4)) });
        }
        else if (t.startsWith('## ')) {
            lines.push({ kind: 'h2', runs: parseInline(t.slice(3)) });
        }
        else if (t.startsWith('# ')) {
            lines.push({ kind: 'h1', runs: parseInline(t.slice(2)) });
        }
        else {
            lines.push({ kind: 'p', runs: parseInline(t) });
        }
    }
    // strip leading/trailing blank lines
    while (lines.length && lines[0].kind === 'blank')
        lines.shift();
    while (lines.length && lines[lines.length - 1].kind === 'blank')
        lines.pop();
    return lines;
}
// ── Parse inline bold/italic spans ───────────────────────
function parseInline(text) {
    const runs = [];
    // Order matters: check ** before *
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|[^*]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m[0].startsWith('**')) {
            runs.push({ text: m[2], bold: true });
        }
        else if (m[0].startsWith('*')) {
            runs.push({ text: m[3], italic: true });
        }
        else {
            if (m[0])
                runs.push({ text: m[0] });
        }
    }
    return runs;
}
// ── Calculate natural height of a parsed block ────────────
function calcMarkdownHeight(lines, pad = MARKDOWN.defaultPad) {
    let h = pad * 2; // top + bottom
    for (const line of lines)
        h += LINE_SPACING[line.kind];
    return h;
}
// ── Calculate natural width of a parsed block using pretext ──
function calcMarkdownWidth(lines, fontFamily = DEFAULT_FONT, pad = MARKDOWN.defaultPad) {
    let maxW = 0;
    for (const line of lines) {
        if (line.kind === 'blank')
            continue;
        const text = line.runs.map(r => r.text).join('');
        const font = buildFontStr(LINE_FONT_SIZE[line.kind], LINE_FONT_WEIGHT[line.kind], fontFamily);
        const w = measureTextWidth(text, font);
        if (w > maxW)
            maxW = w;
    }
    return Math.ceil(maxW) + pad * 2;
}

// ============================================================
// sketchmark — Scene Graph
// ============================================================
// ── Build scene graph from AST ────────────────────────────
function buildSceneGraph(ast) {
    const nodeParentById = new Map();
    const groupParentById = new Map();
    for (const g of ast.groups) {
        for (const child of g.children) {
            if (child.kind === "node")
                nodeParentById.set(child.id, g.id);
            if (child.kind === "group")
                groupParentById.set(child.id, g.id);
        }
    }
    const nodes = ast.nodes.map((n) => {
        const themeStyle = n.theme ? (ast.themes[n.theme] ?? {}) : {};
        return {
            id: n.id,
            shape: n.shape,
            label: n.label,
            style: { ...ast.styles[n.id], ...themeStyle, ...n.style },
            groupId: nodeParentById.get(n.id),
            width: n.width,
            height: n.height,
            authoredX: n.x,
            authoredY: n.y,
            deg: n.deg,
            dx: n.dx,
            dy: n.dy,
            factor: n.factor,
            meta: n.meta,
            imageUrl: n.imageUrl,
            iconName: n.iconName,
            pathData: n.pathData,
            x: 0,
            y: 0,
            w: 0,
            h: 0,
        };
    });
    const groups = ast.groups.map((g) => {
        const themeStyle = g.theme ? (ast.themes[g.theme] ?? {}) : {};
        return {
            id: g.id,
            label: g.label,
            parentId: groupParentById.get(g.id),
            children: g.children,
            layout: (g.layout ?? "column"),
            columns: g.columns ?? 1,
            padding: g.padding ?? LAYOUT.groupPad,
            gap: g.gap ?? LAYOUT.groupGap,
            align: (g.align ?? "start"),
            justify: (g.justify ?? "start"),
            style: { ...ast.styles[g.id], ...themeStyle, ...g.style },
            authoredX: g.x,
            authoredY: g.y,
            width: g.width,
            height: g.height,
            x: 0,
            y: 0,
            w: 0,
            h: 0,
        };
    });
    const tables = ast.tables.map((t) => {
        const themeStyle = t.theme ? (ast.themes[t.theme] ?? {}) : {};
        return {
            id: t.id,
            label: t.label,
            rows: t.rows,
            colWidths: [],
            rowH: TABLE.rowH,
            headerH: TABLE.headerH,
            labelH: TABLE.labelH,
            style: { ...ast.styles[t.id], ...themeStyle, ...t.style },
            authoredX: t.x,
            authoredY: t.y,
            x: 0,
            y: 0,
            w: 0,
            h: 0,
        };
    });
    const charts = ast.charts.map((c) => {
        const themeStyle = c.theme ? (ast.themes[c.theme] ?? {}) : {};
        return {
            id: c.id,
            chartType: c.chartType,
            label: c.label,
            data: c.data,
            style: { ...ast.styles[c.id], ...themeStyle, ...c.style },
            authoredX: c.x,
            authoredY: c.y,
            x: 0,
            y: 0,
            w: c.width ?? CHART.defaultW,
            h: c.height ?? CHART.defaultH,
        };
    });
    const markdowns = (ast.markdowns ?? []).map((m) => {
        const themeStyle = m.theme ? (ast.themes[m.theme] ?? {}) : {};
        return {
            id: m.id,
            content: m.content,
            lines: parseMarkdownContent(m.content),
            style: { ...ast.styles[m.id], ...themeStyle, ...m.style },
            width: m.width,
            height: m.height,
            authoredX: m.x,
            authoredY: m.y,
            x: 0,
            y: 0,
            w: 0,
            h: 0,
        };
    });
    const edges = ast.edges.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        connector: e.connector,
        label: e.label,
        fromAnchor: e.fromAnchor,
        toAnchor: e.toAnchor,
        dashed: e.dashed ?? false,
        bidirectional: e.bidirectional ?? false,
        style: e.style ?? {},
    }));
    return {
        title: ast.title,
        description: ast.description,
        layout: ast.layout,
        style: ast.style ?? {},
        nodes,
        edges,
        groups,
        tables,
        charts,
        markdowns,
        animation: { steps: ast.steps, currentStep: -1 },
        styles: ast.styles,
        config: ast.config,
        rootOrder: ast.rootOrder ?? [],
        width: 0,
        height: 0,
        fixedWidth: ast.width,
        fixedHeight: ast.height,
    };
}
// ── Helpers ───────────────────────────────────────────────
function nodeMap(sg) {
    return new Map(sg.nodes.map((n) => [n.id, n]));
}
function groupMap(sg) {
    return new Map(sg.groups.map((g) => [g.id, g]));
}
function tableMap(sg) {
    return new Map(sg.tables.map((t) => [t.id, t]));
}
function chartMap(sg) {
    return new Map(sg.charts.map((c) => [c.id, c]));
}
function markdownMap(sg) {
    return new Map((sg.markdowns ?? []).map(m => [m.id, m]));
}

// ============================================================
// Entity Rect Map — unified lookup for all positionable entities
//
// Every scene entity (node, group, table, chart, markdown)
// has { x, y, w, h }. This map lets layout code look up any
// entity by ID without kind dispatch.
// ============================================================
function buildEntityMap(sg) {
    const m = new Map();
    for (const n of sg.nodes)
        m.set(n.id, n);
    for (const g of sg.groups)
        m.set(g.id, g);
    for (const t of sg.tables)
        m.set(t.id, t);
    for (const c of sg.charts)
        m.set(c.id, c);
    for (const md of sg.markdowns)
        m.set(md.id, md);
    return m;
}

// ============================================================
// Shape Strategy Interfaces
// ============================================================
// Re-export from centralized config for backward compatibility
const MIN_W = NODE.minW;
const MAX_W = NODE.maxW;
const SVG_NS = SVG_NS$1;

// ============================================================
// Shape Registry — Strategy pattern for extensible shapes
// ============================================================
const shapes = new Map();
function registerShape(name, def) {
    shapes.set(name, def);
}
function getShape(name) {
    return shapes.get(name);
}

const boxShape = {
    size(n, labelW) {
        const w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW));
        n.w = w;
        if (!n.h) {
            // If label overflows width, estimate extra height for wrapped lines
            if (labelW > w) {
                const fontSize = Number(n.style?.fontSize ?? 14);
                const lineH = fontSize * 1.5;
                const lines = Math.ceil(labelW / (w - 16)); // 16px inner padding
                n.h = Math.max(52, lines * lineH + 20);
            }
            else {
                n.h = 52;
            }
        }
    },
    renderSVG(rc, n, _palette, opts) {
        return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts)];
    },
    renderCanvas(rc, _ctx, n, _palette, opts) {
        rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts);
    },
};

const circleShape = {
    size(n, labelW) {
        n.w = n.w || Math.max(84, Math.min(MAX_W, labelW));
        if (!n.h) {
            if (labelW > n.w) {
                const fontSize = Number(n.style?.fontSize ?? 14);
                const lineH = fontSize * 1.5;
                const innerW = n.w * 0.65;
                const lines = Math.ceil(labelW / innerW);
                n.h = Math.max(n.w, lines * lineH + 30);
            }
            else {
                n.h = n.w;
            }
        }
    },
    renderSVG(rc, n, _palette, opts) {
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        return [rc.ellipse(cx, cy, n.w * 0.88, n.h * 0.88, opts)];
    },
    renderCanvas(rc, _ctx, n, _palette, opts) {
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        rc.ellipse(cx, cy, n.w * 0.88, n.h * 0.88, opts);
    },
};

const diamondShape = {
    size(n, labelW) {
        n.w = n.w || Math.max(SHAPES.diamond.minW, Math.min(MAX_W, labelW + SHAPES.diamond.labelPad));
        if (!n.h) {
            const baseH = Math.max(SHAPES.diamond.minH, n.w * SHAPES.diamond.aspect);
            const innerW = n.w * 0.45;
            if (labelW > innerW) {
                const fontSize = Number(n.style?.fontSize ?? 14);
                const lineH = fontSize * 1.5;
                const lines = Math.ceil(labelW / innerW);
                n.h = Math.max(baseH, lines * lineH + 30);
            }
            else {
                n.h = baseH;
            }
        }
    },
    renderSVG(rc, n, _palette, opts) {
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        const hw = n.w / 2 - 2;
        return [rc.polygon([[cx, n.y + 2], [cx + hw, cy], [cx, n.y + n.h - 2], [cx - hw, cy]], opts)];
    },
    renderCanvas(rc, _ctx, n, _palette, opts) {
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        const hw = n.w / 2 - 2;
        rc.polygon([[cx, n.y + 2], [cx + hw, cy], [cx, n.y + n.h - 2], [cx - hw, cy]], opts);
    },
};

const hexagonShape = {
    size(n, labelW) {
        n.w = n.w || Math.max(SHAPES.hexagon.minW, Math.min(MAX_W, labelW + SHAPES.hexagon.labelPad));
        if (!n.h) {
            const baseH = Math.max(SHAPES.hexagon.minH, n.w * SHAPES.hexagon.aspect);
            const innerW = n.w * 0.55;
            if (labelW > innerW) {
                const fontSize = Number(n.style?.fontSize ?? 14);
                const lineH = fontSize * 1.5;
                const lines = Math.ceil(labelW / innerW);
                n.h = Math.max(baseH, lines * lineH + 20);
            }
            else {
                n.h = baseH;
            }
        }
    },
    renderSVG(rc, n, _palette, opts) {
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        const hw = n.w / 2 - 2;
        const hw2 = hw * SHAPES.hexagon.inset;
        return [rc.polygon([
                [cx - hw2, n.y + 3], [cx + hw2, n.y + 3], [cx + hw, cy],
                [cx + hw2, n.y + n.h - 3], [cx - hw2, n.y + n.h - 3], [cx - hw, cy],
            ], opts)];
    },
    renderCanvas(rc, _ctx, n, _palette, opts) {
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        const hw = n.w / 2 - 2;
        const hw2 = hw * SHAPES.hexagon.inset;
        rc.polygon([
            [cx - hw2, n.y + 3], [cx + hw2, n.y + 3], [cx + hw, cy],
            [cx + hw2, n.y + n.h - 3], [cx - hw2, n.y + n.h - 3], [cx - hw, cy],
        ], opts);
    },
};

const triangleShape = {
    size(n, labelW) {
        n.w = n.w || Math.max(SHAPES.triangle.minW, Math.min(MAX_W, labelW + SHAPES.triangle.labelPad));
        if (!n.h) {
            const baseH = Math.max(SHAPES.triangle.minH, n.w * SHAPES.triangle.aspect);
            const innerW = n.w * 0.40;
            if (labelW > innerW) {
                const fontSize = Number(n.style?.fontSize ?? 14);
                const lineH = fontSize * 1.5;
                const lines = Math.ceil(labelW / innerW);
                n.h = Math.max(baseH, lines * lineH + 30);
            }
            else {
                n.h = baseH;
            }
        }
    },
    renderSVG(rc, n, _palette, opts) {
        const cx = n.x + n.w / 2;
        return [rc.polygon([
                [cx, n.y + 3],
                [n.x + n.w - 3, n.y + n.h - 3],
                [n.x + 3, n.y + n.h - 3],
            ], opts)];
    },
    renderCanvas(rc, _ctx, n, _palette, opts) {
        const cx = n.x + n.w / 2;
        rc.polygon([
            [cx, n.y + 3],
            [n.x + n.w - 3, n.y + n.h - 3],
            [n.x + 3, n.y + n.h - 3],
        ], opts);
    },
};

const cylinderShape = {
    size(n, labelW) {
        const w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW));
        n.w = w;
        if (!n.h) {
            if (labelW > w) {
                const fontSize = Number(n.style?.fontSize ?? 14);
                const lines = Math.ceil(labelW / (w - 16));
                n.h = Math.max(SHAPES.cylinder.defaultH, lines * fontSize * 1.5 + 20);
            }
            else {
                n.h = SHAPES.cylinder.defaultH;
            }
        }
    },
    renderSVG(rc, n, _palette, opts) {
        const cx = n.x + n.w / 2;
        const eH = SHAPES.cylinder.ellipseH;
        return [
            rc.rectangle(n.x + 3, n.y + eH / 2, n.w - 6, n.h - eH, opts),
            rc.ellipse(cx, n.y + eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6 }),
            rc.ellipse(cx, n.y + n.h - eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6, fill: "none" }),
        ];
    },
    renderCanvas(rc, _ctx, n, _palette, opts) {
        const cx = n.x + n.w / 2;
        const eH = SHAPES.cylinder.ellipseH;
        rc.rectangle(n.x + 3, n.y + eH / 2, n.w - 6, n.h - eH, opts);
        rc.ellipse(cx, n.y + eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6 });
        rc.ellipse(cx, n.y + n.h - eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6, fill: "none" });
    },
};

const parallelogramShape = {
    size(n, labelW) {
        const w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW + SHAPES.parallelogram.labelPad));
        n.w = w;
        if (!n.h) {
            if (labelW + SHAPES.parallelogram.labelPad > w) {
                const fontSize = Number(n.style?.fontSize ?? 14);
                const lines = Math.ceil(labelW / (w - SHAPES.parallelogram.labelPad));
                n.h = Math.max(SHAPES.parallelogram.defaultH, lines * fontSize * 1.5 + 20);
            }
            else {
                n.h = SHAPES.parallelogram.defaultH;
            }
        }
    },
    renderSVG(rc, n, _palette, opts) {
        return [rc.polygon([
                [n.x + SHAPES.parallelogram.skew, n.y + 1], [n.x + n.w - 1, n.y + 1],
                [n.x + n.w - SHAPES.parallelogram.skew, n.y + n.h - 1], [n.x + 1, n.y + n.h - 1],
            ], opts)];
    },
    renderCanvas(rc, _ctx, n, _palette, opts) {
        rc.polygon([
            [n.x + SHAPES.parallelogram.skew, n.y + 1], [n.x + n.w - 1, n.y + 1],
            [n.x + n.w - SHAPES.parallelogram.skew, n.y + n.h - 1], [n.x + 1, n.y + n.h - 1],
        ], opts);
    },
};

const textShape = {
    size(n, _labelW) {
        const fontSize = Number(n.style?.fontSize ?? 13);
        const fontWeight = n.style?.fontWeight ?? 400;
        const fontFamily = String(n.style?.font ?? DEFAULT_FONT);
        const font = buildFontStr(fontSize, fontWeight, fontFamily);
        const pad = Number(n.style?.padding ?? 0) * 2;
        const lineHeight = fontSize * 1.5;
        if (n.width) {
            const lines = n.label.includes("\\n")
                ? n.label.split("\\n")
                : wrapText(n.label, Math.max(1, n.width - pad), fontSize, font);
            n.w = n.width;
            n.h = n.height ?? Math.max(24, lines.length * lineHeight + pad);
        }
        else {
            if (n.label.includes("\\n")) {
                const lines = n.label.split("\\n");
                let maxW = 0;
                for (const line of lines) {
                    const w = measureTextWidth(line, font);
                    if (w > maxW)
                        maxW = w;
                }
                n.w = Math.ceil(maxW) + pad;
                n.h = n.height ?? Math.max(24, lines.length * lineHeight + pad);
            }
            else {
                const textW = measureTextWidth(n.label, font);
                n.w = Math.ceil(textW) + pad;
                n.h = n.height ?? Math.max(24, lineHeight + pad);
            }
        }
    },
    renderSVG(_rc, _n, _palette, _opts) {
        return []; // no shape drawn — text only
    },
    renderCanvas(_rc, _ctx, _n, _palette, _opts) {
        // no shape drawn — text only
    },
};

const iconShape = {
    size(n, labelW) {
        const iconBase = 48;
        const labelH = n.label ? 20 : 0;
        n.w = n.w || Math.max(iconBase, n.label ? labelW : 0);
        n.h = n.h || (iconBase + labelH);
    },
    renderSVG(rc, n, palette, opts) {
        const s = n.style ?? {};
        if (n.iconName) {
            const [prefix, name] = n.iconName.includes(":")
                ? n.iconName.split(":", 2)
                : ["mdi", n.iconName];
            const iconColor = s.color
                ? encodeURIComponent(String(s.color))
                : encodeURIComponent(String(palette.nodeStroke));
            const labelSpace = n.label ? 20 : 0;
            const iconAreaH = n.h - labelSpace;
            const iconSize = Math.min(n.w, iconAreaH) - 4;
            const iconUrl = `https://api.iconify.design/${prefix}/${name}.svg?color=${iconColor}&width=${iconSize}&height=${iconSize}`;
            const img = document.createElementNS(SVG_NS, "image");
            img.setAttribute("href", iconUrl);
            const iconX = n.x + (n.w - iconSize) / 2;
            const iconY = n.y + (iconAreaH - iconSize) / 2;
            img.setAttribute("x", String(iconX));
            img.setAttribute("y", String(iconY));
            img.setAttribute("width", String(iconSize));
            img.setAttribute("height", String(iconSize));
            img.setAttribute("preserveAspectRatio", "xMidYMid meet");
            if (s.opacity != null)
                img.setAttribute("opacity", String(s.opacity));
            const clipId = `clip-${n.id}`;
            const defs = document.createElementNS(SVG_NS, "defs");
            const clip = document.createElementNS(SVG_NS, "clipPath");
            clip.setAttribute("id", clipId);
            const rect = document.createElementNS(SVG_NS, "rect");
            rect.setAttribute("x", String(iconX));
            rect.setAttribute("y", String(iconY));
            rect.setAttribute("width", String(iconSize));
            rect.setAttribute("height", String(iconSize));
            rect.setAttribute("rx", "6");
            clip.appendChild(rect);
            defs.appendChild(clip);
            img.setAttribute("clip-path", `url(#${clipId})`);
            const els = [defs, img];
            if (s.stroke) {
                els.push(rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "none" }));
            }
            return els;
        }
        return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "#e0e0e0", stroke: "#999999" })];
    },
    renderCanvas(rc, ctx, n, palette, opts) {
        const s = n.style ?? {};
        if (n.iconName) {
            const [prefix, name] = n.iconName.includes(":")
                ? n.iconName.split(":", 2)
                : ["mdi", n.iconName];
            const iconColor = s.color
                ? encodeURIComponent(String(s.color))
                : encodeURIComponent(String(palette.nodeStroke));
            const iconLabelSpace = n.label ? 20 : 0;
            const iconAreaH = n.h - iconLabelSpace;
            const iconSize = Math.min(n.w, iconAreaH) - 4;
            const iconUrl = `https://api.iconify.design/${prefix}/${name}.svg?color=${iconColor}&width=${iconSize}&height=${iconSize}`;
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                ctx.save();
                if (s.opacity != null)
                    ctx.globalAlpha = Number(s.opacity);
                const iconX = n.x + (n.w - iconSize) / 2;
                const iconY = n.y + (iconAreaH - iconSize) / 2;
                ctx.beginPath();
                const r = 6;
                ctx.moveTo(iconX + r, iconY);
                ctx.lineTo(iconX + iconSize - r, iconY);
                ctx.quadraticCurveTo(iconX + iconSize, iconY, iconX + iconSize, iconY + r);
                ctx.lineTo(iconX + iconSize, iconY + iconSize - r);
                ctx.quadraticCurveTo(iconX + iconSize, iconY + iconSize, iconX + iconSize - r, iconY + iconSize);
                ctx.lineTo(iconX + r, iconY + iconSize);
                ctx.quadraticCurveTo(iconX, iconY + iconSize, iconX, iconY + iconSize - r);
                ctx.lineTo(iconX, iconY + r);
                ctx.quadraticCurveTo(iconX, iconY, iconX + r, iconY);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
                ctx.restore();
                if (s.stroke) {
                    rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "none" });
                }
            };
            img.src = iconUrl;
        }
        else {
            rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "#e0e0e0", stroke: "#999999" });
        }
    },
};

const imageShape = {
    size(n, labelW) {
        const w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW));
        n.w = w;
        if (!n.h) {
            if (labelW > w) {
                const fontSize = Number(n.style?.fontSize ?? 14);
                const lines = Math.ceil(labelW / (w - 16));
                n.h = Math.max(52, lines * fontSize * 1.5 + 20);
            }
            else {
                n.h = 52;
            }
        }
    },
    renderSVG(rc, n, _palette, opts) {
        const s = n.style ?? {};
        if (n.imageUrl) {
            const imgLabelSpace = n.label ? 20 : 0;
            const imgAreaH = n.h - imgLabelSpace;
            const img = document.createElementNS(SVG_NS, "image");
            img.setAttribute("href", n.imageUrl);
            img.setAttribute("x", String(n.x + 1));
            img.setAttribute("y", String(n.y + 1));
            img.setAttribute("width", String(n.w - 2));
            img.setAttribute("height", String(imgAreaH - 2));
            img.setAttribute("preserveAspectRatio", "xMidYMid meet");
            const clipId = `clip-${n.id}`;
            const defs = document.createElementNS(SVG_NS, "defs");
            const clip = document.createElementNS(SVG_NS, "clipPath");
            clip.setAttribute("id", clipId);
            const rect = document.createElementNS(SVG_NS, "rect");
            rect.setAttribute("x", String(n.x + 1));
            rect.setAttribute("y", String(n.y + 1));
            rect.setAttribute("width", String(n.w - 2));
            rect.setAttribute("height", String(imgAreaH - 2));
            rect.setAttribute("rx", "6");
            clip.appendChild(rect);
            defs.appendChild(clip);
            img.setAttribute("clip-path", `url(#${clipId})`);
            const els = [defs, img];
            if (s.stroke) {
                els.push(rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "none" }));
            }
            return els;
        }
        return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "#e0e0e0", stroke: "#999999" })];
    },
    renderCanvas(rc, ctx, n, _palette, opts) {
        const s = n.style ?? {};
        if (n.imageUrl) {
            const imgLblSpace = n.label ? 20 : 0;
            const imgAreaH = n.h - imgLblSpace;
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                ctx.save();
                ctx.beginPath();
                const r = 6;
                ctx.moveTo(n.x + r, n.y);
                ctx.lineTo(n.x + n.w - r, n.y);
                ctx.quadraticCurveTo(n.x + n.w, n.y, n.x + n.w, n.y + r);
                ctx.lineTo(n.x + n.w, n.y + imgAreaH - r);
                ctx.quadraticCurveTo(n.x + n.w, n.y + imgAreaH, n.x + n.w - r, n.y + imgAreaH);
                ctx.lineTo(n.x + r, n.y + imgAreaH);
                ctx.quadraticCurveTo(n.x, n.y + imgAreaH, n.x, n.y + imgAreaH - r);
                ctx.lineTo(n.x, n.y + r);
                ctx.quadraticCurveTo(n.x, n.y, n.x + r, n.y);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(img, n.x + 1, n.y + 1, n.w - 2, imgAreaH - 2);
                ctx.restore();
                if (s.stroke) {
                    rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "none" });
                }
            };
            img.src = n.imageUrl;
        }
        else {
            rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "#e0e0e0", stroke: "#999999" });
        }
    },
};

// ============================================================
// sketchmark — Shared Renderer Utilities
//
// Functions used by both SVG and Canvas renderers, extracted
// to eliminate duplication (Phase 1 of SOLID refactoring).
// ============================================================
// ── Hash string to seed ───────────────────────────────────────────────────
function hashStr$3(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++)
        h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
    return h;
}
// ── Darken a CSS hex colour by `amount` (0–1) ────────────────────────────
function darkenHex(hex, amount = 0.12) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m)
        return hex;
    const d = (v) => Math.max(0, Math.round(parseInt(v, 16) * (1 - amount)));
    return `#${d(m[1]).toString(16).padStart(2, "0")}${d(m[2]).toString(16).padStart(2, "0")}${d(m[3]).toString(16).padStart(2, "0")}`;
}
// ── Load + resolve font from style or fall back ──────────────────────────
function resolveStyleFont(style, fallback) {
    const raw = String(style["font"] ?? "");
    if (!raw)
        return fallback;
    loadFont(raw);
    return resolveFont(raw);
}
// ── Inner text width per shape (for wrapping inside non-rectangular shapes)
const SHAPE_TEXT_RATIO = {
    circle: 0.65,
    diamond: 0.45,
    hexagon: 0.55,
    triangle: 0.40,
};
function shapeInnerTextWidth(shape, w, padding) {
    const ratio = SHAPE_TEXT_RATIO[shape];
    if (ratio)
        return w * ratio;
    return w - padding * 2;
}
// ── Arrow direction from connector ───────────────────────────────────────
function connMeta(connector) {
    if (connector === "--")
        return { arrowAt: "none", dashed: false };
    if (connector === "---")
        return { arrowAt: "none", dashed: true };
    const bidir = connector.includes("<") && connector.includes(">");
    if (bidir)
        return { arrowAt: "both", dashed: connector.includes("--") };
    const back = connector.startsWith("<");
    const dashed = connector.includes("--");
    if (back)
        return { arrowAt: "start", dashed };
    return { arrowAt: "end", dashed };
}
// ── Resolve an endpoint entity by ID across all maps ─────────────────────
function resolveEndpoint(id, nm, tm, gm, cm) {
    return nm.get(id) ?? tm.get(id) ?? gm.get(id) ?? cm.get(id) ?? null;
}
// ── Get connection point for any entity ──────────────────────────────────
function getConnPoint(src, dstCX, dstCY, anchor) {
    return anchoredConnPoint(src, anchor, dstCX, dstCY);
}
// ── Group depth (for paint order) ────────────────────────────────────────
function groupDepth(g, gm) {
    let d = 0;
    let cur = g;
    while (cur?.parentId) {
        d++;
        cur = gm.get(cur.parentId);
    }
    return d;
}

const noteShape = {
    idPrefix: "note",
    cssClass: "ntg",
    size(n, _labelW) {
        const fontSize = Number(n.style?.fontSize ?? 12);
        const fontWeight = n.style?.fontWeight ?? 400;
        const fontFamily = String(n.style?.font ?? DEFAULT_FONT);
        const font = buildFontStr(fontSize, fontWeight, fontFamily);
        const lines = n.label.split("\n");
        let maxLineW = 0;
        for (const line of lines) {
            const w = measureTextWidth(line, font);
            if (w > maxLineW)
                maxLineW = w;
        }
        n.w = n.w || Math.max(NOTE.minW, Math.ceil(maxLineW) + NOTE.padX * 2);
        n.h = n.h || lines.length * NOTE.lineH + NOTE.padY * 2;
        if (n.width && n.w < n.width)
            n.w = n.width;
        if (n.height && n.h < n.height)
            n.h = n.height;
    },
    renderSVG(rc, n, palette, opts) {
        const s = n.style ?? {};
        const { x, y, w, h } = n;
        const fold = NOTE.fold;
        const strk = String(s.stroke ?? palette.noteStroke);
        const nStrokeWidth = Number(s.strokeWidth ?? 1.2);
        const body = rc.polygon([[x, y], [x + w - fold, y], [x + w, y + fold], [x + w, y + h], [x, y + h]], {
            ...opts,
            stroke: strk,
            strokeWidth: nStrokeWidth,
            ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
        });
        const foldEl = rc.polygon([[x + w - fold, y], [x + w, y + fold], [x + w - fold, y + fold]], {
            roughness: 0.4,
            seed: hashStr$3(n.id + "f"),
            fill: palette.noteFold,
            fillStyle: "solid",
            stroke: strk,
            strokeWidth: Math.min(nStrokeWidth, 0.8),
        });
        return [body, foldEl];
    },
    renderCanvas(rc, _ctx, n, palette, opts) {
        const s = n.style ?? {};
        const { x, y, w, h } = n;
        const fold = NOTE.fold;
        const strk = String(s.stroke ?? palette.noteStroke);
        const nStrokeWidth = Number(s.strokeWidth ?? 1.2);
        rc.polygon([[x, y], [x + w - fold, y], [x + w, y + fold], [x + w, y + h], [x, y + h]], {
            ...opts,
            stroke: strk,
            strokeWidth: nStrokeWidth,
            ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
        });
        rc.polygon([[x + w - fold, y], [x + w, y + fold], [x + w - fold, y + fold]], {
            roughness: 0.4,
            seed: hashStr$3(n.id + "f"),
            fill: palette.noteFold,
            fillStyle: "solid",
            stroke: strk,
            strokeWidth: Math.min(nStrokeWidth, 0.8),
        });
    },
};

const lineShape = {
    size(n, labelW) {
        const labelH = n.label ? 20 : 0;
        n.w = n.width ?? Math.max(MIN_W, labelW + 20);
        n.h = n.height ?? (6 + labelH);
    },
    renderSVG(rc, n, _palette, opts) {
        const labelH = n.label ? 20 : 0;
        const lineY = n.y + (n.h - labelH) / 2;
        return [rc.line(n.x, lineY, n.x + n.w, lineY, opts)];
    },
    renderCanvas(rc, _ctx, n, _palette, opts) {
        const labelH = n.label ? 20 : 0;
        const lineY = n.y + (n.h - labelH) / 2;
        rc.line(n.x, lineY, n.x + n.w, lineY, opts);
    },
};

const COMMAND_RE = /^[AaCcHhLlMmQqSsTtVvZz]$/;
const TOKEN_RE = /[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;
const EPSILON = 1e-6;
const PARAM_COUNTS = {
    A: 7,
    C: 6,
    H: 1,
    L: 2,
    M: 2,
    Q: 4,
    S: 4,
    T: 2,
    V: 1,
    Z: 0,
};
function isCommandToken(token) {
    return COMMAND_RE.test(token);
}
function formatNumber(value) {
    const rounded = Math.abs(value) < EPSILON ? 0 : Number(value.toFixed(3));
    return Object.is(rounded, -0) ? "0" : String(rounded);
}
function parseRawSegments(pathData) {
    const tokens = pathData.match(TOKEN_RE) ?? [];
    if (!tokens.length)
        return [];
    const segments = [];
    let index = 0;
    let currentCommand = null;
    while (index < tokens.length) {
        const token = tokens[index];
        if (isCommandToken(token)) {
            currentCommand = token;
            index += 1;
            if (token === "Z" || token === "z") {
                segments.push({ command: "Z", values: [] });
            }
            continue;
        }
        if (!currentCommand)
            break;
        const upper = currentCommand.toUpperCase();
        const paramCount = PARAM_COUNTS[upper];
        if (!paramCount) {
            index += 1;
            continue;
        }
        let isFirstMove = upper === "M";
        while (index < tokens.length && !isCommandToken(tokens[index])) {
            if (index + paramCount > tokens.length)
                return segments;
            const values = tokens
                .slice(index, index + paramCount)
                .map((value) => Number(value));
            if (values.some((value) => Number.isNaN(value))) {
                return segments;
            }
            if (upper === "M") {
                const moveCommand = isFirstMove
                    ? currentCommand
                    : currentCommand === "m"
                        ? "l"
                        : "L";
                segments.push({ command: moveCommand, values });
                isFirstMove = false;
            }
            else {
                segments.push({ command: currentCommand, values });
            }
            index += paramCount;
        }
    }
    return segments;
}
function reflect(control, around) {
    return {
        x: around.x * 2 - control.x,
        y: around.y * 2 - control.y,
    };
}
function toAbsoluteSegments(rawSegments) {
    const segments = [];
    let current = { x: 0, y: 0 };
    let subpathStart = { x: 0, y: 0 };
    let previousCubicControl = null;
    let previousQuadraticControl = null;
    for (const segment of rawSegments) {
        const isRelative = segment.command === segment.command.toLowerCase();
        const command = segment.command.toUpperCase();
        const values = segment.values;
        switch (command) {
            case "M": {
                const x = isRelative ? current.x + values[0] : values[0];
                const y = isRelative ? current.y + values[1] : values[1];
                current = { x, y };
                subpathStart = { x, y };
                previousCubicControl = null;
                previousQuadraticControl = null;
                segments.push({ command: "M", values: [x, y] });
                break;
            }
            case "L": {
                const x = isRelative ? current.x + values[0] : values[0];
                const y = isRelative ? current.y + values[1] : values[1];
                current = { x, y };
                previousCubicControl = null;
                previousQuadraticControl = null;
                segments.push({ command: "L", values: [x, y] });
                break;
            }
            case "H": {
                const x = isRelative ? current.x + values[0] : values[0];
                current = { x, y: current.y };
                previousCubicControl = null;
                previousQuadraticControl = null;
                segments.push({ command: "L", values: [x, current.y] });
                break;
            }
            case "V": {
                const y = isRelative ? current.y + values[0] : values[0];
                current = { x: current.x, y };
                previousCubicControl = null;
                previousQuadraticControl = null;
                segments.push({ command: "L", values: [current.x, y] });
                break;
            }
            case "C": {
                const x1 = isRelative ? current.x + values[0] : values[0];
                const y1 = isRelative ? current.y + values[1] : values[1];
                const x2 = isRelative ? current.x + values[2] : values[2];
                const y2 = isRelative ? current.y + values[3] : values[3];
                const x = isRelative ? current.x + values[4] : values[4];
                const y = isRelative ? current.y + values[5] : values[5];
                current = { x, y };
                previousCubicControl = { x: x2, y: y2 };
                previousQuadraticControl = null;
                segments.push({ command: "C", values: [x1, y1, x2, y2, x, y] });
                break;
            }
            case "S": {
                const control1 = previousCubicControl
                    ? reflect(previousCubicControl, current)
                    : { ...current };
                const x2 = isRelative ? current.x + values[0] : values[0];
                const y2 = isRelative ? current.y + values[1] : values[1];
                const x = isRelative ? current.x + values[2] : values[2];
                const y = isRelative ? current.y + values[3] : values[3];
                current = { x, y };
                previousCubicControl = { x: x2, y: y2 };
                previousQuadraticControl = null;
                segments.push({
                    command: "C",
                    values: [control1.x, control1.y, x2, y2, x, y],
                });
                break;
            }
            case "Q": {
                const x1 = isRelative ? current.x + values[0] : values[0];
                const y1 = isRelative ? current.y + values[1] : values[1];
                const x = isRelative ? current.x + values[2] : values[2];
                const y = isRelative ? current.y + values[3] : values[3];
                current = { x, y };
                previousCubicControl = null;
                previousQuadraticControl = { x: x1, y: y1 };
                segments.push({ command: "Q", values: [x1, y1, x, y] });
                break;
            }
            case "T": {
                const control = previousQuadraticControl
                    ? reflect(previousQuadraticControl, current)
                    : { ...current };
                const x = isRelative ? current.x + values[0] : values[0];
                const y = isRelative ? current.y + values[1] : values[1];
                current = { x, y };
                previousCubicControl = null;
                previousQuadraticControl = control;
                segments.push({ command: "Q", values: [control.x, control.y, x, y] });
                break;
            }
            case "A": {
                const rx = Math.abs(values[0]);
                const ry = Math.abs(values[1]);
                const rotation = values[2];
                const largeArc = values[3];
                const sweep = values[4];
                const x = isRelative ? current.x + values[5] : values[5];
                const y = isRelative ? current.y + values[6] : values[6];
                current = { x, y };
                previousCubicControl = null;
                previousQuadraticControl = null;
                segments.push({
                    command: "A",
                    values: [rx, ry, rotation, largeArc, sweep, x, y],
                });
                break;
            }
            case "Z": {
                current = { ...subpathStart };
                previousCubicControl = null;
                previousQuadraticControl = null;
                segments.push({ command: "Z", values: [] });
                break;
            }
        }
    }
    return segments;
}
function cubicAt(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    return (mt * mt * mt * p0 +
        3 * mt * mt * t * p1 +
        3 * mt * t * t * p2 +
        t * t * t * p3);
}
function quadraticAt(p0, p1, p2, t) {
    const mt = 1 - t;
    return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}
function cubicExtrema(p0, p1, p2, p3) {
    const a = -p0 + 3 * p1 - 3 * p2 + p3;
    const b = 3 * p0 - 6 * p1 + 3 * p2;
    const c = -3 * p0 + 3 * p1;
    if (Math.abs(a) < EPSILON) {
        if (Math.abs(b) < EPSILON)
            return [];
        return [-c / (2 * b)].filter((t) => t > 0 && t < 1);
    }
    const discriminant = 4 * b * b - 12 * a * c;
    if (discriminant < 0)
        return [];
    const sqrtDiscriminant = Math.sqrt(discriminant);
    return [
        (-2 * b + sqrtDiscriminant) / (6 * a),
        (-2 * b - sqrtDiscriminant) / (6 * a),
    ].filter((t) => t > 0 && t < 1);
}
function quadraticExtrema(p0, p1, p2) {
    const denominator = p0 - 2 * p1 + p2;
    if (Math.abs(denominator) < EPSILON)
        return [];
    const t = (p0 - p1) / denominator;
    return t > 0 && t < 1 ? [t] : [];
}
function angleBetween(u, v) {
    const magnitude = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    if (magnitude < EPSILON)
        return 0;
    const sign = u.x * v.y - u.y * v.x < 0 ? -1 : 1;
    const cosine = Math.min(1, Math.max(-1, (u.x * v.x + u.y * v.y) / magnitude));
    return sign * Math.acos(cosine);
}
function sampleArc(start, values) {
    let [rx, ry, rotation, largeArcFlag, sweepFlag, endX, endY] = values;
    if ((Math.abs(start.x - endX) < EPSILON && Math.abs(start.y - endY) < EPSILON) || rx < EPSILON || ry < EPSILON) {
        return [start, { x: endX, y: endY }];
    }
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    const phi = (rotation * Math.PI) / 180;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const dx2 = (start.x - endX) / 2;
    const dy2 = (start.y - endY) / 2;
    const x1p = cosPhi * dx2 + sinPhi * dy2;
    const y1p = -sinPhi * dx2 + cosPhi * dy2;
    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) {
        const scale = Math.sqrt(lambda);
        rx *= scale;
        ry *= scale;
    }
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    const x1p2 = x1p * x1p;
    const y1p2 = y1p * y1p;
    const numerator = rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2;
    const denominator = rx2 * y1p2 + ry2 * x1p2;
    const factor = denominator < EPSILON ? 0 : Math.sqrt(Math.max(0, numerator / denominator));
    const sign = largeArcFlag === sweepFlag ? -1 : 1;
    const cxp = sign * factor * ((rx * y1p) / ry);
    const cyp = sign * factor * (-(ry * x1p) / rx);
    const cx = cosPhi * cxp - sinPhi * cyp + (start.x + endX) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (start.y + endY) / 2;
    const startVector = {
        x: (x1p - cxp) / rx,
        y: (y1p - cyp) / ry,
    };
    const endVector = {
        x: (-x1p - cxp) / rx,
        y: (-y1p - cyp) / ry,
    };
    let deltaTheta = angleBetween(startVector, endVector);
    if (!sweepFlag && deltaTheta > 0)
        deltaTheta -= Math.PI * 2;
    if (sweepFlag && deltaTheta < 0)
        deltaTheta += Math.PI * 2;
    const theta1 = angleBetween({ x: 1, y: 0 }, startVector);
    const steps = Math.max(12, Math.ceil(Math.abs(deltaTheta) / (Math.PI / 8)));
    const points = [];
    for (let index = 0; index <= steps; index += 1) {
        const theta = theta1 + (deltaTheta * index) / steps;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        points.push({
            x: cx + rx * cosPhi * cosTheta - ry * sinPhi * sinTheta,
            y: cy + rx * sinPhi * cosTheta + ry * cosPhi * sinTheta,
        });
    }
    return points;
}
function boundsFromAbsoluteSegments(segments) {
    if (!segments.length)
        return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const include = (point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    };
    let current = { x: 0, y: 0 };
    let subpathStart = { x: 0, y: 0 };
    for (const segment of segments) {
        switch (segment.command) {
            case "M": {
                current = { x: segment.values[0], y: segment.values[1] };
                subpathStart = { ...current };
                include(current);
                break;
            }
            case "L": {
                include(current);
                current = { x: segment.values[0], y: segment.values[1] };
                include(current);
                break;
            }
            case "C": {
                const [x1, y1, x2, y2, x, y] = segment.values;
                const ts = new Set([0, 1]);
                cubicExtrema(current.x, x1, x2, x).forEach((value) => ts.add(value));
                cubicExtrema(current.y, y1, y2, y).forEach((value) => ts.add(value));
                for (const t of ts) {
                    include({
                        x: cubicAt(current.x, x1, x2, x, t),
                        y: cubicAt(current.y, y1, y2, y, t),
                    });
                }
                current = { x, y };
                break;
            }
            case "Q": {
                const [x1, y1, x, y] = segment.values;
                const ts = new Set([0, 1]);
                quadraticExtrema(current.x, x1, x).forEach((value) => ts.add(value));
                quadraticExtrema(current.y, y1, y).forEach((value) => ts.add(value));
                for (const t of ts) {
                    include({
                        x: quadraticAt(current.x, x1, x, t),
                        y: quadraticAt(current.y, y1, y, t),
                    });
                }
                current = { x, y };
                break;
            }
            case "A": {
                for (const point of sampleArc(current, segment.values)) {
                    include(point);
                }
                current = { x: segment.values[5], y: segment.values[6] };
                break;
            }
            case "Z": {
                include(current);
                include(subpathStart);
                current = { ...subpathStart };
                break;
            }
        }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return null;
    }
    return { minX, minY, maxX, maxY };
}
function transformX(x, bounds, scaleX) {
    return (x - bounds.minX) * scaleX;
}
function transformY(y, bounds, scaleY) {
    return (y - bounds.minY) * scaleY;
}
function buildScaledPathData(segments, bounds, width, height) {
    const sourceWidth = Math.max(bounds.maxX - bounds.minX, EPSILON);
    const sourceHeight = Math.max(bounds.maxY - bounds.minY, EPSILON);
    const scaleX = width / sourceWidth;
    const scaleY = height / sourceHeight;
    return segments
        .map((segment) => {
        switch (segment.command) {
            case "M":
            case "L":
                return [
                    segment.command,
                    formatNumber(transformX(segment.values[0], bounds, scaleX)),
                    formatNumber(transformY(segment.values[1], bounds, scaleY)),
                ].join(" ");
            case "C":
                return [
                    "C",
                    formatNumber(transformX(segment.values[0], bounds, scaleX)),
                    formatNumber(transformY(segment.values[1], bounds, scaleY)),
                    formatNumber(transformX(segment.values[2], bounds, scaleX)),
                    formatNumber(transformY(segment.values[3], bounds, scaleY)),
                    formatNumber(transformX(segment.values[4], bounds, scaleX)),
                    formatNumber(transformY(segment.values[5], bounds, scaleY)),
                ].join(" ");
            case "Q":
                return [
                    "Q",
                    formatNumber(transformX(segment.values[0], bounds, scaleX)),
                    formatNumber(transformY(segment.values[1], bounds, scaleY)),
                    formatNumber(transformX(segment.values[2], bounds, scaleX)),
                    formatNumber(transformY(segment.values[3], bounds, scaleY)),
                ].join(" ");
            case "A":
                return [
                    "A",
                    formatNumber(segment.values[0] * scaleX),
                    formatNumber(segment.values[1] * scaleY),
                    formatNumber(segment.values[2]),
                    formatNumber(segment.values[3]),
                    formatNumber(segment.values[4]),
                    formatNumber(transformX(segment.values[5], bounds, scaleX)),
                    formatNumber(transformY(segment.values[6], bounds, scaleY)),
                ].join(" ");
            case "Z":
                return "Z";
        }
    })
        .join(" ");
}
function intrinsicSizeFromBounds(bounds) {
    if (!bounds)
        return { width: 100, height: 100 };
    return {
        width: Math.max(1, Math.ceil(bounds.maxX - bounds.minX)),
        height: Math.max(1, Math.ceil(bounds.maxY - bounds.minY)),
    };
}
function parsePathGeometry(pathData) {
    const segments = toAbsoluteSegments(parseRawSegments(pathData));
    return {
        segments,
        bounds: boundsFromAbsoluteSegments(segments),
    };
}
function getPathIntrinsicSize(pathData) {
    if (!pathData)
        return { width: 100, height: 100 };
    return intrinsicSizeFromBounds(parsePathGeometry(pathData).bounds);
}
function getRenderablePathData(pathData, width, height) {
    if (!pathData)
        return null;
    const { segments, bounds } = parsePathGeometry(pathData);
    if (!segments.length || !bounds)
        return pathData;
    return buildScaledPathData(segments, bounds, Math.max(1, width), Math.max(1, height));
}
function getRenderableNodePathData(node) {
    return getRenderablePathData(node.pathData, node.w, node.h);
}

const pathShape = {
    size(n, labelW) {
        const intrinsic = getPathIntrinsicSize(n.pathData);
        const w = n.width ?? Math.max(intrinsic.width, Math.min(300, labelW + 20));
        n.w = w;
        if (!n.h) {
            if (!n.width && !n.height && labelW + 20 > w) {
                const fontSize = Number(n.style?.fontSize ?? 14);
                const lines = Math.ceil(labelW / (w - 20));
                n.h = Math.max(intrinsic.height, lines * fontSize * 1.5 + 20);
            }
            else {
                n.h = n.height ?? intrinsic.height;
            }
        }
    },
    renderSVG(rc, n, _palette, opts) {
        const d = getRenderableNodePathData(n);
        if (!d) {
            return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts)];
        }
        const el = rc.path(d, opts);
        const g = document.createElementNS(SVG_NS, "g");
        g.setAttribute("transform", `translate(${n.x},${n.y})`);
        g.appendChild(el);
        return [g];
    },
    renderCanvas(rc, ctx, n, _palette, opts) {
        const d = getRenderableNodePathData(n);
        if (!d) {
            rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts);
            return;
        }
        ctx.save();
        ctx.translate(n.x, n.y);
        rc.path(d, opts);
        ctx.restore();
    },
};

// ============================================================
// Shape Registry — registers all built-in shapes
//
// To add a new shape:
//   1. Create src/renderer/shapes/my-shape.ts implementing ShapeDefinition
//   2. Import and register it here
//   3. Add the shape name to NodeShape union in ast/types.ts
//   4. Add to SHAPES array in parser/index.ts and KEYWORDS in tokenizer.ts
// ============================================================
registerShape("box", boxShape);
registerShape("circle", circleShape);
registerShape("diamond", diamondShape);
registerShape("hexagon", hexagonShape);
registerShape("triangle", triangleShape);
registerShape("cylinder", cylinderShape);
registerShape("parallelogram", parallelogramShape);
registerShape("text", textShape);
registerShape("icon", iconShape);
registerShape("image", imageShape);
registerShape("note", noteShape);
registerShape("line", lineShape);
registerShape("path", pathShape);

// ============================================================
// sketchmark — Layout Engine  (Flexbox-style, recursive)
//
// Two-pass algorithm:
//   Pass 1  measure()  bottom-up : computes w, h for every group
//   Pass 2  place()    top-down  : assigns x, y to every item
//
// Each group is a CSS-like flex container:
//   layout=row       → flex-direction: row
//   layout=column    → flex-direction: column   (default)
//   layout=grid      → CSS grid (fixed columns count)
//   align=…          → align-items
//   justify=…        → justify-content
// ============================================================
// ── Node auto-sizing ──────────────────────────────────────
function sizeNode(n) {
    // User-specified dimensions win
    if (n.width && n.width > 0)
        n.w = n.width;
    if (n.height && n.height > 0)
        n.h = n.height;
    // Use pretext for accurate label measurement
    const fontSize = Number(n.style?.fontSize ?? 14);
    const fontWeight = n.style?.fontWeight ?? 500;
    const fontFamily = String(n.style?.font ?? DEFAULT_FONT);
    const font = buildFontStr(fontSize, fontWeight, fontFamily);
    const labelW = Math.round(measureTextWidth(n.label, font) + NODE.basePad);
    const shape = getShape(n.shape);
    if (shape) {
        shape.size(n, labelW);
    }
    else {
        // fallback for unknown shapes — box-like default
        n.w = n.w || Math.max(90, Math.min(300, labelW));
        n.h = n.h || 52;
    }
}
// ── Table auto-sizing ─────────────────────────────────────
function sizeTable(t) {
    const { rows, labelH, headerH, rowH } = t;
    if (!rows.length) {
        t.w = 120;
        t.h = labelH + rowH;
        return;
    }
    const numCols = Math.max(...rows.map((r) => r.cells.length));
    const colW = Array(numCols).fill(TABLE.minColW);
    for (const row of rows) {
        row.cells.forEach((cell, i) => {
            colW[i] = Math.max(colW[i], Math.ceil(cell.length * TABLE.fontPxPerChar) + TABLE.cellPad);
        });
    }
    t.colWidths = colW;
    t.w = colW.reduce((s, w) => s + w, 0);
    const nHeader = rows.filter((r) => r.kind === "header").length;
    const nData = rows.filter((r) => r.kind === "data").length;
    t.h = labelH + nHeader * headerH + nData * rowH;
}
function sizeChart(_c) {
    // defaults already applied in buildSceneGraph
}
function sizeMarkdown(m) {
    const pad = Number(m.style?.padding ?? 0);
    const fontFamily = String(m.style?.font ?? DEFAULT_FONT);
    m.w = m.width ?? calcMarkdownWidth(m.lines, fontFamily, pad);
    m.h = m.height ?? calcMarkdownHeight(m.lines, pad);
}
// ── Item size helpers (entity-map based) ─────────────────
function iW(r, em) {
    return em.get(r.id).w;
}
function iH(r, em) {
    return em.get(r.id).h;
}
function iAuthX(r, em) {
    return em.get(r.id).authoredX ?? 0;
}
function iAuthY(r, em) {
    return em.get(r.id).authoredY ?? 0;
}
function setPos(r, x, y, em) {
    const e = em.get(r.id);
    e.x = Math.round(x);
    e.y = Math.round(y);
}
// ── Pass 1: Measure (bottom-up) ───────────────────────────
// Recursively computes w, h for a group from its children's sizes.
function measure(g, gm, tm, cm, mdm, em) {
    // Recurse into nested groups first; size tables before reading their dims
    for (const r of g.children) {
        if (r.kind === "group")
            measure(gm.get(r.id), gm, tm, cm, mdm, em);
        if (r.kind === "table")
            sizeTable(tm.get(r.id));
        if (r.kind === "chart")
            sizeChart(cm.get(r.id));
        if (r.kind === "markdown")
            sizeMarkdown(mdm.get(r.id));
    }
    const { padding: pad, gap, columns, layout } = g;
    const kids = g.children;
    const labelH = g.label ? LAYOUT.groupLabelH : 0;
    if (!kids.length) {
        g.w = pad * 2;
        g.h = pad * 2 + labelH;
        if (g.width && g.w < g.width)
            g.w = g.width;
        if (g.height && g.h < g.height)
            g.h = g.height;
        return;
    }
    const ws = kids.map((r) => iW(r, em));
    const hs = kids.map((r) => iH(r, em));
    const n = kids.length;
    if (layout === "row") {
        g.w = ws.reduce((s, w) => s + w, 0) + gap * (n - 1) + pad * 2;
        g.h = Math.max(...hs) + pad * 2 + labelH;
    }
    else if (layout === "grid") {
        const cols = Math.max(1, columns);
        const rows = Math.ceil(n / cols);
        const cellW = Math.max(...ws);
        const cellH = Math.max(...hs);
        g.w = cols * cellW + (cols - 1) * gap + pad * 2;
        g.h = rows * cellH + (rows - 1) * gap + pad * 2 + labelH;
    }
    else if (layout === "absolute") {
        const maxRight = Math.max(0, ...kids.map((r) => iAuthX(r, em) + iW(r, em)));
        const maxBottom = Math.max(0, ...kids.map((r) => iAuthY(r, em) + iH(r, em)));
        g.w = maxRight + pad * 2;
        g.h = maxBottom + pad * 2 + labelH;
    }
    else {
        // column (default)
        g.w = Math.max(...ws) + pad * 2;
        g.h = hs.reduce((s, h) => s + h, 0) + gap * (n - 1) + pad * 2 + labelH;
    }
    // Clamp to minWidth / minHeight — this is what gives distribute() free
    // space to work with for justify=center/end/space-between/space-around
    if (g.width && g.w < g.width)
        g.w = g.width;
    if (g.height && g.h < g.height)
        g.h = g.height;
}
// ── Justify distribution helper ───────────────────────────
function distribute(sizes, contentSize, gap, justify) {
    const n = sizes.length;
    const totalSize = sizes.reduce((s, v) => s + v, 0);
    const gapCount = n - 1;
    switch (justify) {
        case "center": {
            const total = totalSize + gap * gapCount;
            return {
                start: Math.max(0, (contentSize - total) / 2),
                gaps: Array(gapCount).fill(gap),
            };
        }
        case "end": {
            const total = totalSize + gap * gapCount;
            return {
                start: Math.max(0, contentSize - total),
                gaps: Array(gapCount).fill(gap),
            };
        }
        case "space-between": {
            const g2 = gapCount > 0
                ? Math.max(gap, (contentSize - totalSize) / gapCount)
                : gap;
            return { start: 0, gaps: Array(gapCount).fill(g2) };
        }
        case "space-around": {
            const space = n > 0 ? (contentSize - totalSize) / n : gap;
            return {
                start: Math.max(0, space / 2),
                gaps: Array(gapCount).fill(Math.max(gap, space)),
            };
        }
        default: // start
            return { start: 0, gaps: Array(gapCount).fill(gap) };
    }
}
// ── Pass 2: Place (top-down) ──────────────────────────────
// Assigns x, y to each child. Assumes g.x / g.y already set by parent.
function place(g, gm, em) {
    const { padding: pad, gap, columns, layout, align, justify } = g;
    const labelH = g.label ? LAYOUT.groupLabelH : 0;
    const contentX = g.x + pad;
    const contentY = g.y + labelH + pad;
    const contentW = g.w - pad * 2;
    const contentH = g.h - pad * 2 - labelH;
    const kids = g.children;
    if (!kids.length)
        return;
    if (layout === "row") {
        const ws = kids.map((r) => iW(r, em));
        const hs = kids.map((r) => iH(r, em));
        const { start, gaps } = distribute(ws, contentW, gap, justify);
        let x = contentX + start;
        for (let i = 0; i < kids.length; i++) {
            let y;
            switch (align) {
                case "center":
                    y = contentY + (contentH - hs[i]) / 2;
                    break;
                case "end":
                    y = contentY + contentH - hs[i];
                    break;
                default:
                    y = contentY;
            }
            setPos(kids[i], x, y, em);
            x += ws[i] + (i < gaps.length ? gaps[i] : 0);
        }
    }
    else if (layout === "grid") {
        const cols = Math.max(1, columns);
        const cellW = Math.max(...kids.map((r) => iW(r, em)));
        const cellH = Math.max(...kids.map((r) => iH(r, em)));
        kids.forEach((ref, i) => {
            setPos(ref, contentX + (i % cols) * (cellW + gap), contentY + Math.floor(i / cols) * (cellH + gap), em);
        });
    }
    else if (layout === "absolute") {
        kids.forEach((ref) => {
            setPos(ref, contentX + iAuthX(ref, em), contentY + iAuthY(ref, em), em);
        });
    }
    else {
        // column (default)
        const ws = kids.map((r) => iW(r, em));
        const hs = kids.map((r) => iH(r, em));
        const { start, gaps } = distribute(hs, contentH, gap, justify);
        let y = contentY + start;
        for (let i = 0; i < kids.length; i++) {
            let x;
            switch (align) {
                case "center":
                    x = contentX + (contentW - ws[i]) / 2;
                    break;
                case "end":
                    x = contentX + contentW - ws[i];
                    break;
                default:
                    x = contentX;
            }
            setPos(kids[i], x, y, em);
            y += hs[i] + (i < gaps.length ? gaps[i] : 0);
        }
    }
    // Recurse into nested groups
    for (const r of kids) {
        if (r.kind === "group")
            place(gm.get(r.id), gm, em);
    }
}
// ── Edge routing ──────────────────────────────────────────
function connPoint(n, other) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const ox = other.x + other.w / 2, oy = other.y + other.h / 2;
    const dx = ox - cx, dy = oy - cy;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)
        return [cx, cy];
    if (n.shape === "circle") {
        const r = n.w * 0.44, len = Math.sqrt(dx * dx + dy * dy);
        return [cx + (dx / len) * r, cy + (dy / len) * r];
    }
    const hw = n.w / 2 - 2, hh = n.h / 2 - 2;
    const tx = Math.abs(dx) > 0.01 ? hw / Math.abs(dx) : 1e9;
    const ty = Math.abs(dy) > 0.01 ? hh / Math.abs(dy) : 1e9;
    const t = Math.min(tx, ty);
    return [cx + t * dx, cy + t * dy];
}
function clampInset(value) {
    return Math.max(2, value);
}
function anchoredConnPoint(entity, anchor, otherCX, otherCY) {
    if (!anchor) {
        if (entity.shape && otherCX != null && otherCY != null) {
            return connPoint(entity, { x: otherCX - 1, y: otherCY - 1, w: 2, h: 2});
        }
        if (otherCX != null && otherCY != null) {
            return rectConnPoint(entity.x, entity.y, entity.w, entity.h, otherCX, otherCY);
        }
        return [entity.x + entity.w / 2, entity.y + entity.h / 2];
    }
    const insetX = clampInset(Math.min(10, entity.w / 2));
    const insetY = clampInset(Math.min(10, entity.h / 2));
    const left = entity.x + insetX;
    const right = entity.x + entity.w - insetX;
    const top = entity.y + insetY;
    const bottom = entity.y + entity.h - insetY;
    const cx = entity.x + entity.w / 2;
    const cy = entity.y + entity.h / 2;
    switch (anchor) {
        case "top":
            return [cx, top];
        case "right":
            return [right, cy];
        case "bottom":
            return [cx, bottom];
        case "left":
            return [left, cy];
        case "center":
            return [cx, cy];
        case "top-left":
            return [left, top];
        case "top-right":
            return [right, top];
        case "bottom-left":
            return [left, bottom];
        case "bottom-right":
            return [right, bottom];
        default:
            return [cx, cy];
    }
}
function rectConnPoint(rx, ry, rw, rh, ox, oy) {
    const cx = rx + rw / 2, cy = ry + rh / 2;
    const dx = ox - cx, dy = oy - cy;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)
        return [cx, cy];
    const hw = rw / 2 - 2, hh = rh / 2 - 2;
    const tx = Math.abs(dx) > 0.01 ? hw / Math.abs(dx) : 1e9;
    const ty = Math.abs(dy) > 0.01 ? hh / Math.abs(dy) : 1e9;
    const t = Math.min(tx, ty);
    return [cx + t * dx, cy + t * dy];
}
function routeEdges(sg) {
    const nm = nodeMap(sg);
    const tm = tableMap(sg);
    const gm = groupMap(sg);
    const cm = chartMap(sg);
    function resolve(id) {
        const n = nm.get(id);
        if (n)
            return n;
        const t = tm.get(id);
        if (t)
            return t;
        const g = gm.get(id);
        if (g)
            return g;
        const c = cm.get(id);
        if (c)
            return c;
        return null;
    }
    for (const e of sg.edges) {
        const src = resolve(e.from);
        const dst = resolve(e.to);
        if (!src || !dst) {
            e.points = [];
            continue;
        }
        const dstCX = dst.x + dst.w / 2, dstCY = dst.y + dst.h / 2;
        const srcCX = src.x + src.w / 2, srcCY = src.y + src.h / 2;
        e.points = [
            anchoredConnPoint(src, e.fromAnchor, dstCX, dstCY),
            anchoredConnPoint(dst, e.toAnchor, srcCX, srcCY),
        ];
    }
}
function computeBounds(sg, margin) {
    const allX = [
        ...sg.nodes.map((n) => n.x + n.w),
        ...sg.groups.filter((g) => g.w).map((g) => g.x + g.w),
        ...sg.tables.map((t) => t.x + t.w),
        ...sg.charts.map((c) => c.x + c.w),
        ...sg.markdowns.map((m) => m.x + m.w),
    ];
    const allY = [
        ...sg.nodes.map((n) => n.y + n.h),
        ...sg.groups.filter((g) => g.h).map((g) => g.y + g.h),
        ...sg.tables.map((t) => t.y + t.h),
        ...sg.charts.map((c) => c.y + c.h),
        ...sg.markdowns.map((m) => m.y + m.h),
    ];
    const autoWidth = (allX.length ? Math.max(...allX) : 400) + margin;
    const autoHeight = (allY.length ? Math.max(...allY) : 300) + margin;
    sg.width = sg.fixedWidth ?? autoWidth;
    sg.height = sg.fixedHeight ?? autoHeight;
}
// ── Public entry point ────────────────────────────────────
function layout(sg) {
    const GAP_MAIN = Number(sg.config["gap"] ?? LAYOUT.gap);
    const MARGIN = Number(sg.config["margin"] ?? LAYOUT.margin);
    const gm = groupMap(sg);
    const tm = tableMap(sg);
    const cm = chartMap(sg);
    const mdm = markdownMap(sg);
    // 1. Size all nodes and tables
    sg.nodes.forEach(sizeNode);
    sg.tables.forEach(sizeTable);
    sg.charts.forEach(sizeChart);
    sg.markdowns.forEach(sizeMarkdown);
    // Build unified entity map (all entities have x,y,w,h — map holds direct refs)
    const em = buildEntityMap(sg);
    // 2. Identify root vs nested items
    const nestedGroupIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "group").map((c) => c.id)));
    const groupedNodeIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "node").map((c) => c.id)));
    const groupedTableIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "table").map((c) => c.id)));
    const groupedChartIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "chart").map((c) => c.id)));
    const groupedMarkdownIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "markdown").map((c) => c.id)));
    const rootGroups = sg.groups.filter((g) => !nestedGroupIds.has(g.id));
    const rootNodes = sg.nodes.filter((n) => !groupedNodeIds.has(n.id));
    const rootTables = sg.tables.filter((t) => !groupedTableIds.has(t.id));
    const rootCharts = sg.charts.filter((c) => !groupedChartIds.has(c.id));
    const rootMarkdowns = sg.markdowns.filter((m) => !groupedMarkdownIds.has(m.id));
    // 3. Measure root groups bottom-up
    for (const g of rootGroups)
        measure(g, gm, tm, cm, mdm, em);
    // 4. Build root order
    //    sg.rootOrder preserves DSL declaration order.
    //    Fall back: groups, then nodes, then tables.
    const defaultRootOrder = [
        ...rootGroups.map((g) => ({ kind: "group", id: g.id })),
        ...rootNodes.map((n) => ({ kind: "node", id: n.id })),
        ...rootTables.map((t) => ({ kind: "table", id: t.id })),
        ...rootCharts.map((c) => ({ kind: "chart", id: c.id })),
        ...rootMarkdowns.map((m) => ({ kind: "markdown", id: m.id })),
    ];
    const rootOrderSource = sg.rootOrder?.length ? sg.rootOrder : defaultRootOrder;
    const rootOrder = rootOrderSource.filter((ref) => {
        switch (ref.kind) {
            case "group":
                return !nestedGroupIds.has(ref.id);
            case "node":
                return !groupedNodeIds.has(ref.id);
            case "table":
                return !groupedTableIds.has(ref.id);
            case "chart":
                return !groupedChartIds.has(ref.id);
            case "markdown":
                return !groupedMarkdownIds.has(ref.id);
            default:
                return true;
        }
    });
    // 5. Root-level layout
    //    sg.layout:
    //      'row'    → items flow left to right  (default)
    //      'column' → items flow top to bottom
    //      'grid'   → config columns=N grid
    const rootLayout = (sg.layout ?? "row");
    const rootCols = Number(sg.config["columns"] ?? 1);
    const useGrid = rootLayout === "grid" && rootCols > 0;
    const useColumn = rootLayout === "column";
    const useAbsolute = rootLayout === "absolute";
    if (useGrid) {
        // ── Grid: per-row heights, per-column widths (no wasted space) ──
        const cols = rootCols;
        const rows = Math.ceil(rootOrder.length / cols);
        const colWidths = Array(cols).fill(0);
        const rowHeights = Array(rows).fill(0);
        rootOrder.forEach((ref, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const e = em.get(ref.id);
            colWidths[col] = Math.max(colWidths[col], e.w);
            rowHeights[row] = Math.max(rowHeights[row], e.h);
        });
        const colX = [];
        let cx = MARGIN;
        for (let c = 0; c < cols; c++) {
            colX.push(cx);
            cx += colWidths[c] + GAP_MAIN;
        }
        const rowY = [];
        let ry = MARGIN;
        for (let r = 0; r < rows; r++) {
            rowY.push(ry);
            ry += rowHeights[r] + GAP_MAIN;
        }
        rootOrder.forEach((ref, idx) => {
            const e = em.get(ref.id);
            e.x = colX[idx % cols];
            e.y = rowY[Math.floor(idx / cols)];
        });
    }
    else if (useAbsolute) {
        for (const ref of rootOrder) {
            const e = em.get(ref.id);
            e.x = MARGIN + (e.authoredX ?? 0);
            e.y = MARGIN + (e.authoredY ?? 0);
        }
    }
    else {
        // ── Row or Column linear flow ──────────────────────────
        let pos = MARGIN;
        for (const ref of rootOrder) {
            const e = em.get(ref.id);
            e.x = useColumn ? MARGIN : pos;
            e.y = useColumn ? pos : MARGIN;
            pos += (useColumn ? e.h : e.w) + GAP_MAIN;
        }
    }
    // 6. Place children within each root group (top-down, recursive)
    for (const g of rootGroups)
        place(g, gm, em);
    // 7. Route edges and compute canvas size
    routeEdges(sg);
    computeBounds(sg, MARGIN);
    return sg;
}

// ============================================================
// sketchmark — Rough Chart Math
// Shared data-processing and layout helpers for both renderers.
// No rough.js dependency — pure geometry.
// ============================================================
const CHART_COLORS = [
    '#378ADD', '#1D9E75', '#D85A30', '#BA7517',
    '#7F77DD', '#D4537E', '#639922', '#E24B4A',
];
function chartLayout(c) {
    const titleH = c.label ? CHART.titleH : CHART.titleHEmpty;
    const padL = CHART.padL, padR = CHART.padR, padB = CHART.padB, padT = CHART.padT;
    const pw = c.w - padL - padR;
    const ph = c.h - titleH - padT - padB;
    return {
        px: c.x + padL,
        py: c.y + titleH + padT,
        pw, ph, titleH,
        cx: c.x + c.w / 2,
        cy: c.y + titleH + padT + ph / 2,
    };
}
function parseBarLine(data) {
    return {
        labels: data.rows.map(r => String(r[0])),
        series: data.headers.slice(1).map((h, si) => ({
            name: String(h),
            values: data.rows.map(r => Number(r[si + 1])),
            color: CHART_COLORS[si % CHART_COLORS.length],
        })),
    };
}
function parsePie(data) {
    const segments = data.rows.map((r, i) => ({
        label: String(r[0]),
        value: Number(r[1]),
        color: CHART_COLORS[i % CHART_COLORS.length],
    }));
    return { segments, total: segments.reduce((s, g) => s + g.value, 0) };
}
function parseScatter(data) {
    return data.rows.map(r => ({
        label: String(r[0]), x: Number(r[1]), y: Number(r[2]),
    }));
}
// ── Value → pixel mappers ──────────────────────────────────
function makeValueToY(allValues, py, ph) {
    const lo = Math.min(0, ...allValues);
    const hi = Math.max(...allValues);
    const range = hi - lo || 1;
    return (v) => py + ph - ((v - lo) / range) * ph;
}
function makeValueToX(allValues, px, pw) {
    const lo = Math.min(...allValues);
    const hi = Math.max(...allValues);
    const range = hi - lo || 1;
    return (v) => px + ((v - lo) / range) * pw;
}
/** Nice round tick values for a Y axis. */
function yTicks(allValues) {
    const lo = Math.min(0, ...allValues);
    const hi = Math.max(...allValues);
    const rng = hi - lo || 1;
    const mag = Math.pow(10, Math.floor(Math.log10(rng)));
    const step = rng / mag > 5 ? mag * 2 : rng / mag > 2 ? mag : mag / 2;
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 0.01; v += step) {
        ticks.push(Math.round(v * 1e6) / 1e6);
    }
    return ticks;
}
// ── SVG arc path helpers ───────────────────────────────────
function pieArcPath(cx, cy, r, startAngle, endAngle) {
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const lg = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`;
}
function donutArcPath(cx, cy, r, ir, startAngle, endAngle) {
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + ir * Math.cos(endAngle), iy1 = cy + ir * Math.sin(endAngle);
    const ix2 = cx + ir * Math.cos(startAngle), iy2 = cy + ir * Math.sin(startAngle);
    const lg = endAngle - startAngle > Math.PI ? 1 : 0;
    return (`M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} ` +
        `L ${ix1} ${iy1} A ${ir} ${ir} 0 ${lg} 0 ${ix2} ${iy2} Z`);
}

// ============================================================
// sketchmark — SVG Rough Chart Drawing
// Drop this file as src/renderer/svg/roughChartSVG.ts
// and import renderRoughChartSVG into svg/index.ts.
//
// CHANGES TO svg/index.ts:
//   1. Remove the entire `const CL = mkGroup("chart-layer")` block
//   2. Add import at the top:
//        import { renderRoughChartSVG } from './roughChartSVG';
//   3. Replace removed block with:
//        const CL = mkGroup('chart-layer');
//        for (const c of sg.charts) CL.appendChild(renderRoughChartSVG(rc, c, palette, isDark));
//        svg.appendChild(CL);
//
//   Also remove the Chart.js `declare const Chart: any;` at the top of svg/index.ts
//   and the CHART_COLORS array (they live in roughChart.ts now).
// ============================================================
const NS$1 = SVG_NS$1;
const se$1 = (tag) => document.createElementNS(NS$1, tag);
function mkG(id, cls) {
    const g = se$1('g');
    if (id)
        g.setAttribute('id', id);
    g.setAttribute('class', cls);
    return g;
}
function mkT(txt, x, y, sz = 10, wt = 400, col = '#4a2e10', anchor = 'middle', font = 'system-ui, sans-serif') {
    const t = se$1('text');
    t.setAttribute('x', String(x));
    t.setAttribute('y', String(y));
    t.setAttribute('text-anchor', anchor);
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('font-family', font);
    t.setAttribute('font-size', String(sz));
    t.setAttribute('font-weight', String(wt));
    t.setAttribute('fill', col);
    t.setAttribute('pointer-events', 'none');
    t.textContent = txt;
    return t;
}
function hashStr$2(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++)
        h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
    return h;
}
const BASE = { roughness: ROUGH.chartRoughness, bowing: ROUGH.bowing };
// ── Axes ───────────────────────────────────────────────────
function drawAxes$1(rc, g, c, px, py, pw, ph, allY, labelCol, font = 'system-ui, sans-serif') {
    // Y axis
    g.appendChild(rc.line(px, py, px, py + ph, {
        roughness: 0.4, seed: hashStr$2(c.id + 'ya'), stroke: labelCol, strokeWidth: 1,
    }));
    // X axis (baseline)
    const baseline = makeValueToY(allY, py, ph)(0);
    g.appendChild(rc.line(px, baseline, px + pw, baseline, {
        roughness: 0.4, seed: hashStr$2(c.id + 'xa'), stroke: labelCol, strokeWidth: 1,
    }));
    // Y ticks + labels
    const toY = makeValueToY(allY, py, ph);
    for (const tick of yTicks(allY)) {
        const ty = toY(tick);
        if (ty < py - 2 || ty > py + ph + 2)
            continue;
        g.appendChild(rc.line(px - 3, ty, px, ty, {
            roughness: 0.2, seed: hashStr$2(c.id + 'yt' + tick), stroke: labelCol, strokeWidth: 0.7,
        }));
        g.appendChild(mkT(fmtNum$1(tick), px - 5, ty, 9, 400, labelCol, 'end', font));
    }
}
function fmtNum$1(v) {
    if (Math.abs(v) >= 1000)
        return (v / 1000).toFixed(1) + 'k';
    return String(v);
}
// ── Legend row ─────────────────────────────────────────────
function legend(g, labels, colors, x, y, labelCol, font = 'system-ui, sans-serif') {
    labels.forEach((lbl, i) => {
        const dot = se$1('rect');
        dot.setAttribute('x', String(x));
        dot.setAttribute('y', String(y + i * 14));
        dot.setAttribute('width', '8');
        dot.setAttribute('height', '8');
        dot.setAttribute('fill', colors[i % colors.length]);
        dot.setAttribute('rx', '1');
        g.appendChild(dot);
        g.appendChild(mkT(lbl, x + 12, y + i * 14 + 4, 9, 400, labelCol, 'start', font));
    });
}
// ── Public entry ───────────────────────────────────────────
function renderRoughChartSVG(rc, c, palette, isDark) {
    const cg = mkG(`chart-${c.id}`, 'cg');
    const s = c.style ?? {};
    // style/theme props, falling back to palette
    const bgFill = String(s.fill ?? palette.nodeFill);
    const bgStroke = String(s.stroke ?? (isDark ? '#5a4a30' : '#c8b898'));
    const lc = String(s.color ?? palette.titleText);
    const cFont = String(s.font ? `${s.font}, system-ui, sans-serif` : 'system-ui, sans-serif');
    const cFontSize = Number(s.fontSize ?? 12);
    const cFontWeight = s.fontWeight ?? 600;
    if (s.opacity != null)
        cg.setAttribute('opacity', String(s.opacity));
    // Background box
    cg.appendChild(rc.rectangle(c.x, c.y, c.w, c.h, {
        ...BASE, seed: hashStr$2(c.id),
        fill: bgFill, fillStyle: 'solid',
        stroke: bgStroke, strokeWidth: Number(s.strokeWidth ?? 1.2),
        ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
    }));
    // Title
    if (c.label) {
        cg.appendChild(mkT(c.label, c.x + c.w / 2, c.y + 14, cFontSize, cFontWeight, lc, 'middle', cFont));
    }
    const { px, py, pw, ph, cx, cy } = chartLayout(c);
    // ── Pie / Donut ──────────────────────────────────────────
    if (c.chartType === 'pie' || c.chartType === 'donut') {
        const { segments, total } = parsePie(c.data);
        const r = Math.min(c.w * 0.38, (c.h - (c.label ? 24 : 8)) * 0.44);
        const ir = c.chartType === 'donut' ? r * 0.48 : 0;
        const legendX = c.x + 8;
        const legendY = c.y + (c.label ? 28 : 12);
        let angle = -Math.PI / 2;
        for (const seg of segments) {
            const sweep = (seg.value / total) * Math.PI * 2;
            const d = c.chartType === 'donut'
                ? donutArcPath(cx, cy, r, ir, angle, angle + sweep)
                : pieArcPath(cx, cy, r, angle, angle + sweep);
            cg.appendChild(rc.path(d, {
                roughness: 1.0, bowing: 0.5, seed: hashStr$2(c.id + seg.label),
                fill: seg.color + 'bb',
                fillStyle: 'solid',
                stroke: seg.color,
                strokeWidth: 1.4,
            }));
            angle += sweep;
        }
        // Mini legend on left
        legend(cg, segments.map(s => `${s.label} ${Math.round(s.value / total * 100)}%`), segments.map(s => s.color), legendX, legendY, lc, cFont);
        return cg;
    }
    // ── Scatter ───────────────────────────────────────────────
    if (c.chartType === 'scatter') {
        const pts = parseScatter(c.data);
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const toX = makeValueToX(xs, px, pw);
        const toY = makeValueToY(ys, py, ph);
        // Simple axes (no named ticks — raw data ranges)
        cg.appendChild(rc.line(px, py, px, py + ph, { roughness: 0.4, seed: hashStr$2(c.id + 'ya'), stroke: lc, strokeWidth: 1 }));
        cg.appendChild(rc.line(px, py + ph, px + pw, py + ph, { roughness: 0.4, seed: hashStr$2(c.id + 'xa'), stroke: lc, strokeWidth: 1 }));
        pts.forEach((pt, i) => {
            cg.appendChild(rc.ellipse(toX(pt.x), toY(pt.y), 10, 10, {
                roughness: 0.8, seed: hashStr$2(c.id + pt.label),
                fill: CHART_COLORS[i % CHART_COLORS.length] + '99',
                fillStyle: 'solid',
                stroke: CHART_COLORS[i % CHART_COLORS.length],
                strokeWidth: 1.2,
            }));
        });
        legend(cg, pts.map(p => p.label), CHART_COLORS, c.x + 8, c.y + (c.label ? 28 : 12), lc, cFont);
        return cg;
    }
    // ── Bar / Line / Area ─────────────────────────────────────
    const { labels, series } = parseBarLine(c.data);
    const allY = series.flatMap(s => s.values);
    const toY = makeValueToY(allY, py, ph);
    const baseline = toY(0);
    const n = labels.length;
    drawAxes$1(rc, cg, c, px, py, pw, ph, allY, lc, cFont);
    // X labels
    labels.forEach((lbl, i) => {
        cg.appendChild(mkT(lbl, px + (i + 0.5) * (pw / n), py + ph + 14, 9, 400, lc, 'middle', cFont));
    });
    if (c.chartType === 'bar') {
        const groupW = pw / n;
        const m = series.length;
        const barW = (groupW / m) * 0.72;
        const slip = (groupW - barW * m) / (m + 1);
        series.forEach((ser, si) => {
            ser.values.forEach((val, i) => {
                const bx = px + i * groupW + slip + si * (barW + slip);
                const by = Math.min(toY(val), baseline);
                const bh = Math.abs(baseline - toY(val)) || 2;
                cg.appendChild(rc.rectangle(bx, by, barW, bh, {
                    roughness: 1.1, bowing: 0.5,
                    seed: hashStr$2(c.id + si + i),
                    fill: ser.color + 'bb',
                    fillStyle: 'hachure',
                    hachureAngle: -41,
                    hachureGap: 4,
                    fillWeight: 0.8,
                    stroke: ser.color,
                    strokeWidth: 1.2,
                }));
            });
        });
    }
    else {
        // line / area — x positions evenly spaced
        const stepX = n > 1 ? pw / (n - 1) : 0;
        series.forEach((ser, si) => {
            const pts = ser.values.map((v, i) => [
                n > 1 ? px + i * stepX : px + pw / 2,
                toY(v),
            ]);
            // Area fill polygon
            if (c.chartType === 'area') {
                const poly = [
                    [pts[0][0], baseline],
                    ...pts,
                    [pts[pts.length - 1][0], baseline],
                ];
                cg.appendChild(rc.polygon(poly, {
                    roughness: 0.5, seed: hashStr$2(c.id + 'af' + si),
                    fill: ser.color + '44',
                    fillStyle: 'solid',
                    stroke: 'none',
                }));
            }
            // Line segments
            for (let i = 0; i < pts.length - 1; i++) {
                cg.appendChild(rc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], {
                    roughness: 0.9, bowing: 0.6,
                    seed: hashStr$2(c.id + si + i),
                    stroke: ser.color,
                    strokeWidth: 1.8,
                }));
            }
            // Point dots
            pts.forEach(([px2, py2], i) => {
                cg.appendChild(rc.ellipse(px2, py2, 7, 7, {
                    roughness: 0.3, seed: hashStr$2(c.id + 'dot' + si + i),
                    fill: ser.color,
                    fillStyle: 'solid',
                    stroke: ser.color,
                    strokeWidth: 1,
                }));
            });
        });
    }
    // Multi-series legend
    if (series.length > 1) {
        legend(cg, series.map(s => s.name), series.map(s => s.color), px, py - 2, lc, cFont);
    }
    return cg;
}

// ============================================================
// sketchmark — Global Theme Palette Library
// ============================================================
// Usage in DSL:
//   theme default=ocean          ← activates a built-in palette
//   theme default=dark           ← built-in dark mode
//   config theme=ocean           ← alternative syntax
//
// All palettes follow the same DiagramPalette shape so renderers
// only need one code path regardless of which theme is active.
// ============================================================
// ── Built-in palettes ──────────────────────────────────────
const PALETTES = {
    // ── light (default) ───────────────────────────────────
    light: {
        nodeFill: "#fefcf8",
        nodeStroke: "#2c1c0e",
        nodeText: "#1a1208",
        edgeStroke: "#2c1c0e",
        edgeLabelBg: "#f8f4ea",
        edgeLabelText: "#4a2e10",
        groupFill: "#f5f0e8",
        groupStroke: "#c8a878",
        groupDash: [7, 5],
        groupLabel: "#7a5028",
        tableFill: "#fefcf8",
        tableStroke: "#c8b898",
        tableText: "#1a1208",
        tableHeaderFill: "#f0e8d8",
        tableHeaderText: "#3a2010",
        tableDivider: "#d8c8a8",
        noteFill: "#fffde7",
        noteStroke: "#f0a500",
        noteText: "#5a4000",
        noteFold: "#f0a500",
        chartFill: "#fefcf8",
        chartStroke: "#c8b898",
        chartAxisStroke: "#8a7060",
        chartText: "#4a2e10",
        chartTitleText: "#1a1208",
        background: "#f8f4ea",
        titleText: "#1a1208",
    },
    // ── dark ──────────────────────────────────────────────
    dark: {
        nodeFill: "#1e1812",
        nodeStroke: "#c8a870",
        nodeText: "#f0dca8",
        edgeStroke: "#c8a870",
        edgeLabelBg: "#1e1812",
        edgeLabelText: "#ddc898",
        groupFill: "#2a2218",
        groupStroke: "#6a5030",
        groupDash: [7, 5],
        groupLabel: "#c8a060",
        tableFill: "#1e1812",
        tableStroke: "#6a5030",
        tableText: "#f0dca8",
        tableHeaderFill: "#2e2418",
        tableHeaderText: "#f5e0a8",
        tableDivider: "#4a3820",
        noteFill: "#2a2410",
        noteStroke: "#c8a060",
        noteText: "#ddc898",
        noteFold: "#c8a060",
        chartFill: "#1e1812",
        chartStroke: "#6a5030",
        chartAxisStroke: "#9a8060",
        chartText: "#ddc898",
        chartTitleText: "#f0dca8",
        background: "#12100a",
        titleText: "#f0dca8",
    },
    // ── sketch ─────────────────────────────────────────────
    sketch: {
        nodeFill: "#f4f4f2",
        nodeStroke: "#2e2e2e",
        nodeText: "#1a1a1a",
        edgeStroke: "#3a3a3a",
        edgeLabelBg: "#ebebea",
        edgeLabelText: "#2a2a2a",
        groupFill: "#eeeeec",
        groupStroke: "#8a8a88",
        groupDash: [6, 4],
        groupLabel: "#4a4a48",
        tableFill: "#f7f7f5",
        tableStroke: "#9a9a98",
        tableText: "#1a1a1a",
        tableHeaderFill: "#dededc",
        tableHeaderText: "#111111",
        tableDivider: "#c4c4c2",
        noteFill: "#f5f5f0",
        noteStroke: "#6a6a68",
        noteText: "#2a2a2a",
        noteFold: "#8a8a88",
        chartFill: "#f4f4f2",
        chartStroke: "#9a9a98",
        chartAxisStroke: "#5a5a58",
        chartText: "#2a2a2a",
        chartTitleText: "#111111",
        background: "#f0f0ee",
        titleText: "#111111",
    },
    // ── ocean ─────────────────────────────────────────────
    ocean: {
        nodeFill: "#e8f4ff",
        nodeStroke: "#0044cc",
        nodeText: "#003399",
        edgeStroke: "#0055cc",
        edgeLabelBg: "#d0e8ff",
        edgeLabelText: "#003388",
        groupFill: "#ddeeff",
        groupStroke: "#4488dd",
        groupDash: [7, 5],
        groupLabel: "#0044aa",
        tableFill: "#e8f4ff",
        tableStroke: "#4488dd",
        tableText: "#003399",
        tableHeaderFill: "#cce0ff",
        tableHeaderText: "#002288",
        tableDivider: "#88bbee",
        noteFill: "#e0f0ff",
        noteStroke: "#0066cc",
        noteText: "#003388",
        noteFold: "#0066cc",
        chartFill: "#e8f4ff",
        chartStroke: "#4488dd",
        chartAxisStroke: "#336699",
        chartText: "#003388",
        chartTitleText: "#002277",
        background: "#f0f8ff",
        titleText: "#002277",
    },
    // ── forest ────────────────────────────────────────────
    forest: {
        nodeFill: "#e8ffe8",
        nodeStroke: "#007700",
        nodeText: "#004400",
        edgeStroke: "#228822",
        edgeLabelBg: "#d0f0d0",
        edgeLabelText: "#004400",
        groupFill: "#d8f0d8",
        groupStroke: "#44aa44",
        groupDash: [7, 5],
        groupLabel: "#005500",
        tableFill: "#e8ffe8",
        tableStroke: "#44aa44",
        tableText: "#004400",
        tableHeaderFill: "#c8eec8",
        tableHeaderText: "#003300",
        tableDivider: "#88cc88",
        noteFill: "#e0ffe0",
        noteStroke: "#009900",
        noteText: "#004400",
        noteFold: "#009900",
        chartFill: "#e8ffe8",
        chartStroke: "#44aa44",
        chartAxisStroke: "#336633",
        chartText: "#004400",
        chartTitleText: "#003300",
        background: "#f0fff0",
        titleText: "#003300",
    },
    // ── sunset ────────────────────────────────────────────
    sunset: {
        nodeFill: "#fff0e8",
        nodeStroke: "#c85428",
        nodeText: "#7a2800",
        edgeStroke: "#c85428",
        edgeLabelBg: "#ffe0cc",
        edgeLabelText: "#7a2800",
        groupFill: "#ffe8d8",
        groupStroke: "#e07040",
        groupDash: [7, 5],
        groupLabel: "#883300",
        tableFill: "#fff0e8",
        tableStroke: "#e07040",
        tableText: "#7a2800",
        tableHeaderFill: "#ffd8c0",
        tableHeaderText: "#661800",
        tableDivider: "#e8a888",
        noteFill: "#fff0d8",
        noteStroke: "#e07040",
        noteText: "#7a2800",
        noteFold: "#e07040",
        chartFill: "#fff0e8",
        chartStroke: "#e07040",
        chartAxisStroke: "#aa5530",
        chartText: "#7a2800",
        chartTitleText: "#661800",
        background: "#fff8f0",
        titleText: "#661800",
    },
    // ── slate ─────────────────────────────────────────────
    slate: {
        nodeFill: "#f0f2f5",
        nodeStroke: "#4a5568",
        nodeText: "#1a202c",
        edgeStroke: "#4a5568",
        edgeLabelBg: "#e2e8f0",
        edgeLabelText: "#2d3748",
        groupFill: "#e2e8f0",
        groupStroke: "#718096",
        groupDash: [7, 5],
        groupLabel: "#2d3748",
        tableFill: "#f0f2f5",
        tableStroke: "#718096",
        tableText: "#1a202c",
        tableHeaderFill: "#e2e8f0",
        tableHeaderText: "#1a202c",
        tableDivider: "#a0aec0",
        noteFill: "#fefcbf",
        noteStroke: "#d69e2e",
        noteText: "#744210",
        noteFold: "#d69e2e",
        chartFill: "#f0f2f5",
        chartStroke: "#718096",
        chartAxisStroke: "#4a5568",
        chartText: "#2d3748",
        chartTitleText: "#1a202c",
        background: "#edf2f7",
        titleText: "#1a202c",
    },
    // ── rose ──────────────────────────────────────────────
    rose: {
        nodeFill: "#fff0f3",
        nodeStroke: "#cc3355",
        nodeText: "#7a0022",
        edgeStroke: "#cc3355",
        edgeLabelBg: "#ffd0da",
        edgeLabelText: "#7a0022",
        groupFill: "#ffe0e8",
        groupStroke: "#dd5577",
        groupDash: [7, 5],
        groupLabel: "#880033",
        tableFill: "#fff0f3",
        tableStroke: "#dd5577",
        tableText: "#7a0022",
        tableHeaderFill: "#ffd0da",
        tableHeaderText: "#660022",
        tableDivider: "#eea0b0",
        noteFill: "#fff0f3",
        noteStroke: "#cc3355",
        noteText: "#7a0022",
        noteFold: "#cc3355",
        chartFill: "#fff0f3",
        chartStroke: "#dd5577",
        chartAxisStroke: "#aa3355",
        chartText: "#7a0022",
        chartTitleText: "#660022",
        background: "#fff5f7",
        titleText: "#660022",
    },
    // ── midnight ──────────────────────────────────────────
    midnight: {
        nodeFill: "#0d1117",
        nodeStroke: "#58a6ff",
        nodeText: "#c9d1d9",
        edgeStroke: "#58a6ff",
        edgeLabelBg: "#161b22",
        edgeLabelText: "#c9d1d9",
        groupFill: "#161b22",
        groupStroke: "#30363d",
        groupDash: [7, 5],
        groupLabel: "#8b949e",
        tableFill: "#0d1117",
        tableStroke: "#30363d",
        tableText: "#c9d1d9",
        tableHeaderFill: "#161b22",
        tableHeaderText: "#e6edf3",
        tableDivider: "#30363d",
        noteFill: "#161b22",
        noteStroke: "#58a6ff",
        noteText: "#c9d1d9",
        noteFold: "#58a6ff",
        chartFill: "#0d1117",
        chartStroke: "#30363d",
        chartAxisStroke: "#8b949e",
        chartText: "#c9d1d9",
        chartTitleText: "#e6edf3",
        background: "#010409",
        titleText: "#e6edf3",
    },
};
// ── Palette resolver ───────────────────────────────────────
function resolvePalette(name) {
    if (!name)
        return PALETTES.light;
    return PALETTES[name] ?? PALETTES.light;
}
// ── DSL config key that activates a palette ────────────────
// Usage in DSL:  config theme=ocean
const THEME_CONFIG_KEY = "theme";
function listThemes() {
    return Object.keys(PALETTES);
}
const THEME_NAMES = Object.keys(PALETTES);

function rotatePoints(points, center, degrees) {
    if (points && points.length) {
        const [cx, cy] = center;
        const angle = (Math.PI / 180) * degrees;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        for (const p of points) {
            const [x, y] = p;
            p[0] = ((x - cx) * cos) - ((y - cy) * sin) + cx;
            p[1] = ((x - cx) * sin) + ((y - cy) * cos) + cy;
        }
    }
}
function rotateLines(lines, center, degrees) {
    const points = [];
    lines.forEach((line) => points.push(...line));
    rotatePoints(points, center, degrees);
}
function areSamePoints(p1, p2) {
    return p1[0] === p2[0] && p1[1] === p2[1];
}
function hachureLines(polygons, hachureGap, hachureAngle, hachureStepOffset = 1) {
    const angle = hachureAngle;
    const gap = Math.max(hachureGap, 0.1);
    const polygonList = (polygons[0] && polygons[0][0] && (typeof polygons[0][0] === 'number')) ? [polygons] : polygons;
    const rotationCenter = [0, 0];
    if (angle) {
        for (const polygon of polygonList) {
            rotatePoints(polygon, rotationCenter, angle);
        }
    }
    const lines = straightHachureLines(polygonList, gap, hachureStepOffset);
    if (angle) {
        for (const polygon of polygonList) {
            rotatePoints(polygon, rotationCenter, -angle);
        }
        rotateLines(lines, rotationCenter, -angle);
    }
    return lines;
}
function straightHachureLines(polygons, gap, hachureStepOffset) {
    const vertexArray = [];
    for (const polygon of polygons) {
        const vertices = [...polygon];
        if (!areSamePoints(vertices[0], vertices[vertices.length - 1])) {
            vertices.push([vertices[0][0], vertices[0][1]]);
        }
        if (vertices.length > 2) {
            vertexArray.push(vertices);
        }
    }
    const lines = [];
    gap = Math.max(gap, 0.1);
    // Create sorted edges table
    const edges = [];
    for (const vertices of vertexArray) {
        for (let i = 0; i < vertices.length - 1; i++) {
            const p1 = vertices[i];
            const p2 = vertices[i + 1];
            if (p1[1] !== p2[1]) {
                const ymin = Math.min(p1[1], p2[1]);
                edges.push({
                    ymin,
                    ymax: Math.max(p1[1], p2[1]),
                    x: ymin === p1[1] ? p1[0] : p2[0],
                    islope: (p2[0] - p1[0]) / (p2[1] - p1[1]),
                });
            }
        }
    }
    edges.sort((e1, e2) => {
        if (e1.ymin < e2.ymin) {
            return -1;
        }
        if (e1.ymin > e2.ymin) {
            return 1;
        }
        if (e1.x < e2.x) {
            return -1;
        }
        if (e1.x > e2.x) {
            return 1;
        }
        if (e1.ymax === e2.ymax) {
            return 0;
        }
        return (e1.ymax - e2.ymax) / Math.abs((e1.ymax - e2.ymax));
    });
    if (!edges.length) {
        return lines;
    }
    // Start scanning
    let activeEdges = [];
    let y = edges[0].ymin;
    let iteration = 0;
    while (activeEdges.length || edges.length) {
        if (edges.length) {
            let ix = -1;
            for (let i = 0; i < edges.length; i++) {
                if (edges[i].ymin > y) {
                    break;
                }
                ix = i;
            }
            const removed = edges.splice(0, ix + 1);
            removed.forEach((edge) => {
                activeEdges.push({ s: y, edge });
            });
        }
        activeEdges = activeEdges.filter((ae) => {
            if (ae.edge.ymax <= y) {
                return false;
            }
            return true;
        });
        activeEdges.sort((ae1, ae2) => {
            if (ae1.edge.x === ae2.edge.x) {
                return 0;
            }
            return (ae1.edge.x - ae2.edge.x) / Math.abs((ae1.edge.x - ae2.edge.x));
        });
        // fill between the edges
        if ((hachureStepOffset !== 1) || (iteration % gap === 0)) {
            if (activeEdges.length > 1) {
                for (let i = 0; i < activeEdges.length; i = i + 2) {
                    const nexti = i + 1;
                    if (nexti >= activeEdges.length) {
                        break;
                    }
                    const ce = activeEdges[i].edge;
                    const ne = activeEdges[nexti].edge;
                    lines.push([
                        [Math.round(ce.x), y],
                        [Math.round(ne.x), y],
                    ]);
                }
            }
        }
        y += hachureStepOffset;
        activeEdges.forEach((ae) => {
            ae.edge.x = ae.edge.x + (hachureStepOffset * ae.edge.islope);
        });
        iteration++;
    }
    return lines;
}

function polygonHachureLines(polygonList, o) {
    var _a;
    const angle = o.hachureAngle + 90;
    let gap = o.hachureGap;
    if (gap < 0) {
        gap = o.strokeWidth * 4;
    }
    gap = Math.round(Math.max(gap, 0.1));
    let skipOffset = 1;
    if (o.roughness >= 1) {
        if ((((_a = o.randomizer) === null || _a === void 0 ? void 0 : _a.next()) || Math.random()) > 0.7) {
            skipOffset = gap;
        }
    }
    return hachureLines(polygonList, gap, angle, skipOffset || 1);
}

class HachureFiller {
    constructor(helper) {
        this.helper = helper;
    }
    fillPolygons(polygonList, o) {
        return this._fillPolygons(polygonList, o);
    }
    _fillPolygons(polygonList, o) {
        const lines = polygonHachureLines(polygonList, o);
        const ops = this.renderLines(lines, o);
        return { type: 'fillSketch', ops };
    }
    renderLines(lines, o) {
        const ops = [];
        for (const line of lines) {
            ops.push(...this.helper.doubleLineOps(line[0][0], line[0][1], line[1][0], line[1][1], o));
        }
        return ops;
    }
}

function lineLength(line) {
    const p1 = line[0];
    const p2 = line[1];
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
}

class ZigZagFiller extends HachureFiller {
    fillPolygons(polygonList, o) {
        let gap = o.hachureGap;
        if (gap < 0) {
            gap = o.strokeWidth * 4;
        }
        gap = Math.max(gap, 0.1);
        const o2 = Object.assign({}, o, { hachureGap: gap });
        const lines = polygonHachureLines(polygonList, o2);
        const zigZagAngle = (Math.PI / 180) * o.hachureAngle;
        const zigzagLines = [];
        const dgx = gap * 0.5 * Math.cos(zigZagAngle);
        const dgy = gap * 0.5 * Math.sin(zigZagAngle);
        for (const [p1, p2] of lines) {
            if (lineLength([p1, p2])) {
                zigzagLines.push([
                    [p1[0] - dgx, p1[1] + dgy],
                    [...p2],
                ], [
                    [p1[0] + dgx, p1[1] - dgy],
                    [...p2],
                ]);
            }
        }
        const ops = this.renderLines(zigzagLines, o);
        return { type: 'fillSketch', ops };
    }
}

class HatchFiller extends HachureFiller {
    fillPolygons(polygonList, o) {
        const set = this._fillPolygons(polygonList, o);
        const o2 = Object.assign({}, o, { hachureAngle: o.hachureAngle + 90 });
        const set2 = this._fillPolygons(polygonList, o2);
        set.ops = set.ops.concat(set2.ops);
        return set;
    }
}

class DotFiller {
    constructor(helper) {
        this.helper = helper;
    }
    fillPolygons(polygonList, o) {
        o = Object.assign({}, o, { hachureAngle: 0 });
        const lines = polygonHachureLines(polygonList, o);
        return this.dotsOnLines(lines, o);
    }
    dotsOnLines(lines, o) {
        const ops = [];
        let gap = o.hachureGap;
        if (gap < 0) {
            gap = o.strokeWidth * 4;
        }
        gap = Math.max(gap, 0.1);
        let fweight = o.fillWeight;
        if (fweight < 0) {
            fweight = o.strokeWidth / 2;
        }
        const ro = gap / 4;
        for (const line of lines) {
            const length = lineLength(line);
            const dl = length / gap;
            const count = Math.ceil(dl) - 1;
            const offset = length - (count * gap);
            const x = ((line[0][0] + line[1][0]) / 2) - (gap / 4);
            const minY = Math.min(line[0][1], line[1][1]);
            for (let i = 0; i < count; i++) {
                const y = minY + offset + (i * gap);
                const cx = (x - ro) + Math.random() * 2 * ro;
                const cy = (y - ro) + Math.random() * 2 * ro;
                const el = this.helper.ellipse(cx, cy, fweight, fweight, o);
                ops.push(...el.ops);
            }
        }
        return { type: 'fillSketch', ops };
    }
}

class DashedFiller {
    constructor(helper) {
        this.helper = helper;
    }
    fillPolygons(polygonList, o) {
        const lines = polygonHachureLines(polygonList, o);
        return { type: 'fillSketch', ops: this.dashedLine(lines, o) };
    }
    dashedLine(lines, o) {
        const offset = o.dashOffset < 0 ? (o.hachureGap < 0 ? (o.strokeWidth * 4) : o.hachureGap) : o.dashOffset;
        const gap = o.dashGap < 0 ? (o.hachureGap < 0 ? (o.strokeWidth * 4) : o.hachureGap) : o.dashGap;
        const ops = [];
        lines.forEach((line) => {
            const length = lineLength(line);
            const count = Math.floor(length / (offset + gap));
            const startOffset = (length + gap - (count * (offset + gap))) / 2;
            let p1 = line[0];
            let p2 = line[1];
            if (p1[0] > p2[0]) {
                p1 = line[1];
                p2 = line[0];
            }
            const alpha = Math.atan((p2[1] - p1[1]) / (p2[0] - p1[0]));
            for (let i = 0; i < count; i++) {
                const lstart = i * (offset + gap);
                const lend = lstart + offset;
                const start = [p1[0] + (lstart * Math.cos(alpha)) + (startOffset * Math.cos(alpha)), p1[1] + lstart * Math.sin(alpha) + (startOffset * Math.sin(alpha))];
                const end = [p1[0] + (lend * Math.cos(alpha)) + (startOffset * Math.cos(alpha)), p1[1] + (lend * Math.sin(alpha)) + (startOffset * Math.sin(alpha))];
                ops.push(...this.helper.doubleLineOps(start[0], start[1], end[0], end[1], o));
            }
        });
        return ops;
    }
}

class ZigZagLineFiller {
    constructor(helper) {
        this.helper = helper;
    }
    fillPolygons(polygonList, o) {
        const gap = o.hachureGap < 0 ? (o.strokeWidth * 4) : o.hachureGap;
        const zo = o.zigzagOffset < 0 ? gap : o.zigzagOffset;
        o = Object.assign({}, o, { hachureGap: gap + zo });
        const lines = polygonHachureLines(polygonList, o);
        return { type: 'fillSketch', ops: this.zigzagLines(lines, zo, o) };
    }
    zigzagLines(lines, zo, o) {
        const ops = [];
        lines.forEach((line) => {
            const length = lineLength(line);
            const count = Math.round(length / (2 * zo));
            let p1 = line[0];
            let p2 = line[1];
            if (p1[0] > p2[0]) {
                p1 = line[1];
                p2 = line[0];
            }
            const alpha = Math.atan((p2[1] - p1[1]) / (p2[0] - p1[0]));
            for (let i = 0; i < count; i++) {
                const lstart = i * 2 * zo;
                const lend = (i + 1) * 2 * zo;
                const dz = Math.sqrt(2 * Math.pow(zo, 2));
                const start = [p1[0] + (lstart * Math.cos(alpha)), p1[1] + lstart * Math.sin(alpha)];
                const end = [p1[0] + (lend * Math.cos(alpha)), p1[1] + (lend * Math.sin(alpha))];
                const middle = [start[0] + dz * Math.cos(alpha + Math.PI / 4), start[1] + dz * Math.sin(alpha + Math.PI / 4)];
                ops.push(...this.helper.doubleLineOps(start[0], start[1], middle[0], middle[1], o), ...this.helper.doubleLineOps(middle[0], middle[1], end[0], end[1], o));
            }
        });
        return ops;
    }
}

const fillers = {};
function getFiller(o, helper) {
    let fillerName = o.fillStyle || 'hachure';
    if (!fillers[fillerName]) {
        switch (fillerName) {
            case 'zigzag':
                if (!fillers[fillerName]) {
                    fillers[fillerName] = new ZigZagFiller(helper);
                }
                break;
            case 'cross-hatch':
                if (!fillers[fillerName]) {
                    fillers[fillerName] = new HatchFiller(helper);
                }
                break;
            case 'dots':
                if (!fillers[fillerName]) {
                    fillers[fillerName] = new DotFiller(helper);
                }
                break;
            case 'dashed':
                if (!fillers[fillerName]) {
                    fillers[fillerName] = new DashedFiller(helper);
                }
                break;
            case 'zigzag-line':
                if (!fillers[fillerName]) {
                    fillers[fillerName] = new ZigZagLineFiller(helper);
                }
                break;
            case 'hachure':
            default:
                fillerName = 'hachure';
                if (!fillers[fillerName]) {
                    fillers[fillerName] = new HachureFiller(helper);
                }
                break;
        }
    }
    return fillers[fillerName];
}

function randomSeed() {
    return Math.floor(Math.random() * 2 ** 31);
}
class Random {
    constructor(seed) {
        this.seed = seed;
    }
    next() {
        if (this.seed) {
            return ((2 ** 31 - 1) & (this.seed = Math.imul(48271, this.seed))) / 2 ** 31;
        }
        else {
            return Math.random();
        }
    }
}

const COMMAND = 0;
const NUMBER = 1;
const EOD = 2;
const PARAMS = { A: 7, a: 7, C: 6, c: 6, H: 1, h: 1, L: 2, l: 2, M: 2, m: 2, Q: 4, q: 4, S: 4, s: 4, T: 2, t: 2, V: 1, v: 1, Z: 0, z: 0 };
function tokenize(d) {
    const tokens = new Array();
    while (d !== '') {
        if (d.match(/^([ \t\r\n,]+)/)) {
            d = d.substr(RegExp.$1.length);
        }
        else if (d.match(/^([aAcChHlLmMqQsStTvVzZ])/)) {
            tokens[tokens.length] = { type: COMMAND, text: RegExp.$1 };
            d = d.substr(RegExp.$1.length);
        }
        else if (d.match(/^(([-+]?[0-9]+(\.[0-9]*)?|[-+]?\.[0-9]+)([eE][-+]?[0-9]+)?)/)) {
            tokens[tokens.length] = { type: NUMBER, text: `${parseFloat(RegExp.$1)}` };
            d = d.substr(RegExp.$1.length);
        }
        else {
            return [];
        }
    }
    tokens[tokens.length] = { type: EOD, text: '' };
    return tokens;
}
function isType(token, type) {
    return token.type === type;
}
function parsePath(d) {
    const segments = [];
    const tokens = tokenize(d);
    let mode = 'BOD';
    let index = 0;
    let token = tokens[index];
    while (!isType(token, EOD)) {
        let paramsCount = 0;
        const params = [];
        if (mode === 'BOD') {
            if (token.text === 'M' || token.text === 'm') {
                index++;
                paramsCount = PARAMS[token.text];
                mode = token.text;
            }
            else {
                return parsePath('M0,0' + d);
            }
        }
        else if (isType(token, NUMBER)) {
            paramsCount = PARAMS[mode];
        }
        else {
            index++;
            paramsCount = PARAMS[token.text];
            mode = token.text;
        }
        if ((index + paramsCount) < tokens.length) {
            for (let i = index; i < index + paramsCount; i++) {
                const numbeToken = tokens[i];
                if (isType(numbeToken, NUMBER)) {
                    params[params.length] = +numbeToken.text;
                }
                else {
                    throw new Error('Param not a number: ' + mode + ',' + numbeToken.text);
                }
            }
            if (typeof PARAMS[mode] === 'number') {
                const segment = { key: mode, data: params };
                segments.push(segment);
                index += paramsCount;
                token = tokens[index];
                if (mode === 'M')
                    mode = 'L';
                if (mode === 'm')
                    mode = 'l';
            }
            else {
                throw new Error('Bad segment: ' + mode);
            }
        }
        else {
            throw new Error('Path data ended short');
        }
    }
    return segments;
}

// Translate relative commands to absolute commands
function absolutize(segments) {
    let cx = 0, cy = 0;
    let subx = 0, suby = 0;
    const out = [];
    for (const { key, data } of segments) {
        switch (key) {
            case 'M':
                out.push({ key: 'M', data: [...data] });
                [cx, cy] = data;
                [subx, suby] = data;
                break;
            case 'm':
                cx += data[0];
                cy += data[1];
                out.push({ key: 'M', data: [cx, cy] });
                subx = cx;
                suby = cy;
                break;
            case 'L':
                out.push({ key: 'L', data: [...data] });
                [cx, cy] = data;
                break;
            case 'l':
                cx += data[0];
                cy += data[1];
                out.push({ key: 'L', data: [cx, cy] });
                break;
            case 'C':
                out.push({ key: 'C', data: [...data] });
                cx = data[4];
                cy = data[5];
                break;
            case 'c': {
                const newdata = data.map((d, i) => (i % 2) ? (d + cy) : (d + cx));
                out.push({ key: 'C', data: newdata });
                cx = newdata[4];
                cy = newdata[5];
                break;
            }
            case 'Q':
                out.push({ key: 'Q', data: [...data] });
                cx = data[2];
                cy = data[3];
                break;
            case 'q': {
                const newdata = data.map((d, i) => (i % 2) ? (d + cy) : (d + cx));
                out.push({ key: 'Q', data: newdata });
                cx = newdata[2];
                cy = newdata[3];
                break;
            }
            case 'A':
                out.push({ key: 'A', data: [...data] });
                cx = data[5];
                cy = data[6];
                break;
            case 'a':
                cx += data[5];
                cy += data[6];
                out.push({ key: 'A', data: [data[0], data[1], data[2], data[3], data[4], cx, cy] });
                break;
            case 'H':
                out.push({ key: 'H', data: [...data] });
                cx = data[0];
                break;
            case 'h':
                cx += data[0];
                out.push({ key: 'H', data: [cx] });
                break;
            case 'V':
                out.push({ key: 'V', data: [...data] });
                cy = data[0];
                break;
            case 'v':
                cy += data[0];
                out.push({ key: 'V', data: [cy] });
                break;
            case 'S':
                out.push({ key: 'S', data: [...data] });
                cx = data[2];
                cy = data[3];
                break;
            case 's': {
                const newdata = data.map((d, i) => (i % 2) ? (d + cy) : (d + cx));
                out.push({ key: 'S', data: newdata });
                cx = newdata[2];
                cy = newdata[3];
                break;
            }
            case 'T':
                out.push({ key: 'T', data: [...data] });
                cx = data[0];
                cy = data[1];
                break;
            case 't':
                cx += data[0];
                cy += data[1];
                out.push({ key: 'T', data: [cx, cy] });
                break;
            case 'Z':
            case 'z':
                out.push({ key: 'Z', data: [] });
                cx = subx;
                cy = suby;
                break;
        }
    }
    return out;
}

// Normalize path to include only M, L, C, and Z commands
function normalize(segments) {
    const out = [];
    let lastType = '';
    let cx = 0, cy = 0;
    let subx = 0, suby = 0;
    let lcx = 0, lcy = 0;
    for (const { key, data } of segments) {
        switch (key) {
            case 'M':
                out.push({ key: 'M', data: [...data] });
                [cx, cy] = data;
                [subx, suby] = data;
                break;
            case 'C':
                out.push({ key: 'C', data: [...data] });
                cx = data[4];
                cy = data[5];
                lcx = data[2];
                lcy = data[3];
                break;
            case 'L':
                out.push({ key: 'L', data: [...data] });
                [cx, cy] = data;
                break;
            case 'H':
                cx = data[0];
                out.push({ key: 'L', data: [cx, cy] });
                break;
            case 'V':
                cy = data[0];
                out.push({ key: 'L', data: [cx, cy] });
                break;
            case 'S': {
                let cx1 = 0, cy1 = 0;
                if (lastType === 'C' || lastType === 'S') {
                    cx1 = cx + (cx - lcx);
                    cy1 = cy + (cy - lcy);
                }
                else {
                    cx1 = cx;
                    cy1 = cy;
                }
                out.push({ key: 'C', data: [cx1, cy1, ...data] });
                lcx = data[0];
                lcy = data[1];
                cx = data[2];
                cy = data[3];
                break;
            }
            case 'T': {
                const [x, y] = data;
                let x1 = 0, y1 = 0;
                if (lastType === 'Q' || lastType === 'T') {
                    x1 = cx + (cx - lcx);
                    y1 = cy + (cy - lcy);
                }
                else {
                    x1 = cx;
                    y1 = cy;
                }
                const cx1 = cx + 2 * (x1 - cx) / 3;
                const cy1 = cy + 2 * (y1 - cy) / 3;
                const cx2 = x + 2 * (x1 - x) / 3;
                const cy2 = y + 2 * (y1 - y) / 3;
                out.push({ key: 'C', data: [cx1, cy1, cx2, cy2, x, y] });
                lcx = x1;
                lcy = y1;
                cx = x;
                cy = y;
                break;
            }
            case 'Q': {
                const [x1, y1, x, y] = data;
                const cx1 = cx + 2 * (x1 - cx) / 3;
                const cy1 = cy + 2 * (y1 - cy) / 3;
                const cx2 = x + 2 * (x1 - x) / 3;
                const cy2 = y + 2 * (y1 - y) / 3;
                out.push({ key: 'C', data: [cx1, cy1, cx2, cy2, x, y] });
                lcx = x1;
                lcy = y1;
                cx = x;
                cy = y;
                break;
            }
            case 'A': {
                const r1 = Math.abs(data[0]);
                const r2 = Math.abs(data[1]);
                const angle = data[2];
                const largeArcFlag = data[3];
                const sweepFlag = data[4];
                const x = data[5];
                const y = data[6];
                if (r1 === 0 || r2 === 0) {
                    out.push({ key: 'C', data: [cx, cy, x, y, x, y] });
                    cx = x;
                    cy = y;
                }
                else {
                    if (cx !== x || cy !== y) {
                        const curves = arcToCubicCurves(cx, cy, x, y, r1, r2, angle, largeArcFlag, sweepFlag);
                        curves.forEach(function (curve) {
                            out.push({ key: 'C', data: curve });
                        });
                        cx = x;
                        cy = y;
                    }
                }
                break;
            }
            case 'Z':
                out.push({ key: 'Z', data: [] });
                cx = subx;
                cy = suby;
                break;
        }
        lastType = key;
    }
    return out;
}
function degToRad(degrees) {
    return (Math.PI * degrees) / 180;
}
function rotate(x, y, angleRad) {
    const X = x * Math.cos(angleRad) - y * Math.sin(angleRad);
    const Y = x * Math.sin(angleRad) + y * Math.cos(angleRad);
    return [X, Y];
}
function arcToCubicCurves(x1, y1, x2, y2, r1, r2, angle, largeArcFlag, sweepFlag, recursive) {
    const angleRad = degToRad(angle);
    let params = [];
    let f1 = 0, f2 = 0, cx = 0, cy = 0;
    if (recursive) {
        [f1, f2, cx, cy] = recursive;
    }
    else {
        [x1, y1] = rotate(x1, y1, -angleRad);
        [x2, y2] = rotate(x2, y2, -angleRad);
        const x = (x1 - x2) / 2;
        const y = (y1 - y2) / 2;
        let h = (x * x) / (r1 * r1) + (y * y) / (r2 * r2);
        if (h > 1) {
            h = Math.sqrt(h);
            r1 = h * r1;
            r2 = h * r2;
        }
        const sign = (largeArcFlag === sweepFlag) ? -1 : 1;
        const r1Pow = r1 * r1;
        const r2Pow = r2 * r2;
        const left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x;
        const right = r1Pow * y * y + r2Pow * x * x;
        const k = sign * Math.sqrt(Math.abs(left / right));
        cx = k * r1 * y / r2 + (x1 + x2) / 2;
        cy = k * -r2 * x / r1 + (y1 + y2) / 2;
        f1 = Math.asin(parseFloat(((y1 - cy) / r2).toFixed(9)));
        f2 = Math.asin(parseFloat(((y2 - cy) / r2).toFixed(9)));
        if (x1 < cx) {
            f1 = Math.PI - f1;
        }
        if (x2 < cx) {
            f2 = Math.PI - f2;
        }
        if (f1 < 0) {
            f1 = Math.PI * 2 + f1;
        }
        if (f2 < 0) {
            f2 = Math.PI * 2 + f2;
        }
        if (sweepFlag && f1 > f2) {
            f1 = f1 - Math.PI * 2;
        }
        if (!sweepFlag && f2 > f1) {
            f2 = f2 - Math.PI * 2;
        }
    }
    let df = f2 - f1;
    if (Math.abs(df) > (Math.PI * 120 / 180)) {
        const f2old = f2;
        const x2old = x2;
        const y2old = y2;
        if (sweepFlag && f2 > f1) {
            f2 = f1 + (Math.PI * 120 / 180) * (1);
        }
        else {
            f2 = f1 + (Math.PI * 120 / 180) * (-1);
        }
        x2 = cx + r1 * Math.cos(f2);
        y2 = cy + r2 * Math.sin(f2);
        params = arcToCubicCurves(x2, y2, x2old, y2old, r1, r2, angle, 0, sweepFlag, [f2, f2old, cx, cy]);
    }
    df = f2 - f1;
    const c1 = Math.cos(f1);
    const s1 = Math.sin(f1);
    const c2 = Math.cos(f2);
    const s2 = Math.sin(f2);
    const t = Math.tan(df / 4);
    const hx = 4 / 3 * r1 * t;
    const hy = 4 / 3 * r2 * t;
    const m1 = [x1, y1];
    const m2 = [x1 + hx * s1, y1 - hy * c1];
    const m3 = [x2 + hx * s2, y2 - hy * c2];
    const m4 = [x2, y2];
    m2[0] = 2 * m1[0] - m2[0];
    m2[1] = 2 * m1[1] - m2[1];
    if (recursive) {
        return [m2, m3, m4].concat(params);
    }
    else {
        params = [m2, m3, m4].concat(params);
        const curves = [];
        for (let i = 0; i < params.length; i += 3) {
            const r1 = rotate(params[i][0], params[i][1], angleRad);
            const r2 = rotate(params[i + 1][0], params[i + 1][1], angleRad);
            const r3 = rotate(params[i + 2][0], params[i + 2][1], angleRad);
            curves.push([r1[0], r1[1], r2[0], r2[1], r3[0], r3[1]]);
        }
        return curves;
    }
}

const helper = {
    randOffset,
    randOffsetWithRange,
    ellipse,
    doubleLineOps: doubleLineFillOps,
};
function line(x1, y1, x2, y2, o) {
    return { type: 'path', ops: _doubleLine(x1, y1, x2, y2, o) };
}
function linearPath(points, close, o) {
    const len = (points || []).length;
    if (len > 2) {
        const ops = [];
        for (let i = 0; i < (len - 1); i++) {
            ops.push(..._doubleLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], o));
        }
        if (close) {
            ops.push(..._doubleLine(points[len - 1][0], points[len - 1][1], points[0][0], points[0][1], o));
        }
        return { type: 'path', ops };
    }
    else if (len === 2) {
        return line(points[0][0], points[0][1], points[1][0], points[1][1], o);
    }
    return { type: 'path', ops: [] };
}
function polygon(points, o) {
    return linearPath(points, true, o);
}
function rectangle(x, y, width, height, o) {
    const points = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
    ];
    return polygon(points, o);
}
function curve(inputPoints, o) {
    if (inputPoints.length) {
        const p1 = inputPoints[0];
        const pointsList = (typeof p1[0] === 'number') ? [inputPoints] : inputPoints;
        const o1 = _curveWithOffset(pointsList[0], 1 * (1 + o.roughness * 0.2), o);
        const o2 = o.disableMultiStroke ? [] : _curveWithOffset(pointsList[0], 1.5 * (1 + o.roughness * 0.22), cloneOptionsAlterSeed(o));
        for (let i = 1; i < pointsList.length; i++) {
            const points = pointsList[i];
            if (points.length) {
                const underlay = _curveWithOffset(points, 1 * (1 + o.roughness * 0.2), o);
                const overlay = o.disableMultiStroke ? [] : _curveWithOffset(points, 1.5 * (1 + o.roughness * 0.22), cloneOptionsAlterSeed(o));
                for (const item of underlay) {
                    if (item.op !== 'move') {
                        o1.push(item);
                    }
                }
                for (const item of overlay) {
                    if (item.op !== 'move') {
                        o2.push(item);
                    }
                }
            }
        }
        return { type: 'path', ops: o1.concat(o2) };
    }
    return { type: 'path', ops: [] };
}
function ellipse(x, y, width, height, o) {
    const params = generateEllipseParams(width, height, o);
    return ellipseWithParams(x, y, o, params).opset;
}
function generateEllipseParams(width, height, o) {
    const psq = Math.sqrt(Math.PI * 2 * Math.sqrt((Math.pow(width / 2, 2) + Math.pow(height / 2, 2)) / 2));
    const stepCount = Math.ceil(Math.max(o.curveStepCount, (o.curveStepCount / Math.sqrt(200)) * psq));
    const increment = (Math.PI * 2) / stepCount;
    let rx = Math.abs(width / 2);
    let ry = Math.abs(height / 2);
    const curveFitRandomness = 1 - o.curveFitting;
    rx += _offsetOpt(rx * curveFitRandomness, o);
    ry += _offsetOpt(ry * curveFitRandomness, o);
    return { increment, rx, ry };
}
function ellipseWithParams(x, y, o, ellipseParams) {
    const [ap1, cp1] = _computeEllipsePoints(ellipseParams.increment, x, y, ellipseParams.rx, ellipseParams.ry, 1, ellipseParams.increment * _offset(0.1, _offset(0.4, 1, o), o), o);
    let o1 = _curve(ap1, null, o);
    if ((!o.disableMultiStroke) && (o.roughness !== 0)) {
        const [ap2] = _computeEllipsePoints(ellipseParams.increment, x, y, ellipseParams.rx, ellipseParams.ry, 1.5, 0, o);
        const o2 = _curve(ap2, null, o);
        o1 = o1.concat(o2);
    }
    return {
        estimatedPoints: cp1,
        opset: { type: 'path', ops: o1 },
    };
}
function arc(x, y, width, height, start, stop, closed, roughClosure, o) {
    const cx = x;
    const cy = y;
    let rx = Math.abs(width / 2);
    let ry = Math.abs(height / 2);
    rx += _offsetOpt(rx * 0.01, o);
    ry += _offsetOpt(ry * 0.01, o);
    let strt = start;
    let stp = stop;
    while (strt < 0) {
        strt += Math.PI * 2;
        stp += Math.PI * 2;
    }
    if ((stp - strt) > (Math.PI * 2)) {
        strt = 0;
        stp = Math.PI * 2;
    }
    const ellipseInc = (Math.PI * 2) / o.curveStepCount;
    const arcInc = Math.min(ellipseInc / 2, (stp - strt) / 2);
    const ops = _arc(arcInc, cx, cy, rx, ry, strt, stp, 1, o);
    if (!o.disableMultiStroke) {
        const o2 = _arc(arcInc, cx, cy, rx, ry, strt, stp, 1.5, o);
        ops.push(...o2);
    }
    if (closed) {
        if (roughClosure) {
            ops.push(..._doubleLine(cx, cy, cx + rx * Math.cos(strt), cy + ry * Math.sin(strt), o), ..._doubleLine(cx, cy, cx + rx * Math.cos(stp), cy + ry * Math.sin(stp), o));
        }
        else {
            ops.push({ op: 'lineTo', data: [cx, cy] }, { op: 'lineTo', data: [cx + rx * Math.cos(strt), cy + ry * Math.sin(strt)] });
        }
    }
    return { type: 'path', ops };
}
function svgPath(path, o) {
    const segments = normalize(absolutize(parsePath(path)));
    const ops = [];
    let first = [0, 0];
    let current = [0, 0];
    for (const { key, data } of segments) {
        switch (key) {
            case 'M': {
                current = [data[0], data[1]];
                first = [data[0], data[1]];
                break;
            }
            case 'L':
                ops.push(..._doubleLine(current[0], current[1], data[0], data[1], o));
                current = [data[0], data[1]];
                break;
            case 'C': {
                const [x1, y1, x2, y2, x, y] = data;
                ops.push(..._bezierTo(x1, y1, x2, y2, x, y, current, o));
                current = [x, y];
                break;
            }
            case 'Z':
                ops.push(..._doubleLine(current[0], current[1], first[0], first[1], o));
                current = [first[0], first[1]];
                break;
        }
    }
    return { type: 'path', ops };
}
// Fills
function solidFillPolygon(polygonList, o) {
    const ops = [];
    for (const points of polygonList) {
        if (points.length) {
            const offset = o.maxRandomnessOffset || 0;
            const len = points.length;
            if (len > 2) {
                ops.push({ op: 'move', data: [points[0][0] + _offsetOpt(offset, o), points[0][1] + _offsetOpt(offset, o)] });
                for (let i = 1; i < len; i++) {
                    ops.push({ op: 'lineTo', data: [points[i][0] + _offsetOpt(offset, o), points[i][1] + _offsetOpt(offset, o)] });
                }
            }
        }
    }
    return { type: 'fillPath', ops };
}
function patternFillPolygons(polygonList, o) {
    return getFiller(o, helper).fillPolygons(polygonList, o);
}
function patternFillArc(x, y, width, height, start, stop, o) {
    const cx = x;
    const cy = y;
    let rx = Math.abs(width / 2);
    let ry = Math.abs(height / 2);
    rx += _offsetOpt(rx * 0.01, o);
    ry += _offsetOpt(ry * 0.01, o);
    let strt = start;
    let stp = stop;
    while (strt < 0) {
        strt += Math.PI * 2;
        stp += Math.PI * 2;
    }
    if ((stp - strt) > (Math.PI * 2)) {
        strt = 0;
        stp = Math.PI * 2;
    }
    const increment = (stp - strt) / o.curveStepCount;
    const points = [];
    for (let angle = strt; angle <= stp; angle = angle + increment) {
        points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
    }
    points.push([cx + rx * Math.cos(stp), cy + ry * Math.sin(stp)]);
    points.push([cx, cy]);
    return patternFillPolygons([points], o);
}
function randOffset(x, o) {
    return _offsetOpt(x, o);
}
function randOffsetWithRange(min, max, o) {
    return _offset(min, max, o);
}
function doubleLineFillOps(x1, y1, x2, y2, o) {
    return _doubleLine(x1, y1, x2, y2, o, true);
}
// Private helpers
function cloneOptionsAlterSeed(ops) {
    const result = Object.assign({}, ops);
    result.randomizer = undefined;
    if (ops.seed) {
        result.seed = ops.seed + 1;
    }
    return result;
}
function random(ops) {
    if (!ops.randomizer) {
        ops.randomizer = new Random(ops.seed || 0);
    }
    return ops.randomizer.next();
}
function _offset(min, max, ops, roughnessGain = 1) {
    return ops.roughness * roughnessGain * ((random(ops) * (max - min)) + min);
}
function _offsetOpt(x, ops, roughnessGain = 1) {
    return _offset(-x, x, ops, roughnessGain);
}
function _doubleLine(x1, y1, x2, y2, o, filling = false) {
    const singleStroke = filling ? o.disableMultiStrokeFill : o.disableMultiStroke;
    const o1 = _line(x1, y1, x2, y2, o, true, false);
    if (singleStroke) {
        return o1;
    }
    const o2 = _line(x1, y1, x2, y2, o, true, true);
    return o1.concat(o2);
}
function _line(x1, y1, x2, y2, o, move, overlay) {
    const lengthSq = Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2);
    const length = Math.sqrt(lengthSq);
    let roughnessGain = 1;
    if (length < 200) {
        roughnessGain = 1;
    }
    else if (length > 500) {
        roughnessGain = 0.4;
    }
    else {
        roughnessGain = (-16668e-7) * length + 1.233334;
    }
    let offset = o.maxRandomnessOffset || 0;
    if ((offset * offset * 100) > lengthSq) {
        offset = length / 10;
    }
    const halfOffset = offset / 2;
    const divergePoint = 0.2 + random(o) * 0.2;
    let midDispX = o.bowing * o.maxRandomnessOffset * (y2 - y1) / 200;
    let midDispY = o.bowing * o.maxRandomnessOffset * (x1 - x2) / 200;
    midDispX = _offsetOpt(midDispX, o, roughnessGain);
    midDispY = _offsetOpt(midDispY, o, roughnessGain);
    const ops = [];
    const randomHalf = () => _offsetOpt(halfOffset, o, roughnessGain);
    const randomFull = () => _offsetOpt(offset, o, roughnessGain);
    const preserveVertices = o.preserveVertices;
    {
        if (overlay) {
            ops.push({
                op: 'move', data: [
                    x1 + (preserveVertices ? 0 : randomHalf()),
                    y1 + (preserveVertices ? 0 : randomHalf()),
                ],
            });
        }
        else {
            ops.push({
                op: 'move', data: [
                    x1 + (preserveVertices ? 0 : _offsetOpt(offset, o, roughnessGain)),
                    y1 + (preserveVertices ? 0 : _offsetOpt(offset, o, roughnessGain)),
                ],
            });
        }
    }
    if (overlay) {
        ops.push({
            op: 'bcurveTo',
            data: [
                midDispX + x1 + (x2 - x1) * divergePoint + randomHalf(),
                midDispY + y1 + (y2 - y1) * divergePoint + randomHalf(),
                midDispX + x1 + 2 * (x2 - x1) * divergePoint + randomHalf(),
                midDispY + y1 + 2 * (y2 - y1) * divergePoint + randomHalf(),
                x2 + (preserveVertices ? 0 : randomHalf()),
                y2 + (preserveVertices ? 0 : randomHalf()),
            ],
        });
    }
    else {
        ops.push({
            op: 'bcurveTo',
            data: [
                midDispX + x1 + (x2 - x1) * divergePoint + randomFull(),
                midDispY + y1 + (y2 - y1) * divergePoint + randomFull(),
                midDispX + x1 + 2 * (x2 - x1) * divergePoint + randomFull(),
                midDispY + y1 + 2 * (y2 - y1) * divergePoint + randomFull(),
                x2 + (preserveVertices ? 0 : randomFull()),
                y2 + (preserveVertices ? 0 : randomFull()),
            ],
        });
    }
    return ops;
}
function _curveWithOffset(points, offset, o) {
    if (!points.length) {
        return [];
    }
    const ps = [];
    ps.push([
        points[0][0] + _offsetOpt(offset, o),
        points[0][1] + _offsetOpt(offset, o),
    ]);
    ps.push([
        points[0][0] + _offsetOpt(offset, o),
        points[0][1] + _offsetOpt(offset, o),
    ]);
    for (let i = 1; i < points.length; i++) {
        ps.push([
            points[i][0] + _offsetOpt(offset, o),
            points[i][1] + _offsetOpt(offset, o),
        ]);
        if (i === (points.length - 1)) {
            ps.push([
                points[i][0] + _offsetOpt(offset, o),
                points[i][1] + _offsetOpt(offset, o),
            ]);
        }
    }
    return _curve(ps, null, o);
}
function _curve(points, closePoint, o) {
    const len = points.length;
    const ops = [];
    if (len > 3) {
        const b = [];
        const s = 1 - o.curveTightness;
        ops.push({ op: 'move', data: [points[1][0], points[1][1]] });
        for (let i = 1; (i + 2) < len; i++) {
            const cachedVertArray = points[i];
            b[0] = [cachedVertArray[0], cachedVertArray[1]];
            b[1] = [cachedVertArray[0] + (s * points[i + 1][0] - s * points[i - 1][0]) / 6, cachedVertArray[1] + (s * points[i + 1][1] - s * points[i - 1][1]) / 6];
            b[2] = [points[i + 1][0] + (s * points[i][0] - s * points[i + 2][0]) / 6, points[i + 1][1] + (s * points[i][1] - s * points[i + 2][1]) / 6];
            b[3] = [points[i + 1][0], points[i + 1][1]];
            ops.push({ op: 'bcurveTo', data: [b[1][0], b[1][1], b[2][0], b[2][1], b[3][0], b[3][1]] });
        }
    }
    else if (len === 3) {
        ops.push({ op: 'move', data: [points[1][0], points[1][1]] });
        ops.push({
            op: 'bcurveTo',
            data: [
                points[1][0], points[1][1],
                points[2][0], points[2][1],
                points[2][0], points[2][1],
            ],
        });
    }
    else if (len === 2) {
        ops.push(..._line(points[0][0], points[0][1], points[1][0], points[1][1], o, true, true));
    }
    return ops;
}
function _computeEllipsePoints(increment, cx, cy, rx, ry, offset, overlap, o) {
    const coreOnly = o.roughness === 0;
    const corePoints = [];
    const allPoints = [];
    if (coreOnly) {
        increment = increment / 4;
        allPoints.push([
            cx + rx * Math.cos(-increment),
            cy + ry * Math.sin(-increment),
        ]);
        for (let angle = 0; angle <= Math.PI * 2; angle = angle + increment) {
            const p = [
                cx + rx * Math.cos(angle),
                cy + ry * Math.sin(angle),
            ];
            corePoints.push(p);
            allPoints.push(p);
        }
        allPoints.push([
            cx + rx * Math.cos(0),
            cy + ry * Math.sin(0),
        ]);
        allPoints.push([
            cx + rx * Math.cos(increment),
            cy + ry * Math.sin(increment),
        ]);
    }
    else {
        const radOffset = _offsetOpt(0.5, o) - (Math.PI / 2);
        allPoints.push([
            _offsetOpt(offset, o) + cx + 0.9 * rx * Math.cos(radOffset - increment),
            _offsetOpt(offset, o) + cy + 0.9 * ry * Math.sin(radOffset - increment),
        ]);
        const endAngle = Math.PI * 2 + radOffset - 0.01;
        for (let angle = radOffset; angle < endAngle; angle = angle + increment) {
            const p = [
                _offsetOpt(offset, o) + cx + rx * Math.cos(angle),
                _offsetOpt(offset, o) + cy + ry * Math.sin(angle),
            ];
            corePoints.push(p);
            allPoints.push(p);
        }
        allPoints.push([
            _offsetOpt(offset, o) + cx + rx * Math.cos(radOffset + Math.PI * 2 + overlap * 0.5),
            _offsetOpt(offset, o) + cy + ry * Math.sin(radOffset + Math.PI * 2 + overlap * 0.5),
        ]);
        allPoints.push([
            _offsetOpt(offset, o) + cx + 0.98 * rx * Math.cos(radOffset + overlap),
            _offsetOpt(offset, o) + cy + 0.98 * ry * Math.sin(radOffset + overlap),
        ]);
        allPoints.push([
            _offsetOpt(offset, o) + cx + 0.9 * rx * Math.cos(radOffset + overlap * 0.5),
            _offsetOpt(offset, o) + cy + 0.9 * ry * Math.sin(radOffset + overlap * 0.5),
        ]);
    }
    return [allPoints, corePoints];
}
function _arc(increment, cx, cy, rx, ry, strt, stp, offset, o) {
    const radOffset = strt + _offsetOpt(0.1, o);
    const points = [];
    points.push([
        _offsetOpt(offset, o) + cx + 0.9 * rx * Math.cos(radOffset - increment),
        _offsetOpt(offset, o) + cy + 0.9 * ry * Math.sin(radOffset - increment),
    ]);
    for (let angle = radOffset; angle <= stp; angle = angle + increment) {
        points.push([
            _offsetOpt(offset, o) + cx + rx * Math.cos(angle),
            _offsetOpt(offset, o) + cy + ry * Math.sin(angle),
        ]);
    }
    points.push([
        cx + rx * Math.cos(stp),
        cy + ry * Math.sin(stp),
    ]);
    points.push([
        cx + rx * Math.cos(stp),
        cy + ry * Math.sin(stp),
    ]);
    return _curve(points, null, o);
}
function _bezierTo(x1, y1, x2, y2, x, y, current, o) {
    const ops = [];
    const ros = [o.maxRandomnessOffset || 1, (o.maxRandomnessOffset || 1) + 0.3];
    let f = [0, 0];
    const iterations = o.disableMultiStroke ? 1 : 2;
    const preserveVertices = o.preserveVertices;
    for (let i = 0; i < iterations; i++) {
        if (i === 0) {
            ops.push({ op: 'move', data: [current[0], current[1]] });
        }
        else {
            ops.push({ op: 'move', data: [current[0] + (preserveVertices ? 0 : _offsetOpt(ros[0], o)), current[1] + (preserveVertices ? 0 : _offsetOpt(ros[0], o))] });
        }
        f = preserveVertices ? [x, y] : [x + _offsetOpt(ros[i], o), y + _offsetOpt(ros[i], o)];
        ops.push({
            op: 'bcurveTo',
            data: [
                x1 + _offsetOpt(ros[i], o), y1 + _offsetOpt(ros[i], o),
                x2 + _offsetOpt(ros[i], o), y2 + _offsetOpt(ros[i], o),
                f[0], f[1],
            ],
        });
    }
    return ops;
}

function clone(p) {
    return [...p];
}
function curveToBezier(pointsIn, curveTightness = 0) {
    const len = pointsIn.length;
    if (len < 3) {
        throw new Error('A curve must have at least three points.');
    }
    const out = [];
    if (len === 3) {
        out.push(clone(pointsIn[0]), clone(pointsIn[1]), clone(pointsIn[2]), clone(pointsIn[2]));
    }
    else {
        const points = [];
        points.push(pointsIn[0], pointsIn[0]);
        for (let i = 1; i < pointsIn.length; i++) {
            points.push(pointsIn[i]);
            if (i === (pointsIn.length - 1)) {
                points.push(pointsIn[i]);
            }
        }
        const b = [];
        const s = 1 - curveTightness;
        out.push(clone(points[0]));
        for (let i = 1; (i + 2) < points.length; i++) {
            const cachedVertArray = points[i];
            b[0] = [cachedVertArray[0], cachedVertArray[1]];
            b[1] = [cachedVertArray[0] + (s * points[i + 1][0] - s * points[i - 1][0]) / 6, cachedVertArray[1] + (s * points[i + 1][1] - s * points[i - 1][1]) / 6];
            b[2] = [points[i + 1][0] + (s * points[i][0] - s * points[i + 2][0]) / 6, points[i + 1][1] + (s * points[i][1] - s * points[i + 2][1]) / 6];
            b[3] = [points[i + 1][0], points[i + 1][1]];
            out.push(b[1], b[2], b[3]);
        }
    }
    return out;
}

// distance between 2 points
function distance(p1, p2) {
    return Math.sqrt(distanceSq(p1, p2));
}
// distance between 2 points squared
function distanceSq(p1, p2) {
    return Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2);
}
// Sistance squared from a point p to the line segment vw
function distanceToSegmentSq(p, v, w) {
    const l2 = distanceSq(v, w);
    if (l2 === 0) {
        return distanceSq(p, v);
    }
    let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
    t = Math.max(0, Math.min(1, t));
    return distanceSq(p, lerp$1(v, w, t));
}
function lerp$1(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
    ];
}
// Adapted from https://seant23.wordpress.com/2010/11/12/offset-bezier-curves/
function flatness(points, offset) {
    const p1 = points[offset + 0];
    const p2 = points[offset + 1];
    const p3 = points[offset + 2];
    const p4 = points[offset + 3];
    let ux = 3 * p2[0] - 2 * p1[0] - p4[0];
    ux *= ux;
    let uy = 3 * p2[1] - 2 * p1[1] - p4[1];
    uy *= uy;
    let vx = 3 * p3[0] - 2 * p4[0] - p1[0];
    vx *= vx;
    let vy = 3 * p3[1] - 2 * p4[1] - p1[1];
    vy *= vy;
    if (ux < vx) {
        ux = vx;
    }
    if (uy < vy) {
        uy = vy;
    }
    return ux + uy;
}
function getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints) {
    const outPoints = newPoints || [];
    if (flatness(points, offset) < tolerance) {
        const p0 = points[offset + 0];
        if (outPoints.length) {
            const d = distance(outPoints[outPoints.length - 1], p0);
            if (d > 1) {
                outPoints.push(p0);
            }
        }
        else {
            outPoints.push(p0);
        }
        outPoints.push(points[offset + 3]);
    }
    else {
        // subdivide
        const t = .5;
        const p1 = points[offset + 0];
        const p2 = points[offset + 1];
        const p3 = points[offset + 2];
        const p4 = points[offset + 3];
        const q1 = lerp$1(p1, p2, t);
        const q2 = lerp$1(p2, p3, t);
        const q3 = lerp$1(p3, p4, t);
        const r1 = lerp$1(q1, q2, t);
        const r2 = lerp$1(q2, q3, t);
        const red = lerp$1(r1, r2, t);
        getPointsOnBezierCurveWithSplitting([p1, q1, r1, red], 0, tolerance, outPoints);
        getPointsOnBezierCurveWithSplitting([red, r2, q3, p4], 0, tolerance, outPoints);
    }
    return outPoints;
}
function simplify(points, distance) {
    return simplifyPoints(points, 0, points.length, distance);
}
// Ramer–Douglas–Peucker algorithm
// https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
function simplifyPoints(points, start, end, epsilon, newPoints) {
    const outPoints = newPoints || [];
    // find the most distance point from the endpoints
    const s = points[start];
    const e = points[end - 1];
    let maxDistSq = 0;
    let maxNdx = 1;
    for (let i = start + 1; i < end - 1; ++i) {
        const distSq = distanceToSegmentSq(points[i], s, e);
        if (distSq > maxDistSq) {
            maxDistSq = distSq;
            maxNdx = i;
        }
    }
    // if that point is too far, split
    if (Math.sqrt(maxDistSq) > epsilon) {
        simplifyPoints(points, start, maxNdx + 1, epsilon, outPoints);
        simplifyPoints(points, maxNdx, end, epsilon, outPoints);
    }
    else {
        if (!outPoints.length) {
            outPoints.push(s);
        }
        outPoints.push(e);
    }
    return outPoints;
}
function pointsOnBezierCurves(points, tolerance = 0.15, distance) {
    const newPoints = [];
    const numSegments = (points.length - 1) / 3;
    for (let i = 0; i < numSegments; i++) {
        const offset = i * 3;
        getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints);
    }
    if (distance && distance > 0) {
        return simplifyPoints(newPoints, 0, newPoints.length, distance);
    }
    return newPoints;
}

function pointsOnPath(path, tolerance, distance) {
    const segments = parsePath(path);
    const normalized = normalize(absolutize(segments));
    const sets = [];
    let currentPoints = [];
    let start = [0, 0];
    let pendingCurve = [];
    const appendPendingCurve = () => {
        if (pendingCurve.length >= 4) {
            currentPoints.push(...pointsOnBezierCurves(pendingCurve, tolerance));
        }
        pendingCurve = [];
    };
    const appendPendingPoints = () => {
        appendPendingCurve();
        if (currentPoints.length) {
            sets.push(currentPoints);
            currentPoints = [];
        }
    };
    for (const { key, data } of normalized) {
        switch (key) {
            case 'M':
                appendPendingPoints();
                start = [data[0], data[1]];
                currentPoints.push(start);
                break;
            case 'L':
                appendPendingCurve();
                currentPoints.push([data[0], data[1]]);
                break;
            case 'C':
                if (!pendingCurve.length) {
                    const lastPoint = currentPoints.length ? currentPoints[currentPoints.length - 1] : start;
                    pendingCurve.push([lastPoint[0], lastPoint[1]]);
                }
                pendingCurve.push([data[0], data[1]]);
                pendingCurve.push([data[2], data[3]]);
                pendingCurve.push([data[4], data[5]]);
                break;
            case 'Z':
                appendPendingCurve();
                currentPoints.push([start[0], start[1]]);
                break;
        }
    }
    appendPendingPoints();
    if (!distance) {
        return sets;
    }
    const out = [];
    for (const set of sets) {
        const simplifiedSet = simplify(set, distance);
        if (simplifiedSet.length) {
            out.push(simplifiedSet);
        }
    }
    return out;
}

const NOS = 'none';
class RoughGenerator {
    constructor(config) {
        this.defaultOptions = {
            maxRandomnessOffset: 2,
            roughness: 1,
            bowing: 1,
            stroke: '#000',
            strokeWidth: 1,
            curveTightness: 0,
            curveFitting: 0.95,
            curveStepCount: 9,
            fillStyle: 'hachure',
            fillWeight: -1,
            hachureAngle: -41,
            hachureGap: -1,
            dashOffset: -1,
            dashGap: -1,
            zigzagOffset: -1,
            seed: 0,
            disableMultiStroke: false,
            disableMultiStrokeFill: false,
            preserveVertices: false,
            fillShapeRoughnessGain: 0.8,
        };
        this.config = config || {};
        if (this.config.options) {
            this.defaultOptions = this._o(this.config.options);
        }
    }
    static newSeed() {
        return randomSeed();
    }
    _o(options) {
        return options ? Object.assign({}, this.defaultOptions, options) : this.defaultOptions;
    }
    _d(shape, sets, options) {
        return { shape, sets: sets || [], options: options || this.defaultOptions };
    }
    line(x1, y1, x2, y2, options) {
        const o = this._o(options);
        return this._d('line', [line(x1, y1, x2, y2, o)], o);
    }
    rectangle(x, y, width, height, options) {
        const o = this._o(options);
        const paths = [];
        const outline = rectangle(x, y, width, height, o);
        if (o.fill) {
            const points = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
            if (o.fillStyle === 'solid') {
                paths.push(solidFillPolygon([points], o));
            }
            else {
                paths.push(patternFillPolygons([points], o));
            }
        }
        if (o.stroke !== NOS) {
            paths.push(outline);
        }
        return this._d('rectangle', paths, o);
    }
    ellipse(x, y, width, height, options) {
        const o = this._o(options);
        const paths = [];
        const ellipseParams = generateEllipseParams(width, height, o);
        const ellipseResponse = ellipseWithParams(x, y, o, ellipseParams);
        if (o.fill) {
            if (o.fillStyle === 'solid') {
                const shape = ellipseWithParams(x, y, o, ellipseParams).opset;
                shape.type = 'fillPath';
                paths.push(shape);
            }
            else {
                paths.push(patternFillPolygons([ellipseResponse.estimatedPoints], o));
            }
        }
        if (o.stroke !== NOS) {
            paths.push(ellipseResponse.opset);
        }
        return this._d('ellipse', paths, o);
    }
    circle(x, y, diameter, options) {
        const ret = this.ellipse(x, y, diameter, diameter, options);
        ret.shape = 'circle';
        return ret;
    }
    linearPath(points, options) {
        const o = this._o(options);
        return this._d('linearPath', [linearPath(points, false, o)], o);
    }
    arc(x, y, width, height, start, stop, closed = false, options) {
        const o = this._o(options);
        const paths = [];
        const outline = arc(x, y, width, height, start, stop, closed, true, o);
        if (closed && o.fill) {
            if (o.fillStyle === 'solid') {
                const fillOptions = Object.assign({}, o);
                fillOptions.disableMultiStroke = true;
                const shape = arc(x, y, width, height, start, stop, true, false, fillOptions);
                shape.type = 'fillPath';
                paths.push(shape);
            }
            else {
                paths.push(patternFillArc(x, y, width, height, start, stop, o));
            }
        }
        if (o.stroke !== NOS) {
            paths.push(outline);
        }
        return this._d('arc', paths, o);
    }
    curve(points, options) {
        const o = this._o(options);
        const paths = [];
        const outline = curve(points, o);
        if (o.fill && o.fill !== NOS) {
            if (o.fillStyle === 'solid') {
                const fillShape = curve(points, Object.assign(Object.assign({}, o), { disableMultiStroke: true, roughness: o.roughness ? (o.roughness + o.fillShapeRoughnessGain) : 0 }));
                paths.push({
                    type: 'fillPath',
                    ops: this._mergedShape(fillShape.ops),
                });
            }
            else {
                const polyPoints = [];
                const inputPoints = points;
                if (inputPoints.length) {
                    const p1 = inputPoints[0];
                    const pointsList = (typeof p1[0] === 'number') ? [inputPoints] : inputPoints;
                    for (const points of pointsList) {
                        if (points.length < 3) {
                            polyPoints.push(...points);
                        }
                        else if (points.length === 3) {
                            polyPoints.push(...pointsOnBezierCurves(curveToBezier([
                                points[0],
                                points[0],
                                points[1],
                                points[2],
                            ]), 10, (1 + o.roughness) / 2));
                        }
                        else {
                            polyPoints.push(...pointsOnBezierCurves(curveToBezier(points), 10, (1 + o.roughness) / 2));
                        }
                    }
                }
                if (polyPoints.length) {
                    paths.push(patternFillPolygons([polyPoints], o));
                }
            }
        }
        if (o.stroke !== NOS) {
            paths.push(outline);
        }
        return this._d('curve', paths, o);
    }
    polygon(points, options) {
        const o = this._o(options);
        const paths = [];
        const outline = linearPath(points, true, o);
        if (o.fill) {
            if (o.fillStyle === 'solid') {
                paths.push(solidFillPolygon([points], o));
            }
            else {
                paths.push(patternFillPolygons([points], o));
            }
        }
        if (o.stroke !== NOS) {
            paths.push(outline);
        }
        return this._d('polygon', paths, o);
    }
    path(d, options) {
        const o = this._o(options);
        const paths = [];
        if (!d) {
            return this._d('path', paths, o);
        }
        d = (d || '').replace(/\n/g, ' ').replace(/(-\s)/g, '-').replace('/(\s\s)/g', ' ');
        const hasFill = o.fill && o.fill !== 'transparent' && o.fill !== NOS;
        const hasStroke = o.stroke !== NOS;
        const simplified = !!(o.simplification && (o.simplification < 1));
        const distance = simplified ? (4 - 4 * (o.simplification || 1)) : ((1 + o.roughness) / 2);
        const sets = pointsOnPath(d, 1, distance);
        const shape = svgPath(d, o);
        if (hasFill) {
            if (o.fillStyle === 'solid') {
                if (sets.length === 1) {
                    const fillShape = svgPath(d, Object.assign(Object.assign({}, o), { disableMultiStroke: true, roughness: o.roughness ? (o.roughness + o.fillShapeRoughnessGain) : 0 }));
                    paths.push({
                        type: 'fillPath',
                        ops: this._mergedShape(fillShape.ops),
                    });
                }
                else {
                    paths.push(solidFillPolygon(sets, o));
                }
            }
            else {
                paths.push(patternFillPolygons(sets, o));
            }
        }
        if (hasStroke) {
            if (simplified) {
                sets.forEach((set) => {
                    paths.push(linearPath(set, false, o));
                });
            }
            else {
                paths.push(shape);
            }
        }
        return this._d('path', paths, o);
    }
    opsToPath(drawing, fixedDecimals) {
        let path = '';
        for (const item of drawing.ops) {
            const data = ((typeof fixedDecimals === 'number') && fixedDecimals >= 0) ? (item.data.map((d) => +d.toFixed(fixedDecimals))) : item.data;
            switch (item.op) {
                case 'move':
                    path += `M${data[0]} ${data[1]} `;
                    break;
                case 'bcurveTo':
                    path += `C${data[0]} ${data[1]}, ${data[2]} ${data[3]}, ${data[4]} ${data[5]} `;
                    break;
                case 'lineTo':
                    path += `L${data[0]} ${data[1]} `;
                    break;
            }
        }
        return path.trim();
    }
    toPaths(drawable) {
        const sets = drawable.sets || [];
        const o = drawable.options || this.defaultOptions;
        const paths = [];
        for (const drawing of sets) {
            let path = null;
            switch (drawing.type) {
                case 'path':
                    path = {
                        d: this.opsToPath(drawing),
                        stroke: o.stroke,
                        strokeWidth: o.strokeWidth,
                        fill: NOS,
                    };
                    break;
                case 'fillPath':
                    path = {
                        d: this.opsToPath(drawing),
                        stroke: NOS,
                        strokeWidth: 0,
                        fill: o.fill || NOS,
                    };
                    break;
                case 'fillSketch':
                    path = this.fillSketch(drawing, o);
                    break;
            }
            if (path) {
                paths.push(path);
            }
        }
        return paths;
    }
    fillSketch(drawing, o) {
        let fweight = o.fillWeight;
        if (fweight < 0) {
            fweight = o.strokeWidth / 2;
        }
        return {
            d: this.opsToPath(drawing),
            stroke: o.fill || NOS,
            strokeWidth: fweight,
            fill: NOS,
        };
    }
    _mergedShape(input) {
        return input.filter((d, i) => {
            if (i === 0) {
                return true;
            }
            if (d.op === 'move') {
                return false;
            }
            return true;
        });
    }
}

class RoughCanvas {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.gen = new RoughGenerator(config);
    }
    draw(drawable) {
        const sets = drawable.sets || [];
        const o = drawable.options || this.getDefaultOptions();
        const ctx = this.ctx;
        const precision = drawable.options.fixedDecimalPlaceDigits;
        for (const drawing of sets) {
            switch (drawing.type) {
                case 'path':
                    ctx.save();
                    ctx.strokeStyle = o.stroke === 'none' ? 'transparent' : o.stroke;
                    ctx.lineWidth = o.strokeWidth;
                    if (o.strokeLineDash) {
                        ctx.setLineDash(o.strokeLineDash);
                    }
                    if (o.strokeLineDashOffset) {
                        ctx.lineDashOffset = o.strokeLineDashOffset;
                    }
                    this._drawToContext(ctx, drawing, precision);
                    ctx.restore();
                    break;
                case 'fillPath': {
                    ctx.save();
                    ctx.fillStyle = o.fill || '';
                    const fillRule = (drawable.shape === 'curve' || drawable.shape === 'polygon' || drawable.shape === 'path') ? 'evenodd' : 'nonzero';
                    this._drawToContext(ctx, drawing, precision, fillRule);
                    ctx.restore();
                    break;
                }
                case 'fillSketch':
                    this.fillSketch(ctx, drawing, o);
                    break;
            }
        }
    }
    fillSketch(ctx, drawing, o) {
        let fweight = o.fillWeight;
        if (fweight < 0) {
            fweight = o.strokeWidth / 2;
        }
        ctx.save();
        if (o.fillLineDash) {
            ctx.setLineDash(o.fillLineDash);
        }
        if (o.fillLineDashOffset) {
            ctx.lineDashOffset = o.fillLineDashOffset;
        }
        ctx.strokeStyle = o.fill || '';
        ctx.lineWidth = fweight;
        this._drawToContext(ctx, drawing, o.fixedDecimalPlaceDigits);
        ctx.restore();
    }
    _drawToContext(ctx, drawing, fixedDecimals, rule = 'nonzero') {
        ctx.beginPath();
        for (const item of drawing.ops) {
            const data = ((typeof fixedDecimals === 'number') && fixedDecimals >= 0) ? (item.data.map((d) => +d.toFixed(fixedDecimals))) : item.data;
            switch (item.op) {
                case 'move':
                    ctx.moveTo(data[0], data[1]);
                    break;
                case 'bcurveTo':
                    ctx.bezierCurveTo(data[0], data[1], data[2], data[3], data[4], data[5]);
                    break;
                case 'lineTo':
                    ctx.lineTo(data[0], data[1]);
                    break;
            }
        }
        if (drawing.type === 'fillPath') {
            ctx.fill(rule);
        }
        else {
            ctx.stroke();
        }
    }
    get generator() {
        return this.gen;
    }
    getDefaultOptions() {
        return this.gen.defaultOptions;
    }
    line(x1, y1, x2, y2, options) {
        const d = this.gen.line(x1, y1, x2, y2, options);
        this.draw(d);
        return d;
    }
    rectangle(x, y, width, height, options) {
        const d = this.gen.rectangle(x, y, width, height, options);
        this.draw(d);
        return d;
    }
    ellipse(x, y, width, height, options) {
        const d = this.gen.ellipse(x, y, width, height, options);
        this.draw(d);
        return d;
    }
    circle(x, y, diameter, options) {
        const d = this.gen.circle(x, y, diameter, options);
        this.draw(d);
        return d;
    }
    linearPath(points, options) {
        const d = this.gen.linearPath(points, options);
        this.draw(d);
        return d;
    }
    polygon(points, options) {
        const d = this.gen.polygon(points, options);
        this.draw(d);
        return d;
    }
    arc(x, y, width, height, start, stop, closed = false, options) {
        const d = this.gen.arc(x, y, width, height, start, stop, closed, options);
        this.draw(d);
        return d;
    }
    curve(points, options) {
        const d = this.gen.curve(points, options);
        this.draw(d);
        return d;
    }
    path(d, options) {
        const drawing = this.gen.path(d, options);
        this.draw(drawing);
        return drawing;
    }
}

const SVGNS = 'http://www.w3.org/2000/svg';

class RoughSVG {
    constructor(svg, config) {
        this.svg = svg;
        this.gen = new RoughGenerator(config);
    }
    draw(drawable) {
        const sets = drawable.sets || [];
        const o = drawable.options || this.getDefaultOptions();
        const doc = this.svg.ownerDocument || window.document;
        const g = doc.createElementNS(SVGNS, 'g');
        const precision = drawable.options.fixedDecimalPlaceDigits;
        for (const drawing of sets) {
            let path = null;
            switch (drawing.type) {
                case 'path': {
                    path = doc.createElementNS(SVGNS, 'path');
                    path.setAttribute('d', this.opsToPath(drawing, precision));
                    path.setAttribute('stroke', o.stroke);
                    path.setAttribute('stroke-width', o.strokeWidth + '');
                    path.setAttribute('fill', 'none');
                    if (o.strokeLineDash) {
                        path.setAttribute('stroke-dasharray', o.strokeLineDash.join(' ').trim());
                    }
                    if (o.strokeLineDashOffset) {
                        path.setAttribute('stroke-dashoffset', `${o.strokeLineDashOffset}`);
                    }
                    break;
                }
                case 'fillPath': {
                    path = doc.createElementNS(SVGNS, 'path');
                    path.setAttribute('d', this.opsToPath(drawing, precision));
                    path.setAttribute('stroke', 'none');
                    path.setAttribute('stroke-width', '0');
                    path.setAttribute('fill', o.fill || '');
                    if (drawable.shape === 'curve' || drawable.shape === 'polygon') {
                        path.setAttribute('fill-rule', 'evenodd');
                    }
                    break;
                }
                case 'fillSketch': {
                    path = this.fillSketch(doc, drawing, o);
                    break;
                }
            }
            if (path) {
                g.appendChild(path);
            }
        }
        return g;
    }
    fillSketch(doc, drawing, o) {
        let fweight = o.fillWeight;
        if (fweight < 0) {
            fweight = o.strokeWidth / 2;
        }
        const path = doc.createElementNS(SVGNS, 'path');
        path.setAttribute('d', this.opsToPath(drawing, o.fixedDecimalPlaceDigits));
        path.setAttribute('stroke', o.fill || '');
        path.setAttribute('stroke-width', fweight + '');
        path.setAttribute('fill', 'none');
        if (o.fillLineDash) {
            path.setAttribute('stroke-dasharray', o.fillLineDash.join(' ').trim());
        }
        if (o.fillLineDashOffset) {
            path.setAttribute('stroke-dashoffset', `${o.fillLineDashOffset}`);
        }
        return path;
    }
    get generator() {
        return this.gen;
    }
    getDefaultOptions() {
        return this.gen.defaultOptions;
    }
    opsToPath(drawing, fixedDecimalPlaceDigits) {
        return this.gen.opsToPath(drawing, fixedDecimalPlaceDigits);
    }
    line(x1, y1, x2, y2, options) {
        const d = this.gen.line(x1, y1, x2, y2, options);
        return this.draw(d);
    }
    rectangle(x, y, width, height, options) {
        const d = this.gen.rectangle(x, y, width, height, options);
        return this.draw(d);
    }
    ellipse(x, y, width, height, options) {
        const d = this.gen.ellipse(x, y, width, height, options);
        return this.draw(d);
    }
    circle(x, y, diameter, options) {
        const d = this.gen.circle(x, y, diameter, options);
        return this.draw(d);
    }
    linearPath(points, options) {
        const d = this.gen.linearPath(points, options);
        return this.draw(d);
    }
    polygon(points, options) {
        const d = this.gen.polygon(points, options);
        return this.draw(d);
    }
    arc(x, y, width, height, start, stop, closed = false, options) {
        const d = this.gen.arc(x, y, width, height, start, stop, closed, options);
        return this.draw(d);
    }
    curve(points, options) {
        const d = this.gen.curve(points, options);
        return this.draw(d);
    }
    path(d, options) {
        const drawing = this.gen.path(d, options);
        return this.draw(drawing);
    }
}

var rough = {
    canvas(canvas, config) {
        return new RoughCanvas(canvas, config);
    },
    svg(svg, config) {
        return new RoughSVG(svg, config);
    },
    generator(config) {
        return new RoughGenerator(config);
    },
    newSeed() {
        return RoughGenerator.newSeed();
    },
};

// ============================================================
// Shared Typography Resolution
//
// Extracts the repeated pattern of resolving fontSize, fontWeight,
// textColor, font, textAlign, letterSpacing, lineHeight, padding,
// verticalAlign from a style object with entity-specific defaults.
// ============================================================
const ANCHOR_MAP = {
    left: "start",
    center: "middle",
    right: "end",
};
function resolveTypography(style, defaults, diagramFont, fallbackTextColor) {
    const s = (style ?? {});
    const fontSize = Number(s.fontSize ?? defaults.fontSize ?? TYPOGRAPHY.defaultFontSize);
    const fontWeight = (s.fontWeight ?? defaults.fontWeight ?? TYPOGRAPHY.defaultFontWeight);
    const textColor = String(s.color ?? defaults.textColor ?? fallbackTextColor);
    const font = resolveStyleFont(s, diagramFont);
    const textAlign = String(s.textAlign ?? defaults.textAlign ?? TYPOGRAPHY.defaultAlign);
    const textAnchor = ANCHOR_MAP[textAlign] ?? "middle";
    const letterSpacing = s.letterSpacing;
    const lhMult = Number(s.lineHeight ?? defaults.lineHeight ?? TYPOGRAPHY.defaultLineHeight);
    const lineHeight = lhMult * fontSize;
    const verticalAlign = String(s.verticalAlign ?? defaults.verticalAlign ?? TYPOGRAPHY.defaultVAlign);
    const padding = Number(s.padding ?? defaults.padding ?? TYPOGRAPHY.defaultPadding);
    return {
        fontSize, fontWeight, textColor, font,
        textAlign, textAnchor, letterSpacing,
        lineHeight, verticalAlign, padding,
    };
}
/** Compute the x coordinate for text based on alignment within a box. */
function computeTextX(typo, x, w) {
    return typo.textAlign === "left" ? x + typo.padding
        : typo.textAlign === "right" ? x + w - typo.padding
            : x + w / 2;
}
/** Compute the vertical center for a block of text lines within a box. */
function computeTextCY(typo, y, h, lineCount, topOffset) {
    const pad = typo.padding;
    const top = y + (topOffset ?? pad);
    const bottom = y + h - pad;
    const mid = (top + bottom) / 2;
    const blockH = (lineCount - 1) * typo.lineHeight;
    if (typo.verticalAlign === "top")
        return top + blockH / 2;
    if (typo.verticalAlign === "bottom")
        return bottom - blockH / 2;
    return mid;
}

// ============================================================
// sketchmark — SVG Renderer  (rough.js hand-drawn)
// ============================================================
const NS = SVG_NS$1;
const se = (tag) => document.createElementNS(NS, tag);
const BASE_ROUGH = { roughness: ROUGH.roughness, bowing: ROUGH.bowing };
// ── SVG text helpers ──────────────────────────────────────────────────────
/**
 * Single-line SVG text element.
 *
 * | param         | maps to SVG attr         |
 * |---------------|--------------------------|
 * txt             | textContent              |
 * x, y            | x, y                     |
 * sz              | font-size                |
 * wt              | font-weight              |
 * col             | fill                     |
 * anchor          | text-anchor              |
 * font            | font-family              |
 * letterSpacing   | letter-spacing           |
 */
function mkText(txt, x, y, sz = 14, wt = 500, col = "#1a1208", anchor = "middle", font, letterSpacing) {
    const t = se("text");
    t.setAttribute("x", String(x));
    t.setAttribute("y", String(y));
    t.setAttribute("text-anchor", anchor);
    t.setAttribute("dominant-baseline", "middle");
    t.setAttribute("font-family", font ?? "var(--font-sans, system-ui, sans-serif)");
    t.setAttribute("font-size", String(sz));
    t.setAttribute("font-weight", String(wt));
    t.setAttribute("fill", col);
    t.setAttribute("pointer-events", "none");
    t.setAttribute("user-select", "none");
    if (letterSpacing != null)
        t.setAttribute("letter-spacing", String(letterSpacing));
    t.textContent = txt;
    return t;
}
/**
 * Multi-line SVG text element using <tspan> per line.
 *
 * | param         | maps to SVG attr         |
 * |---------------|--------------------------|
 * lines           | one <tspan> each         |
 * x               | tspan x                  |
 * cy              | vertical centre of block |
 * sz              | font-size                |
 * wt              | font-weight              |
 * col             | fill                     |
 * anchor          | text-anchor              |
 * lineH           | dy between tspans (px)   |
 * font            | font-family              |
 * letterSpacing   | letter-spacing           |
 */
function mkMultilineText(lines, x, cy, sz = 14, wt = 500, col = "#1a1208", anchor = "middle", lineH = 18, font, letterSpacing) {
    const t = se("text");
    t.setAttribute("text-anchor", anchor);
    t.setAttribute("font-family", font ?? "var(--font-sans, system-ui, sans-serif)");
    t.setAttribute("font-size", String(sz));
    t.setAttribute("font-weight", String(wt));
    t.setAttribute("fill", col);
    t.setAttribute("pointer-events", "none");
    t.setAttribute("user-select", "none");
    if (letterSpacing != null)
        t.setAttribute("letter-spacing", String(letterSpacing));
    // vertically centre the whole block
    const totalH = (lines.length - 1) * lineH;
    const startY = cy - totalH / 2;
    lines.forEach((line, i) => {
        const ts = se("tspan");
        ts.setAttribute("x", String(x));
        ts.setAttribute("y", String(startY + i * lineH));
        ts.setAttribute("dominant-baseline", "middle");
        ts.textContent = line;
        t.appendChild(ts);
    });
    return t;
}
function mkGroup(id, cls) {
    const g = se("g");
    if (id)
        g.setAttribute("id", id);
    if (cls)
        g.setAttribute("class", cls);
    return g;
}
function buildParentGroupLookup(sg) {
    const parentGroups = new Map();
    for (const g of sg.groups) {
        if (g.parentId)
            parentGroups.set(`group:${g.id}`, g.parentId);
        for (const child of g.children) {
            parentGroups.set(`${child.kind}:${child.id}`, g.id);
        }
    }
    return parentGroups;
}
function setParentGroupData(el, groupId) {
    if (groupId)
        el.dataset.parentGroup = groupId;
}
// ── Node shapes ───────────────────────────────────────────────────────────
function renderShape$1(rc, n, palette) {
    const s = n.style ?? {};
    const fill = String(s.fill ?? palette.nodeFill);
    const stroke = String(s.stroke ?? palette.nodeStroke);
    const opts = {
        ...BASE_ROUGH,
        seed: hashStr$3(n.id),
        fill,
        fillStyle: "solid",
        stroke,
        strokeWidth: Number(s.strokeWidth ?? 1.9),
        ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
    };
    const shape = getShape(n.shape);
    if (shape)
        return shape.renderSVG(rc, n, palette, opts);
    // fallback: box
    return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts)];
}
// ── Arrowhead ─────────────────────────────────────────────────────────────
function arrowHead(rc, x, y, angle, col, seed) {
    const as = EDGE.arrowSize;
    return rc.polygon([
        [x, y],
        [
            x - as * Math.cos(angle - Math.PI / 6.5),
            y - as * Math.sin(angle - Math.PI / 6.5),
        ],
        [
            x - as * Math.cos(angle + Math.PI / 6.5),
            y - as * Math.sin(angle + Math.PI / 6.5),
        ],
    ], {
        roughness: 0.35,
        seed,
        fill: col,
        fillStyle: "solid",
        stroke: col,
        strokeWidth: 0.8,
    });
}
function renderToSVG(sg, container, options = {}) {
    if (typeof rough === "undefined") {
        throw new Error("rough.js is not loaded.");
    }
    const isDark = options.theme === "dark" ||
        (options.theme === "auto" &&
            window.matchMedia?.("(prefers-color-scheme:dark)").matches);
    const themeName = String(sg.config[THEME_CONFIG_KEY] ?? (isDark ? "dark" : "light"));
    const palette = resolvePalette(themeName);
    // ── Diagram-level font ──────────────────────────────────
    const diagramFont = (() => {
        const raw = String(sg.style?.font ?? sg.config["font"] ?? "");
        if (raw) {
            loadFont(raw);
            return resolveFont(raw);
        }
        return DEFAULT_FONT;
    })();
    BASE_ROUGH.roughness = options.roughness ?? 1.3;
    BASE_ROUGH.bowing = options.bowing ?? 0.7;
    let svg;
    if (container instanceof SVGSVGElement) {
        svg = container;
    }
    else {
        svg = se("svg");
        container.appendChild(svg);
    }
    svg.innerHTML = "";
    svg.setAttribute("xmlns", NS);
    svg.setAttribute("width", String(sg.width));
    svg.setAttribute("height", String(sg.height));
    svg.setAttribute("viewBox", `0 0 ${sg.width} ${sg.height}`);
    svg.style.fontFamily = "var(--font-sans, system-ui, sans-serif)";
    // ── Background ─────────────────────────────────────────
    if (!options.transparent) {
        const bgRect = se("rect");
        bgRect.setAttribute("x", "0");
        bgRect.setAttribute("y", "0");
        bgRect.setAttribute("width", String(sg.width));
        bgRect.setAttribute("height", String(sg.height));
        bgRect.setAttribute("fill", String(sg.style?.fill ?? palette.background));
        svg.appendChild(bgRect);
        const rootStroke = sg.style?.stroke;
        const rootStrokeWidth = Number(sg.style?.strokeWidth ?? 0);
        if (rootStroke && rootStroke !== "none" && rootStrokeWidth > 0) {
            const frame = se("rect");
            const inset = rootStrokeWidth / 2;
            frame.setAttribute("x", String(inset));
            frame.setAttribute("y", String(inset));
            frame.setAttribute("width", String(Math.max(0, sg.width - rootStrokeWidth)));
            frame.setAttribute("height", String(Math.max(0, sg.height - rootStrokeWidth)));
            frame.setAttribute("fill", "none");
            frame.setAttribute("stroke", String(rootStroke));
            frame.setAttribute("stroke-width", String(rootStrokeWidth));
            svg.appendChild(frame);
        }
    }
    const rc = rough.svg(svg);
    // ── Title ────────────────────────────────────────────────
    if (options.showTitle && sg.title) {
        const titleColor = String(sg.config["title-color"] ?? palette.titleText);
        const titleSize = Number(sg.config["title-size"] ?? TITLE.fontSize);
        const titleWeight = Number(sg.config["title-weight"] ?? TITLE.fontWeight);
        svg.appendChild(mkText(sg.title, sg.width / 2, TITLE.y, titleSize, titleWeight, titleColor, "middle", diagramFont));
    }
    // ── Groups ───────────────────────────────────────────────
    const gmMap = new Map(sg.groups.map((g) => [g.id, g]));
    const parentGroups = buildParentGroupLookup(sg);
    const sortedGroups = [...sg.groups].sort((a, b) => groupDepth(a, gmMap) - groupDepth(b, gmMap));
    const GL = mkGroup("grp-layer");
    for (const g of sortedGroups) {
        if (!g.w)
            continue;
        const gs = g.style ?? {};
        const gg = mkGroup(`group-${g.id}`, "gg");
        setParentGroupData(gg, g.parentId);
        if (gs.opacity != null)
            gg.setAttribute("opacity", String(gs.opacity));
        gg.appendChild(rc.rectangle(g.x, g.y, g.w, g.h, {
            ...BASE_ROUGH,
            roughness: 1.7,
            bowing: 0.4,
            seed: hashStr$3(g.id),
            fill: String(gs.fill ?? palette.groupFill),
            fillStyle: "solid",
            stroke: String(gs.stroke ?? palette.groupStroke),
            strokeWidth: Number(gs.strokeWidth ?? 1.2),
            strokeLineDash: gs.strokeDash ?? palette.groupDash,
        }));
        // ── Group label typography ──────────────────────────
        const gTypo = resolveTypography(gs, { fontSize: GROUP_LABEL.fontSize, fontWeight: GROUP_LABEL.fontWeight, textAlign: "left", padding: GROUP_LABEL.padding }, diagramFont, palette.groupLabel);
        const gTextX = computeTextX(gTypo, g.x, g.w);
        if (g.label) {
            gg.appendChild(mkText(g.label, gTextX, g.y + gTypo.padding, gTypo.fontSize, gTypo.fontWeight, gTypo.textColor, gTypo.textAnchor, gTypo.font, gTypo.letterSpacing));
        }
        GL.appendChild(gg);
    }
    svg.appendChild(GL);
    // ── Edges ─────────────────────────────────────────────────
    const nm = nodeMap(sg);
    const tm = tableMap(sg);
    const cm = chartMap(sg);
    const EL = mkGroup("edge-layer");
    for (const e of sg.edges) {
        const src = resolveEndpoint(e.from, nm, tm, gmMap, cm);
        const dst = resolveEndpoint(e.to, nm, tm, gmMap, cm);
        if (!src || !dst)
            continue;
        const dstCX = dst.x + dst.w / 2, dstCY = dst.y + dst.h / 2;
        const srcCX = src.x + src.w / 2, srcCY = src.y + src.h / 2;
        const [x1, y1] = getConnPoint(src, dstCX, dstCY, e.fromAnchor);
        const [x2, y2] = getConnPoint(dst, srcCX, srcCY, e.toAnchor);
        const eg = mkGroup(`edge-${e.from}-${e.to}`, "eg");
        if (e.style?.opacity != null)
            eg.setAttribute("opacity", String(e.style.opacity));
        const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1;
        const nx = (x2 - x1) / len, ny = (y2 - y1) / len;
        const ecol = String(e.style?.stroke ?? palette.edgeStroke);
        const { arrowAt, dashed } = connMeta(e.connector);
        const HEAD = EDGE.headInset;
        const sx1 = arrowAt === "start" || arrowAt === "both" ? x1 + nx * HEAD : x1;
        const sy1 = arrowAt === "start" || arrowAt === "both" ? y1 + ny * HEAD : y1;
        const sx2 = arrowAt === "end" || arrowAt === "both" ? x2 - nx * HEAD : x2;
        const sy2 = arrowAt === "end" || arrowAt === "both" ? y2 - ny * HEAD : y2;
        const shaft = rc.line(sx1, sy1, sx2, sy2, {
            ...BASE_ROUGH,
            roughness: 0.9,
            seed: hashStr$3(e.from + e.to),
            stroke: ecol,
            strokeWidth: Number(e.style?.strokeWidth ?? 1.6),
            ...(dashed ? { strokeLineDash: EDGE.dashPattern } : {}),
        });
        shaft.setAttribute("data-edge-role", "shaft");
        eg.appendChild(shaft);
        if (arrowAt === "end" || arrowAt === "both") {
            const endHead = arrowHead(rc, x2, y2, Math.atan2(y2 - y1, x2 - x1), ecol, hashStr$3(e.to));
            endHead.setAttribute("data-edge-role", "head");
            eg.appendChild(endHead);
        }
        if (arrowAt === "start" || arrowAt === "both") {
            const startHead = arrowHead(rc, x1, y1, Math.atan2(y1 - y2, x1 - x2), ecol, hashStr$3(e.from + "back"));
            startHead.setAttribute("data-edge-role", "head");
            eg.appendChild(startHead);
        }
        if (e.label) {
            const mx = (x1 + x2) / 2 - ny * EDGE.labelOffset;
            const my = (y1 + y2) / 2 + nx * EDGE.labelOffset;
            const tw = Math.max(e.label.length * 7 + 12, 36);
            const bg = se("rect");
            bg.setAttribute("x", String(mx - tw / 2));
            bg.setAttribute("y", String(my - 8));
            bg.setAttribute("width", String(tw));
            bg.setAttribute("height", "15");
            bg.setAttribute("fill", palette.edgeLabelBg);
            bg.setAttribute("rx", "3");
            bg.setAttribute("opacity", "0.9");
            bg.setAttribute("data-edge-role", "label-bg");
            eg.appendChild(bg);
            // ── Edge label typography ───────────────────────
            // supports: font, font-size, letter-spacing
            // always center-anchored (single line floating on edge)
            const eFontSize = Number(e.style?.fontSize ?? EDGE.labelFontSize);
            const eFont = resolveStyleFont(e.style ?? {}, diagramFont);
            const eLetterSpacing = e.style?.letterSpacing;
            const eFontWeight = e.style?.fontWeight ?? EDGE.labelFontWeight;
            const eLabelColor = String(e.style?.color ?? palette.edgeLabelText);
            const label = mkText(e.label, mx, my, eFontSize, eFontWeight, eLabelColor, "middle", eFont, eLetterSpacing);
            label.setAttribute("data-edge-role", "label");
            eg.appendChild(label);
        }
        EL.appendChild(eg);
    }
    svg.appendChild(EL);
    // ── Nodes ─────────────────────────────────────────────────
    const NL = mkGroup("node-layer");
    for (const n of sg.nodes) {
        const shapeDef = getShape(n.shape);
        const idPrefix = shapeDef?.idPrefix ?? "node";
        const cssClass = shapeDef?.cssClass ?? "ng";
        const ng = mkGroup(`${idPrefix}-${n.id}`, cssClass);
        setParentGroupData(ng, n.groupId ?? parentGroups.get(`node:${n.id}`));
        ng.dataset.nodeShape = n.shape;
        ng.dataset.x = String(n.x);
        ng.dataset.y = String(n.y);
        ng.dataset.w = String(n.w);
        ng.dataset.h = String(n.h);
        if (n.pathData)
            ng.dataset.pathData = getRenderableNodePathData(n) ?? n.pathData;
        if (n.meta?.animationParent)
            ng.dataset.animationParent = n.meta.animationParent;
        if (n.style?.opacity != null)
            ng.setAttribute("opacity", String(n.style.opacity));
        // ── Static transform (deg, dx, dy, factor) ──────────
        // Uses CSS style.transform so that transform-box:fill-box +
        // transform-origin:center on .ng gives correct center-anchored transforms.
        // The base transform is stored in data-base-transform so the animation
        // controller can restore it after _clearAll() instead of wiping to "".
        const hasTx = n.dx || n.dy || n.deg || (n.factor && n.factor !== 1);
        if (hasTx) {
            const parts = [];
            if (n.dx || n.dy)
                parts.push(`translate(${n.dx ?? 0}px,${n.dy ?? 0}px)`);
            if (n.deg)
                parts.push(`rotate(${n.deg}deg)`);
            if (n.factor && n.factor !== 1)
                parts.push(`scale(${n.factor})`);
            const tx = parts.join(" ");
            ng.style.transform = tx;
            ng.dataset.baseTransform = tx;
        }
        renderShape$1(rc, n, palette).forEach((s) => ng.appendChild(s));
        // ── Node / text typography ─────────────────────────
        const isText = n.shape === "text";
        const isNote = n.shape === "note";
        const isMediaShape = n.shape === "icon" || n.shape === "image" || n.shape === "line";
        const typo = resolveTypography(n.style, {
            fontSize: isText ? 13 : isNote ? 12 : 14,
            fontWeight: isText || isNote ? 400 : 500,
            textColor: isText ? palette.edgeLabelText : isNote ? palette.noteText : palette.nodeText,
            textAlign: isText || isNote ? "left" : undefined,
            lineHeight: isNote ? 1.4 : undefined,
            padding: isText ? 0 : isNote ? 12 : undefined,
            verticalAlign: isNote ? "top" : undefined,
        }, diagramFont, palette.nodeText);
        // Note textX accounts for fold corner
        const FOLD = NOTE.fold;
        const textX = isNote
            ? (typo.textAlign === "right" ? n.x + n.w - FOLD - typo.padding
                : typo.textAlign === "center" ? n.x + (n.w - FOLD) / 2
                    : n.x + typo.padding)
            : computeTextX(typo, n.x, n.w);
        const fontStr = buildFontStr(typo.fontSize, typo.fontWeight, typo.font);
        const shouldWrap = !isMediaShape && !n.label.includes('\n');
        const innerW = shapeInnerTextWidth(n.shape, n.w, typo.padding);
        const lines = shouldWrap
            ? wrapText(n.label, innerW, typo.fontSize, fontStr)
            : n.label.split('\n');
        const textCY = isMediaShape
            ? n.y + n.h - 10
            : isNote
                ? computeTextCY(typo, n.y, n.h, lines.length, FOLD + typo.padding)
                : computeTextCY(typo, n.y, n.h, lines.length);
        if (n.label) {
            ng.appendChild(lines.length > 1
                ? mkMultilineText(lines, textX, textCY, typo.fontSize, typo.fontWeight, typo.textColor, typo.textAnchor, typo.lineHeight, typo.font, typo.letterSpacing)
                : mkText(n.label, textX, textCY, typo.fontSize, typo.fontWeight, typo.textColor, typo.textAnchor, typo.font, typo.letterSpacing));
        }
        if (options.interactive) {
            ng.style.cursor = "pointer";
            ng.addEventListener("click", () => options.onNodeClick?.(n.id));
            ng.addEventListener("mouseenter", () => {
                ng.style.filter = "brightness(0.92)";
            });
            ng.addEventListener("mouseleave", () => {
                ng.style.filter = "";
            });
        }
        NL.appendChild(ng);
    }
    svg.appendChild(NL);
    // ── Tables ────────────────────────────────────────────────
    const TL = mkGroup("table-layer");
    for (const t of sg.tables) {
        const tg = mkGroup(`table-${t.id}`, "tg");
        setParentGroupData(tg, parentGroups.get(`table:${t.id}`));
        const gs = t.style ?? {};
        const fill = String(gs.fill ?? palette.tableFill);
        const strk = String(gs.stroke ?? palette.tableStroke);
        const textCol = String(gs.color ?? palette.tableText);
        const hdrFill = gs.fill ? darkenHex(fill, 0.08) : palette.tableHeaderFill;
        const hdrText = String(gs.color ?? palette.tableHeaderText);
        const divCol = palette.tableDivider;
        const pad = t.labelH;
        const tStrokeWidth = Number(gs.strokeWidth ?? 1.5);
        const tFontWeight = gs.fontWeight ?? 500;
        // ── Table-level font (applies to label + all cells) ─
        // supports: font, font-size, letter-spacing
        const tFontSize = Number(gs.fontSize ?? 12);
        const tFont = resolveStyleFont(gs, diagramFont);
        const tLetterSpacing = gs.letterSpacing;
        if (gs.opacity != null)
            tg.setAttribute("opacity", String(gs.opacity));
        // outer border
        tg.appendChild(rc.rectangle(t.x, t.y, t.w, t.h, {
            ...BASE_ROUGH,
            seed: hashStr$3(t.id),
            fill,
            fillStyle: "solid",
            stroke: strk,
            strokeWidth: tStrokeWidth,
            ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash } : {}),
        }));
        // label strip separator
        tg.appendChild(rc.line(t.x, t.y + pad, t.x + t.w, t.y + pad, {
            roughness: 0.6,
            seed: hashStr$3(t.id + "l"),
            stroke: strk,
            strokeWidth: 1,
        }));
        // ── Table label: font, font-size, font-weight, letter-spacing (always left) ──
        tg.appendChild(mkText(t.label, t.x + 10, t.y + pad / 2, tFontSize, tFontWeight, textCol, "start", tFont, tLetterSpacing));
        // rows
        let rowY = t.y + pad;
        for (const row of t.rows) {
            const rh = row.kind === "header" ? t.headerH : t.rowH;
            if (row.kind === "header") {
                const hdrBg = se("rect");
                hdrBg.setAttribute("x", String(t.x + 1));
                hdrBg.setAttribute("y", String(rowY + 1));
                hdrBg.setAttribute("width", String(t.w - 2));
                hdrBg.setAttribute("height", String(rh - 1));
                hdrBg.setAttribute("fill", hdrFill);
                tg.appendChild(hdrBg);
            }
            tg.appendChild(rc.line(t.x, rowY + rh, t.x + t.w, rowY + rh, {
                roughness: 0.4,
                seed: hashStr$3(t.id + rowY),
                stroke: row.kind === "header" ? strk : divCol,
                strokeWidth: row.kind === "header" ? 1.2 : 0.6,
            }));
            // ── Cell text: font, font-size, letter-spacing, text-align ──
            // text-align applies to data rows; header is always centered
            const cellAlignProp = row.kind === "header" ? "center" : String(gs.textAlign ?? "center");
            const cellAnchorMap = {
                left: "start",
                center: "middle",
                right: "end",
            };
            const cellAnchor = cellAnchorMap[cellAlignProp] ?? "middle";
            const cellFw = row.kind === "header" ? 600 : (gs.fontWeight ?? 400);
            const cellColor = row.kind === "header" ? hdrText : textCol;
            let cx = t.x;
            row.cells.forEach((cell, i) => {
                const cw = t.colWidths[i] ?? 60;
                // x position shifts with alignment
                const cellX = cellAnchor === "start"
                    ? cx + 6
                    : cellAnchor === "end"
                        ? cx + cw - 6
                        : cx + cw / 2;
                // ← was missing tg.appendChild — cells were invisible before
                tg.appendChild(mkText(cell, cellX, rowY + rh / 2, tFontSize, cellFw, cellColor, cellAnchor, tFont, tLetterSpacing));
                if (i < row.cells.length - 1) {
                    tg.appendChild(rc.line(cx + cw, t.y + pad, cx + cw, t.y + t.h, {
                        roughness: 0.3,
                        seed: hashStr$3(t.id + "c" + i),
                        stroke: divCol,
                        strokeWidth: 0.5,
                    }));
                }
                cx += cw;
            });
            rowY += rh;
        }
        if (options.interactive) {
            tg.style.cursor = "pointer";
            tg.addEventListener("click", () => options.onNodeClick?.(t.id));
        }
        TL.appendChild(tg);
    }
    svg.appendChild(TL);
    // ── Notes are now rendered as nodes via the shape registry ──
    const MDL = mkGroup('markdown-layer');
    for (const m of sg.markdowns) {
        const mg = mkGroup(`markdown-${m.id}`, 'mdg');
        setParentGroupData(mg, parentGroups.get(`markdown:${m.id}`));
        const gs = m.style ?? {};
        const mFont = resolveStyleFont(gs, diagramFont);
        const baseColor = String(gs.color ?? palette.nodeText);
        const textAlign = String(gs.textAlign ?? 'left');
        const anchor = textAlign === 'right' ? 'end'
            : textAlign === 'center' ? 'middle'
                : 'start';
        const PAD = Number(gs.padding ?? 0);
        const mLetterSpacing = gs.letterSpacing;
        if (gs.opacity != null)
            mg.setAttribute('opacity', String(gs.opacity));
        // Background + border
        if (gs.fill || gs.stroke) {
            mg.appendChild(rc.rectangle(m.x, m.y, m.w, m.h, {
                ...BASE_ROUGH, seed: hashStr$3(m.id),
                fill: String(gs.fill ?? 'none'), fillStyle: 'solid',
                stroke: String(gs.stroke ?? 'none'),
                strokeWidth: Number(gs.strokeWidth ?? 1.2),
                ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash } : {}),
            }));
        }
        const textX = textAlign === 'right' ? m.x + m.w - PAD
            : textAlign === 'center' ? m.x + m.w / 2
                : m.x + PAD;
        let y = m.y + PAD;
        for (const line of m.lines) {
            if (line.kind === 'blank') {
                y += LINE_SPACING.blank;
                continue;
            }
            const fontSize = LINE_FONT_SIZE[line.kind];
            const fontWeight = LINE_FONT_WEIGHT[line.kind];
            const t = se('text');
            t.setAttribute('x', String(textX));
            t.setAttribute('y', String(y + fontSize / 2));
            t.setAttribute('text-anchor', anchor);
            t.setAttribute('dominant-baseline', 'middle');
            t.setAttribute('font-family', mFont);
            t.setAttribute('font-size', String(fontSize));
            t.setAttribute('font-weight', String(fontWeight));
            t.setAttribute('fill', baseColor);
            t.setAttribute('pointer-events', 'none');
            t.setAttribute('user-select', 'none');
            if (mLetterSpacing != null)
                t.setAttribute('letter-spacing', String(mLetterSpacing));
            for (const run of line.runs) {
                const span = se('tspan');
                span.textContent = run.text;
                if (run.bold)
                    span.setAttribute('font-weight', '700');
                if (run.italic)
                    span.setAttribute('font-style', 'italic');
                t.appendChild(span);
            }
            mg.appendChild(t);
            y += LINE_SPACING[line.kind];
        }
        MDL.appendChild(mg);
    }
    svg.appendChild(MDL);
    // ── Charts ────────────────────────────────────────────────
    const CL = mkGroup("chart-layer");
    for (const c of sg.charts) {
        const cg = renderRoughChartSVG(rc, c, palette, themeName !== "light");
        setParentGroupData(cg, parentGroups.get(`chart:${c.id}`));
        CL.appendChild(cg);
    }
    svg.appendChild(CL);
    return svg;
}
function svgToString(svg) {
    return ('<?xml version="1.0" encoding="utf-8"?>\n' +
        new XMLSerializer().serializeToString(svg));
}

// ============================================================
// sketchmark — Canvas Rough Chart Drawing
// Drop this file as src/renderer/canvas/roughChartCanvas.ts
// and import drawRoughChartCanvas into canvas/index.ts.
//
// CHANGES TO canvas/index.ts:
//   1. Remove the entire `function drawChart(...)` function
//   2. Remove the `declare const Chart: any;` declaration
//   3. Remove the CHART_COLORS array (lives in roughChart.ts now)
//   4. Add import at the top:
//        import { drawRoughChartCanvas } from './roughChartCanvas';
//   5. In the "── Charts ──" section replace:
//        for (const c of sg.charts) drawChart(ctx, c, pal);
//      with:
//        for (const c of sg.charts) drawRoughChartCanvas(rc, ctx, c, pal, R);
// ============================================================
function hashStr$1(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++)
        h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
    return h;
}
function fmtNum(v) {
    if (Math.abs(v) >= 1000)
        return (v / 1000).toFixed(1) + 'k';
    return String(v);
}
// ── Pie arc helpers ────────────────────────────────────────
// Canvas renderer draws pie arcs natively (no SVG path needed).
function drawPieArc(rc, ctx, cx, cy, r, ir, startAngle, endAngle, color, seed) {
    // Build polygon approximation of the arc segment for rough.js
    const STEPS = 32;
    const pts = [];
    if (ir > 0) {
        // Donut: outer arc CCW, inner arc CW
        for (let i = 0; i <= STEPS; i++) {
            const a = startAngle + (endAngle - startAngle) * (i / STEPS);
            pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        for (let i = STEPS; i >= 0; i--) {
            const a = startAngle + (endAngle - startAngle) * (i / STEPS);
            pts.push([cx + ir * Math.cos(a), cy + ir * Math.sin(a)]);
        }
    }
    else {
        // Pie: center + arc points
        pts.push([cx, cy]);
        for (let i = 0; i <= STEPS; i++) {
            const a = startAngle + (endAngle - startAngle) * (i / STEPS);
            pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
    }
    rc.polygon(pts, {
        roughness: 1.0, bowing: 0.5, seed,
        fill: color + 'bb',
        fillStyle: 'solid',
        stroke: color,
        strokeWidth: 1.4,
    });
}
// ── Axes ───────────────────────────────────────────────────
function drawAxes(rc, ctx, c, px, py, pw, ph, allY, labelCol, R, font = 'system-ui, sans-serif') {
    const toY = makeValueToY(allY, py, ph);
    const baseline = toY(0);
    // Y axis
    rc.line(px, py, px, py + ph, { ...R, roughness: 0.4, seed: hashStr$1(c.id + 'ya'), stroke: labelCol, strokeWidth: 1 });
    // X axis (baseline)
    rc.line(px, baseline, px + pw, baseline, { ...R, roughness: 0.4, seed: hashStr$1(c.id + 'xa'), stroke: labelCol, strokeWidth: 1 });
    // Y ticks + labels
    for (const tick of yTicks(allY)) {
        const ty = toY(tick);
        if (ty < py - 2 || ty > py + ph + 2)
            continue;
        rc.line(px - 3, ty, px, ty, { roughness: 0.2, seed: hashStr$1(c.id + 'yt' + tick), stroke: labelCol, strokeWidth: 0.7 });
        ctx.save();
        ctx.font = `400 9px ${font}`;
        ctx.fillStyle = labelCol;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(fmtNum(tick), px - 5, ty);
        ctx.restore();
    }
}
// ── Legend ─────────────────────────────────────────────────
function drawLegend(ctx, labels, colors, x, y, labelCol, font = 'system-ui, sans-serif') {
    ctx.save();
    ctx.font = `400 9px ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    labels.forEach((lbl, i) => {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, y + i * 14, 8, 8);
        ctx.fillStyle = labelCol;
        ctx.fillText(lbl, x + 12, y + i * 14 + 4);
    });
    ctx.restore();
}
// ── Public entry ───────────────────────────────────────────
function drawRoughChartCanvas(rc, ctx, c, pal, R) {
    const s = c.style ?? {};
    // Background
    const bgFill = String(s.fill ?? pal.nodeFill);
    const bgStroke = String(s.stroke ?? (pal.nodeStroke === 'none' ? '#c8b898' : pal.nodeStroke));
    const lc = String(s.color ?? pal.labelText);
    const cFont = String(s.font ? `${s.font}, system-ui, sans-serif` : 'system-ui, sans-serif');
    const cFontSize = Number(s.fontSize ?? 12);
    const cFontWeight = s.fontWeight ?? 600;
    if (s.opacity != null)
        ctx.globalAlpha = Number(s.opacity);
    // Background
    rc.rectangle(c.x, c.y, c.w, c.h, {
        ...R, seed: hashStr$1(c.id),
        fill: bgFill,
        fillStyle: 'solid',
        stroke: bgStroke,
        strokeWidth: Number(s.strokeWidth ?? 1.2),
        ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
    });
    // Title
    if (c.label) {
        ctx.save();
        ctx.font = `${cFontWeight} ${cFontSize}px ${cFont}`;
        ctx.fillStyle = lc;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.label, c.x + c.w / 2, c.y + 14);
        ctx.restore();
    }
    const { px, py, pw, ph, cx, cy } = chartLayout(c);
    // ── Pie / Donut ──────────────────────────────────────────
    if (c.chartType === 'pie' || c.chartType === 'donut') {
        const { segments, total } = parsePie(c.data);
        const r = Math.min(c.w * 0.38, (c.h - (c.label ? 24 : 8)) * 0.44);
        const ir = c.chartType === 'donut' ? r * 0.48 : 0;
        const legendX = c.x + 8;
        const legendY = c.y + (c.label ? 28 : 12);
        let angle = -Math.PI / 2;
        segments.forEach((seg, i) => {
            const sweep = (seg.value / total) * Math.PI * 2;
            drawPieArc(rc, ctx, cx, cy, r, ir, angle, angle + sweep, seg.color, hashStr$1(c.id + seg.label + i));
            angle += sweep;
        });
        drawLegend(ctx, segments.map(s => `${s.label} ${Math.round(s.value / total * 100)}%`), segments.map(s => s.color), legendX, legendY, lc, cFont);
        ctx.globalAlpha = 1;
        return;
    }
    // ── Scatter ───────────────────────────────────────────────
    if (c.chartType === 'scatter') {
        const pts = parseScatter(c.data);
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const toX = makeValueToX(xs, px, pw);
        const toY = makeValueToY(ys, py, ph);
        rc.line(px, py, px, py + ph, { ...R, roughness: 0.4, seed: hashStr$1(c.id + 'ya'), stroke: lc, strokeWidth: 1 });
        rc.line(px, py + ph, px + pw, py + ph, { ...R, roughness: 0.4, seed: hashStr$1(c.id + 'xa'), stroke: lc, strokeWidth: 1 });
        pts.forEach((pt, i) => {
            rc.ellipse(toX(pt.x), toY(pt.y), 10, 10, {
                roughness: 0.8, seed: hashStr$1(c.id + pt.label),
                fill: CHART_COLORS[i % CHART_COLORS.length] + '99',
                fillStyle: 'solid',
                stroke: CHART_COLORS[i % CHART_COLORS.length],
                strokeWidth: 1.2,
            });
        });
        drawLegend(ctx, pts.map(p => p.label), CHART_COLORS, c.x + 8, c.y + (c.label ? 28 : 12), lc, cFont);
        ctx.globalAlpha = 1;
        return;
    }
    // ── Bar / Line / Area ─────────────────────────────────────
    const { labels, series } = parseBarLine(c.data);
    const allY = series.flatMap(s => s.values);
    const toY = makeValueToY(allY, py, ph);
    const baseline = toY(0);
    const n = labels.length;
    drawAxes(rc, ctx, c, px, py, pw, ph, allY, lc, R, cFont);
    // X labels
    ctx.save();
    ctx.font = `400 9px ${cFont}`;
    ctx.fillStyle = lc;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    labels.forEach((lbl, i) => {
        ctx.fillText(lbl, px + (i + 0.5) * (pw / n), py + ph + 6);
    });
    ctx.restore();
    if (c.chartType === 'bar') {
        const groupW = pw / n;
        const m = series.length;
        const barW = (groupW / m) * 0.72;
        const slip = (groupW - barW * m) / (m + 1);
        series.forEach((ser, si) => {
            ser.values.forEach((val, i) => {
                const bx = px + i * groupW + slip + si * (barW + slip);
                const by = Math.min(toY(val), baseline);
                const bh = Math.abs(baseline - toY(val)) || 2;
                rc.rectangle(bx, by, barW, bh, {
                    roughness: 1.1, bowing: 0.5,
                    seed: hashStr$1(c.id + si + i),
                    fill: ser.color + 'bb',
                    fillStyle: 'hachure',
                    hachureAngle: -41,
                    hachureGap: 4,
                    fillWeight: 0.8,
                    stroke: ser.color,
                    strokeWidth: 1.2,
                });
            });
        });
    }
    else {
        // line / area
        const stepX = n > 1 ? pw / (n - 1) : 0;
        series.forEach((ser, si) => {
            const pts = ser.values.map((v, i) => [
                n > 1 ? px + i * stepX : px + pw / 2,
                toY(v),
            ]);
            // Area fill
            if (c.chartType === 'area') {
                const poly = [
                    [pts[0][0], baseline],
                    ...pts,
                    [pts[pts.length - 1][0], baseline],
                ];
                rc.polygon(poly, {
                    roughness: 0.5, seed: hashStr$1(c.id + 'af' + si),
                    fill: ser.color + '44',
                    fillStyle: 'solid',
                    stroke: 'none',
                });
            }
            // Lines
            for (let i = 0; i < pts.length - 1; i++) {
                rc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], {
                    roughness: 0.9, bowing: 0.6,
                    seed: hashStr$1(c.id + si + i),
                    stroke: ser.color,
                    strokeWidth: 1.8,
                });
            }
            // Dots
            pts.forEach(([px2, py2], i) => {
                rc.ellipse(px2, py2, 7, 7, {
                    roughness: 0.3, seed: hashStr$1(c.id + 'dot' + si + i),
                    fill: ser.color,
                    fillStyle: 'solid',
                    stroke: ser.color,
                    strokeWidth: 1,
                });
            });
        });
    }
    // Multi-series legend
    if (series.length > 1) {
        drawLegend(ctx, series.map(s => s.name), series.map(s => s.color), px, py - 2, lc, cFont);
    }
    ctx.globalAlpha = 1;
}

// ============================================================
// sketchmark — Canvas Renderer
// Uses rough.js canvas API for hand-drawn rendering
// ============================================================
// ── Canvas text helpers ────────────────────────────────────────────────────
function drawText(ctx, txt, x, y, sz = 14, wt = 500, col = '#1a1208', align = 'center', font = 'system-ui, sans-serif', letterSpacing) {
    ctx.save();
    ctx.font = `${wt} ${sz}px ${font}`;
    ctx.fillStyle = col;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (letterSpacing) {
        // Canvas has no native letter-spacing — draw char by char
        const chars = txt.split('');
        const totalW = ctx.measureText(txt).width + letterSpacing * (chars.length - 1);
        let startX = align === 'center' ? x - totalW / 2
            : align === 'right' ? x - totalW
                : x;
        ctx.textAlign = 'left';
        for (const ch of chars) {
            ctx.fillText(ch, startX, y);
            startX += ctx.measureText(ch).width + letterSpacing;
        }
    }
    else {
        ctx.fillText(txt, x, y);
    }
    ctx.restore();
}
function drawMultilineText(ctx, lines, x, cy, sz = 14, wt = 500, col = '#1a1208', align = 'center', lineH = 18, font = 'system-ui, sans-serif', letterSpacing) {
    const totalH = (lines.length - 1) * lineH;
    const startY = cy - totalH / 2;
    lines.forEach((line, i) => {
        drawText(ctx, line, x, startY + i * lineH, sz, wt, col, align, font, letterSpacing);
    });
}
// ── Node shapes ────────────────────────────────────────────────────────────
function renderShape(rc, ctx, n, palette, R) {
    const s = n.style ?? {};
    const fill = String(s.fill ?? palette.nodeFill);
    const stroke = String(s.stroke ?? palette.nodeStroke);
    const opts = {
        ...R, seed: hashStr$3(n.id),
        fill, fillStyle: 'solid',
        stroke, strokeWidth: Number(s.strokeWidth ?? 1.9),
        ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
    };
    const shape = getShape(n.shape);
    if (shape) {
        shape.renderCanvas(rc, ctx, n, palette, opts);
        return;
    }
    // fallback: box
    rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts);
}
// ── Arrowhead ─────────────────────────────────────────────────────────────
function drawArrowHead(rc, x, y, angle, col, seed, R) {
    const as = EDGE.arrowSize;
    rc.polygon([
        [x, y],
        [x - as * Math.cos(angle - Math.PI / 6.5), y - as * Math.sin(angle - Math.PI / 6.5)],
        [x - as * Math.cos(angle + Math.PI / 6.5), y - as * Math.sin(angle + Math.PI / 6.5)],
    ], { roughness: 0.3, seed, fill: col, fillStyle: 'solid', stroke: col, strokeWidth: 0.8 });
}
// ── Public API ─────────────────────────────────────────────────────────────
function renderToCanvas(sg, canvas, options = {}) {
    if (typeof rough === 'undefined')
        throw new Error('rough.js not loaded');
    const scale = options.scale ?? window.devicePixelRatio ?? 1;
    canvas.width = sg.width * scale;
    canvas.height = sg.height * scale;
    canvas.style.width = sg.width + 'px';
    canvas.style.height = sg.height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    // ── Palette ──────────────────────────────────────────────
    const isDark = options.theme === 'dark' ||
        (options.theme === 'auto' &&
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-color-scheme:dark)').matches);
    const themeName = String(sg.config[THEME_CONFIG_KEY] ?? (isDark ? 'dark' : 'light'));
    const palette = resolvePalette(themeName);
    // ── Diagram-level font ───────────────────────────────────
    const diagramFont = (() => {
        const raw = String(sg.style?.font ?? sg.config['font'] ?? '');
        if (raw) {
            loadFont(raw);
            return resolveFont(raw);
        }
        return DEFAULT_FONT;
    })();
    // ── Background ───────────────────────────────────────────
    if (!options.transparent) {
        ctx.fillStyle = options.background ?? String(sg.style?.fill ?? palette.background);
        ctx.fillRect(0, 0, sg.width, sg.height);
        const rootStroke = sg.style?.stroke;
        const rootStrokeWidth = Number(sg.style?.strokeWidth ?? 0);
        if (rootStroke && rootStroke !== 'none' && rootStrokeWidth > 0) {
            const inset = rootStrokeWidth / 2;
            ctx.save();
            ctx.strokeStyle = String(rootStroke);
            ctx.lineWidth = rootStrokeWidth;
            ctx.strokeRect(inset, inset, Math.max(0, sg.width - rootStrokeWidth), Math.max(0, sg.height - rootStrokeWidth));
            ctx.restore();
        }
    }
    else {
        ctx.clearRect(0, 0, sg.width, sg.height);
    }
    const rc = rough.canvas(canvas);
    const R = { roughness: options.roughness ?? ROUGH.roughness, bowing: options.bowing ?? ROUGH.bowing };
    const nm = nodeMap(sg);
    const tm = tableMap(sg);
    const gm = groupMap(sg);
    const cm = chartMap(sg);
    // ── Title ────────────────────────────────────────────────
    if (sg.title) {
        const titleSize = Number(sg.config['title-size'] ?? TITLE.fontSize);
        const titleWeight = Number(sg.config['title-weight'] ?? TITLE.fontWeight);
        const titleColor = String(sg.config['title-color'] ?? palette.titleText);
        drawText(ctx, sg.title, sg.width / 2, TITLE.y + 2, titleSize, titleWeight, titleColor, 'center', diagramFont);
    }
    // ── Groups (outermost first) ─────────────────────────────
    const sortedGroups = [...sg.groups].sort((a, b) => groupDepth(a, gm) - groupDepth(b, gm));
    for (const g of sortedGroups) {
        if (!g.w)
            continue;
        const gs = g.style ?? {};
        if (gs.opacity != null)
            ctx.globalAlpha = Number(gs.opacity);
        rc.rectangle(g.x, g.y, g.w, g.h, {
            ...R, roughness: 1.7, bowing: 0.4, seed: hashStr$3(g.id),
            fill: String(gs.fill ?? palette.groupFill),
            fillStyle: 'solid',
            stroke: String(gs.stroke ?? palette.groupStroke),
            strokeWidth: Number(gs.strokeWidth ?? 1.2),
            strokeLineDash: gs.strokeDash ?? palette.groupDash,
        });
        if (g.label) {
            const gTypo = resolveTypography(gs, { fontSize: GROUP_LABEL.fontSize, fontWeight: GROUP_LABEL.fontWeight, textAlign: "left", padding: GROUP_LABEL.padding }, diagramFont, palette.groupLabel);
            const gTextX = computeTextX(gTypo, g.x, g.w);
            drawText(ctx, g.label, gTextX, g.y + gTypo.padding + 2, gTypo.fontSize, gTypo.fontWeight, gTypo.textColor, gTypo.textAlign, gTypo.font, gTypo.letterSpacing);
        }
        if (gs.opacity != null)
            ctx.globalAlpha = 1;
    }
    // ── Edges ─────────────────────────────────────────────────
    for (const e of sg.edges) {
        const src = resolveEndpoint(e.from, nm, tm, gm, cm);
        const dst = resolveEndpoint(e.to, nm, tm, gm, cm);
        if (!src || !dst)
            continue;
        const dstCX = dst.x + dst.w / 2, dstCY = dst.y + dst.h / 2;
        const srcCX = src.x + src.w / 2, srcCY = src.y + src.h / 2;
        const [x1, y1] = getConnPoint(src, dstCX, dstCY, e.fromAnchor);
        const [x2, y2] = getConnPoint(dst, srcCX, srcCY, e.toAnchor);
        if (e.style?.opacity != null)
            ctx.globalAlpha = Number(e.style.opacity);
        const ecol = String(e.style?.stroke ?? palette.edgeStroke);
        const { arrowAt, dashed } = connMeta(e.connector);
        const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1;
        const nx = (x2 - x1) / len, ny = (y2 - y1) / len;
        const HEAD = EDGE.headInset;
        const sx1 = arrowAt === 'start' || arrowAt === 'both' ? x1 + nx * HEAD : x1;
        const sy1 = arrowAt === 'start' || arrowAt === 'both' ? y1 + ny * HEAD : y1;
        const sx2 = arrowAt === 'end' || arrowAt === 'both' ? x2 - nx * HEAD : x2;
        const sy2 = arrowAt === 'end' || arrowAt === 'both' ? y2 - ny * HEAD : y2;
        rc.line(sx1, sy1, sx2, sy2, {
            ...R, roughness: 0.9, seed: hashStr$3(e.from + e.to),
            stroke: ecol,
            strokeWidth: Number(e.style?.strokeWidth ?? 1.6),
            ...(dashed ? { strokeLineDash: EDGE.dashPattern } : {}),
        });
        const ang = Math.atan2(y2 - y1, x2 - x1);
        if (arrowAt === 'end' || arrowAt === 'both')
            drawArrowHead(rc, x2, y2, ang, ecol, hashStr$3(e.to));
        if (arrowAt === 'start' || arrowAt === 'both')
            drawArrowHead(rc, x1, y1, Math.atan2(y1 - y2, x1 - x2), ecol, hashStr$3(e.from + 'back'));
        if (e.label) {
            const mx = (x1 + x2) / 2 - ny * EDGE.labelOffset;
            const my = (y1 + y2) / 2 + nx * EDGE.labelOffset;
            // ── Edge label: font, font-size, letter-spacing ──
            // always center-anchored (single line)
            const eFontSize = Number(e.style?.fontSize ?? EDGE.labelFontSize);
            const eFont = resolveStyleFont(e.style ?? {}, diagramFont);
            const eLetterSpacing = e.style?.letterSpacing;
            const eFontWeight = e.style?.fontWeight ?? EDGE.labelFontWeight;
            const eLabelColor = String(e.style?.color ?? palette.edgeLabelText);
            ctx.save();
            ctx.font = `${eFontWeight} ${eFontSize}px ${eFont}`;
            const tw = ctx.measureText(e.label).width + 12;
            ctx.restore();
            ctx.fillStyle = palette.edgeLabelBg;
            ctx.fillRect(mx - tw / 2, my - 8, tw, 15);
            drawText(ctx, e.label, mx, my + 3, eFontSize, eFontWeight, eLabelColor, 'center', eFont, eLetterSpacing);
        }
        ctx.globalAlpha = 1;
    }
    // ── Nodes ─────────────────────────────────────────────────
    for (const n of sg.nodes) {
        if (n.style?.opacity != null)
            ctx.globalAlpha = Number(n.style.opacity);
        // ── Static transform (deg, dx, dy, factor) ──────────
        // All transforms anchor around the node's visual center.
        const hasTx = n.dx || n.dy || n.deg || (n.factor && n.factor !== 1);
        if (hasTx) {
            ctx.save();
            const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
            // Move to center, apply rotate + scale there, move back
            ctx.translate(cx + (n.dx ?? 0), cy + (n.dy ?? 0));
            if (n.deg)
                ctx.rotate((n.deg * Math.PI) / 180);
            if (n.factor && n.factor !== 1)
                ctx.scale(n.factor, n.factor);
            ctx.translate(-cx, -cy);
        }
        renderShape(rc, ctx, n, palette, R);
        // ── Node / text typography ─────────────────────────
        const isText = n.shape === 'text';
        const isNote = n.shape === 'note';
        const isMediaShape = n.shape === 'icon' || n.shape === 'image' || n.shape === 'line';
        const typo = resolveTypography(n.style, {
            fontSize: isText ? 13 : isNote ? 12 : 14,
            fontWeight: isText || isNote ? 400 : 500,
            textColor: isText ? palette.edgeLabelText : isNote ? palette.noteText : palette.nodeText,
            textAlign: isText || isNote ? "left" : undefined,
            lineHeight: isNote ? 1.4 : undefined,
            padding: isText ? 0 : isNote ? 12 : undefined,
            verticalAlign: isNote ? "top" : undefined,
        }, diagramFont, palette.nodeText);
        // Note textX accounts for fold corner
        const FOLD = NOTE.fold;
        const textX = isNote
            ? (typo.textAlign === 'right' ? n.x + n.w - FOLD - typo.padding
                : typo.textAlign === 'center' ? n.x + (n.w - FOLD) / 2
                    : n.x + typo.padding)
            : computeTextX(typo, n.x, n.w);
        const fontStr = buildFontStr(typo.fontSize, typo.fontWeight, typo.font);
        const shouldWrap = !isMediaShape && !n.label.includes('\n');
        const innerW = shapeInnerTextWidth(n.shape, n.w, typo.padding);
        const rawLines = n.label.split('\n');
        const lines = shouldWrap && rawLines.length === 1
            ? wrapText(n.label, innerW, typo.fontSize, fontStr)
            : rawLines;
        const textCY = isMediaShape
            ? n.y + n.h - 10
            : isNote
                ? computeTextCY(typo, n.y, n.h, lines.length, FOLD + typo.padding)
                : computeTextCY(typo, n.y, n.h, lines.length);
        if (n.label) {
            if (lines.length > 1) {
                drawMultilineText(ctx, lines, textX, textCY, typo.fontSize, typo.fontWeight, typo.textColor, typo.textAlign, typo.lineHeight, typo.font, typo.letterSpacing);
            }
            else {
                drawText(ctx, lines[0] ?? '', textX, textCY, typo.fontSize, typo.fontWeight, typo.textColor, typo.textAlign, typo.font, typo.letterSpacing);
            }
        }
        if (hasTx)
            ctx.restore();
        if (n.style?.opacity != null)
            ctx.globalAlpha = 1;
    }
    // ── Tables ────────────────────────────────────────────────
    for (const t of sg.tables) {
        const gs = t.style ?? {};
        const fill = String(gs.fill ?? palette.tableFill);
        const strk = String(gs.stroke ?? palette.tableStroke);
        const textCol = String(gs.color ?? palette.tableText);
        const pad = t.labelH;
        // ── Table-level font ────────────────────────────────
        const tFontSize = Number(gs.fontSize ?? 12);
        const tFont = resolveStyleFont(gs, diagramFont);
        const tLetterSpacing = gs.letterSpacing;
        const tStrokeWidth = Number(gs.strokeWidth ?? 1.5);
        const tFontWeight = gs.fontWeight ?? 500;
        if (gs.opacity != null)
            ctx.globalAlpha = Number(gs.opacity);
        rc.rectangle(t.x, t.y, t.w, t.h, {
            ...R, seed: hashStr$3(t.id),
            fill, fillStyle: 'solid', stroke: strk, strokeWidth: tStrokeWidth,
            ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash } : {}),
        });
        rc.line(t.x, t.y + pad, t.x + t.w, t.y + pad, {
            roughness: 0.6, seed: hashStr$3(t.id + 'l'), stroke: strk, strokeWidth: 1,
        });
        // ── Table label: always left-anchored ───────────────
        drawText(ctx, t.label, t.x + 10, t.y + pad / 2, tFontSize, tFontWeight, textCol, 'left', tFont, tLetterSpacing);
        let rowY = t.y + pad;
        for (const row of t.rows) {
            const rh = row.kind === 'header' ? t.headerH : t.rowH;
            if (row.kind === 'header') {
                ctx.fillStyle = gs.fill ? darkenHex(fill, 0.08) : palette.tableHeaderFill;
                ctx.fillRect(t.x + 1, rowY + 1, t.w - 2, rh - 1);
            }
            rc.line(t.x, rowY + rh, t.x + t.w, rowY + rh, {
                roughness: 0.4, seed: hashStr$3(t.id + rowY),
                stroke: row.kind === 'header' ? strk : palette.tableDivider,
                strokeWidth: row.kind === 'header' ? 1.2 : 0.6,
            });
            // ── Cell text ───────────────────────────────────
            // header always centered; data rows respect gs.textAlign
            const cellAlignProp = (row.kind === 'header'
                ? 'center'
                : String(gs.textAlign ?? 'center'));
            const cellFw = row.kind === 'header' ? 600 : (gs.fontWeight ?? 400);
            const cellColor = row.kind === 'header'
                ? String(gs.color ?? palette.tableHeaderText)
                : textCol;
            let cx = t.x;
            row.cells.forEach((cell, i) => {
                const cw = t.colWidths[i] ?? 60;
                const cellX = cellAlignProp === 'left' ? cx + 6
                    : cellAlignProp === 'right' ? cx + cw - 6
                        : cx + cw / 2;
                drawText(ctx, cell, cellX, rowY + rh / 2, tFontSize, cellFw, cellColor, cellAlignProp, tFont, tLetterSpacing);
                if (i < row.cells.length - 1) {
                    rc.line(cx + cw, t.y + pad, cx + cw, t.y + t.h, {
                        roughness: 0.3, seed: hashStr$3(t.id + 'c' + i),
                        stroke: palette.tableDivider, strokeWidth: 0.5,
                    });
                }
                cx += cw;
            });
            rowY += rh;
        }
        ctx.globalAlpha = 1;
    }
    // ── Notes are now rendered as nodes via the shape registry ──
    // ── Markdown blocks ────────────────────────────────────────
    // Renders prose with Markdown headings and bold/italic inline spans.
    // Canvas has no native bold-within-a-run, so each run is drawn
    // individually with its own ctx.font setting.
    for (const m of (sg.markdowns ?? [])) {
        const gs = m.style ?? {};
        const mFont = resolveStyleFont(gs, diagramFont);
        const baseColor = String(gs.color ?? palette.nodeText);
        const textAlign = String(gs.textAlign ?? 'left');
        const PAD = Number(gs.padding ?? 0);
        const mLetterSpacing = gs.letterSpacing;
        if (gs.opacity != null)
            ctx.globalAlpha = Number(gs.opacity);
        // Background + border
        if (gs.fill || gs.stroke) {
            rc.rectangle(m.x, m.y, m.w, m.h, {
                ...R, seed: hashStr$3(m.id),
                fill: String(gs.fill ?? 'none'), fillStyle: 'solid',
                stroke: String(gs.stroke ?? 'none'),
                strokeWidth: Number(gs.strokeWidth ?? 1.2),
                ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash } : {}),
            });
        }
        const anchorX = textAlign === 'right' ? m.x + m.w - PAD
            : textAlign === 'center' ? m.x + m.w / 2
                : m.x + PAD;
        let y = m.y + PAD;
        for (const line of m.lines) {
            if (line.kind === 'blank') {
                y += LINE_SPACING.blank;
                continue;
            }
            const fontSize = LINE_FONT_SIZE[line.kind];
            const fontWeight = LINE_FONT_WEIGHT[line.kind];
            const lineY = y + fontSize / 2;
            // Measure total run width for left-offset when runs mix bold/italic
            // Simple: draw each run consecutively from a computed start x
            ctx.save();
            ctx.textBaseline = 'middle';
            ctx.fillStyle = baseColor;
            const ls = mLetterSpacing ?? 0;
            // measure run width including letter-spacing
            const runW = (run) => {
                return ctx.measureText(run.text).width + ls * run.text.length;
            };
            const drawRun = (run, rx) => {
                if (ls) {
                    for (const ch of run.text) {
                        ctx.fillText(ch, rx, lineY);
                        rx += ctx.measureText(ch).width + ls;
                    }
                }
                else {
                    ctx.fillText(run.text, rx, lineY);
                }
            };
            if (textAlign === 'center' || textAlign === 'right') {
                let totalW = 0;
                for (const run of line.runs) {
                    const runStyle = run.italic ? 'italic ' : '';
                    const runWeight = run.bold ? 700 : fontWeight;
                    ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
                    totalW += runW(run);
                }
                let runX = textAlign === 'center' ? anchorX - totalW / 2 : anchorX - totalW;
                ctx.textAlign = 'left';
                for (const run of line.runs) {
                    const runStyle = run.italic ? 'italic ' : '';
                    const runWeight = run.bold ? 700 : fontWeight;
                    ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
                    drawRun(run, runX);
                    runX += runW(run);
                }
            }
            else {
                let runX = anchorX;
                ctx.textAlign = 'left';
                for (const run of line.runs) {
                    const runStyle = run.italic ? 'italic ' : '';
                    const runWeight = run.bold ? 700 : fontWeight;
                    ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
                    drawRun(run, runX);
                    runX += runW(run);
                }
            }
            ctx.restore();
            y += LINE_SPACING[line.kind];
        }
        ctx.globalAlpha = 1;
    }
    // ── Charts ────────────────────────────────────────────────
    for (const c of sg.charts) {
        drawRoughChartCanvas(rc, ctx, c, {
            nodeFill: palette.chartFill,
            nodeStroke: palette.chartStroke,
            labelText: palette.chartText,
            labelBg: palette.edgeLabelBg,
        }, R);
    }
}
// ── Export helpers ─────────────────────────────────────────────────────────
function canvasToPNGBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob)
                resolve(blob);
            else
                reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
    });
}
function canvasToPNGDataURL(canvas) {
    return canvas.toDataURL('image/png');
}

// ============================================================
// sketchmark — Animation Engine  (nodes + edges + groups)
// ============================================================
// ── DOM helpers ───────────────────────────────────────────
const getEl = (svg, id) => svg.querySelector(`#${id}`);
const getNodeEl = (svg, id) => getEl(svg, `node-${id}`);
const getGroupEl = (svg, id) => getEl(svg, `group-${id}`);
const getEdgeEl = (svg, f, t) => getEl(svg, `edge-${f}-${t}`);
const getTableEl = (svg, id) => getEl(svg, `table-${id}`);
const getNoteEl = (svg, id) => getEl(svg, `note-${id}`);
const getChartEl = (svg, id) => getEl(svg, `chart-${id}`);
const getMarkdownEl = (svg, id) => getEl(svg, `markdown-${id}`);
const POSITIONABLE_SELECTOR = ".ng, .gg, .tg, .ntg, .cg, .mdg";
function resolveNonEdgeDrawEl(svg, target) {
    return (getGroupEl(svg, target) ??
        getTableEl(svg, target) ??
        getNoteEl(svg, target) ??
        getChartEl(svg, target) ??
        getMarkdownEl(svg, target) ??
        getNodeEl(svg, target) ??
        null);
}
function hideDrawEl(el) {
    if (el.classList.contains("ng")) {
        el.classList.add("hidden");
        return;
    }
    el.classList.add("gg-hidden");
}
function showDrawEl(el) {
    el.classList.remove("hidden", "gg-hidden");
}
function resolveEl(svg, target) {
    // check edge first — target contains connector like "a-->b"
    const edge = parseEdgeTarget(target);
    if (edge)
        return getEdgeEl(svg, edge.from, edge.to);
    // everything else resolved by prefixed id
    return (resolveNonEdgeDrawEl(svg, target) ??
        null);
}
function pathLength(p) {
    try {
        return p.getTotalLength() || 200;
    }
    catch {
        return 200;
    }
}
function clearDashOverridesAfter(el, delayMs) {
    setTimeout(() => {
        el.querySelectorAll('path').forEach(p => {
            p.style.strokeDasharray = '';
            p.style.strokeDashoffset = '';
            p.style.transition = '';
        });
    }, delayMs);
}
const NODE_DRAW_GUIDE_ATTR = "data-node-draw-guide";
const TEXT_REVEAL_CLIP_ATTR = "data-text-reveal-clip-id";
const GUIDED_NODE_SHAPES = new Set([
    "box",
    "circle",
    "diamond",
    "hexagon",
    "triangle",
    "parallelogram",
    "line",
    "path",
]);
function polygonPath(points) {
    return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ") + " Z";
}
function rectPath(x, y, w, h) {
    return polygonPath([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
    ]);
}
function ellipsePath(cx, cy, rx, ry) {
    return [
        `M ${cx - rx} ${cy}`,
        `A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy}`,
        `A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`,
    ].join(" ");
}
function nodeMetric(el, key) {
    const raw = el.dataset[key];
    const n = raw == null ? Number.NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
}
function buildNodeGuidePath(el) {
    const shape = el.dataset.nodeShape;
    if (!shape || !GUIDED_NODE_SHAPES.has(shape))
        return null;
    const x = nodeMetric(el, "x");
    const y = nodeMetric(el, "y");
    const w = nodeMetric(el, "w");
    const h = nodeMetric(el, "h");
    if (x == null || y == null || w == null || h == null)
        return null;
    switch (shape) {
        case "box":
            return rectPath(x + 1, y + 1, w - 2, h - 2);
        case "circle":
            return ellipsePath(x + w / 2, y + h / 2, (w * 0.88) / 2, (h * 0.88) / 2);
        case "diamond": {
            const cx = x + w / 2;
            const cy = y + h / 2;
            const hw = w / 2 - 2;
            return polygonPath([
                [cx, y + 2],
                [cx + hw, cy],
                [cx, y + h - 2],
                [cx - hw, cy],
            ]);
        }
        case "hexagon": {
            const cx = x + w / 2;
            const cy = y + h / 2;
            const hw = w / 2 - 2;
            const hw2 = hw * SHAPES.hexagon.inset;
            return polygonPath([
                [cx - hw2, y + 3],
                [cx + hw2, y + 3],
                [cx + hw, cy],
                [cx + hw2, y + h - 3],
                [cx - hw2, y + h - 3],
                [cx - hw, cy],
            ]);
        }
        case "triangle": {
            const cx = x + w / 2;
            return polygonPath([
                [cx, y + 3],
                [x + w - 3, y + h - 3],
                [x + 3, y + h - 3],
            ]);
        }
        case "parallelogram":
            return polygonPath([
                [x + SHAPES.parallelogram.skew, y + 1],
                [x + w - 1, y + 1],
                [x + w - SHAPES.parallelogram.skew, y + h - 1],
                [x + 1, y + h - 1],
            ]);
        case "line": {
            const labelH = el.querySelector("text") ? 20 : 0;
            const lineY = y + (h - labelH) / 2;
            return `M ${x} ${lineY} L ${x + w} ${lineY}`;
        }
        case "path":
            return el.dataset.pathData ?? null;
        default:
            return null;
    }
}
function nodeGuidePathEl(el) {
    return el.querySelector(`path[${NODE_DRAW_GUIDE_ATTR}="true"]`);
}
function removeNodeGuide(el) {
    nodeGuidePathEl(el)?.remove();
}
function nodePaths(el) {
    return Array.from(el.querySelectorAll("path")).filter((p) => p.getAttribute(NODE_DRAW_GUIDE_ATTR) !== "true");
}
function nodeText(el) {
    return el.querySelector("text");
}
function nodeStrokeTemplate(el) {
    return (nodePaths(el).find((p) => (p.getAttribute("stroke") ?? "") !== "none") ??
        nodePaths(el)[0] ??
        null);
}
function clearNodeDrawStyles(el) {
    removeNodeGuide(el);
    nodePaths(el).forEach((p) => {
        p.style.strokeDasharray =
            p.style.strokeDashoffset =
                p.style.fillOpacity =
                    p.style.transition =
                        p.style.opacity =
                            "";
    });
    const text = nodeText(el);
    if (text) {
        clearTextReveal(text);
        text.style.opacity = text.style.transition = "";
    }
}
function prepareNodeForDraw(el) {
    clearNodeDrawStyles(el);
    const d = buildNodeGuidePath(el);
    const source = nodeStrokeTemplate(el);
    if (!d || !source) {
        prepareForDraw(el);
        return;
    }
    const guide = document.createElementNS(SVG_NS$1, "path");
    guide.setAttribute("d", d);
    guide.setAttribute("fill", "none");
    guide.setAttribute("stroke", source.getAttribute("stroke") ?? "#000");
    guide.setAttribute("stroke-width", source.getAttribute("stroke-width") ?? "1.8");
    guide.setAttribute("stroke-linecap", "round");
    guide.setAttribute("stroke-linejoin", "round");
    guide.setAttribute(NODE_DRAW_GUIDE_ATTR, "true");
    if (el.dataset.nodeShape === "path") {
        const pathX = nodeMetric(el, "x") ?? 0;
        const pathY = nodeMetric(el, "y") ?? 0;
        guide.setAttribute("transform", `translate(${pathX},${pathY})`);
    }
    guide.style.pointerEvents = "none";
    const len = pathLength(guide);
    guide.style.strokeDasharray = `${len}`;
    guide.style.strokeDashoffset = `${len}`;
    guide.style.transition = "none";
    nodePaths(el).forEach((p) => {
        p.style.opacity = "0";
        p.style.transition = "none";
    });
    const text = nodeText(el);
    if (text) {
        text.style.opacity = "0";
        text.style.transition = "none";
    }
    el.appendChild(guide);
}
function revealNodeInstant(el) {
    showDrawEl(el);
    clearNodeDrawStyles(el);
}
// ── Text writing reveal (clipPath) ───────────────────────
function clearTextReveal(textEl, clipId) {
    const activeClipId = textEl.getAttribute(TEXT_REVEAL_CLIP_ATTR);
    const shouldClearCurrentClip = !clipId || activeClipId === clipId;
    if (shouldClearCurrentClip) {
        textEl.removeAttribute("clip-path");
        textEl.removeAttribute(TEXT_REVEAL_CLIP_ATTR);
    }
    const clipIdToRemove = clipId ?? activeClipId;
    if (clipIdToRemove) {
        textEl.ownerSVGElement?.querySelector(`#${clipIdToRemove}`)?.remove();
    }
}
function animateTextReveal(textEl, delayMs, durationMs = ANIMATION.textRevealMs) {
    const ownerSvg = textEl.ownerSVGElement;
    clearTextReveal(textEl);
    if (!ownerSvg) {
        // fallback: just fade
        textEl.style.transition = `opacity ${ANIMATION.textFade}ms ease ${delayMs}ms`;
        textEl.style.opacity = "1";
        return;
    }
    const bbox = textEl.getBBox?.();
    if (!bbox || bbox.width === 0) {
        // fallback if can't measure
        textEl.style.transition = `opacity ${ANIMATION.textFade}ms ease ${delayMs}ms`;
        textEl.style.opacity = "1";
        return;
    }
    let defs = ownerSvg.querySelector("defs");
    if (!defs) {
        defs = document.createElementNS(SVG_NS$1, "defs");
        ownerSvg.insertBefore(defs, ownerSvg.firstChild);
    }
    const clipId = `skm-clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const clipPath = document.createElementNS(SVG_NS$1, "clipPath");
    clipPath.setAttribute("id", clipId);
    const rect = document.createElementNS(SVG_NS$1, "rect");
    rect.setAttribute("x", String(bbox.x - 2));
    rect.setAttribute("y", String(bbox.y - 2));
    rect.setAttribute("width", "0");
    rect.setAttribute("height", String(bbox.height + 4));
    clipPath.appendChild(rect);
    defs.appendChild(clipPath);
    textEl.setAttribute("clip-path", `url(#${clipId})`);
    textEl.setAttribute(TEXT_REVEAL_CLIP_ATTR, clipId);
    textEl.style.opacity = "1";
    requestAnimationFrame(() => requestAnimationFrame(() => {
        rect.style.transition = `width ${durationMs}ms cubic-bezier(.4,0,.2,1) ${delayMs}ms`;
        rect.setAttribute("width", String(bbox.width + 4));
    }));
    // Cleanup after animation
    setTimeout(() => {
        clearTextReveal(textEl, clipId);
    }, delayMs + durationMs + 50);
}
function animateNodeDraw(el, strokeDur = ANIMATION.nodeStrokeDur, textOnlyDur = ANIMATION.textRevealMs) {
    showDrawEl(el);
    const guide = nodeGuidePathEl(el);
    if (!guide) {
        const firstPath = el.querySelector("path");
        const text = nodeText(el);
        if (!firstPath && el.dataset.nodeShape === "text" && text) {
            animateTextReveal(text, 0, textOnlyDur);
            setTimeout(() => {
                clearNodeDrawStyles(el);
            }, textOnlyDur + 80);
            return;
        }
        if (!firstPath?.style.strokeDasharray)
            prepareForDraw(el);
        animateShapeDraw(el, strokeDur, ANIMATION.nodeStagger);
        const nodePathCount = el.querySelectorAll("path").length;
        clearDashOverridesAfter(el, nodePathCount * ANIMATION.nodeStagger + strokeDur + 120);
        return;
    }
    const roughPaths = nodePaths(el);
    const text = nodeText(el);
    const revealDelay = strokeDur + 30;
    const textDelay = revealDelay + ANIMATION.textDelay;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        guide.style.transition = `stroke-dashoffset ${strokeDur}ms cubic-bezier(.4,0,.2,1)`;
        guide.style.strokeDashoffset = "0";
        roughPaths.forEach((p) => {
            p.style.transition = `opacity 140ms ease ${revealDelay}ms`;
            p.style.opacity = "1";
        });
        if (text) {
            animateTextReveal(text, textDelay);
        }
        setTimeout(() => {
            clearNodeDrawStyles(el);
        }, textDelay + ANIMATION.textRevealMs + 80);
    }));
}
// ── Arrow connector parser ────────────────────────────────
const ARROW_CONNECTORS = ["<-->", "<->", "-->", "<--", "->", "<-", "---", "--"];
function parseEdgeTarget(target) {
    for (const conn of ARROW_CONNECTORS) {
        const idx = target.indexOf(conn);
        if (idx !== -1)
            return {
                from: target.slice(0, idx).trim(),
                to: target.slice(idx + conn.length).trim(),
                conn,
            };
    }
    return null;
}
// ── Step flattening helper ────────────────────────────────
function flattenSteps(items) {
    const out = [];
    for (const item of items) {
        if (item.kind === "beat")
            out.push(...item.children);
        else
            out.push(item);
    }
    return out;
}
function forEachPlaybackStep(items, visit) {
    items.forEach((item, stepIndex) => {
        if (item.kind === "beat") {
            item.children.forEach((child) => visit(child, stepIndex));
            return;
        }
        visit(item, stepIndex);
    });
}
// ── Draw target helpers ───────────────────────────────────
function getDrawTargetEdgeIds(steps) {
    const ids = new Set();
    for (const s of flattenSteps(steps)) {
        if (s.action !== "draw")
            continue;
        const e = parseEdgeTarget(s.target);
        if (e)
            ids.add(`edge-${e.from}-${e.to}`);
    }
    return ids;
}
function getDrawTargetNodeIds(steps) {
    const ids = new Set();
    for (const s of flattenSteps(steps)) {
        if (s.action !== "draw" || parseEdgeTarget(s.target))
            continue;
        ids.add(`node-${s.target}`);
    }
    return ids;
}
// ── Generic shape-draw helpers (shared by nodes and groups) ──
function prepareForDraw(el) {
    el.querySelectorAll("path").forEach((p) => {
        const len = pathLength(p);
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
        p.style.fillOpacity = "0";
        p.style.transition = "none";
    });
    const text = el.querySelector("text");
    if (text) {
        text.style.opacity = "0";
        text.style.transition = "none";
    }
}
function clearDrawStyles(el) {
    el.querySelectorAll("path").forEach((p) => {
        p.style.strokeDasharray =
            p.style.strokeDashoffset =
                p.style.fillOpacity =
                    p.style.transition =
                        "";
    });
    const text = el.querySelector("text");
    if (text) {
        text.style.opacity = text.style.transition = "";
    }
}
function animateShapeDraw(el, strokeDur = ANIMATION.nodeStrokeDur, stag = ANIMATION.nodeStagger) {
    const paths = Array.from(el.querySelectorAll("path"));
    const text = el.querySelector("text");
    requestAnimationFrame(() => requestAnimationFrame(() => {
        paths.forEach((p, i) => {
            const sd = i * stag, fd = sd + strokeDur + ANIMATION.fillFadeOffset;
            p.style.transition = [
                `stroke-dashoffset ${strokeDur}ms cubic-bezier(.4,0,.2,1) ${sd}ms`,
                `fill-opacity 180ms ease ${Math.max(0, fd)}ms`,
            ].join(", ");
            p.style.strokeDashoffset = "0";
            p.style.fillOpacity = "1";
        });
        if (text) {
            const td = paths.length * stag + strokeDur + ANIMATION.textDelay;
            text.style.transition = `opacity ${ANIMATION.textFade}ms ease ${td}ms`;
            text.style.opacity = "1";
        }
    }));
}
// ── Edge draw helpers ─────────────────────────────────────
const EDGE_SHAFT_SELECTOR = '[data-edge-role="shaft"] path';
const EDGE_DECOR_SELECTOR = '[data-edge-role="head"], [data-edge-role="label"], [data-edge-role="label-bg"]';
function edgeShaftPaths(el) {
    return Array.from(el.querySelectorAll(EDGE_SHAFT_SELECTOR));
}
function edgeDecorEls(el) {
    return Array.from(el.querySelectorAll(EDGE_DECOR_SELECTOR));
}
function prepareEdgeForDraw(el) {
    edgeShaftPaths(el).forEach((p) => {
        const len = pathLength(p);
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
        p.style.transition = "none";
    });
    edgeDecorEls(el).forEach((part) => {
        part.style.opacity = "0";
        part.style.transition = "none";
    });
}
function revealEdgeInstant(el) {
    edgeShaftPaths(el).forEach((p) => {
        p.style.transition = "none";
        p.style.strokeDashoffset = "0";
        p.style.strokeDasharray = "";
    });
    edgeDecorEls(el).forEach((part) => {
        part.style.transition = "none";
        part.style.opacity = "1";
    });
}
function clearEdgeDrawStyles(el) {
    edgeShaftPaths(el).forEach((p) => {
        p.style.strokeDasharray =
            p.style.strokeDashoffset =
                p.style.transition =
                    "";
    });
    edgeDecorEls(el).forEach((part) => {
        part.style.opacity = part.style.transition = "";
    });
}
function animateEdgeDraw(el, conn, strokeDur = ANIMATION.strokeDur) {
    const shaftPaths = edgeShaftPaths(el);
    const decorEls = edgeDecorEls(el);
    if (!shaftPaths.length)
        return;
    const reversed = conn.startsWith('<') && !conn.includes('>');
    shaftPaths.forEach((p) => {
        const len = pathLength(p);
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = reversed ? `${-len}` : `${len}`;
        p.style.transition = "none";
    });
    decorEls.forEach((part) => {
        part.style.opacity = "0";
        part.style.transition = "none";
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
        shaftPaths.forEach((p) => {
            p.style.transition = `stroke-dashoffset ${strokeDur}ms cubic-bezier(.4,0,.2,1)`;
            p.style.strokeDashoffset = "0";
        });
        setTimeout(() => {
            decorEls.forEach((part) => {
                part.style.transition = `opacity ${ANIMATION.arrowReveal}ms ease`;
                part.style.opacity = "1";
            });
            // ── ADD: clear inline dash overrides so SVG attribute
            //    (stroke-dasharray="6,5" for dashed arrows) takes over again
            setTimeout(() => {
                clearEdgeDrawStyles(el);
            }, ANIMATION.dashClear);
        }, Math.max(0, strokeDur - 40));
    }));
}
// ── AnimationController ───────────────────────────────────
class AnimationController {
    get drawTargets() {
        return this.drawTargetEdges;
    }
    constructor(svg, steps, _container, _rc, _config) {
        this.svg = svg;
        this.steps = steps;
        this._container = _container;
        this._rc = _rc;
        this._config = _config;
        this._step = -1;
        this._pendingStepTimers = new Set();
        this._pendingNarrationTimers = new Set();
        this._transforms = new Map();
        this._listeners = [];
        // ── Narration caption ──
        this._captionEl = null;
        this._captionTextEl = null;
        this._narrationRunId = 0;
        // ── Annotations ──
        this._annotationLayer = null;
        this._annotations = [];
        // ── Pointer ──
        this._pointerEl = null;
        this._pointerType = 'none';
        // ── TTS ──
        this._tts = false;
        this._speechDone = null;
        this.drawTargetEdges = getDrawTargetEdgeIds(steps);
        this.drawTargetNodes = getDrawTargetNodeIds(steps);
        // Groups: non-edge draw steps whose target has a #group-{id} element in the SVG.
        this.drawTargetGroups = new Set();
        this.drawTargetTables = new Set();
        this.drawTargetNotes = new Set();
        this.drawTargetCharts = new Set();
        this.drawTargetMarkdowns = new Set();
        for (const s of flattenSteps(steps)) {
            if (s.action !== "draw" || parseEdgeTarget(s.target))
                continue;
            if (resolveNonEdgeDrawEl(svg, s.target)?.id === `group-${s.target}`) {
                this.drawTargetGroups.add(`group-${s.target}`);
                this.drawTargetNodes.delete(`node-${s.target}`);
            }
            if (svg.querySelector(`#table-${s.target}`)) {
                this.drawTargetTables.add(`table-${s.target}`);
                this.drawTargetNodes.delete(`node-${s.target}`);
            }
            if (svg.querySelector(`#note-${s.target}`)) {
                this.drawTargetNotes.add(`note-${s.target}`);
                this.drawTargetNodes.delete(`node-${s.target}`);
            }
            if (svg.querySelector(`#chart-${s.target}`)) {
                this.drawTargetCharts.add(`chart-${s.target}`);
                this.drawTargetNodes.delete(`node-${s.target}`);
            }
            if (svg.querySelector(`#markdown-${s.target}`)) {
                this.drawTargetMarkdowns.add(`markdown-${s.target}`);
                this.drawTargetNodes.delete(`node-${s.target}`);
            }
        }
        this._relatedElementIdsByPrimaryId = this._buildRelatedElementIndex();
        for (const nodeId of Array.from(this.drawTargetNodes)) {
            const relatedIds = this._relatedElementIdsByPrimaryId.get(nodeId);
            if (!relatedIds)
                continue;
            relatedIds.forEach((id) => this.drawTargetNodes.add(id));
        }
        this._drawStepIndexByElementId = this._buildDrawStepIndex();
        const { parentGroupByElementId, groupDescendantIds } = this._buildGroupVisibilityIndex();
        this._parentGroupByElementId = parentGroupByElementId;
        this._groupDescendantIds = groupDescendantIds;
        this._clearAll();
        // Init narration caption
        if (this._container)
            this._initCaption();
        // Init annotation layer
        this._annotationLayer = document.createElementNS(SVG_NS$1, "g");
        this._annotationLayer.setAttribute("id", "annotation-layer");
        this._annotationLayer.style.pointerEvents = "none";
        this.svg.appendChild(this._annotationLayer);
        // Init pointer
        this._pointerType = (this._config?.pointer ?? "none");
        if (this._pointerType !== "none")
            this._initPointer();
        // Init TTS from config: `config tts=on`
        this._tts = this._config?.tts === true || this._config?.tts === "on";
        if (this._tts)
            this._warmUpSpeech();
    }
    _buildDrawStepIndex() {
        const drawStepIndexByElementId = new Map();
        forEachPlaybackStep(this.steps, (step, stepIndex) => {
            if (step.action !== "draw" || parseEdgeTarget(step.target))
                return;
            const el = resolveNonEdgeDrawEl(this.svg, step.target);
            if (el && !drawStepIndexByElementId.has(el.id)) {
                drawStepIndexByElementId.set(el.id, stepIndex);
                this._relatedElementIdsByPrimaryId.get(el.id)?.forEach((relatedId) => {
                    if (!drawStepIndexByElementId.has(relatedId)) {
                        drawStepIndexByElementId.set(relatedId, stepIndex);
                    }
                });
            }
        });
        return drawStepIndexByElementId;
    }
    _buildRelatedElementIndex() {
        const relatedElementIdsByPrimaryId = new Map();
        this.svg.querySelectorAll(POSITIONABLE_SELECTOR).forEach((el) => {
            const animationParent = el.dataset.animationParent;
            if (!animationParent)
                return;
            const primaryEl = resolveNonEdgeDrawEl(this.svg, animationParent);
            if (!primaryEl || primaryEl.id === el.id)
                return;
            const related = relatedElementIdsByPrimaryId.get(primaryEl.id) ?? new Set();
            related.add(el.id);
            relatedElementIdsByPrimaryId.set(primaryEl.id, related);
        });
        return relatedElementIdsByPrimaryId;
    }
    _buildGroupVisibilityIndex() {
        const parentGroupByElementId = new Map();
        const directChildIdsByGroup = new Map();
        this.svg.querySelectorAll(POSITIONABLE_SELECTOR).forEach((el) => {
            const parentGroupId = el.dataset.parentGroup;
            if (!parentGroupId)
                return;
            const parentGroupElId = `group-${parentGroupId}`;
            parentGroupByElementId.set(el.id, parentGroupElId);
            const children = directChildIdsByGroup.get(parentGroupElId) ?? new Set();
            children.add(el.id);
            directChildIdsByGroup.set(parentGroupElId, children);
        });
        const groupDescendantIds = new Map();
        const visit = (groupElId) => {
            if (groupDescendantIds.has(groupElId))
                return groupDescendantIds.get(groupElId);
            const descendants = new Set();
            const directChildren = directChildIdsByGroup.get(groupElId);
            if (directChildren) {
                for (const childId of directChildren) {
                    descendants.add(childId);
                    if (childId.startsWith("group-")) {
                        visit(childId).forEach((nestedId) => descendants.add(nestedId));
                    }
                }
            }
            groupDescendantIds.set(groupElId, descendants);
            return descendants;
        };
        this.svg.querySelectorAll(".gg").forEach((el) => {
            visit(el.id);
        });
        return { parentGroupByElementId, groupDescendantIds };
    }
    _hideGroupDescendants(groupElId) {
        const descendants = this._groupDescendantIds.get(groupElId);
        if (!descendants)
            return;
        for (const descendantId of descendants) {
            const el = getEl(this.svg, descendantId);
            if (el)
                hideDrawEl(el);
        }
    }
    _isDeferredForGroupReveal(elementId, stepIndex, groupElId) {
        let currentId = elementId;
        while (currentId) {
            const firstDrawStep = this._drawStepIndexByElementId.get(currentId);
            if (firstDrawStep != null && firstDrawStep > stepIndex)
                return true;
            if (currentId === groupElId)
                break;
            currentId = this._parentGroupByElementId.get(currentId);
        }
        return false;
    }
    _revealGroupSubtree(groupElId, stepIndex) {
        const descendants = this._groupDescendantIds.get(groupElId);
        if (!descendants)
            return;
        for (const descendantId of descendants) {
            if (this._isDeferredForGroupReveal(descendantId, stepIndex, groupElId))
                continue;
            const el = getEl(this.svg, descendantId);
            if (el)
                showDrawEl(el);
        }
    }
    _resolveCascadeTargets(target) {
        const edge = parseEdgeTarget(target);
        if (edge) {
            const el = getEdgeEl(this.svg, edge.from, edge.to);
            return el ? [el] : [];
        }
        const el = resolveEl(this.svg, target);
        if (!el)
            return [];
        if (!el.id.startsWith("group-")) {
            const ids = new Set([el.id]);
            this._relatedElementIdsByPrimaryId.get(el.id)?.forEach((id) => ids.add(id));
            this.svg.querySelectorAll(POSITIONABLE_SELECTOR).forEach((candidate) => {
                if (candidate.dataset.animationParent === target)
                    ids.add(candidate.id);
            });
            return Array.from(ids)
                .map((id) => getEl(this.svg, id))
                .filter((candidate) => candidate != null);
        }
        const ids = new Set([el.id]);
        this._groupDescendantIds.get(el.id)?.forEach((id) => ids.add(id));
        Array.from(ids).forEach((id) => {
            this._relatedElementIdsByPrimaryId.get(id)?.forEach((relatedId) => ids.add(relatedId));
        });
        return Array.from(ids)
            .map((id) => getEl(this.svg, id))
            .filter((candidate) => candidate != null);
    }
    /** The narration caption element — mount it anywhere via `yourContainer.appendChild(anim.captionElement)` */
    get captionElement() {
        return this._captionEl;
    }
    /** Enable/disable browser text-to-speech for narrate steps */
    get tts() { return this._tts; }
    set tts(on) {
        const next = !!on;
        const changed = next !== this._tts;
        this._tts = next;
        if (!next) {
            this._cancelSpeech();
            return;
        }
        if (changed)
            this._warmUpSpeech();
    }
    get currentStep() {
        return this._step;
    }
    get total() {
        return this.steps.length;
    }
    get canNext() {
        return this._step < this.steps.length - 1;
    }
    get canPrev() {
        return this._step >= 0;
    }
    get atEnd() {
        return this._step === this.steps.length - 1;
    }
    on(listener) {
        this._listeners.push(listener);
        return () => {
            this._listeners = this._listeners.filter((l) => l !== listener);
        };
    }
    emit(type) {
        const e = {
            type,
            stepIndex: this._step,
            step: this.steps[this._step],
            total: this.total,
        };
        for (const l of this._listeners)
            l(e);
    }
    reset() {
        this._step = -1;
        this._clearAll();
        this.emit("animation-reset");
    }
    /** Remove caption and annotation layer from the DOM */
    destroy() {
        this._clearAll();
        this._captionEl?.remove();
        this._captionEl = null;
        this._captionTextEl = null;
        this._annotationLayer?.remove();
        this._annotationLayer = null;
        this._pointerEl?.remove();
        this._pointerEl = null;
    }
    next() {
        if (!this.canNext)
            return false;
        this._step++;
        this._applyStep(this._step, false);
        this.emit("step-change");
        if (!this.canNext)
            this.emit("animation-end");
        return true;
    }
    prev() {
        if (!this.canPrev)
            return false;
        this._step--;
        this._clearAll();
        for (let i = 0; i <= this._step; i++)
            this._applyStep(i, true);
        this.emit("step-change");
        return true;
    }
    async play(msPerStep = 900) {
        this.emit("animation-start");
        while (this.canNext) {
            const nextStep = this.steps[this._step + 1];
            this.next();
            // Wait for timer AND speech to finish (whichever is longer)
            await Promise.all([
                new Promise((r) => setTimeout(r, this._playbackWaitMs(nextStep, msPerStep))),
                this._speechDone ?? Promise.resolve(),
            ]);
        }
    }
    goTo(index) {
        index = Math.max(-1, Math.min(this.steps.length - 1, index));
        if (index === this._step)
            return;
        if (index < this._step) {
            this._step = -1;
            this._clearAll();
        }
        while (this._step < index) {
            this._step++;
            this._applyStep(this._step, true);
        }
        this.emit("step-change");
    }
    _clearTimerBucket(bucket) {
        bucket.forEach((id) => window.clearTimeout(id));
        bucket.clear();
    }
    _clearPendingStepTimers() {
        this._clearTimerBucket(this._pendingStepTimers);
    }
    _cancelNarrationTyping() {
        this._narrationRunId += 1;
        this._clearTimerBucket(this._pendingNarrationTimers);
    }
    _scheduleTimer(fn, delayMs, bucket = this._pendingStepTimers) {
        if (delayMs <= 0) {
            fn();
            return;
        }
        const id = window.setTimeout(() => {
            bucket.delete(id);
            fn();
        }, delayMs);
        bucket.add(id);
    }
    _scheduleStep(fn, delayMs) {
        this._scheduleTimer(fn, delayMs, this._pendingStepTimers);
    }
    _stepWaitMs(step, fallbackMs) {
        const delay = Math.max(0, step.delay ?? 0);
        const duration = Math.max(0, step.duration ?? 0);
        // Compute minimum time the step actually needs to finish
        let minNeeded = 0;
        if (step.action === "narrate") {
            const text = step.value ?? "";
            // Typing effect: chars × typeMs + fade buffer
            const typingMs = text.length * ANIMATION.narrationTypeMs + ANIMATION.narrationFadeMs;
            // TTS estimate: ~150ms per word + 500ms buffer for engine latency
            const wordCount = text.split(/\s+/).filter(Boolean).length;
            const ttsMs = this._tts ? wordCount * 150 + 500 : 0;
            minNeeded = Math.max(typingMs, ttsMs);
        }
        else if (step.action === "circle" || step.action === "underline" ||
            step.action === "crossout" || step.action === "bracket" ||
            step.action === "tick" || step.action === "strikeoff") {
            // Annotation guide draw + rough reveal + pointer fade
            minNeeded = ANIMATION.annotationStrokeDur + 120 + 200;
        }
        else if (step.action === "draw") {
            minNeeded = ANIMATION.nodeStrokeDur + ANIMATION.textRevealMs + 80;
        }
        let wait = delay + Math.max(fallbackMs, duration, minNeeded);
        if (step.pace === "slow")
            wait *= ANIMATION.paceSlowMul;
        else if (step.pace === "fast")
            wait *= ANIMATION.paceFastMul;
        else if (step.pace === "pause")
            wait += ANIMATION.pauseHoldMs;
        return wait;
    }
    _playbackWaitMs(step, fallbackMs) {
        if (!step)
            return fallbackMs;
        if (step.kind === "beat") {
            return Math.max(fallbackMs, ...step.children.map((c) => this._stepWaitMs(c, fallbackMs)));
        }
        return this._stepWaitMs(step, fallbackMs);
    }
    _clearAll() {
        this._clearPendingStepTimers();
        this._cancelNarrationTyping();
        this._cancelSpeech();
        this._transforms.clear();
        // Nodes
        this.svg.querySelectorAll(".ng").forEach((el) => {
            el.style.transform = el.dataset.baseTransform ?? "";
            el.style.transition = "";
            el.classList.remove("hl", "faded", "hidden");
            el.style.opacity = el.style.filter = "";
            if (this.drawTargetNodes.has(el.id)) {
                hideDrawEl(el);
                prepareNodeForDraw(el);
            }
            else {
                clearNodeDrawStyles(el);
            }
        });
        // Groups — hide draw-target groups, show the rest
        this.svg.querySelectorAll(".gg").forEach((el) => {
            clearDrawStyles(el);
            el.style.transition = "none";
            if (this.drawTargetGroups.has(el.id)) {
                el.style.opacity = "";
                el.classList.add("gg-hidden");
            }
            else {
                el.style.opacity = "";
                el.classList.remove("gg-hidden");
                requestAnimationFrame(() => {
                    el.style.transition = "";
                });
            }
        });
        // Edges
        this.svg.querySelectorAll(".eg").forEach((el) => {
            clearEdgeDrawStyles(el);
            el.style.transition = "none";
            el.style.opacity = "";
            if (this.drawTargetEdges.has(el.id)) {
                prepareEdgeForDraw(el);
            }
            else {
                requestAnimationFrame(() => {
                    el.style.transition = "";
                });
            }
        });
        // Tables
        this.svg.querySelectorAll(".tg").forEach((el) => {
            clearDrawStyles(el);
            el.style.transition = "none";
            if (this.drawTargetTables.has(el.id)) {
                el.classList.add("gg-hidden");
            }
            else {
                el.classList.remove("gg-hidden");
                requestAnimationFrame(() => {
                    el.style.transition = "";
                });
            }
        });
        // Notes
        this.svg.querySelectorAll(".ntg").forEach((el) => {
            clearDrawStyles(el);
            el.style.transition = "none";
            if (this.drawTargetNotes.has(el.id)) {
                el.classList.add("gg-hidden");
            }
            else {
                el.classList.remove("gg-hidden");
                requestAnimationFrame(() => {
                    el.style.transition = "";
                });
            }
        });
        // Charts
        this.svg.querySelectorAll(".cg").forEach((el) => {
            clearDrawStyles(el);
            el.style.transition = "none";
            el.style.opacity = "";
            if (this.drawTargetCharts.has(el.id)) {
                el.classList.add("gg-hidden");
            }
            else {
                el.classList.remove("gg-hidden");
                requestAnimationFrame(() => {
                    el.style.transition = "";
                });
            }
        });
        // Markdown
        this.svg.querySelectorAll(".mdg").forEach((el) => {
            clearDrawStyles(el);
            el.style.transition = "none";
            el.style.opacity = "";
            if (this.drawTargetMarkdowns.has(el.id)) {
                el.classList.add("gg-hidden");
            }
            else {
                el.classList.remove("gg-hidden");
                requestAnimationFrame(() => {
                    el.style.transition = "";
                });
            }
        });
        this.svg
            .querySelectorAll(".tg, .ntg, .cg, .mdg")
            .forEach((el) => {
            el.style.transform = "";
            el.style.transition = "";
            el.style.opacity = "";
            el.classList.remove("hl", "faded");
        });
        for (const groupElId of this.drawTargetGroups) {
            this._hideGroupDescendants(groupElId);
        }
        // Clear narration caption
        if (this._captionEl) {
            this._captionEl.style.opacity = "0";
            if (this._captionTextEl)
                this._captionTextEl.textContent = "";
        }
        // Clear annotations
        this._annotations.forEach((a) => a.remove());
        this._annotations = [];
        // Clear pointer
        if (this._pointerEl) {
            this._pointerEl.setAttribute("opacity", "0");
            this._pointerEl.style.transition = "none";
        }
    }
    _applyStep(i, silent) {
        const item = this.steps[i];
        if (!item)
            return;
        if (silent) {
            this._runStepItem(item, true);
            return;
        }
        if (item.kind === "beat") {
            for (const child of item.children) {
                const run = () => this._runStep(child, false);
                this._scheduleStep(run, Math.max(0, child.delay ?? 0));
            }
        }
        else {
            let delayMs = Math.max(0, item.delay ?? 0);
            if (item.pace === "slow")
                delayMs *= ANIMATION.paceSlowMul;
            else if (item.pace === "fast")
                delayMs *= ANIMATION.paceFastMul;
            this._scheduleStep(() => this._runStep(item, false), delayMs);
        }
    }
    _runStepItem(item, silent) {
        if (item.kind === "beat") {
            for (const child of item.children)
                this._runStep(child, silent);
        }
        else {
            this._runStep(item, silent);
        }
    }
    _runStep(s, silent) {
        switch (s.action) {
            case "highlight":
                this._doHighlight(s.target);
                break;
            case "fade":
                this._doFade(s.target, true);
                break;
            case "unfade":
                this._doFade(s.target, false);
                break;
            case "draw":
                this._doDraw(s, silent);
                break;
            case "erase":
                this._doErase(s.target, silent, s.duration);
                break;
            case "show":
                this._doShowHide(s.target, true, silent, s.duration);
                break;
            case "hide":
                this._doShowHide(s.target, false, silent, s.duration);
                break;
            case "pulse":
                if (!silent)
                    this._doPulse(s.target, s.duration);
                break;
            case "color":
                this._doColor(s.target, s.value);
                break;
            case "move":
                this._doMove(s.target, s, silent);
                break;
            case "scale":
                this._doScale(s.target, s, silent);
                break;
            case "rotate":
                this._doRotate(s.target, s, silent);
                break;
            case "narrate":
                this._doNarrate(s.value ?? "", silent);
                break;
            case "circle":
                this._doAnnotationCircle(s.target, silent);
                break;
            case "underline":
                this._doAnnotationUnderline(s.target, silent);
                break;
            case "crossout":
                this._doAnnotationCrossout(s.target, silent);
                break;
            case "bracket":
                this._doAnnotationBracket(s.target, s.target2 ?? "", silent);
                break;
            case "tick":
                this._doAnnotationTick(s.target, silent);
                break;
            case "strikeoff":
                this._doAnnotationStrikeoff(s.target, silent);
                break;
        }
    }
    // ── highlight ────────────────────────────────────────────
    _doHighlight(target) {
        this.svg
            .querySelectorAll(".ng.hl, .gg.hl, .tg.hl, .ntg.hl, .cg.hl, .mdg.hl, .eg.hl")
            .forEach((e) => e.classList.remove("hl"));
        for (const el of this._resolveCascadeTargets(target)) {
            el.classList.add("hl");
        }
    }
    // ── fade / unfade ─────────────────────────────────────────
    _doFade(target, doFade) {
        for (const el of this._resolveCascadeTargets(target)) {
            el.classList.toggle("faded", doFade);
        }
    }
    _writeTransform(el, target, silent, duration = 420) {
        const t = this._transforms.get(target) ?? {
            tx: 0,
            ty: 0,
            scale: 1,
            rotate: 0,
        };
        const parts = [];
        if (t.tx !== 0 || t.ty !== 0)
            parts.push(`translate(${t.tx}px,${t.ty}px)`);
        if (t.rotate !== 0)
            parts.push(`rotate(${t.rotate}deg)`);
        if (t.scale !== 1)
            parts.push(`scale(${t.scale})`);
        el.style.transition = silent
            ? "none"
            : `transform ${duration}ms cubic-bezier(.4,0,.2,1)`;
        const base = el.dataset.baseTransform ?? "";
        const anim = parts.join(" ");
        el.style.transform = anim ? `${anim} ${base}`.trim() : base;
        if (silent) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.transition = "";
            }));
        }
    }
    // ── move ──────────────────────────────────────────────────
    _doMove(target, step, silent) {
        const targets = this._resolveCascadeTargets(target);
        if (!targets.length)
            return;
        const cur = this._transforms.get(target) ?? {
            tx: 0,
            ty: 0,
            scale: 1,
            rotate: 0,
        };
        this._transforms.set(target, {
            ...cur,
            tx: cur.tx + (step.dx ?? 0),
            ty: cur.ty + (step.dy ?? 0),
        });
        for (const el of targets) {
            this._writeTransform(el, target, silent, step.duration ?? 420);
        }
    }
    // ── scale ─────────────────────────────────────────────────
    _doScale(target, step, silent) {
        const targets = this._resolveCascadeTargets(target);
        if (!targets.length)
            return;
        const cur = this._transforms.get(target) ?? {
            tx: 0,
            ty: 0,
            scale: 1,
            rotate: 0,
        };
        this._transforms.set(target, { ...cur, scale: step.factor ?? 1 });
        for (const el of targets) {
            this._writeTransform(el, target, silent, step.duration ?? 350);
        }
    }
    // ── rotate ────────────────────────────────────────────────
    _doRotate(target, step, silent) {
        const targets = this._resolveCascadeTargets(target);
        if (!targets.length)
            return;
        const cur = this._transforms.get(target) ?? {
            tx: 0,
            ty: 0,
            scale: 1,
            rotate: 0,
        };
        this._transforms.set(target, {
            ...cur,
            rotate: cur.rotate + (step.deg ?? 0),
        });
        for (const el of targets) {
            this._writeTransform(el, target, silent, step.duration ?? 400);
        }
    }
    _doDraw(step, silent) {
        const { target } = step;
        const edge = parseEdgeTarget(target);
        if (edge) {
            // ── Edge draw ──────────────────────────────────────
            const el = getEdgeEl(this.svg, edge.from, edge.to);
            if (!el)
                return;
            if (silent) {
                revealEdgeInstant(el);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    clearEdgeDrawStyles(el);
                }));
            }
            else {
                animateEdgeDraw(el, edge.conn, step.duration ?? ANIMATION.strokeDur);
            }
            return;
        }
        // Check if target is a group (has #group-{target} element)
        const groupEl = getGroupEl(this.svg, target);
        if (groupEl) {
            showDrawEl(groupEl);
            this._revealGroupSubtree(groupEl.id, this._step);
            // ── Group draw ──────────────────────────────────────
            if (silent) {
                clearDrawStyles(groupEl);
                groupEl.style.transition = "none";
                groupEl.style.opacity = "1";
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    groupEl.style.transition = "";
                    clearDrawStyles(groupEl);
                }));
            }
            else {
                // Groups use slightly longer stroke-draw (bigger box, dashed border = more paths)
                const firstPath = groupEl.querySelector("path");
                if (!firstPath?.style.strokeDasharray)
                    prepareForDraw(groupEl);
                const groupStrokeDur = step.duration ?? ANIMATION.groupStrokeDur;
                animateShapeDraw(groupEl, groupStrokeDur, ANIMATION.groupStagger);
                const pathCount = groupEl.querySelectorAll('path').length;
                const totalMs = pathCount * ANIMATION.groupStagger + groupStrokeDur + 120;
                clearDashOverridesAfter(groupEl, totalMs);
            }
            return;
        }
        // ── Table ──────────────────────────────────────────────
        const tableEl = getEl(this.svg, `table-${target}`);
        if (tableEl) {
            if (silent) {
                clearDrawStyles(tableEl);
                tableEl.style.transition = "none";
                tableEl.classList.remove("gg-hidden");
                tableEl.style.opacity = "1";
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    tableEl.style.transition = "";
                    clearDrawStyles(tableEl);
                }));
            }
            else {
                tableEl.classList.remove("gg-hidden");
                prepareForDraw(tableEl);
                const tableStrokeDur = step.duration ?? ANIMATION.tableStrokeDur;
                animateShapeDraw(tableEl, tableStrokeDur, ANIMATION.tableStagger);
                const tablePathCount = tableEl.querySelectorAll('path').length;
                clearDashOverridesAfter(tableEl, tablePathCount * ANIMATION.tableStagger + tableStrokeDur + 120);
            }
            return;
        }
        // ── Note ───────────────────────────────────────────────
        const noteEl = getEl(this.svg, `note-${target}`);
        if (noteEl) {
            if (silent) {
                clearDrawStyles(noteEl);
                noteEl.style.transition = "none";
                noteEl.classList.remove("gg-hidden");
                noteEl.style.opacity = "1";
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    noteEl.style.transition = "";
                    clearDrawStyles(noteEl);
                }));
            }
            else {
                noteEl.classList.remove("gg-hidden");
                prepareForDraw(noteEl);
                const noteStrokeDur = step.duration ?? ANIMATION.nodeStrokeDur;
                animateShapeDraw(noteEl, noteStrokeDur, ANIMATION.nodeStagger);
                const notePathCount = noteEl.querySelectorAll('path').length;
                clearDashOverridesAfter(noteEl, notePathCount * ANIMATION.nodeStagger + noteStrokeDur + 120);
            }
            return;
        }
        // ── Chart ──────────────────────────────────────────────
        const chartEl = getEl(this.svg, `chart-${target}`);
        if (chartEl) {
            if (silent) {
                clearDrawStyles(chartEl);
                chartEl.style.transition = "none";
                chartEl.style.opacity = "";
                chartEl.classList.remove("gg-hidden");
                chartEl.style.opacity = "1";
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    chartEl.style.transition = "";
                    clearDrawStyles(chartEl);
                }));
            }
            else {
                chartEl.style.opacity = "0"; // start from 0 explicitly
                chartEl.classList.remove("gg-hidden");
                const chartFade = step.duration ?? ANIMATION.chartFade;
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    chartEl.style.transition = `opacity ${chartFade}ms ease`;
                    chartEl.style.opacity = "1";
                }));
            }
            return;
        }
        // ── Markdown ──────────────────────────────────────────
        const markdownEl = getMarkdownEl(this.svg, target);
        if (markdownEl) {
            if (silent) {
                markdownEl.style.transition = "none";
                markdownEl.style.opacity = "";
                markdownEl.classList.remove("gg-hidden");
                markdownEl.style.opacity = "1";
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    markdownEl.style.transition = "";
                }));
            }
            else {
                markdownEl.style.opacity = "0";
                markdownEl.classList.remove("gg-hidden");
                const markdownFade = step.duration ?? ANIMATION.chartFade;
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    markdownEl.style.transition = `opacity ${markdownFade}ms ease`;
                    markdownEl.style.opacity = "1";
                }));
            }
            return;
        }
        // ── Node draw ──────────────────────────────────────
        const nodeEls = this._resolveCascadeTargets(target).filter((el) => el.classList.contains("ng"));
        if (!nodeEls.length)
            return;
        for (const nodeEl of nodeEls) {
            showDrawEl(nodeEl);
            if (silent) {
                revealNodeInstant(nodeEl);
            }
            else {
                if (!nodeGuidePathEl(nodeEl) && !nodeEl.querySelector("path")?.style.strokeDasharray) {
                    prepareNodeForDraw(nodeEl);
                }
                animateNodeDraw(nodeEl, step.duration ?? ANIMATION.nodeStrokeDur, step.duration ?? ANIMATION.textRevealMs);
            }
        }
    }
    // ── erase ─────────────────────────────────────────────────
    _doErase(target, silent, duration = 400) {
        for (const el of this._resolveCascadeTargets(target)) {
            el.style.transition = silent ? "none" : `opacity ${duration}ms`;
            el.style.opacity = "0";
        }
    }
    // ── show / hide ───────────────────────────────────────────
    _doShowHide(target, show, silent, duration = 400) {
        for (const el of this._resolveCascadeTargets(target)) {
            if (show)
                showDrawEl(el);
            el.style.transition = silent ? "none" : `opacity ${duration}ms`;
            el.style.opacity = show ? "1" : "0";
        }
    }
    // ── pulse ─────────────────────────────────────────────────
    _doPulse(target, duration = 500) {
        for (const el of this._resolveCascadeTargets(target)) {
            el.animate([
                { filter: "brightness(1)" },
                { filter: "brightness(1.6)" },
                { filter: "brightness(1)" },
            ], { duration, iterations: 3 });
        }
    }
    // ── color ─────────────────────────────────────────────────
    _doColor(target, color) {
        if (!color)
            return;
        const applyTextColor = (root) => {
            root.querySelectorAll("text").forEach((t) => {
                t.style.fill = color;
                const existingStyle = t.getAttribute("style") ?? "";
                const nextStyle = `${existingStyle.replace(/(?:^|;)\s*fill\s*:[^;]*/g, "").trim().replace(/;?$/, ";")}fill:${color};`;
                t.setAttribute("style", nextStyle);
                t.setAttribute("fill", color);
            });
        };
        for (const el of this._resolveCascadeTargets(target)) {
            if (parseEdgeTarget(target)) {
                el.querySelectorAll("path, line, polyline").forEach((p) => {
                    p.style.stroke = color;
                });
                el.querySelectorAll("polygon").forEach((p) => {
                    p.style.fill = color;
                    p.style.stroke = color;
                });
                continue;
            }
            let hit = false;
            el.querySelectorAll("path, rect, ellipse, polygon").forEach((c) => {
                const attrFill = c.getAttribute("fill");
                if (attrFill === "none")
                    return;
                if (attrFill === null && c.tagName === "path")
                    return;
                c.style.fill = color;
                hit = true;
            });
            if (!hit) {
                applyTextColor(el);
            }
        }
        this.svg.querySelectorAll(`${POSITIONABLE_SELECTOR}[data-animation-parent]`).forEach((el) => {
            if (el.dataset.animationParent === target) {
                applyTextColor(el);
            }
        });
    }
    // ── narration ───────────────────────────────────────────
    _initCaption() {
        // Remove any leftover caption from a previous instance
        document.querySelector('.skm-caption')?.remove();
        const cap = document.createElement("div");
        cap.className = "skm-caption";
        cap.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      z-index: 9999; max-width: 600px; width: max-content;
      padding: 10px 24px; box-sizing: border-box;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 15px; line-height: 1.5;
      color: #fde68a; background: #1a1208;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.35);
      opacity: 0; transition: opacity ${ANIMATION.narrationFadeMs}ms ease;
      pointer-events: none; user-select: none;
      text-align: center;
    `;
        const span = document.createElement("span");
        cap.appendChild(span);
        document.body.appendChild(cap);
        this._captionEl = cap;
        this._captionTextEl = span;
    }
    _doNarrate(text, silent) {
        if (!this._captionEl || !this._captionTextEl)
            return;
        this._cancelNarrationTyping();
        this._captionEl.style.opacity = "1";
        if (silent || !text) {
            this._captionTextEl.textContent = text;
            return;
        }
        // Fire TTS as full sentence — play() waits for _speechDone
        if (this._tts && text)
            this._speak(text);
        // Typing effect
        this._captionTextEl.textContent = "";
        const narrationRunId = this._narrationRunId;
        let charIdx = 0;
        const typeNext = () => {
            if (this._narrationRunId !== narrationRunId || !this._captionTextEl)
                return;
            if (charIdx < text.length) {
                this._captionTextEl.textContent += text[charIdx++];
                if (charIdx < text.length) {
                    this._scheduleTimer(typeNext, ANIMATION.narrationTypeMs, this._pendingNarrationTimers);
                }
            }
        };
        typeNext();
    }
    _speak(text) {
        if (typeof speechSynthesis === "undefined")
            return;
        this._cancelSpeech();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 0.95;
        utter.pitch = 1;
        utter.lang = "en-US";
        // Track when speech actually finishes
        this._speechDone = new Promise((resolve) => {
            utter.onend = () => resolve();
            utter.onerror = () => resolve();
        });
        speechSynthesis.speak(utter);
    }
    _cancelSpeech() {
        if (typeof speechSynthesis !== "undefined")
            speechSynthesis.cancel();
        this._speechDone = null;
    }
    /** Pre-warm the speech engine with a silent utterance to eliminate cold-start delay */
    _warmUpSpeech() {
        if (typeof speechSynthesis === "undefined")
            return;
        const warm = new SpeechSynthesisUtterance("");
        warm.volume = 0;
        speechSynthesis.speak(warm);
    }
    // ── annotations ─────────────────────────────────────────
    _nodeMetrics(el) {
        const x = parseFloat(el.dataset.x ?? "");
        const y = parseFloat(el.dataset.y ?? "");
        const w = parseFloat(el.dataset.w ?? "");
        const h = parseFloat(el.dataset.h ?? "");
        if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h))
            return null;
        return { x, y, w, h };
    }
    /**
     * Animate an annotation using the same guide-path approach as node draw:
     * 1. Hide the rough.js element (opacity=0)
     * 2. Create a clean single guide path and animate it with stroke-dashoffset
     * 3. Pointer follows the guide path
     * 4. After guide finishes → fade in rough.js element, remove guide
     */
    _animateAnnotation(roughEl, guideD, silent) {
        if (silent)
            return;
        // Hide rough.js element — will be revealed after guide draws
        roughEl.style.opacity = "0";
        roughEl.style.transition = "none";
        // Create a clean guide path
        const guide = document.createElementNS(SVG_NS$1, "path");
        guide.setAttribute("d", guideD);
        guide.setAttribute("fill", "none");
        guide.setAttribute("stroke", ANIMATION.annotationColor);
        guide.setAttribute("stroke-width", String(ANIMATION.annotationStrokeW));
        guide.setAttribute("stroke-linecap", "round");
        guide.setAttribute("stroke-linejoin", "round");
        guide.style.pointerEvents = "none";
        this._annotationLayer.appendChild(guide);
        const len = pathLength(guide);
        guide.style.strokeDasharray = `${len}`;
        guide.style.strokeDashoffset = `${len}`;
        guide.style.transition = "none";
        // Pre-position pointer at the start of the guide
        const hasPointer = !!this._pointerEl;
        if (hasPointer) {
            try {
                const startPt = guide.getPointAtLength(0);
                this._pointerEl.setAttribute("transform", `translate(${startPt.x},${startPt.y})`);
            }
            catch { /* ignore */ }
            this._pointerEl.setAttribute("opacity", "1");
            this._pointerEl.style.transition = "none";
        }
        const dur = ANIMATION.annotationStrokeDur;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            // Animate guide stroke-dashoffset
            guide.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(.4,0,.2,1)`;
            guide.style.strokeDashoffset = "0";
            // Animate pointer along guide path
            if (hasPointer) {
                const startTime = performance.now();
                const pointerRef = this._pointerEl;
                const animate = () => {
                    const elapsed = performance.now() - startTime;
                    const t = Math.min(elapsed / dur, 1);
                    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                    try {
                        const pt = guide.getPointAtLength(eased * len);
                        pointerRef.setAttribute("transform", `translate(${pt.x},${pt.y})`);
                    }
                    catch { /* ignore */ }
                    if (t < 1) {
                        requestAnimationFrame(animate);
                    }
                    else {
                        pointerRef.style.transition = `opacity 200ms ease`;
                        pointerRef.setAttribute("opacity", "0");
                    }
                };
                requestAnimationFrame(animate);
            }
            // After guide finishes: reveal rough.js element, remove guide
            this._scheduleTimer(() => {
                roughEl.style.transition = `opacity 120ms ease`;
                roughEl.style.opacity = "1";
                guide.remove();
            }, dur + 30);
        }));
    }
    _doAnnotationCircle(target, silent) {
        const el = resolveEl(this.svg, target);
        if (!el || !this._rc || !this._annotationLayer)
            return;
        const m = this._nodeMetrics(el);
        if (!m)
            return;
        const cx = m.x + m.w / 2, cy = m.y + m.h / 2;
        const rx = m.w * 0.65, ry = m.h * 0.65;
        const roughEl = this._rc.ellipse(cx, cy, rx * 2, ry * 2, {
            roughness: 2.0, stroke: ANIMATION.annotationColor,
            strokeWidth: ANIMATION.annotationStrokeW, fill: "none",
            seed: Date.now(),
        });
        this._annotationLayer.appendChild(roughEl);
        this._annotations.push(roughEl);
        // Clean guide path for draw-in animation
        const guideD = ellipsePath(cx, cy, rx, ry);
        this._animateAnnotation(roughEl, guideD, silent);
    }
    _doAnnotationUnderline(target, silent) {
        const el = resolveEl(this.svg, target);
        if (!el || !this._rc || !this._annotationLayer)
            return;
        const m = this._nodeMetrics(el);
        if (!m)
            return;
        const lineY = m.y + m.h + 4;
        const roughEl = this._rc.line(m.x, lineY, m.x + m.w, lineY, {
            roughness: 1.5, stroke: ANIMATION.annotationColor,
            strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now(),
        });
        this._annotationLayer.appendChild(roughEl);
        this._annotations.push(roughEl);
        // Clean guide path
        const guideD = `M ${m.x} ${lineY} L ${m.x + m.w} ${lineY}`;
        this._animateAnnotation(roughEl, guideD, silent);
    }
    _doAnnotationCrossout(target, silent) {
        const el = resolveEl(this.svg, target);
        if (!el || !this._rc || !this._annotationLayer)
            return;
        const m = this._nodeMetrics(el);
        if (!m)
            return;
        const pad = 4;
        const roughG = document.createElementNS(SVG_NS$1, "g");
        const line1 = this._rc.line(m.x - pad, m.y - pad, m.x + m.w + pad, m.y + m.h + pad, {
            roughness: 1.5, stroke: ANIMATION.annotationColor,
            strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now(),
        });
        const line2 = this._rc.line(m.x + m.w + pad, m.y - pad, m.x - pad, m.y + m.h + pad, {
            roughness: 1.5, stroke: ANIMATION.annotationColor,
            strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now() + 1,
        });
        roughG.appendChild(line1);
        roughG.appendChild(line2);
        this._annotationLayer.appendChild(roughG);
        this._annotations.push(roughG);
        // Clean guide: two diagonal lines in a single path (pointer draws both)
        const guideD = `M ${m.x - pad} ${m.y - pad} L ${m.x + m.w + pad} ${m.y + m.h + pad} ` +
            `M ${m.x + m.w + pad} ${m.y - pad} L ${m.x - pad} ${m.y + m.h + pad}`;
        this._animateAnnotation(roughG, guideD, silent);
    }
    _doAnnotationTick(target, silent) {
        const el = resolveEl(this.svg, target);
        if (!el || !this._rc || !this._annotationLayer)
            return;
        const m = this._nodeMetrics(el);
        if (!m)
            return;
        // Tick mark on the left side of the node, like a teacher's check mark (✓)
        // The tick sits just to the left of the node, vertically centered
        const tickH = m.h * 0.5; // total tick height
        const tickW = tickH * 0.7; // total tick width
        const gap = 8; // gap between tick and node
        // Key points of the tick: start (top-left), valley (bottom), end (top-right)
        const endX = m.x - gap; // tip of the long upstroke (closest to node)
        const endY = m.y + m.h * 0.25; // top of the long stroke
        const valleyX = endX - tickW * 0.4; // bottom of the V
        const valleyY = m.y + m.h * 0.75; // bottom of the V
        const startX = valleyX - tickW * 0.3; // top of the short downstroke
        const startY = valleyY - tickH * 0.3; // slightly above valley
        const roughG = document.createElementNS(SVG_NS$1, "g");
        // Short down-stroke
        const line1 = this._rc.line(startX, startY, valleyX, valleyY, {
            roughness: 1.5, stroke: ANIMATION.annotationColor,
            strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now(),
        });
        // Long up-stroke
        const line2 = this._rc.line(valleyX, valleyY, endX, endY, {
            roughness: 1.5, stroke: ANIMATION.annotationColor,
            strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now() + 1,
        });
        roughG.appendChild(line1);
        roughG.appendChild(line2);
        this._annotationLayer.appendChild(roughG);
        this._annotations.push(roughG);
        // Guide path: short stroke down then long stroke up (single continuous path)
        const guideD = `M ${startX} ${startY} L ${valleyX} ${valleyY} L ${endX} ${endY}`;
        this._animateAnnotation(roughG, guideD, silent);
    }
    _doAnnotationStrikeoff(target, silent) {
        const el = resolveEl(this.svg, target);
        if (!el || !this._rc || !this._annotationLayer)
            return;
        const m = this._nodeMetrics(el);
        if (!m)
            return;
        const pad = 6;
        const lineY = m.y + m.h / 2;
        const roughEl = this._rc.line(m.x - pad, lineY, m.x + m.w + pad, lineY, {
            roughness: 1.5, stroke: ANIMATION.annotationColor,
            strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now(),
        });
        this._annotationLayer.appendChild(roughEl);
        this._annotations.push(roughEl);
        const guideD = `M ${m.x - pad} ${lineY} L ${m.x + m.w + pad} ${lineY}`;
        this._animateAnnotation(roughEl, guideD, silent);
    }
    _doAnnotationBracket(target1, target2, silent) {
        const el1 = resolveEl(this.svg, target1);
        const el2 = resolveEl(this.svg, target2);
        if (!el1 || !el2 || !this._rc || !this._annotationLayer)
            return;
        const m1 = this._nodeMetrics(el1);
        const m2 = this._nodeMetrics(el2);
        if (!m1 || !m2)
            return;
        // Bracket on the right side spanning both elements
        const rightX = Math.max(m1.x + m1.w, m2.x + m2.w) + 12;
        const topY = Math.min(m1.y, m2.y);
        const botY = Math.max(m1.y + m1.h, m2.y + m2.h);
        const midY = (topY + botY) / 2;
        const bulge = 16;
        // Draw a curly brace using path
        const guideD = `M ${rightX} ${topY} Q ${rightX + bulge} ${topY} ${rightX + bulge} ${midY - 4} ` +
            `L ${rightX + bulge} ${midY} L ${rightX + bulge * 1.5} ${midY} ` +
            `M ${rightX + bulge} ${midY} L ${rightX + bulge} ${midY + 4} ` +
            `Q ${rightX + bulge} ${botY} ${rightX} ${botY}`;
        const roughEl = this._rc.path(guideD, {
            roughness: 1.2, stroke: ANIMATION.annotationColor,
            strokeWidth: ANIMATION.annotationStrokeW, fill: "none",
            seed: Date.now(),
        });
        this._annotationLayer.appendChild(roughEl);
        this._annotations.push(roughEl);
        this._animateAnnotation(roughEl, guideD, silent);
    }
    // ── pointer ─────────────────────────────────────────────
    _initPointer() {
        if (this._pointerType === "dot") {
            const circle = document.createElementNS(SVG_NS$1, "circle");
            circle.setAttribute("r", String(ANIMATION.pointerSize));
            circle.setAttribute("fill", ANIMATION.annotationColor);
            circle.setAttribute("opacity", "0");
            circle.style.pointerEvents = "none";
            this.svg.appendChild(circle);
            this._pointerEl = circle;
        }
        else if (this._pointerType === "chalk") {
            const g = document.createElementNS(SVG_NS$1, "g");
            const circle = document.createElementNS(SVG_NS$1, "circle");
            circle.setAttribute("r", "5");
            circle.setAttribute("fill", "#fff");
            circle.setAttribute("stroke", "#1a1208");
            circle.setAttribute("stroke-width", "1.5");
            g.appendChild(circle);
            g.setAttribute("opacity", "0");
            g.style.pointerEvents = "none";
            this.svg.appendChild(g);
            this._pointerEl = g;
        }
        else if (this._pointerType === "hand") {
            const g = document.createElementNS(SVG_NS$1, "g");
            const path = document.createElementNS(SVG_NS$1, "path");
            path.setAttribute("d", "M5,0 L5,12 L8,9 L11,16 L13,15 L10,8 L14,8 Z");
            path.setAttribute("fill", "#1a1208");
            g.appendChild(path);
            g.setAttribute("opacity", "0");
            g.style.pointerEvents = "none";
            this.svg.appendChild(g);
            this._pointerEl = g;
        }
    }
}
const ANIMATION_CSS = `
.ng, .gg, .tg, .ntg, .cg, .eg, .mdg {
  transform-box: fill-box;
  transform-origin: center;
  transition: filter 0.3s, opacity 0.35s;
}

/* highlight */
.ng.hl path, .ng.hl rect, .ng.hl ellipse, .ng.hl polygon,
.tg.hl path, .tg.hl rect,
.ntg.hl path, .ntg.hl polygon,
.cg.hl path, .cg.hl rect,
.mdg.hl text,
.eg.hl path, .eg.hl line, .eg.hl polygon { stroke-width: 2.8 !important; }

.ng.hl, .tg.hl, .ntg.hl, .cg.hl, .mdg.hl, .eg.hl {
  animation: ng-pulse 1.4s ease-in-out infinite;
}
@keyframes ng-pulse {
  0%, 100% { filter: drop-shadow(0 0 7px rgba(200,84,40,.6)); }
  50%       { filter: drop-shadow(0 0 14px rgba(200,84,40,.9)); }
}

/* fade */
.ng.faded, .gg.faded, .tg.faded, .ntg.faded,
.cg.faded, .eg.faded, .mdg.faded { opacity: 0.22; }

.ng.hidden { opacity: 0; pointer-events: none; }
.gg.gg-hidden  { opacity: 0; }
.tg.gg-hidden  { opacity: 0; }
.ntg.gg-hidden { opacity: 0; }
.cg.gg-hidden  { opacity: 0; }
.mdg.gg-hidden { opacity: 0; }

/* narration caption */
.skm-caption { pointer-events: none; user-select: none; }
`;

// ============================================================
// sketchmark — Export System
// SVG, PNG, Canvas, GIF (stub), MP4 (stub)
// ============================================================
// ── Trigger browser download ──────────────────────────────
function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), EXPORT.revokeDelay);
}
// ── SVG export ────────────────────────────────────────────
function exportSVG(svg, opts = {}) {
    const str = svgToString(svg);
    const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
    download(blob, opts.filename ?? 'diagram.svg');
}
function getSVGString(svg) {
    return svgToString(svg);
}
function getSVGBlob(svg) {
    return new Blob([svgToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
}
// ── PNG export (from SVG via Canvas) ─────────────────────
async function exportPNG(svg, opts = {}) {
    const dataUrl = await svgToPNGDataURL(svg, opts);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    download(blob, opts.filename ?? 'diagram.png');
}
async function svgToPNGDataURL(svg, opts = {}) {
    const scale = opts.scale ?? EXPORT.pngScale;
    const w = parseFloat(svg.getAttribute('width') ?? String(EXPORT.fallbackW));
    const h = parseFloat(svg.getAttribute('height') ?? String(EXPORT.fallbackH));
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    if (opts.background) {
        ctx.fillStyle = opts.background;
        ctx.fillRect(0, 0, w, h);
    }
    else {
        ctx.fillStyle = EXPORT.fallbackBg;
        ctx.fillRect(0, 0, w, h);
    }
    const svgStr = svgToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); resolve(); };
        img.onerror = reject;
        img.src = url;
    });
    return canvas.toDataURL('image/png');
}
// ── Canvas PNG export ─────────────────────────────────────
async function exportCanvasPNG(canvas, opts = {}) {
    const blob = await canvasToPNGBlob(canvas);
    download(blob, opts.filename ?? 'diagram.png');
}
// ── HTML export (self-contained) ──────────────────────────
function exportHTML(svg, dslSource, opts = {}) {
    const svgStr = svgToString(svg);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>sketchmark export</title>
  <style>
    body { margin: 0; background: ${EXPORT.fallbackBg}; display: flex; flex-direction: column; align-items: center; padding: 2rem; font-family: system-ui, sans-serif; }
    .diagram { max-width: 100%; }
    .dsl { margin-top: 2rem; background: #131008; color: #e0c898; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 13px; line-height: 1.7; white-space: pre; max-width: 800px; width: 100%; overflow: auto; }
  </style>
</head>
<body>
  <div class="diagram">${svgStr}</div>
  <details class="dsl"><summary style="cursor:pointer;color:#f0c96a">DSL source</summary><pre>${escapeHtml$1(dslSource)}</pre></details>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    download(blob, opts.filename ?? 'diagram.html');
}
function escapeHtml$1(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// ── GIF stub (requires gifshot or gif.js at runtime) ──────
async function exportGIF(frames, opts = {}) {
    // gifshot integration point
    throw new Error('GIF export requires gifshot to be loaded. See docs/EXPORT.md for setup.');
}
// ── MP4 stub (requires ffmpeg.wasm or MediaRecorder) ──────
async function exportMP4(canvas, durationMs, opts = {}) {
    const fps = opts.fps ?? EXPORT.defaultFps;
    const stream = canvas.captureStream?.(fps);
    if (!stream)
        throw new Error('captureStream not supported in this browser');
    return new Promise((resolve, reject) => {
        const chunks = [];
        const rec = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
        });
        rec.ondataavailable = e => { if (e.data.size)
            chunks.push(e.data); };
        rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
        rec.onerror = reject;
        rec.start();
        setTimeout(() => rec.stop(), durationMs);
    });
}

var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    exportCanvasPNG: exportCanvasPNG,
    exportGIF: exportGIF,
    exportHTML: exportHTML,
    exportMP4: exportMP4,
    exportPNG: exportPNG,
    exportSVG: exportSVG,
    getSVGBlob: getSVGBlob,
    getSVGString: getSVGString,
    svgToPNGDataURL: svgToPNGDataURL
});

// ============================================================
// sketchmark — Utility Helpers
// ============================================================
function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++)
        h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
    return h;
}
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}
function parseHex(hex) {
    const clean = hex.replace('#', '');
    if (clean.length === 3) {
        const r = parseInt(clean[0] + clean[0], 16);
        const g = parseInt(clean[1] + clean[1], 16);
        const b = parseInt(clean[2] + clean[2], 16);
        return [r, g, b];
    }
    if (clean.length === 6) {
        return [
            parseInt(clean.slice(0, 2), 16),
            parseInt(clean.slice(2, 4), 16),
            parseInt(clean.slice(4, 6), 16),
        ];
    }
    return null;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function throttle(fn, ms) {
    let last = 0;
    return ((...args) => {
        const now = Date.now();
        if (now - last >= ms) {
            last = now;
            fn(...args);
        }
    });
}
function debounce(fn, ms) {
    let tid;
    return ((...args) => {
        clearTimeout(tid);
        tid = setTimeout(() => fn(...args), ms);
    });
}
class EventEmitter {
    constructor() {
        this._ls = new Map();
    }
    on(event, fn) {
        if (!this._ls.has(event))
            this._ls.set(event, new Set());
        this._ls.get(event).add(fn);
        return this;
    }
    off(event, fn) {
        this._ls.get(event)?.delete(fn);
        return this;
    }
    emit(event, data) {
        this._ls.get(event)?.forEach(fn => fn(data));
        return this;
    }
}

function render(options) {
    const { container: rawContainer, dsl, plugins, renderer = "svg", injectCSS = true, tts, svgOptions = {}, canvasOptions = {}, onNodeClick, onReady, } = options;
    if (injectCSS && !document.getElementById("ai-diagram-css")) {
        const style = document.createElement("style");
        style.id = "ai-diagram-css";
        style.textContent = ANIMATION_CSS;
        document.head.appendChild(style);
    }
    let el;
    if (typeof rawContainer === "string") {
        el = document.querySelector(rawContainer);
        if (!el)
            throw new Error(`Container "${rawContainer}" not found`);
    }
    else {
        el = rawContainer;
    }
    const ast = parse(dsl, { plugins });
    const scene = buildSceneGraph(ast);
    layout(scene);
    let svg;
    let canvas;
    let anim;
    if (renderer === "canvas") {
        canvas = el instanceof HTMLCanvasElement
            ? el
            : (() => {
                const nextCanvas = document.createElement("canvas");
                el.appendChild(nextCanvas);
                return nextCanvas;
            })();
        renderToCanvas(scene, canvas, canvasOptions);
        anim = new AnimationController(document.createElementNS("http://www.w3.org/2000/svg", "svg"), ast.steps);
    }
    else {
        svg = renderToSVG(scene, el, {
            ...svgOptions,
            interactive: true,
            onNodeClick,
        });
        let rc = null;
        try {
            rc = rough.svg(svg);
        }
        catch {
            rc = null;
        }
        const containerEl = el instanceof SVGSVGElement ? undefined : el;
        anim = new AnimationController(svg, ast.steps, containerEl, rc, ast.config);
    }
    if (typeof tts === "boolean") {
        anim.tts = tts;
    }
    onReady?.(anim, svg);
    return {
        scene,
        anim,
        svg,
        canvas,
        update: (newDsl) => {
            anim?.destroy();
            return render({ ...options, dsl: newDsl });
        },
        exportSVG: (filename = "diagram.svg") => {
            if (svg) {
                Promise.resolve().then(function () { return index; }).then((mod) => mod.exportSVG(svg, { filename }));
            }
        },
        exportPNG: async (filename = "diagram.png") => {
            if (svg) {
                const mod = await Promise.resolve().then(function () { return index; });
                await mod.exportPNG(svg, { filename });
            }
        },
    };
}

function resolveContainer(target) {
    if (typeof target === "string") {
        const el = document.querySelector(target);
        if (!el)
            throw new Error(`Container "${target}" not found`);
        return el;
    }
    return target;
}
function injectStyleOnce(id, cssText) {
    if (document.getElementById(id))
        return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = cssText;
    document.head.appendChild(style);
}
function normalizeNewlines(value) {
    return value.replace(/\r\n?/g, "\n");
}
function toError(error) {
    return error instanceof Error ? error : new Error(String(error));
}

const CANVAS_STYLE_ID = "sketchmark-canvas-ui";
const CANVAS_CSS = `
.skm-canvas{display:flex;flex-direction:column;width:100%;height:100%;min-height:320px;overflow:hidden;border:1px solid #caba98;border-radius:10px;background:#f8f4ea;color:#3a2010;font-family:"Courier New",monospace}
.skm-canvas__animbar{display:flex;align-items:center;gap:6px;padding:6px 10px;background:#eee7d8;border-bottom:1px solid #caba98;flex-shrink:0;flex-wrap:wrap}
.skm-canvas__status{min-width:96px;text-align:center;color:#6a4820;font-size:11px}
.skm-canvas__label{color:#8a6040;font-size:11px;font-style:italic}
.skm-canvas__spacer{flex:1}
.skm-canvas__stats{color:#9a7848;font-size:10px}
.skm-canvas__button{border:1px solid #caba98;background:#f5eedd;color:#3a2010;border-radius:6px;padding:4px 9px;font:inherit;font-size:11px;cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease}
.skm-canvas__button:hover:not(:disabled){background:#c8a060;border-color:#c8a060;color:#fff}
.skm-canvas__button.is-active{background:#c8a060;border-color:#c8a060;color:#fff}
.skm-canvas__button:disabled{opacity:.45;cursor:default}
.skm-canvas__error{display:none;padding:8px 12px;background:#280a0a;border-bottom:1px solid #5a1818;color:#f07070;font-size:11px;line-height:1.4;white-space:pre-wrap;flex-shrink:0}
.skm-canvas__error.is-visible{display:block}
.skm-canvas__viewport{position:relative;flex:1;overflow:hidden;background:#f8f4ea;cursor:grab;touch-action:none}
.skm-canvas__viewport.is-panning{cursor:grabbing}
.skm-canvas--dark .skm-canvas__viewport{background:#12100a}
.skm-canvas__grid{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.skm-canvas__world{position:absolute;top:0;left:0;transform-origin:0 0;}
.skm-canvas__controls{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;align-items:center;gap:4px;z-index:2}
.skm-canvas__zoom{min-width:40px;text-align:center;color:#8a6040;font-size:10px}
.skm-canvas__minimap{position:absolute;left:14px;bottom:14px;width:120px;height:80px;background:rgba(255,248,234,.94);border:1px solid #caba98;border-radius:6px;overflow:hidden;z-index:2}
.skm-canvas__minimap canvas{width:100%;height:100%;display:block}
.skm-canvas__minimap-viewport{position:absolute;border:1.5px solid #c85428;background:rgba(200,84,40,.08);pointer-events:none}
.skm-canvas--hide-anim .skm-canvas__animbar,.skm-canvas--hide-controls .skm-canvas__controls,.skm-canvas--hide-minimap .skm-canvas__minimap{display:none}
`;
let canvasUid = 0;
class SketchmarkCanvas {
    constructor(options) {
        this.instance = null;
        this.emitter = new EventEmitter();
        this.dsl = "";
        this.showCaption = true;
        this.ttsOverride = null;
        this.panX = 60;
        this.panY = 60;
        this.zoom = 1;
        this.isPanning = false;
        this.panMoved = false;
        this.activePointerId = null;
        this.lastPX = 0;
        this.lastPY = 0;
        this.suppressClickUntil = 0;
        this.hasRenderedOnce = false;
        this.playInFlight = false;
        this.minimapToken = 0;
        this.animUnsub = null;
        this.editorCleanup = null;
        this.mirroredEditor = null;
        this.onPointerDown = (event) => {
            if (event.button !== 0 && event.button !== 1)
                return;
            const target = event.target;
            if (target instanceof Element && target.closest(".skm-canvas__controls, .skm-canvas__minimap"))
                return;
            this.isPanning = true;
            this.panMoved = false;
            this.activePointerId = event.pointerId;
            this.lastPX = event.clientX;
            this.lastPY = event.clientY;
            try {
                this.viewport.setPointerCapture(event.pointerId);
            }
            catch {
                // ignore pointer capture failures
            }
        };
        this.onPointerMove = (event) => {
            if (!this.isPanning)
                return;
            if (this.activePointerId !== null && event.pointerId !== this.activePointerId)
                return;
            const dx = event.clientX - this.lastPX;
            const dy = event.clientY - this.lastPY;
            if (!this.panMoved && Math.abs(dx) + Math.abs(dy) > 4) {
                this.panMoved = true;
                this.viewport.classList.add("is-panning");
            }
            if (this.panMoved) {
                this.panX += dx;
                this.panY += dy;
                this.applyTransform();
            }
            this.lastPX = event.clientX;
            this.lastPY = event.clientY;
        };
        this.onStopPanning = (event) => {
            if (this.activePointerId !== null && event?.pointerId != null && event.pointerId !== this.activePointerId)
                return;
            if (this.panMoved)
                this.suppressClickUntil = performance.now() + 180;
            if (this.activePointerId !== null && this.viewport.hasPointerCapture?.(this.activePointerId)) {
                try {
                    this.viewport.releasePointerCapture(this.activePointerId);
                }
                catch {
                    // ignore pointer capture release failures
                }
            }
            this.activePointerId = null;
            this.isPanning = false;
            this.panMoved = false;
            this.viewport.classList.remove("is-panning");
        };
        this.onViewportClick = (event) => {
            if (performance.now() <= this.suppressClickUntil) {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        this.onWheel = (event) => {
            event.preventDefault();
            const rect = this.viewport.getBoundingClientRect();
            const pivotX = event.clientX - rect.left;
            const pivotY = event.clientY - rect.top;
            const factor = event.deltaY > 0 ? 0.9 : 1.1;
            this.zoomTo(this.zoom * factor, pivotX, pivotY);
        };
        this.options = options;
        this.renderer = options.renderer ?? "svg";
        this.theme = options.theme ?? "light";
        this.showCaption = options.showCaption !== false;
        this.ttsOverride = typeof options.tts === "boolean" ? options.tts : null;
        this.dsl = normalizeNewlines(options.dsl ?? "");
        injectStyleOnce(CANVAS_STYLE_ID, CANVAS_CSS);
        const host = resolveContainer(options.container);
        host.innerHTML = "";
        this.root = document.createElement("div");
        this.root.className = "skm-canvas";
        this.root.classList.toggle("skm-canvas--dark", this.theme === "dark");
        this.root.classList.toggle("skm-canvas--hide-anim", options.showAnimationBar === false);
        this.root.classList.toggle("skm-canvas--hide-controls", options.showControls === false);
        this.root.classList.toggle("skm-canvas--hide-minimap", options.showMinimap === false);
        const patternId = `skm-grid-${++canvasUid}`;
        this.root.innerHTML = `
      <div class="skm-canvas__animbar">
        <button type="button" class="skm-canvas__button" data-action="reset">Reset</button>
        <button type="button" class="skm-canvas__button" data-action="prev">Prev</button>
        <span class="skm-canvas__status">No steps</span>
        <button type="button" class="skm-canvas__button" data-action="next">Next</button>
        <button type="button" class="skm-canvas__button" data-action="play">Play</button>
        <button type="button" class="skm-canvas__button" data-action="toggle-caption">Caption On</button>
        <button type="button" class="skm-canvas__button" data-action="toggle-tts">TTS Off</button>
        <span class="skm-canvas__label"></span>
        <span class="skm-canvas__spacer"></span>
        <span class="skm-canvas__stats"></span>
      </div>
      <div class="skm-canvas__error"></div>
      <div class="skm-canvas__viewport">
        <svg class="skm-canvas__grid" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs><pattern id="${patternId}" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="0.9" fill="rgba(170,145,100,0.38)"></circle></pattern></defs>
          <rect width="100%" height="100%" fill="url(#${patternId})"></rect>
        </svg>
        <div class="skm-canvas__world"><div class="skm-canvas__diagram"></div></div>
        <div class="skm-canvas__controls">
          <button type="button" class="skm-canvas__button" data-action="fit">Fit</button>
          <button type="button" class="skm-canvas__button" data-action="reset-view">Reset</button>
          <button type="button" class="skm-canvas__button" data-action="zoom-in">+</button>
          <span class="skm-canvas__zoom">100%</span>
          <button type="button" class="skm-canvas__button" data-action="zoom-out">-</button>
        </div>
        <div class="skm-canvas__minimap"><canvas width="120" height="80"></canvas><div class="skm-canvas__minimap-viewport"></div></div>
      </div>`;
        this.errorElement = this.root.querySelector(".skm-canvas__error");
        this.viewport = this.root.querySelector(".skm-canvas__viewport");
        this.world = this.root.querySelector(".skm-canvas__world");
        this.diagramWrap = this.root.querySelector(".skm-canvas__diagram");
        this.zoomLabel = this.root.querySelector(".skm-canvas__zoom");
        this.stepDisplay = this.root.querySelector(".skm-canvas__status");
        this.stepLabel = this.root.querySelector(".skm-canvas__label");
        this.statsLabel = this.root.querySelector(".skm-canvas__stats");
        this.minimapCanvas = this.root.querySelector(".skm-canvas__minimap canvas");
        this.minimapIndicator = this.root.querySelector(".skm-canvas__minimap-viewport");
        this.playButton = this.root.querySelector('[data-action="play"]');
        this.prevButton = this.root.querySelector('[data-action="prev"]');
        this.nextButton = this.root.querySelector('[data-action="next"]');
        this.resetButton = this.root.querySelector('[data-action="reset"]');
        this.captionButton = this.root.querySelector('[data-action="toggle-caption"]');
        this.ttsButton = this.root.querySelector('[data-action="toggle-tts"]');
        this.gridPattern = this.root.querySelector(`#${patternId}`);
        this.gridDot = this.gridPattern.querySelector("circle");
        this.root.querySelector('[data-action="fit"]')?.addEventListener("click", () => this.fitContent());
        this.root.querySelector('[data-action="reset-view"]')?.addEventListener("click", () => this.resetView());
        this.root.querySelector('[data-action="zoom-in"]')?.addEventListener("click", () => this.zoomTo(this.zoom * 1.2, this.viewport.clientWidth / 2, this.viewport.clientHeight / 2));
        this.root.querySelector('[data-action="zoom-out"]')?.addEventListener("click", () => this.zoomTo(this.zoom * 0.8, this.viewport.clientWidth / 2, this.viewport.clientHeight / 2));
        this.resetButton.addEventListener("click", () => this.resetAnimation());
        this.prevButton.addEventListener("click", () => this.prevStep());
        this.nextButton.addEventListener("click", () => this.nextStep());
        this.playButton.addEventListener("click", () => void this.play());
        this.captionButton.addEventListener("click", () => this.setCaptionVisible(!this.showCaption));
        this.ttsButton.addEventListener("click", () => this.setTtsEnabled(!this.getTtsEnabled()));
        this.viewport.addEventListener("pointerdown", this.onPointerDown);
        this.viewport.addEventListener("pointermove", this.onPointerMove);
        this.viewport.addEventListener("pointerup", this.onStopPanning);
        this.viewport.addEventListener("pointercancel", this.onStopPanning);
        this.viewport.addEventListener("lostpointercapture", this.onStopPanning);
        this.viewport.addEventListener("click", this.onViewportClick, true);
        this.viewport.addEventListener("wheel", this.onWheel, { passive: false });
        host.appendChild(this.root);
        this.applyTransform();
        this.syncAnimationUi();
        if (this.dsl.trim())
            this.render();
    }
    getDsl() {
        return this.dsl;
    }
    setDsl(dsl, renderNow = false) {
        this.dsl = normalizeNewlines(dsl);
        if (renderNow)
            this.render();
    }
    setCaptionVisible(visible) {
        this.showCaption = visible;
        this.applyCaptionVisibility(this.instance);
        this.syncToggleUi();
    }
    setTtsEnabled(enabled) {
        this.ttsOverride = enabled;
        this.applyTtsSetting(this.instance);
        this.syncToggleUi();
    }
    bindEditor(editor, options = {}) {
        this.editorCleanup?.();
        const renderOnRun = options.renderOnRun !== false;
        const renderOnChange = options.renderOnChange === true;
        const mirrorErrors = options.mirrorErrors !== false;
        const initialRender = options.initialRender !== false;
        this.mirroredEditor = mirrorErrors ? editor : null;
        const unsubs = [];
        if (renderOnRun)
            unsubs.push(editor.on("run", ({ value }) => this.render(value)));
        if (renderOnChange)
            unsubs.push(editor.on("change", ({ value }) => this.render(value)));
        if (initialRender)
            this.render(editor.getValue());
        this.editorCleanup = () => {
            unsubs.forEach((unsub) => unsub());
            this.mirroredEditor = null;
            this.editorCleanup = null;
        };
        return this.editorCleanup;
    }
    on(event, listener) {
        this.emitter.on(event, listener);
        return () => this.emitter.off(event, listener);
    }
    render(nextDsl) {
        if (typeof nextDsl === "string")
            this.dsl = normalizeNewlines(nextDsl);
        this.clearError();
        this.mirroredEditor?.clearError();
        this.animUnsub?.();
        this.animUnsub = null;
        this.instance?.anim?.destroy();
        this.diagramWrap.innerHTML = "";
        try {
            const instance = render({
                container: this.diagramWrap,
                dsl: this.dsl,
                plugins: this.options.plugins,
                renderer: this.renderer,
                svgOptions: { interactive: true, showTitle: true, theme: this.options.svgOptions?.theme ?? this.theme, ...this.options.svgOptions },
                canvasOptions: this.options.canvasOptions,
                onNodeClick: this.options.onNodeClick,
            });
            this.instance = instance;
            this.applyCaptionVisibility(instance);
            this.applyTtsSetting(instance);
            this.statsLabel.textContent = `${instance.scene.nodes.length}n / ${instance.scene.edges.length}e / ${instance.scene.groups.length}g`;
            if (this.renderer === "svg") {
                this.animUnsub = instance.anim.on((event) => {
                    this.syncAnimationUi();
                    if (event.type === "step-change") {
                        const targetId = this.getStepTarget(event.step);
                        if (targetId)
                            requestAnimationFrame(() => window.setTimeout(() => this.focusAnimatedElement(targetId), 40));
                        this.emitter.emit("stepchange", { stepIndex: event.stepIndex, step: event.step, canvas: this });
                    }
                });
            }
            this.syncAnimationUi();
            this.renderMinimapPreview();
            if (!this.hasRenderedOnce || this.options.preserveViewOnRender === false) {
                this.hasRenderedOnce = true;
                if (this.options.autoFit !== false)
                    requestAnimationFrame(() => this.fitContent());
                else
                    this.applyTransform();
            }
            else {
                this.applyTransform();
            }
            this.options.onRender?.(instance, this);
            this.emitter.emit("render", { instance, canvas: this });
            return instance;
        }
        catch (error) {
            const normalized = toError(error);
            this.instance = null;
            this.statsLabel.textContent = "";
            this.showError(normalized.message);
            this.mirroredEditor?.showError(normalized.message);
            this.syncAnimationUi();
            this.renderMinimapPreview();
            this.emitter.emit("error", { error: normalized, canvas: this });
            return null;
        }
    }
    async play() {
        if (!this.instance || this.playInFlight || this.renderer !== "svg" || !this.instance.anim.total)
            return;
        this.playInFlight = true;
        this.syncAnimationUi();
        try {
            await this.instance.anim.play(this.options.playStepDelay ?? 800);
        }
        finally {
            this.playInFlight = false;
            this.syncAnimationUi();
        }
    }
    nextStep() {
        if (!this.instance || this.renderer !== "svg")
            return;
        this.instance.anim.next();
        this.syncAnimationUi();
        this.focusCurrentStep();
    }
    prevStep() {
        if (!this.instance || this.renderer !== "svg")
            return;
        this.instance.anim.prev();
        this.syncAnimationUi();
        this.focusCurrentStep();
    }
    resetAnimation() {
        if (!this.instance || this.renderer !== "svg")
            return;
        this.instance.anim.reset();
        this.syncAnimationUi();
    }
    fitContent() {
        const size = this.getContentSize();
        if (!size)
            return;
        const vpW = this.viewport.clientWidth || size.width;
        const vpH = this.viewport.clientHeight || size.height;
        const padding = this.options.fitPadding ?? 80;
        const nextZoom = Math.min((vpW - padding) / size.width, (vpH - padding) / size.height, 1);
        this.zoom = clamp(nextZoom || 1, this.options.zoomMin ?? 0.08, this.options.zoomMax ?? 4);
        this.panX = (vpW - size.width * this.zoom) / 2;
        this.panY = (vpH - size.height * this.zoom) / 2;
        this.applyTransform();
    }
    resetView() {
        this.panX = 60;
        this.panY = 60;
        this.zoom = 1;
        this.applyTransform();
    }
    setTheme(theme) {
        this.theme = theme;
        this.root.classList.toggle("skm-canvas--dark", theme === "dark");
        this.render();
    }
    destroy() {
        this.editorCleanup?.();
        this.animUnsub?.();
        this.instance?.anim?.destroy();
        this.viewport.removeEventListener("pointerdown", this.onPointerDown);
        this.viewport.removeEventListener("pointermove", this.onPointerMove);
        this.viewport.removeEventListener("pointerup", this.onStopPanning);
        this.viewport.removeEventListener("pointercancel", this.onStopPanning);
        this.viewport.removeEventListener("lostpointercapture", this.onStopPanning);
        this.viewport.removeEventListener("click", this.onViewportClick, true);
        this.viewport.removeEventListener("wheel", this.onWheel);
        this.root.remove();
    }
    applyTransform() {
        this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
        const gridWidth = 24 * this.zoom;
        this.gridPattern.setAttribute("x", String(this.panX % gridWidth));
        this.gridPattern.setAttribute("y", String(this.panY % gridWidth));
        this.gridPattern.setAttribute("width", String(gridWidth));
        this.gridPattern.setAttribute("height", String(gridWidth));
        this.gridDot.setAttribute("cx", String(gridWidth / 2));
        this.gridDot.setAttribute("cy", String(gridWidth / 2));
        this.gridDot.setAttribute("r", String(Math.min(1.1, this.zoom * 0.85)));
        this.updateMinimapIndicator();
        this.emitter.emit("viewchange", { panX: this.panX, panY: this.panY, zoom: this.zoom, canvas: this });
    }
    zoomTo(nextZoom, pivotX, pivotY) {
        const clampedZoom = clamp(nextZoom, this.options.zoomMin ?? 0.08, this.options.zoomMax ?? 4);
        const ratio = clampedZoom / this.zoom;
        this.panX = pivotX - (pivotX - this.panX) * ratio;
        this.panY = pivotY - (pivotY - this.panY) * ratio;
        this.zoom = clampedZoom;
        this.applyTransform();
    }
    applyCaptionVisibility(instance) {
        const caption = instance?.anim.captionElement;
        if (!caption)
            return;
        caption.style.display = this.showCaption ? "" : "none";
        caption.setAttribute("aria-hidden", this.showCaption ? "false" : "true");
    }
    applyTtsSetting(instance) {
        if (!instance || this.ttsOverride === null)
            return;
        instance.anim.tts = this.ttsOverride;
    }
    getTtsEnabled() {
        if (this.ttsOverride !== null)
            return this.ttsOverride;
        return !!this.instance?.anim.tts;
    }
    syncToggleUi() {
        const canToggleCaption = this.renderer === "svg" && !!this.instance;
        const canToggleTts = canToggleCaption &&
            typeof speechSynthesis !== "undefined";
        const ttsEnabled = this.getTtsEnabled();
        this.captionButton.textContent = this.showCaption ? "Caption On" : "Caption Off";
        this.captionButton.classList.toggle("is-active", this.showCaption);
        this.captionButton.setAttribute("aria-pressed", this.showCaption ? "true" : "false");
        this.captionButton.disabled = !canToggleCaption;
        this.ttsButton.textContent = ttsEnabled ? "TTS On" : "TTS Off";
        this.ttsButton.classList.toggle("is-active", ttsEnabled);
        this.ttsButton.setAttribute("aria-pressed", ttsEnabled ? "true" : "false");
        this.ttsButton.disabled = !canToggleTts;
    }
    syncAnimationUi() {
        const anim = this.instance?.anim;
        const canAnimate = this.renderer === "svg" && !!anim && anim.total > 0;
        if (!anim || !canAnimate) {
            this.stepDisplay.textContent = this.renderer === "canvas" ? "Static view" : "No steps";
            this.stepLabel.textContent = "";
            this.prevButton.disabled = true;
            this.nextButton.disabled = true;
            this.resetButton.disabled = true;
            this.playButton.disabled = true;
            this.syncToggleUi();
            return;
        }
        this.stepDisplay.textContent = anim.currentStep < 0 ? `${anim.total} steps` : `${anim.currentStep + 1} / ${anim.total}`;
        this.stepLabel.textContent = anim.currentStep >= 0 ? this.getStepLabel(anim.steps[anim.currentStep]) : "";
        this.prevButton.disabled = !anim.canPrev;
        this.nextButton.disabled = !anim.canNext;
        this.resetButton.disabled = false;
        this.playButton.disabled = this.playInFlight || !anim.canNext;
        this.syncToggleUi();
    }
    getStepTarget(stepItem) {
        if (!stepItem)
            return null;
        return stepItem.kind === "beat" ? stepItem.children?.[0]?.target ?? null : stepItem.target ?? null;
    }
    getStepLabel(stepItem) {
        if (!stepItem)
            return "";
        if (stepItem.kind === "beat") {
            const first = stepItem.children?.[0];
            return first ? `beat ${first.action} ${first.target ?? ""}`.trim() : "beat";
        }
        return `${stepItem.action} ${stepItem.target ?? ""}`.trim();
    }
    focusCurrentStep() {
        const anim = this.instance?.anim;
        if (!anim || anim.currentStep < 0 || anim.currentStep >= anim.total)
            return;
        const targetId = this.getStepTarget(anim.steps[anim.currentStep]);
        if (targetId)
            window.setTimeout(() => this.focusAnimatedElement(targetId), 40);
    }
    findSvgElement(svg, id) {
        const prefixes = ["group-", "node-", "edge-", "table-", "chart-", "markdown-", "note-", ""];
        const esc = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape : (value) => value;
        for (const prefix of prefixes) {
            const found = svg.querySelector(`#${esc(prefix + id)}`);
            if (found)
                return found;
        }
        for (const attr of ["data-id", "data-node", "data-group", "sketchmark-id"]) {
            const found = svg.querySelector(`[${attr}="${id}"]`);
            if (found)
                return found;
        }
        return null;
    }
    focusAnimatedElement(targetId) {
        const svg = this.instance?.svg;
        if (!svg)
            return;
        const searchIds = this.splitEdgeTarget(targetId);
        let target = null;
        for (const id of searchIds) {
            target = this.findSvgElement(svg, id);
            if (target)
                break;
        }
        if (!target)
            return;
        const box = target.getBoundingClientRect();
        if (!box.width && !box.height)
            return;
        const vpBox = this.viewport.getBoundingClientRect();
        const centerX = box.left + box.width / 2 - vpBox.left;
        const centerY = box.top + box.height / 2 - vpBox.top;
        const margin = 100;
        if (centerX >= margin && centerX <= vpBox.width - margin && centerY >= margin && centerY <= vpBox.height - margin)
            return;
        const targetPanX = this.panX + (vpBox.width / 2 - centerX);
        const targetPanY = this.panY + (vpBox.height / 2 - centerY);
        const startPanX = this.panX;
        const startPanY = this.panY;
        const startTs = performance.now();
        const duration = 350;
        const frame = (now) => {
            const t = Math.min((now - startTs) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            this.panX = startPanX + (targetPanX - startPanX) * eased;
            this.panY = startPanY + (targetPanY - startPanY) * eased;
            this.applyTransform();
            if (t < 1)
                requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }
    splitEdgeTarget(targetId) {
        const connectors = ["<-->", "<->", "-->", "<--", "---", "--", "->", "<-"];
        for (const connector of connectors) {
            if (targetId.includes(connector)) {
                return targetId.split(connector).map((part) => part.trim()).filter(Boolean);
            }
        }
        return [targetId.trim()];
    }
    getContentSize() {
        if (this.instance?.svg) {
            return { width: parseFloat(this.instance.svg.getAttribute("width") || "400"), height: parseFloat(this.instance.svg.getAttribute("height") || "300") };
        }
        if (this.instance?.canvas) {
            return { width: this.instance.canvas.width || 400, height: this.instance.canvas.height || 300 };
        }
        return null;
    }
    updateMinimapIndicator() {
        if (this.options.showMinimap === false)
            return;
        const size = this.getContentSize();
        if (!size) {
            this.minimapIndicator.style.width = "0px";
            this.minimapIndicator.style.height = "0px";
            return;
        }
        const mW = this.minimapCanvas.width;
        const mH = this.minimapCanvas.height;
        const scale = Math.min(mW / size.width, mH / size.height) * 0.9;
        const offX = (mW - size.width * scale) / 2;
        const offY = (mH - size.height * scale) / 2;
        const vpW = this.viewport.clientWidth || size.width;
        const vpH = this.viewport.clientHeight || size.height;
        const ix = offX + (-this.panX / this.zoom) * scale;
        const iy = offY + (-this.panY / this.zoom) * scale;
        const iw = (vpW / this.zoom) * scale;
        const ih = (vpH / this.zoom) * scale;
        this.minimapIndicator.style.left = `${Math.max(0, ix)}px`;
        this.minimapIndicator.style.top = `${Math.max(0, iy)}px`;
        this.minimapIndicator.style.width = `${Math.min(mW - Math.max(0, ix), iw)}px`;
        this.minimapIndicator.style.height = `${Math.min(mH - Math.max(0, iy), ih)}px`;
    }
    renderMinimapPreview() {
        if (this.options.showMinimap === false)
            return;
        const ctx = this.minimapCanvas.getContext("2d");
        const size = this.getContentSize();
        if (!ctx)
            return;
        const width = this.minimapCanvas.width;
        const height = this.minimapCanvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = this.theme === "dark" ? "#1a140b" : "#fff8ea";
        ctx.fillRect(0, 0, width, height);
        if (!size) {
            this.updateMinimapIndicator();
            return;
        }
        const scale = Math.min(width / size.width, height / size.height) * 0.9;
        const drawW = size.width * scale;
        const drawH = size.height * scale;
        const offX = (width - drawW) / 2;
        const offY = (height - drawH) / 2;
        const token = ++this.minimapToken;
        const drawFallback = () => {
            if (token !== this.minimapToken)
                return;
            ctx.fillStyle = this.theme === "dark" ? "#20180e" : "#f7f1e2";
            ctx.fillRect(offX, offY, drawW, drawH);
            ctx.strokeStyle = this.theme === "dark" ? "#5a4525" : "#caba98";
            ctx.strokeRect(offX, offY, drawW, drawH);
            this.updateMinimapIndicator();
        };
        if (this.instance?.canvas) {
            try {
                ctx.drawImage(this.instance.canvas, offX, offY, drawW, drawH);
                ctx.strokeStyle = this.theme === "dark" ? "#5a4525" : "#caba98";
                ctx.strokeRect(offX, offY, drawW, drawH);
            }
            catch {
                drawFallback();
            }
            this.updateMinimapIndicator();
            return;
        }
        if (!this.instance?.svg || typeof XMLSerializer === "undefined") {
            drawFallback();
            return;
        }
        try {
            const serialized = new XMLSerializer().serializeToString(this.instance.svg);
            const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const image = new Image();
            image.onload = () => {
                if (token !== this.minimapToken) {
                    URL.revokeObjectURL(url);
                    return;
                }
                try {
                    ctx.drawImage(image, offX, offY, drawW, drawH);
                    ctx.strokeStyle = this.theme === "dark" ? "#5a4525" : "#caba98";
                    ctx.strokeRect(offX, offY, drawW, drawH);
                }
                catch {
                    drawFallback();
                }
                finally {
                    URL.revokeObjectURL(url);
                    this.updateMinimapIndicator();
                }
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                drawFallback();
            };
            image.src = url;
        }
        catch {
            drawFallback();
        }
    }
    showError(message) {
        this.errorElement.textContent = message;
        this.errorElement.classList.add("is-visible");
    }
    clearError() {
        this.errorElement.textContent = "";
        this.errorElement.classList.remove("is-visible");
    }
}

const EDITOR_STYLE_ID = "sketchmark-editor-ui";
const DEFAULT_CLEAR_VALUE = "diagram\n\nend";
const EDITOR_CSS = `
.skm-editor {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 240px;
  background: #1c1608;
  color: #e0c898;
  border: 1px solid #3a2a12;
  border-radius: 10px;
  overflow: hidden;
  font-family: "Courier New", monospace;
}

.skm-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #12100a;
  border-bottom: 1px solid #3a2a12;
  flex-shrink: 0;
}

.skm-editor__hint {
  margin-left: auto;
  color: #9a7848;
  font-size: 11px;
}

.skm-editor__button {
  border: 1px solid #4a3520;
  background: #22190e;
  color: #dcc48a;
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.skm-editor__button:hover {
  border-color: #f0c96a;
  color: #f0c96a;
}

.skm-editor__button--primary {
  background: #c85428;
  border-color: #c85428;
  color: #fff9ef;
}

.skm-editor__button--primary:hover {
  background: #db6437;
  border-color: #db6437;
  color: #fff;
}

.skm-editor__surface {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #1c1608;
  overflow: hidden;
}

.skm-editor__highlight,
.skm-editor__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 12px 14px;
  font: inherit;
  font-size: 12px;
  line-height: 1.7;
  tab-size: 2;
  white-space: pre-wrap;
  overflow: auto;
}

.skm-editor__highlight {
  margin: 0;
  border: 0;
  background: #1c1608;
  color: #e0c898;
  pointer-events: none;
  word-break: break-word;
}

.skm-editor__input {
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: transparent;
  caret-color: #f0c96a;
}

.skm-editor__input::placeholder {
  color: #80633b;
}

.skm-editor__input::selection {
  background: rgba(240, 201, 106, 0.22);
}

.skm-editor__token--keyword {
  color: #e07040;
}

.skm-editor__token--property {
  color: #70a8d0;
}

.skm-editor__token--string {
  color: #8db870;
}

.skm-editor__token--number {
  color: #d4a020;
}

.skm-editor__token--comment {
  color: #6a5a3a;
}

.skm-editor__token--connector {
  color: #c8b070;
}

.skm-editor__token--color {
  color: var(--skm-editor-color, #f0c96a);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.08);
  font-weight: 600;
}

.skm-editor__error {
  display: none;
  flex-shrink: 0;
  padding: 8px 12px;
  background: #280a0a;
  border-top: 1px solid #5a1818;
  color: #f07070;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.skm-editor__error.is-visible {
  display: block;
}
`;
const CONNECTORS = ["<-->", "<->", "-->", "<--", "---", "--", "->", "<-"];
const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
function defaultFormatter(value) {
    return normalizeNewlines(value)
        .split("\n")
        .map((line) => line.replace(/[ \t]+$/g, ""))
        .join("\n");
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function wrapToken(kind, value) {
    return `<span class="skm-editor__token skm-editor__token--${kind}">${escapeHtml(value)}</span>`;
}
function renderColorLiteral(value) {
    return `<span class="skm-editor__token skm-editor__token--color" style="--skm-editor-color:${value}">${escapeHtml(value)}</span>`;
}
function renderStringToken(value) {
    HEX_COLOR_RE.lastIndex = 0;
    if (!HEX_COLOR_RE.test(value)) {
        return wrapToken("string", value);
    }
    HEX_COLOR_RE.lastIndex = 0;
    let html = "";
    let lastIndex = 0;
    let match = null;
    while ((match = HEX_COLOR_RE.exec(value))) {
        if (match.index > lastIndex) {
            html += wrapToken("string", value.slice(lastIndex, match.index));
        }
        html += renderColorLiteral(match[0]);
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < value.length) {
        html += wrapToken("string", value.slice(lastIndex));
    }
    return html;
}
function renderPlainToken(value, nextChar) {
    if (/^-?\d/.test(value)) {
        return wrapToken("number", value);
    }
    if (nextChar === "=") {
        return wrapToken("property", value);
    }
    if (KEYWORDS.has(value)) {
        return wrapToken("keyword", value);
    }
    return escapeHtml(value);
}
function highlightLine(line) {
    let html = "";
    let index = 0;
    while (index < line.length) {
        const rest = line.slice(index);
        if (rest.startsWith("//") || rest.startsWith("#")) {
            html += wrapToken("comment", rest);
            break;
        }
        if (line[index] === "\"") {
            let end = index + 1;
            while (end < line.length) {
                if (line[end] === "\"" && line[end - 1] !== "\\") {
                    end += 1;
                    break;
                }
                end += 1;
            }
            html += renderStringToken(line.slice(index, end));
            index = end;
            continue;
        }
        const connector = CONNECTORS.find((candidate) => line.startsWith(candidate, index));
        if (connector) {
            html += wrapToken("connector", connector);
            index += connector.length;
            continue;
        }
        const wordMatch = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(rest);
        if (wordMatch) {
            const word = wordMatch[0];
            const nextChar = line[index + word.length] ?? "";
            html += renderPlainToken(word, nextChar);
            index += word.length;
            continue;
        }
        const numberMatch = /^-?\d+(?:\.\d+)?/.exec(rest);
        if (numberMatch) {
            html += wrapToken("number", numberMatch[0]);
            index += numberMatch[0].length;
            continue;
        }
        html += escapeHtml(line[index]);
        index += 1;
    }
    return html;
}
function renderHighlightedValue(value) {
    const normalized = normalizeNewlines(value);
    const html = normalized.split("\n").map(highlightLine).join("\n");
    return html || " ";
}
class SketchmarkEditor {
    constructor(options) {
        this.emitter = new EventEmitter();
        this.options = options;
        injectStyleOnce(EDITOR_STYLE_ID, EDITOR_CSS);
        const host = resolveContainer(options.container);
        host.innerHTML = "";
        this.root = document.createElement("div");
        this.root.className = "skm-editor";
        this.toolbar = document.createElement("div");
        this.toolbar.className = "skm-editor__toolbar";
        const runButton = document.createElement("button");
        runButton.type = "button";
        runButton.className = "skm-editor__button skm-editor__button--primary";
        runButton.textContent = options.runLabel ?? "Run";
        runButton.addEventListener("click", () => this.run());
        const formatButton = document.createElement("button");
        formatButton.type = "button";
        formatButton.className = "skm-editor__button";
        formatButton.textContent = options.formatLabel ?? "Format";
        formatButton.addEventListener("click", () => this.format());
        const clearButton = document.createElement("button");
        clearButton.type = "button";
        clearButton.className = "skm-editor__button";
        clearButton.textContent = options.clearLabel ?? "Clear";
        clearButton.addEventListener("click", () => this.clear());
        const hint = document.createElement("span");
        hint.className = "skm-editor__hint";
        hint.textContent = "Ctrl+Enter";
        if (options.showRunButton !== false)
            this.toolbar.appendChild(runButton);
        if (options.showFormatButton)
            this.toolbar.appendChild(formatButton);
        if (options.showClearButton !== false)
            this.toolbar.appendChild(clearButton);
        this.toolbar.appendChild(hint);
        this.surface = document.createElement("div");
        this.surface.className = "skm-editor__surface";
        this.highlightElement = document.createElement("pre");
        this.highlightElement.className = "skm-editor__highlight";
        this.highlightElement.setAttribute("aria-hidden", "true");
        this.textarea = document.createElement("textarea");
        this.textarea.className = "skm-editor__input";
        this.textarea.spellcheck = false;
        this.textarea.placeholder = options.placeholder ?? "diagram\nbox a label=\"Hello\"\nend";
        this.textarea.value = normalizeNewlines(options.value ?? DEFAULT_CLEAR_VALUE);
        this.textarea.addEventListener("input", () => {
            this.syncHighlight();
            const payload = { value: this.getValue(), editor: this };
            options.onChange?.(payload.value, this);
            this.emitter.emit("change", payload);
        });
        this.textarea.addEventListener("scroll", () => this.syncScroll());
        this.textarea.addEventListener("keydown", (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                this.run();
            }
        });
        this.errorElement = document.createElement("div");
        this.errorElement.className = "skm-editor__error";
        if (options.showToolbar !== false) {
            this.root.appendChild(this.toolbar);
        }
        this.surface.appendChild(this.highlightElement);
        this.surface.appendChild(this.textarea);
        this.root.appendChild(this.surface);
        this.root.appendChild(this.errorElement);
        host.appendChild(this.root);
        this.syncHighlight();
        if (options.autoFocus) {
            this.focus();
        }
    }
    getValue() {
        return this.textarea.value;
    }
    setValue(value, emitChange = false) {
        this.textarea.value = normalizeNewlines(value);
        this.syncHighlight();
        if (emitChange) {
            const payload = { value: this.getValue(), editor: this };
            this.options.onChange?.(payload.value, this);
            this.emitter.emit("change", payload);
        }
    }
    focus() {
        this.textarea.focus();
    }
    format() {
        const formatter = this.options.formatter ?? defaultFormatter;
        const value = formatter(this.getValue());
        this.setValue(value, true);
        this.emitter.emit("format", { value, editor: this });
    }
    clear() {
        const value = this.options.clearValue ?? DEFAULT_CLEAR_VALUE;
        this.setValue(value, true);
        this.clearError();
        this.emitter.emit("clear", { value: this.getValue(), editor: this });
    }
    run() {
        const value = this.getValue();
        this.options.onRun?.(value, this);
        this.emitter.emit("run", { value, editor: this });
    }
    showError(message) {
        this.errorElement.textContent = message;
        this.errorElement.classList.add("is-visible");
    }
    clearError() {
        this.errorElement.textContent = "";
        this.errorElement.classList.remove("is-visible");
    }
    on(event, listener) {
        this.emitter.on(event, listener);
        return () => this.emitter.off(event, listener);
    }
    destroy() {
        this.root.remove();
    }
    syncHighlight() {
        this.highlightElement.innerHTML = renderHighlightedValue(this.textarea.value);
        this.syncScroll();
    }
    syncScroll() {
        this.highlightElement.scrollTop = this.textarea.scrollTop;
        this.highlightElement.scrollLeft = this.textarea.scrollLeft;
    }
}

const EMBED_STYLE_ID = "sketchmark-embed-ui";
const EMBED_CSS = `
.skm-embed {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #caba98;
  border-radius: 12px;
  background: #fff8ea;
  color: #3a2010;
  font-family: "Courier New", monospace;
}

.skm-embed--dark {
  background: #12100a;
  border-color: #4a3520;
  color: #f3ddaf;
}

.skm-embed__viewport {
  position: relative;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  background: inherit;
}

.skm-embed__world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.skm-embed__error {
  display: none;
  padding: 8px 12px;
  background: #280a0a;
  border-top: 1px solid #5a1818;
  color: #f07070;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.skm-embed__error.is-visible {
  display: block;
}

.skm-embed__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #d8ccb1;
  background: rgba(255, 248, 234, 0.88);
  backdrop-filter: blur(6px);
}

.skm-embed--dark .skm-embed__controls {
  border-top-color: #3a2a12;
  background: rgba(26, 18, 8, 0.9);
}

.skm-embed__controls.is-hidden {
  display: none;
}

.skm-embed__controls-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.skm-embed__button {
  border: 1px solid #caba98;
  background: #f5eedd;
  color: #3a2010;
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.skm-embed__button:hover:not(:disabled) {
  background: #c8a060;
  border-color: #c8a060;
  color: #fff;
}

.skm-embed__button.is-active {
  background: #c8a060;
  border-color: #c8a060;
  color: #fff;
}

.skm-embed--dark .skm-embed__button {
  border-color: #4a3520;
  background: #22190e;
  color: #f3ddaf;
}

.skm-embed--dark .skm-embed__button:hover:not(:disabled) {
  background: #c8a060;
  border-color: #c8a060;
  color: #fff;
}

.skm-embed__button:disabled {
  opacity: 0.45;
  cursor: default;
}

.skm-embed__zoom {
  min-width: 48px;
  text-align: center;
  color: #8a6040;
  font-size: 11px;
}

.skm-embed--dark .skm-embed__zoom {
  color: #d0b176;
}

.skm-embed__step {
  margin-left: auto;
  min-width: 96px;
  text-align: center;
  color: #8a6040;
  font-size: 11px;
}

.skm-embed--dark .skm-embed__step {
  color: #d0b176;
}
`;
class SketchmarkEmbed {
    constructor(options) {
        this.instance = null;
        this.emitter = new EventEmitter();
        this.animUnsub = null;
        this.playInFlight = false;
        this.showCaption = true;
        this.ttsOverride = null;
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.autoFitEnabled = true;
        this.motionFrame = null;
        this.resizeObserver = null;
        this.options = options;
        this.dsl = normalizeNewlines(options.dsl);
        this.theme = options.theme ?? "light";
        this.showCaption = options.showCaption !== false;
        this.ttsOverride = typeof options.tts === "boolean" ? options.tts : null;
        injectStyleOnce(EMBED_STYLE_ID, EMBED_CSS);
        const host = resolveContainer(options.container);
        host.innerHTML = "";
        this.root = document.createElement("div");
        this.root.className = "skm-embed";
        this.root.classList.toggle("skm-embed--dark", this.theme === "dark");
        this.applySize(options.width, options.height);
        this.root.innerHTML = `
      <div class="skm-embed__viewport">
        <div class="skm-embed__world">
          <div class="skm-embed__diagram"></div>
        </div>
      </div>
      <div class="skm-embed__error"></div>
      <div class="skm-embed__controls">
        <div class="skm-embed__controls-group">
          <button type="button" class="skm-embed__button" data-action="zoom-out">-</button>
          <span class="skm-embed__zoom">100%</span>
          <button type="button" class="skm-embed__button" data-action="zoom-in">+</button>
          <button type="button" class="skm-embed__button" data-action="fit">Reset</button>
        </div>
        <div class="skm-embed__controls-group">
          <button type="button" class="skm-embed__button" data-action="restart">Restart</button>
          <button type="button" class="skm-embed__button" data-action="prev">Prev</button>
          <button type="button" class="skm-embed__button" data-action="next">Next</button>
          <button type="button" class="skm-embed__button" data-action="play">Play</button>
        </div>
        <div class="skm-embed__controls-group">
          <button type="button" class="skm-embed__button" data-action="toggle-caption">Caption On</button>
          <button type="button" class="skm-embed__button" data-action="toggle-tts">TTS Off</button>
        </div>
        <span class="skm-embed__step">No steps</span>
      </div>
    `;
        this.viewport = this.root.querySelector(".skm-embed__viewport");
        this.world = this.root.querySelector(".skm-embed__world");
        this.diagramWrap = this.root.querySelector(".skm-embed__diagram");
        this.errorElement = this.root.querySelector(".skm-embed__error");
        this.controlsElement = this.root.querySelector(".skm-embed__controls");
        this.stepInfoElement = this.root.querySelector(".skm-embed__step");
        this.zoomInfoElement = this.root.querySelector(".skm-embed__zoom");
        this.btnFit = this.root.querySelector('[data-action="fit"]');
        this.btnZoomIn = this.root.querySelector('[data-action="zoom-in"]');
        this.btnZoomOut = this.root.querySelector('[data-action="zoom-out"]');
        this.btnRestart = this.root.querySelector('[data-action="restart"]');
        this.btnPrev = this.root.querySelector('[data-action="prev"]');
        this.btnNext = this.root.querySelector('[data-action="next"]');
        this.btnPlay = this.root.querySelector('[data-action="play"]');
        this.btnCaption = this.root.querySelector('[data-action="toggle-caption"]');
        this.btnTts = this.root.querySelector('[data-action="toggle-tts"]');
        this.controlsElement.classList.toggle("is-hidden", options.showControls === false);
        this.btnFit.addEventListener("click", () => this.resetView());
        this.btnZoomIn.addEventListener("click", () => this.zoomIn());
        this.btnZoomOut.addEventListener("click", () => this.zoomOut());
        this.btnRestart.addEventListener("click", () => this.resetAnimation());
        this.btnPrev.addEventListener("click", () => this.prevStep());
        this.btnNext.addEventListener("click", () => this.nextStep());
        this.btnPlay.addEventListener("click", () => {
            void this.play();
        });
        this.btnCaption.addEventListener("click", () => this.setCaptionVisible(!this.showCaption));
        this.btnTts.addEventListener("click", () => this.setTtsEnabled(!this.getTtsEnabled()));
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(() => {
                this.positionViewport(false);
            });
            this.resizeObserver.observe(this.viewport);
        }
        host.appendChild(this.root);
        this.render();
    }
    getDsl() {
        return this.dsl;
    }
    setDsl(dsl, renderNow = false) {
        this.dsl = normalizeNewlines(dsl);
        if (renderNow)
            this.render();
    }
    setCaptionVisible(visible) {
        this.showCaption = visible;
        this.applyCaptionVisibility(this.instance);
        this.syncToggleControls();
    }
    setTtsEnabled(enabled) {
        this.ttsOverride = enabled;
        this.applyTtsSetting(this.instance);
        this.syncToggleControls();
    }
    setSize(width, height) {
        this.applySize(width, height);
        this.positionViewport(false);
    }
    setTheme(theme) {
        this.theme = theme;
        this.root.classList.toggle("skm-embed--dark", theme === "dark");
        this.render();
    }
    on(event, listener) {
        this.emitter.on(event, listener);
        return () => this.emitter.off(event, listener);
    }
    render(nextDsl) {
        if (typeof nextDsl === "string") {
            this.dsl = normalizeNewlines(nextDsl);
        }
        this.clearError();
        this.stopMotion();
        this.animUnsub?.();
        this.animUnsub = null;
        this.instance?.anim?.destroy();
        this.instance = null;
        this.autoFitEnabled = true;
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.diagramWrap.innerHTML = "";
        this.applyTransform();
        try {
            const instance = render({
                container: this.diagramWrap,
                dsl: this.dsl,
                plugins: this.options.plugins,
                renderer: "svg",
                svgOptions: {
                    showTitle: true,
                    interactive: true,
                    transparent: true,
                    theme: this.options.svgOptions?.theme ?? this.theme,
                    ...this.options.svgOptions,
                },
                onNodeClick: this.options.onNodeClick,
            });
            this.instance = instance;
            this.applyCaptionVisibility(instance);
            this.applyTtsSetting(instance);
            this.animUnsub = instance.anim.on((event) => {
                this.syncControls();
                if (event.type === "step-change") {
                    if (this.options.autoFocusOnStep !== false) {
                        requestAnimationFrame(() => {
                            window.setTimeout(() => this.positionViewport(true), 40);
                        });
                    }
                    this.emitter.emit("stepchange", {
                        stepIndex: event.stepIndex,
                        step: event.step,
                        embed: this,
                    });
                }
            });
            this.syncControls();
            requestAnimationFrame(() => {
                this.positionViewport(false);
            });
            this.options.onRender?.(instance, this);
            this.emitter.emit("render", { instance, embed: this });
            return instance;
        }
        catch (error) {
            const normalized = toError(error);
            this.showError(normalized.message);
            this.syncControls();
            this.emitter.emit("error", { error: normalized, embed: this });
            return null;
        }
    }
    async play() {
        if (!this.instance || this.playInFlight || !this.instance.anim.total)
            return;
        this.playInFlight = true;
        this.syncControls();
        try {
            await this.instance.anim.play(this.options.playStepDelay ?? 800);
        }
        finally {
            this.playInFlight = false;
            this.syncControls();
        }
    }
    nextStep() {
        if (!this.instance)
            return;
        this.instance.anim.next();
        this.syncControls();
        this.positionViewport(true);
    }
    prevStep() {
        if (!this.instance)
            return;
        this.instance.anim.prev();
        this.syncControls();
        this.positionViewport(true);
    }
    resetAnimation() {
        if (!this.instance)
            return;
        this.instance.anim.reset();
        this.syncControls();
        this.positionViewport(true);
    }
    fitToViewport(animated = false) {
        if (!this.instance?.svg)
            return;
        this.autoFitEnabled = true;
        this.positionViewport(animated);
    }
    resetView(animated = false) {
        this.fitToViewport(animated);
    }
    zoomIn() {
        this.zoomAroundViewportCenter(1.2);
    }
    zoomOut() {
        this.zoomAroundViewportCenter(0.8);
    }
    exportSVG(filename) {
        this.instance?.exportSVG(filename);
    }
    async exportPNG(filename) {
        await this.instance?.exportPNG(filename);
    }
    destroy() {
        this.stopMotion();
        this.animUnsub?.();
        this.instance?.anim?.destroy();
        this.instance = null;
        this.resizeObserver?.disconnect();
        this.root.remove();
    }
    applySize(width, height) {
        this.root.style.width = this.formatSize(width ?? 960);
        this.root.style.height = this.formatSize(height ?? 540);
    }
    formatSize(value) {
        return typeof value === "number" ? `${value}px` : value;
    }
    syncControls() {
        this.syncAnimationControls();
        this.syncViewControls();
        this.syncToggleControls();
    }
    syncAnimationControls() {
        const anim = this.instance?.anim;
        if (!anim || !anim.total) {
            this.stepInfoElement.textContent = "No steps";
            this.btnRestart.disabled = true;
            this.btnPrev.disabled = true;
            this.btnNext.disabled = true;
            this.btnPlay.disabled = true;
            return;
        }
        this.stepInfoElement.textContent =
            anim.currentStep < 0 ? `${anim.total} steps` : `${anim.currentStep + 1} / ${anim.total}`;
        this.btnRestart.disabled = false;
        this.btnPrev.disabled = !anim.canPrev;
        this.btnNext.disabled = !anim.canNext;
        this.btnPlay.disabled = this.playInFlight || !anim.canNext;
    }
    syncViewControls() {
        const hasView = !!this.instance?.svg;
        const zoomMin = this.getZoomMin();
        const zoomMax = this.getZoomMax();
        this.zoomInfoElement.textContent = `${Math.round(this.zoom * 100)}%`;
        this.btnFit.disabled = !hasView;
        this.btnZoomOut.disabled = !hasView || this.zoom <= zoomMin + 0.001;
        this.btnZoomIn.disabled = !hasView || this.zoom >= zoomMax - 0.001;
    }
    positionViewport(animated) {
        const size = this.getContentSize();
        if (!size)
            return;
        const { width: svgWidth, height: svgHeight } = size;
        const viewportRect = this.viewport.getBoundingClientRect();
        const viewWidth = viewportRect.width || this.viewport.clientWidth;
        const viewHeight = viewportRect.height || this.viewport.clientHeight;
        if (!viewWidth || !viewHeight)
            return;
        if (this.autoFitEnabled) {
            this.zoom = this.getFitZoom(svgWidth, svgHeight, viewWidth, viewHeight);
        }
        this.syncViewControls();
        const scaledWidth = svgWidth * this.zoom;
        const scaledHeight = svgHeight * this.zoom;
        const focusTarget = this.getFocusTarget();
        const sceneIsLarge = scaledWidth > viewWidth || scaledHeight > viewHeight;
        const shouldFocus = sceneIsLarge &&
            this.options.autoFocus !== false &&
            !!focusTarget;
        if (!shouldFocus) {
            this.animateTo(scaledWidth <= viewWidth ? (viewWidth - scaledWidth) / 2 : 0, scaledHeight <= viewHeight ? (viewHeight - scaledHeight) / 2 : 0, animated);
            return;
        }
        const target = this.findTargetElement(focusTarget);
        if (!target) {
            this.animateTo(0, 0, animated);
            return;
        }
        const targetBox = this.getTargetBox(target, viewportRect);
        if (!targetBox) {
            this.animateTo(0, 0, animated);
            return;
        }
        let nextX = viewWidth / 2 - targetBox.centerX;
        let nextY = viewHeight / 2 - targetBox.centerY;
        const padding = this.options.focusPadding ?? 24;
        if (scaledWidth <= viewWidth) {
            nextX = (viewWidth - scaledWidth) / 2;
        }
        else {
            nextX = clamp(nextX, viewWidth - scaledWidth - padding, padding);
        }
        if (scaledHeight <= viewHeight) {
            nextY = (viewHeight - scaledHeight) / 2;
        }
        else {
            nextY = clamp(nextY, viewHeight - scaledHeight - padding, padding);
        }
        this.animateTo(nextX, nextY, animated);
    }
    animateTo(nextX, nextY, animated) {
        this.stopMotion();
        const duration = this.options.focusDuration ?? 320;
        if (!animated || duration <= 0) {
            this.offsetX = nextX;
            this.offsetY = nextY;
            this.applyTransform();
            return;
        }
        const startX = this.offsetX;
        const startY = this.offsetY;
        const start = performance.now();
        const frame = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            this.offsetX = startX + (nextX - startX) * eased;
            this.offsetY = startY + (nextY - startY) * eased;
            this.applyTransform();
            if (t < 1) {
                this.motionFrame = requestAnimationFrame(frame);
            }
            else {
                this.motionFrame = null;
            }
        };
        this.motionFrame = requestAnimationFrame(frame);
    }
    applyTransform() {
        this.world.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
        this.zoomInfoElement.textContent = `${Math.round(this.zoom * 100)}%`;
    }
    getContentSize() {
        if (!this.instance?.svg)
            return null;
        const svg = this.instance.svg;
        const width = parseFloat(svg.getAttribute("width") || "0");
        const height = parseFloat(svg.getAttribute("height") || "0");
        if (!width || !height)
            return null;
        return { width, height };
    }
    getFitZoom(svgWidth, svgHeight, viewWidth, viewHeight) {
        const padding = this.getFitPadding(viewWidth, viewHeight);
        const availableWidth = Math.max(viewWidth - padding * 2, 1);
        const availableHeight = Math.max(viewHeight - padding * 2, 1);
        const nextZoom = Math.min(availableWidth / svgWidth, availableHeight / svgHeight, 1);
        return clamp(nextZoom || 1, this.getZoomMin(), this.getZoomMax());
    }
    getFitPadding(viewWidth, viewHeight) {
        if (typeof this.options.fitPadding === "number") {
            return Math.max(0, this.options.fitPadding);
        }
        return Math.max(16, Math.min(40, Math.round(Math.min(viewWidth, viewHeight) * 0.08)));
    }
    getZoomMin() {
        return this.options.zoomMin ?? 0.08;
    }
    getZoomMax() {
        return this.options.zoomMax ?? 4;
    }
    zoomAroundViewportCenter(factor) {
        if (!this.instance?.svg)
            return;
        const pivotX = this.viewport.clientWidth / 2;
        const pivotY = this.viewport.clientHeight / 2;
        this.zoomTo(this.zoom * factor, pivotX, pivotY);
    }
    zoomTo(nextZoom, pivotX, pivotY) {
        const clampedZoom = clamp(nextZoom, this.getZoomMin(), this.getZoomMax());
        const ratio = clampedZoom / this.zoom;
        if (!Number.isFinite(ratio) || ratio === 1) {
            this.syncViewControls();
            return;
        }
        this.stopMotion();
        this.autoFitEnabled = false;
        this.offsetX = pivotX - (pivotX - this.offsetX) * ratio;
        this.offsetY = pivotY - (pivotY - this.offsetY) * ratio;
        this.zoom = clampedZoom;
        this.applyTransform();
        this.syncViewControls();
    }
    applyCaptionVisibility(instance) {
        const caption = instance?.anim.captionElement;
        if (!caption)
            return;
        caption.style.display = this.showCaption ? "" : "none";
        caption.setAttribute("aria-hidden", this.showCaption ? "false" : "true");
    }
    applyTtsSetting(instance) {
        if (!instance || this.ttsOverride === null)
            return;
        instance.anim.tts = this.ttsOverride;
    }
    getTtsEnabled() {
        if (this.ttsOverride !== null)
            return this.ttsOverride;
        return !!this.instance?.anim.tts;
    }
    syncToggleControls() {
        const hasView = !!this.instance?.svg;
        const canToggleTts = hasView &&
            typeof speechSynthesis !== "undefined";
        const ttsEnabled = this.getTtsEnabled();
        this.btnCaption.textContent = this.showCaption ? "Caption On" : "Caption Off";
        this.btnCaption.classList.toggle("is-active", this.showCaption);
        this.btnCaption.setAttribute("aria-pressed", this.showCaption ? "true" : "false");
        this.btnCaption.disabled = !hasView;
        this.btnTts.textContent = ttsEnabled ? "TTS On" : "TTS Off";
        this.btnTts.classList.toggle("is-active", ttsEnabled);
        this.btnTts.setAttribute("aria-pressed", ttsEnabled ? "true" : "false");
        this.btnTts.disabled = !canToggleTts;
    }
    getTargetBox(target, viewportRect) {
        if (target instanceof SVGGraphicsElement) {
            try {
                const bounds = target.getBBox();
                return {
                    centerX: (bounds.x + bounds.width / 2) * this.zoom,
                    centerY: (bounds.y + bounds.height / 2) * this.zoom,
                };
            }
            catch {
                // Ignore and fall back to layout-based bounds below.
            }
        }
        const currentRect = target.getBoundingClientRect();
        return {
            centerX: currentRect.left - viewportRect.left - this.offsetX + currentRect.width / 2,
            centerY: currentRect.top - viewportRect.top - this.offsetY + currentRect.height / 2,
        };
    }
    getFocusTarget() {
        const anim = this.instance?.anim;
        if (!anim || !anim.total)
            return null;
        const startIndex = anim.currentStep >= 0 ? anim.currentStep : 0;
        for (let index = startIndex; index < anim.steps.length; index += 1) {
            const target = this.getStepTarget(anim.steps[index]);
            if (target)
                return target;
        }
        for (let index = startIndex - 1; index >= 0; index -= 1) {
            const target = this.getStepTarget(anim.steps[index]);
            if (target)
                return target;
        }
        return null;
    }
    findTargetElement(targetId) {
        const svg = this.instance?.svg;
        if (!svg)
            return null;
        const edgeTarget = this.parseEdgeTarget(targetId);
        const esc = typeof CSS !== "undefined" && typeof CSS.escape === "function"
            ? CSS.escape
            : (value) => value;
        if (edgeTarget) {
            const edgeEl = svg.querySelector(`#${esc(`edge-${edgeTarget.from}-${edgeTarget.to}`)}`);
            if (edgeEl)
                return edgeEl;
        }
        const ids = this.splitEdgeTarget(targetId);
        const prefixes = ["group-", "node-", "edge-", "table-", "chart-", "markdown-", "note-", ""];
        for (const id of ids) {
            for (const prefix of prefixes) {
                const found = svg.querySelector(`#${esc(prefix + id)}`);
                if (found)
                    return found;
            }
            for (const attr of ["data-id", "data-node", "data-group", "sketchmark-id"]) {
                const found = svg.querySelector(`[${attr}="${id}"]`);
                if (found)
                    return found;
            }
        }
        return null;
    }
    getStepTarget(stepItem) {
        if (!stepItem)
            return null;
        return stepItem.kind === "beat" ? stepItem.children?.[0]?.target ?? null : stepItem.target ?? null;
    }
    parseEdgeTarget(targetId) {
        const connectors = ["<-->", "<->", "-->", "<--", "---", "--", "->", "<-"];
        for (const connector of connectors) {
            if (targetId.includes(connector)) {
                const [from, to] = targetId.split(connector).map((part) => part.trim());
                if (from && to)
                    return { from, to };
            }
        }
        return null;
    }
    splitEdgeTarget(targetId) {
        const connectors = ["<-->", "<->", "-->", "<--", "---", "--", "->", "<-"];
        for (const connector of connectors) {
            if (targetId.includes(connector)) {
                return targetId.split(connector).map((part) => part.trim()).filter(Boolean);
            }
        }
        return [targetId.trim()];
    }
    showError(message) {
        this.errorElement.textContent = message;
        this.errorElement.classList.add("is-visible");
    }
    clearError() {
        this.errorElement.textContent = "";
        this.errorElement.classList.remove("is-visible");
    }
    stopMotion() {
        if (this.motionFrame === null)
            return;
        cancelAnimationFrame(this.motionFrame);
        this.motionFrame = null;
    }
}

export { ANIMATION_CSS, AnimationController, BUILTIN_FONTS, EventEmitter, PALETTES, ParseError, SketchmarkCanvas, SketchmarkEditor, SketchmarkEmbed, THEME_CONFIG_KEY, THEME_NAMES, buildSceneGraph, canvasToPNGBlob, canvasToPNGDataURL, clamp, connPoint, debounce, exportCanvasPNG, exportGIF, exportHTML, exportMP4, exportPNG, exportSVG, getSVGBlob, groupMap, hashStr, layout, lerp, listThemes, loadFont, markdownMap, nodeMap, parse, parseHex, registerFont, render, renderToCanvas, renderToSVG, resolveFont, resolvePalette, sleep, svgToPNGDataURL, svgToString, throttle };
//# sourceMappingURL=index.js.map
