import { X } from "lucide-react"

interface LiveCountPickerProps {
  onSelect: (count: number) => void
  onCancel: () => void
}

export function LiveCountPicker({ onSelect, onCancel }: LiveCountPickerProps) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 flex flex-col gap-5 w-72 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-white font-bold text-lg">Start a Live Game</p>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-gray-400 text-sm -mt-2">How many players?</p>
        <div className="grid grid-cols-5 gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => onSelect(n)}
              className="aspect-square rounded-xl bg-gray-800 border border-gray-600 text-white text-xl font-bold hover:bg-gray-700 hover:border-gray-500 active:scale-95 transition-all"
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
