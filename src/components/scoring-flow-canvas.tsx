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
import { Play, Copy, Check, Upload } from "lucide-react"
import ScoringCustomNode from "@/components/scoring-custom-node"
import AddNodeToolbar from "@/components/add-node-toolbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  createScoringBlock,
  updateScoringNodeData,
  generateScoringPrompt,
  type ScoringNodeData,
} from "@/components/handlers/scoring-flow-canvas-handlers"
import {
  ALL_SCORING_BLOCK_TYPES,
  getScoringBlockType,
} from "@/lib/scoring-block-types"
import { parseScoringPrompt } from "@/components/handlers/scoring-prompt-parser"

interface ScoringFlowCanvasRef {
  getState: () => { nodes: Node<ScoringNodeData>[]; edges: Edge[] }
}

interface ScoringFlowProps {
  initialNodes?: Node<ScoringNodeData>[]
  initialEdges?: Edge[]
}

const nodeTypes = { custom: ScoringCustomNode }

const ScoringFlow = forwardRef<ScoringFlowCanvasRef, ScoringFlowProps>(
  function ScoringFlow({ initialNodes, initialEdges }, ref) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ScoringNodeData>>(initialNodes ?? [])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges ?? [])
  const { screenToFlowPosition, fitView } = useReactFlow()

  useImperativeHandle(ref, () => ({
    getState: () => ({ nodes: nodes as Node<ScoringNodeData>[], edges }),
  }), [nodes, edges])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isOutputOpen, setIsOutputOpen] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importText, setImportText] = useState("")

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) as
    | Node<ScoringNodeData>
    | undefined

  const isAttribute = selectedNode?.data.blockType === "scoring-attribute"

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

      const newNode = createScoringBlock(blockType, position)
      setNodes((nds) => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes],
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      setIsEditorOpen(true)
    },
    [],
  )

  const handleFieldChange = useCallback(
    (field: string, value: string | number) => {
      if (!selectedNodeId) return
      setNodes(
        (nds) =>
          updateScoringNodeData(
            nds as Node<ScoringNodeData>[],
            selectedNodeId,
            { [field]: value },
          ),
      )
    },
    [selectedNodeId, setNodes],
  )

  const handleRun = useCallback(() => {
    const prompt = generateScoringPrompt(
      nodes as Node<ScoringNodeData>[],
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
    const { nodes: newNodes, edges: newEdges } = parseScoringPrompt(importText)
    if (newNodes.length === 0) return
    setNodes(newNodes)
    setEdges(newEdges)
    setImportText("")
    setIsImportOpen(false)
    setTimeout(() => fitView({ padding: 0.2 }), 50)
  }, [importText, setNodes, setEdges, fitView])

  const blockConfig = selectedNode
    ? getScoringBlockType(selectedNode.data.blockType)
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
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
        <AddNodeToolbar
          onAddBlock={handleAddBlock}
          blockTypes={ALL_SCORING_BLOCK_TYPES}
        />
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
            Run
          </Button>
        </div>
      </ReactFlow>

      <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editorTitle}</SheetTitle>
            <SheetDescription>
              {isAttribute
                ? "Configure the scoring attribute with points, source, rules, and examples."
                : "Set the title and content for this block."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="scoring-label"
                className="text-sm font-medium text-foreground"
              >
                Title
              </label>
              <Input
                id="scoring-label"
                value={selectedNode?.data.label ?? ""}
                onChange={(e) => handleFieldChange("label", e.target.value)}
                placeholder={blockConfig?.label ?? "Block Title"}
              />
            </div>

            {isAttribute ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="scoring-max-points"
                      className="text-sm font-medium text-foreground"
                    >
                      Max Points
                    </label>
                    <Input
                      id="scoring-max-points"
                      type="number"
                      min={0}
                      value={selectedNode?.data.maxPoints ?? 0}
                      onChange={(e) =>
                        handleFieldChange(
                          "maxPoints",
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="scoring-source"
                      className="text-sm font-medium text-foreground"
                    >
                      Source
                    </label>
                    <Select
                      value={selectedNode?.data.source ?? ""}
                      onValueChange={(val) => handleFieldChange("source", val)}
                    >
                      <SelectTrigger id="scoring-source">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RESUME CONTEXT PRIMARY">
                          Resume Context Primary
                        </SelectItem>
                        <SelectItem value="TRANSCRIPT">Transcript</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="scoring-goal"
                    className="text-sm font-medium text-foreground"
                  >
                    Goal
                  </label>
                  <Textarea
                    id="scoring-goal"
                    value={selectedNode?.data.goal ?? ""}
                    onChange={(e) => handleFieldChange("goal", e.target.value)}
                    placeholder="Describe what this attribute measures..."
                    className="min-h-[80px]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="scoring-rules"
                    className="text-sm font-medium text-foreground"
                  >
                    Scoring Rules
                  </label>
                  <Textarea
                    id="scoring-rules"
                    value={selectedNode?.data.scoringRules ?? ""}
                    onChange={(e) =>
                      handleFieldChange("scoringRules", e.target.value)
                    }
                    placeholder="Use these rules in order:&#10;&#10;A) If resume context includes...&#10;B) If &quot;Presently Employed&quot; is missing..."
                    className="min-h-[160px] font-mono text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="scoring-examples"
                    className="text-sm font-medium text-foreground"
                  >
                    Examples
                  </label>
                  <Textarea
                    id="scoring-examples"
                    value={selectedNode?.data.examples ?? ""}
                    onChange={(e) =>
                      handleFieldChange("examples", e.target.value)
                    }
                    placeholder='2 = "I&apos;m working right now."&#10;1 = "I left my job a couple months ago."&#10;0 = "I haven&apos;t worked in a while."'
                    className="min-h-[120px] font-mono text-sm"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="scoring-content"
                  className="text-sm font-medium text-foreground"
                >
                  Content
                </label>
                <Textarea
                  id="scoring-content"
                  value={selectedNode?.data.content ?? ""}
                  onChange={(e) =>
                    handleFieldChange("content", e.target.value)
                  }
                  placeholder="Enter your prompt text here..."
                  className="min-h-[200px]"
                />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isOutputOpen} onOpenChange={setIsOutputOpen}>
        <SheetContent className="flex flex-col sm:max-w-2xl">
          <SheetHeader className="shrink-0">
            <SheetTitle>Generated Scoring Prompt</SheetTitle>
            <SheetDescription>
              Your scoring blocks have been combined into a single scoring
              prompt.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-4">
            <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted p-4">
              <pre className="whitespace-pre-wrap text-sm text-foreground">
                {generatedPrompt ||
                  "No content to display. Add scoring blocks and configure them."}
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
            <DialogTitle>Import Scoring Prompt</DialogTitle>
            <DialogDescription>
              Paste a scoring prompt to load it into the canvas. This will
              replace any existing nodes.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste your scoring prompt here..."
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
},
)

const ScoringFlowCanvas = forwardRef<ScoringFlowCanvasRef, ScoringFlowProps>(
  function ScoringFlowCanvas({ initialNodes, initialEdges }, ref) {
    return (
      <div className="absolute inset-0">
        <ReactFlowProvider>
          <ScoringFlow
            ref={ref}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
          />
        </ReactFlowProvider>
      </div>
    )
  },
)

export default ScoringFlowCanvas
export type { ScoringFlowCanvasRef, ScoringFlowProps }
