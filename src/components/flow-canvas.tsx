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
import { Play, Copy, Check } from "lucide-react"
import CustomNode from "@/components/custom-node"
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
  createPromptBlock,
  updateNodeData,
  generateSystemPrompt,
  type CustomNodeData,
} from "@/components/handlers/flow-canvas-handlers"

const nodeTypes = { custom: CustomNode }

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { screenToFlowPosition } = useReactFlow()

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isOutputOpen, setIsOutputOpen] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState("")
  const [isCopied, setIsCopied] = useState(false)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) as
    | Node<CustomNodeData>
    | undefined

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  )

  const handleAddBlock = useCallback(() => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    position.x += (Math.random() - 0.5) * 100
    position.y += (Math.random() - 0.5) * 100

    const newNode = createPromptBlock(position)
    setNodes((nds) => [...nds, newNode])
  }, [screenToFlowPosition, setNodes])

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
        <div className="absolute top-4 right-4 z-10">
          <Button size="sm" onClick={handleRun} className="gap-2 shadow-md">
            <Play className="size-4" />
            Run
          </Button>
        </div>
      </ReactFlow>

      <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Prompt Block</SheetTitle>
            <SheetDescription>
              Set the title and content for this prompt block.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="node-label"
                className="text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                Title
              </label>
              <Input
                id="node-label"
                value={selectedNode?.data.label ?? ""}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Prompt Block"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="node-content"
                className="text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                Content
              </label>
              <Textarea
                id="node-content"
                value={selectedNode?.data.content ?? ""}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Enter your prompt text here..."
                className="min-h-[200px]"
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isOutputOpen} onOpenChange={setIsOutputOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Generated System Prompt</SheetTitle>
            <SheetDescription>
              Your connected prompt blocks have been combined into a single
              system prompt.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4">
            <div className="flex-1 overflow-auto rounded-md border bg-gray-100 dark:bg-gray-800 p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
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
    </>
  )
}

export default function FlowCanvas() {
  return (
    <div className="fixed inset-0">
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  )
}
