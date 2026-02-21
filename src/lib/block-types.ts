import {
  User,
  Briefcase,
  ShieldCheck,
  MapPin,
  ListChecks,
  LayoutList,
  HelpCircle,
  MessageCircleQuestion,
  Lock,
  type LucideIcon,
} from "lucide-react"

interface BlockTypeConfig {
  id: string
  label: string
  tag: string
  icon: LucideIcon
  accentColor: string
  canHaveChildren: boolean
  allowedChildTypes: string[]
  isChildOnly: boolean
}

const BLOCK_TYPES: Record<string, BlockTypeConfig> = {
  persona: {
    id: "persona",
    label: "Persona",
    tag: "[PERSONA]",
    icon: User,
    accentColor: "border-l-chart-1",
    canHaveChildren: false,
    allowedChildTypes: [],
    isChildOnly: false,
  },
  "job-info": {
    id: "job-info",
    label: "Job Info",
    tag: "[JOB INFO]",
    icon: Briefcase,
    accentColor: "border-l-chart-2",
    canHaveChildren: false,
    allowedChildTypes: [],
    isChildOnly: false,
  },
  rules: {
    id: "rules",
    label: "Rules",
    tag: "[RULES]",
    icon: ShieldCheck,
    accentColor: "border-l-chart-3",
    canHaveChildren: false,
    allowedChildTypes: [],
    isChildOnly: false,
  },
  scenario: {
    id: "scenario",
    label: "Scenario",
    tag: "[SCENARIO]",
    icon: MapPin,
    accentColor: "border-l-chart-4",
    canHaveChildren: false,
    allowedChildTypes: [],
    isChildOnly: false,
  },
  instructions: {
    id: "instructions",
    label: "Instructions",
    tag: "[INSTRUCTIONS]",
    icon: ListChecks,
    accentColor: "border-l-chart-5",
    canHaveChildren: false,
    allowedChildTypes: [],
    isChildOnly: false,
  },
  section: {
    id: "section",
    label: "Section",
    tag: "[SECTION]",
    icon: LayoutList,
    accentColor: "border-l-primary",
    canHaveChildren: true,
    allowedChildTypes: ["question"],
    isChildOnly: false,
  },
  question: {
    id: "question",
    label: "Question",
    tag: "[CURRENT QUESTION]",
    icon: HelpCircle,
    accentColor: "border-l-accent",
    canHaveChildren: false,
    allowedChildTypes: [],
    isChildOnly: true,
  },
  faq: {
    id: "faq",
    label: "FAQ",
    tag: "[FAQ]",
    icon: MessageCircleQuestion,
    accentColor: "border-l-chart-2",
    canHaveChildren: false,
    allowedChildTypes: [],
    isChildOnly: false,
  },
  "global-constraint": {
    id: "global-constraint",
    label: "Global Constraint",
    tag: "[GLOBAL CONSTRAINT]",
    icon: Lock,
    accentColor: "border-l-destructive",
    canHaveChildren: false,
    allowedChildTypes: [],
    isChildOnly: false,
  },
}

const TOP_LEVEL_BLOCK_TYPES = Object.values(BLOCK_TYPES).filter(
  (bt) => !bt.isChildOnly,
)

function getBlockType(id: string): BlockTypeConfig | undefined {
  return BLOCK_TYPES[id]
}

const tagToBlockTypeMap = new Map<string, BlockTypeConfig>(
  Object.values(BLOCK_TYPES)
    .filter((bt) => !bt.isChildOnly)
    .map((bt) => [bt.tag, bt]),
)

function getBlockTypeByTag(rawTag: string): BlockTypeConfig | undefined {
  const normalized = rawTag.trim().toUpperCase()

  const exact = tagToBlockTypeMap.get(normalized)
  if (exact) return exact

  if (normalized.startsWith("[SECTION"))
    return BLOCK_TYPES.section

  return undefined
}

export { BLOCK_TYPES, TOP_LEVEL_BLOCK_TYPES, getBlockType, getBlockTypeByTag }
export type { BlockTypeConfig }
