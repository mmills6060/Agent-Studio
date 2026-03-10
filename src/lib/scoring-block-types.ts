import {
  FileText,
  Database,
  Target,
  ListOrdered,
  ShieldAlert,
  Braces,
  Box,
  type LucideIcon,
} from "lucide-react"

interface ScoringBlockTypeConfig {
  id: string
  label: string
  icon: LucideIcon
  accentColor: string
  hasAttributeFields: boolean
}

const SCORING_BLOCK_TYPES: Record<string, ScoringBlockTypeConfig> = {
  "indicator-overview": {
    id: "indicator-overview",
    label: "Indicator Overview",
    icon: FileText,
    accentColor: "border-l-chart-1",
    hasAttributeFields: false,
  },
  "input-context": {
    id: "input-context",
    label: "Input Context",
    icon: Database,
    accentColor: "border-l-chart-2",
    hasAttributeFields: false,
  },
  "candidate-resume-context": {
    id: "candidate-resume-context",
    label: "Candidate Resume Context",
    icon: Database,
    accentColor: "border-l-chart-2",
    hasAttributeFields: false,
  },
  "scoring-attribute": {
    id: "scoring-attribute",
    label: "Scoring Attribute",
    icon: Target,
    accentColor: "border-l-chart-4",
    hasAttributeFields: true,
  },
  "scoring-instructions": {
    id: "scoring-instructions",
    label: "Scoring Instructions",
    icon: ListOrdered,
    accentColor: "border-l-chart-5",
    hasAttributeFields: false,
  },
  "evaluator-guardrails": {
    id: "evaluator-guardrails",
    label: "Evaluator Guardrails",
    icon: ShieldAlert,
    accentColor: "border-l-destructive",
    hasAttributeFields: false,
  },
  "output-format": {
    id: "output-format",
    label: "Output Format",
    icon: Braces,
    accentColor: "border-l-primary",
    hasAttributeFields: false,
  },
  "generic": {
    id: "generic",
    label: "Generic",
    icon: Box,
    accentColor: "border-l-chart-3",
    hasAttributeFields: false,
  },
}

const ALL_SCORING_BLOCK_TYPES = Object.values(SCORING_BLOCK_TYPES)

function getScoringBlockType(id: string): ScoringBlockTypeConfig | undefined {
  return SCORING_BLOCK_TYPES[id]
}

export { SCORING_BLOCK_TYPES, ALL_SCORING_BLOCK_TYPES, getScoringBlockType }
export type { ScoringBlockTypeConfig }
