"use client"

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { MessageSquare } from "lucide-react"
import type { ScoringNodeData } from "@/components/handlers/scoring-flow-canvas-handlers"
import { getScoringBlockType } from "@/lib/scoring-block-types"

type ScoringCustomNodeType = Node<ScoringNodeData, "scoring-custom">

const accentColorMap: Record<string, string> = {
  "border-l-chart-1": "border-l-chart-1",
  "border-l-chart-2": "border-l-chart-2",
  "border-l-chart-3": "border-l-chart-3",
  "border-l-chart-4": "border-l-chart-4",
  "border-l-chart-5": "border-l-chart-5",
  "border-l-primary": "border-l-primary",
  "border-l-accent": "border-l-accent",
  "border-l-destructive": "border-l-destructive",
}

function ScoringCustomNode({ data, selected }: NodeProps<ScoringCustomNodeType>) {
  const config = getScoringBlockType(data.blockType)
  const Icon = config?.icon ?? MessageSquare
  const accentClass = config
    ? accentColorMap[config.accentColor] ?? "border-l-chart-2"
    : "border-l-chart-2"
  const isAttribute = data.blockType === "scoring-attribute"
  const scoreLevels = isAttribute ? (data.scoreLevels ?? []) : []
  const hasScoreLevels = scoreLevels.length > 0
  const preview = isAttribute
    ? hasScoreLevels
      ? scoreLevels.map((l) => String(l.value)).join(" / ")
      : data.goal?.trim()
    : data.content?.trim()

  return (
    <div
      className={`min-w-[180px] max-w-[260px] rounded-lg border border-l-4 ${accentClass} bg-card px-4 py-3 shadow-sm transition-shadow ${selected ? "ring-2 ring-primary shadow-md" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-muted-foreground"
      />
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium text-card-foreground">
          {data.label}
        </span>
      </div>
      {isAttribute && data.maxPoints > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {data.maxPoints} pt{data.maxPoints !== 1 ? "s" : ""}
          </span>
          {data.source && (
            <span className="truncate text-xs text-muted-foreground">
              {data.source}
            </span>
          )}
        </div>
      )}
      {isAttribute && data.attributeKey && (
        <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
          {data.attributeKey}
        </p>
      )}
      {preview && (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
          {hasScoreLevels ? `Levels: ${preview}` : preview}
        </p>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-muted-foreground"
      />
    </div>
  )
}

export default ScoringCustomNode
