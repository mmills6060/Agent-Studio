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
import { Copy, Check, Upload } from "lucide-react"
import ContextCustomNode from "@/components/context-custom-node"
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
  createContextBlock,
  updateContextNodeData,
  generateContextPrompt,
  parseContextPromptToFlow,
  type ContextNodeData,
} from "@/components/handlers/context-flow-canvas-handlers"
import { getContextBlockType } from "@/lib/context-block-types"

interface ContextFlowCanvasRef {
  getPrompt: () => string
  getState: () => { nodes: Node<ContextNodeData>[]; edges: Edge[] }
  setState: (nodes: Node<ContextNodeData>[], edges: Edge[]) => void
  openImport: () => void
  viewPrompt: () => void
  addBlock: (blockType: string) => void
  deselectAll: () => void
}

interface ContextFlowCanvasProps {
  initialNodes?: Node<ContextNodeData>[]
  initialEdges?: Edge[]
}

const nodeTypes = { custom: ContextCustomNode }

const ContextFlow = forwardRef<ContextFlowCanvasRef, ContextFlowCanvasProps>(
  function ContextFlow({ initialNodes, initialEdges }, ref) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<ContextNodeData>>(
      initialNodes ?? [],
    )
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges ?? [])
    const { screenToFlowPosition, fitView } = useReactFlow()

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [isOutputOpen, setIsOutputOpen] = useState(false)
    const [generatedPrompt, setGeneratedPrompt] = useState("")
    const [isCopied, setIsCopied] = useState(false)
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [importText, setImportText] = useState("")

    const selectedNode = nodes.find((n) => n.id === selectedNodeId) as
      | Node<ContextNodeData>
      | undefined

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

        const newNode = createContextBlock(blockType, position)
        setNodes((nds) => [...nds, newNode])
      },
      [screenToFlowPosition, setNodes],
    )

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
        setNodes((nds) =>
          updateContextNodeData(
            nds as Node<ContextNodeData>[],
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
        setNodes((nds) =>
          updateContextNodeData(
            nds as Node<ContextNodeData>[],
            selectedNodeId,
            { content: value },
          ),
        )
      },
      [selectedNodeId, setNodes],
    )

    const handleRun = useCallback(() => {
      const prompt = generateContextPrompt(
        nodes as Node<ContextNodeData>[],
        edges,
      )
      setGeneratedPrompt(prompt)
      setIsOutputOpen(true)
    }, [nodes, edges])

    const handleOpenImport = useCallback(() => {
      setImportText("")
      setIsImportOpen(true)
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        getPrompt: () =>
          generateContextPrompt(nodes as Node<ContextNodeData>[], edges),
        getState: () => ({
          nodes: nodes as Node<ContextNodeData>[],
          edges,
        }),
        setState: (newNodes: Node<ContextNodeData>[], newEdges: Edge[]) => {
          setNodes(newNodes)
          setEdges(newEdges)
          setTimeout(() => fitView({ padding: 0.2 }), 50)
        },
        openImport: handleOpenImport,
        viewPrompt: handleRun,
        addBlock: handleAddBlock,
        deselectAll: () => {
          setNodes((nds) =>
            nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
          )
        },
      }),
      [
        nodes,
        edges,
        handleRun,
        handleAddBlock,
        handleOpenImport,
        setNodes,
        setEdges,
        fitView,
      ],
    )

    const handleCopyPrompt = useCallback(async () => {
      await navigator.clipboard.writeText(generatedPrompt)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }, [generatedPrompt])

    const handleImport = useCallback(() => {
      const { nodes: newNodes, edges: newEdges } =
        parseContextPromptToFlow(importText)
      if (newNodes.length === 0) return
      setNodes(newNodes)
      setEdges(newEdges)
      setImportText("")
      setIsImportOpen(false)
      setTimeout(() => fitView({ padding: 0.2 }), 50)
    }, [importText, setNodes, setEdges, fitView])

    const blockConfig = selectedNode
      ? getContextBlockType(selectedNode.data.blockType)
      : null
    const editorTitle = blockConfig
      ? `Edit ${blockConfig.label}`
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
                Set the title and content for this block.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-4 px-4">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="context-label"
                    className="text-sm font-medium text-foreground"
                  >
                    Title
                  </label>
                  <Input
                    id="context-label"
                    value={selectedNode?.data.label ?? ""}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    placeholder={blockConfig?.label ?? "Block Title"}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="context-content"
                    className="text-sm font-medium text-foreground"
                  >
                    Content
                  </label>
                  <Textarea
                    id="context-content"
                    value={selectedNode?.data.content ?? ""}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Enter your prompt text here..."
                    className="min-h-[200px]"
                  />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={isOutputOpen} onOpenChange={setIsOutputOpen}>
          <SheetContent className="flex flex-col sm:max-w-2xl">
            <SheetHeader className="shrink-0">
              <SheetTitle>Generated Context Prompt</SheetTitle>
              <SheetDescription>
                Your context blocks have been combined into a single prompt.
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4">
              <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted p-4">
                <pre className="whitespace-pre-wrap text-sm text-foreground">
                  {generatedPrompt ||
                    "No content to display. Add blocks and configure them."}
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
              <DialogTitle>Import Context Prompt</DialogTitle>
              <DialogDescription>
                Paste a context prompt to load it into the canvas. You can use
                section headers like [Role], [Processing Rules], [Output
                Schema], or paste free-form text—role, processing rules, output
                schema, attributes (Attribute 1 : Name, etc.), and &quot;Here is
                the Resume :&quot; will be parsed into nodes. This will replace
                existing nodes.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste your context prompt here..."
              className="min-h-[200px] max-h-[50vh] resize-none overflow-y-auto font-mono text-sm"
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
  },
)

const ContextFlowCanvas = forwardRef<
  ContextFlowCanvasRef,
  ContextFlowCanvasProps
>(function ContextFlowCanvas({ initialNodes, initialEdges }, ref) {
  return (
    <div className="absolute inset-0">
      <ReactFlowProvider>
        <ContextFlow
          ref={ref}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />
      </ReactFlowProvider>
    </div>
  )
})

export default ContextFlowCanvas
export type { ContextFlowCanvasRef, ContextFlowCanvasProps }
