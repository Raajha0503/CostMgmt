"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Mail, Send, Copy, Edit, Plus, X, AlertTriangle, Loader2 } from "lucide-react"
import { EmailTemplateGenerator, type EmailTemplate } from "@/lib/email-templates"
import type { TradeData } from "@/lib/data-processor"

interface IssueResolutionModalProps {
  isOpen: boolean
  onClose: () => void
  trade: TradeData | null
  issueTypes: string[]
}

export default function IssueResolutionModal({ isOpen, onClose, trade, issueTypes }: IssueResolutionModalProps) {
  const [selectedIssue, setSelectedIssue] = useState<string>("")
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate | null>(null)
  const [customRecipients, setCustomRecipients] = useState<string[]>([])
  const [newRecipient, setNewRecipient] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editedSubject, setEditedSubject] = useState("")
  const [editedBody, setEditedBody] = useState("")

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen && trade) {
      setSelectedIssue(issueTypes[0] || "")
      setCustomRecipients([])
      setEmailTemplate(null)
      setEditMode(false)
    }
  }, [isOpen, trade, issueTypes])

  // Generate email when issue type changes
  useEffect(() => {
    if (selectedIssue && trade) {
      generateEmail()
    }
  }, [selectedIssue, trade])

  const generateEmail = async () => {
    if (!trade || !selectedIssue) return

    setIsGenerating(true)
    try {
      const email = await EmailTemplateGenerator.generateIssueEmail(
        selectedIssue,
        trade,
        customRecipients.length > 0 ? customRecipients : undefined,
      )
      setEmailTemplate(email)
      setEditedSubject(email.subject)
      setEditedBody(email.body)
    } catch (error) {
      console.error("Failed to generate email:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const addRecipient = () => {
    if (newRecipient.trim() && !customRecipients.includes(newRecipient.trim())) {
      setCustomRecipients([...customRecipients, newRecipient.trim()])
      setNewRecipient("")
    }
  }

  const removeRecipient = (email: string) => {
    setCustomRecipients(customRecipients.filter((r) => r !== email))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const sendViaGmail = () => {
    if (!emailTemplate) return

    const finalEmail = {
      ...emailTemplate,
      subject: editedSubject,
      body: editedBody,
      recipients: customRecipients.length > 0 ? customRecipients : emailTemplate.recipients,
    }

    const gmailUrl = EmailTemplateGenerator.generateGmailUrl(finalEmail)
    window.open(gmailUrl, "_blank")
  }

  const getIssueTypeColor = (issueType: string) => {
    switch (issueType.toLowerCase()) {
      case "settlement_failed":
        return "destructive"
      case "kyc_failed":
        return "destructive"
      case "confirmation_failed":
        return "destructive"
      case "reference_data_invalid":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getIssueTypeIcon = (issueType: string) => {
    switch (issueType.toLowerCase()) {
      case "settlement_failed":
        return <AlertTriangle className="h-4 w-4" />
      case "kyc_failed":
        return <AlertTriangle className="h-4 w-4" />
      case "confirmation_failed":
        return <AlertTriangle className="h-4 w-4" />
      case "reference_data_invalid":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  if (!trade) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800">
        <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <div className="p-2 bg-black rounded-lg">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            Resolve Trade Issues - {trade.tradeId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Trade Summary */}
          <div className="card-bw p-4">
            <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Trade Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Trade ID:</span>
                  <span className="text-gray-900 dark:text-white">{trade.tradeId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Date:</span>
                  <span className="text-gray-900 dark:text-white">{trade.tradeDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Symbol/Pair:</span>
                  <span className="text-gray-900 dark:text-white">{trade.symbol || trade.currencyPair}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Counterparty:</span>
                  <span className="text-gray-900 dark:text-white">{trade.counterparty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Value:</span>
                  <span className="text-gray-900 dark:text-white">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(trade.tradeValue || trade.notionalAmount || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Status:</span>
                  <span className="text-gray-900 dark:text-white">{trade.settlementStatus}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Issue Types */}
          <div>
            <Label className="text-base font-semibold text-gray-900 dark:text-white">Identified Issues</Label>
            <div className="flex flex-wrap gap-2 mt-3">
              {issueTypes.map((issue) => (
                <button
                  key={issue}
                  onClick={() => setSelectedIssue(issue)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    selectedIssue === issue
                      ? "border-black bg-gray-100 dark:bg-gray-700 dark:border-gray-500"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
                  }`}
                >
                  {getIssueTypeIcon(issue)}
                  <Badge variant={getIssueTypeColor(issue)} className="text-xs">
                    {issue.replace("_", " ").toUpperCase()}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Recipients */}
          <div>
            <Label className="text-base font-semibold text-gray-900 dark:text-white">Email Recipients</Label>
            <div className="space-y-3 mt-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter email address (e.g., team@barclays.com)"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addRecipient()}
                  className="flex-1 focus:ring-black focus:border-black"
                />
                <Button onClick={addRecipient} size="sm" className="btn-primary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {customRecipients.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Custom Recipients:</p>
                  <div className="flex flex-wrap gap-2">
                    {customRecipients.map((email) => (
                      <div
                        key={email}
                        className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg"
                      >
                        <span className="text-sm text-gray-900 dark:text-white">{email}</span>
                        <button onClick={() => removeRecipient(email)} className="text-gray-500 hover:text-gray-700">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator className="border-gray-200 dark:border-gray-700" />

          {/* Email Preview */}
          {isGenerating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Generating email...</span>
            </div>
          ) : emailTemplate ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Generated Email</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)} className="btn-secondary">
                    <Edit className="h-4 w-4 mr-1" />
                    {editMode ? "Preview" : "Edit"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(editedBody)}
                    className="btn-secondary"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                {/* Subject */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subject:</Label>
                  {editMode ? (
                    <Input
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="mt-1 focus:ring-black focus:border-black"
                    />
                  ) : (
                    <p className="mt-1 font-medium text-gray-900 dark:text-white">{editedSubject}</p>
                  )}
                </div>

                {/* Recipients */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">To:</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(customRecipients.length > 0 ? customRecipients : emailTemplate.recipients).map((recipient) => (
                      <Badge key={recipient} variant="secondary" className="text-xs bg-gray-100 dark:bg-gray-700">
                        {recipient}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority:</Label>
                  <Badge variant={emailTemplate.priority === "urgent" ? "destructive" : "secondary"} className="ml-2">
                    {emailTemplate.priority.toUpperCase()}
                  </Badge>
                </div>

                {/* Body */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Message:</Label>
                  {editMode ? (
                    <Textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={15}
                      className="mt-1 font-mono text-sm focus:ring-black focus:border-black"
                    />
                  ) : (
                    <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded border max-h-60 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap text-gray-900 dark:text-white">{editedBody}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} className="btn-secondary">
            Cancel
          </Button>
          <Button onClick={generateEmail} disabled={!selectedIssue || isGenerating} className="btn-secondary">
            <Mail className="h-4 w-4 mr-2" />
            Regenerate Email
          </Button>
          <Button onClick={sendViaGmail} disabled={!emailTemplate} className="btn-primary bg-red-600 hover:bg-red-700">
            <Send className="h-4 w-4 mr-2" />
            Send via Gmail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
