"use client"

import {
  Handle,
  Position,
  NodeResizer,
  type NodeProps,
  type Node,
} from "@xyflow/react"
import { LayoutList } from "lucide-react"
import type { CustomNodeData } from "@/components/handlers/flow-canvas-handlers"

type SectionNodeType = Node<CustomNodeData, "section">

function SectionNode({ data, selected }: NodeProps<SectionNodeType>) {
  return (
    <div className={`flex size-full flex-col rounded-lg border-2 border-dashed bg-muted/30 transition-shadow ${selected ? "border-primary/60 ring-2 ring-primary/50 shadow-md" : "border-primary/30"}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={300}
        minHeight={200}
        lineClassName="!border-primary/50"
        handleClassName="!size-2.5 !rounded-sm !border-2 !border-primary !bg-background"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-muted-foreground"
      />
      <div className="flex items-center gap-2 rounded-t-lg border-b border-primary/20 bg-primary/5 px-4 py-2">
        <LayoutList className="size-4 shrink-0 text-primary" />
        <span className="truncate text-sm font-semibold text-foreground">
          {data.label}
        </span>
      </div>
      {data.content?.trim() && (
        <p className="mx-4 mt-2 line-clamp-2 text-xs text-muted-foreground">
          {data.content}
        </p>
      )}
      <div className="flex-1" />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-muted-foreground"
      />
    </div>
  )
}

export default SectionNode
