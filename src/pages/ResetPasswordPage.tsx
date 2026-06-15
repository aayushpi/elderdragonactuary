import { useState } from "react"
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Wordmark } from "@/components/modern/primitives"

/* Landing page for the password-recovery email link. Supabase puts the user in
 * a short-lived recovery session (AuthProvider flips `recovering`), and here they
 * choose a new password. Reached at /reset-password. */
export function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const { updatePassword, recovering, session } = useAuth()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const linkActive = recovering || !!session

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setSubmitting(true)
    try {
      const { error: err } = await updatePassword(password)
      if (err) {
        setError(err)
      } else {
        setDone(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <Wordmark />
      <div className="w-full max-w-sm space-y-6">
        {done ? (
          <div className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Password updated</h1>
              <p className="text-sm text-muted-foreground">You&apos;re all set — back to the table.</p>
            </div>
            <Button className="w-full" onClick={onDone}>Continue</Button>
          </div>
        ) : !linkActive ? (
          <div className="space-y-5 text-center">
            <h1 className="text-2xl font-bold">Reset link invalid</h1>
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired. Request a new one from the sign-in
              screen.
            </p>
            <Button variant="outline" className="w-full" onClick={onDone}>Back to sign in</Button>
          </div>
        ) : (
          <>
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-bold">Choose a new password</h1>
              <p className="text-sm text-muted-foreground">Enter and confirm your new password.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium">New password</label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-new-password" className="text-sm font-medium">Confirm new password</label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </div>

              {error && <p className="text-sm text-destructive font-medium">{error}</p>}

              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Update password
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
