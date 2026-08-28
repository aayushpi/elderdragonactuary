import { useState, useEffect } from "react"
import { LogIn, UserPlus, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { copy } from "@/copy"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface AuthFormProps {
  onSignedIn?: () => void
  defaultMode?: "login" | "signup"
}

export function AuthForm({ onSignedIn, defaultMode = "login" }: AuthFormProps) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<"login" | "signup">(defaultMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!email.trim() || !password.trim()) {
      setError(copy.auth.errors.missingCredentials)
      return
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError(copy.auth.errors.passwordMismatch)
      return
    }

    if (mode === "signup" && !inviteCode.trim()) {
      setError(copy.auth.errors.missingInvite)
      return
    }

    if (password.length < 6) {
      setError(copy.auth.errors.passwordTooShort)
      return
    }

    setSubmitting(true)
    try {
      if (mode === "login") {
        const { error: err } = await signIn(email, password)
        if (err) {
          setError(err)
        } else {
          onSignedIn?.()
        }
      } else {
        const { error: err } = await signUp(email, password, inviteCode)
        if (err) {
          setError(err)
        } else {
          setInfo(copy.auth.confirmEmail)
          setMode("login")
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const modeParam = params.get("mode")
      const inviteParam = params.get("invite")
      if (modeParam === "signup") setMode("signup")
      if (inviteParam) setInviteCode(inviteParam)
    } catch {
      // ignore when not running in browser
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">
          {mode === "login" ? copy.auth.signInTitle : copy.auth.signUpTitle}
                </h1>
        
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <Input
            id="email"
            type="email"
            placeholder={copy.auth.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <Input
            id="password"
            type="password"
            placeholder={copy.auth.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            disabled={submitting}
          />
        </div>

        {mode === "signup" && (
          <>
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</label>
              <Input
                id="confirm-password"
                type="password"
                placeholder={copy.auth.passwordPlaceholder}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="invite-code" className="text-sm font-medium">Invite Code</label>
              <Input
                id="invite-code"
                type="text"
                placeholder={copy.auth.invitePlaceholder}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoComplete="off"
                disabled={submitting}
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-destructive font-medium">{error}</p>}
        {info && <p className="text-sm text-green-600 font-medium">{info}</p>}

        <Button type="submit" className="w-full gap-2" disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mode === "login" ? (
            <LogIn className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {mode === "login" ? copy.auth.signInButton : copy.auth.signUpButton}
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup")
                setError(null)
                setInfo(null)
                setInviteCode("")
              }}
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {copy.auth.switchToSignUp}
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("login")
                setError(null)
                setInfo(null)
                setInviteCode("")
              }}
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {copy.auth.switchToSignIn}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
