"use client"

import { useState } from "react"
import { Phone, ClipboardCheck } from "lucide-react"
import FlowCanvas from "@/components/flow-canvas"
import ScoringFlowCanvas from "@/components/scoring-flow-canvas"

const tabs = [
  { id: "call-prompt", label: "Call Prompt", icon: Phone },
  { id: "scoring-prompt", label: "Scoring Prompt", icon: ClipboardCheck },
] as const

type TabId = (typeof tabs)[number]["id"]

export default function PromptWorkspace() {
  const [activeTab, setActiveTab] = useState<TabId>("call-prompt")

  return (
    <div className="fixed inset-0">
      <div className="pointer-events-none absolute inset-x-0 top-4 z-50 flex justify-center">
        <div className="pointer-events-auto flex gap-1 rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative size-full">
        {activeTab === "call-prompt" && <FlowCanvas />}
        {activeTab === "scoring-prompt" && <ScoringFlowCanvas />}
      </div>
    </div>
  )
}
