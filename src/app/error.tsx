'use client'

// Route-level error boundary: a client crash shows this instead of
// Next's dead "Application error" white screen.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="font-display text-[28px] font-black uppercase tracking-[0.02em] text-foreground">
          {'Something went wrong'}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {'An unexpected error occurred. Reloading usually fixes it.'}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[10px] text-dim">
            {'Ref: '}
            {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-5 bg-primary text-primary-foreground rounded-[8px] px-6 py-3 font-display text-[14px] font-black uppercase tracking-[0.08em] hover:opacity-95 transition-opacity"
        >
          {'Try again'}
        </button>
      </div>
    </div>
  )
}
