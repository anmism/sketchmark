'use client';

import { useEffect, useRef, useState } from "react";
import { SketchmarkEmbed } from "sketchmark";

type EmbedTheme = "light" | "dark" | "auto";

interface Props {
  dsl: string;
  showTitle?: boolean;
  theme?: EmbedTheme;
  transparent?: boolean;
  className?: string;
  showControls?: boolean;
  showExports?: boolean;
  width?: number | string;
  height?: number | string;
}

export default function SketchmarkDiagram({
  dsl,
  showTitle = true,
  theme = "light",
  transparent = true,
  className = "",
  showControls = true,
  showExports = true,
  width = "100%",
  height = 520,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<SketchmarkEmbed | null>(null);

  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const host = containerRef.current;
    if (!host) return;

    setError("");
    setReady(false);
    host.innerHTML = "";
    instanceRef.current?.destroy();
    instanceRef.current = null;

    const resolvedTheme = (() => {
      if (theme !== "auto") return theme;
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
      return "light";
    })();

    try {
      const instance = new SketchmarkEmbed({
        container: containerRef.current as HTMLDivElement,
        dsl,
        width,
        height,
        theme: resolvedTheme,
        showControls,
        playStepDelay: 700,
        focusPadding: 32,
        focusDuration: 240,
        svgOptions: {
          showTitle,
          interactive: true,
          transparent,
        },
      });

      if (cancelled) {
        instance.destroy();
        return;
      }

      instanceRef.current = instance;
      setReady(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (!cancelled) setError(message);
    }

    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
      host.innerHTML = "";
    };
  }, [dsl, height, showControls, showTitle, theme, transparent, width]);

  return (
    <div className={className} style={{ display: "grid", gap: 12 }}>
      <div ref={containerRef} />

      {error ? (
        <p
          style={{
            margin: 0,
            color: "#cc0000",
            fontSize: 12,
            fontFamily: "'Courier New', monospace",
          }}
        >
          Error: {error}
        </p>
      ) : null}

      {showExports && ready ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <ActionButton onClick={() => instanceRef.current?.exportSVG("next-example.svg")}>
            Download SVG
          </ActionButton>
          <ActionButton onClick={() => void instanceRef.current?.exportPNG("next-example.png")}>
            Download PNG
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid #c3a46b",
        borderRadius: 999,
        background: "#1a1208",
        color: "#fff8ea",
        padding: "10px 16px",
        fontFamily: "'Courier New', monospace",
        fontSize: 12,
        letterSpacing: "0.04em",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
