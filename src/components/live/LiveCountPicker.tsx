import { useState } from "react"
import { X, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandList, CommandItem, CommandInput } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type PodOption = { id: string; opponents: string[]; label: string; totalPlayers: number }

interface LiveCountPickerProps {
  onSelect: (count: number) => void
  onCancel: () => void
  pods?: PodOption[]
  onSelectPod?: (pod: PodOption) => void
}

export function LiveCountPicker({ onSelect, onCancel, pods = [], onSelectPod }: LiveCountPickerProps) {
  const [podsOpen, setPodsOpen] = useState(false)
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl p-6 flex flex-col gap-4 w-72 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-foreground font-bold text-lg">Start a Live Game</p>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {pods.length > 0 && onSelectPod && (
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Select a pod</label>
            <div className="mt-1">
              <Popover open={podsOpen} onOpenChange={setPodsOpen}>
                <PopoverTrigger asChild>
                  <button className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 justify-between items-center text-left">
                    <span className="truncate text-sm text-foreground">
                      {selectedPodId ? (pods.find((p) => p.id === selectedPodId)?.label ?? "Select a pod…") : "Select a pod…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Filter pods…" />
                    <CommandList>
                      {pods.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.id}
                          onSelect={() => {
                            setSelectedPodId(p.id)
                            setPodsOpen(false)
                            onSelectPod(p)
                          }}
                        >
                          {p.label}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
        <div>
          <p className="text-muted-foreground text-sm mb-2">
            {pods.length > 0 && onSelectPod ? "Or, how many players?" : "How many players?"}
          </p>
          <div className="grid grid-cols-5 gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <Button
                key={n}
                variant="outline"
                onClick={() => onSelect(n)}
                className="aspect-square text-xl font-bold"
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
