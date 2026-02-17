"use client"

import { Tldraw } from "tldraw"
import "tldraw/tldraw.css"

export default function TldrawCanvas() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw persistenceKey="agent-studio" />
    </div>
  )
}

