var AIDiagram = (function (exports) {
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
    function tokenize(src) {
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
        if (p.radius)
            s.radius = parseFloat(p.radius);
        if (p.shadow)
            s.shadow = p.shadow === "true";
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
        if (p["dash"]) {
            const parts = p["dash"]
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
        const tokens = tokenize(src).filter((t) => t.type !== "NEWLINE" || t.value === "\n");
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
                // read fontSize from style if set, otherwise use default
                const fontSize = Number(n.style?.fontSize ?? 13);
                const charWidth = fontSize * 0.55;
                const maxW = n.width ?? 400;
                const approxLines = Math.ceil((n.label.length * charWidth) / (maxW - 16));
                n.w = maxW;
                n.h = n.height ?? Math.max(24, approxLines * fontSize * 1.5 + 8);
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
            const maxH = Math.max(...hs);
            const { start, gaps } = distribute(ws, contentW, gap, justify);
            let x = contentX + start;
            for (let i = 0; i < kids.length; i++) {
                let y;
                switch (align) {
                    case "center":
                        y = contentY + (maxH - hs[i]) / 2;
                        break;
                    case "end":
                        y = contentY + maxH - hs[i];
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
            const maxW = Math.max(...ws);
            const { start, gaps } = distribute(hs, contentH, gap, justify);
            let y = contentY + start;
            for (let i = 0; i < kids.length; i++) {
                let x;
                switch (align) {
                    case "center":
                        x = contentX + (maxW - ws[i]) / 2;
                        break;
                    case "end":
                        x = contentX + maxW - ws[i];
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
    function mkT(txt, x, y, sz = 10, wt = 400, col = '#4a2e10', anchor = 'middle') {
        const t = se$1('text');
        t.setAttribute('x', String(x));
        t.setAttribute('y', String(y));
        t.setAttribute('text-anchor', anchor);
        t.setAttribute('dominant-baseline', 'middle');
        t.setAttribute('font-family', 'system-ui, sans-serif');
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
    function drawAxes$1(rc, g, c, px, py, pw, ph, allY, labelCol) {
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
            g.appendChild(mkT(fmtNum$1(tick), px - 5, ty, 9, 400, labelCol, 'end'));
        }
    }
    function fmtNum$1(v) {
        if (Math.abs(v) >= 1000)
            return (v / 1000).toFixed(1) + 'k';
        return String(v);
    }
    // ── Legend row ─────────────────────────────────────────────
    function legend(g, labels, colors, x, y, labelCol) {
        labels.forEach((lbl, i) => {
            const dot = se$1('rect');
            dot.setAttribute('x', String(x));
            dot.setAttribute('y', String(y + i * 14));
            dot.setAttribute('width', '8');
            dot.setAttribute('height', '8');
            dot.setAttribute('fill', colors[i % colors.length]);
            dot.setAttribute('rx', '1');
            g.appendChild(dot);
            g.appendChild(mkT(lbl, x + 12, y + i * 14 + 4, 9, 400, labelCol, 'start'));
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
        // Background box
        cg.appendChild(rc.rectangle(c.x, c.y, c.w, c.h, {
            ...BASE, seed: hashStr$4(c.id),
            fill: bgFill, fillStyle: 'solid',
            stroke: bgStroke, strokeWidth: Number(s.strokeWidth ?? 1.2),
            ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
        }));
        // Title
        if (c.title) {
            cg.appendChild(mkT(c.title, c.x + c.w / 2, c.y + 14, 12, 600, lc));
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
            legend(cg, segments.map(s => `${s.label} ${Math.round(s.value / total * 100)}%`), segments.map(s => s.color), legendX, legendY, lc);
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
            legend(cg, pts.map(p => p.label), CHART_COLORS, c.x + 8, c.y + (c.title ? 28 : 12), lc);
            return cg;
        }
        // ── Bar / Line / Area ─────────────────────────────────────
        const { labels, series } = parseBarLine(c.data);
        const allY = series.flatMap(s => s.values);
        const toY = makeValueToY(allY, py, ph);
        const baseline = toY(0);
        const n = labels.length;
        drawAxes$1(rc, cg, c, px, py, pw, ph, allY, lc);
        // X labels
        labels.forEach((lbl, i) => {
            cg.appendChild(mkT(lbl, px + (i + 0.5) * (pw / n), py + ph + 14, 9, 400, lc));
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
            legend(cg, series.map(s => s.name), series.map(s => s.color), px, py - 2, lc);
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
            // supports: font, font-size, letter-spacing
            // always left-anchored (single line)
            const gLabelColor = gs.color ? String(gs.color) : palette.groupLabel;
            const gFontSize = Number(gs.fontSize ?? 12);
            const gFont = resolveStyleFont$1(gs, diagramFont);
            const gLetterSpacing = gs.letterSpacing;
            if (g.label) {
                gg.appendChild(mkText(g.label, g.x + 14, g.y + 14, gFontSize, 500, gLabelColor, "start", gFont, gLetterSpacing));
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
                eg.appendChild(mkText(e.label, mx, my, eFontSize, 400, palette.edgeLabelText, "middle", eFont, eLetterSpacing));
            }
            EL.appendChild(eg);
        }
        svg.appendChild(EL);
        // ── Nodes ─────────────────────────────────────────────────
        const NL = mkGroup("node-layer");
        for (const n of sg.nodes) {
            const ng = mkGroup(`node-${n.id}`, "ng");
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
            // x shifts for left / right alignment
            const textX = textAlign === "left"
                ? n.x + 8
                : textAlign === "right"
                    ? n.x + n.w - 8
                    : n.x + n.w / 2;
            const lines = n.shape === 'text' && !n.label.includes('\n')
                ? wrapText$1(n.label, n.w - 16, fontSize)
                : n.label.split('\n');
            const verticalAlign = String(n.style?.verticalAlign ?? "middle");
            const nodeBodyTop = n.y + 6;
            const nodeBodyBottom = n.y + n.h - 6;
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
            const hdrFill = palette.tableHeaderFill;
            const hdrText = String(gs.color ?? palette.tableHeaderText);
            const divCol = palette.tableDivider;
            const pad = t.labelH;
            // ── Table-level font (applies to label + all cells) ─
            // supports: font, font-size, letter-spacing
            const tFontSize = Number(gs.fontSize ?? 12);
            const tFont = resolveStyleFont$1(gs, diagramFont);
            const tLetterSpacing = gs.letterSpacing;
            // outer border
            tg.appendChild(rc.rectangle(t.x, t.y, t.w, t.h, {
                ...BASE_ROUGH,
                seed: hashStr$3(t.id),
                fill,
                fillStyle: "solid",
                stroke: strk,
                strokeWidth: 1.5,
            }));
            // label strip separator
            tg.appendChild(rc.line(t.x, t.y + pad, t.x + t.w, t.y + pad, {
                roughness: 0.6,
                seed: hashStr$3(t.id + "l"),
                stroke: strk,
                strokeWidth: 1,
            }));
            // ── Table label: font, font-size, letter-spacing (always left) ──
            tg.appendChild(mkText(t.label, t.x + 10, t.y + pad / 2, tFontSize, 500, textCol, "start", tFont, tLetterSpacing));
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
                const cellFw = row.kind === "header" ? 600 : 400;
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
            const fold = 14;
            const { x, y, w, h } = n;
            // ── Note typography ─────────────────────────────────
            // supports: font, font-size, letter-spacing, text-align, line-height
            const nFontSize = Number(gs.fontSize ?? 12);
            const nFont = resolveStyleFont$1(gs, diagramFont);
            const nLetterSpacing = gs.letterSpacing;
            const nLineHeight = Number(gs.lineHeight ?? 1.4) * nFontSize;
            const nTextAlign = String(gs.textAlign ?? "left");
            const nAnchorMap = {
                left: "start",
                center: "middle",
                right: "end",
            };
            const nAnchor = nAnchorMap[nTextAlign] ?? "start";
            // x position for the text block (pad from left, with alignment)
            const nTextX = nTextAlign === "right"
                ? x + w - fold - 6
                : nTextAlign === "center"
                    ? x + (w - fold) / 2
                    : x + 12;
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
                strokeWidth: 1.2,
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
                strokeWidth: 0.8,
            }));
            const nVerticalAlign = String(gs.verticalAlign ?? "top");
            const bodyTop = y + fold + 8; // below the fold triangle
            const bodyBottom = y + h - 8; // above bottom edge
            const bodyMid = (bodyTop + bodyBottom) / 2;
            const blockH = (n.lines.length - 1) * nLineHeight;
            const blockCY = nVerticalAlign === "bottom"
                ? bodyBottom - blockH / 2
                : nVerticalAlign === "middle"
                    ? bodyMid
                    : bodyTop + blockH / 2;
            // multiline: use mkMultilineText so line-height is respected
            if (n.lines.length > 1) {
                // vertical centre of the text block inside the note
                ng.appendChild(mkMultilineText(n.lines, nTextX, blockCY, nFontSize, 400, String(gs.color ?? palette.noteText), nAnchor, nLineHeight, nFont, nLetterSpacing));
            }
            else {
                ng.appendChild(mkText(n.lines[0] ?? "", nTextX, blockCY, nFontSize, 400, String(gs.color ?? palette.noteText), nAnchor, nFont, nLetterSpacing));
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
    function drawAxes(rc, ctx, c, px, py, pw, ph, allY, labelCol, R) {
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
            ctx.font = '400 9px system-ui, sans-serif';
            ctx.fillStyle = labelCol;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(fmtNum(tick), px - 5, ty);
            ctx.restore();
        }
    }
    // ── Legend ─────────────────────────────────────────────────
    function drawLegend(ctx, labels, colors, x, y, labelCol) {
        ctx.save();
        ctx.font = '400 9px system-ui, sans-serif';
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
            ctx.font = '600 12px system-ui, sans-serif';
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
            drawLegend(ctx, segments.map(s => `${s.label} ${Math.round(s.value / total * 100)}%`), segments.map(s => s.color), legendX, legendY, lc);
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
            drawLegend(ctx, pts.map(p => p.label), CHART_COLORS, c.x + 8, c.y + (c.title ? 28 : 12), lc);
            return;
        }
        // ── Bar / Line / Area ─────────────────────────────────────
        const { labels, series } = parseBarLine(c.data);
        const allY = series.flatMap(s => s.values);
        const toY = makeValueToY(allY, py, ph);
        const baseline = toY(0);
        const n = labels.length;
        drawAxes(rc, ctx, c, px, py, pw, ph, allY, lc, R);
        // X labels
        ctx.save();
        ctx.font = '400 9px system-ui, sans-serif';
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
            drawLegend(ctx, series.map(s => s.name), series.map(s => s.color), px, py - 2, lc);
        }
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
            rc.rectangle(g.x, g.y, g.w, g.h, {
                ...R, roughness: 1.7, bowing: 0.4, seed: hashStr$1(g.id),
                fill: String(gs.fill ?? palette.groupFill),
                fillStyle: 'solid',
                stroke: String(gs.stroke ?? palette.groupStroke),
                strokeWidth: Number(gs.strokeWidth ?? 1.2),
                strokeLineDash: gs.strokeDash ?? palette.groupDash,
            });
            // ── Group label ──────────────────────────────────────
            // Only render when label has content — empty label = no reserved space
            // supports: font, font-size, letter-spacing (always left-anchored)
            if (g.label) {
                const gFontSize = Number(gs.fontSize ?? 12);
                const gFont = resolveStyleFont(gs, diagramFont);
                const gLetterSpacing = gs.letterSpacing;
                const gLabelColor = gs.color ? String(gs.color) : palette.groupLabel;
                drawText(ctx, g.label, g.x + 14, g.y + 16, gFontSize, 500, gLabelColor, 'left', gFont, gLetterSpacing);
            }
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
                ctx.save();
                ctx.font = `400 ${eFontSize}px ${eFont}`;
                const tw = ctx.measureText(e.label).width + 12;
                ctx.restore();
                ctx.fillStyle = palette.edgeLabelBg;
                ctx.fillRect(mx - tw / 2, my - 8, tw, 15);
                drawText(ctx, e.label, mx, my + 3, eFontSize, 400, palette.edgeLabelText, 'center', eFont, eLetterSpacing);
            }
        }
        // ── Nodes ─────────────────────────────────────────────────
        for (const n of sg.nodes) {
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
            // x shifts for left/right alignment
            const textX = textAlign === 'left' ? n.x + 8
                : textAlign === 'right' ? n.x + n.w - 8
                    : n.x + n.w / 2;
            // word-wrap for text shape; explicit \n for all others
            const rawLines = n.label.split('\n');
            const lines = n.shape === 'text' && rawLines.length === 1
                ? wrapText(n.label, n.w - 16, fontSize)
                : rawLines;
            // vertical-align: compute textCY from top/middle/bottom
            const nodeBodyTop = n.y + 6;
            const nodeBodyBottom = n.y + n.h - 6;
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
        }
        // ── Tables ────────────────────────────────────────────────
        for (const t of sg.tables) {
            const gs = t.style ?? {};
            const fill = String(gs.fill ?? palette.tableFill);
            const strk = String(gs.stroke ?? palette.tableStroke);
            const textCol = String(gs.color ?? palette.tableText);
            const pad = t.labelH;
            // ── Table-level font ────────────────────────────────
            // supports: font, font-size, letter-spacing
            // cells also support text-align
            const tFontSize = Number(gs.fontSize ?? 12);
            const tFont = resolveStyleFont(gs, diagramFont);
            const tLetterSpacing = gs.letterSpacing;
            rc.rectangle(t.x, t.y, t.w, t.h, {
                ...R, seed: hashStr$1(t.id),
                fill, fillStyle: 'solid', stroke: strk, strokeWidth: 1.5,
            });
            rc.line(t.x, t.y + pad, t.x + t.w, t.y + pad, {
                roughness: 0.6, seed: hashStr$1(t.id + 'l'), stroke: strk, strokeWidth: 1,
            });
            // ── Table label: always left-anchored ───────────────
            drawText(ctx, t.label, t.x + 10, t.y + pad / 2, tFontSize, 500, textCol, 'left', tFont, tLetterSpacing);
            let rowY = t.y + pad;
            for (const row of t.rows) {
                const rh = row.kind === 'header' ? t.headerH : t.rowH;
                if (row.kind === 'header') {
                    ctx.fillStyle = palette.tableHeaderFill;
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
                const cellFw = row.kind === 'header' ? 600 : 400;
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
        }
        // ── Notes ─────────────────────────────────────────────────
        for (const n of sg.notes) {
            const gs = n.style ?? {};
            const fill = String(gs.fill ?? palette.noteFill);
            const strk = String(gs.stroke ?? palette.noteStroke);
            const fold = 14;
            const { x, y, w, h } = n;
            rc.polygon([
                [x, y],
                [x + w - fold, y],
                [x + w, y + fold],
                [x + w, y + h],
                [x, y + h],
            ], { ...R, seed: hashStr$1(n.id), fill, fillStyle: 'solid', stroke: strk, strokeWidth: 1.2 });
            rc.polygon([
                [x + w - fold, y],
                [x + w, y + fold],
                [x + w - fold, y + fold],
            ], { roughness: 0.4, seed: hashStr$1(n.id + 'f'),
                fill: palette.noteFold, fillStyle: 'solid', stroke: strk, strokeWidth: 0.8 });
            // ── Note typography ─────────────────────────────────
            // supports: font, font-size, letter-spacing, text-align,
            //           vertical-align, line-height
            const nFontSize = Number(gs.fontSize ?? 12);
            const nFont = resolveStyleFont(gs, diagramFont);
            const nLetterSpacing = gs.letterSpacing;
            const nLineHeight = Number(gs.lineHeight ?? 1.4) * nFontSize;
            const nTextAlign = String(gs.textAlign ?? 'left');
            const nVertAlign = String(gs.verticalAlign ?? 'top');
            const nColor = String(gs.color ?? palette.noteText);
            const nTextX = nTextAlign === 'right' ? x + w - fold - 6
                : nTextAlign === 'center' ? x + (w - fold) / 2
                    : x + 12;
            // vertical-align inside note body (below fold)
            const bodyTop = y + fold + 8;
            const bodyBottom = y + h - 8;
            const blockH = (n.lines.length - 1) * nLineHeight;
            const blockCY = nVertAlign === 'bottom' ? bodyBottom - blockH / 2
                : nVertAlign === 'middle' ? (bodyTop + bodyBottom) / 2
                    : bodyTop + blockH / 2; // top (default)
            if (n.lines.length > 1) {
                drawMultilineText(ctx, n.lines, nTextX, blockCY, nFontSize, 400, nColor, nTextAlign, nLineHeight, nFont, nLetterSpacing);
            }
            else {
                drawText(ctx, n.lines[0] ?? '', nTextX, blockCY, nFontSize, 400, nColor, nTextAlign, nFont, nLetterSpacing);
            }
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
        const paths = Array.from(el.querySelectorAll("path"));
        if (!paths.length)
            return;
        const linePath = paths[0];
        const headPaths = paths.slice(1);
        const STROKE_DUR = 360;
        const len = pathLength(linePath);
        const reversed = conn.startsWith("<") && !conn.includes(">");
        linePath.style.strokeDasharray = `${len}`;
        linePath.style.strokeDashoffset = reversed ? `${-len}` : `${len}`;
        linePath.style.transition = "none";
        headPaths.forEach((p) => {
            p.style.opacity = "0";
            p.style.transition = "none";
        });
        el.classList.remove("draw-hidden");
        el.classList.add("draw-reveal");
        el.style.opacity = "1";
        requestAnimationFrame(() => requestAnimationFrame(() => {
            linePath.style.transition = `stroke-dashoffset ${STROKE_DUR}ms cubic-bezier(.4,0,.2,1)`;
            linePath.style.strokeDashoffset = "0";
            setTimeout(() => {
                headPaths.forEach((p) => {
                    p.style.transition = "opacity 120ms ease";
                    p.style.opacity = "1";
                });
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
            this.svg.querySelectorAll(".tg, .ntg, .cg").forEach((el) => {
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
            }
        }
        // ── erase ─────────────────────────────────────────────────
        _doErase(target) {
            const el = resolveEl(this.svg, target); // handles edges too now
            if (el) {
                el.style.transition = 'opacity 0.4s';
                el.style.opacity = '0';
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
                el.querySelectorAll('path, line, polyline').forEach(p => {
                    p.style.stroke = color;
                });
                el.querySelectorAll('polygon').forEach(p => {
                    p.style.fill = color;
                    p.style.stroke = color;
                });
                return;
            }
            // everything else — color fill
            let hit = false;
            el.querySelectorAll('path, rect, ellipse, polygon').forEach(c => {
                const attrFill = c.getAttribute('fill');
                if (attrFill === 'none')
                    return;
                if (attrFill === null && c.tagName === 'path')
                    return;
                c.style.fill = color;
                hit = true;
            });
            if (!hit) {
                el.querySelectorAll('text').forEach(t => { t.style.fill = color; });
            }
        }
    }
    const ANIMATION_CSS = `
.ng, .gg, .tg, .ntg, .cg, .eg {
  transform-box: fill-box;
  transform-origin: center;
  transition: filter 0.3s, opacity 0.35s;
}

/* highlight */
.ng.hl path, .ng.hl rect, .ng.hl ellipse, .ng.hl polygon,
.tg.hl path, .tg.hl rect,
.ntg.hl path, .ntg.hl polygon,
.cg.hl path, .cg.hl rect,
.eg.hl path, .eg.hl line, .eg.hl polygon { stroke-width: 2.8 !important; }

.ng.hl, .tg.hl, .ntg.hl, .cg.hl, .eg.hl {
  animation: ng-pulse 1.4s ease-in-out infinite;
}
@keyframes ng-pulse {
  0%, 100% { filter: drop-shadow(0 0 7px rgba(200,84,40,.6)); }
  50%       { filter: drop-shadow(0 0 14px rgba(200,84,40,.9)); }
}

/* fade */
.ng.faded, .gg.faded, .tg.faded, .ntg.faded, .cg.faded, .eg.faded { opacity: 0.22; }

.ng.hidden { opacity: 0; pointer-events: none; }
.eg.draw-hidden { opacity: 0; }
.eg.draw-reveal { opacity: 1; }
.gg.gg-hidden  { opacity: 0; }
.tg.gg-hidden  { opacity: 0; }
.ntg.gg-hidden { opacity: 0; }
.cg.gg-hidden  { opacity: 0; }
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
    // sketchmark — Encrypted sharing
    // Diagram DSL is encrypted in the browser.
    // The server stores an opaque blob it cannot read.
    // The decryption key lives only in the URL fragment (#key=...).
    // ============================================================
    const WORKER_URL = 'https://sketchmark.anmism.workers.dev';
    // ── Crypto helpers ────────────────────────────────────────
    async function generateKey() {
        return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, // extractable so we can export to URL
        ['encrypt', 'decrypt']);
    }
    async function keyToBase64(key) {
        const raw = await crypto.subtle.exportKey('raw', key);
        return btoa(String.fromCharCode(...new Uint8Array(raw)));
    }
    async function base64ToKey(b64) {
        const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, // not extractable on the receiving end
        ['decrypt']);
    }
    // ── Encrypt ───────────────────────────────────────────────
    async function encryptDSL(dsl, key) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(dsl);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
        // prepend iv to the blob: [ iv (12 bytes) | ciphertext ]
        const result = new Uint8Array(12 + encrypted.byteLength);
        result.set(iv, 0);
        result.set(new Uint8Array(encrypted), 12);
        return result;
    }
    // ── Decrypt ───────────────────────────────────────────────
    async function decryptBlob(blob, key) {
        const iv = blob.slice(0, 12);
        const ciphertext = blob.slice(12);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    }
    // ── Public API ────────────────────────────────────────────
    /**
     * Encrypt DSL, upload to worker, return shareable URL.
     * The URL fragment (#key=...) never reaches the server.
     */
    async function shareDiagram(dsl) {
        const key = await generateKey();
        const blob = await encryptDSL(dsl, key);
        const keyB64 = await keyToBase64(key);
        const res = await fetch(`${WORKER_URL}/api/blob`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: blob.buffer,
        });
        if (!res.ok)
            throw new Error(`Upload failed: ${res.status}`);
        const { id } = await res.json();
        // key goes into the fragment — browser never sends this to any server
        return `${window.location.origin}/sketchmark/playground.html?s=${id}#key=${keyB64}`;
    }
    /**
     * Read ?s= and #key= from the current URL, fetch + decrypt the diagram.
     * Returns null if no share params found.
     */
    async function loadSharedDiagram() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('s');
        if (!id)
            return null;
        // key is in the fragment — parse manually, not via URLSearchParams
        // (URLSearchParams on hash strips the #)
        const fragment = window.location.hash.slice(1);
        const keyMatch = fragment.match(/key=([^&]+)/);
        if (!keyMatch)
            return null;
        const keyB64 = keyMatch[1];
        const res = await fetch(`${WORKER_URL}/api/blob/${id}`);
        if (!res.ok)
            throw new Error('Diagram not found or expired');
        const blob = await res.arrayBuffer();
        const key = await base64ToKey(keyB64);
        return decryptBlob(blob, key);
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
    exports.loadSharedDiagram = loadSharedDiagram;
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
    exports.shareDiagram = shareDiagram;
    exports.sleep = sleep;
    exports.svgToPNGDataURL = svgToPNGDataURL;
    exports.svgToString = svgToString;
    exports.throttle = throttle;

    return exports;

})({});
