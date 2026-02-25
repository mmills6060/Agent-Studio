"use client"

import { Copy, ClipboardPaste, Trash2 } from "lucide-react"

interface NodeContextMenuProps {
  x: number
  y: number
  nodeId: string | null
  nodeType: string | null
  isClipboardFilled: boolean
  clipboardType: string | null
  onCopy: () => void
  onPaste: () => void
  onPasteIntoSection: () => void
  onDelete: () => void
  onClose: () => void
}

const menuItemClass =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none cursor-default hover:bg-accent hover:text-accent-foreground"

function NodeContextMenu({
  x,
  y,
  nodeId,
  nodeType,
  isClipboardFilled,
  clipboardType,
  onCopy,
  onPaste,
  onPasteIntoSection,
  onDelete,
  onClose,
}: NodeContextMenuProps) {
  const isNode = nodeId !== null
  const isSection = nodeType === "section"
  const canPasteOnCanvas = isClipboardFilled && clipboardType !== "question"
  const canPasteIntoSection =
    isClipboardFilled && isSection && clipboardType === "question"

  const adjustedX = Math.min(x, window.innerWidth - 220)
  const adjustedY = Math.min(y, window.innerHeight - 200)

  const hasAnyAction = isNode || canPasteOnCanvas

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        style={{ left: adjustedX, top: adjustedY }}
      >
        {isNode && (
          <button
            className={menuItemClass}
            onClick={() => {
              onCopy()
              onClose()
            }}
          >
            <Copy className="size-4" />
            Copy
            <span className="ml-auto text-xs text-muted-foreground">⌘C</span>
          </button>
        )}

        {canPasteOnCanvas && (
          <button
            className={menuItemClass}
            onClick={() => {
              onPaste()
              onClose()
            }}
          >
            <ClipboardPaste className="size-4" />
            Paste
            <span className="ml-auto text-xs text-muted-foreground">⌘V</span>
          </button>
        )}

        {canPasteIntoSection && (
          <button
            className={menuItemClass}
            onClick={() => {
              onPasteIntoSection()
              onClose()
            }}
          >
            <ClipboardPaste className="size-4" />
            Paste Into Section
          </button>
        )}

        {isNode && (
          <>
            <div className="-mx-1 my-1 h-px bg-border" />
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none select-none cursor-default hover:bg-destructive/10"
              onClick={() => {
                onDelete()
                onClose()
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          </>
        )}

        {!hasAnyAction && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No actions available
          </div>
        )}
      </div>
    </>
  )
}

export default NodeContextMenu
