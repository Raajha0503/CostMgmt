"use client"

import type React from "react"

import { useState, useCallback } from "react"
import {
  Upload,
  AlertCircle,
  CheckCircle,
  Download,
  RefreshCw,
  Settings,
  BarChart3,
  FileText,
  Target,
  X,
  Check,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Menu,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import { useInterestClaimsFirebase } from "@/hooks/use-interest-claims-firebase"
import { interestClaimsOperations } from "@/lib/firebase-operations"

// Types for Interest Claims data
interface InterestClaimData {
  id: string
  claimId: string
  accountNumber: string
  clientName: string
  currency: string
  principalAmount: number
  interestRate: number
  startDate: string
  endDate: string
  daysCount: number
  calculatedInterest: number
  claimStatus: "pending" | "approved" | "rejected" | "paid"
  submissionDate: string
  approvalDate?: string
  paymentDate?: string
  notes?: string
  // Additional fields that might be mapped from uploaded data
  [key: string]: any
}

interface FieldMapping {
  [key: string]: string
}

interface UploadAnalysis {
  headers: string[]
  rowCount: number
  sampleData: any[]
  detectedFieldTypes: Record<string, string>
}

// Predefined field definitions for Interest Claims (all optional now)
const INTEREST_CLAIMS_FIELDS = [
  {
    key: "claimId",
    label: "Claim ID",
    required: false,
    type: "text",
    description: "Unique identifier for the interest claim",
  },
  {
    key: "accountNumber",
    label: "Account Number",
    required: false,
    type: "text",
    description: "Client account number",
  },
  { key: "clientName", label: "Client Name", required: false, type: "text", description: "Name of the client" },
  {
    key: "currency",
    label: "Currency",
    required: false,
    type: "text",
    description: "Currency code (USD, EUR, GBP, etc.)",
  },
  {
    key: "principalAmount",
    label: "Principal Amount",
    required: false,
    type: "number",
    description: "Principal amount for interest calculation",
  },
  {
    key: "interestRate",
    label: "Interest Rate",
    required: false,
    type: "number",
    description: "Interest rate (as percentage or decimal)",
  },
  {
    key: "startDate",
    label: "Start Date",
    required: false,
    type: "date",
    description: "Interest calculation start date",
  },
  { key: "endDate", label: "End Date", required: false, type: "date", description: "Interest calculation end date" },
  {
    key: "daysCount",
    label: "Days Count",
    required: false,
    type: "number",
    description: "Number of days for calculation",
  },
  {
    key: "calculatedInterest",
    label: "Calculated Interest",
    required: false,
    type: "number",
    description: "Calculated interest amount",
  },
  {
    key: "claimStatus",
    label: "Claim Status",
    required: false,
    type: "text",
    description: "Status of the claim (pending, approved, rejected, paid)",
  },
  {
    key: "submissionDate",
    label: "Submission Date",
    required: false,
    type: "date",
    description: "Date when claim was submitted",
  },
  {
    key: "approvalDate",
    label: "Approval Date",
    required: false,
    type: "date",
    description: "Date when claim was approved",
  },
  {
    key: "paymentDate",
    label: "Payment Date",
    required: false,
    type: "date",
    description: "Date when payment was made",
  },
  { key: "notes", label: "Notes", required: false, type: "text", description: "Additional notes or comments" },
  {
    key: "contractReference",
    label: "Contract Reference",
    required: false,
    type: "text",
    description: "Reference to underlying contract",
  },
  {
    key: "businessUnit",
    label: "Business Unit",
    required: false,
    type: "text",
    description: "Business unit or department",
  },
  { key: "region", label: "Region", required: false, type: "text", description: "Geographic region" },
  {
    key: "productType",
    label: "Product Type",
    required: false,
    type: "text",
    description: "Type of financial product product",
  },
  {
    key: "riskRating",
    label: "Risk Rating",
    required: false,
    type: "text",
    description: "Risk rating of the client or transaction",
  },
]

export default function InterestClaims() {
  // All hooks (useState, useCallback, etc.) must be at the top level of the InterestClaims component, before any logic or return statements. Move any that are inside functions, conditionals, or case blocks to the top level. Review the entire file for compliance.
  const [activeTab, setActiveTab] = useState("data-upload")
  const [uploadedData, setUploadedData] = useState<any[]>([])
  const [processedClaims, setProcessedClaims] = useState<InterestClaimData[]>([])
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({})
  const [uploadStep, setUploadStep] = useState<"upload" | "analyze" | "map" | "complete">("upload")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadAnalysis, setUploadAnalysis] = useState<UploadAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage] = useState(50)
  const [claimsSubTab, setClaimsSubTab] = useState("claim-receipt")
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [claimReceiptFilter, setClaimReceiptFilter] = useState<"all" | "eligible" | "watchlist">("all")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [expectedPnlValue, setExpectedPnlValue] = useState<number>(0)
  const [claimRemarks, setClaimRemarks] = useState<{ [key: string]: string }>({})
  const [selectedClaimTypeReason, setSelectedClaimTypeReason] = useState<{ [key: string]: boolean }>({})
  const [issuanceSubTab, setIssuanceSubTab] = useState("receivable-claims")

  const [dataType, setDataType] = useState<'equity' | 'fx' | null>(null)
  const [editedData, setEditedData] = useState<{ [key: string]: any }>({})
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null)
  const [savingData, setSavingData] = useState(false)
  const [settlementSubTab, setSettlementSubTab] = useState("receivable-claims")
  const { interestClaimsData, loadInterestClaimsByType, loading: firebaseLoading, createInterestClaim } = useInterestClaimsFirebase()

  // Handle cell editing
  const handleCellEdit = (rowIndex: number, field: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [`${rowIndex}-${field}`]: value
    }))
  }

  // Handle cell click to start editing
  const handleCellClick = (rowIndex: number, field: string) => {
    setEditingCell({ rowIndex, field })
  }

  // Handle cell blur to stop editing
  const handleCellBlur = () => {
    setEditingCell(null)
  }

  // Save edited data to Firebase
  const handleSaveData = async () => {
    if (Object.keys(editedData).length === 0) {
      alert("No changes to save")
      return
    }

    setSavingData(true)
    try {
      const { tradeOperations } = await import("@/lib/firebase-operations")
      
      // Group edits by row index
      const rowEdits: { [key: string]: any } = {}
      Object.entries(editedData).forEach(([key, value]) => {
        const [rowIndex, field] = key.split('-')
        if (!rowEdits[rowIndex]) {
          rowEdits[rowIndex] = {}
        }
        rowEdits[rowIndex][field] = value
      })

      // Check if we have Firebase data (with IDs) or uploaded file data
      const hasFirebaseIds = uploadedData.length > 0 && uploadedData[0].id && typeof uploadedData[0].id === 'string' && uploadedData[0].id.length > 10

      if (hasFirebaseIds) {
        // Update existing Firebase records
        for (const [rowIndex, updates] of Object.entries(rowEdits)) {
          const row = uploadedData[parseInt(rowIndex)]
          if (row && row.id) {
            await tradeOperations.updateTrade(row.id, updates)
          }
        }

        // Refresh data from Firebase
        if (dataType) {
          let data
          if (dataType === "fx") {
            data = await tradeOperations.getAllTrades()
          } else {
            data = await interestClaimsOperations.getInterestClaimsByType(dataType)
          }
          
          const convertedData = data.map((item: any) => {
            const converted: any = {}
            for (const [key, value] of Object.entries(item)) {
              if (
                value &&
                typeof value === 'object' &&
                value !== null &&
                'seconds' in value &&
                'nanoseconds' in value &&
                typeof (value as any).seconds === 'number' &&
                typeof (value as any).nanoseconds === 'number'
              ) {
                converted[key] = new Date((value as any).seconds * 1000).toISOString()
              } else if (value && typeof value === 'object') {
                converted[key] = JSON.stringify(value)
              } else {
                converted[key] = value
              }
            }
            return converted
          })
          
          setUploadedData(convertedData)
          setProcessedClaims(convertedData)
        }
      } else {
        // Update local uploaded data (for file uploads)
        const updatedData = [...uploadedData]
        for (const [rowIndex, updates] of Object.entries(rowEdits)) {
          const index = parseInt(rowIndex)
          if (updatedData[index]) {
            updatedData[index] = { ...updatedData[index], ...updates }
          }
        }
        setUploadedData(updatedData)
        setProcessedClaims(updatedData)
      }

      setEditedData({})
      alert("Data saved successfully!")
    } catch (error) {
      console.error("Error saving data:", error)
      alert(`Error saving data: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSavingData(false)
    }
  }
  const [selectedClaimType, setSelectedClaimType] = useState<'receivable' | 'payable'>('receivable');
  const [settlementStatuses, setSettlementStatuses] = useState<{[key: string]: string}>({});
  const [settlementDates, setSettlementDates] = useState<{[key: string]: string}>({});
  const [settlementAmounts, setSettlementAmounts] = useState<{[key: string]: number}>({});

  // Sidebar items for Interest Claims
  const sidebarItems = [
    { id: "data-upload", label: "Data Upload", icon: Upload },
    { id: "claims-management", label: "Claims Management", icon: FileText },
  ]

  // Auto-detect field types based on content
  const detectFieldType = (values: any[]): string => {
    const nonEmptyValues = values.filter((v) => v !== null && v !== undefined && v !== "")
    if (nonEmptyValues.length === 0) return "text"

    // Check for dates
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{2}-\d{2}-\d{4}$/,
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    ]

    const isDate = nonEmptyValues.some(
      (v) => datePatterns.some((pattern) => pattern.test(String(v))) || !isNaN(Date.parse(String(v))),
    )
    if (isDate) return "date"

    // Check for numbers
    const isNumber = nonEmptyValues.every((v) => !isNaN(Number(v)) && isFinite(Number(v)))
    if (isNumber) return "number"

    return "text"
  }

  // Create automatic field mapping based on header similarity
  const createAutoMapping = (headers: string[]): FieldMapping => {
    const mapping: FieldMapping = {}

    headers.forEach((header) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "")

      // Find the best matching field
      let bestMatch = ""
      let bestScore = 0

      INTEREST_CLAIMS_FIELDS.forEach((field) => {
        const normalizedFieldLabel = field.label.toLowerCase().replace(/[^a-z0-9]/g, "")
        const normalizedFieldKey = field.key.toLowerCase()

        // Calculate similarity score
        let score = 0

        // Exact match gets highest score
        if (normalizedHeader === normalizedFieldLabel || normalizedHeader === normalizedFieldKey) {
          score = 100
        }
        // Partial match
        else if (normalizedHeader.includes(normalizedFieldLabel) || normalizedFieldLabel.includes(normalizedHeader)) {
          score = 80
        }
        // Keyword matching for common variations
        else {
          const keywords = {
            claimId: ["claim", "id", "claimid", "claimnumber"],
            accountNumber: ["account", "accountno", "accountnumber", "acct"],
            clientName: ["client", "name", "clientname", "customer"],
            currency: ["currency", "ccy", "curr"],
            principalAmount: ["principal", "amount", "balance", "principalamount"],
            interestRate: ["rate", "interest", "interestrate", "percentage"],
            startDate: ["start", "from", "startdate", "fromdate"],
            endDate: ["end", "to", "enddate", "todate"],
            daysCount: ["days", "period", "duration", "dayscount"],
            calculatedInterest: ["interest", "calculated", "calculatedinterest", "interestamount"],
            claimStatus: ["status", "state", "claimstatus"],
            submissionDate: ["submission", "submitted", "submissiondate"],
            approvalDate: ["approval", "approved", "approvaldate"],
            paymentDate: ["payment", "paid", "paymentdate"],
            notes: ["notes", "comments", "remarks"],
          }

          const fieldKeywords = keywords[field.key as keyof typeof keywords] || []
          if (fieldKeywords.some((keyword) => normalizedHeader.includes(keyword))) {
            score = 60
          }
        }

        if (score > bestScore) {
          bestScore = score
          bestMatch = field.key
        }
      })

      // Only map if we have a reasonable confidence
      if (bestScore >= 60) {
        mapping[bestMatch] = header
      }
    })

    return mapping
  }

  // Enhanced field mapping specifically for Claim Settlement table fields
  const createSettlementFieldMapping = (headers: string[]): FieldMapping => {
    const settlementMapping: FieldMapping = {}
    
    headers.forEach((header) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "")
      
      // Settlement-specific field mappings
      const settlementFields = {
        // Claim ID variations
        claimId: ["claimid", "claim_id", "claim", "id", "claimnumber", "claim_number"],
        // Claim Type variations  
        claimType: ["claimtype", "claim_type", "type", "classification"],
        // Cost Booked Date variations
        costBookedDate: ["costbookeddate", "cost_booked_date", "costbooked", "cost_booked", "bookeddate", "booked_date"],
        // Settlement Currency variations
        settlementCurrency: ["settlementcurrency", "settlement_currency", "settlementccy", "settlement_ccy", "currency"],
        // Net Amount variations
        netAmount: ["netamount", "net_amount", "amount", "net", "settlementamount", "settlement_amount"],
        // Settlement Status variations
        settlementStatus: ["settlementstatus", "settlement_status", "status", "settlementstate", "settlement_state"],
        // Settlement Method variations
        settlementMethod: ["settlementmethod", "settlement_method", "method", "settlementtype", "settlement_type"],
        // Settlement Date variations
        settlementDate: ["settlementdate", "settlement_date", "date", "settleddate", "settled_date"],
        // Comments variations
        comments: ["comments", "remarks", "notes", "description", "comment"],
        // Additional fields for claim classification
        pnlCalculated: ["pnlcalculated", "pnl_calculated", "pnl", "profitloss", "profit_loss", "calculatedpnl", "calculated_pnl"],
        confirmationStatus: ["confirmationstatus", "confirmation_status", "confirmstatus", "confirm_status", "confirmation"],
        expenseApprovalStatus: ["expenseapprovalstatus", "expense_approval_status", "expenseapproval", "expense_approval", "approvalstatus", "approval_status"],
        costAllocationStatus: ["costallocationstatus", "cost_allocation_status", "costallocation", "cost_allocation", "allocationstatus", "allocation_status"]
      }

      Object.entries(settlementFields).forEach(([fieldKey, variations]) => {
        if (variations.some(variation => normalizedHeader.includes(variation))) {
          settlementMapping[fieldKey] = header
        }
      })
    })

    return settlementMapping
  }

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)

    try {
      const reader = new FileReader()

      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result
          if (!arrayBuffer) {
            throw new Error("Failed to read file")
          }

          let data: any[] = []

          if (file.name.toLowerCase().endsWith(".csv")) {
            // Handle CSV files
            const text = new TextDecoder().decode(arrayBuffer as ArrayBuffer)
            data = parseCSV(text)
          } else {
            // Handle Excel files
            const workbook = XLSX.read(new Uint8Array(arrayBuffer as ArrayBuffer), { type: "array" })
            const firstSheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[firstSheetName]
            data = XLSX.utils.sheet_to_json(worksheet)
          }

          if (data.length === 0) {
            throw new Error("No data found in the uploaded file")
          }

          // Analyze the data
          const headers = Object.keys(data[0])
          const sampleData = data.slice(0, 5)

          // Detect field types
          const detectedFieldTypes: Record<string, string> = {}
          headers.forEach((header) => {
            const columnValues = data.map((row) => row[header])
            detectedFieldTypes[header] = detectFieldType(columnValues)
          })

          const analysis: UploadAnalysis = {
            headers,
            rowCount: data.length,
            sampleData,
            detectedFieldTypes,
          }

          setUploadedFile(file)
          setUploadedData(data)
          setUploadAnalysis(analysis)

          // Set first 8 columns as visible by default
          setVisibleColumns(headers.slice(0, 8))

          // Create automatic mapping
          const autoMapping = createAutoMapping(headers)
          setFieldMapping(autoMapping)

          setUploadStep("analyze")
        } catch (error) {
          console.error("Error processing file:", error)
          setError(`Error processing file: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
          setLoading(false)
        }
      }

      reader.onerror = () => {
        setError("Error reading the file. Please try again.")
        setLoading(false)
      }

      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error("Error handling file upload:", error)
      setError(`Error uploading file: ${error instanceof Error ? error.message : String(error)}`)
      setLoading(false)
    }
  }, [])

  // Parse CSV text into JSON
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split("\n").filter((line) => line.trim())
    if (lines.length === 0) return []

    const headers = parseCSVRow(lines[0])
    const data: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVRow(lines[i])
      const row: any = {}

      headers.forEach((header, index) => {
        row[header] = values[index] || ""
      })

      data.push(row)
    }

    return data
  }

  // Parse CSV row handling quoted values
  const parseCSVRow = (row: string): string[] => {
    const values: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < row.length; i++) {
      const char = row[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        values.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }

    values.push(current.trim())
    return values.map((v) => v.replace(/^"|"$/g, ""))
  }

  // Handle drag and drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0]
        if (isValidFileType(file)) {
          handleFileUpload(file)
        } else {
          setError("Please upload an Excel (.xlsx, .xls) or CSV (.csv) file")
        }
      }
    },
    [handleFileUpload],
  )

  // Handle file selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && isValidFileType(file)) {
        handleFileUpload(file)
      } else if (file) {
        setError("Please upload an Excel (.xlsx, .xls) or CSV (.csv) file")
      }
    },
    [handleFileUpload],
  )

  // Validate file type
  const isValidFileType = (file: File): boolean => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
    ]

    const validExtensions = [".xlsx", ".xls", ".csv"]

    return validTypes.includes(file.type) || validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
  }

  // Handle field mapping
  const handleFieldMapping = (fieldKey: string, columnName: string) => {
    setFieldMapping((prev) => ({
      ...prev,
      [fieldKey]: columnName === "__none__" ? "" : columnName,
    }))
  }

  // Auto-map fields
  const autoMapFields = () => {
    if (!uploadAnalysis) return

    const autoMapping = createAutoMapping(uploadAnalysis.headers)
    const settlementMapping = createSettlementFieldMapping(uploadAnalysis.headers)
    
    // Merge both mappings, with settlement mapping taking precedence for overlapping fields
    const mergedMapping = { ...autoMapping, ...settlementMapping }
    setFieldMapping(mergedMapping)
  }

  // Clear field mapping
  const clearFieldMapping = () => {
    setFieldMapping({})
  }

  // Handle column visibility toggle
  const handleColumnVisibilityToggle = (columnName: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(columnName)) {
        return prev.filter((col) => col !== columnName)
      } else {
        // Check if we already have 8 columns selected
        if (prev.length >= 8) {
          return prev // Don't add more if we already have 8
        }
        return [...prev, columnName]
      }
    })
  }

  // Toggle all columns visibility
  const toggleAllColumns = () => {
    if (!uploadAnalysis) return

    if (visibleColumns.length === Math.min(8, uploadAnalysis.headers.length)) {
      setVisibleColumns([])
    } else {
      setVisibleColumns(uploadAnalysis.headers.slice(0, 8))
    }
  }

  // Check if we can process the data (now always true since no required fields)
  const canProcessData = (): boolean => {
    return uploadedData.length > 0
  }

  // Get mapping status
  const getMappingStatus = () => {
    const totalFields = INTEREST_CLAIMS_FIELDS.length
    const mappedFields = Object.keys(fieldMapping).filter((key) => fieldMapping[key]).length
    const requiredFields = INTEREST_CLAIMS_FIELDS.filter((f) => f.required)
    const mappedRequiredFields = requiredFields.filter((f) => fieldMapping[f.key]).length

    return {
      total: totalFields,
      mapped: mappedFields,
      required: requiredFields.length,
      mappedRequired: mappedRequiredFields,
      canProcess: true, // Always true now since no required fields
    }
  }

  // Process the uploaded data
  const processData = async () => {
    if (!uploadedData.length) {
      setError("No data to process.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const processedData: InterestClaimData[] = uploadedData.map((row, index) => {
        const claim: any = {
          id: `claim_${Date.now()}_${index}`,
        }

        // Map fields based on field mapping
        Object.entries(fieldMapping).forEach(([fieldKey, columnName]) => {
          if (columnName && row[columnName] !== undefined) {
            let value = row[columnName]

            // Type conversion based on field type
            const fieldDef = INTEREST_CLAIMS_FIELDS.find((f) => f.key === fieldKey)
            if (fieldDef) {
              switch (fieldDef.type) {
                case "number":
                  value = Number.parseFloat(value) || 0
                  break
                case "date":
                  // Try to parse date
                  const parsedDate = new Date(value)
                  value = isNaN(parsedDate.getTime()) ? value : parsedDate.toISOString().split("T")[0]
                  break
                default:
                  value = String(value)
              }
            }

            claim[fieldKey] = value
          }
        })

        // Set default values for unmapped fields
        if (!claim.claimStatus) claim.claimStatus = "pending"
        if (!claim.submissionDate) claim.submissionDate = new Date().toISOString().split("T")[0]

        // Calculate interest if not provided
        if (!claim.calculatedInterest && claim.principalAmount && claim.interestRate && claim.daysCount) {
          claim.calculatedInterest = (claim.principalAmount * claim.interestRate * claim.daysCount) / 365 / 100
        }

        return claim as InterestClaimData
      })

      // Save to Firestore in the correct subcollection
      if (dataType) {
        for (const claim of processedData) {
          await createInterestClaim(claim, dataType)
        }
      }

      setProcessedClaims(processedData)
      setUploadStep("complete")
    } catch (error) {
      console.error("Error processing data:", error)
      setError(`Error processing data: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  // Download template
  const downloadTemplate = () => {
    const templateData = [
      {
        "Claim ID": "CLM001",
        "Account Number": "ACC123456",
        "Client Name": "ABC Corporation",
        Currency: "USD",
        "Principal Amount": 1000000,
        "Interest Rate": 2.5,
        "Start Date": "2024-01-01",
        "End Date": "2024-03-31",
        "Days Count": 90,
        "Calculated Interest": 6164.38,
        "Claim Status": "pending",
        "Submission Date": "2024-04-01",
        Notes: "Quarterly interest claim",
        "Contract Reference": "CONTRACT-2024-001",
        "Business Unit": "Fixed Income",
        Region: "North America",
        "Product Type": "Cash Management",
        "Risk Rating": "A+",
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Interest Claims Template")
    XLSX.writeFile(wb, "interest_claims_template.xlsx")
  }

  // Render upload step
  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* Data Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Data Type Selection
        </label>
        <div className="flex space-x-4">
          <button
            onClick={() => setDataType("equity")}
            className={`flex items-center px-4 py-2 rounded-lg border-2 transition-colors ${
              dataType === "equity"
                ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 hover:border-teal-300"
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Equity Claims
          </button>
          <button
            onClick={() => setDataType("fx")}
            className={`flex items-center px-4 py-2 rounded-lg border-2 transition-colors ${
              dataType === "fx"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 hover:border-blue-300"
            }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            FX Claims
          </button>
        </div>
      </div>
      {/* Next Button with Info */}
      <div className="flex gap-2 items-center justify-start">
        <Button
          onClick={async () => {
            if (!dataType) {
              alert("Please select a data type first");
              return;
            }
            try {
              let data;
              if (dataType === "fx") {
                // Fetch all from unified_data for FX
                data = await import("@/lib/firebase-operations").then(mod => mod.tradeOperations.getAllTrades());
              } else {
                // Keep existing logic for equity
                data = await interestClaimsOperations.getInterestClaimsByType(dataType);
              }
              // Convert Firestore Timestamps to strings
              const convertedData = data.map((item: any) => {
                const converted: any = {};
                for (const [key, value] of Object.entries(item)) {
                  if (
                    value &&
                    typeof value === 'object' &&
                    value !== null &&
                    'seconds' in value &&
                    'nanoseconds' in value &&
                    typeof (value as any).seconds === 'number' &&
                    typeof (value as any).nanoseconds === 'number'
                  ) {
                    converted[key] = new Date((value as any).seconds * 1000).toISOString();
                  } else if (value && typeof value === 'object') {
                    converted[key] = JSON.stringify(value);
                  } else {
                    converted[key] = value;
                  }
                }
                return converted;
              });
              setUploadedData(convertedData);
              setProcessedClaims(convertedData);
              setUploadStep("complete");
            } catch (error) {
              console.error("Error loading data from Firebase:", error);
              alert(`Error loading data from Firebase: ${error instanceof Error ? error.message : String(error)}`);
            }
          }}
          disabled={!dataType || firebaseLoading}
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white px-6"
        >
          {firebaseLoading ? "Loading..." : "Next"}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            alert("📋 Data Availability Info:\n\n❌ Equity trades are currently not available\n✅ FX trades are available\n\n📖 Instructions:\n1. Click on 'FX Claims' button above\n2. Then click the 'Next' button to load and process FX trade data");
          }}
          className="shrink-0"
          title="Data availability information"
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>
      {/* File Upload Area */}
      <div
        className="border-2 border-dashed border-teal-300 rounded-lg p-8 text-center hover:border-teal-400 transition-colors cursor-pointer"
        style={{
          backgroundColor: "rgb(240 253 250)",
          borderColor: "rgb(153 246 228)",
        }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <Upload className="mx-auto h-12 w-12 text-teal-500" />
        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Drop files here or click to upload
            </span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">Supported formats: Excel (.xlsx, .xls), CSV (.csv)</p>
      </div>
      {/* Editable Data Table Preview after loading from Firebase */}
      {uploadedData.length > 0 && (
        <>
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold text-lg">Editable Data from Firebase</div>
              <div className="flex space-x-2">
                <Button
                  onClick={handleSaveData}
                  disabled={savingData || Object.keys(editedData).length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {savingData ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  onClick={() => setEditedData({})}
                  disabled={Object.keys(editedData).length === 0}
                  variant="outline"
                >
                  Discard Changes
                </Button>
              </div>
            </div>
            
            {Object.keys(editedData).length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="text-sm text-yellow-800">
                    {Object.keys(editedData).length} field(s) have been modified. Click "Save Changes" to update Firebase.
                  </span>
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {Object.keys(uploadedData[0]).map((header) => (
                      <th key={header} className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {uploadedData.slice(0, 10).map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      {Object.keys(uploadedData[0]).map((header) => {
                        const isEditing = editingCell?.rowIndex === rowIdx && editingCell?.field === header
                        const hasChanges = editedData[`${rowIdx}-${header}`] !== undefined
                        const currentValue = hasChanges ? editedData[`${rowIdx}-${header}`] : row[header]
                        
                        return (
                          <td 
                            key={header} 
                            className={`px-4 py-2 text-sm cursor-pointer ${
                              hasChanges 
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700' 
                                : 'text-gray-900 dark:text-gray-100'
                            }`}
                            onClick={() => handleCellClick(rowIdx, header)}
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={currentValue || ''}
                                onChange={(e) => handleCellEdit(rowIdx, header, e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCellBlur()
                                  }
                                  if (e.key === 'Escape') {
                                    setEditedData(prev => {
                                      const newData = { ...prev }
                                      delete newData[`${rowIdx}-${header}`]
                                      return newData
                                    })
                                    handleCellBlur()
                                  }
                                }}
                                className="w-full px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                            ) : (
                              <div className="truncate">
                                {currentValue !== null && currentValue !== undefined ? String(currentValue) : ''}
                              </div>
                            )}
                        </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
      </div>
            <div className="mt-2 text-xs text-gray-500">Showing up to 10 records. Click on any cell to edit. Press Enter to save or Escape to cancel.</div>
          </div>
        </>
      )}
    </div>
  )

  // Render analyze step with data table and column visibility controls
  const renderAnalyzeStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Analysis</CardTitle>
          <CardDescription>Analysis of uploaded file: {uploadedFile?.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {uploadAnalysis && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                  <div className="text-lg font-bold text-teal-600">{uploadAnalysis.rowCount}</div>
                  <div className="text-sm text-teal-700">Total Records</div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">{uploadAnalysis.headers.length}</div>
                  <div className="text-sm text-blue-700">Total Columns</div>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-lg font-bold text-green-600">{visibleColumns.length}</div>
                  <div className="text-sm text-green-700">Visible Columns</div>
                </div>
              </div>

              {/* Column Visibility Controls */}
              <Card className="border-gray-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Column Visibility</CardTitle>
                      <CardDescription>Select up to 8 columns to display in the data table</CardDescription>
                    </div>
                    <Button
                      onClick={toggleAllColumns}
                      variant="outline"
                      size="sm"
                      className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                    >
                      {visibleColumns.length === Math.min(8, uploadAnalysis.headers.length) ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Hide All
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Show First 8
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {uploadAnalysis.headers.map((header) => (
                        <div key={header} className="flex items-start space-x-3 p-2 border rounded-lg hover:bg-gray-50">
                          <Checkbox
                            id={`column-${header}`}
                            checked={visibleColumns.includes(header)}
                            disabled={!visibleColumns.includes(header) && visibleColumns.length >= 8}
                            onCheckedChange={() => handleColumnVisibilityToggle(header)}
                            className="mt-1"
                          />
                          <label
                            htmlFor={`column-${header}`}
                            className={`text-sm font-medium leading-relaxed cursor-pointer flex-1 ${
                              !visibleColumns.includes(header) && visibleColumns.length >= 8
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            {header}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="mt-4 text-sm text-gray-500 text-center">
                    {visibleColumns.length} of 8 columns selected
                  </div>
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Preview</CardTitle>
                  <CardDescription>
                    Showing {Math.min(10, uploadedData.length)} of {uploadedData.length} records
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {visibleColumns.map((header) => (
                            <TableHead key={header} className="min-w-[120px]">
                              <div className="flex flex-col space-y-1">
                                <span className="font-medium">{header}</span>
                                <Badge variant="outline" className="border-gray-500 text-gray-600 text-xs w-fit">
                                  {uploadAnalysis.detectedFieldTypes[header]}
                                </Badge>
                              </div>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadedData.slice(0, 10).map((row, index) => (
                          <TableRow key={index}>
                            {visibleColumns.map((header) => (
                              <TableCell key={header} className="max-w-[200px] truncate">
                                {String(row[header] || "").length > 50
                                  ? `${String(row[header] || "").substring(0, 50)}...`
                                  : String(row[header] || "")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {uploadedData.length > 10 && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-gray-500">Showing first 10 rows. Total rows: {uploadedData.length}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button onClick={() => setUploadStep("upload")} variant="outline">
                  Back
                </Button>
                <div className="flex space-x-2">
                  <Button onClick={() => setUploadStep("map")} variant="outline">
                    Field Mapping (Optional)
                  </Button>
                  <Button onClick={processData} className="bg-teal-500 hover:bg-teal-600 text-white">
                    Process Data
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  // Render mapping step (now optional)
  const renderMappingStep = () => {
    const mappingStatus = getMappingStatus()

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Field Mapping (Optional)</CardTitle>
            <CardDescription>
              Optionally map your file columns to Interest Claims fields. This step is not required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Mapping Progress</h3>
                  <p className="text-sm text-gray-500">
                    {mappingStatus.mapped} of {mappingStatus.total} fields mapped (all optional)
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={autoMapFields}
                    variant="outline"
                    className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Auto-Map All
                  </Button>
                  <Button
                    onClick={() => {
                      const settlementMapping = createSettlementFieldMapping(uploadAnalysis?.headers || [])
                      setFieldMapping(prev => ({ ...prev, ...settlementMapping }))
                    }}
                    variant="outline"
                    className="border-blue-500 text-blue-600 hover:bg-blue-50 bg-transparent"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Map Settlement Fields
                  </Button>
                  <Button
                    onClick={clearFieldMapping}
                    variant="outline"
                    className="border-gray-500 text-gray-600 hover:bg-gray-50 bg-transparent"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(mappingStatus.mapped / mappingStatus.total) * 100}%` }}
                ></div>
              </div>
            
            {/* Settlement Fields Info */}
            <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-200">Settlement Fields</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Fields marked with "Settlement" badge are used in the Claim Settlement table. 
                Mapping these fields ensures your data will appear in the settlement views. 
                Use the "Map Settlement Fields" button to automatically map common settlement field variations.
              </AlertDescription>
            </Alert>
            </div>

            <div className="overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Interest Claims Field</TableHead>
                    <TableHead>Your Column</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sample Data</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {INTEREST_CLAIMS_FIELDS.map((field) => {
                    // Check if this field is used in Claim Settlement table
                    const settlementFields = [
                      'claimId', 'claimType', 'costBookedDate', 'settlementCurrency', 
                      'netAmount', 'settlementStatus', 'settlementMethod', 'settlementDate', 
                      'comments', 'pnlCalculated', 'confirmationStatus', 'expenseApprovalStatus', 
                      'costAllocationStatus'
                    ]
                    const isSettlementField = settlementFields.includes(field.key)
                    
                    return (
                      <TableRow key={field.key} className={isSettlementField ? "bg-blue-50 dark:bg-blue-900/10" : ""}>
                      <TableCell>
                        <div>
                            <div className="font-medium flex items-center">
                              {field.label}
                              {isSettlementField && (
                                <Badge variant="outline" className="ml-2 border-blue-500 text-blue-600 text-xs">
                                  Settlement
                                </Badge>
                              )}
                            </div>
                          <div className="text-xs text-gray-500">{field.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={fieldMapping[field.key] || "__none__"}
                          onValueChange={(value) => handleFieldMapping(field.key, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">-- Select Column --</SelectItem>
                            {uploadAnalysis?.headers.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gray-500 text-gray-600 text-xs">
                          {field.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                        {fieldMapping[field.key] && uploadedData.length > 0
                          ? String(uploadedData[0][fieldMapping[field.key]] || "").substring(0, 30)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {fieldMapping[field.key] ? (
                          <Badge variant="outline" className="border-green-500 text-green-600 text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Mapped
                          </Badge>
                        ) : (
                            <Badge variant="outline" className={`text-xs ${isSettlementField ? "border-blue-500 text-blue-600" : "border-gray-500 text-gray-600"}`}>
                              {isSettlementField ? "Required for Settlement" : "Optional"}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between mt-6">
              <Button onClick={() => setUploadStep("analyze")} variant="outline">
                Back
              </Button>
              <Button onClick={processData} disabled={loading} className="bg-teal-500 hover:bg-teal-600 text-white">
                {loading ? "Processing..." : "Process Data"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render complete step
  const renderCompleteStep = () => (
    <div className="space-y-6">
      <Card>
        <CardContent className="text-center py-12">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Data Processed Successfully</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {processedClaims.length} interest claims have been processed and are ready for review.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="text-lg font-bold text-teal-600">{processedClaims.length}</div>
              <div className="text-sm text-teal-700">Total Claims</div>
            </div>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {processedClaims.filter((claim) => claim.calculatedInterest > 0).length}
              </div>
              <div className="text-sm text-green-700">With Calculated Interest</div>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                ${processedClaims.reduce((sum, claim) => sum + (claim.calculatedInterest || 0), 0).toFixed(2)}
              </div>
              <div className="text-sm text-blue-700">Total Interest Amount</div>
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <Button
              onClick={() => {
                setUploadStep("upload")
                setUploadedFile(null)
                setUploadedData([])
                setFieldMapping({})
                setUploadAnalysis(null)
                setProcessedClaims([])
                setVisibleColumns([])
              }}
              variant="outline"
            >
              Upload Another File
            </Button>
            <Button
              onClick={() => setActiveTab("claims-management")}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              View Claims
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Editable Uploaded Data Preview (Raw) table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
          <CardTitle>Uploaded Data Preview (Raw)</CardTitle>
          <CardDescription>
            This table shows the exact data you uploaded, with all columns and rows, before any mapping or processing.
          </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleSaveData}
                disabled={savingData || Object.keys(editedData).length === 0}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {savingData ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={() => setEditedData({})}
                disabled={Object.keys(editedData).length === 0}
                variant="outline"
              >
                Discard Changes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(editedData).length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-800">
                  {Object.keys(editedData).length} field(s) have been modified. Click "Save Changes" to update Firebase.
                </span>
              </div>
            </div>
          )}
          
          <div className="overflow-x-auto">
            {uploadedData.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No data uploaded yet.</div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                    {Object.keys(uploadedData[0] || {}).map((key) => (
                      <TableHead key={key} className="font-semibold text-gray-900 dark:text-gray-100">
                        {key}
                      </TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                  {uploadedData.slice(0, 10).map((row, rowIdx) => (
                    <TableRow key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      {Object.keys(uploadedData[0] || {}).map((key) => {
                        const isEditing = editingCell?.rowIndex === rowIdx && editingCell?.field === key
                        const hasChanges = editedData[`${rowIdx}-${key}`] !== undefined
                        const currentValue = hasChanges ? editedData[`${rowIdx}-${key}`] : row[key]
                        
                        return (
                          <TableCell 
                            key={key} 
                            className={`text-xs cursor-pointer ${
                              hasChanges 
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700' 
                                : ''
                            }`}
                            onClick={() => handleCellClick(rowIdx, key)}
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ''}
                                onChange={(e) => handleCellEdit(rowIdx, key, e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCellBlur()
                                  }
                                  if (e.key === 'Escape') {
                                    setEditedData(prev => {
                                      const newData = { ...prev }
                                      delete newData[`${rowIdx}-${key}`]
                                      return newData
                                    })
                                    handleCellBlur()
                                  }
                                }}
                                className="w-full px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                                autoFocus
                              />
                            ) : (
                              <div className="truncate">
                                {currentValue !== undefined && currentValue !== null ? String(currentValue) : ''}
                              </div>
                            )}
                    </TableCell>
                        )
                      })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
            {uploadedData.length > 10 && (
              <div className="text-xs text-gray-500 mt-2 text-center">
                Showing first 10 rows of {uploadedData.length} total rows. Click on any cell to edit. Press Enter to save or Escape to cancel.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Render data upload tab
  const renderDataUpload = () => {
    let mainContent;
    if (error) {
      mainContent = (
        <div className="space-y-6">
          <Alert className="border-red-300 bg-red-100 dark:bg-red-900">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800 dark:text-red-200">Error</AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-300">
              {error}
              <Button
                onClick={() => setError(null)}
                variant="ghost"
                size="sm"
                className="ml-2 p-1 h-auto text-red-600 hover:text-red-800"
              >
                <X className="h-3 w-3" />
              </Button>
            </AlertDescription>
          </Alert>
          {renderUploadStep()}
        </div>
      )
    } else {
    switch (uploadStep) {
      case "upload":
          mainContent = renderUploadStep(); break;
      case "analyze":
          mainContent = renderAnalyzeStep(); break;
      case "map":
          mainContent = renderMappingStep(); break;
      case "complete":
          mainContent = renderCompleteStep(); break;
      default:
          mainContent = renderUploadStep(); break;
      }
    }
    return (
      <div className="space-y-6">
        {mainContent}
        {/* Save to Firebase Buttons - always visible at the bottom */}
        <div className="mt-6 flex flex-col md:flex-row gap-4 justify-end">
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={uploadedData.length === 0}
            title={uploadedData.length === 0 ? 'Upload a file to enable this action.' : ''}
            onClick={async () => {
              if (!dataType) {
                alert("Please select a data type first.");
                return;
              }
              if (uploadedData.length === 0) {
                alert("Upload a file to enable this action.");
                return;
              }
              if (!window.confirm("This will overwrite all existing data in the selected subcollection. Continue?")) return;
              try {
                await interestClaimsOperations.deleteAllInSubcollection(dataType);
                for (const row of uploadedData) {
                  await interestClaimsOperations.createInterestClaim({ ...row }, dataType);
                }
                alert("All columns from your file have been uploaded to Firebase as-is.");
              } catch (error) {
                alert(`Error uploading data: ${error instanceof Error ? error.message : String(error)}`);
              }
            }}
          >
            Upload
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={processData}
            title="This will only upload mapped fields, not all columns. Use 'Upload As-Is' for all columns."
            disabled={uploadedData.length === 0}
          >
            Save
          </Button>
        </div>
      </div>
    )
  }

  // Render placeholder tabs
  const renderPlaceholderTab = (title: string, description: string, icon: React.ComponentType<any>) => {
    const IconComponent = icon
    return (
      <Card>
        <CardContent className="text-center py-12">
          <IconComponent className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{title}</h2>
          <p className="text-gray-600 dark:text-gray-400">{description}</p>
        </CardContent>
      </Card>
    )
  }

  // Render claims management with subtabs
  const renderClaimsManagement = () => {
    const claimsSubTabs = [
      { id: "claim-receipt", label: "Claim Receipt" },
      { id: "claim-registration", label: "Claim Registration" },
      { id: "claim-issuance", label: "Claim Issuance" },
      { id: "claim-settlement", label: "Claim Settlement" },
    ]

    // Function to categorize claims based on business rules
    const categorizeClaim = (item: any): string => {
      const categories: string[] = []

      // 1. Failed Confirmation
      if (item.confirmationStatus?.toLowerCase() === "failed") {
        categories.push("Failed Confirmation")
      }

      // 2. Expense Rejected
      if (item.expenseApprovalStatus?.toLowerCase() === "rejected") {
        categories.push("Expense Rejected")
      }

      // 3. Cost Allocation Failed
      if (item.costAllocationStatus?.toLowerCase() === "failed") {
        categories.push("Cost Allocation Failed")
      }

      // 4. Settlement Delay (Value Date > Trade Date + 2 days)
      // For now, we'll use a random logic since we don't have Value Date in the data
      // In real implementation, this would compare actual Value Date vs Trade Date
      const tradeDate = new Date(item.tradeDate)
      const daysDiff = Math.floor(Math.random() * 5) // Simulated for demo
      if (daysDiff > 2) {
        categories.push("Settlement Delay")
      }

      // 5. PnL Mismatch (±5% deviation from expected value)
      if (expectedPnlValue > 0) {
        const pnlDeviation = Math.abs((Number(item.pnlCalculated) - expectedPnlValue) / expectedPnlValue) * 100
        if (pnlDeviation > 5) {
          categories.push("PnL Mismatch")
        }
      }

      // 6. Unbooked Trade (simulated - would need external data comparison)
      // For demo, randomly assign some trades as unbooked
      if (Math.random() > 0.8) {
        categories.push("Unbooked Trade")
      }

      // 7. Trade Mismatch (simulated - would need external data comparison)
      // For demo, randomly assign some trades as mismatched
      if (Math.random() > 0.85) {
        categories.push("Trade Mismatch")
      }

      // 8. Pending Approval
      if (
        item.confirmationStatus?.toLowerCase() === "pending" ||
        item.expenseApprovalStatus?.toLowerCase() === "pending" ||
        item.costAllocationStatus?.toLowerCase() === "pending"
      ) {
        categories.push("Pending Approval")
      }

      return categories.length > 0 ? categories.join(", ") : "No Issues"
    }

    // Function to determine claim type based on PnL and status
    const determineClaimType = (item: any): string => {
      const pnl = Number(item.pnlCalculated)
      const confirmationStatus = item.confirmationStatus?.toLowerCase() || "pending"
      const expenseApprovalStatus = item.expenseApprovalStatus?.toLowerCase() || "pending"
      const costAllocationStatus = item.costAllocationStatus?.toLowerCase() || "pending"

      // Check for settlement issues, rejections, or failures
      const hasIssues =
        confirmationStatus === "failed" ||
        confirmationStatus === "rejected" ||
        expenseApprovalStatus === "failed" ||
        expenseApprovalStatus === "rejected" ||
        costAllocationStatus === "failed" ||
        costAllocationStatus === "rejected"

      // Check for pending settlement (settlement delay)
      const hasPendingSettlement =
        confirmationStatus === "pending" || expenseApprovalStatus === "pending" || costAllocationStatus === "pending"

      // Apply classification logic
      if (pnl > 0 && (hasIssues || hasPendingSettlement)) {
        return "Receivable"
      } else if (pnl < 0 && (costAllocationStatus === "failed" || costAllocationStatus === "rejected")) {
        return "Payable"
      } else if (pnl > 0 && hasPendingSettlement) {
        return "Receivable"
      }

      return "N/A"
    }

    // Function to get the reason for claim type classification
    const getClaimTypeReason = (item: any): string => {
      const pnl = Number(item.pnlCalculated)
      const confirmationStatus = item.confirmationStatus?.toLowerCase() || "pending"
      const expenseApprovalStatus = item.expenseApprovalStatus?.toLowerCase() || "pending"
      const costAllocationStatus = item.costAllocationStatus?.toLowerCase() || "pending"

      // Check for settlement issues, rejections, or failures
      const hasIssues =
        confirmationStatus === "failed" ||
        confirmationStatus === "rejected" ||
        expenseApprovalStatus === "failed" ||
        expenseApprovalStatus === "rejected" ||
        costAllocationStatus === "failed" ||
        costAllocationStatus === "rejected"

      // Check for pending settlement (settlement delay)
      const hasPendingSettlement =
        confirmationStatus === "pending" || expenseApprovalStatus === "pending" || costAllocationStatus === "pending"

      // Apply classification logic and return reason
      if (pnl > 0 && hasIssues) {
        return `Receivable: Positive PnL ($${Math.abs(pnl).toLocaleString()}) with settlement issues/rejections. Your firm is owed money due to failed confirmations, rejected expenses, or cost allocation failures.`
      } else if (pnl > 0 && hasPendingSettlement) {
        return `Receivable: Positive PnL ($${Math.abs(pnl).toLocaleString()}) with pending settlement. Expected profit was delayed or compromised due to pending approvals.`
      } else if (pnl < 0 && (costAllocationStatus === "failed" || costAllocationStatus === "rejected")) {
        return `Payable: Negative PnL ($${Math.abs(pnl).toLocaleString()}) with cost allocation issues. The other party may raise a claim against your firm due to unallocated or rejected costs.`
      }

      return "N/A: This trade does not meet the criteria for receivable or payable classification based on current PnL and status conditions."
    }

    const toggleClaimTypeReason = (claimId: string) => {
      setSelectedClaimTypeReason((prev) => ({
        ...prev,
        [claimId]: !prev[claimId],
      }))
    }

    const handleRemarksChange = (claimId: string, value: string) => {
      setClaimRemarks((prev) => ({
        ...prev,
        [claimId]: value,
      }))
    }



    const renderClaimsSubTabContent = () => {
      switch (claimsSubTab) {
        case "claim-receipt":
          // Generate sample data or use uploaded data for the claim receipt table
          const allClaimReceiptData =
            uploadedData.length > 0
              ? uploadedData.map((row, index) => {
                  // Helper function to safely find values from multiple possible field names
                  const findValue = (row: any, possibleNames: string[], defaultValue: any = "") => {
                    for (const name of possibleNames) {
                      if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
                        return row[name]
                      }
                    }
                    return defaultValue
                  }

                  // Helper function to safely convert to number
                  const safeNumber = (value: any, defaultValue = 0): number => {
                    if (value === null || value === undefined || value === "") return defaultValue
                    const num = typeof value === "string" ? Number.parseFloat(value.replace(/[,$]/g, "")) : Number(value)
                    return isNaN(num) ? defaultValue : num
                  }

                  return {
                    tradeId: findValue(
                      row,
                      ["Trade ID", "TradeID", "trade_id", "TradeId", "id"],
                      `TRD-${String(index + 1).padStart(6, "0")}`
                    ),
                    clientId: findValue(
                      row,
                      ["Client ID", "ClientID", "client_id", "ClientId"],
                      `CLI-${String(index + 1).padStart(6, "0")}`
                    ),
                    counterparty: findValue(
                      row,
                      ["Counterparty", "Counter Party", "counterparty", "Broker", "broker"],
                      "Unknown"
                    ),
                    tradeDate: findValue(
                      row,
                      ["Trade Date", "TradeDate", "trade_date", "Date", "date"],
                      new Date().toISOString().split("T")[0]
                    ),
                    valueDate: findValue(
                      row,
                      ["Value Date", "ValueDate", "value_date"],
                      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                    ),
                    settlementDate: findValue(
                      row,
                      ["Settlement Date", "SettlementDate", "settlement_date", "Settlement"],
                      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                    ),
                    // Calculate SLA breach: SettlementDate - ValueDate
                    slaBreach: (() => {
                      const valueDate = findValue(
                        row,
                        ["Value Date", "ValueDate", "value_date"],
                        new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                      )
                      const settlementDate = findValue(
                        row,
                        ["Settlement Date", "SettlementDate", "settlement_date", "Settlement"],
                        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                      )
                      const valueDateObj = new Date(valueDate)
                      const settlementDateObj = new Date(settlementDate)
                      const diffTime = settlementDateObj.getTime() - valueDateObj.getTime()
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                      return diffDays
                    })(),
                    notionalAmount: safeNumber(
                      findValue(row, [
                        "Notional Amount",
                        "NotionalAmount", 
                        "notional_amount",
                        "Trade Value",
                        "TradeValue",
                        "trade_value",
                        "Amount",
                        "Principal Amount",
                        "Value"
                      ])
                    ),
                    confirmationStatus: findValue(
                      row,
                      ["Confirmation Status", "ConfirmationStatus", "confirmation_status", "confirmationStatus"],
                      "Pending"
                    ),
                    expenseApprovalStatus: findValue(
                      row,
                      ["Expense Approval Status", "ExpenseApprovalStatus", "expense_approval_status", "expenseApprovalStatus"],
                      "Pending"
                    ),
                    costAllocationStatus: findValue(
                      row,
                      ["Cost Allocation Status", "CostAllocationStatus", "cost_allocation_status", "costAllocationStatus"],
                      "Pending"
                    ),
                  }
                })
              : [
                  // Sample data when no file is uploaded - with varied statuses
                  {
                    tradeId: "TRD-000001",
                    clientId: "CLI-000001",
                    counterparty: "Goldman Sachs",
                    tradeDate: "2024-01-15",
                    valueDate: "2024-01-17",
                    settlementDate: "2024-01-18",
                    slaBreach: 1,
                    notionalAmount: 1500000,
                    confirmationStatus: "Confirmed",
                    expenseApprovalStatus: "Approved",
                    costAllocationStatus: "Allocated",
                  },
                  {
                    tradeId: "TRD-000002",
                    clientId: "CLI-000002",
                    counterparty: "JP Morgan",
                    tradeDate: "2024-01-16",
                    valueDate: "2024-01-18",
                    settlementDate: "2024-01-20",
                    slaBreach: 2,
                    notionalAmount: 2300000,
                    confirmationStatus: "Pending",
                    expenseApprovalStatus: "Pending",
                    costAllocationStatus: "Pending",
                  },
                  {
                    tradeId: "TRD-000003",
                    clientId: "CLI-000003",
                    counterparty: "Morgan Stanley",
                    tradeDate: "2024-01-17",
                    valueDate: "2024-01-19",
                    settlementDate: "2024-01-22",
                    slaBreach: 3,
                    notionalAmount: 850000,
                    confirmationStatus: "Failed",
                    expenseApprovalStatus: "Rejected",
                    costAllocationStatus: "Failed",
                  },
                  {
                    tradeId: "TRD-000004",
                    clientId: "CLI-000004",
                    counterparty: "Deutsche Bank",
                    tradeDate: "2024-01-18",
                    valueDate: "2024-01-20",
                    settlementDate: "2024-01-21",
                    slaBreach: 1,
                    notionalAmount: 5000000,
                    confirmationStatus: "Confirmed",
                    expenseApprovalStatus: "Approved",
                    costAllocationStatus: "Allocated",
                  },
                  {
                    tradeId: "TRD-000005",
                    clientId: "CLI-000005",
                    counterparty: "Barclays",
                    tradeDate: "2024-01-19",
                    valueDate: "2024-01-21",
                    settlementDate: "2024-01-23",
                    slaBreach: 2,
                    notionalAmount: 3200000,
                    confirmationStatus: "Pending",
                    expenseApprovalStatus: "Pending",
                    costAllocationStatus: "Pending",
                  },
                  {
                    tradeId: "TRD-000006",
                    clientId: "CLI-000006",
                    counterparty: "Credit Suisse",
                    tradeDate: "2024-01-20",
                    valueDate: "2024-01-22",
                    settlementDate: "2024-01-25",
                    slaBreach: 3,
                    notionalAmount: 1800000,
                    confirmationStatus: "Rejected",
                    expenseApprovalStatus: "Failed",
                    costAllocationStatus: "Rejected",
                  },
                  {
                    tradeId: "TRD-000007",
                    clientId: "CLI-000007",
                    counterparty: "UBS",
                    tradeDate: "2024-01-21",
                    valueDate: "2024-01-23",
                    settlementDate: "2024-01-24",
                    slaBreach: 1,
                    notionalAmount: 950000,
                    confirmationStatus: "Pending",
                    expenseApprovalStatus: "Under Review",
                    costAllocationStatus: "Pending",
                  },
                  {
                    tradeId: "TRD-000008",
                    clientId: "CLI-000008",
                    counterparty: "HSBC",
                    tradeDate: "2024-01-22",
                    valueDate: "2024-01-24",
                    settlementDate: "2024-01-27",
                    slaBreach: 3,
                    notionalAmount: 2750000,
                    confirmationStatus: "Failed",
                    expenseApprovalStatus: "Rejected",
                    costAllocationStatus: "Failed",
                  },
                ]
          // Filter data based on selected filter
          const claimReceiptData = allClaimReceiptData.filter((item) => {
            switch (claimReceiptFilter) {
              case "eligible":
                // Show trades with 'failed' or 'rejected' statuses in any of the status fields OR SLA breach > 1 day
                return (
                  item.confirmationStatus.toLowerCase() === "failed" ||
                  item.confirmationStatus.toLowerCase() === "rejected" ||
                  item.expenseApprovalStatus.toLowerCase() === "failed" ||
                  item.expenseApprovalStatus.toLowerCase() === "rejected" ||
                  item.costAllocationStatus.toLowerCase() === "failed" ||
                  item.costAllocationStatus.toLowerCase() === "rejected" ||
                  item.slaBreach > 1
                )
              case "watchlist":
                // Show trades with 'pending' status in any of the status fields
                return (
                  item.confirmationStatus.toLowerCase() === "pending" ||
                  item.expenseApprovalStatus.toLowerCase() === "pending" ||
                  item.costAllocationStatus.toLowerCase() === "pending"
                )
              default:
                return true // Show all trades
            }
          })

          // Get filter counts
          const getFilterCounts = () => {
            const eligibleCount = allClaimReceiptData.filter(
              (item) =>
                item.confirmationStatus.toLowerCase() === "failed" ||
                item.confirmationStatus.toLowerCase() === "rejected" ||
                item.expenseApprovalStatus.toLowerCase() === "failed" ||
                item.expenseApprovalStatus.toLowerCase() === "rejected" ||
                item.costAllocationStatus.toLowerCase() === "failed" ||
                item.costAllocationStatus.toLowerCase() === "rejected" ||
                item.slaBreach > 1,
            ).length

            const watchlistCount = allClaimReceiptData.filter(
              (item) =>
                item.confirmationStatus.toLowerCase() === "pending" ||
                item.expenseApprovalStatus.toLowerCase() === "pending" ||
                item.costAllocationStatus.toLowerCase() === "pending",
            ).length

            return { eligible: eligibleCount, watchlist: watchlistCount, total: allClaimReceiptData.length }
          }

          const filterCounts = getFilterCounts()

          return (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Claim Receipt</CardTitle>
                      <CardDescription>
                        Manage incoming claim receipts and initial processing. Review trade details and status
                        information.
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Data
                      </Button>
                      <Button className="bg-teal-500 hover:bg-teal-600 text-white">
                        <Download className="h-4 w-4 mr-2" />
                        Export Claims
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filter Options */}
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant={claimReceiptFilter === "all" ? "default" : "outline"}
                        onClick={() => setClaimReceiptFilter("all")}
                        className={
                          claimReceiptFilter === "all"
                            ? "bg-teal-500 hover:bg-teal-600 text-white"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        }
                      >
                        All Trades
                        <Badge className="ml-2 bg-white text-teal-600 hover:bg-white">{filterCounts.total}</Badge>
                      </Button>
                      <Button
                        variant={claimReceiptFilter === "eligible" ? "default" : "outline"}
                        onClick={() => setClaimReceiptFilter("eligible")}
                        className={
                          claimReceiptFilter === "eligible"
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "border-red-300 text-red-700 hover:bg-red-50"
                        }
                      >
                        Eligible for Registration
                        <Badge
                          className={`ml-2 ${claimReceiptFilter === "eligible" ? "bg-white text-red-600" : "bg-red-100 text-red-700"}`}
                        >
                          {filterCounts.eligible}
                        </Badge>
                      </Button>
                      <Button
                        variant={claimReceiptFilter === "watchlist" ? "default" : "outline"}
                        onClick={() => setClaimReceiptFilter("watchlist")}
                        className={
                          claimReceiptFilter === "watchlist"
                            ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                            : "border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                        }
                      >
                        Watchlist
                        <Badge
                          className={`ml-2 ${claimReceiptFilter === "watchlist" ? "bg-white text-yellow-600" : "bg-yellow-100 text-yellow-700"}`}
                        >
                          {filterCounts.watchlist}
                        </Badge>
                      </Button>
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                      {claimReceiptFilter === "eligible" && "Showing trades with failed or rejected statuses"}
                      {claimReceiptFilter === "watchlist" && "Showing trades with pending statuses"}
                      {claimReceiptFilter === "all" && "Showing all trades"}
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{claimReceiptData.length}</div>
                      <div className="text-sm text-blue-700">Total Claims</div>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {
                          claimReceiptData.filter((item) => item.confirmationStatus.toLowerCase() === "confirmed")
                            .length
                        }
                      </div>
                      <div className="text-sm text-green-700">Confirmed</div>
                    </div>
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {claimReceiptData.filter((item) => item.confirmationStatus.toLowerCase() === "pending").length}
                      </div>
                      <div className="text-sm text-yellow-700">Pending</div>
                    </div>
                    <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                      <div className="text-2xl font-bold text-teal-600">
                        {claimReceiptData.filter((item) => item.slaBreach > 1).length}
                      </div>
                      <div className="text-sm text-teal-700">SLA Breaches</div>
                    </div>
                  </div>

                  {/* Data Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 dark:bg-gray-800">
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100">Trade ID</TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100">Client ID</TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                              Counterparty
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100">Trade Date</TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100">Value Date</TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100">Settlement Date</TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100">SLA Breach</TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-right">Notional Amount</TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                              Confirmation Status
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                              Expense Approval
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                              Cost Allocation
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {claimReceiptData.map((item, index) => (
                            <TableRow key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <TableCell className="font-mono text-sm font-medium text-blue-600">
                                {item.tradeId}
                              </TableCell>
                              <TableCell className="font-mono text-sm font-medium text-teal-600">
                                {item.clientId}
                              </TableCell>
                              <TableCell className="font-medium">{item.counterparty}</TableCell>
                              <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                {new Date(item.tradeDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                {new Date(item.valueDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                {new Date(item.settlementDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={`${
                                    item.slaBreach > 1 
                                      ? "border-red-500 text-red-600 bg-red-50" 
                                      : "border-green-500 text-green-600 bg-green-50"
                                  }`}
                                >
                                  {item.slaBreach} day{item.slaBreach !== 1 ? 's' : ''}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ${Number(item.notionalAmount || 0).toLocaleString()}
                              </TableCell>
                              <TableCell>{getStatusBadge(item.confirmationStatus, "confirmation")}</TableCell>
                              <TableCell>{getStatusBadge(item.expenseApprovalStatus, "approval")}</TableCell>
                              <TableCell>{getStatusBadge(item.costAllocationStatus, "allocation")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Pagination */}
                  {claimReceiptData.length > 10 && (
                    <div className="flex justify-between items-center mt-4">
                      <div className="text-sm text-gray-500">
                        Showing {Math.min(10, claimReceiptData.length)} of {claimReceiptData.length} entries
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" disabled>
                          Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          )
        case "claim-registration":
          // Use the same data source as claim receipt
          const allRegistrationData =
            uploadedData.length > 0
              ? uploadedData.map((row, index) => {
                  // Helper function to safely convert to number
                  const safeNumber = (value: any, defaultValue = 0): number => {
                    if (value === null || value === undefined || value === "") return defaultValue
                    const num =
                      typeof value === "string" ? Number.parseFloat(value.replace(/[,$]/g, "")) : Number(value)
                    return isNaN(num) ? defaultValue : num
                  }

                  // Helper function to find value from multiple possible column names
                  const findValue = (row: any, possibleNames: string[], defaultValue: any = "") => {
                    for (const name of possibleNames) {
                      if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
                        return row[name]
                      }
                    }
                    return defaultValue
                  }

                  return {
                    claimId: `CLM-${String(index + 1).padStart(6, "0")}`, // Auto-generated Claim ID
                    tradeId: findValue(
                      row,
                      ["Trade ID", "TradeID", "trade_id", "ID"],
                      `TRD-${String(index + 1).padStart(6, "0")}`,
                    ),
                    clientId: `CLI-${String(index + 1).padStart(6, "0")}`, // Auto-generated Client ID
                    counterparty: findValue(
                      row,
                      ["Counterparty", "Counter Party", "counterparty", "Broker"],
                      "Unknown",
                    ),
                    tradeDate: findValue(
                      row,
                      ["Trade Date", "TradeDate", "trade_date", "Date"],
                      new Date().toISOString().split("T")[0],
                    ),
                    tradeType: findValue(
                      row,
                      ["Trade Type", "TradeType", "trade_type", "Type", "Product Type"],
                      "Unknown",
                    ),
                    tradeValue: safeNumber(
                      findValue(row, [
                        "Trade Value",
                        "TradeValue",
                        "trade_value",
                        "Amount",
                        "Principal Amount",
                        "Notional Amount",
                        "Value",
                      ]),
                    ),
                    currency: findValue(
                      row,
                      ["Currency", "CCY", "currency", "Ccy", "Base Currency", "Deal Currency"],
                      "USD",
                    ),
                    pnlCalculated: safeNumber(
                      findValue(row, [
                        "PnL",
                        "PnL Calculated",
                        "pnl_calculated",
                        "Profit Loss",
                        "P&L",
                        "PnlCalculated",
                        "FX Gain Loss",
                        "FXGainLoss",
                      ]),
                    ),
                    fxRateUsed: safeNumber(
                      findValue(row, ["FX Rate", "FX Rate Used", "fx_rate", "Exchange Rate", "FXRate", "Rate"]),
                      1.0,
                    ),
                    costCenter: findValue(
                      row,
                      ["Cost Center", "CostCenter", "cost_center", "Department", "Business Unit", "Cost Centre"],
                      "N/A",
                    ),
                  }
                })
              : [
                  // Sample data when no file is uploaded
                  {
                    claimId: "CLM-000001",
                    tradeId: "TRD-000001",
                    clientId: "CLI-000001",
                    counterparty: "Goldman Sachs",
                    tradeDate: "2024-01-15",
                    tradeType: "FX Forward",
                    tradeValue: 1500000,
                    currency: "USD",
                    pnlCalculated: 25000,
                    fxRateUsed: 1.085,
                    costCenter: "FX Trading",
                  },
                  {
                    claimId: "CLM-000002",
                    tradeId: "TRD-000002",
                    clientId: "CLI-000002",
                    counterparty: "JP Morgan",
                    tradeDate: "2024-01-16",
                    tradeType: "Interest Rate Swap",
                    tradeValue: 2300000,
                    currency: "EUR",
                    pnlCalculated: -15000,
                    fxRateUsed: 0.925,
                    costCenter: "Fixed Income",
                  },
                  {
                    claimId: "CLM-000003",
                    tradeId: "TRD-000003",
                    clientId: "CLI-000003",
                    counterparty: "Morgan Stanley",
                    tradeDate: "2024-01-17",
                    tradeType: "Equity Option",
                    tradeValue: 850000,
                    currency: "GBP",
                    pnlCalculated: 8500,
                    fxRateUsed: 1.265,
                    costCenter: "Equity Derivatives",
                  },
                  {
                    claimId: "CLM-000004",
                    tradeId: "TRD-000004",
                    clientId: "CLI-000004",
                    counterparty: "Deutsche Bank",
                    tradeDate: "2024-01-18",
                    tradeType: "Credit Default Swap",
                    tradeValue: 5000000,
                    currency: "USD",
                    pnlCalculated: 75000,
                    fxRateUsed: 1.0,
                    costCenter: "Credit Trading",
                  },
                  {
                    claimId: "CLM-000005",
                    tradeId: "TRD-000005",
                    clientId: "CLI-000005",
                    counterparty: "Barclays",
                    tradeDate: "2024-01-19",
                    tradeType: "Bond Purchase",
                    tradeValue: 3200000,
                    currency: "JPY",
                    pnlCalculated: 45000,
                    fxRateUsed: 148.5,
                    costCenter: "Fixed Income",
                  },
                  {
                    claimId: "CLM-000006",
                    tradeId: "TRD-000006",
                    clientId: "CLI-000006",
                    counterparty: "Credit Suisse",
                    tradeDate: "2024-01-20",
                    tradeType: "Currency Swap",
                    tradeValue: 1800000,
                    currency: "CHF",
                    pnlCalculated: -12000,
                    fxRateUsed: 0.915,
                    costCenter: "FX Trading",
                  },
                  {
                    claimId: "CLM-000007",
                    tradeId: "TRD-000007",
                    clientId: "CLI-000007",
                    counterparty: "UBS",
                    tradeDate: "2024-01-21",
                    tradeType: "Commodity Future",
                    tradeValue: 950000,
                    currency: "USD",
                    pnlCalculated: 18500,
                    fxRateUsed: 1.0,
                    costCenter: "Commodities",
                  },
                  {
                    claimId: "CLM-000008",
                    tradeId: "TRD-000008",
                    clientId: "CLI-000008",
                    counterparty: "HSBC",
                    tradeDate: "2024-01-22",
                    tradeType: "FX Option",
                    tradeValue: 2750000,
                    currency: "HKD",
                    pnlCalculated: 32000,
                    fxRateUsed: 7.85,
                    costCenter: "FX Trading",
                  },
                ]

          return (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                        Claim Registration
                      </CardTitle>
                      <CardDescription>
                        Register new claims in the system. Review trade details and prepare claims for processing.
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Data
                      </Button>
                      <Button className="bg-teal-500 hover:bg-teal-600 text-white">
                        <Download className="h-4 w-4 mr-2" />
                        Export Registration Data
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{allRegistrationData.length}</div>
                      <div className="text-sm text-blue-700">Total Claims for Registration</div>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {allRegistrationData.filter((item) => Number(item.pnlCalculated) > 0).length}
                      </div>
                      <div className="text-sm text-green-700">Profitable Trades</div>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {allRegistrationData.filter((item) => Number(item.pnlCalculated) < 0).length}
                      </div>
                      <div className="text-sm text-red-700">Loss-Making Trades</div>
                    </div>
                    <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                      <div className="text-2xl font-bold text-teal-600">
                        $
                        {allRegistrationData
                          .reduce((sum, item) => sum + Number(item.tradeValue || 0), 0)
                          .toLocaleString()}
                      </div>
                      <div className="text-sm text-teal-700">Total Trade Value</div>
                    </div>
                  </div>

                  {/* Expected PnL Input */}
                  <Card className="border-orange-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-orange-700">PnL Mismatch Configuration</CardTitle>
                      <CardDescription className="text-xs">
                        Enter the expected PnL value to identify trades with PnL deviations greater than ±5%
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="flex items-center space-x-3 text-sm">
                        <label htmlFor="expected-pnl" className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          Expected PnL Value:
                        </label>
                        <input
                          id="expected-pnl"
                          type="number"
                          value={expectedPnlValue}
                          onChange={(e) => setExpectedPnlValue(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 w-24"
                        />
                        <span className="text-xs text-gray-500">
                          Trades with PnL deviation &gt; ±5% will be flagged as "PnL Mismatch"
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Registration Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 dark:bg-gray-800">
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 min-w-[120px]">
                              Claim ID
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 min-w-[120px]">
                              Trade ID
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 min-w-[120px]">
                              Client ID
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 min-w-[140px]">
                              Counterparty
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 min-w-[110px]">
                              SLA Breach Days
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 min-w-[140px]">
                              Agreed Interest Rate
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-right min-w-[130px]">
                              PnL Calculated
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-right min-w-[110px]">
                              FX Rate Used
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-right min-w-[120px]">
                              Interest Amount
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 min-w-[110px]">
                              Claim Category
                            </TableHead>
                            <TableHead className="font-semibold text-gray-900 dark:text-gray-100 min-w-[200px]">
                              Claim Type
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allRegistrationData.map((item, index) => {
                            // Get slaBreach from claim receipt data (allClaimReceiptData) by matching tradeId
                            const claimReceiptData = uploadedData.length > 0
                              ? uploadedData.map((row, idx) => {
                                  const findValue = (row: any, possibleNames: string[], defaultValue: any = "") => {
                                    for (const name of possibleNames) {
                                      if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
                                        return row[name]
                                      }
                                    }
                                    return defaultValue
                                  }
                                  const valueDate = findValue(
                                    row,
                                    ["Value Date", "ValueDate", "value_date"],
                                    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                                  )
                                  const settlementDate = findValue(
                                    row,
                                    ["Settlement Date", "SettlementDate", "settlement_date", "Settlement"],
                                    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                                  )
                                                                     const valueDateObj = new Date(valueDate)
                                   const settlementDateObj = new Date(settlementDate)
                                   const diffTime = settlementDateObj.getTime() - valueDateObj.getTime()
                                   const slaBreach = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                                   const safeNumber = (value: any, defaultValue = 0): number => {
                                     if (value === null || value === undefined || value === "") return defaultValue
                                     const num = typeof value === "string" ? Number.parseFloat(value.replace(/[,$]/g, "")) : Number(value)
                                     return isNaN(num) ? defaultValue : num
                                   }
                                   const notionalAmount = safeNumber(
                                     findValue(row, [
                                       "Notional Amount",
                                       "NotionalAmount", 
                                       "notional_amount",
                                       "Trade Value",
                                       "TradeValue",
                                       "trade_value",
                                       "Amount",
                                       "Principal Amount",
                                       "Value"
                                     ]),
                                     1000000
                                   )
                                   return {
                                     tradeId: findValue(row, ["Trade ID", "TradeID", "trade_id", "TradeId", "id"], `TRD-${String(idx + 1).padStart(6, "0")}`),
                                     slaBreach: slaBreach,
                                     notionalAmount: notionalAmount
                                   }
                                })
                                                             : [
                                   { tradeId: "TRD-000001", slaBreach: 1, notionalAmount: 1500000 },
                                   { tradeId: "TRD-000002", slaBreach: 2, notionalAmount: 2300000 },
                                   { tradeId: "TRD-000003", slaBreach: 3, notionalAmount: 850000 },
                                   { tradeId: "TRD-000004", slaBreach: 1, notionalAmount: 5000000 },
                                   { tradeId: "TRD-000005", slaBreach: 2, notionalAmount: 3200000 },
                                   { tradeId: "TRD-000006", slaBreach: 3, notionalAmount: 1800000 },
                                   { tradeId: "TRD-000007", slaBreach: 1, notionalAmount: 950000 },
                                   { tradeId: "TRD-000008", slaBreach: 3, notionalAmount: 2750000 }
                                 ]

                                                         const matchingClaimReceipt = claimReceiptData.find(claim => claim.tradeId === item.tradeId)
                             const slaBreach = matchingClaimReceipt ? matchingClaimReceipt.slaBreach : 0
                             const notionalAmount = matchingClaimReceipt ? matchingClaimReceipt.notionalAmount : item.tradeValue || 0

                            const itemWithStatus = {
                              ...item,
                              confirmationStatus:
                                uploadedData.length > 0
                                  ? uploadedData[index]?.["Confirmation Status"] ||
                                    uploadedData[index]?.["ConfirmationStatus"] ||
                                    "Pending"
                                  : index % 3 === 0
                                    ? "Failed"
                                    : index % 3 === 1
                                      ? "Pending"
                                      : "Confirmed",
                              expenseApprovalStatus:
                                uploadedData.length > 0
                                  ? uploadedData[index]?.["Expense Approval Status"] ||
                                    uploadedData[index]?.["ExpenseApprovalStatus"] ||
                                    "Pending"
                                  : index % 4 === 0
                                    ? "Rejected"
                                    : index % 4 === 1
                                      ? "Pending"
                                      : "Approved",
                              costAllocationStatus:
                                uploadedData.length > 0
                                  ? uploadedData[index]?.["Cost Allocation Status"] ||
                                    uploadedData[index]?.["CostAllocationStatus"] ||
                                    "Pending"
                                  : index % 5 === 0
                                    ? "Failed"
                                    : index % 5 === 1
                                      ? "Pending"
                                      : "Allocated",
                            }

                            return (
                              <TableRow key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <TableCell className="font-mono text-sm font-medium text-blue-600">
                                  {item.claimId}
                                </TableCell>
                                <TableCell className="font-mono text-sm font-medium text-teal-600">
                                  {item.tradeId}
                                </TableCell>
                                <TableCell className="font-mono text-sm font-medium text-purple-600">
                                  {item.clientId}
                                </TableCell>
                                <TableCell className="font-medium">{item.counterparty}</TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                  {slaBreach} days
                                </TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                  {(() => {
                                    // Generate consistent interest rate based on claim ID
                                    const seed = item.claimId.charCodeAt(0) + item.claimId.charCodeAt(1);
                                    const interestRate = ((seed % 50) / 10 + 2).toFixed(2);
                                    return `${interestRate}%`;
                                  })()}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  <span
                                    className={
                                      Number(item.pnlCalculated) >= 0
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-red-600 dark:text-red-400"
                                    }
                                  >
                                    {Number(item.pnlCalculated) === 0
                                      ? "$0"
                                      : `${Number(item.pnlCalculated) >= 0 ? "+" : ""}$${Math.abs(Number(item.pnlCalculated)).toLocaleString()}`}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {Number(item.fxRateUsed) === 1.0 && !uploadedData.length
                                    ? "1.0000"
                                    : Number(item.fxRateUsed).toFixed(4)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {(() => {
                                                                         // Use same interest rate calculation as above
                                     const seed = item.claimId.charCodeAt(0) + item.claimId.charCodeAt(1);
                                     const interestRate = ((seed % 50) / 10 + 2) / 100;
                                     if (slaBreach > 1) {
                                       const interestAmount = interestRate * notionalAmount * (slaBreach / 365);
                                       return `$${interestAmount.toFixed(2)}`;
                                     } else {
                                       return "$0.00";
                                     }
                                  })()}
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-[200px]">
                                    {categorizeClaim(itemWithStatus)
                                      .split(", ")
                                      .map((category, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="outline"
                                          className={`mr-1 mb-1 text-xs ${
                                            category === "Failed Confirmation"
                                              ? "border-red-500 text-red-600"
                                              : category === "Expense Rejected"
                                                ? "border-red-500 text-red-600"
                                                : category === "Cost Allocation Failed"
                                                  ? "border-red-500 text-red-600"
                                                  : category === "Settlement Delay"
                                                    ? "border-orange-500 text-orange-600"
                                                    : category === "PnL Mismatch"
                                                      ? "border-purple-500 text-purple-600"
                                                      : category === "Unbooked Trade"
                                                        ? "border-yellow-500 text-yellow-600"
                                                        : category === "Trade Mismatch"
                                                          ? "border-pink-500 text-pink-600"
                                                          : category === "Pending Approval"
                                                            ? "border-blue-500 text-blue-600"
                                                            : "border-green-500 text-green-600"
                                          }`}
                                        >
                                          {category}
                                        </Badge>
                                      ))}
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <Badge
                                        variant="outline"
                                        className={`${
                                          determineClaimType(itemWithStatus) === "Receivable"
                                            ? "border-green-500 text-green-600"
                                            : determineClaimType(itemWithStatus) === "Payable"
                                              ? "border-red-500 text-red-600"
                                              : "border-gray-500 text-gray-600"
                                        }`}
                                      >
                                        {determineClaimType(itemWithStatus)}
                                      </Badge>
                                      {determineClaimType(itemWithStatus) !== "N/A" && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={() => toggleClaimTypeReason(item.claimId)}
                                        >
                                          {selectedClaimTypeReason[item.claimId] ? (
                                            <EyeOff className="h-3 w-3" />
                                          ) : (
                                            <Eye className="h-3 w-3" />
                                          )}
                                        </Button>
                                      )}
                                    </div>

                                    {/* Claim Type Reason Explanation */}
                                    {selectedClaimTypeReason[item.claimId] && (
                                      <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md max-w-md">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="text-sm font-semibold text-gray-700">Classification Reason</h4>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                            onClick={() => toggleClaimTypeReason(item.claimId)}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                          {getClaimTypeReason(itemWithStatus)}
                                        </p>
                                      </div>
                                    )}




                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Pagination */}
                  {allRegistrationData.length > 10 && (
                    <div className="flex justify-between items-center mt-4">
                      <div className="text-sm text-gray-500">
                        Showing {Math.min(10, allRegistrationData.length)} of {allRegistrationData.length} entries
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" disabled>
                          Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          )
        case "claim-issuance":
          // Get data from claim registration (same source as registration tab)
          const allIssuanceSourceData =
            uploadedData.length > 0
              ? uploadedData.map((row, index) => {
                  // Helper function to safely convert to number
                  const safeNumber = (value: any, defaultValue = 0): number => {
                    if (value === null || value === undefined || value === "") return defaultValue
                    const num =
                      typeof value === "string" ? Number.parseFloat(value.replace(/[,$]/g, "")) : Number(value)
                    return isNaN(num) ? defaultValue : num
                  }

                  // Helper function to find value from multiple possible column names
                  const findValue = (row: any, possibleNames: string[], defaultValue: any = "") => {
                    for (const name of possibleNames) {
                      if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
                        return row[name]
                      }
                    }
                    return defaultValue
                  }

                  const item = {
                    claimId: `CLM-${String(index + 1).padStart(6, "0")}`,
                    tradeId: findValue(
                      row,
                      ["Trade ID", "TradeID", "trade_id", "ID"],
                      `TRD-${String(index + 1).padStart(6, "0")}`,
                    ),
                    clientId: `CLI-${String(index + 1).padStart(6, "0")}`,
                    counterparty: findValue(
                      row,
                      ["Counterparty", "Counter Party", "counterparty", "Broker"],
                      "Unknown",
                    ),
                    tradeDate: findValue(
                      row,
                      ["Trade Date", "TradeDate", "trade_date", "Date"],
                      new Date().toISOString().split("T")[0],
                    ),
                    tradeType: findValue(
                      row,
                      ["Trade Type", "TradeType", "trade_type", "Type", "Product Type"],
                      "Unknown",
                    ),
                    tradeValue: safeNumber(
                      findValue(row, [
                        "Trade Value",
                        "TradeValue",
                        "trade_value",
                        "Amount",
                        "Principal Amount",
                        "Notional Amount",
                        "Value",
                      ]),
                    ),
                    currency: findValue(
                      row,
                      ["Currency", "CCY", "currency", "Ccy", "Base Currency", "Deal Currency"],
                      "USD",
                    ),
                    pnlCalculated: safeNumber(
                      findValue(row, [
                        "PnL",
                        "PnL Calculated",
                        "pnl_calculated",
                        "Profit Loss",
                        "P&L",
                        "PnlCalculated",
                        "FX Gain Loss",
                        "FXGainLoss",
                      ]),
                    ),
                    fxRateUsed: safeNumber(
                      findValue(row, ["FX Rate", "FX Rate Used", "fx_rate", "Exchange Rate", "FXRate", "Rate"]),
                      1.0,
                    ),
                    costCenter: findValue(
                      row,
                      ["Cost Center", "CostCenter", "cost_center", "Department", "Business Unit", "Cost Centre"],
                      "N/A",
                    ),
                    confirmationStatus:
                      uploadedData.length > 0
                        ? uploadedData[index]?.["Confirmation Status"] ||
                          uploadedData[index]?.["ConfirmationStatus"] ||
                          "Pending"
                        : index % 3 === 0
                          ? "Failed"
                          : index % 3 === 1
                            ? "Pending"
                            : "Confirmed",
                    expenseApprovalStatus:
                      uploadedData.length > 0
                        ? uploadedData[index]?.["Expense Approval Status"] ||
                          uploadedData[index]?.["ExpenseApprovalStatus"] ||
                          "Pending"
                        : index % 4 === 0
                          ? "Rejected"
                          : index % 4 === 1
                            ? "Pending"
                            : "Approved",
                    costAllocationStatus:
                      uploadedData.length > 0
                        ? uploadedData[index]?.["Cost Allocation Status"] ||
                          uploadedData[index]?.["CostAllocationStatus"] ||
                          "Pending"
                        : index % 5 === 0
                          ? "Failed"
                          : index % 5 === 1
                            ? "Pending"
                            : "Allocated",
                    interestAmount: 0, // Placeholder, will be calculated below
                  }

                  return item
                })
              : [
                  // Sample data when no file is uploaded
                  {
                    claimId: "CLM-000001",
                    tradeId: "TRD-000001",
                    clientId: "CLI-000001",
                    counterparty: "Goldman Sachs",
                    tradeDate: "2024-01-15",
                    tradeType: "FX Forward",
                    tradeValue: 1500000,
                    currency: "USD",
                    pnlCalculated: 25000,
                    fxRateUsed: 1.085,
                    costCenter: "FX Trading",
                    confirmationStatus: "Failed",
                    expenseApprovalStatus: "Rejected",
                    costAllocationStatus: "Failed",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000002",
                    tradeId: "TRD-000002",
                    clientId: "CLI-000002",
                    counterparty: "JP Morgan",
                    tradeDate: "2024-01-16",
                    tradeType: "Interest Rate Swap",
                    tradeValue: 2300000,
                    currency: "EUR",
                    pnlCalculated: -15000,
                    fxRateUsed: 0.925,
                    costCenter: "Fixed Income",
                    confirmationStatus: "Pending",
                    expenseApprovalStatus: "Pending",
                    costAllocationStatus: "Failed",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000003",
                    tradeId: "TRD-000003",
                    clientId: "CLI-000003",
                    counterparty: "Morgan Stanley",
                    tradeDate: "2024-01-17",
                    tradeType: "Equity Option",
                    tradeValue: 850000,
                    currency: "GBP",
                    pnlCalculated: 8500,
                    fxRateUsed: 1.265,
                    costCenter: "Equity Derivatives",
                    confirmationStatus: "Failed",
                    expenseApprovalStatus: "Approved",
                    costAllocationStatus: "Allocated",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000004",
                    tradeId: "TRD-000004",
                    clientId: "CLI-000004",
                    counterparty: "Deutsche Bank",
                    tradeDate: "2024-01-18",
                    tradeType: "Credit Default Swap",
                    tradeValue: 5000000,
                    currency: "USD",
                    pnlCalculated: 75000,
                    fxRateUsed: 1.0,
                    costCenter: "Credit Trading",
                    confirmationStatus: "Confirmed",
                    expenseApprovalStatus: "Approved",
                    costAllocationStatus: "Allocated",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000005",
                    tradeId: "TRD-000005",
                    clientId: "CLI-000005",
                    counterparty: "Barclays",
                    tradeDate: "2024-01-19",
                    tradeType: "Bond Purchase",
                    tradeValue: 3200000,
                    currency: "JPY",
                    pnlCalculated: 45000,
                    fxRateUsed: 148.5,
                    costCenter: "Fixed Income",
                    confirmationStatus: "Pending",
                    expenseApprovalStatus: "Pending",
                    costAllocationStatus: "Pending",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000006",
                    tradeId: "TRD-000006",
                    clientId: "CLI-000006",
                    counterparty: "Credit Suisse",
                    tradeDate: "2024-01-20",
                    tradeType: "Currency Swap",
                    tradeValue: 1800000,
                    currency: "CHF",
                    pnlCalculated: -12000,
                    fxRateUsed: 0.915,
                    costCenter: "FX Trading",
                    confirmationStatus: "Rejected",
                    expenseApprovalStatus: "Failed",
                    costAllocationStatus: "Rejected",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000007",
                    tradeId: "TRD-000007",
                    clientId: "CLI-000007",
                    counterparty: "UBS",
                    tradeDate: "2024-01-21",
                    tradeType: "Commodity Future",
                    tradeValue: 950000,
                    currency: "USD",
                    pnlCalculated: 18500,
                    fxRateUsed: 1.0,
                    costCenter: "Commodities",
                    confirmationStatus: "Pending",
                    expenseApprovalStatus: "Under Review",
                    costAllocationStatus: "Pending",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000008",
                    tradeId: "TRD-000008",
                    clientId: "CLI-000008",
                    counterparty: "HSBC",
                    tradeDate: "2024-01-22",
                    tradeType: "FX Swap",
                    tradeValue: 2750000,
                    currency: "EUR",
                    pnlCalculated: -18000,
                    fxRateUsed: 1.095,
                    costCenter: "Emerging Markets Desk",
                    interestAmount: 0,
                  },
                  {
                    tradeId: "TRD-000009",
                    clientId: "CLI-000009",
                    counterparty: "Standard Chartered",
                    tradeDate: "2024-01-23",
                    tradeType: "Interest Rate Future",
                    currency: "SGD",
                    tradeValue: 1200000,
                    pnlCalculated: -9000,
                    fxRateUsed: 0.745,
                    costCenter: "Fixed Income",
                    confirmationStatus: "Pending",
                    expenseApprovalStatus: "Pending",
                    costAllocationStatus: "Pending",
                    interestAmount: 0,
                  },
                ]

          // Calculate interest amount for each item
          allIssuanceSourceData.forEach(item => {
            const claimReceiptData = uploadedData.length > 0
              ? uploadedData.map((row, idx) => {
                  const findValue = (row: any, possibleNames: string[], defaultValue: any = "") => {
                    for (const name of possibleNames) {
                      if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
                        return row[name]
                      }
                    }
                    return defaultValue
                  }
                  const valueDate = findValue(
                    row,
                    ["Value Date", "ValueDate", "value_date"],
                    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                  )
                  const settlementDate = findValue(
                    row,
                    ["Settlement Date", "SettlementDate", "settlement_date", "Settlement"],
                    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                  )
                                                     const valueDateObj = new Date(valueDate)
                   const settlementDateObj = new Date(settlementDate)
                   const diffTime = settlementDateObj.getTime() - valueDateObj.getTime()
                   const slaBreach = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                   const safeNumber = (value: any, defaultValue = 0): number => {
                     if (value === null || value === undefined || value === "") return defaultValue
                     const num = typeof value === "string" ? Number.parseFloat(value.replace(/[,$]/g, "")) : Number(value)
                     return isNaN(num) ? defaultValue : num
                   }
                   const notionalAmount = safeNumber(
                     findValue(row, [
                       "Notional Amount",
                       "NotionalAmount", 
                       "notional_amount",
                       "Trade Value",
                       "TradeValue",
                       "trade_value",
                       "Amount",
                       "Principal Amount",
                       "Value"
                     ]),
                     1000000
                   )
                   return {
                     tradeId: findValue(row, ["Trade ID", "TradeID", "trade_id", "TradeId", "id"], `TRD-${String(idx + 1).padStart(6, "0")}`),
                     slaBreach: slaBreach,
                     notionalAmount: notionalAmount
                   }
                })
                                             : [
                   { tradeId: "TRD-000001", slaBreach: 1, notionalAmount: 1500000 },
                   { tradeId: "TRD-000002", slaBreach: 2, notionalAmount: 2300000 },
                   { tradeId: "TRD-000003", slaBreach: 3, notionalAmount: 850000 },
                   { tradeId: "TRD-000004", slaBreach: 1, notionalAmount: 5000000 },
                   { tradeId: "TRD-000005", slaBreach: 2, notionalAmount: 3200000 },
                   { tradeId: "TRD-000006", slaBreach: 3, notionalAmount: 1800000 },
                   { tradeId: "TRD-000007", slaBreach: 1, notionalAmount: 950000 },
                   { tradeId: "TRD-000008", slaBreach: 3, notionalAmount: 2750000 }
                 ]

                                         const matchingClaimReceipt = claimReceiptData.find(claim => claim.tradeId === item.tradeId)
             const slaBreach = matchingClaimReceipt ? matchingClaimReceipt.slaBreach : 0
             const notionalAmount = matchingClaimReceipt ? matchingClaimReceipt.notionalAmount : item.tradeValue || 0
            
            const seed = item.claimId ? (item.claimId.charCodeAt(0) + item.claimId.charCodeAt(1)) : 100;
            const interestRate = ((seed % 50) / 10 + 2) / 100; // Example: 2.0% to 7.0%

            if (slaBreach > 1) {
              item.interestAmount = interestRate * notionalAmount * (slaBreach / 365);
            } else {
              item.interestAmount = 0;
            }
          });

          // Separate receivable and payable claims
          const receivableClaims = allIssuanceSourceData.filter((item) => {
            const pnl = Number(item.pnlCalculated)
            const hasIssues =
              item.confirmationStatus?.toLowerCase() === "failed" ||
              item.confirmationStatus?.toLowerCase() === "rejected" ||
              item.expenseApprovalStatus?.toLowerCase() === "failed" ||
              item.expenseApprovalStatus?.toLowerCase() === "rejected" ||
              item.costAllocationStatus?.toLowerCase() === "failed" ||
              item.costAllocationStatus?.toLowerCase() === "rejected"

            const hasPendingSettlement =
              item.confirmationStatus?.toLowerCase() === "pending" ||
              item.expenseApprovalStatus?.toLowerCase() === "pending" ||
              item.costAllocationStatus?.toLowerCase() === "pending"

            return pnl > 0 && (hasIssues || hasPendingSettlement)
          })

          const payableClaims = allIssuanceSourceData.filter((item) => {
            const pnl = Number(item.pnlCalculated)
            const costAllocationStatus = item.costAllocationStatus?.toLowerCase() || "pending"
            return pnl < 0 && (costAllocationStatus === "failed" || costAllocationStatus === "rejected")
          })

          // Generate professional PDF claim document
          const generateClaimPDF = (claim: any, claimType: "receivable" | "payable"): Promise<Blob> => {
            return new Promise((resolve) => {
              const doc = new jsPDF()
              const currentDate = new Date().toLocaleDateString()
              const interestAmount = Math.abs(Number(claim.interestAmount ?? 0))

              // Set up fonts and colors
              doc.setFont("helvetica")

              // Header with company logo area
              doc.setFillColor(0, 128, 128) // Teal color
              doc.rect(0, 0, 210, 25, "F")

              // Company name and title
              doc.setTextColor(255, 255, 255)
              doc.setFontSize(20)
              doc.setFont("helvetica", "bold")
              doc.text("CMTA OPERATIONS", 20, 15)

              doc.setFontSize(12)
              doc.setFont("helvetica", "normal")
              doc.text("Interest Claims Division", 20, 20)

              // Reset text color
              doc.setTextColor(0, 0, 0)

              // Document title
              doc.setFontSize(18)
              doc.setFont("helvetica", "bold")
              const title = claimType === "receivable" ? "CLAIM NOTICE" : "INTERNAL CLAIM PROCESSING"
              doc.text(title, 20, 40)

              // Claim information box
              doc.setFillColor(245, 245, 245)
              doc.rect(20, 50, 170, 30, "F")
              doc.setDrawColor(200, 200, 200)
              doc.rect(20, 50, 170, 30, "S")

              doc.setFontSize(10)
              doc.setFont("helvetica", "bold")
              doc.text("Claim ID:", 25, 60)
              doc.text("Date:", 25, 67)
              doc.text("Trade Reference:", 25, 74)

              doc.setFont("helvetica", "normal")
              doc.text(claim.claimId, 50, 60)
              doc.text(currentDate, 50, 67)
              doc.text(claim.tradeId, 70, 74)

              // Recipient information
              let yPos = 90
              doc.setFontSize(12)
              doc.setFont("helvetica", "bold")
              doc.text(claimType === "receivable" ? "TO:" : "INTERNAL ROUTING:", 20, yPos)

              doc.setFont("helvetica", "normal")
              doc.text(claimType === "receivable" ? claim.counterparty : "Settlements Team", 20, yPos + 7)
              doc.text(claimType === "receivable" ? "Operations Department" : "Operations Division", 20, yPos + 14)

              // Subject line
              yPos += 20
              doc.setFont("helvetica", "bold")
              doc.text("SUBJECT:", 20, yPos)
              doc.setFont("helvetica", "normal")
              const subject =
                claimType === "receivable"
                  ? `CLAIM FOR PAYMENT - Trade ${claim.tradeId}`
                  : `INTERNAL CLAIM PROCESSING - Trade ${claim.tradeId}`
              doc.text(subject, 20, yPos + 7)

              // Main content
              yPos += 20
              doc.setFont("helvetica", "normal")
              const greeting = claimType === "receivable" ? "Dear Sir/Madam," : "Dear Team,"
              doc.text(greeting, 20, yPos)

              yPos += 10
              const introText =
                claimType === "receivable"
                  ? "We hereby submit a formal claim relating to the following trade:"
                  : "We notify you of a claim relating to the following trade:"
              doc.text(introText, 20, yPos)

              // Trade details table
              yPos += 15
              doc.setFont("helvetica", "bold")
              doc.text("TRADE DETAILS:", 20, yPos)

              // Create trade details table
              const tradeDetails = [
                ["Trade ID:", claim.tradeId],
                ["Client ID:", claim.clientId],
                ["Trade Date:", new Date(claim.tradeDate).toLocaleDateString()],
                ["Trade Type:", claim.tradeType],
                ["Counterparty:", claim.counterparty],
                ["Trade Value:", `${claim.currency} ${Number(claim.tradeValue).toLocaleString()}`],
                ["Cost Center:", claim.costCenter],
              ]

              yPos += 10
              doc.setFont("helvetica", "normal")
              tradeDetails.forEach(([label, value]) => {
                doc.setFont("helvetica", "bold")
                doc.text(label, 25, yPos)
                doc.setFont("helvetica", "normal")
                doc.text(String(value), 80, yPos)
                yPos += 7
              })

              // Claim details section
              yPos += 10
              doc.setFont("helvetica", "bold")
              doc.text("CLAIM DETAILS:", 20, yPos)

              const claimDetails = [
                ["Interest Amount:", `${claim.currency} ${interestAmount.toLocaleString()}`],
                ["Claim Type:", claimType.toUpperCase()],
                ["FX Rate Applied:", Number(claim.fxRateUsed).toFixed(4)],
              ]

              yPos += 10
              doc.setFont("helvetica", "normal")
              claimDetails.forEach(([label, value]) => {
                doc.setFont("helvetica", "bold")
                doc.text(label, 25, yPos)
                doc.setFont("helvetica", "normal")
                doc.text(String(value), 80, yPos)
                yPos += 7
              })

              // Claim justification
              yPos += 10
              doc.setFont("helvetica", "bold")
              doc.text("CLAIM JUSTIFICATION:", 20, yPos)

              yPos += 10
              doc.setFont("helvetica", "normal")
              const justificationText =
                claimType === "receivable"
                  ? `This claim arises due to settlement issues and/or processing failures that have resulted in a financial loss to our organization. The positive PnL of ${claim.currency} ${interestAmount.toLocaleString()} represents amounts that should have been realized but were not due to processing issues.`
                  : `This internal claim notification is for processing a payable amount of ${claim.currency} ${interestAmount.toLocaleString()} due to cost allocation issues. The negative PnL indicates potential liability that requires internal review and processing.`

              const splitText = doc.splitTextToSize(justificationText, 170)
              doc.text(splitText, 20, yPos)
              yPos += splitText.length * 5

              // Status information
              yPos += 10
              doc.text("Status Information:", 25, yPos)
              yPos += 7
              doc.text(`• Confirmation Status: ${claim.confirmationStatus}`, 30, yPos)
              yPos += 7
              doc.text(`• Expense Approval Status: ${claim.expenseApprovalStatus}`, 30, yPos)
              yPos += 7
              doc.text(`• Cost Allocation Status: ${claim.costAllocationStatus}`, 30, yPos)

              // Supporting documentation
              yPos += 15
              doc.setFont("helvetica", "bold")
              doc.text("SUPPORTING DOCUMENTATION:", 20, yPos)

              yPos += 10
              doc.setFont("helvetica", "normal")
              const supportingDocs = [
                "• Trade confirmation details",
                "• Settlement instructions",
                "• Cost allocation records",
                "• PnL calculations",
              ]

              supportingDocs.forEach((doc_item) => {
                doc.text(doc_item, 25, yPos)
                yPos += 7
              })

              // Payment/next steps section
              yPos += 10
              doc.setFont("helvetica", "bold")
              doc.text(claimType === "receivable" ? "PAYMENT INSTRUCTIONS:" : "NEXT STEPS:", 20, yPos)

              yPos += 10
              doc.setFont("helvetica", "normal")
              const instructionsText =
                claimType === "receivable"
                  ? "Please remit payment to our designated account within 5 business days of receipt of this notice. For payment details, please contact our settlements team. We look forward to your prompt response and settlement of this claim."
                  : "Please review this claim and coordinate with the relevant departments for processing. Ensure all documentation is properly filed and approvals are obtained as required."

              const splitInstructions = doc.splitTextToSize(instructionsText, 170)
              doc.text(splitInstructions, 20, yPos)
              yPos += splitInstructions.length * 5

              // Signature section
              yPos += 20
              doc.setFont("helvetica", "normal")
              doc.text("Best regards,", 20, yPos)
              yPos += 10
              doc.setFont("helvetica", "bold")
              doc.text("Claims Management Team", 20, yPos)
              yPos += 7
              doc.text("Interest Claims Division", 20, yPos)
              yPos += 7
              doc.text("CMTA Operations", 20, yPos)

              // Footer
              yPos += 20
              doc.setFontSize(8)
              doc.setFont("helvetica", "italic")
              doc.text("This is an automated claim notice generated by the CMTA Interest Claims System.", 20, yPos)
              yPos += 5
              doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, yPos)

              // Add Interest Amount to the details table
              doc.setFont("helvetica", "bold")
              doc.text("Interest Amount:", 25, yPos)
              doc.setFont("helvetica", "normal")
              doc.text(`${claim.currency} ${interestAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, yPos)
              yPos += 7

              // Convert to blob
              const pdfBlob = doc.output("blob")
              resolve(pdfBlob)
            })
          }

          // Function to handle send email action (without PDF attachment)
          const handleSendEmail = (claim: any, claimType: "receivable" | "payable") => {
            try {
              // Generate email content
              const interestAmount = Math.abs(Number(claim.interestAmount ?? 0))
              const subject =
                claimType === "receivable"
                                  ? `URGENT: Claim Notice - Trade ${claim.tradeId} - Amount: ${claim.currency} ${interestAmount.toLocaleString()}`
                : `Internal Claim Processing Required - Trade ${claim.tradeId} - Amount: ${claim.currency} ${interestAmount.toLocaleString()}`

              const recipients =
                claimType === "receivable"
                  ? [
                      `operations@${claim.counterparty.toLowerCase().replace(/\s+/g, "")}.com`,
                      `settlements@${claim.counterparty.toLowerCase().replace(/\s+/g, "")}.com`,
                    ]
                  : ["settlements@yourfirm.com", "operations@yourfirm.com", "claims@yourfirm.com"]

              const body =
                claimType === "receivable"
                  ? `Dear ${claim.counterparty} Operations Team,

We hereby submit a formal claim notice for Trade ${claim.tradeId}.

CLAIM SUMMARY:
- Claim ID: ${claim.claimId}
- Trade ID: ${claim.tradeId}
- Interest Amount: ${claim.currency} ${interestAmount.toLocaleString()}
- Trade Date: ${new Date(claim.tradeDate).toLocaleDateString()}
- Trade Type: ${claim.tradeType}
- Counterparty: ${claim.counterparty}
- Cost Center: ${claim.costCenter}

CLAIM DETAILS:
This claim arises from settlement issues and processing failures that have resulted in unrealized profits. The positive PnL of ${claim.currency} ${interestAmount.toLocaleString()} represents amounts that should have been realized but were not due to processing issues.

TRADE STATUS INFORMATION:
- Confirmation Status: ${claim.confirmationStatus}
- Expense Approval Status: ${claim.expenseApprovalStatus}
- Cost Allocation Status: ${claim.costAllocationStatus}

SUPPORTING DOCUMENTATION:
- Trade confirmation details
- Settlement instructions
- Cost allocation records
- PnL calculations

PAYMENT INSTRUCTIONS:
Please remit payment to our designated account within 5 business days of receipt of this notice. For payment details, please contact our settlements team at settlements@cmta.com.

We request your immediate attention and settlement of this claim. Please confirm receipt of this claim and provide your expected settlement timeline.

For any questions, please contact our Claims Management Team.

Best regards,
Claims Management Team
CMTA Operations
Phone: +1 (555) 123-4567
Email: claims@cmta.com

---
This is an automated claim notice from the CMTA Interest Claims System.
Generated on: ${new Date().toLocaleString()}`
                  : `Dear Settlements Team,

We notify you of an internal claim requiring your attention and processing.

CLAIM SUMMARY:
- Claim ID: ${claim.claimId}
- Trade ID: ${claim.tradeId}
- Interest Amount: ${claim.currency} ${interestAmount.toLocaleString()}
- Trade Date: ${new Date(claim.tradeDate).toLocaleDateString()}
- Counterparty: ${claim.counterparty}
- Claim Type: PAYABLE
- Cost Center: ${claim.costCenter}

CLAIM DETAILS:
This internal claim notification is for a payable amount of ${claim.currency} ${interestAmount.toLocaleString()} due to cost allocation issues and processing failures. The negative PnL indicates potential liability that requires internal review and processing.

TRADE STATUS INFORMATION:
- Confirmation Status: ${claim.confirmationStatus}
- Expense Approval Status: ${claim.expenseApprovalStatus}
- Cost Allocation Status: ${claim.costAllocationStatus}

REQUIRED ACTIONS:
1. Review claim documentation and trade details
2. Verify calculations and supporting data
3. Coordinate with relevant departments for processing
4. Process payment if approved according to internal procedures
5. Update claim status in system once processed

Please confirm receipt of this notification and provide expected processing timeline.

Best regards,
Claims Management Team
CMTA Operations

---
This is an automated internal claim notice from the CMTA Interest Claims System.
Generated on: ${new Date().toLocaleString()}`

              // Create Gmail URL
              const params = new URLSearchParams({
                to: recipients.join(","),
                subject: subject,
                body: body,
              })

              const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`

              // Open Gmail
              window.open(gmailUrl, "_blank")

              // Show success message
              alert(`Email compose window opened successfully. The claim notice has been prepared for sending.`)
            } catch (error) {
              console.error("Error generating email:", error)
              alert("Error generating email. Please try again.")
            }
          }

          // Function to generate and download PDF claim document (for viewing only)
          const handleDownloadPDF = async (claim: any, claimType: "receivable" | "payable") => {
            try {
              // Generate PDF
              const pdfBlob = await generateClaimPDF(claim, claimType)

              // Create download link for PDF
              const url = URL.createObjectURL(pdfBlob)
              const a = document.createElement("a")
              a.href = url
              a.download = `${claimType === "receivable" ? "Claim_Notice" : "Internal_Claim"}_${claim.claimId}_${claim.tradeId}.pdf`
              a.click()
              URL.revokeObjectURL(url)

              // Show success message
              alert(`PDF claim document has been downloaded successfully.`)
            } catch (error) {
              console.error("Error generating PDF:", error)
              alert("Error generating PDF. Please try again.")
            }
          }

          // Render issuance subtab content
          const renderIssuanceSubTabContent = () => {
            const currentClaims = issuanceSubTab === "receivable-claims" ? receivableClaims : payableClaims
            const claimType = issuanceSubTab === "receivable-claims" ? "receivable" : "payable"
            const isReceivable = issuanceSubTab === "receivable-claims"

            if (currentClaims.length === 0) {
              return (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No {isReceivable ? "Receivable" : "Payable"} Claims Found
                  </h3>
                  <p className="text-gray-500">
                    {isReceivable
                      ? "No claims where your firm is owed money were found in the registration data."
                      : "No claims where your firm owes money were found in the registration data."}
                  </p>
                </div>
              )
            }

            return (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div
                    className={`p-4 border rounded-lg ${isReceivable ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
                  >
                    <div className={`text-2xl font-bold ${isReceivable ? "text-green-600" : "text-red-600"}`}>
                      {currentClaims.length}
                    </div>
                    <div className={`text-sm ${isReceivable ? "text-green-700" : "text-red-700"}`}>
                      {isReceivable ? "Receivable" : "Payable"} Claims
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      $
                      {currentClaims
                        .reduce((sum, item) => sum + Math.abs(Number(item.interestAmount || 0)), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-blue-700">Total Interest Amount</div>
                  </div>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      $
                      {currentClaims.length > 0
                        ? (
                            currentClaims.reduce((sum, item) => sum + Math.abs(Number(item.pnlCalculated)), 0) /
                            currentClaims.length
                          ).toLocaleString()
                        : "0"}
                    </div>
                    <div className="text-sm text-purple-700">Average Claim</div>
                  </div>
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {currentClaims.filter((claim) => Math.abs(Number(claim.pnlCalculated)) > 50000).length}
                    </div>
                    <div className="text-sm text-orange-700">High Value Claims</div>
                  </div>
                </div>

                {/* Claims Table */}
                <Card>
                  <CardHeader>
                    <CardTitle
                      className={`text-xl font-bold flex items-center ${isReceivable ? "text-green-700" : "text-red-700"}`}
                    >
                      <Target className="h-6 w-6 mr-2" />
                      {isReceivable ? "Receivable Claims Engine" : "Payable Claims Engine"}
                    </CardTitle>
                    <CardDescription>
                      {isReceivable
                        ? "Claims where your firm is owed money. Documents will be dispatched to counterparties via email."
                        : "Claims where your firm owes money will be routed to internal settlements team."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow
                              className={
                                isReceivable ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"
                              }
                            >
                              <TableHead
                                className={`font-semibold ${isReceivable ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}
                              >
                                Claim ID
                              </TableHead>
                              <TableHead
                                className={`font-semibold ${isReceivable ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}
                              >
                                Trade ID
                              </TableHead>
                              <TableHead
                                className={`font-semibold ${isReceivable ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}
                              >
                                Counterparty
                              </TableHead>
                              <TableHead
                                className={`font-semibold ${isReceivable ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}
                              >
                                Trade Date
                              </TableHead>
                              <TableHead
                                className={`font-semibold ${isReceivable ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}
                              >
                                Trade Type
                              </TableHead>
                              <TableHead
                                className={`font-semibold ${isReceivable ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"} text-right`}
                              >
                                Interest Amount
                              </TableHead>
                              <TableHead
                                className={`font-semibold ${isReceivable ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}
                              >
                                Currency
                              </TableHead>
                              <TableHead
                                className={`font-semibold ${isReceivable ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}
                              >
                                Status
                              </TableHead>
                              <TableHead
                                className={`font-semibold ${isReceivable ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}
                              >
                                Actions
                              </TableHead>

                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentClaims.map((claim, index) => (
                              <TableRow
                                key={index}
                                className={`hover:${isReceivable ? "bg-green-50 dark:hover:bg-green-900/10" : "bg-red-50 dark:hover:bg-red-900/10"}`}
                              >
                                <TableCell
                                  className={`font-mono text-sm font-medium ${isReceivable ? "text-green-600" : "text-red-600"}`}
                                >
                                  {claim.claimId}
                                </TableCell>
                                <TableCell className="font-mono text-sm font-medium text-blue-600">
                                  {claim.tradeId}
                                </TableCell>
                                <TableCell className="font-medium">{claim.counterparty}</TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(claim.tradeDate).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="border-gray-300 text-gray-700">
                                    {claim.tradeType}
                                  </Badge>
                                </TableCell>
                                <TableCell
                                  className={`text-right font-medium ${isReceivable ? "text-green-600" : "text-red-600"}`}
                                >
                                  {isReceivable ? "+" : "-"}${Math.abs(Number(claim.interestAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="font-medium">{claim.currency}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="border-orange-500 text-orange-600">
                                    {isReceivable ? "Ready to Issue" : "Ready to Process"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleSendEmail(claim, claimType as "receivable" | "payable")}
                                      className={`${isReceivable ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"} text-white`}
                                    >
                                      <FileText className="h-4 w-4 mr-1" />
                                      {isReceivable ? "Send Email" : "Send Internal"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={`${isReceivable ? "border-green-500 text-green-600 hover:bg-green-50" : "border-red-500 text-red-600 hover:bg-red-50"} bg-transparent`}
                                      onClick={() => handleDownloadPDF(claim, claimType as "receivable" | "payable")}
                                    >
                                      <Download className="h-4 w-4 mr-1" />
                                      Download PDF
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>


              </div>
            )
          }

          return (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Claim Issuance</CardTitle>
                      <CardDescription>
                        Issue approved claims using dedicated engines for receivable and payable claims. Generate
                        comprehensive claim documents and dispatch via email.
                      </CardDescription>
                    </div>

                  </div>
                </CardHeader>
                <CardContent>
                  {/* Overall Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{allIssuanceSourceData.length}</div>
                      <div className="text-sm text-blue-700">Total Claims</div>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{receivableClaims.length}</div>
                      <div className="text-sm text-green-700">Receivable Claims</div>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{payableClaims.length}</div>
                      <div className="text-sm text-red-700">Payable Claims</div>
                    </div>
                    <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                      <div className="text-2xl font-bold text-teal-600">
                        $
                        {Math.abs(
                          receivableClaims.reduce((sum, item) => sum + Number(item.pnlCalculated), 0) +
                            payableClaims.reduce((sum, item) => sum + Number(item.pnlCalculated), 0),
                        ).toLocaleString()}
                      </div>
                      <div className="text-sm text-teal-700">Total Claim Value</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Issuance Subtabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <ScrollArea className="w-full">
                  <nav className="flex space-x-1 p-1 min-w-max">
                    {issuanceSubTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setIssuanceSubTab(tab.id)}
                        className={`whitespace-nowrap py-2 px-4 border-b-2 font-medium text-sm transition-colors rounded-t-lg flex items-center space-x-2 ${
                          issuanceSubTab === tab.id
                            ? tab.id === "receivable-claims"
                              ? "border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                              : "border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                </ScrollArea>
              </div>

              {/* Issuance Content */}
              {renderIssuanceSubTabContent()}
            </div>
          )
        case "claim-settlement": {
          // Use the SAME data source as Claim Issuance tab
          const allSettlementSourceData =
            uploadedData.length > 0
              ? uploadedData.map((row, index) => {
                  // Helper function to safely convert to number
                  const safeNumber = (value: any, defaultValue = 0): number => {
                    if (value === null || value === undefined || value === "") return defaultValue
                    const num =
                      typeof value === "string" ? Number.parseFloat(value.replace(/[,$]/g, "")) : Number(value)
                    return isNaN(num) ? defaultValue : num
                  }

                  // Helper function to find value from multiple possible column names
                  const findValue = (row: any, possibleNames: string[], defaultValue: any = "") => {
                    for (const name of possibleNames) {
                      if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
                        return row[name]
                      }
                    }
                    return defaultValue
                  }

                  const item = {
                    claimId: `CLM-${String(index + 1).padStart(6, "0")}`,
                    tradeId: findValue(
                      row,
                      ["Trade ID", "TradeID", "trade_id", "ID"],
                      `TRD-${String(index + 1).padStart(6, "0")}`,
                    ),
                    clientId: `CLI-${String(index + 1).padStart(6, "0")}`,
                    counterparty: findValue(
                      row,
                      ["Counterparty", "Counter Party", "counterparty", "Broker"],
                      "Unknown",
                    ),
                    tradeDate: findValue(
                      row,
                      ["Trade Date", "TradeDate", "trade_date", "Date"],
                      new Date().toISOString().split("T")[0],
                    ),
                    tradeType: findValue(
                      row,
                      ["Trade Type", "TradeType", "trade_type", "Type", "Product Type"],
                      "Unknown",
                    ),
                    tradeValue: safeNumber(
                      findValue(row, [
                        "Trade Value",
                        "TradeValue",
                        "trade_value",
                        "Amount",
                        "Principal Amount",
                        "Notional Amount",
                        "Value",
                      ]),
                    ),
                    currency: findValue(
                      row,
                      ["Currency", "CCY", "currency", "Ccy", "Base Currency", "Deal Currency"],
                      "USD",
                    ),
                    pnlCalculated: safeNumber(
                      findValue(row, [
                        "PnL",
                        "PnL Calculated",
                        "pnl_calculated",
                        "Profit Loss",
                        "P&L",
                        "PnlCalculated",
                        "FX Gain Loss",
                        "FXGainLoss",
                      ]),
                    ),
                    fxRateUsed: safeNumber(
                      findValue(row, ["FX Rate", "FX Rate Used", "fx_rate", "Exchange Rate", "FXRate", "Rate"]),
                      1.0,
                    ),
                    costCenter: findValue(
                      row,
                      ["Cost Center", "CostCenter", "cost_center", "Department", "Business Unit", "Cost Centre"],
                      "N/A",
                    ),
                    confirmationStatus:
                      uploadedData.length > 0
                        ? uploadedData[index]?.["Confirmation Status"] ||
                          uploadedData[index]?.["ConfirmationStatus"] ||
                          "Pending"
                        : index % 3 === 0
                          ? "Failed"
                          : index % 3 === 1
                            ? "Pending"
                            : "Confirmed",
                    expenseApprovalStatus:
                      uploadedData.length > 0
                        ? uploadedData[index]?.["Expense Approval Status"] ||
                          uploadedData[index]?.["ExpenseApprovalStatus"] ||
                          "Pending"
                        : index % 4 === 0
                          ? "Rejected"
                          : index % 4 === 1
                            ? "Pending"
                            : "Approved",
                    costAllocationStatus:
                      uploadedData.length > 0
                        ? uploadedData[index]?.["Cost Allocation Status"] ||
                          uploadedData[index]?.["CostAllocationStatus"] ||
                          "Pending"
                        : index % 5 === 0
                          ? "Failed"
                          : index % 5 === 1
                            ? "Pending"
                            : "Allocated",
                    interestAmount: 0, // Placeholder, will be calculated below
                  }

                  return item
                })
              : [
                  // Sample data when no file is uploaded (same as Claim Issuance)
                  {
                    claimId: "CLM-000001",
                    tradeId: "TRD-000001",
                    clientId: "CLI-000001",
                    counterparty: "Goldman Sachs",
                    tradeDate: "2024-01-15",
                    tradeType: "FX Forward",
                    tradeValue: 1500000,
                    currency: "USD",
                    pnlCalculated: 25000,
                    fxRateUsed: 1.085,
                    costCenter: "FX Trading",
                    confirmationStatus: "Failed",
                    expenseApprovalStatus: "Rejected",
                    costAllocationStatus: "Failed",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000002",
                    tradeId: "TRD-000002",
                    clientId: "CLI-000002",
                    counterparty: "JP Morgan",
                    tradeDate: "2024-01-16",
                    tradeType: "Interest Rate Swap",
                    tradeValue: 2300000,
                    currency: "EUR",
                    pnlCalculated: -15000,
                    fxRateUsed: 0.925,
                    costCenter: "Fixed Income",
                    confirmationStatus: "Pending",
                    expenseApprovalStatus: "Pending",
                    costAllocationStatus: "Failed",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000003",
                    tradeId: "TRD-000003",
                    clientId: "CLI-000003",
                    counterparty: "Morgan Stanley",
                    tradeDate: "2024-01-17",
                    tradeType: "Equity Option",
                    tradeValue: 850000,
                    currency: "GBP",
                    pnlCalculated: 8500,
                    fxRateUsed: 1.265,
                    costCenter: "Equity Derivatives",
                    confirmationStatus: "Failed",
                    expenseApprovalStatus: "Approved",
                    costAllocationStatus: "Allocated",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000004",
                    tradeId: "TRD-000004",
                    clientId: "CLI-000004",
                    counterparty: "Deutsche Bank",
                    tradeDate: "2024-01-18",
                    tradeType: "Credit Default Swap",
                    tradeValue: 5000000,
                    currency: "USD",
                    pnlCalculated: 75000,
                    fxRateUsed: 1.0,
                    costCenter: "Credit Trading",
                    confirmationStatus: "Confirmed",
                    expenseApprovalStatus: "Approved",
                    costAllocationStatus: "Allocated",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000005",
                    tradeId: "TRD-000005",
                    clientId: "CLI-000005",
                    counterparty: "Barclays",
                    tradeDate: "2024-01-19",
                    tradeType: "Bond Purchase",
                    tradeValue: 3200000,
                    currency: "JPY",
                    pnlCalculated: 45000,
                    fxRateUsed: 148.5,
                    costCenter: "Fixed Income",
                    confirmationStatus: "Pending",
                    expenseApprovalStatus: "Pending",
                    costAllocationStatus: "Pending",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000006",
                    tradeId: "TRD-000006",
                    clientId: "CLI-000006",
                    counterparty: "Credit Suisse",
                    tradeDate: "2024-01-20",
                    tradeType: "Currency Swap",
                    tradeValue: 1800000,
                    currency: "CHF",
                    pnlCalculated: -12000,
                    fxRateUsed: 0.915,
                    costCenter: "FX Trading",
                    confirmationStatus: "Rejected",
                    expenseApprovalStatus: "Failed",
                    costAllocationStatus: "Rejected",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000007",
                    tradeId: "TRD-000007",
                    clientId: "CLI-000007",
                    counterparty: "UBS",
                    tradeDate: "2024-01-21",
                    tradeType: "Commodity Future",
                    tradeValue: 950000,
                    currency: "USD",
                    pnlCalculated: 18500,
                    fxRateUsed: 1.0,
                    costCenter: "Commodities",
                    confirmationStatus: "Pending",
                    expenseApprovalStatus: "Under Review",
                    costAllocationStatus: "Pending",
                    interestAmount: 0,
                  },
                  {
                    claimId: "CLM-000008",
                    tradeId: "TRD-000008",
                    clientId: "CLI-000008",
                    counterparty: "HSBC",
                    tradeDate: "2024-01-22",
                    tradeType: "FX Swap",
                    tradeValue: 2750000,
                    currency: "EUR",
                    pnlCalculated: -18000,
                    fxRateUsed: 1.095,
                    costCenter: "Emerging Markets Desk",
                    interestAmount: 0,
                  },
                ]

          // Calculate interest amount for each item
          allSettlementSourceData.forEach(item => {
            const claimReceiptData = uploadedData.length > 0
              ? uploadedData.map((row, idx) => {
                  const findValue = (row: any, possibleNames: string[], defaultValue: any = "") => {
                    for (const name of possibleNames) {
                      if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
                        return row[name]
                      }
                    }
                    return defaultValue
                  }
                  const valueDate = findValue(
                    row,
                    ["Value Date", "ValueDate", "value_date"],
                    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                  )
                  const settlementDate = findValue(
                    row,
                    ["Settlement Date", "SettlementDate", "settlement_date", "Settlement"],
                    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                  )
                                                     const valueDateObj = new Date(valueDate)
                   const settlementDateObj = new Date(settlementDate)
                   const diffTime = settlementDateObj.getTime() - valueDateObj.getTime()
                   const slaBreach = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                   const safeNumber = (value: any, defaultValue = 0): number => {
                     if (value === null || value === undefined || value === "") return defaultValue
                     const num = typeof value === "string" ? Number.parseFloat(value.replace(/[,$]/g, "")) : Number(value)
                     return isNaN(num) ? defaultValue : num
                   }
                   const notionalAmount = safeNumber(
                     findValue(row, [
                       "Notional Amount",
                       "NotionalAmount", 
                       "notional_amount",
                       "Trade Value",
                       "TradeValue",
                       "trade_value",
                       "Amount",
                       "Principal Amount",
                       "Value"
                     ]),
                     1000000
                   )
                   return {
                     tradeId: findValue(row, ["Trade ID", "TradeID", "trade_id", "TradeId", "id"], `TRD-${String(idx + 1).padStart(6, "0")}`),
                     slaBreach: slaBreach,
                     notionalAmount: notionalAmount
                   }
                })
                                             : [
                   { tradeId: "TRD-000001", slaBreach: 1, notionalAmount: 1500000 },
                   { tradeId: "TRD-000002", slaBreach: 2, notionalAmount: 2300000 },
                   { tradeId: "TRD-000003", slaBreach: 3, notionalAmount: 850000 },
                   { tradeId: "TRD-000004", slaBreach: 1, notionalAmount: 5000000 },
                   { tradeId: "TRD-000005", slaBreach: 2, notionalAmount: 3200000 },
                   { tradeId: "TRD-000006", slaBreach: 3, notionalAmount: 1800000 },
                   { tradeId: "TRD-000007", slaBreach: 1, notionalAmount: 950000 },
                   { tradeId: "TRD-000008", slaBreach: 3, notionalAmount: 2750000 }
                 ]

                                         const matchingClaimReceipt = claimReceiptData.find(claim => claim.tradeId === item.tradeId)
             const slaBreach = matchingClaimReceipt ? matchingClaimReceipt.slaBreach : 0
             const notionalAmount = matchingClaimReceipt ? matchingClaimReceipt.notionalAmount : item.tradeValue || 0
            
            const seed = item.claimId ? (item.claimId.charCodeAt(0) + item.claimId.charCodeAt(1)) : 100;
            const interestRate = ((seed % 50) / 10 + 2) / 100; // Example: 2.0% to 7.0%

            if (slaBreach > 1) {
              item.interestAmount = interestRate * notionalAmount * (slaBreach / 365);
            } else {
              item.interestAmount = 0;
            }
          });

          // Use the SAME classification logic as Claim Issuance tab
          const receivableClaims = allSettlementSourceData.filter((item) => {
            const pnl = Number(item.pnlCalculated)
            const confirmationStatus = item.confirmationStatus?.toLowerCase() || "pending"
            const expenseApprovalStatus = item.expenseApprovalStatus?.toLowerCase() || "pending"
            const costAllocationStatus = item.costAllocationStatus?.toLowerCase() || "pending"

            // Check for settlement issues, rejections, or failures
            const hasIssues =
              confirmationStatus === "failed" ||
              confirmationStatus === "rejected" ||
              expenseApprovalStatus === "failed" ||
              expenseApprovalStatus === "rejected" ||
              costAllocationStatus === "failed" ||
              costAllocationStatus === "rejected"

            // Check for pending settlement (settlement delay)
            const hasPendingSettlement =
              confirmationStatus === "pending" || expenseApprovalStatus === "pending" || costAllocationStatus === "pending"

            // Apply classification logic
            if (pnl > 0 && (hasIssues || hasPendingSettlement)) {
              return true
            } else if (pnl > 0 && hasPendingSettlement) {
              return true
            }

            return false
          })

          const payableClaims = allSettlementSourceData.filter((item) => {
            const pnl = Number(item.pnlCalculated)
            const costAllocationStatus = item.costAllocationStatus?.toLowerCase() || "pending"

            // Apply classification logic
            if (pnl < 0 && (costAllocationStatus === "failed" || costAllocationStatus === "rejected")) {
              return true
            }

            return false
          })
          const claimsToShow = selectedClaimType === 'receivable' ? receivableClaims : payableClaims;

          // Helper functions for settlement tracking (using the same data structure as Claim Issuance)
          const getClaimId = (row: any) => {
            return row.claimId || `CLM-${Math.random().toString(36).substr(2, 9)}`;
          };

          const getClaimType = (row: any) => {
            const pnl = Number(row.pnlCalculated)
            const confirmationStatus = row.confirmationStatus?.toLowerCase() || "pending"
            const expenseApprovalStatus = row.expenseApprovalStatus?.toLowerCase() || "pending"
            const costAllocationStatus = row.costAllocationStatus?.toLowerCase() || "pending"

            // Check for settlement issues, rejections, or failures
            const hasIssues =
              confirmationStatus === "failed" ||
              confirmationStatus === "rejected" ||
              expenseApprovalStatus === "failed" ||
              expenseApprovalStatus === "rejected" ||
              costAllocationStatus === "failed" ||
              costAllocationStatus === "rejected"

            // Check for pending settlement (settlement delay)
            const hasPendingSettlement =
              confirmationStatus === "pending" || expenseApprovalStatus === "pending" || costAllocationStatus === "pending"

            // Apply classification logic
            if (pnl > 0 && (hasIssues || hasPendingSettlement)) {
              return "Receivable"
            } else if (pnl > 0 && hasPendingSettlement) {
              return "Receivable"
            } else if (pnl < 0 && (costAllocationStatus === "failed" || costAllocationStatus === "rejected")) {
              return "Payable"
            }

            return "N/A"
          };

          const getPnL = (row: any) => {
            return Number(row.pnlCalculated) || 0;
          };

          const getInterestAmount = (row: any) => {
            // Use the same interest calculation logic as the registration tab
            // Get claimId to match with registration data
            const claimId = getClaimId(row);
            
            // Get slaBreach and notionalAmount data (same as registration tab)
            const claimReceiptData = uploadedData.length > 0
              ? uploadedData.map((row, idx) => {
                  const findValue = (row: any, possibleNames: string[], defaultValue: any = "") => {
                    for (const name of possibleNames) {
                      if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
                        return row[name]
                      }
                    }
                    return defaultValue
                  }

                  const safeNumber = (value: any, defaultValue = 0): number => {
                    if (value === null || value === undefined || value === "") return defaultValue
                    const num = typeof value === "string" ? Number.parseFloat(value.replace(/[,$]/g, "")) : Number(value)
                    return isNaN(num) ? defaultValue : num
                  }

                  const tradeDate = new Date(findValue(row, ["Trade Date", "TradeDate", "trade_date"], "2024-01-15"))
                  const valueDate = new Date(findValue(row, ["Value Date", "ValueDate", "value_date"], "2024-01-16"))
                  const settlementDate = new Date(findValue(row, ["Settlement Date", "SettlementDate", "settlement_date"], "2024-01-17"))

                  const timeDiff = settlementDate.getTime() - valueDate.getTime()
                  const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24))

                  const notionalAmount = safeNumber(findValue(row, [
                    "Notional Amount", "NotionalAmount", "notional_amount", "Trade Value", "TradeValue", "trade_value", "Amount", "Principal Amount", "Value"
                  ]))

                  return {
                    tradeId: findValue(row, ["Trade ID", "TradeID", "trade_id", "TradeId", "id"], `TRD-${String(idx + 1).padStart(6, "0")}`),
                    slaBreach: diffDays,
                    notionalAmount: notionalAmount
                  }
                })
              : [
                  { tradeId: "TRD-000001", slaBreach: 1, notionalAmount: 1500000 },
                  { tradeId: "TRD-000002", slaBreach: 2, notionalAmount: 2300000 },
                  { tradeId: "TRD-000003", slaBreach: 3, notionalAmount: 850000 },
                  { tradeId: "TRD-000004", slaBreach: 1, notionalAmount: 5000000 },
                  { tradeId: "TRD-000005", slaBreach: 2, notionalAmount: 3200000 },
                  { tradeId: "TRD-000006", slaBreach: 3, notionalAmount: 1800000 },
                  { tradeId: "TRD-000007", slaBreach: 1, notionalAmount: 950000 },
                  { tradeId: "TRD-000008", slaBreach: 3, notionalAmount: 2750000 }
                ]

            const matchingClaimReceipt = claimReceiptData.find(claim => claim.tradeId === row.tradeId)
            const slaBreach = matchingClaimReceipt ? matchingClaimReceipt.slaBreach : 0
            const notionalAmount = matchingClaimReceipt ? matchingClaimReceipt.notionalAmount : row.tradeValue || 0

            // Use same interest rate calculation as registration tab
            const seed = claimId ? (claimId.charCodeAt(0) + claimId.charCodeAt(1)) : 100;
            const interestRate = ((seed % 50) / 10 + 2) / 100;
            
            if (slaBreach > 1) {
              const interestAmount = interestRate * notionalAmount * (slaBreach / 365);
              return interestAmount;
            } else {
              return 0;
            }
          };

          const getClientName = (row: any) => {
            return row.counterparty || "Unknown";
          };

          const getCurrency = (row: any) => {
            return row.currency || "USD";
          };

          const handleStatusChange = (claimId: string, status: string) => {
            setSettlementStatuses(prev => ({ ...prev, [claimId]: status }));
          };

          const handleDateChange = (claimId: string, date: string) => {
            setSettlementDates(prev => ({ ...prev, [claimId]: date }));
          };

          const handleAmountChange = (claimId: string, amount: number) => {
            setSettlementAmounts(prev => ({ ...prev, [claimId]: amount }));
          };

          return (
            <div className="space-y-6">
            <Card>
                <CardHeader>
                  <CardTitle>Claim Settlement Tracking</CardTitle>
                  <CardDescription>
                    Track settlement status for classified claims from previous subtabs. All receivable and payable claims are automatically carried forward.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Settlement Summary */}
                  {claimsToShow.length > 0 && (
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>Settlement Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">
                              {claimsToShow.length}
                            </div>
                            <div className="text-sm text-gray-600">Total Claims</div>
                          </div>
                          <div className="text-center p-4 bg-yellow-50 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-600">
                              {claimsToShow.filter((row: any) => {
                                const claimId = getClaimId(row);
                                return (settlementStatuses[claimId] || 'Pending') === 'Pending';
                              }).length}
                            </div>
                            <div className="text-sm text-gray-600">Pending</div>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">
                              {claimsToShow.filter((row: any) => {
                                const claimId = getClaimId(row);
                                return (settlementStatuses[claimId] || 'Pending') === 'Settled';
                              }).length}
                            </div>
                            <div className="text-sm text-gray-600">Settled</div>
                          </div>
                          <div className="text-center p-4 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-600">
                              ${claimsToShow.reduce((total: number, row: any) => {
                                const claimId = getClaimId(row);
                                return total + (settlementAmounts[claimId] || getInterestAmount(row));
                              }, 0).toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-600">Total Amount</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Select value={selectedClaimType} onValueChange={value => setSelectedClaimType(value as 'receivable' | 'payable')}>
                        <SelectTrigger className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receivable">Receivable Claims ({receivableClaims.length})</SelectItem>
                          <SelectItem value="payable">Payable Claims ({payableClaims.length})</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-600">
                        Total {selectedClaimType === 'receivable' ? 'Receivable' : 'Payable'} Claims: {claimsToShow.length}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Auto-map fields for settlement
                          const firebaseHeaders = interestClaimsData.length > 0 ? Object.keys(interestClaimsData[0]) : [];
                          const autoMappedFields = createSettlementFieldMapping(firebaseHeaders);
                          setFieldMapping(prev => ({ ...prev, ...autoMappedFields }));
                          alert(`Auto-mapped ${Object.keys(autoMappedFields).length} fields. Check the mapping below.`);
                        }}
                      >
                        Auto Map Fields
                      </Button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claim ID</TableHead>
                          <TableHead>Claim Type</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Interest Amount</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead>Settlement Status</TableHead>
                          <TableHead>Settlement Date</TableHead>
                          <TableHead>Settlement Amount</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {claimsToShow.map((row: any, idx: number) => {
                          const claimId = getClaimId(row);
                          const currentStatus = settlementStatuses[claimId] || 'Pending';
                          const currentDate = settlementDates[claimId] || '';
                          const currentAmount = settlementAmounts[claimId] || getInterestAmount(row);
                          
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{claimId}</TableCell>
                              <TableCell>
                                <Badge variant={getClaimType(row) === 'Receivable' ? 'default' : 'secondary'}>
                                  {getClaimType(row)}
                                </Badge>
                              </TableCell>
                              <TableCell>{getClientName(row)}</TableCell>
                              <TableCell className={getInterestAmount(row) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                ${Math.abs(getInterestAmount(row)).toLocaleString()}
                              </TableCell>
                              <TableCell>{getCurrency(row)}</TableCell>
                              <TableCell>
                                <Select value={currentStatus} onValueChange={(value) => handleStatusChange(claimId, value)}>
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                    <SelectItem value="Settled">Settled</SelectItem>
                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <input
                                  type="date"
                                  value={currentDate}
                                  onChange={(e) => handleDateChange(claimId, e.target.value)}
                                  className="w-32 px-2 py-1 border rounded text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="number"
                                  value={currentAmount}
                                  onChange={(e) => handleAmountChange(claimId, Number(e.target.value))}
                                  className="w-24 px-2 py-1 border rounded text-sm"
                                  step="0.01"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // Mark as settled
                                    handleStatusChange(claimId, 'Settled');
                                    if (!currentDate) {
                                      handleDateChange(claimId, new Date().toISOString().split('T')[0]);
                                    }
                                  }}
                                  disabled={currentStatus === 'Settled'}
                                >
                                  Mark Settled
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {claimsToShow.length === 0 && (
                      <div className="text-gray-500 text-center py-8">
                        No {selectedClaimType} claims found. Upload data in the Data Upload tab and classify claims in the Claim Registration subtab first.
                      </div>
                    )}
                  </div>
              </CardContent>
            </Card>


            </div>
          );
        }

        default:
          return renderClaimsSubTabContent()
      }
    }

    // Helper function to generate status badges
    const getStatusBadge = (status: string, type: string) => {
      const lowerStatus = status.toLowerCase()

      switch (lowerStatus) {
        case "confirmed":
        case "allocated":
        case "approved":
          return (
            <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">
              {status}
            </Badge>
          )
        case "pending":
        case "under review":
          return (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-50">
              {status}
            </Badge>
          )
        case "failed":
        case "rejected":
          return (
            <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50">
              {status}
            </Badge>
          )
        default:
          return (
            <Badge variant="outline" className="border-gray-500 text-gray-600">
              {status}
            </Badge>
          )
      }
    }

    // Function to categorize settlement claims based on business rules  
    const categorizeSettlementClaim = (item: any): string => {
      const categories: string[] = []

      // Check status-based categorization
      if (item.confirmationStatus?.toLowerCase() === "failed") {
        categories.push("Failed Confirmation")
      }
      if (item.expenseApprovalStatus?.toLowerCase() === "rejected") {
        categories.push("Expense Rejected")
      }
      if (item.costAllocationStatus?.toLowerCase() === "failed") {
        categories.push("Cost Allocation Failed")
      }

      return categories.length > 0 ? categories.join(", ") : "No Issues"
    }

    // --- Claim Settlement Table with Auto Field Mapping from Firebase ---
    const firebaseHeaders = interestClaimsData.length > 0 ? Object.keys(interestClaimsData[0]) : [];
    const settlementFieldMapping = createSettlementFieldMapping(firebaseHeaders);

    const settlementColumns = [
      { key: "claimId", label: "Claim ID" },
      { key: "claimType", label: "Claim Type" },
      { key: "costBookedDate", label: "Cost Booked Date" },
      { key: "settlementCurrency", label: "Settlement Currency" },
      { key: "netAmount", label: "Net Amount" },
      { key: "settlementStatus", label: "Settlement Status" },
      { key: "settlementMethod", label: "Settlement Method" },
      { key: "settlementDate", label: "Settlement Date" },
      { key: "comments", label: "Comments" },
    ];

    const getClaimId = (row: any) =>
      fieldMapping.claimId && row[fieldMapping.claimId]
        ? row[fieldMapping.claimId]
        : row.claimId || row.claim_id || "-";

    const getClaimType = (row: any) =>
      fieldMapping.claimType && row[fieldMapping.claimType]
        ? row[fieldMapping.claimType]
        : row.claimType || row.claim_type || determineClaimType(row) || "-";

    const getMappedValue = (row: any, fieldKey: string) => {
      const mappedField = settlementFieldMapping[fieldKey];
      return mappedField ? row[mappedField] : "";
    };

    const renderSettlementTable = () => (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Claim Settlement (Auto-Mapped from Firebase)</CardTitle>
            <CardDescription>
              This table displays all claims from Firebase with auto-mapped settlement fields.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {settlementColumns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interestClaimsData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{getClaimId(row)}</TableCell>
                      <TableCell>{getClaimType(row)}</TableCell>
                      {settlementColumns.slice(2).map((col) => (
                        <TableCell key={col.key}>{getMappedValue(row, col.key)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {interestClaimsData.length === 0 && (
                <div className="text-gray-500 text-center py-8">No data found in Firebase.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
    // ... existing code ...
    // In the Claim Settlement subtab, replace the old table rendering with:
    {renderSettlementTable()}
    // ... existing code ...

    return (
      <div className="space-y-6">
        {/* Claims Management Subtabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <ScrollArea className="w-full">
            <nav className="flex space-x-1 p-1 min-w-max">
              {claimsSubTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setClaimsSubTab(tab.id)}
                  className={`whitespace-nowrap py-2 px-4 border-b-2 font-medium text-sm transition-colors rounded-t-lg flex items-center space-x-2 ${
                    claimsSubTab === tab.id
                      ? tab.id === "receivable-claims"
                        ? "border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </ScrollArea>
        </div>

        {/* Claims Management Content */}
        {renderClaimsSubTabContent()}
      </div>
    )
  }

  // Render main content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "data-upload":
        return renderDataUpload()
      case "claims-management":
        return renderClaimsManagement()
      case "calculations":
        return renderPlaceholderTab(
          "Interest Calculations",
          "Perform interest calculations and validate claim amounts.",
          BarChart3,
        )
      case "approvals":
        return renderPlaceholderTab("Approvals", "Review and approve interest claims before payment.", CheckCircle)
      case "payments":
        return renderPlaceholderTab("Payments", "Track payment status and manage payment processing.", Target)
      case "reports":
        return renderPlaceholderTab("Reports", "Generate reports and analytics for interest claims.", BarChart3)
      case "settings":
        return renderPlaceholderTab(
          "Settings",
          "Configure interest calculation parameters and system settings.",
          Settings,
        )
      default:
        return renderDataUpload()
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 border-l-2 border-white">
      {/* Collapsible Sidebar */}
      <div
        className={`${
                  sidebarCollapsed ? "w-16" : "w-64"
      } transition-all duration-300 ease-in-out bg-sidebar shadow-lg flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b-2 border-white flex items-center justify-between">
          {!sidebarCollapsed && <h1 className="text-xl font-bold text-sidebar-foreground">Interest Claims</h1>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {sidebarItems.map((item) => {
            const IconComponent = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === item.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/20 hover:text-sidebar-foreground"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <IconComponent className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="ml-3">{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-sidebar-border/20">
            <div className="text-xs text-sidebar-foreground/60">
              <div>Version 1.0.0</div>
              <div>© 2024 CMTA Portal</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {sidebarCollapsed && <Menu className="h-5 w-5 text-gray-500" />}
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {sidebarItems.find((item) => item.id === activeTab)?.label || "Data Upload"}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {activeTab === "data-upload" && "Upload and process interest claims data from Excel or CSV files"}
                  {activeTab === "claims-management" && "Manage and track interest claims throughout their lifecycle"}
                  {activeTab === "calculations" && "Perform interest calculations and validate claim amounts"}
                  {activeTab === "approvals" && "Review and approve interest claims before payment"}
                  {activeTab === "payments" && "Track payment status and manage payment processing"}
                  {activeTab === "reports" && "Generate reports and analytics for interest claims"}
                  {activeTab === "settings" && "Configure interest calculation parameters and system settings"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">{renderContent()}</div>
      </div>
    </div>
  )
}

// Define issuanceSubTabs here
const issuanceSubTabs = [
  { id: "receivable-claims", label: "Receivable Claims", count: 15 },
  { id: "payable-claims", label: "Payable Claims", count: 8 },
]
