// Eksakt — email transport strategy.
//
// One small interface, several interchangeable implementations. Edge
// Functions build a provider with `emailProviderFromEnv()` and call
// `.send()` — they never know or care which backend is wired up.
//
//   • MailpitEmailProvider — local dev. POSTs to the Supabase Mailpit
//     inbox (the same place auth/login emails land), so you can eyeball
//     rendered emails at http://127.0.0.1:54324 without a real provider.
//   • ResendEmailProvider  — production. Resend's HTTP send API.
//
// Adding a backend (e.g. an SMTP provider to reuse Supabase's configured
// SMTP) is a single new class implementing EmailProvider + one branch in
// the factory — nothing else in the codebase changes.

export type EmailMessage = {
  /** RFC 5322 address, optionally with a display name: "Eksakt <hi@x.io>". */
  from: string
  to: string
  subject: string
  html: string
}

export interface EmailProvider {
  /** Stable identifier, handy for logging which transport actually ran. */
  readonly name: string
  send(message: EmailMessage): Promise<void>
}

// ── Resend (production) ──────────────────────────────────────────────────────

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend'
  constructor(private readonly apiKey: string) {}

  async send(m: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: m.from,
        to: m.to,
        subject: m.subject,
        html: m.html,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Resend ${res.status}: ${detail}`)
    }
  }
}

// ── Mailpit (local dev) ──────────────────────────────────────────────────────

export class MailpitEmailProvider implements EmailProvider {
  readonly name = 'mailpit'
  private readonly baseUrl: string
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async send(m: EmailMessage): Promise<void> {
    const { name, email } = parseAddress(m.from)
    const res = await fetch(`${this.baseUrl}/api/v1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: { Email: email, Name: name },
        To: [{ Email: m.to }],
        Subject: m.subject,
        HTML: m.html,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Mailpit ${res.status}: ${detail}`)
    }
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Pick a transport from the environment. MAILPIT_URL wins when present
 * (local dev), otherwise RESEND_API_KEY selects Resend. Throws if neither
 * is configured so a misconfigured deploy fails loudly instead of
 * silently dropping mail.
 */
export function emailProviderFromEnv(): EmailProvider {
  const mailpitUrl = Deno.env.get('MAILPIT_URL')
  if (mailpitUrl) return new MailpitEmailProvider(mailpitUrl)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (resendKey) return new ResendEmailProvider(resendKey)

  throw new Error(
    'No email provider configured: set MAILPIT_URL (local) or RESEND_API_KEY (production)',
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Split "Name <email>" (or a bare address) into its parts. */
export function parseAddress(from: string): { name: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1] || 'Eksakt', email: m[2].trim() }
  return { name: 'Eksakt', email: from.trim() }
}
