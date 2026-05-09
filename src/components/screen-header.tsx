// Shared top-of-page header. Used by every primary route in (app)/* so
// title styling, padding, and subtitle treatment can never drift.
//
// If you find yourself copy-pasting `<div className="border-b border-border bg-card">…`
// somewhere else, use this instead.

interface ScreenHeaderProps {
  title: string
  subtitle?: string
}

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-4">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
