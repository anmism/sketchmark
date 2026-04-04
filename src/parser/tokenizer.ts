// ============================================================
// sketchmark — Tokenizer
// ============================================================

export type TokenType =
  | "KEYWORD"
  | "IDENT"
  | "STRING"
  | "STRING_BLOCK"
  | "NUMBER"
  | "ARROW"
  | "LBRACE"
  | "RBRACE"
  | "LBRACKET"
  | "RBRACKET"
  | "LPAREN"
  | "RPAREN"
  | "EQUALS"
  | "COMMA"
  | "COLON"
  | "HASH"
  | "DOT"
  | "STAR"
  | "NEWLINE"
  | "EOF"
  | "UNKNOWN";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export const KEYWORDS = new Set([
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

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0,
    line = 1,
    lineStart = 0;

  const col = () => i - lineStart + 1;
  const peek = (offset = 0) => src[i + offset] ?? "";
  const add = (type: TokenType, value: string) =>
    tokens.push({ type, value, line, col: col() - value.length });

  while (i < src.length) {
    const ch = src[i];

    // Skip comments
    if (ch === "#" || (ch === "/" && peek(1) === "/")) {
      while (i < src.length && src[i] !== "\n") i++;
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
          if (esc === "n") val += "\n";
          else if (esc === "t") val += "\t";
          else if (esc === "\\") val += "\\";
          else val += esc;
        } else val += src[i];
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
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
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
    const punct: Record<string, TokenType> = {
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
