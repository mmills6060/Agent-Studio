"use client"

import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type OnConnect,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Copy, Check, Plus, Upload, Sparkles } from "lucide-react"
import CustomNode from "@/components/custom-node"
import SectionNode from "@/components/section-node"
import NodeContextMenu from "@/components/node-context-menu"
import {
  copyNodes,
  generatePastedNodes,
  hasClipboardData,
  getClipboardType,
} from "@/components/handlers/clipboard-handlers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  createTypedBlock,
  updateNodeData,
  generateSystemPrompt,
  type CustomNodeData,
} from "@/components/handlers/flow-canvas-handlers"
import { handleImportPrompt } from "@/components/handlers/import-prompt-handlers"
import {
  collectSectionContent,
  buildScoringNodesFromSection,
  generateAttributeKeys,
} from "@/components/handlers/scoring-prompt-generation-handlers"
import { generateFollowUpStrategy } from "@/components/handlers/follow-up-strategy-handlers"
import { getBlockType } from "@/lib/block-types"

interface FlowCanvasRef {
  getPrompt: () => string
  getState: () => { nodes: Node<CustomNodeData>[]; edges: Edge[] }
  openImport: () => void
  viewPrompt: () => void
  addBlock: (blockType: string) => void
  setState: (nodes: Node<CustomNodeData>[], edges: Edge[]) => void
  deselectAll: () => void
}

interface FlowCanvasProps {
  onCreateScoringPrompt?: (nodes: Node[], edges: Edge[], tabName: string) => void
}

const nodeTypes = { custom: CustomNode, section: SectionNode }

