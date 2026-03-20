/**
 * Encrypt DSL, upload to worker, return shareable URL.
 * The URL fragment (#key=...) never reaches the server.
 */
export declare function shareDiagram(dsl: string): Promise<string>;
/**
 * Read ?s= and #key= from the current URL, fetch + decrypt the diagram.
 * Returns null if no share params found.
 */
export declare function loadSharedDiagram(): Promise<string | null>;
//# sourceMappingURL=encrypted.d.ts.map