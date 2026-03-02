import { useState } from "react"
import { AuthForm } from "@/components/AuthForm"
import { ReleaseNotesSheet } from "@/pages/ReleaseNotesSheet"

export function AuthPage() {
  const [showReleaseNotes, setShowReleaseNotes] = useState(true)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <AuthForm />
      <ReleaseNotesSheet open={showReleaseNotes} onOpenChange={setShowReleaseNotes} />
    </div>
  )
}
