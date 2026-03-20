export type TokenType = "KEYWORD" | "IDENT" | "STRING" | "STRING_BLOCK" | "NUMBER" | "ARROW" | "LBRACE" | "RBRACE" | "LBRACKET" | "RBRACKET" | "LPAREN" | "RPAREN" | "EQUALS" | "COMMA" | "COLON" | "HASH" | "DOT" | "STAR" | "NEWLINE" | "EOF" | "UNKNOWN";
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    col: number;
}
export declare const KEYWORDS: Set<string>;
export declare function tokenize(src: string): Token[];
//# sourceMappingURL=tokenizer.d.ts.map