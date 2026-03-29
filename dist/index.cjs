'use strict';

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
                    else if (esc === "\\")
                        val += "\\";
                    else
                        val += esc;
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

// ============================================================
// sketchmark — Parser  (Tokens → DiagramAST)
// ============================================================
let _uid = 0;
function uid(prefix) {
    return `${prefix}_${++_uid}`;
}
function resetUid() {
    _uid = 0;
}
const SHAPES = [
    "box",
    "circle",
    "diamond",
    "hexagon",
    "triangle",
    "cylinder",
    "parallelogram",
    "text",
    "image",
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
    if (p["vertical-align"])
        s.verticalAlign = p["vertical-align"];
    if (p["line-height"])
        s.lineHeight = parseFloat(p["line-height"]);
    if (p["letter-spacing"])
        s.letterSpacing = parseFloat(p["letter-spacing"]);
    if (p.font)
        s.font = p.font;
    const dashVal = p["dash"] || p["stroke-dash"];
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
function parse(src) {
    resetUid();
    const tokens = tokenize$1(src).filter((t) => t.type !== "NEWLINE" || t.value === "\n");
    // Collapse multiple consecutive NEWLINEs into one
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
        nodes: [],
        edges: [],
        groups: [],
        steps: [],
        notes: [],
        charts: [],
        tables: [],
        markdowns: [],
        styles: {},
        themes: {},
        config: {},
        rootOrder: [],
    };
    const nodeIds = new Set();
    const tableIds = new Set();
    const noteIds = new Set();
    const chartIds = new Set();
    const groupIds = new Set();
    const markdownIds = new Set();
    let i = 0;
    const cur = () => flat[i] ?? flat[flat.length - 1];
    const peek1 = () => flat[i + 1] ?? flat[flat.length - 1];
    const skip = () => i++;
    const skipNL = () => {
        while (cur().type === "NEWLINE")
            skip();
    };
    // Consume until EOL, return all tokens
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
    function parseDataArray() {
        const rows = [];
        while (cur().type !== "LBRACKET" && cur().type !== "EOF")
            skip();
        skip(); // outer [
        skipNL();
        while (cur().type !== "RBRACKET" && cur().type !== "EOF") {
            skipNL();
            if (cur().type === "RBRACKET" || cur().type === "EOF")
                break; // ← ADD THIS LINE
            if (cur().type === "LBRACKET") {
                skip();
                const row = [];
                while (cur().type !== "RBRACKET" && cur().type !== "EOF") {
                    const v = cur();
                    if (v.type === "STRING" ||
                        v.type === "IDENT" ||
                        v.type === "KEYWORD") {
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
                    else
                        break;
                }
                if (cur().type === "RBRACKET")
                    skip();
                rows.push(row);
            }
            else if (cur().type === "COMMA" || cur().type === "NEWLINE") {
                skip();
            }
            else
                skip();
        }
        if (cur().type === "RBRACKET")
            skip();
        return rows;
    }
    function parseNode(shape, groupId) {
        skip(); // shape keyword
        const toks = lineTokens();
        let id = groupId ? groupId + "_" + uid(shape) : uid(shape);
        const props = {};
        let j = 0;
        // First token may be the node id
        if (j < toks.length &&
            (toks[j].type === "IDENT" || toks[j].type === "STRING")) {
            id = toks[j++].value;
        }
        // Remaining tokens are key=value pairs
        while (j < toks.length) {
            const t = toks[j];
            if ((t.type === "IDENT" || t.type === "KEYWORD") &&
                j + 1 < toks.length &&
                toks[j + 1].type === "EQUALS") {
                const key = t.value;
                j += 2;
                if (j < toks.length) {
                    props[key] = toks[j].value;
                    j++;
                }
            }
            else
                j++;
        }
        const node = {
            kind: "node",
            id,
            shape,
            label: props.label || id,
            ...(groupId ? { groupId } : {}),
            ...(props.width ? { width: parseFloat(props.width) } : {}),
            ...(props.height ? { height: parseFloat(props.height) } : {}),
            ...(props.theme ? { theme: props.theme } : {}),
            style: propsToStyle(props),
        };
        if (props.url)
            node.imageUrl = props.url;
        return node;
    }
    function parseEdge(fromId, connector, rest) {
        const toTok = rest.shift();
        if (!toTok)
            throw new ParseError("Expected edge target", 0, 0);
        const toId = toTok.value;
        const props = {};
        let j = 0;
        while (j < rest.length) {
            const t = rest[j];
            if ((t.type === "IDENT" || t.type === "KEYWORD") &&
                j + 1 < rest.length &&
                rest[j + 1].type === "EQUALS") {
                const key = t.value;
                j += 2;
                if (j < rest.length) {
                    props[key] = rest[j].value;
                    j++;
                }
            }
            else
                j++;
        }
        const dashed = connector.includes("--") ||
            connector.includes(".-") ||
            connector.includes("-.");
        const bidir = connector.includes("<") && connector.includes(">");
        return {
            kind: "edge",
            id: uid("edge"),
            from: fromId,
            to: toId,
            connector: connector,
            label: props.label,
            dashed,
            bidirectional: bidir,
            style: propsToStyle(props),
        };
    }
    // ── parseNote ────────────────────────────────────────────
    function parseNote(groupId) {
        skip(); // 'note'
        const toks = lineTokens();
        let id = groupId ? groupId + "_" + uid("note") : uid("note");
        if (toks[0])
            id = toks[0].value;
        const props = {};
        let j = 1;
        // Backward compat: second token is a bare/quoted string → label
        if (toks[1] &&
            (toks[1].type === "STRING" ||
                (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))) {
            props.label = toks[1].value;
            j = 2;
        }
        // Parse remaining key=value props
        while (j < toks.length - 1) {
            const k = toks[j];
            const eq = toks[j + 1];
            if (eq && eq.type === "EQUALS" && j + 2 < toks.length) {
                props[k.value] = toks[j + 2].value;
                j += 3;
            }
            else
                j++;
        }
        // Support multiline via literal \n in label string
        const rawLabel = props.label ?? id;
        return {
            kind: "note",
            id,
            label: rawLabel.replace(/\\n/g, "\n"),
            theme: props.theme,
            style: propsToStyle(props),
            ...(props.width ? { width: parseFloat(props.width) } : {}),
            ...(props.height ? { height: parseFloat(props.height) } : {}),
        };
    }
    // ── parseGroup ───────────────────────────────────────────
    function parseGroup(parentGroupId) {
        skip(); // 'group'
        const toks = lineTokens();
        let id = uid("group");
        if (toks[0])
            id = toks[0].value;
        const props = {};
        let j = 1;
        // Backward compat: second token is a quoted/bare string (old label syntax)
        if (toks[1] &&
            (toks[1].type === "STRING" ||
                (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))) {
            props.label = toks[1].value;
            j = 2;
        }
        // Parse remaining key=value props
        while (j < toks.length - 1) {
            const k = toks[j];
            const eq = toks[j + 1];
            if (eq && eq.type === "EQUALS" && j + 2 < toks.length) {
                props[k.value] = toks[j + 2].value;
                j += 3;
            }
            else
                j++;
        }
        const group = {
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
            width: props.width !== undefined ? parseFloat(props.width) : undefined, // ← add
            height: props.height !== undefined ? parseFloat(props.height) : undefined,
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
            // ── Nested group ──────────────────────────────────
            if (v === "group" || v === "bare") {
                const isBare = v === "bare";
                const nested = parseGroup();
                if (isBare) {
                    nested.label = "";
                    nested.style = {
                        ...nested.style,
                        fill: nested.style?.fill ?? "none",
                        stroke: nested.style?.stroke ?? "none",
                        strokeWidth: nested.style?.strokeWidth ?? 0,
                    };
                }
                ast.groups.push(nested);
                groupIds.add(nested.id);
                group.children.push({ kind: "group", id: nested.id });
                continue;
            }
            // ── Table ─────────────────────────────────────────
            if (v === "table") {
                const tbl = parseTable();
                ast.tables.push(tbl);
                tableIds.add(tbl.id);
                group.children.push({ kind: "table", id: tbl.id });
                continue;
            }
            // ── Note ──────────────────────────────────────────
            if (v === "note") {
                const note = parseNote(id);
                ast.notes.push(note);
                noteIds.add(note.id);
                group.children.push({ kind: "note", id: note.id });
                continue;
            }
            // ── Markdown ───────────────────────────────────────
            if (v === "markdown") {
                const md = parseMarkdown(id);
                ast.markdowns.push(md);
                markdownIds.add(md.id);
                group.children.push({ kind: "markdown", id: md.id });
                continue;
            }
            if (v === "bare") {
                // treat exactly like 'group' but inject defaults
                const grp = parseGroup(); // reuse parseGroup
                grp.label = "";
                grp.style = { ...grp.style, stroke: "none", fill: "none" };
                // rest is identical to group handling
            }
            // ── Chart ──────────────────────────────────────────
            if (CHART_TYPES.includes(v)) {
                const chart = parseChart(v);
                ast.charts.push(chart);
                chartIds.add(chart.id);
                group.children.push({ kind: "chart", id: chart.id });
                continue;
            }
            // ── Node shape ────────────────────────────────────
            if (SHAPES.includes(v)) {
                const node = parseNode(v, id);
                if (!nodeIds.has(node.id)) {
                    nodeIds.add(node.id);
                    ast.nodes.push(node);
                }
                group.children.push({ kind: "node", id: node.id });
                continue;
            }
            // ── Edge inside group ─────────────────────────────
            if (cur().type === "IDENT" ||
                cur().type === "STRING" ||
                cur().type === "KEYWORD") {
                const nextTok = flat[i + 1];
                if (nextTok && nextTok.type === "ARROW") {
                    const lineToks = lineTokens();
                    if (lineToks.length >= 3 && lineToks[1].type === "ARROW") {
                        const fromId = lineToks[0].value;
                        const conn = lineToks[1].value;
                        const edge = parseEdge(fromId, conn, lineToks.slice(2));
                        ast.edges.push(edge);
                    }
                    continue;
                }
            }
            skip();
        }
        if (cur().type === "RBRACE")
            skip();
        return group;
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
        for (let j = 2; j < toks.length; j++) {
            const k = toks[j]?.value;
            const eq = toks[j + 1];
            const vt = toks[j + 2];
            // key=value form
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
                if (k === "fill") {
                    step.value = vt.value;
                    j += 2;
                    continue;
                }
                if (k === "color") {
                    step.value = vt.value;
                    j += 2;
                    continue;
                }
            }
            // bare key value (legacy)
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
                continue;
            }
        }
        return step;
    }
    // function parseStep(): ASTStep {
    //   skip(); // 'step'
    //   const toks = lineTokens();
    //   const action = (toks[0]?.value ?? "highlight") as AnimationAction;
    //   let target = toks[1]?.value ?? "";
    //   if (toks[2]?.type === "ARROW" && toks[3]) {
    //     target = `${toks[1].value}${toks[2].value}${toks[3].value}`;
    //   }
    //   const step: ASTStep = { kind: "step", action, target };
    //   for (let j = 2; j < toks.length - 1; j++) {
    //     const k = toks[j].value;
    //     const eq = toks[j + 1];
    //     const vt = toks[j + 2];
    //     // key=value form (dx=50, dy=-80, duration=600)
    //     if (eq?.type === "EQUALS" && vt) {
    //       if (k === "dx") {
    //         step.dx = parseFloat(vt.value);
    //         j += 2;
    //         continue;
    //       }
    //       if (k === "dy") {
    //         step.dy = parseFloat(vt.value);
    //         j += 2;
    //         continue;
    //       }
    //       if (k === "duration") {
    //         step.duration = parseFloat(vt.value);
    //         j += 2;
    //         continue;
    //       }
    //       if (k === "delay") {
    //         step.delay = parseFloat(vt.value);
    //         j += 2;
    //         continue;
    //       }
    //     }
    //     // bare key value form (legacy: delay 500, duration 400)
    //     if (k === "delay" && eq?.type === "NUMBER") {
    //       step.delay = parseFloat(eq.value);
    //       j++;
    //     }
    //     if (k === "duration" && eq?.type === "NUMBER") {
    //       step.duration = parseFloat(eq.value);
    //       j++;
    //     }
    //     if (k === "trigger") {
    //       step.trigger = eq?.value as AnimationTrigger;
    //       j++;
    //     }
    //     if (k === "factor") {
    //       step.factor = parseFloat(vt.value);
    //       j += 2;
    //       continue;
    //     }
    //     if (k === "deg") {
    //       step.deg = parseFloat(vt.value);
    //       j += 2;
    //       continue;
    //     }
    //   }
    //   return step;
    // }
    function parseChart(chartType) {
        skip();
        const toks = lineTokens();
        const id = toks[0]?.value ?? uid("chart");
        const props = {};
        let j = 1;
        while (j < toks.length - 1) {
            const k = toks[j];
            const eq = toks[j + 1];
            if (eq?.type === "EQUALS" && j + 2 < toks.length) {
                props[k.value] = toks[j + 2].value;
                j += 3;
            }
            else
                j++;
        }
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
                const k = cur().value;
                skip();
                skip();
                props[k] = cur().value;
                skip();
            }
            else if (SHAPES.includes(v) ||
                v === "step" ||
                v === "group" ||
                v === "note" || // ← ADD
                v === "table" ||
                v === "config" || // ← ADD
                v === "theme" || // ← ADD
                v === "style" ||
                v === "markdown" ||
                CHART_TYPES.includes(v)) {
                break;
            }
            else if (peek1().type === "ARROW") {
                // ← ADD THIS WHOLE BLOCK
                break;
            }
            else
                skip();
        }
        const headers = dataRows[0]?.map(String) ?? [];
        const rows = dataRows.slice(1);
        return {
            kind: "chart",
            id,
            chartType: chartType.replace("-chart", ""),
            title: props.title,
            data: { headers, rows },
            width: props.width ? parseFloat(props.width) : undefined,
            height: props.height ? parseFloat(props.height) : undefined,
            theme: props.theme,
            style: propsToStyle(props),
        };
    }
    function parseTable() {
        skip(); // 'table'
        const toks = lineTokens();
        let id = uid("table");
        if (toks[0])
            id = toks[0].value;
        const props = {};
        let j = 1;
        // label="..." or bare second token
        if (toks[1] &&
            (toks[1].type === "STRING" ||
                (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))) {
            props.label = toks[1].value;
            j = 2;
        }
        while (j < toks.length - 1) {
            const k = toks[j], eq = toks[j + 1];
            if (eq?.type === "EQUALS" && j + 2 < toks.length) {
                props[k.value] = toks[j + 2].value;
                j += 3;
            }
            else
                j++;
        }
        const table = {
            kind: "table",
            id,
            label: props.label ?? id,
            rows: [],
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
                        cur().type === "NUMBER") {
                        cells.push(cur().value);
                    }
                    skip();
                }
                if (cur().type === "NEWLINE")
                    skip();
                table.rows.push({ kind: v === "header" ? "header" : "data", cells });
            }
            else
                skip();
        }
        if (cur().type === "RBRACE")
            skip();
        return table;
    }
    // ── parseMarkdown ─────────────────────────────────────────
    function parseMarkdown(groupId) {
        skip(); // 'markdown'
        const toks = lineTokens();
        let id = groupId ? groupId + "_" + uid("md") : uid("md");
        if (toks[0])
            id = toks[0].value;
        const props = {};
        let j = 1;
        while (j < toks.length - 1) {
            const k = toks[j], eq = toks[j + 1];
            if (eq?.type === "EQUALS" && j + 2 < toks.length) {
                props[k.value] = toks[j + 2].value;
                j += 3;
            }
            else
                j++;
        }
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
            width: props.width ? parseFloat(props.width) : undefined,
            height: props.height ? parseFloat(props.height) : undefined,
            theme: props.theme,
            style: propsToStyle(props),
        };
    }
    // ── Main parse loop ─────────────────────────────────────
    skipNL();
    if (cur().value === "diagram")
        skip();
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
            skip();
            continue;
        }
        if (v === "end")
            break;
        // direction — silently ignored (removed from engine)
        if (v === "direction") {
            lineTokens();
            continue;
        }
        // layout
        if (v === "layout") {
            skip();
            ast.layout = cur().value ?? "column";
            skip();
            continue;
        }
        // title
        if (v === "title") {
            skip();
            const toks = lineTokens();
            const labelProp = toks.find((t2, idx) => t2.value === "label" && toks[idx + 1]?.type === "EQUALS");
            if (labelProp) {
                const idx = toks.indexOf(labelProp);
                ast.title = toks[idx + 2]?.value ?? "";
            }
            else {
                ast.title = toks
                    .map((t2) => t2.value)
                    .join(" ")
                    .replace(/"/g, "");
            }
            continue;
        }
        // description
        if (v === "description") {
            skip();
            ast.description = lineTokens()
                .map((t2) => t2.value)
                .join(" ")
                .replace(/"/g, "");
            continue;
        }
        // config
        if (v === "config") {
            skip();
            const k = cur().value;
            skip();
            if (cur().type === "EQUALS")
                skip();
            const cv = cur().value;
            skip();
            ast.config[k] = cv;
            continue;
        }
        // style
        if (v === "style") {
            skip();
            const targetId = cur().value;
            skip();
            const lineToks = lineTokens();
            const p = {};
            let j = 0;
            while (j < lineToks.length - 1) {
                const k2 = lineToks[j];
                const eq = lineToks[j + 1];
                if (eq.type === "EQUALS") {
                    p[k2.value] = lineToks[j + 2]?.value ?? "";
                    j += 3;
                }
                else
                    j++;
            }
            ast.styles[targetId] = { ...ast.styles[targetId], ...propsToStyle(p) };
            continue;
        }
        // theme
        if (v === "theme") {
            skip();
            const toks = lineTokens();
            const themeId = toks[0]?.value;
            if (!themeId)
                continue;
            const props = {};
            let j = 1;
            while (j < toks.length - 1) {
                const k2 = toks[j];
                const eq = toks[j + 1];
                if (eq && eq.type === "EQUALS" && j + 2 < toks.length) {
                    props[k2.value] = toks[j + 2].value;
                    j += 3;
                }
                else
                    j++;
            }
            ast.themes[themeId] = propsToStyle(props);
            continue;
        }
        // group
        if (v === "group" || v === "bare") {
            const isBare = v === "bare";
            const grp = parseGroup();
            if (isBare) {
                grp.label = "";
                grp.style = {
                    ...grp.style,
                    fill: grp.style?.fill ?? "none",
                    stroke: grp.style?.stroke ?? "none",
                    strokeWidth: grp.style?.strokeWidth ?? 0,
                };
            }
            ast.groups.push(grp);
            groupIds.add(grp.id);
            ast.rootOrder.push({ kind: "group", id: grp.id });
            continue;
        }
        // table
        if (v === "table") {
            const tbl = parseTable();
            ast.tables.push(tbl);
            tableIds.add(tbl.id);
            ast.rootOrder.push({ kind: "table", id: tbl.id });
            continue;
        }
        // note
        if (v === "note") {
            const note = parseNote();
            ast.notes.push(note);
            noteIds.add(note.id);
            ast.rootOrder.push({ kind: "note", id: note.id });
            continue;
        }
        // step
        if (v === "step") {
            ast.steps.push(parseStep());
            continue;
        }
        // charts
        if (CHART_TYPES.includes(v)) {
            const chart = parseChart(v);
            ast.charts.push(chart);
            chartIds.add(chart.id);
            ast.rootOrder.push({ kind: "chart", id: chart.id }); // ← ADD
            continue;
        }
        if (v === "markdown") {
            const md = parseMarkdown();
            ast.markdowns.push(md);
            markdownIds.add(md.id);
            ast.rootOrder.push({ kind: "markdown", id: md.id });
            continue;
        }
        // edge:  A -> B  (MUST come before shape check)
        if (t.type === "IDENT" || t.type === "STRING" || t.type === "KEYWORD") {
            const nextTok = flat[i + 1];
            if (nextTok && nextTok.type === "ARROW") {
                const lineToks = lineTokens();
                if (lineToks.length >= 3 && lineToks[1].type === "ARROW") {
                    const fromId = lineToks[0].value;
                    const conn = lineToks[1].value;
                    const edge = parseEdge(fromId, conn, lineToks.slice(2));
                    ast.edges.push(edge);
                    // Auto-create implied nodes if they don't exist yet
                    for (const nid of [fromId, edge.to]) {
                        if (!nodeIds.has(nid) &&
                            !tableIds.has(nid) &&
                            !noteIds.has(nid) &&
                            !chartIds.has(nid) &&
                            !groupIds.has(nid)) {
                            nodeIds.add(nid);
                            ast.nodes.push({
                                kind: "node",
                                id: nid,
                                shape: "box",
                                label: nid,
                                style: {},
                            });
                        }
                    }
                    continue;
                }
            }
        }
        // node shapes — only reached if NOT followed by an arrow
        if (SHAPES.includes(v)) {
            const node = parseNode(v);
            if (!nodeIds.has(node.id)) {
                nodeIds.add(node.id);
                ast.nodes.push(node);
                ast.rootOrder.push({ kind: "node", id: node.id });
            }
            continue;
        }
        skip();
    }
    // Merge global styles into node styles
    for (const node of ast.nodes) {
        if (ast.styles[node.id]) {
            node.style = { ...ast.styles[node.id], ...node.style };
        }
    }
    return ast;
}

