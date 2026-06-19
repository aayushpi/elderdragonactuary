import { useEffect } from "react"

/** Acquire a screen wake lock while `active` is true; release when it goes false or the component unmounts. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (!("wakeLock" in navigator)) return

    let lock: WakeLockSentinel | null = null

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen")
      } catch {
        // unsupported or permission denied — silent
      }
    }

    const reacquire = () => {
      if (document.visibilityState === "visible") void acquire()
    }

    void acquire()
    document.addEventListener("visibilitychange", reacquire)

    return () => {
      document.removeEventListener("visibilitychange", reacquire)
      lock?.release().catch(() => {/* ignore */})
    }
  }, [active])
}
