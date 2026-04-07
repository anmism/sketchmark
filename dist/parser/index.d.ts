import type { DiagramAST } from "../ast/types";
import type { ParseOptions } from "../plugins";
export type { DiagramAST } from "../ast/types";
export declare class ParseError extends Error {
    line: number;
    col: number;
    constructor(msg: string, line: number, col: number);
}
export declare function parse(src: string, options?: ParseOptions): DiagramAST;
//# sourceMappingURL=index.d.ts.map