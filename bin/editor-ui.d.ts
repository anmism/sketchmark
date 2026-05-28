export function editorHtml(
  title: string,
  options?: {
    apiBase?: string;
    mp4MuxerUrl?: string;
    mp4MuxerSource?: string | false;
    serverExportFallback?: boolean;
  }
): string;

export function editorMp4MuxerSource(value?: string | false): string;
