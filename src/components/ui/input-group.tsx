import * as React from "react"
import { cn } from "@/lib/utils"

interface InputGroupProps {
  children: React.ReactNode
  className?: string
}

export function InputGroup({ children, className }: InputGroupProps) {
  return (
    <div className={cn("inline-flex items-center h-10 rounded-md border border-input bg-background", className)}>
      {children}
    </div>
  )
}

interface InputGroupTextProps {
  children: React.ReactNode
}

export function InputGroupText({ children }: InputGroupTextProps) {
  return (
    <span className="inline-flex items-center h-10 px-3 text-sm text-muted-foreground border-l border-input">
      {children}
    </span>
  )
}

export default InputGroup
