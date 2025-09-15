"use client"

import { useState, useEffect } from "react"
import {
  Bot,
  Brain,
  Mail,
  FileText,
  AlertTriangle,
  TrendingUp,
  Send,
  Loader2,
  Download,
  Copy,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { TradeData } from "@/lib/data-processor"
import { analyzeTradeDataAction, analyzeCMTASectionAction, generateEmailAction } from "@/app/actions/ai-actions"

interface AIAssistantPanelProps {
  trades: TradeData[]
  dataType: "equity" | "fx"
  currentSection: string
  sectionData?: any
}

export default function AIAssistantPanel({ trades, dataType, currentSection, sectionData }: AIAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState("analysis")
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [insights, setInsights] = useState<any>(null)
  const [emailDraft, setEmailDraft] = useState<any>(null)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState("")

  // Auto-analyze when trades change
  useEffect(() => {
    if (trades.length > 0) {
      analyzeData()
    }
  }, [trades, dataType])

  const analyzeData = async () => {
    setLoading(true)
    try {
      const tradeAnalysis = await analyzeTradeDataAction(trades, dataType)
      setAnalysis(tradeAnalysis)

      const sectionAnalysis = await analyzeCMTASectionAction(
        currentSection,
        sectionData,
        `Current section: ${currentSection} with ${trades.length} trades`,
      )
      setInsights(sectionAnalysis)
    } catch (error) {
      console.error("AI Analysis failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateEmail = async (emailType: string) => {
    setLoading(true)
    try {
      const context = {
        section: currentSection,
        dataType,
        tradeCount: trades.length,
        analysis: analysis?.summary,
        risks: analysis?.risks,
        anomalies: analysis?.anomalies,
      }

      const email = await generateEmailAction(emailType, context)
      setEmailDraft(email)
      setActiveTab("emails")
    } catch (error) {
      console.error("Email generation failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return

    const userMessage = { role: "user", content: chatInput, timestamp: new Date() }
    setChatMessages((prev) => [...prev, userMessage])
    setChatInput("")

    try {
      const context = {
        currentSection,
        trades: trades.slice(0, 5), // Send sample for context
        analysis,
        insights,
      }

      const response = await analyzeCMTASectionAction("chat_response", context, `User question: ${chatInput}`)

      const aiMessage = {
        role: "assistant",
        content: response.analysis,
        timestamp: new Date(),
      }
      setChatMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("Chat failed:", error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const isAIAvailable = !!process.env.OPENAI_API_KEY

  return (
    <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        {/* Add availability status */}
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">Chitra - CMTA AI Assistant</h3>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {trades.length} {dataType} trades • {currentSection}
              </p>
              <Badge variant={isAIAvailable ? "default" : "secondary"} className="text-xs">
                {isAIAvailable ? "Chitra Active" : "Chitra Demo"}
              </Badge>
            </div>
          </div>
        </div>

        <Button onClick={analyzeData} disabled={loading || trades.length === 0} size="sm" className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Analysis
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4 m-2">
            <TabsTrigger value="analysis" className="text-xs">
              <Brain className="h-3 w-3 mr-1" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="emails" className="text-xs">
              <Mail className="h-3 w-3 mr-1" />
              Emails
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs">
              <Bot className="h-3 w-3 mr-1" />
              Chat
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto p-2">
            <TabsContent value="analysis" className="mt-0 space-y-4">
              {analysis ? (
                <>
                  {!isAIAvailable && (
                    <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                          <AlertTriangle className="h-4 w-4" />
                          <p className="text-xs">
                            Demo mode active. Add OPENAI_API_KEY environment variable for full AI features.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Trade Data Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-gray-600 dark:text-gray-400">{analysis.summary}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Risks Identified
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {analysis.risks.map((risk: string, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <Badge variant="destructive" className="text-xs">
                              Risk
                            </Badge>
                            <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">{risk}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Key Insights</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {analysis.insights.map((insight: string, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <Badge variant="secondary" className="text-xs">
                              Insight
                            </Badge>
                            <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {analysis.recommendations.map((rec: string, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <Badge className="text-xs">Action</Badge>
                            <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-500">
                    {trades.length === 0
                      ? "Upload trade data to start analysis"
                      : "Click 'Refresh Analysis' to analyze your data"}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="insights" className="mt-0 space-y-4">
              {insights ? (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{currentSection} Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-gray-600 dark:text-gray-400">{insights.analysis}</p>
                    </CardContent>
                  </Card>

                  {insights.alerts.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          Alerts
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {insights.alerts.map((alert: string, index: number) => (
                            <div
                              key={index}
                              className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800"
                            >
                              <p className="text-xs text-red-800 dark:text-red-200">{alert}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Action Items</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {insights.actionItems.map((item: string, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">{item}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-500">Section insights will appear here after analysis</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="emails" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Button
                  onClick={() => generateEmail("settlement_delay")}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={loading}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Settlement Delay Notice
                </Button>
                <Button
                  onClick={() => generateEmail("risk_alert")}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={loading}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Risk Alert
                </Button>
                <Button
                  onClick={() => generateEmail("monthly_summary")}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={loading}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Monthly Summary
                </Button>
                <Button
                  onClick={() => generateEmail("exception_report")}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={loading}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Exception Report
                </Button>
              </div>

              {emailDraft && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      Generated Email
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(emailDraft.body)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Subject:</label>
                      <p className="text-xs font-medium">{emailDraft.subject}</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500">Recipients:</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {emailDraft.recipients.map((recipient: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {recipient}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500">Priority:</label>
                      <Badge
                        variant={emailDraft.priority === "urgent" ? "destructive" : "secondary"}
                        className="text-xs ml-2"
                      >
                        {emailDraft.priority}
                      </Badge>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500">Body:</label>
                      <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs whitespace-pre-wrap max-h-40 overflow-auto">
                        {emailDraft.body}
                      </div>
                    </div>

                    <Button size="sm" className="w-full">
                      <Send className="h-3 w-3 mr-2" />
                      Send Email
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="chat" className="mt-0 h-full flex flex-col">
              <div className="flex-1 overflow-auto space-y-2 mb-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">Ask Chitra anything about your CMTA data</p>
                  </div>
                ) : (
                  chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-xs ${
                        message.role === "user"
                          ? "bg-blue-100 dark:bg-blue-900 ml-4"
                          : "bg-gray-100 dark:bg-gray-700 mr-4"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {message.role === "user" ? (
                          <div className="w-4 h-4 bg-blue-500 rounded-full" />
                        ) : (
                          <Bot className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-medium">{message.role === "user" ? "You" : "Chitra"}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{message.content}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                  placeholder="Ask Chitra..."
                  className="flex-1 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
                <Button size="sm" onClick={sendChatMessage} disabled={!chatInput.trim()}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
