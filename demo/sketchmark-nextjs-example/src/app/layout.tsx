import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sketchmark — Next.js Example',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
          rough.js MUST be loaded as a plain <script> tag so it lands on
          window.rough before sketchmark runs.
          Do NOT import it as an ES module — sketchmark expects the global.
        */}
        <script
          src="https://unpkg.com/roughjs@4.6.6/bundled/rough.js"
          async={false}   // load synchronously so it's ready before hydration
        />
      </head>
      <body style={{ margin: 0, background: '#f8f4ea', fontFamily: "monospace" }}>
        {children}
      </body>
    </html>
  );
}
