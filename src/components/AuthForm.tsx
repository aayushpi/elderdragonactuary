import { useState, useEffect } from "react"
import { LogIn, UserPlus, Loader2, Mail } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Mode = "login" | "signup" | "reset"

interface AuthFormProps {
  onSignedIn?: () => void
  defaultMode?: "login" | "signup"
}

export function AuthForm({ onSignedIn, defaultMode = "login" }: AuthFormProps) {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<Mode>(defaultMode)
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

    if (mode === "reset") {
      if (!email.trim()) {
        setError("Enter your email to reset your password.")
        return
      }
      setSubmitting(true)
      try {
        const { error: err } = await resetPassword(email.trim())
        if (err) {
          setError(err)
        } else {
          setInfo("If an account exists for that email, a reset link is on its way.")
        }
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.")
      return
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (mode === "signup" && !inviteCode.trim()) {
      setError("Invite code is required.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
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
          setInfo("Check your email for a confirmation link, then sign in.")
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
          {mode === "login"
            ? "Sign in to your account"
            : mode === "signup"
              ? "Create a new account"
              : "Reset your password"}
        </h1>
        {mode === "reset" && (
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you a link to set a new password.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={submitting}
          />
        </div>

        {mode !== "reset" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset")
                    setError(null)
                    setInfo(null)
                  }}
                  className="text-xs text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={submitting}
            />
          </div>
        )}

        {mode === "signup" && (
          <>
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
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
                placeholder="Invite code"
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
          ) : mode === "signup" ? (
            <UserPlus className="h-4 w-4" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send reset link"}
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        {mode === "reset" ? (
          <button
            type="button"
            onClick={() => {
              setMode("login")
              setError(null)
              setInfo(null)
            }}
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Back to sign in
          </button>
        ) : mode === "login" ? (
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
              Sign up
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
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  )
}
