import { useEffect, useMemo, useRef, useState } from "react"
import { Provider } from "react-redux"
import { applyMiddleware, combineReducers, compose, createStore } from "redux"
import maplibregl from "maplibre-gl"
import { KeplerGl } from "@kepler.gl/components"
import { addDataToMap } from "@kepler.gl/actions"
import { enhanceReduxMiddleware, keplerGlReducer } from "@kepler.gl/reducers"
import { Button } from "@/components/ui/button"
import type { Game } from "@/types"
import "maplibre-gl/dist/maplibre-gl.css"

interface MapPageProps {
  games: Game[]
}

type CsvRow = Record<string, string>

const MAP_ID = "commando-map"

const reducers = combineReducers({
  keplerGl: keplerGlReducer,
})

const middlewares = enhanceReduxMiddleware([]) as unknown as Parameters<typeof applyMiddleware>
const store = createStore(reducers, {}, compose(applyMiddleware(...middlewares)))

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = []
  let currentField = ""
  let currentRow: string[] = []
  let inQuotes = false

  const pushField = () => {
    currentRow.push(currentField)
    currentField = ""
  }

  const pushRow = () => {
    if (currentRow.length > 0 || currentField.length > 0) {
      pushField()
      rows.push(currentRow)
      currentRow = []
    }
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === ",") {
      pushField()
      continue
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") {
        index += 1
      }
      pushRow()
      continue
    }

    currentField += char
  }

  pushRow()

  if (rows.length === 0) return []

  const [header, ...dataRows] = rows
  const headers = header.map((column) => column.trim())
  return dataRows
    .filter((row) => row.some((field) => field.trim().length > 0))
    .map((row) => {
      const item: CsvRow = {}
      headers.forEach((column, idx) => {
        item[column] = (row[idx] ?? "").trim()
      })
      return item
    })
}

function winnerCommanderName(game: Game): string {
  const winner = game.players.find((player) => player.id === game.winnerId)
  if (!winner) return ""
  return winner.partnerName
    ? `${winner.commanderName} // ${winner.partnerName}`
    : winner.commanderName
}

function myCommanderName(game: Game): string {
  const me = game.players.find((player) => player.isMe)
  if (!me) return ""
  return me.partnerName
    ? `${me.commanderName} // ${me.partnerName}`
    : me.commanderName
}

function buildTemplateCsv(games: Game[]): string {
  const headers = [
    "gameId",
    "playedAt",
    "winnerCommander",
    "myCommander",
    "playerCount",
    "winTurn",
    "bracket",
    "notes",
    "latitude",
    "longitude",
    "locationLabel",
  ]

  const rows = [headers.join(",")]
  games.forEach((game) => {
    const row = [
      csvEscape(game.id),
      csvEscape(game.playedAt),
      csvEscape(winnerCommanderName(game)),
      csvEscape(myCommanderName(game)),
      csvEscape(game.players.length),
      csvEscape(game.winTurn),
      csvEscape(game.bracket ?? ""),
      csvEscape(game.notes ?? ""),
      "",
      "",
      "",
    ]
    rows.push(row.join(","))
  })

  return rows.join("\n")
}

