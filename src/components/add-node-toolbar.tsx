"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AddNodeToolbarProps {
  onAddBlock: () => void
}

function AddNodeToolbar({ onAddBlock }: AddNodeToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10">
      <Button
        variant="outline"
        size="sm"
        onClick={onAddBlock}
        className="gap-2 bg-background shadow-md"
      >
        <Plus className="size-4" />
        Add Block
      </Button>
    </div>
  )
}

export default AddNodeToolbar
