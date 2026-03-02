import React, { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface CarouselProps {
  children: React.ReactNode
  onIndexChange?: (index: number) => void
  initialIndex?: number
}

export function Carousel({ children, onIndexChange, initialIndex = 0 }: CarouselProps) {
  const items = React.Children.toArray(children)
  const count = items.length
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, Math.max(0, count - 1))))

  useEffect(() => {
    // update index if initialIndex changes
    setIndex(Math.max(0, Math.min(initialIndex, Math.max(0, count - 1))))
  }, [initialIndex, count])

  const go = useCallback((next: number) => {
    if (count === 0) return
    const i = ((next % count) + count) % count
    setIndex(i)
    onIndexChange?.(i)
  }, [count, onIndexChange])

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-md">
        <div className="flex transition-transform duration-300" style={{ transform: `translateX(-${index * 100}%)` }}>
          {items.map((c, i) => (
            <div key={i} className="flex-shrink-0 w-full">
              {c}
            </div>
          ))}
        </div>
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <Button size="sm" variant="ghost" onClick={() => go(index - 1)}>‹</Button>
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <Button size="sm" variant="ghost" onClick={() => go(index + 1)}>›</Button>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 mt-2">
        {items.map((_, i) => (
          <button key={i} onClick={() => go(i)} className={`w-2 h-2 rounded-full ${i===index? 'bg-primary': 'bg-muted'}`} />
        ))}
      </div>
    </div>
  )
}

export default Carousel
