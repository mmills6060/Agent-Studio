"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TOP_LEVEL_BLOCK_TYPES } from "@/lib/block-types"

interface AddNodeToolbarProps {
  onAddBlock: (blockType: string) => void
}

function AddNodeToolbar({ onAddBlock }: AddNodeToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-background shadow-md"
          >
            <Plus className="size-4" />
            Add Block
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {TOP_LEVEL_BLOCK_TYPES.map((blockType) => {
            const Icon = blockType.icon
            return (
              <DropdownMenuItem
                key={blockType.id}
                onClick={() => onAddBlock(blockType.id)}
                className="gap-2"
              >
                <Icon className="size-4 shrink-0" />
                {blockType.label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default AddNodeToolbar
