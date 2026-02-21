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
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useCallback, useState } from "react"
import { Play, Copy, Check, Plus, Upload } from "lucide-react"
import CustomNode from "@/components/custom-node"
import SectionNode from "@/components/section-node"
import AddNodeToolbar from "@/components/add-node-toolbar"
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
import { getBlockType } from "@/lib/block-types"

const nodeTypes = { custom: CustomNode, section: SectionNode }

function Flow() {
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

    const existingChildren = nodes.filter(
      (n) => n.parentId === selectedNodeId,
    )
    const yOffset = 50 + existingChildren.length * 90

    const newQuestion = createTypedBlock(
      "question",
      { x: 20, y: yOffset },
      selectedNodeId,
    )
    setNodes((nds) => [...nds, newQuestion])
  }, [selectedNodeId, isSectionBlock, nodes, setNodes])

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
        <AddNodeToolbar onAddBlock={handleAddBlock} />
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            className="gap-2 bg-background shadow-md"
          >
            <Upload className="size-4" />
            Import
          </Button>
          <Button size="sm" onClick={handleRun} className="gap-2 shadow-md">
            <Play className="size-4" />
            View prompt
          </Button>
        </div>
      </ReactFlow>

      <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editorTitle}</SheetTitle>
            <SheetDescription>
              {isSectionBlock
                ? "Configure this section and add questions to it."
                : isQuestionBlock
                  ? "Set the question text and follow-up strategy."
                  : "Set the title and content for this block."}
            </SheetDescription>
          </SheetHeader>
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddQuestion}
                className="gap-2 self-start"
              >
                <Plus className="size-4" />
                Add Question
              </Button>
            )}
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
}

export default function FlowCanvas() {
  return (
    <div className="absolute inset-0">
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  )
}
