import * as React from "react"

interface FormFieldProps {
  label?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function FormField({ label, className, children }: FormFieldProps) {
  return (
    <div className={className ?? "flex flex-col"}>
      {label && <label className="text-xs text-muted-foreground mb-1">{label}</label>}
      {children}
    </div>
  )
}

export default FormField