function toKeplerDataset(rows: CsvRow[]) {
  const valid = rows
    .map((row) => {
      const latitude = Number(row.latitude)
      const longitude = Number(row.longitude)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
      return {
        gameId: row.gameId ?? "",
        playedAt: row.playedAt ?? "",
        winnerCommander: row.winnerCommander ?? "",
        myCommander: row.myCommander ?? "",
        playerCount: row.playerCount ?? "",
        winTurn: row.winTurn ?? "",
        bracket: row.bracket ?? "",
        notes: row.notes ?? "",
        locationLabel: row.locationLabel ?? "",
        latitude,
        longitude,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  return {
    fields: [
      { name: "gameId", type: "string" },
      { name: "playedAt", type: "string" },
      { name: "winnerCommander", type: "string" },
      { name: "myCommander", type: "string" },
      { name: "playerCount", type: "integer" },
      { name: "winTurn", type: "integer" },
      { name: "bracket", type: "integer" },
      { name: "notes", type: "string" },
      { name: "locationLabel", type: "string" },
      { name: "latitude", type: "real" },
      { name: "longitude", type: "real" },
    ],
    rows: valid.map((item) => [
      item.gameId,
      item.playedAt,
      item.winnerCommander,
      item.myCommander,
      item.playerCount,
      item.winTurn,
      item.bracket,
      item.notes,
      item.locationLabel,
      item.latitude,
      item.longitude,
    ]),
  }
}

export function MapPage({ games }: MapPageProps) {
  const [mappedCount, setMappedCount] = useState(0)
  const [mapSize, setMapSize] = useState({ width: 1000, height: 640 })
  const [error, setError] = useState<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const templateCsv = useMemo(() => buildTemplateCsv(games), [games])

  useEffect(() => {
    if (!mapContainerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setMapSize({ width: Math.max(640, Math.floor(entry.contentRect.width)), height: 640 })
    })

    observer.observe(mapContainerRef.current)
    return () => observer.disconnect()
  }, [])

  function handleDownloadTemplate() {
    const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `commando-map-template-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function loadCsvIntoMap(text: string) {
    const parsedRows = parseCsv(text)
    const dataset = toKeplerDataset(parsedRows)
    const pointCount = dataset.rows.length

    if (pointCount === 0) {
      setMappedCount(0)
      setError("No valid coordinates found. Add numeric latitude and longitude values.")
      return
    }

    setError(null)
    setMappedCount(pointCount)

    store.dispatch(
      addDataToMap({
        datasets: {
          info: {
            id: "commando-games-map",
            label: "Commander Games",
          },
          data: dataset,
        },
        options: {
          centerMap: true,
          keepExistingConfig: false,
        },
        config: {
          version: "v1",
          config: {
            mapStyle: {
              styleType: "custom",
              mapStyles: {
                commandoOpenTiles: {
                  id: "commandoOpenTiles",
                  label: "OpenStreetMap",
                  url: "https://demotiles.maplibre.org/style.json",
                  icon: "",
                  custom: true,
                },
              },
              topLayerGroups: {},
            },
          },
        },
      })
    )
  }

  function handleUploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result ?? "")
      loadCsvIntoMap(content)
    }
    reader.readAsText(file)

    event.target.value = ""
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Game map</h2>
        <p className="text-sm text-muted-foreground">
          Download a CSV template containing your game metadata, fill in latitude/longitude columns, then upload it.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>Download template CSV</Button>
          <Button onClick={() => fileInputRef.current?.click()}>Upload mapped CSV</Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,text/csv"
            onChange={handleUploadFile}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {mappedCount > 0 ? `${mappedCount} points mapped.` : "No map points loaded yet."}
          {error ? ` ${error}` : ""}
        </div>
      </div>

      <div ref={mapContainerRef} className="rounded-lg border overflow-hidden bg-card min-h-[640px]">
        <Provider store={store}>
          <KeplerGl
            id={MAP_ID}
            width={mapSize.width}
            height={mapSize.height}
            mapLib={maplibregl as unknown as undefined}
          />
        </Provider>
      </div>
    </div>
  )
}
<<<<<<< HEAD
import type { Game } from "@/types"
=======
import { useEffect, useMemo, useRef, useState } from "react"
import { Provider } from "react-redux"
import { applyMiddleware, combineReducers, compose, createStore } from "redux"
import maplibregl from "maplibre-gl"
import { KeplerGl } from "@kepler.gl/components"
import { addDataToMap } from "@kepler.gl/actions"
import { enhanceReduxMiddleware, keplerGlReducer } from "@kepler.gl/reducers"
import { Button } from "@/components/ui/button"
import type { Game } from "@/types"
import "maplibre-gl/dist/maplibre-gl.css"
>>>>>>> origin/main

interface MapPageProps {
  games: Game[]
}

<<<<<<< HEAD
export function MapPage({ games }: MapPageProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold">Map</h1>
      <p className="text-sm text-muted-foreground">
        Geographic map view is not configured in this environment.
      </p>
      <p className="text-xs text-muted-foreground">
        Loaded games: {games.length}
      </p>
=======
type CsvRow = Record<string, string>

const MAP_ID = "commando-map"

const reducers = combineReducers({
  keplerGl: keplerGlReducer,
})

const middlewares = enhanceReduxMiddleware([]) as unknown as Parameters<typeof applyMiddleware>
const store = createStore(reducers, {}, compose(applyMiddleware(...middlewares)))

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = []
  let currentField = ""
  let currentRow: string[] = []
  let inQuotes = false

  const pushField = () => {
    currentRow.push(currentField)
    currentField = ""
  }

  const pushRow = () => {
    if (currentRow.length > 0 || currentField.length > 0) {
      pushField()
      rows.push(currentRow)
      currentRow = []
    }
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === ",") {
      pushField()
      continue
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") {
        index += 1
      }
      pushRow()
      continue
    }

    currentField += char
  }

  pushRow()

  if (rows.length === 0) return []

  const [header, ...dataRows] = rows
  const headers = header.map((column) => column.trim())
  return dataRows
    .filter((row) => row.some((field) => field.trim().length > 0))
    .map((row) => {
      const item: CsvRow = {}
      headers.forEach((column, idx) => {
        item[column] = (row[idx] ?? "").trim()
      })
      return item
    })
}

function winnerCommanderName(game: Game): string {
  const winner = game.players.find((player) => player.id === game.winnerId)
  if (!winner) return ""
  return winner.partnerName
    ? `${winner.commanderName} // ${winner.partnerName}`
    : winner.commanderName
}

function myCommanderName(game: Game): string {
  const me = game.players.find((player) => player.isMe)
  if (!me) return ""
  return me.partnerName
    ? `${me.commanderName} // ${me.partnerName}`
    : me.commanderName
}

function buildTemplateCsv(games: Game[]): string {
  const headers = [
    "gameId",
    "playedAt",
    "winnerCommander",
    "myCommander",
    "playerCount",
    "winTurn",
    "bracket",
    "notes",
    "latitude",
    "longitude",
    "locationLabel",
  ]

  const rows = [headers.join(",")]
  games.forEach((game) => {
    const row = [
      csvEscape(game.id),
      csvEscape(game.playedAt),
      csvEscape(winnerCommanderName(game)),
      csvEscape(myCommanderName(game)),
      csvEscape(game.players.length),
      csvEscape(game.winTurn),
      csvEscape(game.bracket ?? ""),
      csvEscape(game.notes ?? ""),
      "",
      "",
      "",
    ]
    rows.push(row.join(","))
  })

  return rows.join("\n")
}

function toKeplerDataset(rows: CsvRow[]) {
  const valid = rows
    .map((row) => {
      const latitude = Number(row.latitude)
      const longitude = Number(row.longitude)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
      return {
        gameId: row.gameId ?? "",
        playedAt: row.playedAt ?? "",
        winnerCommander: row.winnerCommander ?? "",
        myCommander: row.myCommander ?? "",
        playerCount: row.playerCount ?? "",
        winTurn: row.winTurn ?? "",
        bracket: row.bracket ?? "",
        notes: row.notes ?? "",
        locationLabel: row.locationLabel ?? "",
        latitude,
        longitude,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  return {
    fields: [
      { name: "gameId", type: "string" },
      { name: "playedAt", type: "string" },
      { name: "winnerCommander", type: "string" },
      { name: "myCommander", type: "string" },
      { name: "playerCount", type: "integer" },
      { name: "winTurn", type: "integer" },
      { name: "bracket", type: "integer" },
      { name: "notes", type: "string" },
      { name: "locationLabel", type: "string" },
      { name: "latitude", type: "real" },
      { name: "longitude", type: "real" },
    ],
    rows: valid.map((item) => [
      item.gameId,
      item.playedAt,
      item.winnerCommander,
      item.myCommander,
      item.playerCount,
      item.winTurn,
      item.bracket,
      item.notes,
      item.locationLabel,
      item.latitude,
      item.longitude,
    ]),
  }
}

export function MapPage({ games }: MapPageProps) {
  const [mappedCount, setMappedCount] = useState(0)
  const [mapSize, setMapSize] = useState({ width: 1000, height: 640 })
  const [error, setError] = useState<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const templateCsv = useMemo(() => buildTemplateCsv(games), [games])

  useEffect(() => {
    if (!mapContainerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setMapSize({ width: Math.max(640, Math.floor(entry.contentRect.width)), height: 640 })
    })

    observer.observe(mapContainerRef.current)
    return () => observer.disconnect()
  }, [])

  function handleDownloadTemplate() {
    const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `commando-map-template-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function loadCsvIntoMap(text: string) {
    const parsedRows = parseCsv(text)
    const dataset = toKeplerDataset(parsedRows)
    const pointCount = dataset.rows.length

    if (pointCount === 0) {
      setMappedCount(0)
      setError("No valid coordinates found. Add numeric latitude and longitude values.")
      return
    }

    setError(null)
    setMappedCount(pointCount)

    store.dispatch(
      addDataToMap({
        datasets: {
          info: {
            id: "commando-games-map",
            label: "Commander Games",
          },
          data: dataset,
        },
        options: {
          centerMap: true,
          keepExistingConfig: false,
        },
        config: {
          version: "v1",
          config: {
            mapStyle: {
              styleType: "custom",
              mapStyles: {
                commandoOpenTiles: {
                  id: "commandoOpenTiles",
                  label: "OpenStreetMap",
                  url: "https://demotiles.maplibre.org/style.json",
                  icon: "",
                  custom: true,
                },
              },
              topLayerGroups: {},
            },
          },
        },
      })
    )
  }

  function handleUploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result ?? "")
      loadCsvIntoMap(content)
    }
    reader.readAsText(file)

    event.target.value = ""
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Game map</h2>
        <p className="text-sm text-muted-foreground">
          Download a CSV template containing your game metadata, fill in latitude/longitude columns, then upload it.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>Download template CSV</Button>
          <Button onClick={() => fileInputRef.current?.click()}>Upload mapped CSV</Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,text/csv"
            onChange={handleUploadFile}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {mappedCount > 0 ? `${mappedCount} points mapped.` : "No map points loaded yet."}
          {error ? ` ${error}` : ""}
        </div>
      </div>

      <div ref={mapContainerRef} className="rounded-lg border overflow-hidden bg-card min-h-[640px]">
        <Provider store={store}>
          <KeplerGl
            id={MAP_ID}
            width={mapSize.width}
            height={mapSize.height}
            mapLib={maplibregl as unknown as undefined}
          />
        </Provider>
      </div>
>>>>>>> origin/main
    </div>
  )
}
