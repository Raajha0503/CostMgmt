"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Eye,
  FileSpreadsheet,
  Database,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Link,
  Unlink,
  Merge,
  Cloud,
  HardDrive,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import * as XLSX from "xlsx"

interface UploadedFile {
  id: string
  name: string
  type: "csv" | "xlsx"
  uploadDate: string
  rows: number
  columns: number
  data: any[]
  headers: string[]
}

interface CostData {
  TradeID: string
  FXGainLoss: string
  PnlCalculated: string
  CostAllocationStatus: string
  ExpenseApprovalStatus: string
  CostBookedDate: string
  CommissionAmount: string
  CommissionCurrency: string
  BrokerageFee: string
  BrokerageCurrency: string
}

interface UnifiedRecord {
  _MatchStatus: "Perfect Match" | "Partial Match" | "Captured Only" | "Cost Only"
  _MatchScore: number
  _TradeID: string
  [key: string]: any // All other columns from both tables
}

interface CombinedData {
  [key: string]: any
}

interface MatchedRecord {
  capturedData?: any
  costData?: CostData
  matchScore: number
  matchedOn: string[]
  recordType: "matched" | "captured_only" | "cost_only"
}

export default function CapturedFromCMS() {
  const [activeTab, setActiveTab] = useState("data-upload")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [costData, setCostData] = useState<CostData[]>([])
  const [isLoadingCostData, setIsLoadingCostData] = useState(false)
  const [combineMode, setCombineMode] = useState<"separate" | "matched">("matched")
  const [matchThreshold, setMatchThreshold] = useState(0.7)
  const [showMatchedOnly, setShowMatchedOnly] = useState(false)
  const [unifiedRecords, setUnifiedRecords] = useState<UnifiedRecord[]>([])
  const [allHeaders, setAllHeaders] = useState<string[]>([])

  const [editableCostData, setEditableCostData] = useState<CostData[]>([])
  const [editingCells, setEditingCells] = useState<Set<string>>(new Set())
  const [modifiedCells, setModifiedCells] = useState<Set<string>>(new Set())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Hardcoded cost data with TradeID column added
  const hardcodedCostData: CostData[] = [
    {
      TradeID: "FX0010",
      FXGainLoss: "-4783.35",
      PnlCalculated: "-7541.58",
      CostAllocationStatus: "Failed",
      ExpenseApprovalStatus: "Rejected",
      CostBookedDate: "5/31/2025",
      CommissionAmount: "701.09",
      CommissionCurrency: "CHF",
      BrokerageFee: "307.57",
      BrokerageCurrency: "CHF",
    },
    {
      TradeID: "FX0051",
      FXGainLoss: "-1587.58",
      PnlCalculated: "-1477.41",
      CostAllocationStatus: "Allocated",
      ExpenseApprovalStatus: "Rejected",
      CostBookedDate: "########",
      CommissionAmount: "463.81",
      CommissionCurrency: "CHF",
      BrokerageFee: "78.83",
      BrokerageCurrency: "CHF",
    },
    {
      TradeID: "FX0055",
      FXGainLoss: "179.9",
      PnlCalculated: "-2476.08",
      CostAllocationStatus: "Failed",
      ExpenseApprovalStatus: "Under Review",
      CostBookedDate: "########",
      CommissionAmount: "996.49",
      CommissionCurrency: "USD",
      BrokerageFee: "96.97",
      BrokerageCurrency: "USD",
    },
    {
      TradeID: "FX0100",
      FXGainLoss: "-4894.43",
      PnlCalculated: "-5282.09",
      CostAllocationStatus: "Allocated",
      ExpenseApprovalStatus: "Under Review",
      CostBookedDate: "5/24/2025",
      CommissionAmount: "840.23",
      CommissionCurrency: "USD",
      BrokerageFee: "488.65",
      BrokerageCurrency: "USD",
    },
    {
      TradeID: "FX0111",
      FXGainLoss: "-4458.74",
      PnlCalculated: "-9068.05",
      CostAllocationStatus: "Pending",
      ExpenseApprovalStatus: "Under Review",
      CostBookedDate: "5/13/2025",
      CommissionAmount: "218.27",
      CommissionCurrency: "USD",
      BrokerageFee: "482.44",
      BrokerageCurrency: "USD",
    },
    {
      TradeID: "FX0123",
      FXGainLoss: "1836",
      PnlCalculated: "-9529.88",
      CostAllocationStatus: "Failed",
      ExpenseApprovalStatus: "Rejected",
      CostBookedDate: "########",
      CommissionAmount: "836.84",
      CommissionCurrency: "USD",
      BrokerageFee: "387.09",
      BrokerageCurrency: "USD",
    },
    {
      TradeID: "FX0141",
      FXGainLoss: "-1501.39",
      PnlCalculated: "-1399.27",
      CostAllocationStatus: "Pending",
      ExpenseApprovalStatus: "Under Review",
      CostBookedDate: "########",
      CommissionAmount: "765.49",
      CommissionCurrency: "USD",
      BrokerageFee: "272.8",
      BrokerageCurrency: "USD",
    },
    {
      TradeID: "FX0187",
      FXGainLoss: "223.31",
      PnlCalculated: "-8693.08",
      CostAllocationStatus: "Pending",
      ExpenseApprovalStatus: "Approved",
      CostBookedDate: "5/19/2025",
      CommissionAmount: "572.74",
      CommissionCurrency: "USD",
      BrokerageFee: "202.57",
      BrokerageCurrency: "USD",
    },
    {
      TradeID: "FX0194",
      FXGainLoss: "3335.58",
      PnlCalculated: "-9125.16",
      CostAllocationStatus: "Allocated",
      ExpenseApprovalStatus: "Rejected",
      CostBookedDate: "5/22/2025",
      CommissionAmount: "921.02",
      CommissionCurrency: "USD",
      BrokerageFee: "61.87",
      BrokerageCurrency: "USD",
    },
    {
      TradeID: "FX0195",
      FXGainLoss: "-3353.42",
      PnlCalculated: "-1516.87",
      CostAllocationStatus: "Failed",
      ExpenseApprovalStatus: "Approved",
      CostBookedDate: "5/19/2025",
      CommissionAmount: "777.69",
      CommissionCurrency: "CHF",
      BrokerageFee: "301.56",
      BrokerageCurrency: "CHF",
    },
    {
      TradeID: "FX0198",
      FXGainLoss: "-2205.69",
      PnlCalculated: "768.3",
      CostAllocationStatus: "Failed",
      ExpenseApprovalStatus: "Under Review",
      CostBookedDate: "5/23/2025",
      CommissionAmount: "567.37",
      CommissionCurrency: "JPY",
      BrokerageFee: "156.59",
      BrokerageCurrency: "JPY",
    },
  ]

  // Load uploaded files from localStorage
  useEffect(() => {
    const savedFiles = localStorage.getItem("dataUploadFiles")
    if (savedFiles) {
      try {
        setUploadedFiles(JSON.parse(savedFiles))
      } catch (error) {
        console.error("Error loading uploaded files:", error)
      }
    }
  }, [])

  // Set hardcoded cost data when component mounts
  useEffect(() => {
    setIsLoadingCostData(true)
    // Simulate loading delay
    setTimeout(() => {
      setCostData(hardcodedCostData)
      setEditableCostData(hardcodedCostData.map((item) => ({ ...item }))) // Create editable copy
      setIsLoadingCostData(false)
    }, 500)
  }, [])

  // Save uploaded files to localStorage
  useEffect(() => {
    if (uploadedFiles.length > 0) {
      localStorage.setItem("dataUploadFiles", JSON.stringify(uploadedFiles))
    } else {
      localStorage.removeItem("dataUploadFiles")
    }
  }, [uploadedFiles])

  // Generate unified records when data changes
  useEffect(() => {
    if (uploadedFiles.length > 0 && editableCostData.length > 0) {
      const { unified, headers } = generateUnifiedRecords()
      setUnifiedRecords(unified)
      setAllHeaders(headers)
    } else {
      setUnifiedRecords([])
      setAllHeaders([])
    }
  }, [uploadedFiles, editableCostData]) // Changed from costData to editableCostData

  // Generate unified records by matching TradeID
  const generateUnifiedRecords = (): { unified: UnifiedRecord[]; headers: string[] } => {
    const unified: UnifiedRecord[] = []
    const capturedRecords = uploadedFiles.flatMap((file) => file.data)
    const usedCostIndices = new Set<number>()
    const usedCapturedIndices = new Set<number>()

    // Get all unique headers from captured data
    const capturedHeaders = new Set<string>()
    uploadedFiles.forEach((file) => {
      file.headers.forEach((header) => capturedHeaders.add(header))
    })

    // Get all headers from cost data
    const costHeaders = Object.keys(editableCostData[0] || {}) // Changed from costData to editableCostData

    // Create complete header list: metadata first, then captured, then cost
    const allHeaders = [
      "_MatchStatus",
      "_MatchScore",
      "_TradeID",
      ...Array.from(capturedHeaders),
      ...costHeaders.map((h) => `Cost_${h}`),
    ]

    // Find TradeID field in captured data
    const getTradeIdField = (record: any): string | null => {
      const possibleFields = Object.keys(record).filter(
        (key) =>
          key.toLowerCase().includes("tradeid") ||
          key.toLowerCase().includes("trade_id") ||
          key.toLowerCase().includes("id") ||
          key.toLowerCase().includes("ref"),
      )

      for (const field of possibleFields) {
        if (record[field] && String(record[field]).trim()) {
          return field
        }
      }
      return null
    }

    // First pass: Perfect TradeID matches
    capturedRecords.forEach((capturedRecord, capturedIndex) => {
      const tradeIdField = getTradeIdField(capturedRecord)
      if (!tradeIdField) return

      const capturedTradeId = String(capturedRecord[tradeIdField]).toUpperCase().trim()

      editableCostData.forEach((costRecord, costIndex) => {
        if (usedCostIndices.has(costIndex)) return

        const costTradeId = String(costRecord.TradeID).toUpperCase().trim()

        if (capturedTradeId === costTradeId) {
          const unifiedRecord: UnifiedRecord = {
            _MatchStatus: "Perfect Match",
            _MatchScore: 1.0,
            _TradeID: costRecord.TradeID,
            // Add all captured data
            ...capturedRecord,
            // Add all cost data with Cost_ prefix
            ...Object.fromEntries(Object.entries(costRecord).map(([key, value]) => [`Cost_${key}`, value])),
          }

          unified.push(unifiedRecord)
          usedCostIndices.add(costIndex)
          usedCapturedIndices.add(capturedIndex)
        }
      })
    })

    // Second pass: Partial TradeID matches
    capturedRecords.forEach((capturedRecord, capturedIndex) => {
      if (usedCapturedIndices.has(capturedIndex)) return

      const tradeIdField = getTradeIdField(capturedRecord)
      if (!tradeIdField) return

      const capturedTradeId = String(capturedRecord[tradeIdField]).toUpperCase().trim()

      editableCostData.forEach((costRecord, costIndex) => {
        if (usedCostIndices.has(costIndex)) return

        const costTradeId = String(costRecord.TradeID).toUpperCase().trim()

        // Check for partial matches
        if (capturedTradeId.includes(costTradeId) || costTradeId.includes(capturedTradeId)) {
          const unifiedRecord: UnifiedRecord = {
            _MatchStatus: "Partial Match",
            _MatchScore: 0.8,
            _TradeID: costRecord.TradeID,
            // Add all captured data
            ...capturedRecord,
            // Add all cost data with Cost_ prefix
            ...Object.fromEntries(Object.entries(costRecord).map(([key, value]) => [`Cost_${key}`, value])),
          }

          unified.push(unifiedRecord)
          usedCostIndices.add(costIndex)
          usedCapturedIndices.add(capturedIndex)
        }
      })
    })

    // Third pass: Add unmatched captured records
    capturedRecords.forEach((capturedRecord, capturedIndex) => {
      if (usedCapturedIndices.has(capturedIndex)) return

      const tradeIdField = getTradeIdField(capturedRecord)
      const tradeId = tradeIdField ? String(capturedRecord[tradeIdField]) : `CAPTURED_${capturedIndex}`

      const unifiedRecord: UnifiedRecord = {
        _MatchStatus: "Captured Only",
        _MatchScore: 0,
        _TradeID: tradeId,
        // Add all captured data
        ...capturedRecord,
        // Add empty cost data fields
        ...Object.fromEntries(costHeaders.map((header) => [`Cost_${header}`, ""])),
      }

      unified.push(unifiedRecord)
    })

    // Fourth pass: Add unmatched cost records
    editableCostData.forEach((costRecord, costIndex) => {
      if (usedCostIndices.has(costIndex)) return

      const unifiedRecord: UnifiedRecord = {
        _MatchStatus: "Cost Only",
        _MatchScore: 0,
        _TradeID: costRecord.TradeID,
        // Add empty captured data fields
        ...Object.fromEntries(Array.from(capturedHeaders).map((header) => [header, ""])),
        // Add all cost data with Cost_ prefix
        ...Object.fromEntries(Object.entries(costRecord).map(([key, value]) => [`Cost_${key}`, value])),
      }

      unified.push(unifiedRecord)
    })

    return { unified, headers: allHeaders }
  }

  // Download unified CSV
  const downloadUnifiedCSV = () => {
    if (unifiedRecords.length === 0) {
      alert("No unified data available to download")
      return
    }

    try {
      // Create CSV content with all headers
      let csvContent = allHeaders.join(",") + "\n"

      unifiedRecords.forEach((record) => {
        const values = allHeaders.map((header) => {
          const value = record[header] || ""
          return `"${String(value).replace(/"/g, '""')}"`
        })
        csvContent += values.join(",") + "\n"
      })

      // Download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      link.setAttribute("href", url)
      link.setAttribute("download", `unified_trade_data_${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = "hidden"

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading CSV:", error)
      alert("Error downloading file. Please try again.")
    }
  }

  // Editing helper functions
  const getCellKey = (rowIndex: number, field: string) => `${rowIndex}-${field}`

  const startEditing = (rowIndex: number, field: string) => {
    const cellKey = getCellKey(rowIndex, field)
    setEditingCells((prev) => new Set([...prev, cellKey]))
  }

  const stopEditing = (rowIndex: number, field: string) => {
    const cellKey = getCellKey(rowIndex, field)
    setEditingCells((prev) => {
      const newSet = new Set(prev)
      newSet.delete(cellKey)
      return newSet
    })
  }

  const updateCellValue = (rowIndex: number, field: string, value: string) => {
    const cellKey = getCellKey(rowIndex, field)

    setEditableCostData((prev) => {
      const newData = [...prev]
      newData[rowIndex] = { ...newData[rowIndex], [field]: value }
      return newData
    })

    setModifiedCells((prev) => new Set([...prev, cellKey]))
    setHasUnsavedChanges(true)
  }

  const saveChanges = () => {
    setCostData([...editableCostData])
    setModifiedCells(new Set())
    setHasUnsavedChanges(false)
  }

  const cancelChanges = () => {
    setEditableCostData(costData.map((item) => ({ ...item })))
    setModifiedCells(new Set())
    setEditingCells(new Set())
    setHasUnsavedChanges(false)
  }

  const resetToOriginal = () => {
    setEditableCostData(hardcodedCostData.map((item) => ({ ...item })))
    setCostData(hardcodedCostData.map((item) => ({ ...item })))
    setModifiedCells(new Set())
    setEditingCells(new Set())
    setHasUnsavedChanges(false)
  }

  // Smart data matching function (legacy for backward compatibility)
  const matchRecords = (): MatchedRecord[] => {
    if (uploadedFiles.length === 0 || editableCostData.length === 0) {
      return []
    }

    const capturedRecords = uploadedFiles.flatMap((file) => file.data)
    const matchedRecords: MatchedRecord[] = []
    const usedCostIndices = new Set<number>()
    const usedCapturedIndices = new Set<number>()

    // Try to match captured records with cost records
    capturedRecords.forEach((capturedRecord, capturedIndex) => {
      let bestMatch: { costIndex: number; score: number; matchedFields: string[] } | null = null

      editableCostData.forEach((costRecord, costIndex) => {
        if (usedCostIndices.has(costIndex)) return

        const matchResult = calculateMatchScore(capturedRecord, costRecord)
        if (matchResult.score >= matchThreshold && (!bestMatch || matchResult.score > bestMatch.score)) {
          bestMatch = {
            costIndex,
            score: matchResult.score,
            matchedFields: matchResult.matchedFields,
          }
        }
      })

      if (bestMatch) {
        matchedRecords.push({
          capturedData: capturedRecord,
          costData: editableCostData[bestMatch.costIndex],
          matchScore: bestMatch.score,
          matchedOn: bestMatch.matchedFields,
          recordType: "matched",
        })
        usedCostIndices.add(bestMatch.costIndex)
        usedCapturedIndices.add(capturedIndex)
      }
    })

    // Add unmatched captured records
    capturedRecords.forEach((capturedRecord, index) => {
      if (!usedCapturedIndices.has(index)) {
        matchedRecords.push({
          capturedData: capturedRecord,
          matchScore: 0,
          matchedOn: [],
          recordType: "captured_only",
        })
      }
    })

    // Add unmatched cost records
    editableCostData.forEach((costRecord, index) => {
      if (!usedCostIndices.has(index)) {
        matchedRecords.push({
          costData: costRecord,
          matchScore: 0,
          matchedOn: [],
          recordType: "cost_only",
        })
      }
    })

    return matchedRecords
  }

  // Calculate match score between captured and cost records
  const calculateMatchScore = (
    capturedRecord: any,
    costRecord: CostData,
  ): { score: number; matchedFields: string[] } => {
    let score = 0
    const matchedFields: string[] = []

    // Check TradeID matching (highest priority - 40% weight)
    const capturedIdFields = Object.keys(capturedRecord).filter(
      (key) =>
        key.toLowerCase().includes("tradeid") ||
        key.toLowerCase().includes("trade_id") ||
        key.toLowerCase().includes("id") ||
        key.toLowerCase().includes("ref") ||
        key.toLowerCase().includes("number"),
    )

    for (const idField of capturedIdFields) {
      if (capturedRecord[idField] && costRecord.TradeID) {
        const capturedId = String(capturedRecord[idField]).toUpperCase().trim()
        const costId = String(costRecord.TradeID).toUpperCase().trim()

        if (capturedId === costId) {
          score += 0.4
          matchedFields.push(`TradeID (${idField})`)
          break
        }
        // Partial match for similar IDs
        if (capturedId.includes(costId) || costId.includes(capturedId)) {
          score += 0.3
          matchedFields.push(`TradeID Partial (${idField})`)
          break
        }
      }
    }

    // Check date matching (25% weight)
    const capturedDateFields = Object.keys(capturedRecord).filter(
      (key) => key.toLowerCase().includes("date") || key.toLowerCase().includes("time"),
    )

    for (const dateField of capturedDateFields) {
      if (capturedRecord[dateField] && costRecord.CostBookedDate && costRecord.CostBookedDate !== "########") {
        const capturedDate = new Date(capturedRecord[dateField])
        const costDate = new Date(costRecord.CostBookedDate)

        if (!isNaN(capturedDate.getTime()) && !isNaN(costDate.getTime())) {
          const daysDiff = Math.abs((capturedDate.getTime() - costDate.getTime()) / (1000 * 60 * 60 * 24))
          if (daysDiff <= 1) {
            // Within 1 day
            score += 0.25
            matchedFields.push(`Date (${dateField})`)
            break
          }
        }
      }
    }

    // Check amount matching (20% weight)
    const capturedAmountFields = Object.keys(capturedRecord).filter(
      (key) =>
        key.toLowerCase().includes("amount") ||
        key.toLowerCase().includes("value") ||
        key.toLowerCase().includes("notional"),
    )

    for (const amountField of capturedAmountFields) {
      const capturedAmount = Math.abs(Number.parseFloat(capturedRecord[amountField]) || 0)
      const commissionAmount = Math.abs(Number.parseFloat(costRecord.CommissionAmount) || 0)
      const brokerageAmount = Math.abs(Number.parseFloat(costRecord.BrokerageFee) || 0)

      if (capturedAmount > 0) {
        // Check if captured amount is close to commission or brokerage
        if (Math.abs(capturedAmount - commissionAmount) / Math.max(capturedAmount, commissionAmount) < 0.1) {
          score += 0.2
          matchedFields.push(`Commission Amount (${amountField})`)
          break
        }
        if (Math.abs(capturedAmount - brokerageAmount) / Math.max(capturedAmount, brokerageAmount) < 0.1) {
          score += 0.2
          matchedFields.push(`Brokerage Amount (${amountField})`)
          break
        }
      }
    }

    // Check currency matching (10% weight)
    const capturedCurrencyFields = Object.keys(capturedRecord).filter(
      (key) => key.toLowerCase().includes("currency") || key.toLowerCase().includes("ccy"),
    )

    for (const currencyField of capturedCurrencyFields) {
      if (
        capturedRecord[currencyField] === costRecord.CommissionCurrency ||
        capturedRecord[currencyField] === costRecord.BrokerageCurrency
      ) {
        score += 0.1
        matchedFields.push(`Currency (${currencyField})`)
        break
      }
    }

    // Check P&L matching (5% weight)
    const capturedPnLFields = Object.keys(capturedRecord).filter(
      (key) =>
        key.toLowerCase().includes("pnl") || key.toLowerCase().includes("profit") || key.toLowerCase().includes("loss"),
    )

    for (const pnlField of capturedPnLFields) {
      const capturedPnL = Number.parseFloat(capturedRecord[pnlField]) || 0
      const costPnL = Number.parseFloat(costRecord.PnlCalculated) || 0

      if (Math.abs(capturedPnL - costPnL) / Math.max(Math.abs(capturedPnL), Math.abs(costPnL)) < 0.1) {
        score += 0.05
        matchedFields.push(`P&L (${pnlField})`)
        break
      }
    }

    return { score, matchedFields }
  }

  // Editable cell component
  const EditableCell = ({
    value,
    rowIndex,
    field,
    type = "text",
    className = "",
  }: {
    value: string
    rowIndex: number
    field: string
    type?: "text" | "number" | "date"
    className?: string
  }) => {
    const cellKey = getCellKey(rowIndex, field)
    const isEditing = editingCells.has(cellKey)
    const isModified = modifiedCells.has(cellKey)

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        stopEditing(rowIndex, field)
      } else if (e.key === "Escape") {
        // Reset to original value
        const originalValue = costData[rowIndex]?.[field as keyof CostData] || ""
        updateCellValue(rowIndex, field, originalValue)
        stopEditing(rowIndex, field)
      }
    }

    if (isEditing) {
      return (
        <input
          type={type}
          value={value}
          onChange={(e) => updateCellValue(rowIndex, field, e.target.value)}
          onBlur={() => stopEditing(rowIndex, field)}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
          autoFocus
        />
      )
    }

    return (
      <div
        onClick={() => startEditing(rowIndex, field)}
        className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 px-2 py-1 rounded transition-colors ${
          isModified ? "bg-yellow-50 dark:bg-yellow-900/20 border-l-2 border-yellow-400" : ""
        } ${className}`}
        title={isModified ? "Modified - Click to edit" : "Click to edit"}
      >
        {value || <span className="text-gray-400 italic">Click to edit</span>}
      </div>
    )
  }

  // Status dropdown component
  const StatusDropdown = ({
    value,
    rowIndex,
    field,
    options,
  }: {
    value: string
    rowIndex: number
    field: string
    options: string[]
  }) => {
    const handleStatusChange = (newValue: string) => {
      updateCellValue(rowIndex, field, newValue)
    }

    return (
      <div className="flex items-center space-x-2">
        {getStatusIcon(value)}
        <select
          value={value}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {getStatusBadge(value)}
      </div>
    )
  }

  // Get combined data based on mode
  const getCombinedData = (): { data: CombinedData[]; headers: string[] } => {
    if (combineMode === "matched") {
      return getMatchedCombinedData()
    } else {
      return getSeparateCombinedData()
    }
  }

  // Get matched combined data
  const getMatchedCombinedData = (): { data: CombinedData[]; headers: string[] } => {
    const matchedRecords = matchRecords()
    const filteredRecords = showMatchedOnly
      ? matchedRecords.filter((record) => record.recordType === "matched")
      : matchedRecords

    const allHeaders = new Set<string>()
    const combinedData: CombinedData[] = []

    filteredRecords.forEach((record, index) => {
      const combinedRow: CombinedData = {
        _recordId: index + 1,
        _recordType: record.recordType,
        _matchScore: record.matchScore,
        _matchedOn: record.matchedOn.join(", "),
      }

      // Add captured data fields
      if (record.capturedData) {
        Object.keys(record.capturedData).forEach((key) => {
          combinedRow[`captured_${key}`] = record.capturedData[key]
          allHeaders.add(`captured_${key}`)
        })
      }

      // Add cost data fields
      if (record.costData) {
        Object.keys(record.costData).forEach((key) => {
          combinedRow[`cost_${key}`] = record.costData[key]
          allHeaders.add(`cost_${key}`)
        })
      }

      // Add metadata
      allHeaders.add("_recordId")
      allHeaders.add("_recordType")
      allHeaders.add("_matchScore")
      allHeaders.add("_matchedOn")

      combinedData.push(combinedRow)
    })

    // Sort headers to put metadata first
    const headers = Array.from(allHeaders).sort((a, b) => {
      if (a.startsWith("_") && !b.startsWith("_")) return -1
      if (!a.startsWith("_") && b.startsWith("_")) return 1
      if (a.startsWith("captured_") && b.startsWith("cost_")) return -1
      if (a.startsWith("cost_") && b.startsWith("captured_")) return 1
      return a.localeCompare(b)
    })

    return { data: combinedData, headers }
  }

  // Get separate combined data (original approach)
  const getSeparateCombinedData = (): { data: CombinedData[]; headers: string[] } => {
    const combinedData: CombinedData[] = []
    const allHeaders = new Set<string>()

    // Add captured data from uploaded files
    uploadedFiles.forEach((file, fileIndex) => {
      file.data.forEach((row, rowIndex) => {
        const combinedRow: CombinedData = {
          ...row,
          _source: `Captured File: ${file.name}`,
          _sourceType: "captured",
          _fileIndex: fileIndex,
          _rowIndex: rowIndex,
        }
        combinedData.push(combinedRow)
        Object.keys(combinedRow).forEach((key) => allHeaders.add(key))
      })
    })

    // Add cost data
    editableCostData.forEach((row, rowIndex) => {
      const combinedRow: CombinedData = {
        ...row,
        _source: "Cost Management System",
        _sourceType: "cost",
        _rowIndex: rowIndex,
      }
      combinedData.push(combinedRow)
      Object.keys(combinedRow).forEach((key) => allHeaders.add(key))
    })

    // Sort headers to put source info at the end
    const headers = Array.from(allHeaders).sort((a, b) => {
      if (a.startsWith("_") && !b.startsWith("_")) return 1
      if (!a.startsWith("_") && b.startsWith("_")) return -1
      return a.localeCompare(b)
    })

    return { data: combinedData, headers }
  }

  const processFile = useCallback((file: File): Promise<UploadedFile> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      const fileType = file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx"

      reader.onload = (e) => {
        try {
          let data: any[] = []
          let headers: string[] = []

          if (fileType === "csv") {
            const text = e.target?.result as string
            const lines = text.split("\n").filter((line) => line.trim())
            if (lines.length > 0) {
              headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
              data = lines.slice(1).map((line) => {
                const values = parseCSVRow(line)
                const row: any = {}
                headers.forEach((header, index) => {
                  row[header] = values[index] || ""
                })
                return row
              })
            }
          } else {
            const workbook = XLSX.read(e.target?.result, { type: "binary" })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

            if (jsonData.length > 0) {
              headers = jsonData[0].map((h) => String(h || ""))
              data = jsonData.slice(1).map((row) => {
                const rowData: any = {}
                headers.forEach((header, index) => {
                  rowData[header] = row[index] || ""
                })
                return rowData
              })
            }
          }

          const uploadedFile: UploadedFile = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: fileType,
            uploadDate: new Date().toLocaleDateString(),
            rows: data.length,
            columns: headers.length,
            data,
            headers,
          }

          resolve(uploadedFile)
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => reject(new Error("Failed to read file"))

      if (fileType === "csv") {
        reader.readAsText(file)
      } else {
        reader.readAsBinaryString(file)
      }
    })
  }, [])

  const parseCSVRow = (row: string): string[] => {
    const values = []
    let inQuotes = false
    let currentValue = ""

    for (let i = 0; i < row.length; i++) {
      const char = row[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        values.push(currentValue.trim().replace(/^"|"$/g, ""))
        currentValue = ""
      } else {
        currentValue += char
      }
    }

    values.push(currentValue.trim().replace(/^"|"$/g, ""))
    return values
  }

  // Helper function to convert string to array buffer
  const s2ab = (s: string) => {
    const buf = new ArrayBuffer(s.length)
    const view = new Uint8Array(buf)
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff
    return buf
  }

  const handleFileUpload = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files)

      for (const file of fileArray) {
        if (file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".xlsx")) {
          try {
            const processedFile = await processFile(file)
            setUploadedFiles((prev) => [...prev, processedFile])
          } catch (error) {
            console.error("Error processing file:", error)
            alert(`Error processing file ${file.name}: ${error}`)
          }
        }
      }
    },
    [processFile],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      handleFileUpload(e.dataTransfer.files)
    },
    [handleFileUpload],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFileUpload(e.target.files)
      }
    },
    [handleFileUpload],
  )

  const downloadFile = useCallback((file: UploadedFile) => {
    const worksheet = XLSX.utils.json_to_sheet(file.data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data")
    XLSX.writeFile(workbook, `${file.name.replace(/\.[^/.]+$/, "")}_processed.xlsx`)
  }, [])

  const deleteFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => {
      const updatedFiles = prev.filter((f) => f.id !== fileId)
      return updatedFiles
    })
  }, [])

  const viewFile = useCallback((file: UploadedFile) => {
    setSelectedFile(file)
    setShowPreview(true)
  }, [])

  const downloadAllData = () => {
    if (uploadedFiles.length === 0) {
      alert("No data available to download")
      return
    }

    // Combine all data from all files
    const allData: any[] = []
    uploadedFiles.forEach((file) => {
      allData.push(...file.data)
    })

    if (allData.length === 0) {
      alert("No data available to download")
      return
    }

    const headers = Object.keys(allData[0])
    const csvContent = [
      headers.join(","),
      ...allData.map((row) => headers.map((header) => `"${String(row[header] || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `captured_data_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const downloadCostData = () => {
    if (editableCostData.length === 0) {
      alert("No cost data available to download")
      return
    }

    const headers = Object.keys(editableCostData[0])
    const csvContent = [
      headers.join(","),
      ...editableCostData.map((row) =>
        headers.map((header) => `"${String(row[header] || "").replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cost_data_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const clearAllData = () => {
    if (confirm("Are you sure you want to clear all uploaded data? This action cannot be undone.")) {
      setUploadedFiles([])
      localStorage.removeItem("dataUploadFiles")
    }
  }

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>

    switch (status.toLowerCase()) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Approved</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</Badge>
      case "under review":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Under Review</Badge>
        )
      case "pending":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Pending</Badge>
      case "allocated":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Allocated</Badge>
        )
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Rejected</Badge>
      case "settled":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Settled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string | undefined) => {
    if (!status) return <AlertCircle className="h-4 w-4 text-gray-600" />

    switch (status.toLowerCase()) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "under review":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-blue-600" />
      case "allocated":
        return <CheckCircle className="h-4 w-4 text-purple-600" />
      case "rejected":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "settled":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getMatchStatusBadge = (status: string) => {
    switch (status) {
      case "Perfect Match":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Perfect Match
          </Badge>
        )
      case "Partial Match":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <Link className="h-3 w-3 mr-1" />
            Partial Match
          </Badge>
        )
      case "Captured Only":
        return (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            <Database className="h-3 w-3 mr-1" />
            Captured Only
          </Badge>
        )
      case "Cost Only":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            <DollarSign className="h-3 w-3 mr-1" />
            Cost Only
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <Unlink className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        )
    }
  }

  const getRecordTypeBadge = (recordType: string) => {
    switch (recordType) {
      case "matched":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <Link className="h-3 w-3 mr-1" />
            Matched
          </Badge>
        )
      case "captured_only":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <Database className="h-3 w-3 mr-1" />
            Captured Only
          </Badge>
        )
      case "cost_only":
        return (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            <DollarSign className="h-3 w-3 mr-1" />
            Cost Only
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <Unlink className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        )
    }
  }

  const formatCurrency = (amount: string | undefined, currency: string | undefined) => {
    if (!amount || !currency) return "N/A"

    const numAmount = Number.parseFloat(amount)
    if (isNaN(numAmount)) return amount
    return `${currency} ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString || dateString === "########") return "Invalid Date"

    try {
      const date = new Date(dateString)
      return date.toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const safeParseFloat = (value: string | undefined): number => {
    if (!value) return 0
    const parsed = Number.parseFloat(value)
    return isNaN(parsed) ? 0 : parsed
  }

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case "captured":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Captured</Badge>
      case "cost":
        return (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Cost Data</Badge>
        )
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  // Calculate cost data statistics
  const costStats = {
    totalRecords: editableCostData.length,
    approvedCount: editableCostData.filter((item) => item.ExpenseApprovalStatus?.toLowerCase() === "approved").length,
    rejectedCount: editableCostData.filter((item) => item.ExpenseApprovalStatus?.toLowerCase() === "rejected").length,
    failedCount: editableCostData.filter((item) => item.CostAllocationStatus?.toLowerCase() === "failed").length,
    allocatedCount: editableCostData.filter((item) => item.CostAllocationStatus?.toLowerCase() === "allocated").length,
    totalCommission: editableCostData.reduce((sum, item) => sum + safeParseFloat(item.CommissionAmount), 0),
    totalBrokerage: editableCostData.reduce((sum, item) => sum + safeParseFloat(item.BrokerageFee), 0),
  }

  // Get total rows across all files
  const totalRows = uploadedFiles.reduce((sum, file) => sum + file.rows, 0)

  // Calculate unified statistics
  const unifiedStats = {
    totalRecords: unifiedRecords.length,
    perfectMatches: unifiedRecords.filter((r) => r._MatchStatus === "Perfect Match").length,
    partialMatches: unifiedRecords.filter((r) => r._MatchStatus === "Partial Match").length,
    capturedOnly: unifiedRecords.filter((r) => r._MatchStatus === "Captured Only").length,
    costOnly: unifiedRecords.filter((r) => r._MatchStatus === "Cost Only").length,
  }

  // Get combined data statistics
  const { data: combinedData } = getCombinedData()
  const combinedStats = {
    totalRecords: combinedData.length,
    capturedRecords:
      combineMode === "matched"
        ? matchRecords().filter((r) => r.capturedData).length
        : combinedData.filter((item) => item._sourceType === "captured").length,
    costRecords:
      combineMode === "matched"
        ? matchRecords().filter((r) => r.costData).length
        : combinedData.filter((item) => item._sourceType === "cost").length,
    matchedRecords: combineMode === "matched" ? matchRecords().filter((r) => r.recordType === "matched").length : 0,
  }

  // Get captured headers for display
  const capturedHeaders = uploadedFiles.length > 0 ? uploadedFiles[0].headers : []
  const costHeaders = Object.keys(editableCostData[0] || {})

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-black rounded-xl">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Captured from CMS</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Upload, manage and process data from Content Management System
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-2xl font-bold text-black dark:text-white">
                  {activeTab === "captured"
                    ? totalRows
                    : activeTab === "cost-data"
                      ? costStats.totalRecords
                      : activeTab === "forward"
                        ? unifiedStats.totalRecords
                        : activeTab === "onedrive"
                          ? uploadedFiles.length
                          : uploadedFiles.length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {activeTab === "captured"
                    ? "Total Records"
                    : activeTab === "cost-data"
                      ? "Cost Records"
                      : activeTab === "forward"
                        ? "Unified Records"
                        : activeTab === "onedrive"
                          ? "Cloud Files"
                          : "Files Uploaded"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="data-upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Data Upload
            </TabsTrigger>
            <TabsTrigger value="captured" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Captured
            </TabsTrigger>
            <TabsTrigger value="cost-data" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cost Data
            </TabsTrigger>
            <TabsTrigger value="forward" className="flex items-center gap-2">
              <Merge className="h-4 w-4" />
              Unified Data
            </TabsTrigger>
            <TabsTrigger value="onedrive" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              OneDrive
            </TabsTrigger>
          </TabsList>

          {/* Data Upload Tab - File upload functionality */}
          <TabsContent value="data-upload" className="mt-6">
            {/* Upload Area */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Upload Data Files</CardTitle>
                <CardDescription>Drag and drop CSV or Excel files here, or click to browse</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragOver
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Drop files here or click to upload
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Supports CSV and Excel (.xlsx) files</p>
                  <input
                    type="file"
                    multiple
                    accept=".csv,.xlsx"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button asChild>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      Browse Files
                    </label>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Files Table */}
            {uploadedFiles.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Uploaded Files</CardTitle>
                    <CardDescription>Manage your uploaded data files</CardDescription>
                  </div>
                  <Button variant="destructive" onClick={clearAllData}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Data
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                            File Name
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Type</th>
                          <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                            Upload Date
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Rows</th>
                          <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                            Columns
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {uploadedFiles.map((file) => (
                          <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="p-3">
                              <div className="flex items-center space-x-2">
                                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                <span className="text-gray-900 dark:text-gray-100 font-medium">{file.name}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant={file.type === "csv" ? "secondary" : "default"}>
                                {file.type.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-3 text-gray-900 dark:text-gray-100 text-sm">{file.uploadDate}</td>
                            <td className="p-3 text-gray-900 dark:text-gray-100 text-sm">
                              {file.rows.toLocaleString()}
                            </td>
                            <td className="p-3 text-gray-900 dark:text-gray-100 text-sm">{file.columns}</td>
                            <td className="p-3">
                              <div className="flex items-center space-x-2">
                                <Button size="sm" variant="outline" onClick={() => viewFile(file)}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => downloadFile(file)}>
                                  <Download className="h-4 w-4 mr-1" />
                                  Download
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteFile(file.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Captured Data Tab */}
          <TabsContent value="captured" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Files</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{uploadedFiles.length}</p>
                    </div>
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Records</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalRows.toLocaleString()}</p>
                    </div>
                    <Database className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Columns</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {uploadedFiles.length > 0
                          ? Math.round(
                              uploadedFiles.reduce((sum, file) => sum + file.columns, 0) / uploadedFiles.length,
                            )
                          : 0}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Data Size</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {(totalRows * 0.5).toFixed(1)} KB
                      </p>
                    </div>
                    <HardDrive className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {uploadedFiles.length > 0 ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Captured Data Overview</CardTitle>
                    <CardDescription>Data captured from uploaded files</CardDescription>
                  </div>
                  <Button onClick={downloadAllData}>
                    <Download className="h-4 w-4 mr-2" />
                    Download All Data
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <FileSpreadsheet className="h-5 w-5 text-green-600" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{file.name}</h3>
                            <Badge variant={file.type === "csv" ? "secondary" : "default"}>
                              {file.type.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {file.rows} rows × {file.columns} columns
                          </div>
                        </div>

                        {/* Sample data preview */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                {file.headers.slice(0, 6).map((header, index) => (
                                  <th
                                    key={index}
                                    className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300"
                                  >
                                    {header}
                                  </th>
                                ))}
                                {file.headers.length > 6 && (
                                  <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                    ...
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {file.data.slice(0, 3).map((row, rowIndex) => (
                                <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                  {file.headers.slice(0, 6).map((header, colIndex) => (
                                    <td key={colIndex} className="p-2 text-gray-900 dark:text-gray-100">
                                      {String(row[header] || "").substring(0, 50)}
                                      {String(row[header] || "").length > 50 ? "..." : ""}
                                    </td>
                                  ))}
                                  {file.headers.length > 6 && (
                                    <td className="p-2 text-gray-500 dark:text-gray-400">...</td>
                                  )}
                                </tr>
                              ))}
                              {file.data.length > 3 && (
                                <tr>
                                  <td
                                    colSpan={Math.min(file.headers.length, 7)}
                                    className="p-2 text-center text-gray-500 dark:text-gray-400 italic"
                                  >
                                    ... and {file.data.length - 3} more rows
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Data Captured</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Upload files in the Data Upload tab to see captured data here.
                  </p>
                  <Button onClick={() => setActiveTab("data-upload")}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Cost Data Tab */}
          <TabsContent value="cost-data" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Records</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{costStats.totalRecords}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved</p>
                      <p className="text-2xl font-bold text-green-600">{costStats.approvedCount}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</p>
                      <p className="text-2xl font-bold text-red-600">{costStats.failedCount}</p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Commission</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${costStats.totalCommission.toLocaleString()}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Cost Management Data</CardTitle>
                  <CardDescription>
                    Cost allocation and expense approval data from the management system
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {hasUnsavedChanges && (
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" onClick={cancelChanges}>
                        Cancel
                      </Button>
                      <Button onClick={saveChanges}>Save Changes</Button>
                    </div>
                  )}
                  <Button variant="outline" onClick={resetToOriginal}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button onClick={downloadCostData}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCostData ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Loading cost data...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Trade ID
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            FX Gain/Loss
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            P&L Calculated
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Cost Status
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Approval Status
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Booked Date
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Commission
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Brokerage
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {editableCostData.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="p-3">
                              <EditableCell value={item.TradeID} rowIndex={index} field="TradeID" />
                            </td>
                            <td className="p-3">
                              <EditableCell
                                value={item.FXGainLoss}
                                rowIndex={index}
                                field="FXGainLoss"
                                type="number"
                                className={safeParseFloat(item.FXGainLoss) < 0 ? "text-red-600" : "text-green-600"}
                              />
                            </td>
                            <td className="p-3">
                              <EditableCell
                                value={item.PnlCalculated}
                                rowIndex={index}
                                field="PnlCalculated"
                                type="number"
                                className={safeParseFloat(item.PnlCalculated) < 0 ? "text-red-600" : "text-green-600"}
                              />
                            </td>
                            <td className="p-3">
                              <StatusDropdown
                                value={item.CostAllocationStatus}
                                rowIndex={index}
                                field="CostAllocationStatus"
                                options={["Failed", "Allocated", "Pending"]}
                              />
                            </td>
                            <td className="p-3">
                              <StatusDropdown
                                value={item.ExpenseApprovalStatus}
                                rowIndex={index}
                                field="ExpenseApprovalStatus"
                                options={["Rejected", "Under Review", "Approved"]}
                              />
                            </td>
                            <td className="p-3">
                              <EditableCell
                                value={formatDate(item.CostBookedDate)}
                                rowIndex={index}
                                field="CostBookedDate"
                                type="date"
                              />
                            </td>
                            <td className="p-3">
                              <div className="text-right">
                                {formatCurrency(item.CommissionAmount, item.CommissionCurrency)}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="text-right">
                                {formatCurrency(item.BrokerageFee, item.BrokerageCurrency)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Unified Data Tab */}
          <TabsContent value="forward" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Records</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{unifiedStats.totalRecords}</p>
                    </div>
                    <Merge className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Perfect Matches</p>
                      <p className="text-2xl font-bold text-green-600">{unifiedStats.perfectMatches}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Partial Matches</p>
                      <p className="text-2xl font-bold text-blue-600">{unifiedStats.partialMatches}</p>
                    </div>
                    <Link className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unmatched</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {unifiedStats.capturedOnly + unifiedStats.costOnly}
                      </p>
                    </div>
                    <Unlink className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Unified Trade Data</CardTitle>
                  <CardDescription>
                    Matched and unified data from captured files and cost management system
                  </CardDescription>
                </div>
                <Button onClick={downloadUnifiedCSV} disabled={unifiedRecords.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Unified CSV
                </Button>
              </CardHeader>
              <CardContent>
                {unifiedRecords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Match Status
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Trade ID
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Match Score
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Commission
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Brokerage
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Cost Status
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                            Approval Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {unifiedRecords.slice(0, 50).map((record, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="p-3">{getMatchStatusBadge(record._MatchStatus)}</td>
                            <td className="p-3 font-mono text-gray-900 dark:text-gray-100">{record._TradeID}</td>
                            <td className="p-3">
                              <div className="flex items-center space-x-2">
                                <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      record._MatchScore >= 0.8
                                        ? "bg-green-500"
                                        : record._MatchScore >= 0.5
                                          ? "bg-yellow-500"
                                          : "bg-red-500"
                                    }`}
                                    style={{ width: `${record._MatchScore * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {(record._MatchScore * 100).toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              {formatCurrency(record.Cost_CommissionAmount, record.Cost_CommissionCurrency)}
                            </td>
                            <td className="p-3 text-right">
                              {formatCurrency(record.Cost_BrokerageFee, record.Cost_BrokerageCurrency)}
                            </td>
                            <td className="p-3">{getStatusBadge(record.Cost_CostAllocationStatus)}</td>
                            <td className="p-3">{getStatusBadge(record.Cost_ExpenseApprovalStatus)}</td>
                          </tr>
                        ))}
                        {unifiedRecords.length > 50 && (
                          <tr>
                            <td colSpan={7} className="p-3 text-center text-gray-500 dark:text-gray-400 italic">
                              ... and {unifiedRecords.length - 50} more records (download CSV for complete data)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Merge className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Unified Data</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Upload captured data and ensure cost data is loaded to see unified results.
                    </p>
                    <div className="flex justify-center space-x-4">
                      <Button variant="outline" onClick={() => setActiveTab("data-upload")}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Data
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab("cost-data")}>
                        <DollarSign className="h-4 w-4 mr-2" />
                        View Cost Data
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* OneDrive Tab */}
          <TabsContent value="onedrive" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  OneDrive Integration
                </CardTitle>
                <CardDescription>Connect to OneDrive to access your files</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Button
                    onClick={() => window.open("https://onedrive.live.com/", "_blank", "noopener,noreferrer")}
                    size="lg"
                  >
                    <Cloud className="h-4 w-4 mr-2" />
                    Open OneDrive
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* File Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>File Preview: {selectedFile?.name}</DialogTitle>
            <DialogDescription>
              Showing {selectedFile?.rows} rows and {selectedFile?.columns} columns
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            {selectedFile && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    {selectedFile.headers.map((header, index) => (
                      <th
                        key={index}
                        className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 border-b"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedFile.data.slice(0, 100).map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      {selectedFile.headers.map((header, colIndex) => (
                        <td key={colIndex} className="p-2 text-gray-900 dark:text-gray-100 border-b">
                          {String(row[header] || "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {selectedFile.data.length > 100 && (
                    <tr>
                      <td
                        colSpan={selectedFile.headers.length}
                        className="p-4 text-center text-gray-500 dark:text-gray-400 italic"
                      >
                        ... and {selectedFile.data.length - 100} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
