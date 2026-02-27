import {
  User,
  ListOrdered,
  Braces,
  Target,
  FileInput,
  type LucideIcon,
} from "lucide-react"

interface ContextBlockTypeConfig {
  id: string
  label: string
  icon: LucideIcon
  accentColor: string
}

const CONTEXT_BLOCK_TYPES: Record<string, ContextBlockTypeConfig> = {
  role: {
    id: "role",
    label: "Role",
    icon: User,
    accentColor: "border-l-chart-1",
  },
  "processing-rules": {
    id: "processing-rules",
    label: "Processing Rules",
    icon: ListOrdered,
    accentColor: "border-l-chart-2",
  },
  "output-schema": {
    id: "output-schema",
    label: "Output Schema",
    icon: Braces,
    accentColor: "border-l-chart-3",
  },
  attribute: {
    id: "attribute",
    label: "Attribute",
    icon: Target,
    accentColor: "border-l-chart-4",
  },
  "input-source": {
    id: "input-source",
    label: "Input Source",
    icon: FileInput,
    accentColor: "border-l-chart-5",
  },
}

const ALL_CONTEXT_BLOCK_TYPES = Object.values(CONTEXT_BLOCK_TYPES)

function getContextBlockType(id: string): ContextBlockTypeConfig | undefined {
  return CONTEXT_BLOCK_TYPES[id]
}

export { CONTEXT_BLOCK_TYPES, ALL_CONTEXT_BLOCK_TYPES, getContextBlockType }
export type { ContextBlockTypeConfig }