const Flow = forwardRef<FlowCanvasRef, FlowCanvasProps>(function Flow(
  props,
  ref,
) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { screenToFlowPosition, fitView } = useReactFlow()

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isOutputOpen, setIsOutputOpen] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [hasNoQuestions, setHasNoQuestions] = useState(false)
  const [isGeneratingScoring, setIsGeneratingScoring] = useState(false)
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    nodeId: string | null
    nodeType: string | null
  } | null>(null)

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) as
    | Node<CustomNodeData>
    | undefined

  const isQuestionBlock = selectedNode?.data.blockType === "question"
  const isSectionBlock = selectedNode?.data.blockType === "section"

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  )

  const handleAddBlock = useCallback(
    (blockType: string) => {
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      position.x += (Math.random() - 0.5) * 100
      position.y += (Math.random() - 0.5) * 100

      const newNode = createTypedBlock(blockType, position)
      setNodes((nds) => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes],
  )

  const handleAddQuestion = useCallback(() => {
    if (!selectedNodeId || !isSectionBlock) return

    const parentNode = nodes.find((n) => n.id === selectedNodeId)
    if (!parentNode) return

    const existingChildren = nodes
      .filter((n) => n.parentId === selectedNodeId)
      .sort((a, b) => a.position.y - b.position.y)
    const yOffset = 110 + existingChildren.length * 90

    const newQuestion = createTypedBlock(
      "question",
      { x: 20, y: yOffset },
      selectedNodeId,
    )
    setNodes((nds) => [...nds, newQuestion])

    const lastChild = existingChildren[existingChildren.length - 1]
    if (lastChild) {
      setEdges((eds) =>
        addEdge(
          { source: lastChild.id, target: newQuestion.id },
          eds,
        ),
      )
    }
  }, [selectedNodeId, isSectionBlock, nodes, setNodes, setEdges])

  const handleCreateScoringPrompt = useCallback(async () => {
    if (!selectedNodeId || !isSectionBlock || !props.onCreateScoringPrompt) return

    const sectionContent = collectSectionContent(
      nodes as Node<CustomNodeData>[],
      selectedNodeId,
    )
    if (!sectionContent || sectionContent.questions.length === 0) {
      setHasNoQuestions(true)
      setTimeout(() => setHasNoQuestions(false), 2000)
      return
    }

    setIsGeneratingScoring(true)
    try {
      const keys = await generateAttributeKeys(
        sectionContent.label,
        sectionContent.questions,
      )
      const { nodes: scoringNodes, edges: scoringEdges } = buildScoringNodesFromSection(sectionContent, keys)
      const sectionNode = nodes.find((n) => n.id === selectedNodeId)
      const tabName = sectionNode?.data.label
        ? `${(sectionNode.data as CustomNodeData).label} Scoring`
        : "Section Scoring"
      props.onCreateScoringPrompt(scoringNodes, scoringEdges, tabName)
    } catch {
      const { nodes: scoringNodes, edges: scoringEdges } = buildScoringNodesFromSection(sectionContent)
      const sectionNode = nodes.find((n) => n.id === selectedNodeId)
      const tabName = sectionNode?.data.label
        ? `${(sectionNode.data as CustomNodeData).label} Scoring`
        : "Section Scoring"
      props.onCreateScoringPrompt(scoringNodes, scoringEdges, tabName)
    } finally {
      setIsGeneratingScoring(false)
    }
  }, [selectedNodeId, isSectionBlock, nodes, props])

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      setIsEditorOpen(true)
    },
    [],
  )

  const handleLabelChange = useCallback(
    (value: string) => {
      if (!selectedNodeId) return
      setNodes(
        (nds) =>
          updateNodeData(
            nds as Node<CustomNodeData>[],
            selectedNodeId,
            { label: value },
          ),
      )
    },
    [selectedNodeId, setNodes],
  )

  const handleContentChange = useCallback(
    (value: string) => {
      if (!selectedNodeId) return
      setNodes(
        (nds) =>
          updateNodeData(
            nds as Node<CustomNodeData>[],
            selectedNodeId,
            { content: value },
          ),
      )
    },
    [selectedNodeId, setNodes],
  )

  const handleFollowUpChange = useCallback(
    (value: string) => {
      if (!selectedNodeId) return
      setNodes(
        (nds) =>
          updateNodeData(
            nds as Node<CustomNodeData>[],
            selectedNodeId,
            { followUpStrategy: value },
          ),
      )
    },
    [selectedNodeId, setNodes],
  )

  const handleGenerateFollowUp = useCallback(async () => {
    if (!selectedNodeId || !isQuestionBlock) return

    setIsGeneratingFollowUp(true)
    try {
      const strategy = await generateFollowUpStrategy(
        nodes as Node<CustomNodeData>[],
        selectedNodeId,
      )
      setNodes(
        (nds) =>
          updateNodeData(
            nds as Node<CustomNodeData>[],
            selectedNodeId,
            { followUpStrategy: strategy },
          ),
      )
    } catch {
      // silently fail — user can retry
    } finally {
      setIsGeneratingFollowUp(false)
    }
  }, [selectedNodeId, isQuestionBlock, nodes, setNodes])

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeType: (node.data as CustomNodeData).blockType,
      })
    },
    [],
  )

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: null,
        nodeType: null,
      })
    },
    [],
  )

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleCopyNode = useCallback(() => {
    const selected = nodes.filter((n) => n.selected)
    const nodeIds =
      selected.length > 0 && selected.some((n) => n.id === contextMenu?.nodeId)
        ? selected.map((n) => n.id)
        : contextMenu?.nodeId
          ? [contextMenu.nodeId]
          : []

    if (nodeIds.length === 0) return
    copyNodes(nodeIds, nodes as Node<CustomNodeData>[], edges)
  }, [nodes, edges, contextMenu])

  const handlePasteNode = useCallback(() => {
    const pos = contextMenu
      ? screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y })
      : screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        })

    const result = generatePastedNodes(pos, nodes as Node<CustomNodeData>[])
    if (!result) return

    setNodes((nds) => [...nds, ...result.nodes])
    setEdges((eds) => [...eds, ...result.edges])
  }, [contextMenu, screenToFlowPosition, nodes, setNodes, setEdges])

  const handlePasteIntoSection = useCallback(() => {
    if (!contextMenu?.nodeId) return

    const result = generatePastedNodes(
      { x: 0, y: 0 },
      nodes as Node<CustomNodeData>[],
      contextMenu.nodeId,
    )
    if (!result) return

    const existingChildren = nodes
      .filter((n) => n.parentId === contextMenu.nodeId)
      .sort((a, b) => a.position.y - b.position.y)
    const lastChild = existingChildren[existingChildren.length - 1]
    const firstPasted = result.nodes[0]

    setNodes((nds) => [...nds, ...result.nodes])
    setEdges((eds) => {
      let updated = [...eds, ...result.edges]
      if (lastChild && firstPasted) {
        updated = addEdge(
          { source: lastChild.id, target: firstPasted.id },
          updated,
        )
      }
      return updated
    })
  }, [contextMenu, nodes, setNodes, setEdges])

  const handleDeleteNode = useCallback(() => {
    const nodeId = contextMenu?.nodeId
    if (!nodeId) return

    const idsToDelete = new Set<string>([nodeId])
    const nodeToDelete = nodes.find((n) => n.id === nodeId)
    if (nodeToDelete?.data.blockType === "section") {
      for (const n of nodes) {
        if (n.parentId === nodeId) idsToDelete.add(n.id)
      }
    }

    setNodes((nds) => nds.filter((n) => !idsToDelete.has(n.id)))
    setEdges((eds) =>
      eds.filter(
        (e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target),
      ),
    )
  }, [contextMenu, nodes, setNodes, setEdges])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return

      const isModKey = e.metaKey || e.ctrlKey

      if (isModKey && e.key === "c") {
        const selected = nodesRef.current.filter((n) => n.selected)
        if (selected.length === 0) return
        e.preventDefault()
        copyNodes(
          selected.map((n) => n.id),
          nodesRef.current as Node<CustomNodeData>[],
          edgesRef.current,
        )
      }

      if (isModKey && e.key === "v") {
        if (!hasClipboardData()) return
        e.preventDefault()

        const clipType = getClipboardType()
        if (clipType === "question") {
          const selectedSection = nodesRef.current.find(
            (n) =>
              n.selected &&
              (n.data as CustomNodeData).blockType === "section",
          )
          if (!selectedSection) return

          const result = generatePastedNodes(
            { x: 0, y: 0 },
            nodesRef.current as Node<CustomNodeData>[],
            selectedSection.id,
          )
          if (!result) return

          const existingChildren = nodesRef.current
            .filter((n) => n.parentId === selectedSection.id)
            .sort((a, b) => a.position.y - b.position.y)
          const lastChild = existingChildren[existingChildren.length - 1]
          const firstPasted = result.nodes[0]

          setNodes((nds) => [...nds, ...result.nodes])
          setEdges((eds) => {
            let updated = [...eds, ...result.edges]
            if (lastChild && firstPasted) {
              updated = addEdge(
                { source: lastChild.id, target: firstPasted.id },
                updated,
              )
            }
            return updated
          })
          return
        }

        const position = screenToFlowPosition({
          x: window.innerWidth / 2 + (Math.random() - 0.5) * 100,
          y: window.innerHeight / 2 + (Math.random() - 0.5) * 100,
        })
        const result = generatePastedNodes(
          position,
          nodesRef.current as Node<CustomNodeData>[],
        )
        if (!result) return
        setNodes((nds) => [...nds, ...result.nodes])
        setEdges((eds) => [...eds, ...result.edges])
      }

      if (e.key === "Escape") setContextMenu(null)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [screenToFlowPosition, setNodes, setEdges])

  const handleRun = useCallback(() => {
    const prompt = generateSystemPrompt(
      nodes as Node<CustomNodeData>[],
      edges,
    )
    setGeneratedPrompt(prompt)
    setIsOutputOpen(true)
  }, [nodes, edges])

  useImperativeHandle(ref, () => ({
    getPrompt: () => generateSystemPrompt(nodes as Node<CustomNodeData>[], edges as Edge[]),
    getState: () => ({ nodes: nodes as Node<CustomNodeData>[], edges: edges as Edge[] }),
    openImport: () => setIsImportOpen(true),
    viewPrompt: handleRun,
    addBlock: handleAddBlock,
    setState: (newNodes: Node<CustomNodeData>[], newEdges: Edge[]) => {
      setNodes(newNodes)
      setEdges(newEdges)
      setTimeout(() => fitView({ padding: 0.2 }), 50)
    },
    deselectAll: () => {
      setNodes(nds => nds.map(n => n.selected ? { ...n, selected: false } : n))
    },
  }), [nodes, edges, handleRun, handleAddBlock, setNodes, setEdges, fitView])

  const handleCopyPrompt = useCallback(async () => {
    await navigator.clipboard.writeText(generatedPrompt)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [generatedPrompt])

  const handleImport = useCallback(() => {
    const { nodes: newNodes, edges: newEdges } = handleImportPrompt(importText)
    if (newNodes.length === 0) return
    setNodes(newNodes)
    setEdges(newEdges)
    setImportText("")
    setIsImportOpen(false)
    setTimeout(() => fitView({ padding: 0.2 }), 50)
  }, [importText, setNodes, setEdges, fitView])

  const blockConfig = selectedNode
    ? getBlockType(selectedNode.data.blockType)
    : null
  const editorTitle = blockConfig
    ? `Edit ${blockConfig.label} Block`
    : "Edit Block"

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onPaneClick={handleCloseContextMenu}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          nodeType={contextMenu.nodeType}
          isClipboardFilled={hasClipboardData()}
          clipboardType={getClipboardType()}
          onCopy={handleCopyNode}
          onPaste={handlePasteNode}
          onPasteIntoSection={handlePasteIntoSection}
          onDelete={handleDeleteNode}
          onClose={handleCloseContextMenu}
        />
      )}

      <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SheetContent className="flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle>{editorTitle}</SheetTitle>
            <SheetDescription>
              {isSectionBlock
                ? "Configure this section and add questions to it."
                : isQuestionBlock
                  ? "Set the question text and follow-up strategy."
                  : "Set the title and content for this block."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 px-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="node-label"
                className="text-sm font-medium text-foreground"
              >
                Title
              </label>
              <Input
                id="node-label"
                value={selectedNode?.data.label ?? ""}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder={blockConfig?.label ?? "Block Title"}
              />
            </div>

            {isQuestionBlock ? (
              <>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="node-question"
                    className="text-sm font-medium text-foreground"
                  >
                    Question
                  </label>
                  <Textarea
                    id="node-question"
                    value={selectedNode?.data.content ?? ""}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Enter the question to ask..."
                    className="min-h-[120px]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="node-followup"
                    className="text-sm font-medium text-foreground"
                  >
                    Follow-Up Strategy
                  </label>
                  <Textarea
                    id="node-followup"
                    value={selectedNode?.data.followUpStrategy ?? ""}
                    onChange={(e) => handleFollowUpChange(e.target.value)}
                    placeholder="Describe how to follow up based on the candidate's response..."
                    className="min-h-[120px]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateFollowUp}
                    disabled={isGeneratingFollowUp || !selectedNode?.data.content?.trim()}
                    className="gap-2 self-start"
                  >
                    <Sparkles className={`size-4 ${isGeneratingFollowUp ? "animate-spin" : ""}`} />
                    {isGeneratingFollowUp ? "Generating..." : "Generate Follow Up Strategy"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="node-content"
                  className="text-sm font-medium text-foreground"
                >
                  {isSectionBlock ? "System Instruction" : "Content"}
                </label>
                <Textarea
                  id="node-content"
                  value={selectedNode?.data.content ?? ""}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder={
                    isSectionBlock
                      ? "Enter a system instruction for this section..."
                      : "Enter your prompt text here..."
                  }
                  className="min-h-[200px]"
                />
              </div>
            )}

            {isSectionBlock && (
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddQuestion}
                  className="gap-2 self-start"
                >
                  <Plus className="size-4" />
                  Add Question
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateScoringPrompt}
                  disabled={!props.onCreateScoringPrompt || isGeneratingScoring}
                  className="gap-2 self-start"
                >
                  <Sparkles className={`size-4 ${isGeneratingScoring ? "animate-spin" : ""}`} />
                  {hasNoQuestions
                    ? "Add questions first"
                    : isGeneratingScoring
                      ? "Generating..."
                      : "Create Scoring Prompt"}
                </Button>
              </div>
            )}
          </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isOutputOpen} onOpenChange={setIsOutputOpen}>
        <SheetContent className="flex flex-col sm:max-w-2xl">
          <SheetHeader className="shrink-0">
            <SheetTitle>Generated System Prompt</SheetTitle>
            <SheetDescription>
              Your prompt blocks have been combined into a single system prompt.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-4">
            <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted p-4">
              <pre className="whitespace-pre-wrap text-sm text-foreground">
                {generatedPrompt ||
                  "No content to display. Add text to your prompt blocks and connect them."}
              </pre>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPrompt}
              disabled={!generatedPrompt}
              className="gap-2 self-end"
            >
              {isCopied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {isCopied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Prompt</DialogTitle>
            <DialogDescription>
              Paste a system prompt to parse it into flow blocks. This will
              replace any existing nodes on the canvas.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste your system prompt here..."
            className="min-h-[200px] max-h-[50vh] overflow-y-auto font-mono text-sm resize-none"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportText("")
                setIsImportOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="gap-2"
            >
              <Upload className="size-4" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
})

const FlowCanvas = forwardRef<FlowCanvasRef, FlowCanvasProps>(function FlowCanvas(
  props,
  ref,
) {
  return (
    <div className="absolute inset-0">
      <ReactFlowProvider>
        <Flow ref={ref} {...props} />
      </ReactFlowProvider>
    </div>
  )
})

export default FlowCanvas
export type { FlowCanvasRef, FlowCanvasProps }
