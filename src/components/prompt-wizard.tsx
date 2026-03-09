"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, ArrowLeft, ArrowRight, Sparkles, FileSpreadsheet, AlertCircle, MessageSquare, FileText } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  parseCSV,
  groupByCategory,
  runWizard,
  type CategoryGroup,
  type WizardResult,
} from "@/components/handlers/prompt-wizard-handlers"
import type { AppSidebarOrganization } from "@/components/handlers/app-sidebar-handlers"

interface PromptWizardProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (result: WizardResult) => void
  organizations: AppSidebarOrganization[]
  defaultOrganizationId: string | null
}

const STEPS = ["Upload CSV", "Interview Details", "Company & Role", "Review & Generate"] as const

export default function PromptWizard({
  isOpen,
  onOpenChange,
  onComplete,
  organizations,
  defaultOrganizationId,
}: PromptWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [categories, setCategories] = useState<CategoryGroup[]>([])
  const [fileName, setFileName] = useState("")
  const [parseError, setParseError] = useState("")
  const [interviewerName, setInterviewerName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [roleTitle, setRoleTitle] = useState("")
  const [aboutCompany, setAboutCompany] = useState("")
  const [aboutRole, setAboutRole] = useState("")
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(defaultOrganizationId ?? "")
  const [createTexts, setCreateTexts] = useState(false)
  const [createContextPrompt, setCreateContextPrompt] = useState(false)
  const [keywords, setKeywords] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressMessage, setProgressMessage] = useState("")
  const [generateError, setGenerateError] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalQuestions = categories.reduce((sum, c) => sum + c.questions.length, 0)

  const resetState = useCallback(() => {
    setCurrentStep(0)
    setCategories([])
    setFileName("")
    setParseError("")
    setInterviewerName("")
    setCompanyName("")
    setRoleTitle("")
    setAboutCompany("")
    setAboutRole("")
    setSelectedOrganizationId(defaultOrganizationId ?? "")
    setCreateTexts(false)
    setCreateContextPrompt(false)
    setKeywords("")
    setIsGenerating(false)
    setProgressMessage("")
    setGenerateError("")
    setIsDragOver(false)
  }, [defaultOrganizationId])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) resetState()
      onOpenChange(open)
    },
    [onOpenChange, resetState],
  )

  const handleFileSelect = useCallback(async (file: File) => {
    setParseError("")
    setFileName(file.name)
    try {
      const rows = await parseCSV(file)
      const grouped = groupByCategory(rows)
      setCategories(grouped)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file")
      setCategories([])
    }
  }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file?.name.endsWith(".csv")) handleFileSelect(file)
      else setParseError("Please upload a CSV file")
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const canProceed =
    currentStep === 0
      ? categories.length > 0 && !parseError
      : currentStep === 1
        ? !!interviewerName.trim()
        : currentStep === 2
          ? !!companyName.trim() && !!roleTitle.trim() && !!aboutCompany.trim() && !!aboutRole.trim()
          : false

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) setCurrentStep((s) => s + 1)
  }, [currentStep])

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }, [currentStep])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setGenerateError("")
    setProgressMessage("Starting generation...")

    try {
      const result = await runWizard(
        {
          interviewerName: interviewerName.trim(),
          companyName: companyName.trim(),
          roleTitle: roleTitle.trim(),
          aboutCompany: aboutCompany.trim(),
          aboutRole: aboutRole.trim(),
          selectedOrganizationId: selectedOrganizationId.trim() || null,
          categories,
          createTexts,
          createContextPrompt,
          keywords: keywords.trim(),
        },
        setProgressMessage,
      )
      onComplete(result)
      if (result.persistenceError) {
        setGenerateError(result.persistenceError)
        return
      }
      handleOpenChange(false)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setIsGenerating(false)
      setProgressMessage("")
    }
  }, [
    interviewerName,
    companyName,
    roleTitle,
    aboutCompany,
    aboutRole,
    selectedOrganizationId,
    categories,
    createTexts,
    createContextPrompt,
    keywords,
    onComplete,
    handleOpenChange,
  ])

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Prompt Wizard</DialogTitle>
          <DialogDescription>
            Import a spreadsheet to automatically generate call and scoring prompts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-2 pb-2">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  i < currentStep
                    ? "bg-primary text-primary-foreground"
                    : i === currentStep
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-sm ${
                  i === currentStep ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {step}
              </span>
              {i < STEPS.length - 1 && (
                <div className="h-px w-8 bg-border" />
              )}
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {currentStep === 0 && (
            <div className="flex flex-col gap-4">
              <div
                className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <FileSpreadsheet className="size-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {fileName || "Drop your CSV file here"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Required columns: Category, Question, Points, Scoring guidance
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="size-4" />
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {parseError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{parseError}</p>
                </div>
              )}

              {categories.length > 0 && (
                <div className="rounded-md border">
                  <div className="border-b bg-muted/50 px-4 py-2">
                    <p className="text-sm font-medium text-foreground">
                      {categories.length} {categories.length === 1 ? "category" : "categories"}, {totalQuestions} {totalQuestions === 1 ? "question" : "questions"} found
                    </p>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {categories.map((cat) => (
                      <div key={cat.name} className="border-b px-4 py-2 last:border-b-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{cat.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {cat.questions.length} {cat.questions.length === 1 ? "question" : "questions"}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {cat.questions.map((q, qi) => (
                            <li key={qi} className="text-xs text-muted-foreground truncate">
                              {q.question} ({q.points} pts)
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="wizard-interviewer" className="text-sm font-medium text-foreground">
                  AI Interviewer Name
                </label>
                <Input
                  id="wizard-interviewer"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  placeholder="e.g., Sarah"
                />
                <p className="text-xs text-muted-foreground">
                  The name the AI interviewer will use during the call.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="wizard-organization" className="text-sm font-medium text-foreground">
                  Organization (optional)
                </label>
                <Select
                  value={selectedOrganizationId || "__none__"}
                  onValueChange={(value) => {
                    const newOrgId = value === "__none__" ? "" : value
                    setSelectedOrganizationId(newOrgId)
                    if (!newOrgId) {
                      setCreateTexts(false)
                      setCreateContextPrompt(false)
                    }
                  }}
                >
                  <SelectTrigger id="wizard-organization">
                    <SelectValue placeholder="Do not save under an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Do not save under an organization</SelectItem>
                    {organizations.map((organization) => (
                      <SelectItem key={organization.orgId} value={organization.orgId}>
                        {organization.orgName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If selected, the wizard will also create a role, call prompt, and scoring criteria under this organization.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="wizard-create-texts"
                  checked={createTexts}
                  onCheckedChange={(checked) => setCreateTexts(checked === true)}
                  disabled={!selectedOrganizationId || selectedOrganizationId === "__none__"}
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="wizard-create-texts"
                    className={`flex items-center gap-2 text-sm font-medium leading-none ${
                      !selectedOrganizationId || selectedOrganizationId === "__none__"
                        ? "text-muted-foreground"
                        : "text-foreground cursor-pointer"
                    }`}
                  >
                    <MessageSquare className="size-4" />
                    Create texts
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Creates INVITE, PICKED_UP, and DID_NOT_PICKUP text message templates for this role. Requires an organization to be selected.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="wizard-create-context-prompt"
                  checked={createContextPrompt}
                  onCheckedChange={(checked) => setCreateContextPrompt(checked === true)}
                  disabled={!selectedOrganizationId || selectedOrganizationId === "__none__"}
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="wizard-create-context-prompt"
                    className={`flex items-center gap-2 text-sm font-medium leading-none ${
                      !selectedOrganizationId || selectedOrganizationId === "__none__"
                        ? "text-muted-foreground"
                        : "text-foreground cursor-pointer"
                    }`}
                  >
                    <FileText className="size-4" />
                    Create context prompt
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Creates a default resume analyzer context prompt linked to the outbound call task. Requires an organization to be selected.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="wizard-keywords" className="text-sm font-medium text-foreground">
                  STT Keywords
                </label>
                <Input
                  id="wizard-keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g., Acme Corp, NP, telehealth"
                  disabled={!selectedOrganizationId || selectedOrganizationId === "__none__"}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated keywords to boost speech-to-text accuracy. Only used when saving under an organization.
                </p>
              </div>

            </div>
          )}

          {currentStep === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="wizard-company" className="text-sm font-medium text-foreground">
                  Company Name
                </label>
                <Input
                  id="wizard-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g., Acme Corp"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="wizard-role" className="text-sm font-medium text-foreground">
                  Role Title
                </label>
                <Input
                  id="wizard-role"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g., Software Engineer"
                />
                <p className="text-xs text-muted-foreground">
                  The position being interviewed for.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="wizard-about-company" className="text-sm font-medium text-foreground">
                  About the Company
                </label>
                <Textarea
                  id="wizard-about-company"
                  value={aboutCompany}
                  onChange={(e) => setAboutCompany(e.target.value)}
                  placeholder="Describe the company, its mission, and what it does..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Background information about the company for the AI to reference when answering candidate questions.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="wizard-about-role" className="text-sm font-medium text-foreground">
                  About the Role
                </label>
                <Textarea
                  id="wizard-about-role"
                  value={aboutRole}
                  onChange={(e) => setAboutRole(e.target.value)}
                  placeholder="Describe the role's responsibilities, requirements, and expectations..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Description of the role to help the AI provide context to candidates.
                </p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border bg-muted/30 p-4">
                <h4 className="text-sm font-medium text-foreground mb-3">Generation Summary</h4>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Interviewer</span>
                  <span className="text-foreground font-medium">{interviewerName}</span>
                  <span className="text-muted-foreground">Company</span>
                  <span className="text-foreground font-medium">{companyName}</span>
                  <span className="text-muted-foreground">Organization</span>
                  <span className="text-foreground font-medium">
                    {organizations.find((organization) => organization.orgId === selectedOrganizationId)?.orgName ?? "Not selected"}
                  </span>
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-foreground font-medium">{roleTitle}</span>
                  <span className="text-muted-foreground">About Company</span>
                  <span className="text-foreground font-medium line-clamp-2">{aboutCompany}</span>
                  <span className="text-muted-foreground">About Role</span>
                  <span className="text-foreground font-medium line-clamp-2">{aboutRole}</span>
                  {selectedOrganizationId && keywords && (
                    <>
                      <span className="text-muted-foreground">STT Keywords</span>
                      <span className="text-foreground font-medium line-clamp-2">{keywords}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Categories</span>
                  <span className="text-foreground font-medium">{categories.length}</span>
                  <span className="text-muted-foreground">Total Questions</span>
                  <span className="text-foreground font-medium">{totalQuestions}</span>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h4 className="text-sm font-medium text-foreground mb-2">What will be generated</h4>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>Persona and Job Info blocks with your interviewer, company, and role details</li>
                  <li>Rules, Instructions, FAQ, and Global Constraint blocks with standard content</li>
                  <li>{categories.length} section{categories.length !== 1 ? "s" : ""} with {totalQuestions} interview question{totalQuestions !== 1 ? "s" : ""} and AI-generated follow-up strategies</li>
                  <li>{categories.length} scoring prompt tab{categories.length !== 1 ? "s" : ""} with AI-generated score level descriptions</li>
                  {createTexts && (
                    <li>3 text message templates (INVITE, PICKED_UP, DID_NOT_PICKUP) for candidate outreach</li>
                  )}
                  {createContextPrompt && (
                    <li>A default resume analyzer context prompt linked to the outbound call task</li>
                  )}
                </ul>
              </div>

              {isGenerating && (
                <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-4">
                  <Sparkles className="size-4 shrink-0 animate-spin text-primary" />
                  <span className="text-sm text-foreground">{progressMessage}</span>
                </div>
              )}

              {generateError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{generateError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isGenerating}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="gap-2"
            >
              Next
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-2"
            >
              <Sparkles className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "Generating..." : "Generate Prompts"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
