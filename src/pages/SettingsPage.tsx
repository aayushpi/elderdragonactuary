import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Download, Upload, Trash2, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { exportData, exportCSV, loadGames } from "@/lib/storage"
import {
  CLOUD_SYNC_UPDATED_EVENT,
  getCurrentUser,
  getLastCloudSyncAt,
  pullGamesFromCloud,
  pushGamesToCloud,
  sendMagicLink,
  setLastCloudSyncAt,
  signOutCloud,
} from "@/lib/cloudSync"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"

interface SettingsPageProps {
  onImport: (json: string) => Promise<{ success: boolean; count: number; error?: string }>
  onClearAll: () => Promise<boolean>
}

export function SettingsPage({ onImport, onClearAll }: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [authEmail, setAuthEmail] = useState("")
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [lastCloudSyncAt, setLastCloudSyncAtState] = useState<string | null>(() => getLastCloudSyncAt())
  const isDevOrLocalhost = import.meta.env.DEV || window.location.hostname === "localhost"
  const cloudConfigured = isSupabaseConfigured()

  function saveLastCloudSyncAt(value: string | null) {
    setLastCloudSyncAt(value)
    setLastCloudSyncAtState(value)
  }

  useEffect(() => {
    if (!cloudConfigured) {
      setAuthLoading(false)
      return
    }

    let cancelled = false

    const hydrate = async () => {
      try {
        const user = await getCurrentUser()
        if (!cancelled) {
          setCurrentUserEmail(user?.email ?? null)
        }
      } catch {
        if (!cancelled) {
          toast.error("Could not check cloud auth session.")
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false)
        }
      }
    }

    const supabase = getSupabase()
    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      setCurrentUserEmail(session?.user?.email ?? null)
    })

    const onCloudSyncUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ value: string | null }>
      setLastCloudSyncAtState(custom.detail?.value ?? getLastCloudSyncAt())
    }
    window.addEventListener(CLOUD_SYNC_UPDATED_EVENT, onCloudSyncUpdated)

    hydrate()

    return () => {
      cancelled = true
      listener?.data.subscription.unsubscribe()
      window.removeEventListener(CLOUD_SYNC_UPDATED_EVENT, onCloudSyncUpdated)
    }
  }, [cloudConfigured])

  function handleExport() {
    const json = exportData()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `commando-games-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const raw = ev.target?.result
      const json =
        typeof raw === "string"
          ? raw
          : raw instanceof ArrayBuffer
            ? new TextDecoder().decode(raw)
            : ""

      if (!json) {
        toast.error("Import failed: Could not read file contents.")
        return
      }

      const result = await onImport(json)
      if (result.success) {
        toast.success(`Imported ${result.count} game${result.count !== 1 ? "s" : ""}.`)
      } else {
        toast.error(`Import failed: ${result.error}`)
      }
    }
    reader.onerror = () => {
      toast.error("Import failed: Could not read selected file.")
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  async function handleLoadTestJson() {
    try {
      const response = await fetch("/load-test-games.json")
      if (!response.ok) {
        toast.error("Could not load test JSON.")
        return
      }

      const json = await response.text()
      const trimmed = json.trim()
      if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
        toast.error("Load test JSON file was not found or is not valid JSON.")
        return
      }

      const result = await onImport(json)
      if (result.success) {
        toast.success(`Loaded test JSON with ${result.count} game${result.count !== 1 ? "s" : ""}.`)
      } else {
        toast.error(`Load test JSON failed: ${result.error}`)
      }
    } catch {
      toast.error("Could not load test JSON.")
    }
  }

  async function handleSendMagicLink() {
    const email = authEmail.trim()
    if (!email) {
      toast.error("Enter an email first.")
      return
    }

    try {
      setAuthBusy(true)
      await sendMagicLink(email)
      toast.success("Magic link sent. Check your email.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send magic link.")
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    try {
      setAuthBusy(true)
      await signOutCloud()
      toast.success("Signed out from cloud sync.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.")
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleCloudPush() {
    try {
      setSyncBusy(true)
      const updatedAt = await pushGamesToCloud(loadGames())
      saveLastCloudSyncAt(updatedAt)
      toast.success(`Pushed local games to cloud (${new Date(updatedAt).toLocaleString()}).`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cloud push failed.")
    } finally {
      setSyncBusy(false)
    }
  }

  async function handleCloudPull() {
    try {
      setSyncBusy(true)
      const cloud = await pullGamesFromCloud()
      if (cloud.games.length === 0) {
        toast.error("No cloud backup found yet. Push from another device first.")
        return
      }

      const result = await onImport(JSON.stringify(cloud.games))
      if (result.success) {
        saveLastCloudSyncAt(cloud.updatedAt ?? new Date().toISOString())
        const stamp = cloud.updatedAt ? ` (${new Date(cloud.updatedAt).toLocaleString()})` : ""
        toast.success(`Pulled ${result.count} game${result.count !== 1 ? "s" : ""} from cloud${stamp}.`)
      } else {
        toast.error(`Cloud data was invalid: ${result.error}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cloud pull failed.")
    } finally {
      setSyncBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cloud sync section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Secure Cloud Sync</h2>
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Sign in with email magic link</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each user can only read/write their own backup. Changes auto-sync after add, delete, import, and clear.
            </p>
          </div>

          {!cloudConfigured ? (
            <p className="text-xs text-destructive font-medium">
              Cloud sync is not configured. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable it.
            </p>
          ) : (
            <>
              {!currentUserEmail ? (
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      disabled={authBusy || authLoading}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={handleSendMagicLink}
                      disabled={authBusy || authLoading}
                    >
                      Send magic link
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Open the link from your email on this device to complete sign in.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Signed in as <span className="font-medium text-foreground">{currentUserEmail}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last cloud sync: {lastCloudSyncAt ? new Date(lastCloudSyncAt).toLocaleString() : "Never"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleCloudPush}
                      disabled={syncBusy || authBusy}
                    >
                      Push local → cloud
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleCloudPull}
                      disabled={syncBusy || authBusy}
                    >
                      Pull cloud → local
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSignOut}
                      disabled={authBusy || syncBusy}
                    >
                      Sign out
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Conflict rule: last push wins.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Data section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Data</h2>
        <div className="rounded-lg border bg-card divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Export games</p>
              <p className="text-xs text-muted-foreground mt-0.5">Download all game data as a JSON (can be imported later) or CSV</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                Export JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => {
                  const csv = exportCSV()
                  const blob = new Blob([csv], { type: "text/csv" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `commando-games-${new Date().toISOString().slice(0, 10)}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <FileText className="h-3.5 w-3.5" />
                Download CSV
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Import games</p>
              <p className="text-xs text-muted-foreground mt-0.5">Import game logs from a previously exported JSON</p>
              <p className="text-xs text-destructive mt-1 font-medium">Warning: this will erase your current data.</p>
            </div>
            <div className="flex gap-2">
              {isDevOrLocalhost && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={handleLoadTestJson}
                >
                  Load Test JSON
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {/* Danger zone */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Board Wipe</h2>
        <div className="rounded-lg border border-destructive/30 bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Delete all data</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently removes all logged games. This cannot be undone.
            </p>
          </div>
          {!confirmDelete ? (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete all data
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  const success = await onClearAll()
                  if (success) {
                    setConfirmDelete(false)
                    toast.success("All data deleted.")
                  }
                }}
              >
                Yes, delete everything
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
