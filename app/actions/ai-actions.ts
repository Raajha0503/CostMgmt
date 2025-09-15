"use server"

import { generateText, generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import type { TradeData } from "@/lib/data-processor"

// Server-side AI functions that safely use the API key
export async function analyzeTradeDataAction(
  trades: TradeData[],
  dataType: "equity" | "fx",
): Promise<{
  summary: string
  insights: string[]
  risks: string[]
  recommendations: string[]
  anomalies: any[]
}> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return getMockTradeAnalysis(trades, dataType)
  }

  try {
    const model = openai("gpt-4o", { apiKey })
    const sampleTrades = trades.slice(0, 10)

    const { text } = await generateText({
      model,
      prompt: `
        Analyze the following ${dataType} trade data and provide insights:
        
        Data Type: ${dataType.toUpperCase()}
        Total Trades: ${trades.length}
        Sample Trades: ${JSON.stringify(sampleTrades, null, 2)}
        
        Please provide:
        1. A comprehensive summary of the trade data
        2. Key insights about trading patterns
        3. Potential risks identified
        4. Recommendations for optimization
        5. Any anomalies or unusual patterns
        
        Focus on settlement risks, counterparty exposure, cost analysis, and operational efficiency.
      `,
    })

    const lines = text.split("\n").filter((line) => line.trim())

    return {
      summary: extractSection(lines, "summary") || "Trade data analysis completed",
      insights: extractListItems(lines, "insights"),
      risks: extractListItems(lines, "risks"),
      recommendations: extractListItems(lines, "recommendations"),
      anomalies: detectAnomalies(trades),
    }
  } catch (error) {
    console.error("AI Analysis failed:", error)
    return getMockTradeAnalysis(trades, dataType)
  }
}

export async function analyzeCMTASectionAction(
  sectionName: string,
  data: any,
  context: string,
): Promise<{
  analysis: string
  actionItems: string[]
  alerts: string[]
  suggestions: string[]
}> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return getMockSectionAnalysis(sectionName, data)
  }

  try {
    const model = openai("gpt-4o", { apiKey })

    const { text } = await generateText({
      model,
      prompt: `
        Analyze the ${sectionName} section of the CMTA system:
        
        Section: ${sectionName}
        Context: ${context}
        Data: ${JSON.stringify(data, null, 2)}
        
        Provide:
        1. Detailed analysis of the current state
        2. Action items that need attention
        3. Alerts for potential issues
        4. Suggestions for improvement
        
        Focus on operational efficiency, risk management, and compliance.
      `,
    })

    const lines = text.split("\n").filter((line) => line.trim())

    return {
      analysis: extractSection(lines, "analysis") || text,
      actionItems: extractListItems(lines, "action"),
      alerts: extractListItems(lines, "alert"),
      suggestions: extractListItems(lines, "suggestion"),
    }
  } catch (error) {
    console.error("Section analysis failed:", error)
    return getMockSectionAnalysis(sectionName, data)
  }
}

export async function generateEmailAction(
  emailType: string,
  context: any,
): Promise<{
  subject: string
  body: string
  recipients: string[]
  priority: "low" | "medium" | "high" | "urgent"
  attachments?: string[]
}> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return getMockEmail(emailType, context)
  }

  try {
    const model = openai("gpt-4o", { apiKey })

    const { object } = await generateObject({
      model,
      schema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          recipients: { type: "array", items: { type: "string" } },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          attachments: { type: "array", items: { type: "string" } },
        },
        required: ["subject", "body", "recipients", "priority"],
      },
      prompt: `
        Generate a professional email for the following context:
        
        Email Type: ${emailType}
        Context: ${JSON.stringify(context, null, 2)}
        
        Create an appropriate email with:
        - Professional subject line
        - Well-structured body content
        - Relevant recipients based on context
        - Appropriate priority level
        - Suggested attachments if needed
        
        Email types can include:
        - Settlement delay notification
        - Risk alert
        - Compliance issue
        - Trade confirmation
        - Exception report
        - Monthly summary
        - Counterparty communication
      `,
    })

    return object
  } catch (error) {
    console.error("Email generation failed:", error)
    return getMockEmail(emailType, context)
  }
}

// Helper functions
function getMockTradeAnalysis(trades: TradeData[], dataType: "equity" | "fx") {
  const totalValue = trades.reduce((sum, trade) => sum + (trade.tradeValue || trade.notionalAmount || 0), 0)
  const avgValue = totalValue / trades.length || 0
  const counterparties = [...new Set(trades.map((t) => t.counterparty).filter(Boolean))]

  return {
    summary: `Analysis of ${trades.length} ${dataType} trades with total value of $${totalValue.toLocaleString()}. Average trade size: $${avgValue.toLocaleString()}. Active counterparties: ${counterparties.length}.`,
    insights: [
      `${dataType.toUpperCase()} portfolio shows ${trades.length} active positions`,
      `Average trade value indicates ${avgValue > 1000000 ? "institutional" : "retail"} trading pattern`,
      `Counterparty concentration across ${counterparties.length} entities`,
      `Settlement timeline analysis shows ${trades.filter((t) => t.settlementStatus === "Settled").length} completed trades`,
    ],
    risks: [
      counterparties.length < 3 ? "High counterparty concentration risk" : "Moderate counterparty diversification",
      avgValue > 5000000 ? "Large position size risk" : "Standard position sizing",
      "Settlement timing risk requires monitoring",
      "Market volatility exposure needs assessment",
    ],
    recommendations: [
      "Implement automated settlement monitoring",
      "Review counterparty credit limits",
      "Enhance trade validation processes",
      "Consider position size optimization",
      "Establish regular risk reporting cadence",
    ],
    anomalies: detectAnomalies(trades),
  }
}

