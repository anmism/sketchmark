'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { render } from 'sketchmark';   // ← clean top-level import

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
  dsl:           string;
  showTitle?:    boolean;
  theme?:        'light' | 'dark' | 'auto';
  transparent?:  boolean;
  className?:    string;
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

  const [stepInfo, setStepInfo] = useState('—');
  const [canNext,  setCanNext]  = useState(false);
  const [canPrev,  setCanPrev]  = useState(false);
  const [playing,  setPlaying]  = useState(false);
  const [error,    setError]    = useState('');

  const syncAnim = useCallback(() => {
    const anim = instanceRef.current?.anim;
    if (!anim) return;
    setCanNext(anim.canNext);
    setCanPrev(anim.canPrev);
    setStepInfo(
      !anim.total         ? 'no steps'
      : anim.currentStep < 0 ? `${anim.total} steps`
      : `${anim.currentStep + 1} / ${anim.total}`
    );
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.innerHTML = '';
    setError('');

    try {
      // render() is synchronous now — no waiting, no async, no polling
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

    // no cleanup needed — re-render clears innerHTML above
  }, [dsl, showTitle, theme, transparent, syncAnim]);

  return (
    <div className={className}>
      <div ref={containerRef} />

      {error && (
        <p style={{ color: '#cc0000', fontSize: 12, fontFamily: 'monospace', marginTop: 8 }}>
          ⚠ {error}
        </p>
      )}

      {showControls && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <AnimBtn onClick={() => { instanceRef.current?.anim.reset(); syncAnim(); }}>↺ Reset</AnimBtn>
          <AnimBtn disabled={!canPrev} onClick={() => { instanceRef.current?.anim.prev(); syncAnim(); }}>← Prev</AnimBtn>
          <span style={{ fontSize: 12, color: '#9a7848', minWidth: 70, textAlign: 'center' }}>
            {stepInfo}
          </span>
          <AnimBtn disabled={!canNext} onClick={() => { instanceRef.current?.anim.next(); syncAnim(); }}>Next →</AnimBtn>
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

function AnimBtn({ children, onClick, disabled = false }: {
  children: React.ReactNode;
  onClick:  () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background:   disabled ? '#ccc' : '#1a1208',
        color:        '#f8f4ea',
        border:       'none',
        padding:      '6px 14px',
        fontFamily:   "'Courier New', monospace",
        fontSize:     11,
        cursor:       disabled ? 'default' : 'pointer',
        borderRadius: 2,
        opacity:      disabled ? 0.45 : 1,
        transition:   'background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) (e.target as HTMLElement).style.background = '#c85428'; }}
      onMouseLeave={e => { if (!disabled) (e.target as HTMLElement).style.background = '#1a1208'; }}
    >
      {children}
    </button>
  );
}