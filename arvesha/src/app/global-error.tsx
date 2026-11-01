'use client';

// Last resort when the root layout itself fails. It cannot rely on the site stylesheet, so it carries its own flat colours.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#ffe7c2', color: '#262726', fontFamily: 'Georgia, serif', textAlign: 'center' }}>
        <main>
          <h1 style={{ fontWeight: 500, fontSize: 32, margin: '0 0 12px' }}>Arvésha Clothing</h1>
          <p style={{ maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.5 }}>The store hit a problem while loading. Please try again in a moment.</p>
          <button type="button" onClick={reset} style={{ padding: '12px 22px', border: '1.5px solid #262726', borderRadius: 6, background: '#ffe7c2', color: '#262726', fontSize: 16, cursor: 'pointer' }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
