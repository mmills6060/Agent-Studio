"use client"

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { MessageSquare } from "lucide-react"
import type { CustomNodeData } from "@/components/handlers/flow-canvas-handlers"

type CustomNodeType = Node<CustomNodeData, "custom">

function CustomNode({ data }: NodeProps<CustomNodeType>) {
  const hasContent = data.content?.trim().length > 0

  return (
    <div className="min-w-[180px] max-w-[260px] rounded-lg border border-l-4 border-l-chart-2 bg-card px-4 py-3 shadow-sm">
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-muted-foreground"
      />
      <div className="flex items-center gap-2">
        <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium text-card-foreground">
          {data.label}
        </span>
      </div>
      {hasContent && (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
          {data.content}
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

export default CustomNode
