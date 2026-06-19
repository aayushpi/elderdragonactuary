import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface RevealProps {
  children: ReactNode
  /** Stagger delay in seconds, applied via the --d custom property. */
  delay?: number
  className?: string
  as?: "div" | "section" | "li"
}

/**
 * Scroll-triggered fade-up wrapper (Linear-style). Elements settle into place
 * the first time they enter the viewport; the effect is disabled under
 * prefers-reduced-motion by the .eda-reveal CSS itself.
 */
export function Reveal({ children, delay = 0, className, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.unobserve(el)
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const Tag = as
  return (
    <Tag
      ref={ref as never}
      className={cn("eda-reveal", visible && "is-visible", className)}
      style={{ ["--d" as string]: `${delay}s` }}
    >
      {children}
    </Tag>
  )
}
