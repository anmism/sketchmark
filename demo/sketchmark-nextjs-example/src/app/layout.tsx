import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sketchmark — Next.js Example',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f8f4ea', fontFamily: "monospace" }}>
        {children}
      </body>
    </html>
  );
}
