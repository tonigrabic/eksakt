'use client'

// Last-resort boundary: catches errors thrown by the root layout itself.
// Must render its own <html>/<body> — the layout is gone at this point —
// so it uses plain inline styles (no globals.css, no font variables).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" translate="no">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
          color: '#fafafa',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 360, padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0, textTransform: 'uppercase' }}>
            {'Something went wrong'}
          </h1>
          <p style={{ fontSize: 14, opacity: 0.65, marginTop: 8 }}>
            {'An unexpected error occurred. Reloading usually fixes it.'}
          </p>
          {error.digest && (
            <p style={{ fontSize: 10, opacity: 0.4, fontFamily: 'monospace' }}>
              {'Ref: '}
              {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#f5b400',
              color: '#09090b',
              fontWeight: 800,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {'Try again'}
          </button>
        </div>
      </body>
    </html>
  )
}
