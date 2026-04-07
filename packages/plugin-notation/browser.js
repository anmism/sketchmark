const DEFAULT_DELIMITERS = [
  ["$", "$"],
  ["\\(", "\\)"],
];

const SIMPLE_COMMANDS = {
  alpha: "\u03b1",
  beta: "\u03b2",
  gamma: "\u03b3",
  delta: "\u03b4",
  epsilon: "\u03b5",
  theta: "\u03b8",
  lambda: "\u03bb",
  mu: "\u03bc",
  pi: "\u03c0",
  sigma: "\u03c3",
  phi: "\u03c6",
  psi: "\u03c8",
  omega: "\u03c9",
  Gamma: "\u0393",
  Delta: "\u0394",
  Theta: "\u0398",
  Lambda: "\u039b",
  Pi: "\u03a0",
  Sigma: "\u03a3",
  Phi: "\u03a6",
  Psi: "\u03a8",
  Omega: "\u03a9",
  cdot: "\u00b7",
  times: "\u00d7",
  pm: "\u00b1",
  mp: "\u2213",
  neq: "\u2260",
  le: "\u2264",
  leq: "\u2264",
  ge: "\u2265",
  geq: "\u2265",
  approx: "\u2248",
  sim: "\u223c",
  circ: "\u00b0",
  to: "\u2192",
  rightarrow: "\u2192",
  leftarrow: "\u2190",
  leftrightarrow: "\u2194",
  Rightarrow: "\u21d2",
  Leftarrow: "\u21d0",
  Leftrightarrow: "\u21d4",
  infty: "\u221e",
  degree: "\u00b0",
  partial: "\u2202",
  sum: "\u2211",
  prod: "\u220f",
  int: "\u222b",
  angle: "\u2220",
  perp: "\u22a5",
  parallel: "\u2225",
  subset: "\u2282",
  subseteq: "\u2286",
  supset: "\u2283",
  supseteq: "\u2287",
  in: "\u2208",
  notin: "\u2209",
  forall: "\u2200",
  exists: "\u2203",
  because: "\u2235",
  therefore: "\u2234",
  sin: "sin",
  cos: "cos",
  tan: "tan",
  log: "log",
  ln: "ln",
  left: "",
  right: "",
};

const GROUP_WRAPPER_COMMANDS = new Set([
  "text",
  "mathrm",
  "mathbf",
  "mathit",
  "operatorname",
  "textrm",
  "textbf",
  "mathsf",
  "mathtt",
]);

const SUPERSCRIPTS = {
  "0": "\u2070",
  "1": "\u00b9",
  "2": "\u00b2",
  "3": "\u00b3",
  "4": "\u2074",
  "5": "\u2075",
  "6": "\u2076",
  "7": "\u2077",
  "8": "\u2078",
  "9": "\u2079",
  "+": "\u207a",
  "-": "\u207b",
  "=": "\u207c",
  "(": "\u207d",
  ")": "\u207e",
  n: "\u207f",
  i: "\u2071",
};

const SUBSCRIPTS = {
  "0": "\u2080",
  "1": "\u2081",
  "2": "\u2082",
  "3": "\u2083",
  "4": "\u2084",
  "5": "\u2085",
  "6": "\u2086",
  "7": "\u2087",
  "8": "\u2088",
  "9": "\u2089",
  "+": "\u208a",
  "-": "\u208b",
  "=": "\u208c",
  "(": "\u208d",
  ")": "\u208e",
  a: "\u2090",
  e: "\u2091",
  h: "\u2095",
  i: "\u1d62",
  j: "\u2c7c",
  k: "\u2096",
  l: "\u2097",
  m: "\u2098",
  n: "\u2099",
  o: "\u2092",
  p: "\u209a",
  r: "\u1d63",
  s: "\u209b",
  t: "\u209c",
  u: "\u1d64",
  v: "\u1d65",
  x: "\u2093",
};

export function notation(options = {}) {
  const delimiters = options.delimiters ?? DEFAULT_DELIMITERS;
  const transformNarration = options.transformNarration !== false;
  const transformMarkdown = options.transformMarkdown === true;

  return {
    name: "notation",
    transformAst(ast) {
      return {
        ...ast,
        title: transformOptionalText(ast.title, delimiters),
        description: transformOptionalText(ast.description, delimiters),
        nodes: ast.nodes.map((node) => ({
          ...node,
          label: transformRequiredText(node.label, delimiters),
        })),
        edges: ast.edges.map((edge) => ({
          ...edge,
          label: transformOptionalText(edge.label, delimiters),
        })),
        groups: ast.groups.map((group) => ({
          ...group,
          label: transformRequiredText(group.label, delimiters),
        })),
        tables: ast.tables.map((table) => ({
          ...table,
          label: transformRequiredText(table.label, delimiters),
          rows: table.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell) => transformRequiredText(cell, delimiters)),
          })),
        })),
        charts: ast.charts.map((chart) => ({
          ...chart,
          label: transformOptionalText(chart.label, delimiters),
          data: {
            headers: chart.data.headers.map((header) => transformRequiredText(header, delimiters)),
            rows: chart.data.rows.map((row) =>
              row.map((value) =>
                typeof value === "string" ? transformRequiredText(value, delimiters) : value,
              ),
            ),
          },
        })),
        markdowns: ast.markdowns.map((markdown) =>
          transformMarkdown
            ? { ...markdown, content: transformRequiredText(markdown.content, delimiters) }
            : markdown,
        ),
        steps: ast.steps.map((step) =>
          transformNarration ? transformStep(step, delimiters) : step,
        ),
      };
    },
  };
}

export function renderMath(text) {
  return renderMathFragment(text.trim());
}

