import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import type { FastManaInfo } from "@/types"

interface FastManaToggleProps {
  value: FastManaInfo
  onChange: (info: FastManaInfo) => void
}

export function FastManaToggle({ value, onChange }: FastManaToggleProps) {
  const [cardInput, setCardInput] = useState(value.cards.join(", "))

  function handleToggle(checked: boolean) {
    onChange({ hasFastMana: checked, cards: checked ? value.cards : [] })
    if (!checked) setCardInput("")
  }

  function handleCardsBlur() {
    const cards = cardInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    onChange({ hasFastMana: value.hasFastMana, cards })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Switch
          id="fast-mana-toggle"
          checked={value.hasFastMana}
          onCheckedChange={handleToggle}
        />
        <label htmlFor="fast-mana-toggle" className="text-sm cursor-pointer">
          Fast mana
        </label>
      </div>
      {value.hasFastMana && (
        <Input
          placeholder="Sol Ring, Mana Crypt… (optional)"
          value={cardInput}
          onChange={(e) => setCardInput(e.target.value)}
          onBlur={handleCardsBlur}
          className="text-sm"
        />
      )}
    </div>
  )
}
