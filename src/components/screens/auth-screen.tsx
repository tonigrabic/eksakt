'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Trophy, Mail, AlertCircle, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const CODE_LENGTH = 6

export function AuthScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackError = searchParams.get('error')
  const next = searchParams.get('next') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [isEmailSent, setIsEmailSent] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
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

  const handleVerifyCode = async () => {
    if (code.length !== CODE_LENGTH || isVerifying) return
    setError(null)
    setIsVerifying(true)

    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })

    setIsVerifying(false)
    if (verifyError) {
      setError(verifyError.message)
      setCode('')
      return
    }
    const safeNext = next.startsWith('/') ? next : '/dashboard'
    router.push(safeNext)
    router.refresh()
  }

  const resetForm = () => {
    setIsEmailSent(false)
    setCode('')
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
                {'We sent a sign-in link and a 6-digit code to '}
                <span className="font-medium text-foreground">{email}</span>
                {'.'}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                {'Enter the 6-digit code'}
              </label>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={CODE_LENGTH}
                placeholder="123456"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerifyCode()
                }}
                disabled={isVerifying}
                className="bg-background text-center text-2xl font-mono tracking-[0.5em] tabular-nums"
                autoFocus
              />
              <Button
                className="w-full"
                size="lg"
                onClick={handleVerifyCode}
                disabled={code.length !== CODE_LENGTH || isVerifying}
              >
                {isVerifying ? 'Verifying…' : 'Sign in'}
              </Button>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                {"Or just click the link in the email — it'll sign you in directly."}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={resetForm}
                disabled={isVerifying}
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