// ============================================================
// sketchmark — Markdown inline parser
// Supports: # h1  ## h2  ### h3  **bold**  *italic*  blank lines
// ============================================================
// ── Font sizes per line kind ──────────────────────────────
const LINE_FONT_SIZE = {
    h1: 40,
    h2: 28,
    h3: 20,
    p: 15,
    blank: 0,
};
const LINE_FONT_WEIGHT = {
    h1: 700,
    h2: 600,
    h3: 600,
    p: 400,
    blank: 400,
};
// Spacing below each line kind (px)
const LINE_SPACING = {
    h1: 52,
    h2: 38,
    h3: 28,
    p: 22,
    blank: 10,
};
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
function calcMarkdownHeight(lines, pad = 16) {
    let h = pad * 2; // top + bottom
    for (const line of lines)
        h += LINE_SPACING[line.kind];
    return h;
}

// ============================================================
// sketchmark — Scene Graph
// ============================================================
// ── Build scene graph from AST ────────────────────────────
function buildSceneGraph(ast) {
    const nodes = ast.nodes.map((n) => {
        const themeStyle = n.theme ? (ast.themes[n.theme] ?? {}) : {};
        return {
            id: n.id,
            shape: n.shape,
            label: n.label,
            style: { ...ast.styles[n.id], ...themeStyle, ...n.style },
            groupId: n.groupId,
            width: n.width,
            height: n.height,
            meta: n.meta,
            imageUrl: n.imageUrl,
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
            parentId: undefined, // set below
            children: g.children,
            layout: (g.layout ?? "column"),
            columns: g.columns ?? 1,
            padding: g.padding ?? 26,
            gap: g.gap ?? 10,
            align: (g.align ?? "start"),
            justify: (g.justify ?? "start"),
            style: { ...ast.styles[g.id], ...themeStyle, ...g.style },
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
            rowH: 30,
            headerH: 34,
            labelH: 22,
            style: { ...ast.styles[t.id], ...themeStyle, ...t.style },
            x: 0,
            y: 0,
            w: 0,
            h: 0,
        };
    });
    const notes = ast.notes.map((n) => {
        const themeStyle = n.theme ? (ast.themes[n.theme] ?? {}) : {};
        return {
            id: n.id,
            lines: n.label.split("\n"),
            style: { ...ast.styles[n.id], ...themeStyle, ...n.style },
            x: 0,
            y: 0,
            w: 0,
            h: 0,
            width: n.width,
            height: n.height,
        };
    });
    const charts = ast.charts.map((c) => {
        const themeStyle = c.theme ? (ast.themes[c.theme] ?? {}) : {};
        return {
            id: c.id,
            chartType: c.chartType,
            title: c.title,
            data: c.data,
            style: { ...ast.styles[c.id], ...themeStyle, ...c.style },
            x: 0,
            y: 0,
            w: c.width ?? 320,
            h: c.height ?? 240,
        };
    });
    const markdowns = (ast.markdowns ?? []).map(m => {
        const themeStyle = m.theme ? (ast.themes[m.theme] ?? {}) : {};
        return {
            id: m.id,
            content: m.content,
            lines: parseMarkdownContent(m.content),
            style: { ...themeStyle, ...m.style },
            width: m.width,
            height: m.height,
            x: 0, y: 0, w: 0, h: 0,
        };
    });
    // Set parentId for nested groups
    for (const g of groups) {
        for (const child of g.children) {
            if (child.kind === "group") {
                const nested = groups.find((gg) => gg.id === child.id);
                if (nested)
                    nested.parentId = g.id;
            }
        }
    }
    const edges = ast.edges.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        connector: e.connector,
        label: e.label,
        dashed: e.dashed ?? false,
        bidirectional: e.bidirectional ?? false,
        style: e.style ?? {},
    }));
    return {
        title: ast.title,
        description: ast.description,
        layout: ast.layout,
        nodes,
        edges,
        groups,
        tables,
        notes,
        charts,
        markdowns,
        animation: { steps: ast.steps, currentStep: -1 },
        styles: ast.styles,
        config: ast.config,
        rootOrder: ast.rootOrder ?? [],
        width: 0,
        height: 0,
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
function noteMap(sg) {
    return new Map(sg.notes.map((n) => [n.id, n]));
}
function chartMap(sg) {
    return new Map(sg.charts.map((c) => [c.id, c]));
}
function markdownMap(sg) {
    return new Map((sg.markdowns ?? []).map(m => [m.id, m]));
}

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
// ── Constants ─────────────────────────────────────────────
const FONT_PX_PER_CHAR = 8.6;
const MIN_W = 90;
const MAX_W = 180;
const BASE_PAD = 26;
const GROUP_LABEL_H = 22;
const DEFAULT_MARGIN = 60;
const DEFAULT_GAP_MAIN = 80;
// Table sizing
const CELL_PAD = 20; // total horizontal padding per cell (left + right)
const MIN_COL_W = 50; // minimum column width
const TBL_FONT = 7.5; // px per char at 12px sans-serif
const NOTE_LINE_H = 20;
const NOTE_PAD_X = 16;
const NOTE_PAD_Y = 12;
const NOTE_FONT = 7.5;
// ── Node auto-sizing ──────────────────────────────────────
function sizeNode(n) {
    // User-specified dimensions win
    if (n.width && n.width > 0)
        n.w = n.width;
    if (n.height && n.height > 0)
        n.h = n.height;
    const labelW = Math.round(n.label.length * FONT_PX_PER_CHAR + BASE_PAD);
    switch (n.shape) {
        case "circle":
            n.w = n.w || Math.max(84, Math.min(MAX_W, labelW));
            n.h = n.h || n.w;
            break;
        case "diamond":
            n.w = n.w || Math.max(130, Math.min(MAX_W, labelW + 30));
            n.h = n.h || Math.max(62, n.w * 0.46);
            break;
        case "hexagon":
            n.w = n.w || Math.max(126, Math.min(MAX_W, labelW + 20));
            n.h = n.h || Math.max(54, n.w * 0.44);
            break;
        case "triangle":
            n.w = n.w || Math.max(108, Math.min(MAX_W, labelW + 10));
            n.h = n.h || Math.max(64, n.w * 0.6);
            break;
        case "cylinder":
            n.w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW));
            n.h = n.h || 66;
            break;
        case "parallelogram":
            n.w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW + 28));
            n.h = n.h || 50;
            break;
        case "text": {
            const fontSize = Number(n.style?.fontSize ?? 13);
            const charWidth = fontSize * 0.55;
            const pad = Number(n.style?.padding ?? 8) * 2;
            if (n.width) {
                // User set width → word-wrap within it
                const approxLines = Math.ceil((n.label.length * charWidth) / (n.width - pad));
                n.w = n.width;
                n.h = n.height ?? Math.max(24, approxLines * fontSize * 1.5 + pad);
            }
            else {
                // Auto-size to content
                const lines = n.label.split("\\n");
                const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), "");
                n.w = Math.max(MIN_W, Math.round(longest.length * charWidth + pad));
                n.h = n.height ?? Math.max(24, lines.length * fontSize * 1.5 + pad);
            }
            break;
        }
        default:
            n.w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW));
            n.h = n.h || 52;
            break;
    }
}
function sizeNote(n) {
    const maxChars = Math.max(...n.lines.map((l) => l.length));
    n.w = Math.max(120, Math.ceil(maxChars * NOTE_FONT) + NOTE_PAD_X * 2);
    n.h = n.lines.length * NOTE_LINE_H + NOTE_PAD_Y * 2;
    if (n.width && n.w < n.width)
        n.w = n.width; // ← add
    if (n.height && n.h < n.height)
        n.h = n.height; // ← add
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
    const colW = Array(numCols).fill(MIN_COL_W);
    for (const row of rows) {
        row.cells.forEach((cell, i) => {
            colW[i] = Math.max(colW[i], Math.ceil(cell.length * TBL_FONT) + CELL_PAD);
        });
    }
    t.colWidths = colW;
    t.w = colW.reduce((s, w) => s + w, 0);
    const nHeader = rows.filter((r) => r.kind === "header").length;
    const nData = rows.filter((r) => r.kind === "data").length;
    t.h = labelH + nHeader * headerH + nData * rowH;
}
function sizeChart(c) {
    c.w = c.w || 320;
    c.h = c.h || 240;
}
function sizeMarkdown(m) {
    const pad = Number(m.style?.padding ?? 16);
    m.w = m.width ?? 400;
    m.h = m.height ?? calcMarkdownHeight(m.lines, pad);
}
// ── Item size helpers ─────────────────────────────────────
function iW(r, nm, gm, tm, ntm, cm, mdm) {
    if (r.kind === "node")
        return nm.get(r.id).w;
    if (r.kind === "table")
        return tm.get(r.id).w;
    if (r.kind === "note")
        return ntm.get(r.id).w;
    if (r.kind === "chart")
        return cm.get(r.id).w;
    if (r.kind === "markdown")
        return mdm.get(r.id).w;
    return gm.get(r.id).w;
}
function iH(r, nm, gm, tm, ntm, cm, mdm) {
    if (r.kind === "node")
        return nm.get(r.id).h;
    if (r.kind === "table")
        return tm.get(r.id).h;
    if (r.kind === "note")
        return ntm.get(r.id).h;
    if (r.kind === "chart")
        return cm.get(r.id).h;
    if (r.kind === "markdown")
        return mdm.get(r.id).h;
    return gm.get(r.id).h;
}
function setPos(r, x, y, nm, gm, tm, ntm, cm, mdm) {
    if (r.kind === "node") {
        const n = nm.get(r.id);
        n.x = Math.round(x);
        n.y = Math.round(y);
        return;
    }
    if (r.kind === "table") {
        const t = tm.get(r.id);
        t.x = Math.round(x);
        t.y = Math.round(y);
        return;
    }
    if (r.kind === "note") {
        const nt = ntm.get(r.id);
        nt.x = Math.round(x);
        nt.y = Math.round(y);
        return;
    }
    if (r.kind === "chart") {
        const c = cm.get(r.id);
        c.x = Math.round(x);
        c.y = Math.round(y);
        return;
    }
    if (r.kind === "markdown") {
        const md = mdm.get(r.id);
        md.x = Math.round(x);
        md.y = Math.round(y);
        return;
    }
    const g = gm.get(r.id);
    g.x = Math.round(x);
    g.y = Math.round(y);
}
// ── Pass 1: Measure (bottom-up) ───────────────────────────
// Recursively computes w, h for a group from its children's sizes.
function measure(g, nm, gm, tm, ntm, cm, mdm) {
    // Recurse into nested groups first; size tables before reading their dims
    for (const r of g.children) {
        if (r.kind === "group")
            measure(gm.get(r.id), nm, gm, tm, ntm, cm, mdm);
        if (r.kind === "table")
            sizeTable(tm.get(r.id));
        if (r.kind === "note")
            sizeNote(ntm.get(r.id));
        if (r.kind === "chart")
            sizeChart(cm.get(r.id));
        if (r.kind === "markdown")
            sizeMarkdown(mdm.get(r.id));
    }
    const { padding: pad, gap, columns, layout } = g;
    const kids = g.children;
    const labelH = g.label ? GROUP_LABEL_H : 0;
    if (!kids.length) {
        g.w = pad * 2;
        g.h = pad * 2 + labelH;
        if (g.width && g.w < g.width)
            g.w = g.width;
        if (g.height && g.h < g.height)
            g.h = g.height;
        return;
    }
    const ws = kids.map((r) => iW(r, nm, gm, tm, ntm, cm, mdm));
    const hs = kids.map((r) => iH(r, nm, gm, tm, ntm, cm, mdm));
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
function place(g, nm, gm, tm, ntm, cm, mdm) {
    const { padding: pad, gap, columns, layout, align, justify } = g;
    const labelH = g.label ? GROUP_LABEL_H : 0;
    const contentX = g.x + pad;
    const contentY = g.y + labelH + pad;
    const contentW = g.w - pad * 2;
    const contentH = g.h - pad * 2 - labelH;
    const kids = g.children;
    if (!kids.length)
        return;
    if (layout === "row") {
        const ws = kids.map((r) => iW(r, nm, gm, tm, ntm, cm, mdm));
        const hs = kids.map((r) => iH(r, nm, gm, tm, ntm, cm, mdm));
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
            setPos(kids[i], x, y, nm, gm, tm, ntm, cm, mdm);
            x += ws[i] + (i < gaps.length ? gaps[i] : 0);
        }
    }
    else if (layout === "grid") {
        const cols = Math.max(1, columns);
        const cellW = Math.max(...kids.map((r) => iW(r, nm, gm, tm, ntm, cm, mdm)));
        const cellH = Math.max(...kids.map((r) => iH(r, nm, gm, tm, ntm, cm, mdm)));
        kids.forEach((ref, i) => {
            setPos(ref, contentX + (i % cols) * (cellW + gap), contentY + Math.floor(i / cols) * (cellH + gap), nm, gm, tm, ntm, cm, mdm);
        });
    }
    else {
        // column (default)
        const ws = kids.map((r) => iW(r, nm, gm, tm, ntm, cm, mdm));
        const hs = kids.map((r) => iH(r, nm, gm, tm, ntm, cm, mdm));
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
            setPos(kids[i], x, y, nm, gm, tm, ntm, cm, mdm);
            y += hs[i] + (i < gaps.length ? gaps[i] : 0);
        }
    }
    // Recurse into nested groups
    for (const r of kids) {
        if (r.kind === "group")
            place(gm.get(r.id), nm, gm, tm, ntm, cm, mdm);
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
function rectConnPoint$2(rx, ry, rw, rh, ox, oy) {
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
    const ntm = noteMap(sg);
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
        const nt = ntm.get(id);
        if (nt)
            return nt;
        return null;
    }
    function connPt(src, dstCX, dstCY) {
        // SceneNode has a .shape field; use the existing connPoint for it
        if ("shape" in src && src.shape) {
            return connPoint(src, {
                x: dstCX - 1,
                y: dstCY - 1,
                w: 2,
                h: 2});
        }
        return rectConnPoint$2(src.x, src.y, src.w, src.h, dstCX, dstCY);
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
        e.points = [connPt(src, dstCX, dstCY), connPt(dst, srcCX, srcCY)];
    }
}
function computeBounds(sg, margin) {
    const allX = [
        ...sg.nodes.map((n) => n.x + n.w),
        ...sg.groups.filter((g) => g.w).map((g) => g.x + g.w),
        ...sg.tables.map((t) => t.x + t.w),
        ...sg.notes.map((n) => n.x + n.w),
        ...sg.charts.map((c) => c.x + c.w),
        ...sg.markdowns.map((m) => m.x + m.w),
    ];
    const allY = [
        ...sg.nodes.map((n) => n.y + n.h),
        ...sg.groups.filter((g) => g.h).map((g) => g.y + g.h),
        ...sg.tables.map((t) => t.y + t.h),
        ...sg.notes.map((n) => n.y + n.h),
        ...sg.charts.map((c) => c.y + c.h),
        ...sg.markdowns.map((m) => m.y + m.h),
    ];
    sg.width = (allX.length ? Math.max(...allX) : 400) + margin;
    sg.height = (allY.length ? Math.max(...allY) : 300) + margin;
}
// ── Public entry point ────────────────────────────────────
function layout(sg) {
    const GAP_MAIN = Number(sg.config["gap"] ?? DEFAULT_GAP_MAIN);
    const MARGIN = Number(sg.config["margin"] ?? DEFAULT_MARGIN);
    const nm = nodeMap(sg);
    const gm = groupMap(sg);
    const tm = tableMap(sg);
    const ntm = noteMap(sg);
    const cm = chartMap(sg);
    const mdm = markdownMap(sg);
    // 1. Size all nodes and tables
    sg.nodes.forEach(sizeNode);
    sg.tables.forEach(sizeTable);
    sg.notes.forEach(sizeNote);
    sg.charts.forEach(sizeChart);
    sg.markdowns.forEach(sizeMarkdown);
    // src/layout/index.ts — after sg.charts.forEach(sizeChart);
    // 2. Identify root vs nested items
    const nestedGroupIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "group").map((c) => c.id)));
    const groupedNodeIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "node").map((c) => c.id)));
    const groupedTableIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "table").map((c) => c.id)));
    const groupedNoteIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "note").map((c) => c.id)));
    const groupedChartIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "chart").map((c) => c.id)));
    const groupedMarkdownIds = new Set(sg.groups.flatMap((g) => g.children.filter((c) => c.kind === "markdown").map((c) => c.id)));
    const rootGroups = sg.groups.filter((g) => !nestedGroupIds.has(g.id));
    const rootNodes = sg.nodes.filter((n) => !groupedNodeIds.has(n.id));
    const rootTables = sg.tables.filter((t) => !groupedTableIds.has(t.id));
    const rootNotes = sg.notes.filter((n) => !groupedNoteIds.has(n.id));
    const rootCharts = sg.charts.filter((c) => !groupedChartIds.has(c.id));
    const rootMarkdowns = sg.markdowns.filter((m) => !groupedMarkdownIds.has(m.id));
    // 3. Measure root groups bottom-up
    for (const g of rootGroups)
        measure(g, nm, gm, tm, ntm, cm, mdm);
    // 4. Build root order
    //    sg.rootOrder preserves DSL declaration order.
    //    Fall back: groups, then nodes, then tables.
    const rootOrder = sg.rootOrder?.length
        ? sg.rootOrder
        : [
            ...rootGroups.map((g) => ({ kind: "group", id: g.id })),
            ...rootNodes.map((n) => ({ kind: "node", id: n.id })),
            ...rootTables.map((t) => ({ kind: "table", id: t.id })),
            ...rootNotes.map((n) => ({ kind: "note", id: n.id })),
            ...rootCharts.map((c) => ({ kind: "chart", id: c.id })),
            ...rootMarkdowns.map((m) => ({ kind: "markdown", id: m.id })),
        ];
    // 5. Root-level layout
    //    sg.layout:
    //      'row'    → items flow left to right  (default)
    //      'column' → items flow top to bottom
    //      'grid'   → config columns=N grid
    const rootLayout = (sg.layout ?? "row");
    const rootCols = Number(sg.config["columns"] ?? 1);
    const useGrid = rootLayout === "grid" && rootCols > 0;
    const useColumn = rootLayout === "column";
    if (useGrid) {
        // ── Grid: per-row heights, per-column widths (no wasted space) ──
        const cols = rootCols;
        const rows = Math.ceil(rootOrder.length / cols);
        const colWidths = Array(cols).fill(0);
        const rowHeights = Array(rows).fill(0);
        rootOrder.forEach((ref, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            let w = 0, h = 0;
            if (ref.kind === "group") {
                w = gm.get(ref.id).w;
                h = gm.get(ref.id).h;
            }
            else if (ref.kind === "table") {
                w = tm.get(ref.id).w;
                h = tm.get(ref.id).h;
            }
            else if (ref.kind === "note") {
                w = ntm.get(ref.id).w;
                h = ntm.get(ref.id).h;
            }
            else if (ref.kind === "chart") {
                w = cm.get(ref.id).w;
                h = cm.get(ref.id).h;
            }
            else if (ref.kind === "markdown") {
                w = mdm.get(ref.id).w;
                h = mdm.get(ref.id).h;
            }
            else {
                w = nm.get(ref.id).w;
                h = nm.get(ref.id).h;
            }
            colWidths[col] = Math.max(colWidths[col], w);
            rowHeights[row] = Math.max(rowHeights[row], h);
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
            const x = colX[idx % cols];
            const y = rowY[Math.floor(idx / cols)];
            if (ref.kind === "group") {
                gm.get(ref.id).x = x;
                gm.get(ref.id).y = y;
            }
            else if (ref.kind === "table") {
                tm.get(ref.id).x = x;
                tm.get(ref.id).y = y;
            }
            else if (ref.kind === "note") {
                ntm.get(ref.id).x = x;
                ntm.get(ref.id).y = y;
            }
            else if (ref.kind === "chart") {
                cm.get(ref.id).x = x;
                cm.get(ref.id).y = y;
            }
            else if (ref.kind === "markdown") {
                mdm.get(ref.id).x = x;
                mdm.get(ref.id).y = y;
            }
            else {
                nm.get(ref.id).x = x;
                nm.get(ref.id).y = y;
            }
        });
    }
    else {
        // ── Row or Column linear flow ──────────────────────────
        let pos = MARGIN;
        for (const ref of rootOrder) {
            let w = 0, h = 0;
            if (ref.kind === "group") {
                w = gm.get(ref.id).w;
                h = gm.get(ref.id).h;
            }
            else if (ref.kind === "table") {
                w = tm.get(ref.id).w;
                h = tm.get(ref.id).h;
            }
            else if (ref.kind === "note") {
                w = ntm.get(ref.id).w;
                h = ntm.get(ref.id).h;
            }
            else if (ref.kind === "chart") {
                w = cm.get(ref.id).w;
                h = cm.get(ref.id).h;
            }
            else if (ref.kind === "markdown") {
                w = mdm.get(ref.id).w;
                h = mdm.get(ref.id).h;
            }
            else {
                w = nm.get(ref.id).w;
                h = nm.get(ref.id).h;
            }
            const x = useColumn ? MARGIN : pos;
            const y = useColumn ? pos : MARGIN;
            if (ref.kind === "group") {
                gm.get(ref.id).x = x;
                gm.get(ref.id).y = y;
            }
            else if (ref.kind === "table") {
                tm.get(ref.id).x = x;
                tm.get(ref.id).y = y;
            }
            else if (ref.kind === "note") {
                ntm.get(ref.id).x = x;
                ntm.get(ref.id).y = y;
            }
            else if (ref.kind === "chart") {
                cm.get(ref.id).x = x;
                cm.get(ref.id).y = y;
            }
            else if (ref.kind === "markdown") {
                mdm.get(ref.id).x = x;
                mdm.get(ref.id).y = y;
            }
            else {
                nm.get(ref.id).x = x;
                nm.get(ref.id).y = y;
            }
            pos += (useColumn ? h : w) + GAP_MAIN;
        }
    }
    // 6. Place children within each root group (top-down, recursive)
    for (const g of rootGroups)
        place(g, nm, gm, tm, ntm, cm, mdm);
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
    const titleH = c.title ? 24 : 8;
    const padL = 44, padR = 12, padB = 28, padT = 6;
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
const NS$1 = 'http://www.w3.org/2000/svg';
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
function hashStr$4(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++)
        h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
    return h;
}
const BASE = { roughness: 1.2, bowing: 0.7 };
// ── Axes ───────────────────────────────────────────────────
function drawAxes$1(rc, g, c, px, py, pw, ph, allY, labelCol, font = 'system-ui, sans-serif') {
    // Y axis
    g.appendChild(rc.line(px, py, px, py + ph, {
        roughness: 0.4, seed: hashStr$4(c.id + 'ya'), stroke: labelCol, strokeWidth: 1,
    }));
    // X axis (baseline)
    const baseline = makeValueToY(allY, py, ph)(0);
    g.appendChild(rc.line(px, baseline, px + pw, baseline, {
        roughness: 0.4, seed: hashStr$4(c.id + 'xa'), stroke: labelCol, strokeWidth: 1,
    }));
    // Y ticks + labels
    const toY = makeValueToY(allY, py, ph);
    for (const tick of yTicks(allY)) {
        const ty = toY(tick);
        if (ty < py - 2 || ty > py + ph + 2)
            continue;
        g.appendChild(rc.line(px - 3, ty, px, ty, {
            roughness: 0.2, seed: hashStr$4(c.id + 'yt' + tick), stroke: labelCol, strokeWidth: 0.7,
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
        ...BASE, seed: hashStr$4(c.id),
        fill: bgFill, fillStyle: 'solid',
        stroke: bgStroke, strokeWidth: Number(s.strokeWidth ?? 1.2),
        ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
    }));
    // Title
    if (c.title) {
        cg.appendChild(mkT(c.title, c.x + c.w / 2, c.y + 14, cFontSize, cFontWeight, lc, 'middle', cFont));
    }
    const { px, py, pw, ph, cx, cy } = chartLayout(c);
    // ── Pie / Donut ──────────────────────────────────────────
    if (c.chartType === 'pie' || c.chartType === 'donut') {
        const { segments, total } = parsePie(c.data);
        const r = Math.min(c.w * 0.38, (c.h - (c.title ? 24 : 8)) * 0.44);
        const ir = c.chartType === 'donut' ? r * 0.48 : 0;
        const legendX = c.x + 8;
        const legendY = c.y + (c.title ? 28 : 12);
        let angle = -Math.PI / 2;
        for (const seg of segments) {
            const sweep = (seg.value / total) * Math.PI * 2;
            const d = c.chartType === 'donut'
                ? donutArcPath(cx, cy, r, ir, angle, angle + sweep)
                : pieArcPath(cx, cy, r, angle, angle + sweep);
            cg.appendChild(rc.path(d, {
                roughness: 1.0, bowing: 0.5, seed: hashStr$4(c.id + seg.label),
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
        cg.appendChild(rc.line(px, py, px, py + ph, { roughness: 0.4, seed: hashStr$4(c.id + 'ya'), stroke: lc, strokeWidth: 1 }));
        cg.appendChild(rc.line(px, py + ph, px + pw, py + ph, { roughness: 0.4, seed: hashStr$4(c.id + 'xa'), stroke: lc, strokeWidth: 1 }));
        pts.forEach((pt, i) => {
            cg.appendChild(rc.ellipse(toX(pt.x), toY(pt.y), 10, 10, {
                roughness: 0.8, seed: hashStr$4(c.id + pt.label),
                fill: CHART_COLORS[i % CHART_COLORS.length] + '99',
                fillStyle: 'solid',
                stroke: CHART_COLORS[i % CHART_COLORS.length],
                strokeWidth: 1.2,
            }));
        });
        legend(cg, pts.map(p => p.label), CHART_COLORS, c.x + 8, c.y + (c.title ? 28 : 12), lc, cFont);
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
                    seed: hashStr$4(c.id + si + i),
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
                    roughness: 0.5, seed: hashStr$4(c.id + 'af' + si),
                    fill: ser.color + '44',
                    fillStyle: 'solid',
                    stroke: 'none',
                }));
            }
            // Line segments
            for (let i = 0; i < pts.length - 1; i++) {
                cg.appendChild(rc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], {
                    roughness: 0.9, bowing: 0.6,
                    seed: hashStr$4(c.id + si + i),
                    stroke: ser.color,
                    strokeWidth: 1.8,
                }));
            }
            // Point dots
            pts.forEach(([px2, py2], i) => {
                cg.appendChild(rc.ellipse(px2, py2, 7, 7, {
                    roughness: 0.3, seed: hashStr$4(c.id + 'dot' + si + i),
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
// sketchmark — SVG Renderer  (rough.js hand-drawn)
// ============================================================
const NS = "http://www.w3.org/2000/svg";
const se = (tag) => document.createElementNS(NS, tag);
function hashStr$3(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++)
        h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
    return h;
}
const BASE_ROUGH = { roughness: 1.3, bowing: 0.7 };
/** Darken a CSS hex colour by `amount` (0–1). Falls back to input for non-hex. */
function darkenHex$1(hex, amount = 0.12) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m)
        return hex;
    const d = (v) => Math.max(0, Math.round(parseInt(v, 16) * (1 - amount)));
    return `#${d(m[1]).toString(16).padStart(2, "0")}${d(m[2]).toString(16).padStart(2, "0")}${d(m[3]).toString(16).padStart(2, "0")}`;
}
// ── Small helper: load + resolve font from style or fall back ─────────────
function resolveStyleFont$1(style, fallback) {
    const raw = String(style["font"] ?? "");
    if (!raw)
        return fallback;
    loadFont(raw);
    return resolveFont(raw);
}
function wrapText$1(text, maxWidth, fontSize) {
    const words = text.split(' ');
    const charsPerPx = fontSize * 0.55; // approximate
    const maxChars = Math.floor(maxWidth / charsPerPx);
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
    return lines;
}
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
// ── Arrow direction from connector ────────────────────────────────────────
function connMeta$1(connector) {
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
// ── Generic rect connection point ─────────────────────────────────────────
function rectConnPoint$1(rx, ry, rw, rh, ox, oy) {
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
function resolveEndpoint$1(id, nm, tm, gm, cm, ntm) {
    return (nm.get(id) ?? tm.get(id) ?? gm.get(id) ?? cm.get(id) ?? ntm.get(id) ?? null);
}
function getConnPoint$1(src, dstCX, dstCY) {
    if ("shape" in src && src.shape) {
        return connPoint(src, {
            x: dstCX - 1,
            y: dstCY - 1,
            w: 2,
            h: 2});
    }
    return rectConnPoint$1(src.x, src.y, src.w, src.h, dstCX, dstCY);
}
// ── Group depth (for paint order) ─────────────────────────────────────────
function groupDepth$1(g, gm) {
    let d = 0;
    let cur = g;
    while (cur?.parentId) {
        d++;
        cur = gm.get(cur.parentId);
    }
    return d;
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
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const hw = n.w / 2 - 2;
    switch (n.shape) {
        case "circle":
            return [rc.ellipse(cx, cy, n.w * 0.88, n.h * 0.88, opts)];
        case "diamond":
            return [
                rc.polygon([
                    [cx, n.y + 2],
                    [cx + hw, cy],
                    [cx, n.y + n.h - 2],
                    [cx - hw, cy],
                ], opts),
            ];
        case "hexagon": {
            const hw2 = hw * 0.56;
            return [
                rc.polygon([
                    [cx - hw2, n.y + 3],
                    [cx + hw2, n.y + 3],
                    [cx + hw, cy],
                    [cx + hw2, n.y + n.h - 3],
                    [cx - hw2, n.y + n.h - 3],
                    [cx - hw, cy],
                ], opts),
            ];
        }
        case "triangle":
            return [
                rc.polygon([
                    [cx, n.y + 3],
                    [n.x + n.w - 3, n.y + n.h - 3],
                    [n.x + 3, n.y + n.h - 3],
                ], opts),
            ];
        case "parallelogram":
            return [
                rc.polygon([
                    [n.x + 18, n.y + 1],
                    [n.x + n.w - 1, n.y + 1],
                    [n.x + n.w - 18, n.y + n.h - 1],
                    [n.x + 1, n.y + n.h - 1],
                ], opts),
            ];
        case "cylinder": {
            const eH = 18;
            return [
                rc.rectangle(n.x + 3, n.y + eH / 2, n.w - 6, n.h - eH, opts),
                rc.ellipse(cx, n.y + eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6 }),
                rc.ellipse(cx, n.y + n.h - eH / 2, n.w - 8, eH, {
                    ...opts,
                    roughness: 0.6,
                    fill: "none",
                }),
            ];
        }
        case "text":
            return [];
        case "image": {
            if (n.imageUrl) {
                const img = document.createElementNS(NS, "image");
                img.setAttribute("href", n.imageUrl);
                img.setAttribute("x", String(n.x + 1));
                img.setAttribute("y", String(n.y + 1));
                img.setAttribute("width", String(n.w - 2));
                img.setAttribute("height", String(n.h - 2));
                img.setAttribute("preserveAspectRatio", "xMidYMid meet");
                const clipId = `clip-${n.id}`;
                const defs = document.createElementNS(NS, "defs");
                const clip = document.createElementNS(NS, "clipPath");
                clip.setAttribute("id", clipId);
                const rect = document.createElementNS(NS, "rect");
                rect.setAttribute("x", String(n.x + 1));
                rect.setAttribute("y", String(n.y + 1));
                rect.setAttribute("width", String(n.w - 2));
                rect.setAttribute("height", String(n.h - 2));
                rect.setAttribute("rx", "6");
                clip.appendChild(rect);
                defs.appendChild(clip);
                img.setAttribute("clip-path", `url(#${clipId})`);
                const border = rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, {
                    ...opts,
                    fill: "none",
                });
                return [defs, img, border];
            }
            return [
                rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, {
                    ...opts,
                    fill: "#e0e0e0",
                    stroke: "#999999",
                }),
            ];
        }
        default:
            return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts)];
    }
}
// ── Arrowhead ─────────────────────────────────────────────────────────────
function arrowHead(rc, x, y, angle, col, seed) {
    const as = 12;
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
        const raw = String(sg.config["font"] ?? "");
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
        bgRect.setAttribute("fill", palette.background);
        svg.appendChild(bgRect);
    }
    const rc = rough.svg(svg);
    // ── Title ────────────────────────────────────────────────
    if (options.showTitle && sg.title) {
        const titleColor = String(sg.config["title-color"] ?? palette.titleText);
        const titleSize = Number(sg.config["title-size"] ?? 18);
        const titleWeight = Number(sg.config["title-weight"] ?? 600);
        svg.appendChild(mkText(sg.title, sg.width / 2, 26, titleSize, titleWeight, titleColor, "middle", diagramFont));
    }
    // ── Groups ───────────────────────────────────────────────
    const gmMap = new Map(sg.groups.map((g) => [g.id, g]));
    const sortedGroups = [...sg.groups].sort((a, b) => groupDepth$1(a, gmMap) - groupDepth$1(b, gmMap));
    const GL = mkGroup("grp-layer");
    for (const g of sortedGroups) {
        if (!g.w)
            continue;
        const gs = g.style ?? {};
        const gg = mkGroup(`group-${g.id}`, "gg");
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
        const gLabelColor = gs.color ? String(gs.color) : palette.groupLabel;
        const gFontSize = Number(gs.fontSize ?? 12);
        const gFontWeight = gs.fontWeight ?? 500;
        const gFont = resolveStyleFont$1(gs, diagramFont);
        const gLetterSpacing = gs.letterSpacing;
        const gPad = Number(gs.padding ?? 14);
        const gTextAlign = String(gs.textAlign ?? "left");
        const gAnchorMap = {
            left: "start",
            center: "middle",
            right: "end",
        };
        const gAnchor = gAnchorMap[gTextAlign] ?? "start";
        const gTextX = gTextAlign === "right"
            ? g.x + g.w - gPad
            : gTextAlign === "center"
                ? g.x + g.w / 2
                : g.x + gPad;
        if (g.label) {
            gg.appendChild(mkText(g.label, gTextX, g.y + gPad, gFontSize, gFontWeight, gLabelColor, gAnchor, gFont, gLetterSpacing));
        }
        GL.appendChild(gg);
    }
    svg.appendChild(GL);
    // ── Edges ─────────────────────────────────────────────────
    const nm = nodeMap(sg);
    const tm = tableMap(sg);
    const cm = chartMap(sg);
    const ntm = noteMap(sg);
    const EL = mkGroup("edge-layer");
    for (const e of sg.edges) {
        const src = resolveEndpoint$1(e.from, nm, tm, gmMap, cm, ntm);
        const dst = resolveEndpoint$1(e.to, nm, tm, gmMap, cm, ntm);
        if (!src || !dst)
            continue;
        const dstCX = dst.x + dst.w / 2, dstCY = dst.y + dst.h / 2;
        const srcCX = src.x + src.w / 2, srcCY = src.y + src.h / 2;
        const [x1, y1] = getConnPoint$1(src, dstCX, dstCY);
        const [x2, y2] = getConnPoint$1(dst, srcCX, srcCY);
        const eg = mkGroup(`edge-${e.from}-${e.to}`, "eg");
        if (e.style?.opacity != null)
            eg.setAttribute("opacity", String(e.style.opacity));
        const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1;
        const nx = (x2 - x1) / len, ny = (y2 - y1) / len;
        const ecol = String(e.style?.stroke ?? palette.edgeStroke);
        const { arrowAt, dashed } = connMeta$1(e.connector);
        const HEAD = 13;
        const sx1 = arrowAt === "start" || arrowAt === "both" ? x1 + nx * HEAD : x1;
        const sy1 = arrowAt === "start" || arrowAt === "both" ? y1 + ny * HEAD : y1;
        const sx2 = arrowAt === "end" || arrowAt === "both" ? x2 - nx * HEAD : x2;
        const sy2 = arrowAt === "end" || arrowAt === "both" ? y2 - ny * HEAD : y2;
        eg.appendChild(rc.line(sx1, sy1, sx2, sy2, {
            ...BASE_ROUGH,
            roughness: 0.9,
            seed: hashStr$3(e.from + e.to),
            stroke: ecol,
            strokeWidth: Number(e.style?.strokeWidth ?? 1.6),
            ...(dashed ? { strokeLineDash: [6, 5] } : {}),
        }));
        if (arrowAt === "end" || arrowAt === "both")
            eg.appendChild(arrowHead(rc, x2, y2, Math.atan2(y2 - y1, x2 - x1), ecol, hashStr$3(e.to)));
        if (arrowAt === "start" || arrowAt === "both")
            eg.appendChild(arrowHead(rc, x1, y1, Math.atan2(y1 - y2, x1 - x2), ecol, hashStr$3(e.from + "back")));
        if (e.label) {
            const mx = (x1 + x2) / 2 - ny * 14;
            const my = (y1 + y2) / 2 + nx * 14;
            const tw = Math.max(e.label.length * 7 + 12, 36);
            const bg = se("rect");
            bg.setAttribute("x", String(mx - tw / 2));
            bg.setAttribute("y", String(my - 8));
            bg.setAttribute("width", String(tw));
            bg.setAttribute("height", "15");
            bg.setAttribute("fill", palette.edgeLabelBg);
            bg.setAttribute("rx", "3");
            bg.setAttribute("opacity", "0.9");
            eg.appendChild(bg);
            // ── Edge label typography ───────────────────────
            // supports: font, font-size, letter-spacing
            // always center-anchored (single line floating on edge)
            const eFontSize = Number(e.style?.fontSize ?? 11);
            const eFont = resolveStyleFont$1(e.style ?? {}, diagramFont);
            const eLetterSpacing = e.style?.letterSpacing;
            const eFontWeight = e.style?.fontWeight ?? 400;
            const eLabelColor = String(e.style?.color ?? palette.edgeLabelText);
            eg.appendChild(mkText(e.label, mx, my, eFontSize, eFontWeight, eLabelColor, "middle", eFont, eLetterSpacing));
        }
        EL.appendChild(eg);
    }
    svg.appendChild(EL);
    // ── Nodes ─────────────────────────────────────────────────
    const NL = mkGroup("node-layer");
    for (const n of sg.nodes) {
        const ng = mkGroup(`node-${n.id}`, "ng");
        if (n.style?.opacity != null)
            ng.setAttribute("opacity", String(n.style.opacity));
        renderShape$1(rc, n, palette).forEach((s) => ng.appendChild(s));
        // ── Node / text typography ─────────────────────────
        // supports: font, font-size, letter-spacing, text-align, line-height
        const fontSize = Number(n.style?.fontSize ?? (n.shape === "text" ? 13 : 14));
        const fontWeight = n.style?.fontWeight ?? (n.shape === "text" ? 400 : 500);
        const textColor = String(n.style?.color ??
            (n.shape === "text" ? palette.edgeLabelText : palette.nodeText));
        const nodeFont = resolveStyleFont$1(n.style ?? {}, diagramFont);
        const textAlign = String(n.style?.textAlign ?? "center");
        const anchorMap = {
            left: "start",
            center: "middle",
            right: "end",
        };
        const textAnchor = anchorMap[textAlign] ?? "middle";
        // line-height is a multiplier (e.g. 1.4 = 140% of font-size)
        const lineHeight = Number(n.style?.lineHeight ?? 1.3) * fontSize;
        const letterSpacing = n.style?.letterSpacing;
        const pad = Number(n.style?.padding ?? 8);
        // x shifts for left / right alignment
        const textX = textAlign === "left"
            ? n.x + pad
            : textAlign === "right"
                ? n.x + n.w - pad
                : n.x + n.w / 2;
        const lines = n.shape === 'text' && !n.label.includes('\n')
            ? wrapText$1(n.label, n.w - pad * 2, fontSize)
            : n.label.split('\n');
        const verticalAlign = String(n.style?.verticalAlign ?? "middle");
        const nodeBodyTop = n.y + pad;
        const nodeBodyBottom = n.y + n.h - pad;
        const nodeBodyMid = n.y + n.h / 2;
        const blockH = (lines.length - 1) * lineHeight;
        const textCY = verticalAlign === "top"
            ? nodeBodyTop + blockH / 2
            : verticalAlign === "bottom"
                ? nodeBodyBottom - blockH / 2
                : nodeBodyMid;
        ng.appendChild(lines.length > 1
            ? mkMultilineText(lines, textX, textCY, fontSize, fontWeight, textColor, textAnchor, lineHeight, nodeFont, letterSpacing)
            : mkText(n.label, textX, textCY, fontSize, fontWeight, textColor, textAnchor, nodeFont, letterSpacing));
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
        const gs = t.style ?? {};
        const fill = String(gs.fill ?? palette.tableFill);
        const strk = String(gs.stroke ?? palette.tableStroke);
        const textCol = String(gs.color ?? palette.tableText);
        const hdrFill = gs.fill ? darkenHex$1(fill, 0.08) : palette.tableHeaderFill;
        const hdrText = String(gs.color ?? palette.tableHeaderText);
        const divCol = palette.tableDivider;
        const pad = t.labelH;
        const tStrokeWidth = Number(gs.strokeWidth ?? 1.5);
        const tFontWeight = gs.fontWeight ?? 500;
        // ── Table-level font (applies to label + all cells) ─
        // supports: font, font-size, letter-spacing
        const tFontSize = Number(gs.fontSize ?? 12);
        const tFont = resolveStyleFont$1(gs, diagramFont);
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
    // ── Notes ─────────────────────────────────────────────────
    const NoteL = mkGroup("note-layer");
    for (const n of sg.notes) {
        const ng = mkGroup(`note-${n.id}`, "ntg");
        const gs = n.style ?? {};
        const fill = String(gs.fill ?? palette.noteFill);
        const strk = String(gs.stroke ?? palette.noteStroke);
        const nStrokeWidth = Number(gs.strokeWidth ?? 1.2);
        const fold = 14;
        const { x, y, w, h } = n;
        if (gs.opacity != null)
            ng.setAttribute("opacity", String(gs.opacity));
        // ── Note typography ─────────────────────────────────
        const nFontSize = Number(gs.fontSize ?? 12);
        const nFontWeight = gs.fontWeight ?? 400;
        const nFont = resolveStyleFont$1(gs, diagramFont);
        const nLetterSpacing = gs.letterSpacing;
        const nLineHeight = Number(gs.lineHeight ?? 1.4) * nFontSize;
        const nTextAlign = String(gs.textAlign ?? "left");
        const nPad = Number(gs.padding ?? 12);
        const nAnchorMap = {
            left: "start",
            center: "middle",
            right: "end",
        };
        const nAnchor = nAnchorMap[nTextAlign] ?? "start";
        const nTextX = nTextAlign === "right"
            ? x + w - fold - nPad
            : nTextAlign === "center"
                ? x + (w - fold) / 2
                : x + nPad;
        const nFoldPad = fold + nPad; // text starts below fold + user padding
        ng.appendChild(rc.polygon([
            [x, y],
            [x + w - fold, y],
            [x + w, y + fold],
            [x + w, y + h],
            [x, y + h],
        ], {
            ...BASE_ROUGH,
            seed: hashStr$3(n.id),
            fill,
            fillStyle: "solid",
            stroke: strk,
            strokeWidth: nStrokeWidth,
            ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash } : {}),
        }));
        ng.appendChild(rc.polygon([
            [x + w - fold, y],
            [x + w, y + fold],
            [x + w - fold, y + fold],
        ], {
            roughness: 0.4,
            seed: hashStr$3(n.id + "f"),
            fill: palette.noteFold,
            fillStyle: "solid",
            stroke: strk,
            strokeWidth: Math.min(nStrokeWidth, 0.8),
        }));
        const nVerticalAlign = String(gs.verticalAlign ?? "top");
        const bodyTop = y + nFoldPad;
        const bodyBottom = y + h - nPad;
        const bodyMid = (bodyTop + bodyBottom) / 2;
        const blockH = (n.lines.length - 1) * nLineHeight;
        const blockCY = nVerticalAlign === "bottom"
            ? bodyBottom - blockH / 2
            : nVerticalAlign === "middle"
                ? bodyMid
                : bodyTop + blockH / 2;
        if (n.lines.length > 1) {
            ng.appendChild(mkMultilineText(n.lines, nTextX, blockCY, nFontSize, nFontWeight, String(gs.color ?? palette.noteText), nAnchor, nLineHeight, nFont, nLetterSpacing));
        }
        else {
            ng.appendChild(mkText(n.lines[0] ?? "", nTextX, blockCY, nFontSize, nFontWeight, String(gs.color ?? palette.noteText), nAnchor, nFont, nLetterSpacing));
        }
        NoteL.appendChild(ng);
    }
    svg.appendChild(NoteL);
    markdownMap(sg);
    const MDL = mkGroup('markdown-layer');
    for (const m of sg.markdowns) {
        const mg = mkGroup(`markdown-${m.id}`, 'mdg');
        const mFont = resolveStyleFont$1(m.style, diagramFont);
        const baseColor = String(m.style?.color ?? palette.nodeText);
        const textAlign = String(m.style?.textAlign ?? 'left');
        const anchor = textAlign === 'right' ? 'end'
            : textAlign === 'center' ? 'middle'
                : 'start';
        const PAD = Number(m.style?.padding ?? 16);
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
        CL.appendChild(renderRoughChartSVG(rc, c, palette, themeName !== "light"));
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
function hashStr$2(s) {
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
    rc.line(px, py, px, py + ph, { ...R, roughness: 0.4, seed: hashStr$2(c.id + 'ya'), stroke: labelCol, strokeWidth: 1 });
    // X axis (baseline)
    rc.line(px, baseline, px + pw, baseline, { ...R, roughness: 0.4, seed: hashStr$2(c.id + 'xa'), stroke: labelCol, strokeWidth: 1 });
    // Y ticks + labels
    for (const tick of yTicks(allY)) {
        const ty = toY(tick);
        if (ty < py - 2 || ty > py + ph + 2)
            continue;
        rc.line(px - 3, ty, px, ty, { roughness: 0.2, seed: hashStr$2(c.id + 'yt' + tick), stroke: labelCol, strokeWidth: 0.7 });
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
        ...R, seed: hashStr$2(c.id),
        fill: bgFill,
        fillStyle: 'solid',
        stroke: bgStroke,
        strokeWidth: Number(s.strokeWidth ?? 1.2),
        ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
    });
    // Title
    if (c.title) {
        ctx.save();
        ctx.font = `${cFontWeight} ${cFontSize}px ${cFont}`;
        ctx.fillStyle = lc;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.title, c.x + c.w / 2, c.y + 14);
        ctx.restore();
    }
    const { px, py, pw, ph, cx, cy } = chartLayout(c);
    // ── Pie / Donut ──────────────────────────────────────────
    if (c.chartType === 'pie' || c.chartType === 'donut') {
        const { segments, total } = parsePie(c.data);
        const r = Math.min(c.w * 0.38, (c.h - (c.title ? 24 : 8)) * 0.44);
        const ir = c.chartType === 'donut' ? r * 0.48 : 0;
        const legendX = c.x + 8;
        const legendY = c.y + (c.title ? 28 : 12);
        let angle = -Math.PI / 2;
        segments.forEach((seg, i) => {
            const sweep = (seg.value / total) * Math.PI * 2;
            drawPieArc(rc, ctx, cx, cy, r, ir, angle, angle + sweep, seg.color, hashStr$2(c.id + seg.label + i));
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
        rc.line(px, py, px, py + ph, { ...R, roughness: 0.4, seed: hashStr$2(c.id + 'ya'), stroke: lc, strokeWidth: 1 });
        rc.line(px, py + ph, px + pw, py + ph, { ...R, roughness: 0.4, seed: hashStr$2(c.id + 'xa'), stroke: lc, strokeWidth: 1 });
        pts.forEach((pt, i) => {
            rc.ellipse(toX(pt.x), toY(pt.y), 10, 10, {
                roughness: 0.8, seed: hashStr$2(c.id + pt.label),
                fill: CHART_COLORS[i % CHART_COLORS.length] + '99',
                fillStyle: 'solid',
                stroke: CHART_COLORS[i % CHART_COLORS.length],
                strokeWidth: 1.2,
            });
        });
        drawLegend(ctx, pts.map(p => p.label), CHART_COLORS, c.x + 8, c.y + (c.title ? 28 : 12), lc, cFont);
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
                    seed: hashStr$2(c.id + si + i),
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
                    roughness: 0.5, seed: hashStr$2(c.id + 'af' + si),
                    fill: ser.color + '44',
                    fillStyle: 'solid',
                    stroke: 'none',
                });
            }
            // Lines
            for (let i = 0; i < pts.length - 1; i++) {
                rc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], {
                    roughness: 0.9, bowing: 0.6,
                    seed: hashStr$2(c.id + si + i),
                    stroke: ser.color,
                    strokeWidth: 1.8,
                });
            }
            // Dots
            pts.forEach(([px2, py2], i) => {
                rc.ellipse(px2, py2, 7, 7, {
                    roughness: 0.3, seed: hashStr$2(c.id + 'dot' + si + i),
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
function hashStr$1(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++)
        h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
    return h;
}
/** Darken a CSS hex colour by `amount` (0–1). Falls back to input for non-hex. */
function darkenHex(hex, amount = 0.12) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m)
        return hex;
    const d = (v) => Math.max(0, Math.round(parseInt(v, 16) * (1 - amount)));
    return `#${d(m[1]).toString(16).padStart(2, "0")}${d(m[2]).toString(16).padStart(2, "0")}${d(m[3]).toString(16).padStart(2, "0")}`;
}
// ── Small helper: load + resolve font from a style map ────────────────────
function resolveStyleFont(style, fallback) {
    const raw = String(style['font'] ?? '');
    if (!raw)
        return fallback;
    loadFont(raw);
    return resolveFont(raw);
}
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
// Soft word-wrap for `text` shape nodes
function wrapText(text, maxWidth, fontSize) {
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
// ── Arrow direction ────────────────────────────────────────────────────────
function connMeta(connector) {
    if (connector === '--')
        return { arrowAt: 'none', dashed: false };
    if (connector === '---')
        return { arrowAt: 'none', dashed: true };
    const bidir = connector.includes('<') && connector.includes('>');
    if (bidir)
        return { arrowAt: 'both', dashed: connector.includes('--') };
    const back = connector.startsWith('<');
    const dashed = connector.includes('--');
    if (back)
        return { arrowAt: 'start', dashed };
    return { arrowAt: 'end', dashed };
}
// ── Rect connection point ──────────────────────────────────────────────────
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
function resolveEndpoint(id, nm, tm, gm, cm, ntm) {
    return nm.get(id) ?? tm.get(id) ?? gm.get(id) ?? cm.get(id) ?? ntm.get(id) ?? null;
}
function getConnPoint(src, dstCX, dstCY) {
    if ('shape' in src && src.shape) {
        return connPoint(src, {
            x: dstCX - 1, y: dstCY - 1, w: 2, h: 2});
    }
    return rectConnPoint(src.x, src.y, src.w, src.h, dstCX, dstCY);
}
// ── Group depth ────────────────────────────────────────────────────────────
function groupDepth(g, gm) {
    let d = 0;
    let cur = g;
    while (cur?.parentId) {
        d++;
        cur = gm.get(cur.parentId);
    }
    return d;
}
// ── Node shapes ────────────────────────────────────────────────────────────
function renderShape(rc, ctx, n, palette, R) {
    const s = n.style ?? {};
    const fill = String(s.fill ?? palette.nodeFill);
    const stroke = String(s.stroke ?? palette.nodeStroke);
    const opts = {
        ...R, seed: hashStr$1(n.id),
        fill, fillStyle: 'solid',
        stroke, strokeWidth: Number(s.strokeWidth ?? 1.9),
        ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
    };
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const hw = n.w / 2 - 2;
    switch (n.shape) {
        case 'circle':
            rc.ellipse(cx, cy, n.w * 0.88, n.h * 0.88, opts);
            break;
        case 'diamond':
            rc.polygon([[cx, n.y + 2], [cx + hw, cy], [cx, n.y + n.h - 2], [cx - hw, cy]], opts);
            break;
        case 'hexagon': {
            const hw2 = hw * 0.56;
            rc.polygon([
                [cx - hw2, n.y + 3], [cx + hw2, n.y + 3], [cx + hw, cy],
                [cx + hw2, n.y + n.h - 3], [cx - hw2, n.y + n.h - 3], [cx - hw, cy],
            ], opts);
            break;
        }
        case 'triangle':
            rc.polygon([[cx, n.y + 3], [n.x + n.w - 3, n.y + n.h - 3], [n.x + 3, n.y + n.h - 3]], opts);
            break;
        case 'cylinder': {
            const eH = 18;
            rc.rectangle(n.x + 3, n.y + eH / 2, n.w - 6, n.h - eH, opts);
            rc.ellipse(cx, n.y + eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6 });
            rc.ellipse(cx, n.y + n.h - eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6, fill: 'none' });
            break;
        }
        case 'parallelogram':
            rc.polygon([
                [n.x + 18, n.y + 1], [n.x + n.w - 1, n.y + 1],
                [n.x + n.w - 18, n.y + n.h - 1], [n.x + 1, n.y + n.h - 1],
            ], opts);
            break;
        case 'text':
            break; // no shape drawn
        case 'image': {
            if (n.imageUrl) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    ctx.save();
                    ctx.beginPath();
                    const r = 6;
                    ctx.moveTo(n.x + r, n.y);
                    ctx.lineTo(n.x + n.w - r, n.y);
                    ctx.quadraticCurveTo(n.x + n.w, n.y, n.x + n.w, n.y + r);
                    ctx.lineTo(n.x + n.w, n.y + n.h - r);
                    ctx.quadraticCurveTo(n.x + n.w, n.y + n.h, n.x + n.w - r, n.y + n.h);
                    ctx.lineTo(n.x + r, n.y + n.h);
                    ctx.quadraticCurveTo(n.x, n.y + n.h, n.x, n.y + n.h - r);
                    ctx.lineTo(n.x, n.y + r);
                    ctx.quadraticCurveTo(n.x, n.y, n.x + r, n.y);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(img, n.x + 1, n.y + 1, n.w - 2, n.h - 2);
                    ctx.restore();
                    rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: 'none' });
                };
                img.src = n.imageUrl;
            }
            else {
                rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: '#e0e0e0', stroke: '#999999' });
            }
            return;
        }
        default:
            rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts);
            break;
    }
}
// ── Arrowhead ─────────────────────────────────────────────────────────────
function drawArrowHead(rc, x, y, angle, col, seed, R) {
    const as = 12;
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
        const raw = String(sg.config['font'] ?? '');
        if (raw) {
            loadFont(raw);
            return resolveFont(raw);
        }
        return DEFAULT_FONT;
    })();
    // ── Background ───────────────────────────────────────────
    if (!options.transparent) {
        ctx.fillStyle = options.background ?? palette.background;
        ctx.fillRect(0, 0, sg.width, sg.height);
    }
    else {
        ctx.clearRect(0, 0, sg.width, sg.height);
    }
    const rc = rough.canvas(canvas);
    const R = { roughness: options.roughness ?? 1.3, bowing: options.bowing ?? 0.7 };
    const nm = nodeMap(sg);
    const tm = tableMap(sg);
    const gm = groupMap(sg);
    const cm = chartMap(sg);
    const ntm = noteMap(sg);
    // ── Title ────────────────────────────────────────────────
    if (sg.title) {
        const titleSize = Number(sg.config['title-size'] ?? 18);
        const titleWeight = Number(sg.config['title-weight'] ?? 600);
        const titleColor = String(sg.config['title-color'] ?? palette.titleText);
        drawText(ctx, sg.title, sg.width / 2, 28, titleSize, titleWeight, titleColor, 'center', diagramFont);
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
            ...R, roughness: 1.7, bowing: 0.4, seed: hashStr$1(g.id),
            fill: String(gs.fill ?? palette.groupFill),
            fillStyle: 'solid',
            stroke: String(gs.stroke ?? palette.groupStroke),
            strokeWidth: Number(gs.strokeWidth ?? 1.2),
            strokeLineDash: gs.strokeDash ?? palette.groupDash,
        });
        if (g.label) {
            const gFontSize = Number(gs.fontSize ?? 12);
            const gFontWeight = gs.fontWeight ?? 500;
            const gFont = resolveStyleFont(gs, diagramFont);
            const gLetterSpacing = gs.letterSpacing;
            const gLabelColor = gs.color ? String(gs.color) : palette.groupLabel;
            const gPad = Number(gs.padding ?? 14);
            const gTextAlign = String(gs.textAlign ?? 'left');
            const gTextX = gTextAlign === 'right' ? g.x + g.w - gPad
                : gTextAlign === 'center' ? g.x + g.w / 2
                    : g.x + gPad;
            drawText(ctx, g.label, gTextX, g.y + gPad + 2, gFontSize, gFontWeight, gLabelColor, gTextAlign, gFont, gLetterSpacing);
        }
        if (gs.opacity != null)
            ctx.globalAlpha = 1;
    }
    // ── Edges ─────────────────────────────────────────────────
    for (const e of sg.edges) {
        const src = resolveEndpoint(e.from, nm, tm, gm, cm, ntm);
        const dst = resolveEndpoint(e.to, nm, tm, gm, cm, ntm);
        if (!src || !dst)
            continue;
        const dstCX = dst.x + dst.w / 2, dstCY = dst.y + dst.h / 2;
        const srcCX = src.x + src.w / 2, srcCY = src.y + src.h / 2;
        const [x1, y1] = getConnPoint(src, dstCX, dstCY);
        const [x2, y2] = getConnPoint(dst, srcCX, srcCY);
        if (e.style?.opacity != null)
            ctx.globalAlpha = Number(e.style.opacity);
        const ecol = String(e.style?.stroke ?? palette.edgeStroke);
        const { arrowAt, dashed } = connMeta(e.connector);
        const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1;
        const nx = (x2 - x1) / len, ny = (y2 - y1) / len;
        const HEAD = 13;
        const sx1 = arrowAt === 'start' || arrowAt === 'both' ? x1 + nx * HEAD : x1;
        const sy1 = arrowAt === 'start' || arrowAt === 'both' ? y1 + ny * HEAD : y1;
        const sx2 = arrowAt === 'end' || arrowAt === 'both' ? x2 - nx * HEAD : x2;
        const sy2 = arrowAt === 'end' || arrowAt === 'both' ? y2 - ny * HEAD : y2;
        rc.line(sx1, sy1, sx2, sy2, {
            ...R, roughness: 0.9, seed: hashStr$1(e.from + e.to),
            stroke: ecol,
            strokeWidth: Number(e.style?.strokeWidth ?? 1.6),
            ...(dashed ? { strokeLineDash: [6, 5] } : {}),
        });
        const ang = Math.atan2(y2 - y1, x2 - x1);
        if (arrowAt === 'end' || arrowAt === 'both')
            drawArrowHead(rc, x2, y2, ang, ecol, hashStr$1(e.to));
        if (arrowAt === 'start' || arrowAt === 'both')
            drawArrowHead(rc, x1, y1, Math.atan2(y1 - y2, x1 - x2), ecol, hashStr$1(e.from + 'back'));
        if (e.label) {
            const mx = (x1 + x2) / 2 - ny * 14;
            const my = (y1 + y2) / 2 + nx * 14;
            // ── Edge label: font, font-size, letter-spacing ──
            // always center-anchored (single line)
            const eFontSize = Number(e.style?.fontSize ?? 11);
            const eFont = resolveStyleFont(e.style ?? {}, diagramFont);
            const eLetterSpacing = e.style?.letterSpacing;
            const eFontWeight = e.style?.fontWeight ?? 400;
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
        renderShape(rc, ctx, n, palette, R);
        // ── Node / text typography ─────────────────────────
        // supports: font, font-size, letter-spacing, text-align,
        //           vertical-align, line-height, word-wrap (text shape)
        const fontSize = Number(n.style?.fontSize ?? (n.shape === 'text' ? 13 : 14));
        const fontWeight = n.style?.fontWeight ?? (n.shape === 'text' ? 400 : 500);
        const textColor = String(n.style?.color ??
            (n.shape === 'text' ? palette.edgeLabelText : palette.nodeText));
        const nodeFont = resolveStyleFont(n.style ?? {}, diagramFont);
        const textAlign = String(n.style?.textAlign ?? 'center');
        const lineHeight = Number(n.style?.lineHeight ?? 1.3) * fontSize;
        const letterSpacing = n.style?.letterSpacing;
        const vertAlign = String(n.style?.verticalAlign ?? 'middle');
        const pad = Number(n.style?.padding ?? 8);
        // x shifts for left/right alignment
        const textX = textAlign === 'left' ? n.x + pad
            : textAlign === 'right' ? n.x + n.w - pad
                : n.x + n.w / 2;
        // word-wrap for text shape; explicit \n for all others
        const rawLines = n.label.split('\n');
        const lines = n.shape === 'text' && rawLines.length === 1
            ? wrapText(n.label, n.w - pad * 2, fontSize)
            : rawLines;
        // vertical-align: compute textCY from top/middle/bottom
        const nodeBodyTop = n.y + pad;
        const nodeBodyBottom = n.y + n.h - pad;
        const blockH = (lines.length - 1) * lineHeight;
        const textCY = vertAlign === 'top' ? nodeBodyTop + blockH / 2
            : vertAlign === 'bottom' ? nodeBodyBottom - blockH / 2
                : n.y + n.h / 2; // middle (default)
        if (lines.length > 1) {
            drawMultilineText(ctx, lines, textX, textCY, fontSize, fontWeight, textColor, textAlign, lineHeight, nodeFont, letterSpacing);
        }
        else {
            drawText(ctx, lines[0] ?? '', textX, textCY, fontSize, fontWeight, textColor, textAlign, nodeFont, letterSpacing);
        }
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
            ...R, seed: hashStr$1(t.id),
            fill, fillStyle: 'solid', stroke: strk, strokeWidth: tStrokeWidth,
            ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash } : {}),
        });
        rc.line(t.x, t.y + pad, t.x + t.w, t.y + pad, {
            roughness: 0.6, seed: hashStr$1(t.id + 'l'), stroke: strk, strokeWidth: 1,
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
                roughness: 0.4, seed: hashStr$1(t.id + rowY),
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
                        roughness: 0.3, seed: hashStr$1(t.id + 'c' + i),
                        stroke: palette.tableDivider, strokeWidth: 0.5,
                    });
                }
                cx += cw;
            });
            rowY += rh;
        }
        ctx.globalAlpha = 1;
    }
    // ── Notes ─────────────────────────────────────────────────
    for (const n of sg.notes) {
        const gs = n.style ?? {};
        const fill = String(gs.fill ?? palette.noteFill);
        const strk = String(gs.stroke ?? palette.noteStroke);
        const nStrokeWidth = Number(gs.strokeWidth ?? 1.2);
        const fold = 14;
        const { x, y, w, h } = n;
        if (gs.opacity != null)
            ctx.globalAlpha = Number(gs.opacity);
        rc.polygon([
            [x, y],
            [x + w - fold, y],
            [x + w, y + fold],
            [x + w, y + h],
            [x, y + h],
        ], { ...R, seed: hashStr$1(n.id), fill, fillStyle: 'solid', stroke: strk,
            strokeWidth: nStrokeWidth,
            ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash } : {}),
        });
        rc.polygon([
            [x + w - fold, y],
            [x + w, y + fold],
            [x + w - fold, y + fold],
        ], { roughness: 0.4, seed: hashStr$1(n.id + 'f'),
            fill: palette.noteFold, fillStyle: 'solid', stroke: strk,
            strokeWidth: Math.min(nStrokeWidth, 0.8),
        });
        const nFontSize = Number(gs.fontSize ?? 12);
        const nFontWeight = gs.fontWeight ?? 400;
        const nFont = resolveStyleFont(gs, diagramFont);
        const nLetterSpacing = gs.letterSpacing;
        const nLineHeight = Number(gs.lineHeight ?? 1.4) * nFontSize;
        const nTextAlign = String(gs.textAlign ?? 'left');
        const nVertAlign = String(gs.verticalAlign ?? 'top');
        const nColor = String(gs.color ?? palette.noteText);
        const nPad = Number(gs.padding ?? 12);
        const nTextX = nTextAlign === 'right' ? x + w - fold - nPad
            : nTextAlign === 'center' ? x + (w - fold) / 2
                : x + nPad;
        const nFoldPad = fold + nPad;
        const bodyTop = y + nFoldPad;
        const bodyBottom = y + h - nPad;
        const blockH = (n.lines.length - 1) * nLineHeight;
        const blockCY = nVertAlign === 'bottom' ? bodyBottom - blockH / 2
            : nVertAlign === 'middle' ? (bodyTop + bodyBottom) / 2
                : bodyTop + blockH / 2;
        if (n.lines.length > 1) {
            drawMultilineText(ctx, n.lines, nTextX, blockCY, nFontSize, nFontWeight, nColor, nTextAlign, nLineHeight, nFont, nLetterSpacing);
        }
        else {
            drawText(ctx, n.lines[0] ?? '', nTextX, blockCY, nFontSize, nFontWeight, nColor, nTextAlign, nFont, nLetterSpacing);
        }
        if (gs.opacity != null)
            ctx.globalAlpha = 1;
    }
    // ── Markdown blocks ────────────────────────────────────────
    // Renders prose with Markdown headings and bold/italic inline spans.
    // Canvas has no native bold-within-a-run, so each run is drawn
    // individually with its own ctx.font setting.
    for (const m of (sg.markdowns ?? [])) {
        const mFont = resolveStyleFont(m.style, diagramFont);
        const baseColor = String(m.style?.color ?? palette.nodeText);
        const textAlign = String(m.style?.textAlign ?? 'left');
        const PAD = Number(m.style?.padding ?? 16);
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
            if (textAlign === 'center' || textAlign === 'right') {
                // Measure full line width first
                let totalW = 0;
                for (const run of line.runs) {
                    const runStyle = run.italic ? 'italic ' : '';
                    const runWeight = run.bold ? 700 : fontWeight;
                    ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
                    totalW += ctx.measureText(run.text).width;
                }
                let runX = textAlign === 'center' ? anchorX - totalW / 2 : anchorX - totalW;
                ctx.textAlign = 'left';
                for (const run of line.runs) {
                    const runStyle = run.italic ? 'italic ' : '';
                    const runWeight = run.bold ? 700 : fontWeight;
                    ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
                    ctx.fillText(run.text, runX, lineY);
                    runX += ctx.measureText(run.text).width;
                }
            }
            else {
                // left-aligned — draw runs left to right from anchorX
                let runX = anchorX;
                ctx.textAlign = 'left';
                for (const run of line.runs) {
                    const runStyle = run.italic ? 'italic ' : '';
                    const runWeight = run.bold ? 700 : fontWeight;
                    ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
                    ctx.fillText(run.text, runX, lineY);
                    runX += ctx.measureText(run.text).width;
                }
            }
            ctx.restore();
            y += LINE_SPACING[line.kind];
        }
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
function resolveEl(svg, target) {
    // check edge first — target contains connector like "a-->b"
    const edge = parseEdgeTarget(target);
    if (edge)
        return getEdgeEl(svg, edge.from, edge.to);
    // everything else resolved by prefixed id
    return (getNodeEl(svg, target) ??
        getGroupEl(svg, target) ??
        getTableEl(svg, target) ??
        getNoteEl(svg, target) ??
        getChartEl(svg, target) ??
        getMarkdownEl(svg, target) ??
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
// ── Draw target helpers ───────────────────────────────────
function getDrawTargetEdgeIds(steps) {
    const ids = new Set();
    for (const s of steps) {
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
    for (const s of steps) {
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
function revealInstant(el) {
    el.querySelectorAll("path").forEach((p) => {
        p.style.transition = "none";
        p.style.strokeDashoffset = "0";
        p.style.fillOpacity = "";
        p.style.strokeDasharray = "";
    });
    const text = el.querySelector("text");
    if (text) {
        text.style.transition = "none";
        text.style.opacity = "";
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
function animateShapeDraw(el, strokeDur = 420, stag = 55) {
    const paths = Array.from(el.querySelectorAll("path"));
    const text = el.querySelector("text");
    requestAnimationFrame(() => requestAnimationFrame(() => {
        paths.forEach((p, i) => {
            const sd = i * stag, fd = sd + strokeDur - 60;
            p.style.transition = [
                `stroke-dashoffset ${strokeDur}ms cubic-bezier(.4,0,.2,1) ${sd}ms`,
                `fill-opacity 180ms ease ${Math.max(0, fd)}ms`,
            ].join(", ");
            p.style.strokeDashoffset = "0";
            p.style.fillOpacity = "1";
        });
        if (text) {
            const td = paths.length * stag + strokeDur + 80;
            text.style.transition = `opacity 200ms ease ${td}ms`;
            text.style.opacity = "1";
        }
    }));
}
// ── Edge draw helpers ─────────────────────────────────────
function clearEdgeDrawStyles(el) {
    el.querySelectorAll("path").forEach((p) => {
        p.style.strokeDasharray =
            p.style.strokeDashoffset =
                p.style.opacity =
                    p.style.transition =
                        "";
    });
}
function animateEdgeDraw(el, conn) {
    const paths = Array.from(el.querySelectorAll('path'));
    if (!paths.length)
        return;
    const linePath = paths[0];
    const headPaths = paths.slice(1);
    const STROKE_DUR = 360;
    const len = pathLength(linePath);
    const reversed = conn.startsWith('<') && !conn.includes('>');
    linePath.style.strokeDasharray = `${len}`;
    linePath.style.strokeDashoffset = reversed ? `${-len}` : `${len}`;
    linePath.style.transition = 'none';
    headPaths.forEach(p => {
        p.style.opacity = '0';
        p.style.transition = 'none';
    });
    el.classList.remove('draw-hidden');
    el.classList.add('draw-reveal');
    el.style.opacity = '1';
    requestAnimationFrame(() => requestAnimationFrame(() => {
        linePath.style.transition = `stroke-dashoffset ${STROKE_DUR}ms cubic-bezier(.4,0,.2,1)`;
        linePath.style.strokeDashoffset = '0';
        setTimeout(() => {
            headPaths.forEach(p => {
                p.style.transition = 'opacity 120ms ease';
                p.style.opacity = '1';
            });
            // ── ADD: clear inline dash overrides so SVG attribute
            //    (stroke-dasharray="6,5" for dashed arrows) takes over again
            setTimeout(() => {
                linePath.style.strokeDasharray = '';
                linePath.style.strokeDashoffset = '';
                linePath.style.transition = '';
            }, 160);
        }, STROKE_DUR - 40);
    }));
}
// ── AnimationController ───────────────────────────────────
class AnimationController {
    get drawTargets() {
        return this.drawTargetEdges;
    }
    constructor(svg, steps) {
        this.svg = svg;
        this.steps = steps;
        this._step = -1;
        this._transforms = new Map();
        this._listeners = [];
        this.drawTargetEdges = getDrawTargetEdgeIds(steps);
        this.drawTargetNodes = getDrawTargetNodeIds(steps);
        // Groups: non-edge draw steps whose target has a #group-{id} element in the SVG.
        // We detect this at construction time (after render) so we correctly distinguish
        // a group ID from a node ID without needing extra metadata.
        this.drawTargetGroups = new Set();
        this.drawTargetTables = new Set();
        this.drawTargetNotes = new Set();
        this.drawTargetCharts = new Set();
        this.drawTargetMarkdowns = new Set();
        for (const s of steps) {
            if (s.action !== "draw" || parseEdgeTarget(s.target))
                continue;
            if (svg.querySelector(`#group-${s.target}`)) {
                this.drawTargetGroups.add(`group-${s.target}`);
                // Remove from node targets if it was accidentally added
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
        this._clearAll();
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
            this.next();
            await new Promise((r) => setTimeout(r, msPerStep));
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
    _clearAll() {
        this._transforms.clear();
        // Nodes
        this.svg.querySelectorAll(".ng").forEach((el) => {
            el.style.transform = "";
            el.style.transition = "";
            el.classList.remove("hl", "faded", "hidden");
            el.style.opacity = el.style.filter = "";
            if (this.drawTargetNodes.has(el.id)) {
                clearDrawStyles(el);
                prepareForDraw(el);
            }
            else
                clearDrawStyles(el);
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
            el.classList.remove("draw-reveal");
            clearEdgeDrawStyles(el);
            el.style.transition = "none";
            if (this.drawTargetEdges.has(el.id)) {
                el.style.opacity = "";
                el.classList.add("draw-hidden");
            }
            else {
                el.style.opacity = "";
                el.classList.remove("draw-hidden");
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
    }
    _applyStep(i, silent) {
        const s = this.steps[i];
        if (!s)
            return;
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
                this._doDraw(s.target, silent);
                break;
            case "erase":
                this._doErase(s.target);
                break;
            case "show":
                this._doShowHide(s.target, true, silent);
                break;
            case "hide":
                this._doShowHide(s.target, false, silent);
                break;
            case "pulse":
                if (!silent)
                    this._doPulse(s.target);
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
        }
    }
    // ── highlight ────────────────────────────────────────────
    _doHighlight(target) {
        this.svg
            .querySelectorAll(".ng.hl, .tg.hl, .ntg.hl, .cg.hl, .eg.hl")
            .forEach((e) => e.classList.remove("hl"));
        resolveEl(this.svg, target)?.classList.add("hl");
    }
    // ── fade / unfade ─────────────────────────────────────────
    _doFade(target, doFade) {
        resolveEl(this.svg, target)?.classList.toggle("faded", doFade);
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
        el.style.transform = parts.join(" ") || "";
        if (silent) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.transition = "";
            }));
        }
    }
    // ── move ──────────────────────────────────────────────────
    _doMove(target, step, silent) {
        const el = resolveEl(this.svg, target);
        if (!el)
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
        this._writeTransform(el, target, silent, step.duration ?? 420);
    }
    // ── scale ─────────────────────────────────────────────────
    _doScale(target, step, silent) {
        const el = resolveEl(this.svg, target);
        if (!el)
            return;
        const cur = this._transforms.get(target) ?? {
            tx: 0,
            ty: 0,
            scale: 1,
            rotate: 0,
        };
        this._transforms.set(target, { ...cur, scale: step.factor ?? 1 });
        this._writeTransform(el, target, silent, step.duration ?? 350);
    }
    // ── rotate ────────────────────────────────────────────────
    _doRotate(target, step, silent) {
        const el = resolveEl(this.svg, target);
        if (!el)
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
        this._writeTransform(el, target, silent, step.duration ?? 400);
    }
    _doDraw(target, silent) {
        const edge = parseEdgeTarget(target);
        if (edge) {
            // ── Edge draw ──────────────────────────────────────
            const el = getEdgeEl(this.svg, edge.from, edge.to);
            if (!el)
                return;
            if (silent) {
                clearEdgeDrawStyles(el);
                el.style.transition = "none";
                el.classList.remove("draw-hidden");
                el.classList.add("draw-reveal");
                el.style.opacity = "1";
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    el.style.transition = "";
                }));
            }
            else {
                animateEdgeDraw(el, edge.conn);
            }
            return;
        }
        // Check if target is a group (has #group-{target} element)
        const groupEl = getGroupEl(this.svg, target);
        if (groupEl) {
            // ── Group draw ──────────────────────────────────────
            if (silent) {
                clearDrawStyles(groupEl);
                groupEl.style.transition = "none";
                groupEl.classList.remove("gg-hidden");
                groupEl.style.opacity = "1";
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    groupEl.style.transition = "";
                    clearDrawStyles(groupEl);
                }));
            }
            else {
                groupEl.classList.remove("gg-hidden");
                // Groups use slightly longer stroke-draw (bigger box, dashed border = more paths)
                const firstPath = groupEl.querySelector("path");
                if (!firstPath?.style.strokeDasharray)
                    prepareForDraw(groupEl);
                animateShapeDraw(groupEl, 550, 40);
                const pathCount = groupEl.querySelectorAll('path').length;
                const totalMs = pathCount * 40 + 550 + 120; // stagger + duration + buffer
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
                animateShapeDraw(tableEl, 500, 40);
                const tablePathCount = tableEl.querySelectorAll('path').length;
                clearDashOverridesAfter(tableEl, tablePathCount * 40 + 500 + 120);
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
                animateShapeDraw(noteEl, 420, 55);
                const notePathCount = noteEl.querySelectorAll('path').length;
                clearDashOverridesAfter(noteEl, notePathCount * 55 + 420 + 120);
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
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    chartEl.style.transition = "opacity 500ms ease";
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
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    markdownEl.style.transition = "opacity 500ms ease";
                    markdownEl.style.opacity = "1";
                }));
            }
            return;
        }
        // ── Node draw ──────────────────────────────────────
        const nodeEl = getNodeEl(this.svg, target);
        if (!nodeEl)
            return;
        if (silent) {
            revealInstant(nodeEl);
            requestAnimationFrame(() => requestAnimationFrame(() => clearDrawStyles(nodeEl)));
        }
        else {
            const firstPath = nodeEl.querySelector("path");
            if (!firstPath?.style.strokeDasharray)
                prepareForDraw(nodeEl);
            animateShapeDraw(nodeEl, 420, 55);
            const nodePathCount = nodeEl.querySelectorAll('path').length;
            clearDashOverridesAfter(nodeEl, nodePathCount * 55 + 420 + 120);
        }
    }
    // ── erase ─────────────────────────────────────────────────
    _doErase(target) {
        const el = resolveEl(this.svg, target); // handles edges too now
        if (el) {
            el.style.transition = "opacity 0.4s";
            el.style.opacity = "0";
        }
    }
    // ── show / hide ───────────────────────────────────────────
    _doShowHide(target, show, silent) {
        const el = resolveEl(this.svg, target);
        if (!el)
            return;
        el.style.transition = silent ? "none" : "opacity 0.4s";
        el.style.opacity = show ? "1" : "0";
    }
    // ── pulse ─────────────────────────────────────────────────
    _doPulse(target) {
        resolveEl(this.svg, target)?.animate([
            { filter: "brightness(1)" },
            { filter: "brightness(1.6)" },
            { filter: "brightness(1)" },
        ], { duration: 500, iterations: 3 });
    }
    // ── color ─────────────────────────────────────────────────
    _doColor(target, color) {
        if (!color)
            return;
        const el = resolveEl(this.svg, target);
        if (!el)
            return;
        // edge — color stroke
        if (parseEdgeTarget(target)) {
            el.querySelectorAll("path, line, polyline").forEach((p) => {
                p.style.stroke = color;
            });
            el.querySelectorAll("polygon").forEach((p) => {
                p.style.fill = color;
                p.style.stroke = color;
            });
            return;
        }
        // everything else — color fill
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
            el.querySelectorAll("text").forEach((t) => {
                t.style.fill = color;
            });
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
.eg.draw-hidden { opacity: 0; }
.eg.draw-reveal { opacity: 1; }
.gg.gg-hidden  { opacity: 0; }
.tg.gg-hidden  { opacity: 0; }
.ntg.gg-hidden { opacity: 0; }
.cg.gg-hidden  { opacity: 0; }
.mdg.gg-hidden { opacity: 0; }
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
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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
    const scale = opts.scale ?? 2;
    const w = parseFloat(svg.getAttribute('width') ?? '400');
    const h = parseFloat(svg.getAttribute('height') ?? '300');
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
        ctx.fillStyle = '#f8f4ea';
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
    body { margin: 0; background: #f8f4ea; display: flex; flex-direction: column; align-items: center; padding: 2rem; font-family: system-ui, sans-serif; }
    .diagram { max-width: 100%; }
    .dsl { margin-top: 2rem; background: #131008; color: #e0c898; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 13px; line-height: 1.7; white-space: pre; max-width: 800px; width: 100%; overflow: auto; }
  </style>
</head>
<body>
  <div class="diagram">${svgStr}</div>
  <details class="dsl"><summary style="cursor:pointer;color:#f0c96a">DSL source</summary><pre>${escapeHtml(dslSource)}</pre></details>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    download(blob, opts.filename ?? 'diagram.html');
}
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// ── GIF stub (requires gifshot or gif.js at runtime) ──────
async function exportGIF(frames, opts = {}) {
    // gifshot integration point
    throw new Error('GIF export requires gifshot to be loaded. See docs/EXPORT.md for setup.');
}
// ── MP4 stub (requires ffmpeg.wasm or MediaRecorder) ──────
async function exportMP4(canvas, durationMs, opts = {}) {
    const fps = opts.fps ?? 30;
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

// ============================================================
// sketchmark — Public API
// ============================================================
// ── Core Pipeline ─────────────────────────────────────────
function render(options) {
    const { container: rawContainer, dsl, renderer = 'svg', injectCSS = true, svgOptions = {}, canvasOptions = {}, onNodeClick, onReady, } = options;
    // Inject animation CSS once
    if (injectCSS && !document.getElementById('ai-diagram-css')) {
        const style = document.createElement('style');
        style.id = 'ai-diagram-css';
        style.textContent = ANIMATION_CSS;
        document.head.appendChild(style);
    }
    // Resolve container
    let el;
    if (typeof rawContainer === 'string') {
        el = document.querySelector(rawContainer);
        if (!el)
            throw new Error(`Container "${rawContainer}" not found`);
    }
    else {
        el = rawContainer;
    }
    // Pipeline: DSL → AST → Scene → Layout → Render
    const ast = parse(dsl);
    const scene = buildSceneGraph(ast);
    layout(scene);
    let svg;
    let canvas;
    let anim;
    if (renderer === 'canvas') {
        canvas = el instanceof HTMLCanvasElement
            ? el
            : (() => { const c = document.createElement('canvas'); el.appendChild(c); return c; })();
        renderToCanvas(scene, canvas, canvasOptions);
        anim = new AnimationController(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), ast.steps);
    }
    else {
        svg = renderToSVG(scene, el, {
            ...svgOptions,
            interactive: true,
            onNodeClick,
        });
        anim = new AnimationController(svg, ast.steps);
    }
    onReady?.(anim, svg);
    const instance = {
        scene, anim, svg, canvas,
        update: (newDsl) => render({ ...options, dsl: newDsl }),
        exportSVG: (filename = 'diagram.svg') => {
            if (svg) {
                Promise.resolve().then(function () { return index; }).then(m => m.exportSVG(svg, { filename }));
            }
        },
        exportPNG: async (filename = 'diagram.png') => {
            if (svg) {
                const m = await Promise.resolve().then(function () { return index; });
                await m.exportPNG(svg, { filename });
            }
        },
    };
    return instance;
}

exports.ANIMATION_CSS = ANIMATION_CSS;
exports.AnimationController = AnimationController;
exports.BUILTIN_FONTS = BUILTIN_FONTS;
exports.EventEmitter = EventEmitter;
exports.PALETTES = PALETTES;
exports.ParseError = ParseError;
exports.THEME_CONFIG_KEY = THEME_CONFIG_KEY;
exports.THEME_NAMES = THEME_NAMES;
exports.buildSceneGraph = buildSceneGraph;
exports.canvasToPNGBlob = canvasToPNGBlob;
exports.canvasToPNGDataURL = canvasToPNGDataURL;
exports.clamp = clamp;
exports.connPoint = connPoint;
exports.debounce = debounce;
exports.exportCanvasPNG = exportCanvasPNG;
exports.exportGIF = exportGIF;
exports.exportHTML = exportHTML;
exports.exportMP4 = exportMP4;
exports.exportPNG = exportPNG;
exports.exportSVG = exportSVG;
exports.getSVGBlob = getSVGBlob;
exports.groupMap = groupMap;
exports.hashStr = hashStr;
exports.layout = layout;
exports.lerp = lerp;
exports.listThemes = listThemes;
exports.loadFont = loadFont;
exports.markdownMap = markdownMap;
exports.nodeMap = nodeMap;
exports.parse = parse;
exports.parseHex = parseHex;
exports.registerFont = registerFont;
exports.render = render;
exports.renderToCanvas = renderToCanvas;
exports.renderToSVG = renderToSVG;
exports.resolveFont = resolveFont;
exports.resolvePalette = resolvePalette;
exports.sleep = sleep;
exports.svgToPNGDataURL = svgToPNGDataURL;
exports.svgToString = svgToString;
exports.throttle = throttle;
//# sourceMappingURL=index.cjs.map
