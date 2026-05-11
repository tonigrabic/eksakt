// Shared top-of-page header. Used by every primary route in (app)/* so
// title styling, padding, and subtitle treatment can never drift.
//
// If you find yourself copy-pasting `<div className="border-b border-border bg-card">…`
// somewhere else, use this instead.

import type { ReactNode } from 'react'

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  // Right-aligned slot for an action button (e.g. Help). Optional.
  action?: ReactNode
}

export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}
