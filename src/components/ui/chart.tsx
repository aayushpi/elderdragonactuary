import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
  }
>

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn("h-[260px] w-full text-xs", className)}
        style={
          Object.fromEntries(
            Object.entries(config)
              .filter(([, value]) => Boolean(value?.color))
              .map(([key, value]) => [
                `--color-${key}`,
                value.color,
              ])
          ) as React.CSSProperties
        }
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

type TooltipPayloadItem = {
  dataKey?: string | number
  name?: React.ReactNode
  value?: React.ReactNode
  color?: string
}

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  className?: string
  indicator?: "line" | "dot" | "dashed"
}) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className={cn("rounded-lg border bg-background px-3 py-2 text-xs shadow-sm", className)}>
      <div className="space-y-1">
        {payload.map((item) => {
          const dataKey = String(item.dataKey ?? "")
          const itemConfig = config[dataKey]
          const name = itemConfig?.label ?? item.name ?? dataKey
          const color = item.color ?? `var(--color-${dataKey})`

          return (
            <div key={`${dataKey}-${item.value}`} className="flex items-center gap-2">
              {indicator === "dashed" ? (
                <span className="h-0 w-3 border-t border-dashed" style={{ borderColor: color }} />
              ) : indicator === "line" ? (
                <span className="h-3 w-0 border-l" style={{ borderColor: color }} />
              ) : (
                <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color }} />
              )}
              <span className="text-muted-foreground">{name}:</span>
              <span className="font-medium text-foreground">{item.value}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
