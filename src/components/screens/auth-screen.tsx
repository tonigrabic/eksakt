'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Trophy, Mail, AlertCircle, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AuthScreen() {
  const searchParams = useSearchParams()
  const callbackError = searchParams.get('error')
  const next = searchParams.get('next') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [isEmailSent, setIsEmailSent] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(
    callbackError === 'auth_callback_failed'
      ? 'That sign-in link expired. Try again.'
      : null,
  )

  const handleMagicLink = async () => {
    if (!email || isSending) return
    setError(null)
    setIsSending(true)

    const supabase = createClient()
    // emailRedirectTo populates {{ .RedirectTo }} in the email template,
    // which our /auth/confirm route forwards to after verifying the OTP.
    const redirectTo = `${window.location.origin}${next}`
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    setIsSending(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    setIsEmailSent(true)
  }

  const resetForm = () => {
    setIsEmailSent(false)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-card border-border space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground text-balance">
            {'Eksakt'}
          </h1>
          <p className="text-muted-foreground text-balance">
            {'Predict scores, compete with friends, and dominate the leaderboard'}
          </p>
        </div>

        {!isEmailSent ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                {'Email address'}
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMagicLink()
                }}
                disabled={isSending}
                className="bg-background"
              />
              <Button
                className="w-full"
                size="lg"
                onClick={handleMagicLink}
                disabled={!email || isSending}
              >
                <Mail className="h-4 w-4 mr-2" />
                {isSending ? 'Sending…' : 'Continue with Email'}
              </Button>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {'Check your email'}
              </h2>
              <p className="text-sm text-muted-foreground text-balance">
                {'We sent a magic link to '}
                <span className="font-medium text-foreground">{email}</span>
                {'. Click the link in the email to sign in.'}
              </p>
            </div>

            <div className="pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={resetForm}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                {'Use a different email'}
              </Button>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground">
          {'By continuing, you agree to our Terms of Service and Privacy Policy'}
        </div>
      </Card>
    </div>
  )
}