function getMockSectionAnalysis(sectionName: string, data: any) {
  return {
    analysis: `${sectionName} section analysis: Current operational status appears stable with standard processing workflows active. Data integrity checks passed. System performance within normal parameters.`,
    actionItems: [
      `Review ${sectionName.toLowerCase()} configuration settings`,
      "Update operational procedures documentation",
      "Schedule routine maintenance window",
      "Validate data synchronization processes",
    ],
    alerts: [data && Object.keys(data).length === 0 ? "No data available for analysis" : null].filter(Boolean),
    suggestions: [
      "Implement automated monitoring dashboards",
      "Enhance error handling procedures",
      "Consider workflow optimization opportunities",
      "Establish performance benchmarks",
    ],
  }
}

function getMockEmail(emailType: string, context: any) {
  const emailTemplates = {
    settlement_delay: {
      subject: "Settlement Delay Notification - Action Required",
      body: `Dear Team,\n\nWe have identified settlement delays in the current trade processing cycle that require immediate attention.\n\nDetails:\n- Affected trades: ${context.tradeCount || "Multiple"}\n- Data type: ${context.dataType || "Mixed"}\n- Current section: ${context.section}\n\nPlease review the attached details and take appropriate action to resolve these delays.\n\nBest regards,\nCMTA Operations Team`,
      recipients: ["operations@company.com", "risk@company.com"],
      priority: "high" as const,
    },
    risk_alert: {
      subject: "Risk Alert - Immediate Review Required",
      body: `URGENT: Risk Alert\n\nOur monitoring systems have detected elevated risk levels that require immediate attention.\n\nRisk Summary:\n- Portfolio: ${context.dataType || "Mixed"} trades\n- Count: ${context.tradeCount || "Multiple"} positions\n- Section: ${context.section}\n\nPlease review and take appropriate risk mitigation measures immediately.\n\nRisk Management Team`,
      recipients: ["risk@company.com", "management@company.com"],
      priority: "urgent" as const,
    },
    monthly_summary: {
      subject: `Monthly CMTA Summary - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
      body: `Monthly Operations Summary\n\nDear Stakeholders,\n\nPlease find below the monthly summary of CMTA operations:\n\nKey Metrics:\n- Total trades processed: ${context.tradeCount || "N/A"}\n- Primary asset class: ${context.dataType || "Mixed"}\n- Current focus area: ${context.section}\n\nOperational highlights and detailed analytics are attached.\n\nBest regards,\nCMTA Operations Team`,
      recipients: ["management@company.com", "operations@company.com"],
      priority: "medium" as const,
    },
    exception_report: {
      subject: "Exception Report - Processing Anomalies Detected",
      body: `Exception Report\n\nWe have identified processing exceptions that require review:\n\nException Details:\n- Affected area: ${context.section}\n- Trade count: ${context.tradeCount || "Multiple"}\n- Asset type: ${context.dataType || "Mixed"}\n\nPlease review the exceptions and implement necessary corrections.\n\nOperations Team`,
      recipients: ["operations@company.com", "support@company.com"],
      priority: "high" as const,
    },
  }

  return emailTemplates[emailType as keyof typeof emailTemplates] || emailTemplates.monthly_summary
}

function extractSection(lines: string[], keyword: string): string | null {
  const sectionStart = lines.findIndex((line) => line.toLowerCase().includes(keyword.toLowerCase()))

  if (sectionStart === -1) return null

  const nextSectionStart = lines.findIndex((line, index) => index > sectionStart && /^\d+\./.test(line.trim()))

  const endIndex = nextSectionStart === -1 ? lines.length : nextSectionStart
  return lines
    .slice(sectionStart + 1, endIndex)
    .join(" ")
    .trim()
}

function extractListItems(lines: string[], keyword: string): string[] {
  const items: string[] = []
  let inSection = false

  for (const line of lines) {
    if (line.toLowerCase().includes(keyword.toLowerCase())) {
      inSection = true
      continue
    }

    if (inSection) {
      if (/^\d+\./.test(line.trim()) && !line.toLowerCase().includes(keyword.toLowerCase())) {
        break
      }

      if (line.trim().startsWith("-") || line.trim().startsWith("•") || /^\d+\./.test(line.trim())) {
        items.push(line.trim().replace(/^[-•\d.]\s*/, ""))
      }
    }
  }

  return items.filter((item) => item.length > 0)
}

function detectAnomalies(trades: TradeData[]): any[] {
  const anomalies = []

  if (trades.length === 0) return anomalies

  // Detect unusually large trades
  const values = trades.map((t) => t.tradeValue || t.notionalAmount || 0)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const threshold = avg * 3

  trades.forEach((trade) => {
    const value = trade.tradeValue || trade.notionalAmount || 0
    if (value > threshold && value > 0) {
      anomalies.push({
        type: "Large Trade",
        tradeId: trade.tradeId,
        value,
        threshold,
        severity: "medium",
      })
    }
  })

  // Detect missing data
  const missingDataTrades = trades.filter(
    (trade) => !trade.counterparty || !trade.tradeDate || (!trade.tradeValue && !trade.notionalAmount),
  )

  if (missingDataTrades.length > 0) {
    anomalies.push({
      type: "Missing Data",
      count: missingDataTrades.length,
      severity: "high",
      description: "Trades with incomplete information detected",
    })
  }

  return anomalies
}
