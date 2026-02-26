import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LogIn, UserPlus, Loader2 } from "lucide-react"

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<"login" | "signup">("login")
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
        if (err) setError(err)
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">
            <span role="img" aria-label="Search" className="mr-2">🔎</span>
            Elder Dragon Actuary
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
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

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
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

          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium">
                  Confirm Password
                </label>
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
                <label htmlFor="invite-code" className="text-sm font-medium">
                  Invite Code
                </label>
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

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          {info && (
            <p className="text-sm text-green-600 font-medium">{info}</p>
          )}

          <Button type="submit" className="w-full gap-2" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {/* Toggle mode */}
        <div className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); setInfo(null); setInviteCode("") }}
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
                onClick={() => { setMode("login"); setError(null); setInfo(null); setInviteCode("") }}
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
