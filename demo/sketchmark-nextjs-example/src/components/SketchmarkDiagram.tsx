'use client';

// ── Why 'use client'? ────────────────────────────────────────────────────
// sketchmark calls document.createElement and reads window.rough.
// Both of those crash during Next.js server rendering.
// 'use client' tells Next.js to only run this component in the browser.

import { useEffect, useRef, useState, useCallback } from 'react';

interface DiagramInstance {
  svg:  SVGSVGElement;
  anim: {
    total:       number;
    currentStep: number;
    canNext:     boolean;
    canPrev:     boolean;
    steps:       Array<{ action: string; target: string }>;
    next():  void;
    prev():  void;
    reset(): void;
    play(delay?: number): Promise<void>;
    on(cb: (event: any) => void): void;
  };
  exportSVG(): void;
  exportPNG(): Promise<void>;
}

interface Props {
  dsl:         string;
  showTitle?:  boolean;
  theme?:      'light' | 'dark' | 'auto';
  transparent?: boolean;
  className?:  string;
  showControls?: boolean;
}

export default function SketchmarkDiagram({
  dsl,
  showTitle    = true,
  theme        = 'light',
  transparent  = true,
  className    = '',
  showControls = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef  = useRef<DiagramInstance | null>(null);

  const [stepInfo,  setStepInfo]  = useState('—');
  const [canNext,   setCanNext]   = useState(false);
  const [canPrev,   setCanPrev]   = useState(false);
  const [playing,   setPlaying]   = useState(false);
  const [error,     setError]     = useState('');

  // ── Sync UI with animation state ──────────────────────
  const syncAnim = useCallback(() => {
    const anim = instanceRef.current?.anim;
    if (!anim) return;
    setCanNext(anim.canNext);
    setCanPrev(anim.canPrev);
    if (!anim.total) {
      setStepInfo('no steps');
    } else if (anim.currentStep < 0) {
      setStepInfo(`${anim.total} steps`);
    } else {
      setStepInfo(`${anim.currentStep + 1} / ${anim.total}`);
    }
  }, []);

  // ── Render diagram ─────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    async function init() {
      // Wait for rough.js to land on window (loaded via <script> in layout.tsx)
      let attempts = 0;
      while (typeof (window as any).rough === 'undefined' && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (cancelled) return;

      if (typeof (window as any).rough === 'undefined') {
        setError('rough.js failed to load. Check your network connection.');
        return;
      }

      // Dynamic import — sketchmark is browser-only so never imported at module level
      // This is the correct pattern for any browser-only library in Next.js
      const { render } = await import('sketchmark');

      if (cancelled) return;

      el.innerHTML = '';
      setError('');

      try {
        instanceRef.current = render({
          container:  el,
          dsl,
          renderer:   'svg',
          svgOptions: { showTitle, theme, transparent, interactive: true },
        }) as DiagramInstance;

        syncAnim();
      } catch (e: any) {
        setError(e?.message ?? 'Failed to render diagram');
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [dsl, showTitle, theme, transparent, syncAnim]);

  return (
    <div className={className}>
      {/* diagram SVG renders here */}
      <div ref={containerRef} />

      {error && (
        <p style={{ color: '#cc0000', fontSize: 12, fontFamily: 'monospace', marginTop: 8 }}>
          ⚠ {error}
        </p>
      )}

      {/* animation controls */}
      {showControls && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <AnimBtn onClick={() => { instanceRef.current?.anim.reset(); syncAnim(); }}>
            ↺ Reset
          </AnimBtn>
          <AnimBtn
            disabled={!canPrev}
            onClick={() => { instanceRef.current?.anim.prev(); syncAnim(); }}
          >
            ← Prev
          </AnimBtn>
          <span style={{ fontSize: 12, color: '#9a7848', minWidth: 70, textAlign: 'center' }}>
            {stepInfo}
          </span>
          <AnimBtn
            disabled={!canNext}
            onClick={() => { instanceRef.current?.anim.next(); syncAnim(); }}
          >
            Next →
          </AnimBtn>
          <AnimBtn
            disabled={playing}
            onClick={async () => {
              setPlaying(true);
              await instanceRef.current?.anim.play(700);
              syncAnim();
              setPlaying(false);
            }}
          >
            {playing ? '⏳' : '▶ Play'}
          </AnimBtn>
          <AnimBtn onClick={() => instanceRef.current?.exportSVG()}>↓ SVG</AnimBtn>
          <AnimBtn onClick={() => instanceRef.current?.exportPNG()}>↓ PNG</AnimBtn>
        </div>
      )}
    </div>
  );
}

// ── Tiny button helper ────────────────────────────────────
function AnimBtn({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background:    disabled ? '#ccc' : '#1a1208',
        color:         '#f8f4ea',
        border:        'none',
        padding:       '6px 14px',
        fontFamily:    "'Courier New', monospace",
        fontSize:      11,
        cursor:        disabled ? 'default' : 'pointer',
        borderRadius:  2,
        opacity:       disabled ? 0.45 : 1,
        transition:    'background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) (e.target as HTMLElement).style.background = '#c85428'; }}
      onMouseLeave={e => { if (!disabled) (e.target as HTMLElement).style.background = '#1a1208'; }}
    >
      {children}
    </button>
  );
}