function transformStep(step, delimiters) {
  if (step.kind === "beat") {
    return {
      ...step,
      children: step.children.map((child) => transformStep(child, delimiters)),
    };
  }
  if (step.action !== "narrate") return step;
  return {
    ...step,
    value: transformText(step.value, delimiters),
  };
}

function transformText(value, delimiters) {
  if (typeof value !== "string" || !value) return value;
  let nextValue = value;
  for (const [open, close] of delimiters) {
    nextValue = replaceDelimited(nextValue, open, close, renderMathFragment);
  }
  return unescapeDelimiters(nextValue, delimiters);
}

function transformRequiredText(value, delimiters) {
  return transformText(value, delimiters) ?? value;
}

function transformOptionalText(value, delimiters) {
  return transformText(value, delimiters);
}

function replaceDelimited(value, open, close, transform) {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const start = findToken(value, open, index);
    if (start < 0) {
      result += value.slice(index);
      break;
    }

    const end = findToken(value, close, start + open.length);
    if (end < 0) {
      result += value.slice(index);
      break;
    }

    result += value.slice(index, start);
    result += transform(value.slice(start + open.length, end));
    index = end + close.length;
  }

  return result;
}

function findToken(value, token, start) {
  let index = start;
  while (index < value.length) {
    index = value.indexOf(token, index);
    if (index < 0) return -1;
    if (!isEscaped(value, index)) return index;
    index += token.length;
  }
  return -1;
}

function isEscaped(value, index) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function renderMathFragment(value) {
  let nextValue = reviveMathCommands(value);
  let previousValue = "";
  let iterations = 0;

  while (nextValue !== previousValue && iterations < 8) {
    previousValue = nextValue;
    nextValue = replaceCommandWithGroups(nextValue, "\\frac", 2, ([left, right]) =>
      `${renderMathFragment(left)}\u2044${renderMathFragment(right)}`,
    );
    nextValue = replaceCommandWithGroups(nextValue, "\\sqrt", 1, ([content]) =>
      `\u221a(${renderMathFragment(content)})`,
    );
    for (const command of GROUP_WRAPPER_COMMANDS) {
      nextValue = replaceCommandWithGroups(nextValue, `\\${command}`, 1, ([content]) =>
        renderMathFragment(content),
      );
    }
    iterations += 1;
  }

  nextValue = nextValue
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\:/g, " ");
  nextValue = replaceSimpleCommands(nextValue);
  nextValue = nextValue.replace(/\^\s*°/g, "°");
  nextValue = replaceScripts(nextValue);
  nextValue = nextValue.replace(/[{}]/g, "");
  nextValue = nextValue.replace(/\s+/g, " ").trim();
  return nextValue;
}

function reviveMathCommands(value) {
  return value
    .replace(/\t(?=[A-Za-z])/g, "\\t")
    .replace(/\n(?=[A-Za-z])/g, "\\n")
    .replace(/\r(?=[A-Za-z])/g, "\\r");
}

function replaceCommandWithGroups(value, command, arity, render) {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const start = value.indexOf(command, index);
    if (start < 0) {
      result += value.slice(index);
      break;
    }

    result += value.slice(index, start);
    let cursor = start + command.length;
    const args = [];
    let valid = true;

    for (let argIndex = 0; argIndex < arity; argIndex += 1) {
      cursor = skipWhitespace(value, cursor);
      const group = readBalancedGroup(value, cursor);
      if (!group) {
        valid = false;
        break;
      }
      args.push(group.content);
      cursor = group.end;
    }

    if (!valid) {
      result += command;
      index = start + command.length;
      continue;
    }

    result += render(args);
    index = cursor;
  }

  return result;
}

function readBalancedGroup(value, start) {
  if (value[start] !== "{") return null;

  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    const ch = value[index];
    if (ch === "{" && !isEscaped(value, index)) depth += 1;
    if (ch === "}" && !isEscaped(value, index)) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: value.slice(start + 1, index),
          end: index + 1,
        };
      }
    }
  }

  return null;
}

function skipWhitespace(value, start) {
  let index = start;
  while (index < value.length && /\s/.test(value[index] ?? "")) index += 1;
  return index;
}

function replaceSimpleCommands(value) {
  return value.replace(/\\([A-Za-z]+)/g, (_, rawCommand) => {
    if (rawCommand in SIMPLE_COMMANDS) return SIMPLE_COMMANDS[rawCommand];
    return rawCommand;
  });
}

function replaceScripts(value) {
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const marker = value[index];
    if (marker !== "^" && marker !== "_") {
      result += marker;
      continue;
    }

    const token = readScriptToken(value, index + 1);
    if (!token) {
      result += marker;
      continue;
    }

    result += applyScript(token.content, marker === "^" ? SUPERSCRIPTS : SUBSCRIPTS, marker);
    index = token.end - 1;
  }

  return result;
}

function readScriptToken(value, start) {
  let cursor = skipWhitespace(value, start);
  if (cursor >= value.length) return null;

  const group = readBalancedGroup(value, cursor);
  if (group) {
    return {
      content: renderMathFragment(group.content),
      end: group.end,
    };
  }

  const single = value[cursor];
  if (!single) return null;
  cursor += 1;
  return {
    content: single,
    end: cursor,
  };
}

function applyScript(value, alphabet, marker) {
  let rendered = "";
  for (const ch of value.replace(/\s+/g, "")) {
    const mapped = alphabet[ch];
    if (!mapped) return `${marker}(${value})`;
    rendered += mapped;
  }
  return rendered;
}

function unescapeDelimiters(value, delimiters) {
  let nextValue = value;
  for (const [open, close] of delimiters) {
    nextValue = nextValue
      .split(`\\${open}`).join(open)
      .split(`\\${close}`).join(close);
  }
  return nextValue;
}
