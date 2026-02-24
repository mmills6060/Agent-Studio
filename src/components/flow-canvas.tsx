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
import { forwardRef, useCallback, useImperativeHandle, useState } from "react"
import { Copy, Check, Plus, Upload, Sparkles } from "lucide-react"
import CustomNode from "@/components/custom-node"
import SectionNode from "@/components/section-node"
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
import { getBlockType } from "@/lib/block-types"

interface FlowCanvasRef {
  getPrompt: () => string
  getState: () => { nodes: Node<CustomNodeData>[]; edges: Edge[] }
  openImport: () => void
  viewPrompt: () => void
  addBlock: (blockType: string) => void
  setState: (nodes: Node<CustomNodeData>[], edges: Edge[]) => void
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

  const handleNodeClick = useCallback(
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
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

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
