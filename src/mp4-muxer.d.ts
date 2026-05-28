declare module "mp4-muxer" {
  export class ArrayBufferTarget {
    buffer: ArrayBuffer;
  }

  export class Muxer {
    constructor(options: Record<string, unknown>);
    addVideoChunk(chunk: unknown, metadata: unknown): void;
    finalize(): void;
  }
}
