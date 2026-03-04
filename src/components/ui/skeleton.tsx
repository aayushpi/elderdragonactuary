import React from "react"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
}

export function Skeleton({ className = "", width, height, ...rest }: SkeletonProps) {
  const style = { ...(rest.style || {}), width, height }
  return <div className={`rounded-md bg-muted/20 animate-pulse ${className}`} style={style} {...rest} />
}

export function SkeletonLine({ className = "", width = "100%", height = 12 }: SkeletonProps) {
  return <Skeleton className={`h-[${height}px] ${className}`} width={width} height={height} />
}

export default Skeleton
