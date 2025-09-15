"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  Upload,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  AlertCircle,
  FileText,
  Settings,
  Eye,
  RefreshCw,
  CreditCard,
  Target,
  Shield,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts"
import * as XLSX from "xlsx"
import { fetchTradeData, type TradeData } from "@/lib/data-processor"
import { InvoiceDocument } from "@/components/invoice-document"
import { useAgentBillingFirebase } from "@/hooks/use-agent-billing-firebase"
import { agentBillingOperations } from "@/lib/firebase-operations"
import { tradeOperations } from "@/lib/firebase-operations"

// Mock data types
interface Invoice {
  id: string
  agentName: string
  invoiceNumber: string
  tradeId: string
  amount: number
  currency: string
  serviceType: string
  uploadDate: string
  status: "pending" | "reconciled" | "mismatch" | "approved" | "disputed" | "paid"
  variance?: number
  reconciliationDate?: string
  approvedBy?: string
  approvalDate?: string
  // Add these new fields for reconciliation
  tradeData?: TradeData
  fees?: {
    baseFee: number
    custodyFee: number
    settlementFee: number
    total: number
  }
  isForwarded?: boolean // Flag to identify forwarded invoices
  // Reconciliation details
  reconciliationDetails?: ReconciliationResult
}

interface ReconciliationResult {
  tradeIdMatch: boolean
  counterpartyMatch: boolean
  amountMatch: boolean
  dateMatch: boolean
  commissionMatch: boolean
  taxMatch: boolean
  custodyFeeMatch: boolean
  settlementCostMatch: boolean
  brokerageFeeMatch: boolean
  overallStatus: "reconciled" | "mismatch" | "matched"
  discrepancies: string[]
  disputeTypes?: string[] // Changed to array to support multiple dispute types
  hasDispute: boolean // Flag to indicate if this trade has a built-in dispute
  expectedValues: {
    counterparty?: string
    commission?: number
    taxes?: number
    custodyFee?: number
    settlementCost?: number
    brokerageFee?: number
    totalExpected?: number
  }
  actualValues: {
    counterparty?: string
    commission?: number
    taxes?: number
    custodyFee?: number
    settlementCost?: number
    brokerageFee?: number
    totalActual?: number
  }
}

interface Trade {
  tradeId: string
  tradeValue: number
  fxRate: number
  custodyFee: number
  settlementCost: number
  pnlCalculated: number
  costAllocationStatus: string
  costCenter: string
  costBookedDate: string
  agent: string
}

interface Dispute {
  id: string
  invoiceId: string
  agentName: string
  reason: string
  amount: number
  status: "open" | "responded" | "resolved" | "escalated"
  raisedBy: string
  raisedDate: string
  responseDate?: string
  resolution?: string
}

// Mock data
const mockInvoices: Invoice[] = [
  {
    id: "INV001",
    agentName: "Goldman Sachs",
    invoiceNumber: "GS-2024-001",
    tradeId: "TRD001",
    amount: 15000,
    currency: "USD",
    serviceType: "Custody",
    uploadDate: "2024-01-15",
    status: "reconciled",
    reconciliationDate: "2024-01-16",
  },
  {
    id: "INV002",
    agentName: "JPMorgan",
    invoiceNumber: "JPM-2024-002",
    tradeId: "TRD002",
    amount: 8500,
    currency: "EUR",
    serviceType: "Settlement",
    uploadDate: "2024-01-14",
    status: "mismatch",
    variance: 500,
  },
  {
    id: "INV003",
    agentName: "Morgan Stanley",
    invoiceNumber: "MS-2024-003",
    tradeId: "TRD003",
    amount: 12000,
    currency: "GBP",
    serviceType: "FX",
    uploadDate: "2024-01-13",
    status: "pending",
  },
  {
    id: "INV004",
    agentName: "Barclays",
    invoiceNumber: "BARC-2024-004",
    tradeId: "TRD004",
    amount: 22000,
    currency: "USD",
    serviceType: "Custody",
    uploadDate: "2024-01-12",
    status: "approved",
    approvedBy: "John Smith",
    approvalDate: "2024-01-17",
  },
  {
    id: "INV005",
    agentName: "Deutsche Bank",
    invoiceNumber: "DB-2024-005",
    tradeId: "TRD005",
    amount: 18500,
    currency: "USD",
    serviceType: "Ops Fees",
    uploadDate: "2024-01-11",
    status: "disputed",
    variance: 1500,
  },
]

const mockDisputes: Dispute[] = [
  {
    id: "DSP001",
    invoiceId: "INV002",
    agentName: "JPMorgan",
    reason: "Overbilling - Amount exceeds agreed rate",
    amount: 500,
    status: "open",
    raisedBy: "Sarah Johnson",
    raisedDate: "2024-01-16",
  },
  {
    id: "DSP002",
    invoiceId: "INV005",
    agentName: "Deutsche Bank",
    reason: "Incorrect trade reference",
    amount: 1500,
    status: "responded",
    raisedBy: "Mike Chen",
    raisedDate: "2024-01-15",
    responseDate: "2024-01-17",
  },
]

// NO YELLOW COLORS - Only teal, blue, green, red, purple
const COLORS = ["#22c55e", "#3b82f6", "#ef4444", "#16a34a", "#f59e0b", "#6b7280", "#1f2937", "#f97316"]

// FX Dataset Fields (55 columns)
const fxDatasetFields = [
  { key: "TradeID", label: "TradeID", required: true },
  { key: "TradeDate", label: "TradeDate", required: false },
  { key: "ValueDate", label: "ValueDate", required: false },
  { key: "TradeTime", label: "TradeTime", required: false },
  { key: "TraderID", label: "TraderID", required: false },
  { key: "Counterparty", label: "Counterparty", required: false },
  { key: "CurrencyPair", label: "CurrencyPair", required: false },
  { key: "BuySell", label: "BuySell", required: false },
  { key: "DealtCurrency", label: "DealtCurrency", required: false },
  { key: "BaseCurrency", label: "BaseCurrency", required: false },
  { key: "TermCurrency", label: "TermCurrency", required: false },
  { key: "NotionalAmount", label: "NotionalAmount", required: false },
  { key: "FXRate", label: "FXRate", required: false },
  { key: "TradeStatus", label: "TradeStatus", required: false },
  { key: "SettlementStatus", label: "SettlementStatus", required: false },
  { key: "SettlementMethod", label: "SettlementMethod", required: false },
  { key: "Broker", label: "Broker", required: false },
  { key: "ExecutionVenue", label: "ExecutionVenue", required: false },
  { key: "ProductType", label: "ProductType", required: false },
  { key: "MaturityDate", label: "MaturityDate", required: false },
  { key: "ConfirmationTimestamp", label: "ConfirmationTimestamp", required: false },
  { key: "SettlementDate", label: "SettlementDate", required: false },
  { key: "BookingLocation", label: "BookingLocation", required: false },
  { key: "Portfolio", label: "Portfolio", required: false },
  { key: "TradeVersion", label: "TradeVersion", required: false },
  { key: "CancellationFlag", label: "CancellationFlag", required: false },
  { key: "AmendmentFlag", label: "AmendmentFlag", required: false },
  { key: "RiskSystemID", label: "RiskSystemID", required: false },
  { key: "RegulatoryReportingStatus", label: "RegulatoryReportingStatus", required: false },
  { key: "TradeSourceSystem", label: "TradeSourceSystem", required: false },
  { key: "ConfirmationMethod", label: "ConfirmationMethod", required: false },
  { key: "ConfirmationStatus", label: "ConfirmationStatus", required: false },
  { key: "SettlementInstructions", label: "SettlementInstructions", required: false },
  { key: "Custodian", label: "Custodian", required: false },
  { key: "NettingEligibility", label: "NettingEligibility", required: false },
  { key: "TradeComplianceStatus", label: "TradeComplianceStatus", required: false },
  { key: "KYCCheck", label: "KYCCheck", required: false },
  { key: "SanctionsScreening", label: "SanctionsScreening", required: false },
  { key: "ExceptionFlag", label: "ExceptionFlag", required: false },
  { key: "ExceptionNotes", label: "ExceptionNotes", required: false },
  { key: "AuditTrailRef", label: "AuditTrailRef", required: false },
  { key: "CommissionAmount", label: "CommissionAmount", required: false },
  { key: "CommissionCurrency", label: "CommissionCurrency", required: false },
  { key: "BrokerageFee", label: "BrokerageFee", required: false },
  { key: "BrokerageCurrency", label: "BrokerageCurrency", required: false },
  { key: "CustodyFee", label: "CustodyFee", required: false },
  { key: "CustodyCurrency", label: "CustodyCurrency", required: false },
  { key: "SettlementCost", label: "SettlementCost", required: false },
  { key: "SettlementCurrency", label: "SettlementCurrency", required: false },
  { key: "FXGainLoss", label: "FXGainLoss", required: false },
  { key: "PnlCalculated", label: "PnlCalculated", required: false },
  { key: "CostAllocationStatus", label: "CostAllocationStatus", required: false },
  { key: "CostCenter", label: "CostCenter", required: false },
  { key: "ExpenseApprovalStatus", label: "ExpenseApprovalStatus", required: false },
  { key: "CostBookedDate", label: "CostBookedDate", required: false },
]

// Equity Dataset Fields (31 columns)
const equityDatasetFields = [
  { key: "Trade ID", label: "Trade ID", required: true },
  { key: "Order ID", label: "Order ID", required: false },
  { key: "Client ID", label: "Client ID", required: false },
  { key: "ISIN", label: "ISIN", required: false },
  { key: "Symbol", label: "Symbol", required: false },
  { key: "Trade Type", label: "Trade Type", required: false },
  { key: "Quantity", label: "Quantity", required: false },
  { key: "Price", label: "Price", required: false },
  { key: "Trade Value", label: "Trade Value", required: false },
  { key: "Currency", label: "Currency", required: false },
  { key: "Trade Date", label: "Trade Date", required: false },
  { key: "Settlement Date", label: "Settlement Date", required: false },
  { key: "Settlement Status", label: "Settlement Status", required: false },
  { key: "Counterparty", label: "Counterparty", required: false },
  { key: "Trading Venue", label: "Trading Venue", required: false },
  { key: "Trader Name", label: "Trader Name", required: false },
  { key: "KYC Status", label: "KYC Status", required: false },
  { key: "Reference Data Validated", label: "Reference Data Validated", required: false },
  { key: "Commission", label: "Commission", required: false },
  { key: "Taxes", label: "Taxes", required: false },
  { key: "Total Cost", label: "Total Cost", required: false },
  { key: "Confirmation Status", label: "Confirmation Status", required: false },
  { key: "Country of Trade", label: "Country of Trade", required: false },
  { key: "Ops Team Notes", label: "Ops Team Notes", required: false },
  { key: "Pricing Source", label: "Pricing Source", required: false },
  { key: "Market Impact Cost", label: "Market Impact Cost", required: false },
  { key: "FX Rate Applied", label: "FX Rate Applied", required: false },
  { key: "Net Amount", label: "Net Amount", required: false },
  { key: "Collateral Required", label: "Collateral Required", required: false },
  { key: "Margin Type", label: "Margin Type", required: false },
  { key: "Margin Status", label: "Margin Status", required: false },
]

// Add this helper function near the top (after imports)
function excelDateToJSDate(serial: any): string {
  if (typeof serial === "number") {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info.toISOString().slice(0, 10);
  }
  if (typeof serial === "string" && /^\d+(\.\d+)?$/.test(serial)) {
    const num = parseFloat(serial);
    if (!isNaN(num)) {
      const utc_days = Math.floor(num - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      return date_info.toISOString().slice(0, 10);
    }
  }
  return serial;
}

export default function AgentBilling() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices)
  const [disputes, setDisputes] = useState<Dispute[]>(mockDisputes)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [agentFilter, setAgentFilter] = useState("all")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [uploadedData, setUploadedData] = useState<any[]>([])
  const [uploadedInvoices, setUploadedInvoices] = useState<Invoice[]>([])
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [uploadStep, setUploadStep] = useState<"upload" | "map" | "complete">("upload")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadAnalysis, setUploadAnalysis] = useState<any>(null)
  const [datasetType, setDatasetType] = useState<"fx" | "equity" | null>(null)
  const datasetTypeRef = useRef(datasetType);
  React.useEffect(() => { datasetTypeRef.current = datasetType }, [datasetType]);

  const [selectedInvoiceData, setSelectedInvoiceData] = useState<any>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [allTradeData, setAllTradeData] = useState<TradeData[]>([])
  const [forwardedInvoiceData, setForwardedInvoiceData] = useState<any>(null)

  // Add these state variables after the existing state declarations
  const [uploadedTradeData, setUploadedTradeData] = useState<TradeData[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage] = useState(50)
  const [totalRecords, setTotalRecords] = useState(200)

  // Firebase integration for agent billing
  const { agentBillingData, loadAgentBillingByType, loading: firebaseLoading, createAgentBilling } = useAgentBillingFirebase()

  // Add after existing state declarations
  const [reconciliationPage, setReconciliationPage] = useState(1)
  const [reconciliationPerPage] = useState(50)
  const [allReconciliationResults, setAllReconciliationResults] = useState<Map<string, ReconciliationResult>>(new Map())
  const [isAutoReconciling, setIsAutoReconciling] = useState(false)
  const [reconciliationProgress, setReconciliationProgress] = useState(0)

  // Reconciliation state
  const [selectedInvoiceForReconciliation, setSelectedInvoiceForReconciliation] = useState<Invoice | null>(null)
  const [showReconciliationModal, setShowReconciliationModal] = useState(false)

  // Add this with other state declarations at the top
  const [disputeTab, setDisputeTab] = useState("summary")

  // Helper function to safely convert to number
  const safeToNumber = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0
    const num = typeof value === 'string' ? parseFloat(value) : Number(value)
    return isNaN(num) ? 0 : num
  }

  // Function to generate invoices from trade data
  const generateInvoicesFromTradeData = (tradeData: TradeData[]): Invoice[] => {
    return tradeData.map((trade, index) => {
      const amount = trade.dataSource === "equity" 
        ? safeToNumber(trade.commission) + safeToNumber(trade.taxes)
        : safeToNumber(trade.commissionAmount || trade.commission) + safeToNumber(trade.custodyFee) + safeToNumber(trade.settlementCost) + safeToNumber(trade.brokerageFee)
      
      // Create some variance for realism
      const hasVariance = Math.random() > 0.7
      const variance = hasVariance ? amount * (0.05 + Math.random() * 0.15) : 0
      
      // Determine status based on variance and random factors
      let status: Invoice['status'] = "reconciled"
      if (hasVariance) {
        status = Math.random() > 0.5 ? "mismatch" : "disputed"
      } else if (Math.random() > 0.8) {
        status = "pending"
      } else if (Math.random() > 0.9) {
        status = "approved"
      }

      return {
        id: `TRADE-${trade.tradeId}-${index}`,
        agentName: trade.counterparty || `Agent ${index + 1}`,
        invoiceNumber: `INV-${trade.tradeId}-${new Date().getFullYear()}`,
        tradeId: trade.tradeId,
        amount: amount,
        currency: trade.currency || trade.baseCurrency || trade.commissionCurrency || "USD",
        serviceType: trade.dataSource === "equity" ? "Equity Trading" : "FX Trading",
        uploadDate: new Date().toLocaleDateString(),
        status: status,
        variance: variance > 0 ? variance : undefined,
        reconciliationDate: status === "reconciled" ? new Date().toLocaleDateString() : undefined,
        tradeData: trade
      }
    })
  }

  // Use Firebase data if available, otherwise fall back to mock data
  const activeInvoices = uploadedTradeData.length > 0 
    ? generateInvoicesFromTradeData(uploadedTradeData)
    : invoices

  // Dashboard metrics using active data
  const totalInvoicesThisMonth = activeInvoices.length
  const uploadedThisMonth = uploadedInvoices.length
  const totalCostReconciled = activeInvoices
    .filter((inv) => inv.status === "reconciled" || inv.status === "approved")
    .reduce((sum, inv) => sum + inv.amount, 0)
  const disputesOpen = disputes.filter((d) => d.status === "open").length
  const pendingApprovals = activeInvoices.filter((inv) => inv.status === "reconciled").length
  const costLeakage = activeInvoices
    .filter((inv) => inv.variance && inv.variance > 0)
    .reduce((sum, inv) => sum + (inv.variance || 0), 0)
  const costLeakagePercent = totalCostReconciled > 0 ? (costLeakage / totalCostReconciled) * 100 : 0

  // Chart data using active invoices
  const reconciliationStatusData = [
    { name: "Reconciled", value: activeInvoices.filter((inv) => inv.status === "reconciled").length },
    { name: "Pending", value: activeInvoices.filter((inv) => inv.status === "pending").length },
    { name: "Mismatch", value: activeInvoices.filter((inv) => inv.status === "mismatch").length },
    { name: "Approved", value: activeInvoices.filter((inv) => inv.status === "approved").length },
    { name: "Disputed", value: activeInvoices.filter((inv) => inv.status === "disputed").length },
  ]

  const costBreakdownData = [
    {
      name: "Equity Trading",
      value: activeInvoices.filter((inv) => inv.serviceType === "Equity Trading").reduce((sum, inv) => sum + inv.amount, 0),
    },
    {
      name: "FX Trading", 
      value: activeInvoices.filter((inv) => inv.serviceType === "FX Trading").reduce((sum, inv) => sum + inv.amount, 0),
    },
    {
      name: "Custody",
      value: activeInvoices.filter((inv) => inv.serviceType === "Custody").reduce((sum, inv) => sum + inv.amount, 0),
    },
    {
      name: "Settlement",
      value: activeInvoices.filter((inv) => inv.serviceType === "Settlement").reduce((sum, inv) => sum + inv.amount, 0),
    },
  ]

  const topOverchargedAgents = activeInvoices
    .filter((inv) => inv.variance && inv.variance > 0)
    .reduce(
      (acc, inv) => {
        const existing = acc.find((a) => a.agent === inv.agentName)
        if (existing) {
          existing.variance += inv.variance || 0
        } else {
          acc.push({ agent: inv.agentName, variance: inv.variance || 0 })
        }
        return acc
      },
      [] as { agent: string; variance: number }[],
    )
    .sort((a, b) => b.variance - a.variance)
    .slice(0, 5)

  // Filter invoices - for reconciliation tab, only show forwarded invoices
  const filteredInvoices = activeInvoices.filter((invoice) => {
    const matchesSearch =
      invoice.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.tradeId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter
    const matchesAgent = agentFilter === "all" || invoice.agentName === agentFilter

    // For reconciliation tab, only show forwarded invoices
    const isForReconciliation = activeTab === "reconciliation" ? invoice.isForwarded === true : true

    return matchesSearch && matchesStatus && matchesAgent && isForReconciliation
  })

  const uniqueAgents = Array.from(new Set(invoices.map((inv) => inv.agentName)))

  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "data-upload", label: "Data Upload", icon: Upload },
    { id: "invoice-generation", label: "Invoice Generation", icon: FileText },
    { id: "upload", label: "Invoice Upload", icon: Upload },
    { id: "reconciliation", label: "Reconciliation", icon: RefreshCw },
    { id: "allocation", label: "Cost Allocation", icon: Target },
    { id: "disputes", label: "Disputes", icon: AlertTriangle },
  ]

  // DISPUTE TYPES - Must match the ones in invoice-document.tsx EXACTLY
  const DISPUTE_TYPES = [
    "Overcharging",
    "Duplicate Charges",
    "Missing Trades",
    "Wrong Counterparty or Account",
    "Incorrect Tax Application",
    "Service Not Rendered",
    "Fail Charges Disputed",
    "Currency Conversion Error",
    "Wrong Rate Card Applied",
    "Incorrect Billing Period",
  ]

  // Helper function to check if a trade has a dispute and get specific dispute types (matches invoice logic exactly)
  const checkTradeHasDispute = (trade: TradeData): { hasDispute: boolean; disputeTypes: string[] } => {
    const safeTradeId = trade.tradeId || "DEFAULT"
    const hash = safeTradeId
      .toString()
      .split("")
      .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)

    // Use modulo 15 to create batches, and select positions 3 and 11 for disputes
    const batchPosition = hash % 15
    const hasDispute = batchPosition === 3 || batchPosition === 11

    if (!hasDispute) {
      return { hasDispute: false, disputeTypes: [] }
    }

    // Determine number of dispute types (1 or 2)
    const numDisputeTypes = hash % 3 === 0 ? 2 : 1 // ~33% chance of 2 disputes, 67% chance of 1

    // Select specific dispute types
    const selectedTypes: string[] = []

    // First dispute type
    const firstDisputeHash = Math.abs(hash * 7 + safeTradeId.length * 13) % DISPUTE_TYPES.length
    selectedTypes.push(DISPUTE_TYPES[firstDisputeHash])

    // Second dispute type (if applicable)
    if (numDisputeTypes === 2) {
      const secondDisputeHash = Math.abs(hash * 11 + safeTradeId.length * 17) % DISPUTE_TYPES.length
      const secondType = DISPUTE_TYPES[secondDisputeHash]

      // Ensure we don't duplicate the same dispute type
      if (secondType !== selectedTypes[0]) {
        selectedTypes.push(secondType)
      }
    }

    return { hasDispute: true, disputeTypes: selectedTypes }
  }

  // Reconciliation function
  const performReconciliation = (invoice: Invoice): ReconciliationResult => {
    // Find matching trade data from uploaded dataset
    const matchingTrade = uploadedTradeData.find(
      (trade) => trade.tradeId === invoice.tradeId,
    )

    if (!matchingTrade) {
      return {
        tradeIdMatch: false,
        counterpartyMatch: false,
        amountMatch: false,
        dateMatch: false,
        commissionMatch: false,
        taxMatch: false,
        custodyFeeMatch: false,
        settlementCostMatch: false,
        brokerageFeeMatch: false,
        overallStatus: "mismatch",
        discrepancies: ["Trade ID not found in uploaded dataset"],
        hasDispute: false,
        disputeTypes: [],
        expectedValues: {},
        actualValues: {},
      }
    }

    // Check if this trade has a built-in dispute
    const disputeInfo = checkTradeHasDispute(matchingTrade)

    // Get expected costs from dataset (clean values)
    const expectedCosts = getExpectedCosts(matchingTrade)

    // Get invoice costs (these may include disputes/errors)
    const invoiceCosts = getDisputeModifiedCosts(matchingTrade)

    // Perform detailed reconciliation
    const discrepancies: string[] = []
    let matchCount = 0
    const totalChecks = 8

    // 1. Trade ID Match
    const tradeIdMatch = matchingTrade.tradeId === invoice.tradeId
    if (tradeIdMatch) matchCount++
    else discrepancies.push("Trade ID mismatch")

    // 2. Counterparty Match
    const expectedCounterparty = matchingTrade.counterparty || ""
    const invoiceCounterparty = getInvoiceCounterparty(matchingTrade, disputeInfo.hasDispute, disputeInfo.disputeTypes)
    const counterpartyMatch = expectedCounterparty.toLowerCase() === invoiceCounterparty.toLowerCase()
    if (counterpartyMatch) matchCount++
    else discrepancies.push(`Counterparty mismatch: Expected "${expectedCounterparty}", Got "${invoiceCounterparty}"`)

    // 3. Commission Match
    const commissionTolerance = 0.01 // $0.01 tolerance
    const commissionMatch =
      Math.abs((expectedCosts.commission || 0) - (invoiceCosts.commission || 0)) <= commissionTolerance
    if (commissionMatch) matchCount++
    else {
      discrepancies.push(
        `Commission mismatch: Expected $${(expectedCosts.commission || 0).toFixed(2)}, Got $${(invoiceCosts.commission || 0).toFixed(2)}`,
      )
      if (disputeInfo.hasDispute && disputeInfo.disputeTypes.length > 0) {
        discrepancies.push(`Dispute detected: ${disputeInfo.disputeTypes.join(", ")} - Commission affected`)
      }
    }

    // 4. Tax Match
    const taxMatch = Math.abs((expectedCosts.taxes || 0) - (invoiceCosts.taxes || 0)) <= commissionTolerance
    if (taxMatch) matchCount++
    else {
      discrepancies.push(
        `Tax mismatch: Expected $${(expectedCosts.taxes || 0).toFixed(2)}, Got $${(invoiceCosts.taxes || 0).toFixed(2)}`,
      )
      if (disputeInfo.hasDispute && disputeInfo.disputeTypes.includes("Incorrect Tax Application")) {
        discrepancies.push(`Dispute detected: Incorrect Tax Application - Excessive tax charges`)
      }
    }

    // 5. Custody Fee Match
    const custodyFeeMatch =
      Math.abs((expectedCosts.custodyFee || 0) - (invoiceCosts.custodyFee || 0)) <= commissionTolerance
    if (custodyFeeMatch) matchCount++
    else {
      discrepancies.push(
        `Custody Fee mismatch: Expected $${(expectedCosts.custodyFee || 0).toFixed(2)}, Got $${(invoiceCosts.custodyFee || 0).toFixed(2)}`,
      )
      if (disputeInfo.hasDispute && disputeInfo.disputeTypes.length > 0) {
        discrepancies.push(`Dispute detected: ${disputeInfo.disputeTypes.join(", ")} - Custody fee affected`)
      }
    }

    // 6. Settlement Cost Match
    const settlementCostMatch =
      Math.abs((expectedCosts.settlementCost || 0) - (invoiceCosts.settlementCost || 0)) <= commissionTolerance
    if (settlementCostMatch) matchCount++
    else {
      discrepancies.push(
        `Settlement Cost mismatch: Expected $${(expectedCosts.settlementCost || 0).toFixed(2)}, Got $${(invoiceCosts.settlementCost || 0).toFixed(2)}`,
      )
      if (disputeInfo.hasDispute && disputeInfo.disputeTypes.length > 0) {
        discrepancies.push(`Dispute detected: ${disputeInfo.disputeTypes.join(", ")} - Settlement cost affected`)
      }
    }

    // 7. Brokerage Fee Match
    const brokerageFeeMatch =
      Math.abs((expectedCosts.brokerageFee || 0) - (invoiceCosts.brokerageFee || 0)) <= commissionTolerance
    if (brokerageFeeMatch) matchCount++
    else {
      discrepancies.push(
        `Brokerage Fee mismatch: Expected $${(expectedCosts.brokerageFee || 0).toFixed(2)}, Got $${(invoiceCosts.brokerageFee || 0).toFixed(2)}`,
      )
      if (disputeInfo.hasDispute && disputeInfo.disputeTypes.length > 0) {
        discrepancies.push(`Dispute detected: ${disputeInfo.disputeTypes.join(", ")} - Brokerage fee affected`)
      }
    }

    // 8. Total Amount Match
    const expectedTotal = Object.values(expectedCosts).reduce((sum, val) => sum + (val || 0), 0)
    const actualTotal = Object.values(invoiceCosts).reduce((sum, val) => sum + (val || 0), 0)
    const amountMatch = Math.abs(expectedTotal - actualTotal) <= commissionTolerance
    if (amountMatch) matchCount++
    else {
      discrepancies.push(`Total Amount mismatch: Expected $${(expectedTotal || 0).toFixed(2)}, Got $${(actualTotal || 0).toFixed(2)}`)
      if (disputeInfo.hasDispute && disputeInfo.disputeTypes.length > 0) {
        discrepancies.push(`Dispute detected: ${disputeInfo.disputeTypes.join(", ")} - Total amount affected`)
      }
    }

    // Date match (simplified)
    const dateMatch = true // Assuming dates match for now
    if (dateMatch) matchCount++

    // Determine overall status - if there's a dispute, it should be mismatch
    let overallStatus: "reconciled" | "mismatch" | "matched"
    if (disputeInfo.hasDispute) {
      overallStatus = "mismatch" // Force mismatch for disputed trades
    } else if (matchCount === totalChecks) {
      overallStatus = "reconciled" // All checks pass perfectly
    } else if (counterpartyMatch && amountMatch && commissionMatch) {
      overallStatus = "matched" // Three main fields match
    } else {
      overallStatus = "mismatch"
    }

    return {
      tradeIdMatch,
      counterpartyMatch,
      amountMatch,
      dateMatch,
      commissionMatch,
      taxMatch,
      custodyFeeMatch,
      settlementCostMatch,
      brokerageFeeMatch,
      overallStatus,
      discrepancies,
      hasDispute: disputeInfo.hasDispute,
      disputeTypes: disputeInfo.disputeTypes,
      expectedValues: {
        counterparty: expectedCounterparty,
        commission: expectedCosts.commission,
        taxes: expectedCosts.taxes,
        custodyFee: expectedCosts.custodyFee,
        settlementCost: expectedCosts.settlementCost,
        brokerageFee: expectedCosts.brokerageFee,
        totalExpected: expectedTotal,
      },
      actualValues: {
        counterparty: invoiceCounterparty,
        commission: invoiceCosts.commission,
        taxes: invoiceCosts.taxes,
        custodyFee: invoiceCosts.custodyFee,
        settlementCost: invoiceCosts.settlementCost,
        brokerageFee: invoiceCosts.brokerageFee,
        totalActual: actualTotal,
      },
    }
  }

  // Helper function to extract costs from invoice (simulated from invoice generation logic)
  const getInvoiceCosts = (invoice: Invoice) => {
    // This simulates extracting costs from the invoice
    // In a real system, this would parse the actual invoice document
    if (invoice.tradeData) {
      return getDisputeModifiedCosts(invoice.tradeData)
    }

    // Fallback: estimate costs based on invoice amount
    const totalAmount = invoice.amount
    return {
      commission: totalAmount * 0.6,
      taxes: totalAmount * 0.1,
      custodyFee: totalAmount * 0.15,
      settlementCost: totalAmount * 0.1,
      brokerageFee: totalAmount * 0.05,
    }
  }

  // Helper function to get expected costs from trade data (clean values)
  const getExpectedCosts = (trade: TradeData) => {
    if (trade.dataSource === "equity") {
      return {
        commission: safeToNumber(trade.commission),
        taxes: safeToNumber(trade.taxes),
        custodyFee: 0, // Not available in equity dataset
        settlementCost: 0, // Not available in equity dataset
        brokerageFee: 0, // Not available in equity dataset
      }
    } else {
      // FX dataset
      return {
        commission: safeToNumber(trade.commissionAmount || trade.commission),
        taxes: 0, // Not available in FX dataset
        custodyFee: safeToNumber(trade.custodyFee),
        settlementCost: safeToNumber(trade.settlementCost),
        brokerageFee: safeToNumber(trade.brokerageFee),
      }
    }
  }

  // Helper function to get counterparty from invoice (considering disputes)
  const getInvoiceCounterparty = (trade: TradeData, hasDispute: boolean, disputeTypes: string[]) => {
    if (hasDispute && disputeTypes.includes("Wrong Counterparty or Account")) {
      return getWrongCounterparty(trade)
    }
    return trade.counterparty || ""
  }

  // Helper function to get wrong counterparty for disputes
  const getWrongCounterparty = (trade: TradeData) => {
    const wrongCounterparties = ["WRONG BANK LTD", "INCORRECT ENTITY", "MISMATCHED CORP", "WRONG ACCOUNT"]
    const safeTradeId = trade.tradeId || trade.tradeID || "DEFAULT"
    const hash = safeTradeId
      .toString()
      .split("")
      .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
    return wrongCounterparties[hash % wrongCounterparties.length]
  }

  const getDisputeModifiedCosts = (trade: TradeData) => {
    const disputeInfo = checkTradeHasDispute(trade)
    const actualCosts = getExpectedCosts(trade)

    if (!disputeInfo.hasDispute || disputeInfo.disputeTypes.length === 0) return actualCosts

    const modifiedCosts = { ...actualCosts }

    // Apply modifications for each dispute type this trade has
    disputeInfo.disputeTypes.forEach((disputeType) => {
      switch (disputeType) {
        case "Overcharging":
          // Increase all fees by 25-50%
          if (modifiedCosts.commission) modifiedCosts.commission *= 1.35
          if (modifiedCosts.taxes) modifiedCosts.taxes *= 1.25
          if (modifiedCosts.custodyFee) modifiedCosts.custodyFee *= 1.45
          if (modifiedCosts.settlementCost) modifiedCosts.settlementCost *= 1.3
          if (modifiedCosts.brokerageFee) modifiedCosts.brokerageFee *= 1.4
          break
        case "Duplicate Charges":
          // Double one of the main fees
          if (modifiedCosts.commission) modifiedCosts.commission *= 2
          else if (modifiedCosts.brokerageFee) modifiedCosts.brokerageFee *= 2
          break
        case "Missing Trades":
          // Add phantom charges for non-existent trades
          if (trade.dataSource === "equity") {
            modifiedCosts.commission = (modifiedCosts.commission || 0) + 450
          } else {
            modifiedCosts.brokerageFee = (modifiedCosts.brokerageFee || 0) + 350
          }
          break
        case "Wrong Counterparty or Account":
          // Keep costs same but counterparty will be wrong (handled separately)
          // Add a small processing fee for the "error"
          if (modifiedCosts.commission) modifiedCosts.commission += 25
          break
        case "Incorrect Tax Application":
          // Add excessive or incorrect tax
          if (trade.dataSource === "equity") {
            modifiedCosts.taxes = (modifiedCosts.taxes || 0) + 500
          } else {
            // For FX, add a "tax" even though it shouldn't have one
            modifiedCosts.taxes = 275
          }
          break
        case "Service Not Rendered":
          // Add charges for services not provided
          if (trade.dataSource === "fx") {
            modifiedCosts.custodyFee = (modifiedCosts.custodyFee || 0) + 750
          } else {
            modifiedCosts.commission = (modifiedCosts.commission || 0) + 300
          }
          break
        case "Fail Charges Disputed":
          // Add fail charges that shouldn't be there
          if (trade.dataSource === "equity") {
            modifiedCosts.commission = (modifiedCosts.commission || 0) + 200
          } else {
            modifiedCosts.settlementCost = (modifiedCosts.settlementCost || 0) + 150
          }
          break
        case "Currency Conversion Error":
          // Apply wrong FX rate (increase by 15-25%)
          Object.keys(modifiedCosts).forEach((key) => {
            if (modifiedCosts[key as keyof typeof modifiedCosts]) {
              modifiedCosts[key as keyof typeof modifiedCosts]! *= 1.2
            }
          })
          break
        case "Wrong Rate Card Applied":
          // Apply incorrect rates (increase by 60-80%)
          if (modifiedCosts.commission) modifiedCosts.commission *= 1.75
          if (modifiedCosts.brokerageFee) modifiedCosts.brokerageFee *= 1.65
          if (modifiedCosts.custodyFee) modifiedCosts.custodyFee *= 1.55
          break
        case "Incorrect Billing Period":
          // Add charges from wrong period or double billing
          if (modifiedCosts.commission) modifiedCosts.commission *= 1.3
          if (modifiedCosts.settlementCost) modifiedCosts.settlementCost *= 1.4
          // Add a "previous period adjustment"
          if (trade.dataSource === "equity") {
            modifiedCosts.commission = (modifiedCosts.commission || 0) + 125
          } else {
            modifiedCosts.brokerageFee = (modifiedCosts.brokerageFee || 0) + 85
          }
          break
        default:
          // Fallback: general overcharge
          if (modifiedCosts.commission) modifiedCosts.commission *= 1.25
          break
      }
    })

    return modifiedCosts
  }

  // Auto-reconciliation function
  const performAutoReconciliation = async () => {
    if (uploadedTradeData.length === 0) {
      return
    }

    setIsAutoReconciling(true)
    setReconciliationProgress(0)
    const results = new Map<string, ReconciliationResult>()

    // Process all trade data in batches of 50
    const totalRecords = uploadedTradeData.length
    const batchSize = 50

    for (let i = 0; i < totalRecords; i += batchSize) {
      const batch = uploadedTradeData.slice(i, i + batchSize)

      // Process each trade in the batch
      for (const trade of batch) {
        // Create a mock invoice for reconciliation
        const mockInvoice: Invoice = {
          id: `AUTO-${trade.tradeId}`,
          agentName: trade.counterparty || "Unknown Agent",
          invoiceNumber: `INV-${trade.tradeId}-AUTO`,
          tradeId: trade.tradeId,
          amount: calculateTotalAmount(trade),
          currency: trade.currency || trade.baseCurrency || "USD",
          serviceType: trade.dataSource === "equity" ? "Equity Services" : "FX Services",
          uploadDate: new Date().toLocaleDateString(),
          status: "pending",
          tradeData: trade,
          isForwarded: false,
        }

        // Perform reconciliation
        const reconciliationResult = performReconciliation(mockInvoice)
        results.set(trade.tradeId, reconciliationResult)
      }

      // Update progress
      const progress = Math.min(100, ((i + batchSize) / totalRecords) * 100)
      setReconciliationProgress(progress)

      // Add a small delay to show progress
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    setAllReconciliationResults(results)
    setIsAutoReconciling(false)
    setReconciliationProgress(100)
  }

  // Helper function to calculate total amount from trade data
  const calculateTotalAmount = (trade: TradeData): number => {
    if (trade.dataSource === "equity") {
      const commission = trade.commission || 0
      const taxes = trade.taxes || 0
      const totalCost = trade.totalCost || 0
      return totalCost || commission + taxes
    } else {
      const commissionAmount = trade.commissionAmount || 0
      const brokerageFee = trade.brokerageFee || 0
      const custodyFee = trade.custodyFee || 0
      const settlementCost = trade.settlementCost || 0
      return commissionAmount + brokerageFee + custodyFee + settlementCost
    }
  }

  // Get current fields based on dataset type
  const getCurrentFields = () => {
    if (datasetType === "fx") return fxDatasetFields
    if (datasetType === "equity") return equityDatasetFields
    return []
  }

  // Detect dataset type based on headers
  const detectDatasetType = (headers: string[]): "fx" | "equity" | null => {
    const fxHeaders = fxDatasetFields.map((f) => f.key.toLowerCase())
    const equityHeaders = equityDatasetFields.map((f) => f.key.toLowerCase())

    const normalizedHeaders = headers.map((h) => h.toLowerCase())

    // Check for unique FX fields
    const fxMatches = normalizedHeaders.filter((h) => fxHeaders.includes(h)).length
    const equityMatches = normalizedHeaders.filter((h) => equityHeaders.includes(h)).length

    // Check for specific identifying fields
    if (normalizedHeaders.includes("tradeid") && normalizedHeaders.includes("currencypair")) {
      return "fx"
    }
    if (normalizedHeaders.includes("trade id") && normalizedHeaders.includes("symbol")) {
      return "equity"
    }

    // Fallback to match count
    return fxMatches > equityMatches ? "fx" : "equity"
  }

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      handleFileSelect({ target: { files: [file] } } as any)
    }
  }

  const handleFileSelect = (event: any) => {
    const file = event.target.files[0]
    if (!file) return

    setUploadedFile(file)

    const reader = new FileReader()
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)

      setUploadedData(jsonData)

      // Analyze headers for mapping
      const headers = Object.keys(jsonData[0] || {})
      const detectedType = detectDatasetType(headers)
      setDatasetType(detectedType)

      setUploadAnalysis({ headers, detectedType })

      // Auto-map fields based on detected type
      const autoMapping = createAutoMappingFromTradeData(headers, detectedType)
      setFieldMapping(autoMapping)

      // Move to the mapping step
      setUploadStep("map")
    }
    reader.readAsArrayBuffer(file)
  }

  const renderDataUpload = () => (
    <div className="space-y-6">
      {uploadStep === "upload" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Upload or Source Trade Data</CardTitle>
              <CardDescription>
                Upload Excel or CSV files containing trade data, or source data from Firebase. The system will automatically detect whether it's FX or
                Equity data and show the appropriate field mapping.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Data Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Data Type Selection
                </label>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setDatasetType("equity")}
                    className={`flex items-center px-4 py-2 rounded-lg border-2 transition-colors ${
                      datasetType === "equity"
                        ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                        : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 hover:border-teal-300"
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Equity Trades
                  </button>
                  <button
                    onClick={() => setDatasetType("fx")}
                    className={`flex items-center px-4 py-2 rounded-lg border-2 transition-colors ${
                      datasetType === "fx"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 hover:border-blue-300"
                    }`}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    FX Trades
                  </button>
                </div>
              </div>

              {/* Source Data from Firebase Button */}
              <div className="mb-6">
                <Button
                  onClick={async () => {
                    const currentType = datasetTypeRef.current;
                    if (!currentType) {
                      alert("Please select a data type first");
                      return;
                    }
                    try {
                      // Load from unified_data collection using tradeOperations
                      const data = await tradeOperations.getTradesByDataSource(currentType);
                      // Convert Firestore Timestamps to strings
                      const convertedData = data.map((row: any) => {
                        const converted: any = {};
                        Object.entries(row).forEach(([key, value]) => {
                          if (
                            value &&
                            typeof value === "object" &&
                            value !== null &&
                            "seconds" in value &&
                            typeof (value as any).seconds === "number"
                          ) {
                            converted[key] = new Date((value as any).seconds * 1000).toISOString();
                          } else {
                            converted[key] = value;
                          }
                        });
                        return converted;
                      });
                      setUploadedData(convertedData);
                      const headers = Object.keys(convertedData[0] || {});
                      setDatasetType(currentType);
                      setUploadAnalysis({ headers, detectedType: currentType });
                      // Auto-map fields using the selected type
                      const autoMapping = createAutoMappingFromTradeData(headers, currentType);
                      setFieldMapping(autoMapping);
                      setUploadStep("map");
                    } catch (err) {
                      alert("Failed to load data from Firebase");
                    }
                  }}
                  disabled={!datasetType || firebaseLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {firebaseLoading ? "Loading..." : "Source data from Firebase"}
                </Button>
              </div>

              <Alert className="border-blue-300 bg-blue-100 dark:bg-blue-900">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 dark:text-blue-200">Supported Datasets</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  The system supports both FX (55 fields) and Equity (31 fields) trade datasets with automatic field
                  detection and mapping.
                </AlertDescription>
              </Alert>

              <div
                className="border-2 border-dashed border-teal-300 rounded-lg p-8 text-center hover:border-teal-400 transition-colors"
                style={{
                  backgroundColor: "rgb(240 253 250)",
                  borderColor: "rgb(153 246 228)",
                }}
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="mx-auto h-12 w-12 text-teal-500" />
                <div className="mt-4">
                  <label htmlFor="data-file-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Drop files here or click to upload
                    </span>
                    <input
                      id="data-file-upload"
                      name="data-file-upload"
                      type="file"
                      className="sr-only"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-gray-500">Supported formats: Excel (.xlsx, .xls), CSV (.csv)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-teal-200">
            <CardHeader className="border-b border-teal-200">
              <CardTitle className="text-teal-800">Dataset Information</CardTitle>
              <CardDescription>Information about the supported datasets and their fields.</CardDescription>
            </CardHeader>
            <CardContent className="bg-teal-50 dark:bg-teal-950">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* FX Dataset Info */}
                <div>
                  <h4 className="font-semibold text-teal-800 dark:text-teal-200 mb-3 flex items-center">
                    <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>📗 FX Dataset (55 Fields)
                  </h4>
                  <div className="space-y-2">
                    <div className="text-sm text-teal-700 dark:text-teal-300">
                      <strong>Key Fields:</strong> TradeID, TradeDate, Counterparty, CurrencyPair, NotionalAmount,
                      FXRate, CommissionAmount, BrokerageFee, CustodyFee, SettlementCost
                    </div>
                    <div className="text-sm text-teal-700 dark:text-teal-300">
                      <strong>Detection:</strong> Identified by TradeID + CurrencyPair fields
                    </div>
                  </div>
                </div>

                {/* Equity Dataset Info */}
                <div>
                  <h4 className="font-semibold text-teal-800 dark:text-teal-200 mb-3 flex items-center">
                    <div className="w-4 h-4 bg-teal-500 rounded mr-2"></div>📘 Equity Dataset (31 Fields)
                  </h4>
                  <div className="space-y-2">
                    <div className="text-sm text-teal-700 dark:text-teal-300">
                      <strong>Key Fields:</strong> Trade ID, Trade Date, Counterparty, Symbol, Quantity, Price, Trade
                      Value, Commission, Taxes, Total Cost
                    </div>
                    <div className="text-sm text-teal-700 dark:text-teal-300">
                      <strong>Detection:</strong> Identified by "Trade ID" + Symbol fields
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-teal-100 dark:bg-teal-900 rounded-lg">
                <div className="text-xs text-teal-700 dark:text-teal-300">
                  <strong>Note:</strong> The system will automatically detect your dataset type and show the appropriate
                  field mapping options. Only TradeID (FX) or Trade ID (Equity) is required for processing.
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {uploadStep === "map" && uploadAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>Map Data Fields</CardTitle>
            <CardDescription>
              Dataset detected as:{" "}
              <Badge
                variant="outline"
                className={datasetType === "fx" ? "border-blue-500 text-blue-600" : "border-teal-500 text-teal-600"}
              >
                {datasetType === "fx" ? "FX Dataset (55 fields)" : "Equity Dataset (31 fields)"}
              </Badge>
              <br />
              Map your file columns to the dataset fields. Auto-mapping has been applied based on field names.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Field Mapping</h3>
                  <p className="text-sm text-gray-500">
                    {Object.keys(fieldMapping).length} of {getCurrentFields().length} fields mapped
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={autoMapFields}
                    variant="outline"
                    className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                  >
                    Auto-Map Fields
                  </Button>
                  <Button onClick={() => setUploadStep("upload")} variant="outline">
                    Back
                  </Button>
                </div>
              </div>

              <div className="overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dataset Field</TableHead>
                      <TableHead>Your Column</TableHead>
                      <TableHead>Sample Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCurrentFields().map((field) => (
                      <TableRow key={field.key}>
                        <TableCell className="font-medium">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
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
                              {uploadAnalysis.headers.map((header: string) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                          {fieldMapping[field.key] && uploadedData.length > 0
                            ? String(uploadedData[0][fieldMapping[field.key]] || "").substring(0, 30)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {fieldMapping[field.key] ? (
                            <Badge variant="outline" className="border-green-500 text-green-600">
                              Mapped
                            </Badge>
                          ) : field.required ? (
                            <Badge variant="outline" className="border-red-500 text-red-600">
                              Required
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-gray-500 text-gray-600">
                              Optional
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => processUploadedData()}
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                  disabled={!canProcessData()}
                >
                  Process Data ({Object.keys(fieldMapping).filter((k) => fieldMapping[k]).length} fields mapped)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadStep === "complete" && (
        <Card>
          <CardContent className="text-center py-12">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Data Uploaded Successfully</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {uploadedInvoices.length} records have been processed from the {datasetType?.toUpperCase()} dataset and
              added to the system.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                <div className="text-lg font-bold text-teal-600">{uploadedInvoices.length}</div>
                <div className="text-sm text-teal-700">Total Records</div>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {uploadedInvoices.filter((inv) => inv.status === "reconciled").length}
                </div>
                <div className="text-sm text-green-700">Auto-Reconciled</div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-lg font-bold text-blue-600">
                  {uploadedInvoices.filter((inv) => inv.status === "pending").length}
                </div>
                <div className="text-sm text-blue-700">Pending Review</div>
              </div>
            </div>
            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => {
                  setUploadStep("upload")
                  setUploadedFile(null)
                  setUploadedData([])
                  setFieldMapping({})
                  setDatasetType(null)
                }}
                variant="outline"
              >
                Upload Another File
              </Button>
              <Button
                onClick={() => setActiveTab("reconciliation")}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                View Reconciliation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  const renderInvoiceGeneration = () => {
    // Calculate pagination
    const startIndex = (currentPage - 1) * recordsPerPage
    const endIndex = startIndex + recordsPerPage
    const currentRecords = uploadedTradeData.slice(startIndex, endIndex)
    const totalPages = Math.ceil(totalRecords / recordsPerPage)

    // Page options for dropdown
    const pageOptions = []
    for (let i = 1; i <= totalPages; i++) {
      const start = (i - 1) * recordsPerPage + 1
      const end = Math.min(i * recordsPerPage, totalRecords)
      pageOptions.push({
        value: i,
        label: `${start}-${end}`,
        description: `Records ${start} to ${end}`,
      })
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Generation</CardTitle>
            <CardDescription>
              Generate dynamic invoices for all trade IDs from uploaded datasets. Showing {recordsPerPage} records at a
              time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{totalRecords}</span> trade records available
                </div>
                <Badge variant="outline" className="border-teal-500 text-teal-600">
                  {uploadedTradeData.filter((t) => t.dataSource === "equity").length} Equity
                </Badge>
                <Badge variant="outline" className="border-blue-500 text-blue-600">
                  {uploadedTradeData.filter((t) => t.dataSource === "fx").length} FX
                </Badge>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Show records:</span>
                  <Select
                    value={currentPage.toString()}
                    onValueChange={(value) => setCurrentPage(Number.parseInt(value))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => {
                    // Refresh from uploaded data
                    if (uploadedTradeData.length === 0) {
                      // Load from system datasets if no uploaded data
                      loadAllTradeData()
                    }
                  }}
                  variant="outline"
                  className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            </div>

            {uploadedTradeData.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Trade Data Available</h3>
                <p className="text-gray-500 mb-4">
                  Please upload trade data in the Data Upload tab first, or load sample data from the system datasets.
                </p>
                <div className="flex justify-center space-x-4">
                  <Button
                    onClick={() => setActiveTab("data-upload")}
                    className="bg-teal-500 hover:bg-teal-600 text-white"
                  >
                    Go to Data Upload
                  </Button>
                  <Button
                    onClick={loadAllTradeData}
                    variant="outline"
                    className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                  >
                    Load Sample Data
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium text-teal-800">
                        Showing records {startIndex + 1} to {Math.min(endIndex, totalRecords)} of {totalRecords}
                      </h4>
                      <p className="text-sm text-teal-600">
                        Page {currentPage} of {totalPages} • {currentRecords.length} records on this page
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                        className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                      >
                        Previous
                      </Button>
                      <Button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                        className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trade ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Counterparty</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Trade Date</TableHead>
                        <TableHead>Settlement Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Dispute Risk</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentRecords.map((trade, index) => {
                        const disputeInfo = checkTradeHasDispute(trade)
                        return (
                          <TableRow key={`${trade.tradeId}-${startIndex + index}`}>
                            <TableCell className="font-medium font-mono text-sm">
                              {trade["TradeID"] || trade["tradeID"] || trade["Trade Id"] || trade.tradeId}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  trade.dataSource === "equity"
                                    ? "border-teal-500 text-teal-600"
                                    : "border-blue-500 text-blue-600"
                                }
                              >
                                {trade.dataSource === "equity" ? "Equity" : "FX"}
                              </Badge>
                            </TableCell>
                            <TableCell>{trade.counterparty}</TableCell>
                            <TableCell className="font-medium">
                              {trade.dataSource === "equity"
                                ? `$${(trade.tradeValue || (trade.quantity || 0) * (trade.price || 0)).toLocaleString()}`
                                : `$${((trade.notionalAmount || 0) * (trade.fxRate || 1)).toLocaleString()}`}
                            </TableCell>
                            <TableCell>{trade.currency || trade.baseCurrency || "USD"}</TableCell>
                            <TableCell>{excelDateToJSDate(trade["TradeDate"] || trade["tradeDate"] || trade["Trade Date"] || trade.tradeDate)}</TableCell>
                            <TableCell>{excelDateToJSDate(trade["SettlementDate"] || trade["settlementDate"] || trade["Settlement Date"] || trade.settlementDate)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={trade.settlementStatus === "Settled" ? "default" : "secondary"}
                                className={
                                  trade.settlementStatus === "Settled"
                                    ? "bg-green-500 text-white"
                                    : "bg-teal-500 text-white"
                                }
                              >
                                {trade.settlementStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {disputeInfo.hasDispute ? (
                                <div className="space-y-1">
                                  {disputeInfo.disputeTypes.map((disputeType, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="border-red-500 text-red-600 text-xs block"
                                    >
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      {disputeType}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <Badge variant="outline" className="border-green-500 text-green-600">
                                  <Check className="h-3 w-3 mr-1" />
                                  Clean
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  onClick={() => viewInvoice(trade)}
                                  variant="outline"
                                  size="sm"
                                  className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View Invoice
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center space-x-4 mt-6">
                    <Button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                      className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                    >
                      First
                    </Button>
                    <Button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                      className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                      className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                    >
                      Next
                    </Button>
                    <Button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                      className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                    >
                      Last
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Invoice Modal */}
        {showInvoiceModal && selectedInvoiceData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Invoice - {selectedInvoiceData.tradeId}
                </h2>
                <Button onClick={() => setShowInvoiceModal(false)} variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-6">
                <InvoiceDocument trade={selectedInvoiceData} />
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-4">
                <Button onClick={() => setShowInvoiceModal(false)} variant="outline">
                  Close
                </Button>
                <Button
                  onClick={() => {
                    forwardToInvoiceUpload(selectedInvoiceData)
                    setShowInvoiceModal(false)
                  }}
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                >
                  Forward to Upload
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const loadAllTradeData = async () => {
    try {
      const data = await fetchTradeData()
      setAllTradeData(data)
      // Also set as uploaded trade data if none exists
      if (uploadedTradeData.length === 0) {
        setUploadedTradeData(data)
        setTotalRecords(data.length)
      }
      
      // Also populate Payment Tracker data
      const paymentData = transformToPaymentTrackerData(data)
      setPaymentTrackerData(paymentData)
    } catch (error) {
      console.error("Error loading trade data:", error)
    }
  }

  const viewInvoice = (trade: TradeData) => {
    setSelectedInvoiceData(trade)
    setShowInvoiceModal(true)
  }

  const forwardToInvoiceUpload = (trade: TradeData) => {
    const fees = calculateInvoiceFees(trade)

    // Generate agent name consistently
    const generateAgentName = (trade: TradeData) => {
      const agentPools = {
        equity: [
          "Barclays Capital",
          "Goldman Sachs Securities",
          "Morgan Stanley Capital",
          "JPMorgan Securities",
          "UBS Investment Bank",
        ],
        fx: ["Deutsche Bank AG", "Citibank N.A.", "HSBC Bank PLC", "BNP Paribas", "Credit Suisse AG"],
      }

      const pool = trade.dataSource === "equity" ? agentPools.equity : agentPools.fx
      const hash = trade.tradeId.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
      return pool[hash % pool.length]
    }

    const agentName = generateAgentName(trade)

    const invoiceData = {
      tradeId: trade.tradeId,
      agentName: agentName,
      invoiceNumber: `INV-${trade.tradeId}-${new Date().getFullYear()}`,
      amount: fees.total,
      currency: trade.currency || trade.baseCurrency || "USD",
      serviceType: trade.dataSource === "equity" ? "Equity Services" : "FX Services",
      invoiceDate: new Date().toLocaleDateString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      status: "pending",
      // Include full trade data for reconciliation
      tradeData: trade,
      fees: fees,
    }

    setForwardedInvoiceData(invoiceData)
    setActiveTab("upload")
  }

  const calculateInvoiceFees = (trade: TradeData) => {
    if (trade.dataSource === "equity") {
      // Use actual values from dataset or fallback to calculated values
      const custodyFee = trade.custodyFee || (trade.tradeValue || 0) * 0.0005
      const settlementFee = trade.settlementCost || 25
      const baseFee = trade.commission || (trade.tradeValue || 0) * 0.001

      return {
        baseFee: baseFee,
        custodyFee: custodyFee,
        settlementFee: settlementFee,
        total: baseFee + custodyFee + settlementFee,
      }
    } else {
      // For FX trades, use actual values from dataset
      const custodyFee = trade.custodyFee || 0
      const settlementFee = trade.settlementCost || 0
      const baseFee = trade.commissionAmount || trade.brokerageFee || 0

      // If no actual fees in dataset, calculate based on notional
      if (custodyFee === 0 && settlementFee === 0 && baseFee === 0) {
        const notional = (trade.notionalAmount || 0) * (trade.fxRate || 1)
        return {
          baseFee: notional * 0.0008,
          custodyFee: notional * 0.0003,
          settlementFee: 50,
          total: notional * 0.0011 + 50,
        }
      }

      return {
        baseFee: baseFee,
        custodyFee: custodyFee,
        settlementFee: settlementFee,
        total: baseFee + custodyFee + settlementFee,
      }
    }
  }

  const renderInvoiceUpload = () => (
    <div className="space-y-6">
      {forwardedInvoiceData && (
        <Alert className="border-green-300 bg-green-100 dark:bg-green-900">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-200">Invoice Data Received</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            Invoice data for Trade ID {forwardedInvoiceData.tradeId} has been forwarded from Invoice Generation.
            <Button
              onClick={() => setForwardedInvoiceData(null)}
              variant="ghost"
              size="sm"
              className="ml-2 p-1 h-auto text-green-600 hover:text-green-800"
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* FORCE TEAL STYLING - NO YELLOW */}
      <div className="bg-white dark:bg-gray-800 border border-teal-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-teal-200">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Upload Agent Invoices</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Upload invoices in Excel, CSV, or PDF format for reconciliation and processing.
          </p>
        </div>

        <div className="p-6">
          <div
            className="border-2 border-dashed border-teal-300 rounded-lg p-8 text-center hover:border-teal-400 transition-colors"
            style={{
              backgroundColor: "rgb(240 253 250)",
              borderColor: "rgb(153 246 228)",
            }}
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="mx-auto h-12 w-12 text-teal-500" />
            <div className="mt-4">
              <label htmlFor="invoice-file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Drop invoice files here or click to upload
                </span>
                <input
                  id="invoice-file-upload"
                  name="invoice-file-upload"
                  type="file"
                  className="sr-only"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={handleInvoiceFileSelect}
                  multiple
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-500">Supported formats: Excel (.xlsx, .xls), CSV (.csv), PDF (.pdf)</p>
          </div>

          {forwardedInvoiceData && (
            <div className="mt-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <h3 className="font-medium text-teal-800 mb-3">Forwarded Invoice Data</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-teal-700">Trade ID:</span> {forwardedInvoiceData.tradeId}
                </div>
                <div>
                  <span className="font-medium text-teal-700">Agent:</span> {forwardedInvoiceData.agentName}
                </div>
                <div>
                  <span className="font-medium text-teal-700">Amount:</span> ${(forwardedInvoiceData.amount || 0).toFixed(2)}{" "}
                  {forwardedInvoiceData.currency}
                </div>
                <div>
                  <span className="font-medium text-teal-700">Service Type:</span> {forwardedInvoiceData.serviceType}
                </div>
              </div>
              <div className="mt-3 flex space-x-2">
                <Button
                  onClick={() => processForwardedInvoice()}
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                  size="sm"
                >
                  Process Invoice
                </Button>
                <Button
                  onClick={() => setForwardedInvoiceData(null)}
                  variant="outline"
                  size="sm"
                  className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Card className="border-teal-200">
        <CardHeader className="border-b border-teal-200">
          <CardTitle className="text-teal-800">Recent Uploads</CardTitle>
          <CardDescription>Recently uploaded invoices and their processing status.</CardDescription>
        </CardHeader>
        <CardContent className="bg-teal-50 dark:bg-teal-950">
          {uploadedInvoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-teal-400 mb-4" />
              <p className="text-teal-600 dark:text-teal-400">No invoices uploaded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Trade ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadedInvoices.slice(0, 5).map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.agentName}</TableCell>
                      <TableCell className="font-mono text-sm">{invoice.tradeId}</TableCell>
                      <TableCell>
                        ${invoice.amount.toLocaleString()} {invoice.currency}
                      </TableCell>
                      <TableCell>{invoice.uploadDate}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invoice.status === "reconciled" || invoice.status === "approved" ? "default" : "secondary"
                          }
                          className={getStatusColor(invoice.status)}
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const processForwardedInvoice = () => {
    if (!forwardedInvoiceData) return

    const newInvoice: Invoice = {
      id: `INV${Date.now()}`,
      agentName: forwardedInvoiceData.agentName,
      invoiceNumber: forwardedInvoiceData.invoiceNumber,
      tradeId: forwardedInvoiceData.tradeId,
      amount: forwardedInvoiceData.amount,
      currency: forwardedInvoiceData.currency,
      serviceType: forwardedInvoiceData.serviceType,
      uploadDate: new Date().toLocaleDateString(),
      status: "pending",
      tradeData: forwardedInvoiceData.tradeData,
      fees: forwardedInvoiceData.fees,
      isForwarded: true, // Mark as forwarded
    }

    setInvoices((prev) => [newInvoice, ...prev])
    setUploadedInvoices((prev) => [newInvoice, ...prev])
    setForwardedInvoiceData(null)

    // Show success message or redirect to reconciliation
    setActiveTab("reconciliation")
  }

  const handleInvoiceFileSelect = (event: any) => {
    const files = Array.from(event.target.files) as File[]
    if (files.length === 0) return

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e: any) => {
        // Process the file based on type
        if (file.type.includes("pdf")) {
          // Handle PDF processing
          processPDFInvoice(file, e.target.result)
        } else {
          // Handle Excel/CSV processing
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: "array" })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)

          processExcelInvoice(file, jsonData)
        }
      }

      if (file.type.includes("pdf")) {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsArrayBuffer(file)
      }
    })
  }

  const processPDFInvoice = (file: File, data: ArrayBuffer) => {
    // Mock PDF processing - in real implementation, use PDF parsing library
    const mockInvoiceData = {
      invoiceNumber: `PDF-${Date.now()}`,
      agentName: "PDF Agent",
      tradeId: `TRD${Math.floor(Math.random() * 1000)}`,
      amount: Math.floor(Math.random() * 50000) + 5000,
      currency: "USD",
      serviceType: "PDF Services",
    }

    addProcessedInvoice(mockInvoiceData)
  }

  const processExcelInvoice = (file: File, data: any[]) => {
    // Process each row as an invoice
    data.forEach((row, index) => {
      const invoiceData = {
        invoiceNumber: row["Invoice Number"] || `XLS-${Date.now()}-${index}`,
        agentName: row["Agent Name"] || row["Agent"] || "Unknown Agent",
        tradeId: row["Trade ID"] || row["TradeID"] || `TRD${Math.floor(Math.random() * 1000)}`,
        amount: Number.parseFloat(row["Amount"] || row["Total"] || Math.random() * 50000 + 5000),
        currency: row["Currency"] || "USD",
        serviceType: row["Service Type"] || row["Service"] || "Excel Services",
      }

      addProcessedInvoice(invoiceData)
    })
  }

  const addProcessedInvoice = (invoiceData: any) => {
    const newInvoice: Invoice = {
      id: `INV${Date.now()}-${Math.random()}`,
      agentName: invoiceData.agentName,
      invoiceNumber: invoiceData.invoiceNumber,
      tradeId: invoiceData.tradeId,
      amount: invoiceData.amount,
      currency: invoiceData.currency,
      serviceType: invoiceData.serviceType,
      uploadDate: new Date().toLocaleDateString(),
      status: "pending",
    }

    setInvoices((prev) => [newInvoice, ...prev])
    setUploadedInvoices((prev) => [newInvoice, ...prev])
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "reconciled":
        return "bg-green-500 text-white"
      case "approved":
        return "bg-blue-500 text-white"
      case "mismatch":
        return "bg-red-500 text-white"
      case "disputed":
        return "bg-purple-500 text-white"
      case "paid":
        return "bg-teal-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  // Load trade data on component mount
  useEffect(() => {
    loadAllTradeData()
  }, [])

  // Auto-run reconciliation when trade data is available and on reconciliation tab
  useEffect(() => {
    if (
      uploadedTradeData.length > 0 &&
      allReconciliationResults.size === 0 &&
      !isAutoReconciling &&
      activeTab === "reconciliation"
    ) {
      performAutoReconciliation()
    }
  }, [uploadedTradeData, activeTab, allReconciliationResults.size, isAutoReconciling])

  const createAutoMappingFromTradeData = (headers: string[], detectedType: "fx" | "equity" | null) => {
    const mapping: Record<string, string> = {}

    if (!detectedType) return mapping

    const fields = detectedType === "fx" ? fxDatasetFields : equityDatasetFields

    fields.forEach((field) => {
      const normalizedFieldKey = field.key.toLowerCase().replace(/[^a-z0-9]/g, "")
      const matchingHeader = headers.find((header) => {
        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "")
        return normalizedHeader === normalizedFieldKey || normalizedHeader.includes(normalizedFieldKey)
      })

      if (matchingHeader) {
        mapping[field.key] = matchingHeader
      }
    })

    return mapping
  }

  const autoMapFields = () => {
    if (!uploadAnalysis || !datasetType) return

    const autoMapping = createAutoMappingFromTradeData(uploadAnalysis.headers, datasetType)
    setFieldMapping(autoMapping)
  }

  const handleFieldMapping = (fieldKey: string, columnName: string) => {
    setFieldMapping((prev) => ({
      ...prev,
      [fieldKey]: columnName === "__none__" ? "" : columnName,
    }))
  }

  const canProcessData = () => {
    const requiredFields = getCurrentFields().filter((f) => f.required)
    return requiredFields.every((field) => fieldMapping[field.key])
  }

  const processUploadedData = async () => {
    if (!canProcessData()) return

    // Transform uploaded data to TradeData format
    const transformedData: TradeData[] = uploadedData.map((row, index) => {
      const tradeData: any = {
        dataSource: datasetType,
      }

      // Map fields based on field mapping
      Object.entries(fieldMapping).forEach(([fieldKey, columnName]) => {
        if (columnName && row[columnName] !== undefined) {
          // Convert field key to camelCase for TradeData interface
          const camelCaseKey = fieldKey.replace(/([A-Z])/g, (match, letter, offset) =>
            offset === 0 ? letter.toLowerCase() : letter,
          )
          tradeData[camelCaseKey] = row[columnName]
        }
      })

      // Ensure required fields are present
      if (!tradeData.tradeId) {
        tradeData.tradeId = `AUTO-${datasetType?.toUpperCase()}-${index + 1}`
      }

      // Normalize field names for consistency
      if (tradeData.tradeID && !tradeData.tradeId) {
        tradeData.tradeId = tradeData.tradeID
      }

      return tradeData as TradeData
    })

    // Save to Firebase in the appropriate subcollection
    if (datasetType) {
      try {
        for (const record of transformedData) {
          await createAgentBilling(record, datasetType);
        }
      } catch (error) {
        console.error("Error saving to Firebase:", error);
        alert(`Error saving to Firebase: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update state with processed data
    setUploadedTradeData(transformedData)
    setTotalRecords(transformedData.length)

    // Generate invoices from the uploaded data
    const generatedInvoices: Invoice[] = transformedData.map((trade, index) => ({
      id: `UPL${Date.now()}-${index}`,
      agentName: trade.counterparty || `Agent ${index + 1}`,
      invoiceNumber: `INV-${trade.tradeId}-${new Date().getFullYear()}`,
      tradeId: trade.tradeId,
      amount: trade.dataSource === "equity" ? trade.tradeValue || 0 : (trade.notionalAmount || 0) * (trade.fxRate || 1),
      currency: trade.currency || trade.baseCurrency || "USD",
      serviceType: trade.dataSource === "equity" ? "Equity" : "FX",
      uploadDate: new Date().toLocaleDateString(),
      status: Math.random() > 0.7 ? "reconciled" : "pending",
    }))

    setUploadedInvoices(generatedInvoices)
    setInvoices((prev) => [...generatedInvoices, ...prev])

    setUploadStep("complete")
  }

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-teal-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-teal-100 rounded-lg">
                <FileText className="h-6 w-6 text-teal-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">{totalInvoicesThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Upload className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Uploaded This Month</p>
                <p className="text-2xl font-bold text-gray-900">{uploadedThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cost Reconciled</p>
                <p className="text-2xl font-bold text-gray-900">${totalCostReconciled.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Open Disputes</p>
                <p className="text-2xl font-bold text-gray-900">{disputesOpen}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Source Indicator */}
      {uploadedTradeData.length > 0 ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Live Data</AlertTitle>
          <AlertDescription>
            Dashboard is showing data from Firebase ({uploadedTradeData.length} trades loaded).
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Demo Data</AlertTitle>
          <AlertDescription>
            Dashboard is showing sample data. Go to the Data Upload tab and click "Source Data from Firebase" to load real data.
          </AlertDescription>
        </Alert>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-teal-200">
          <CardHeader>
            <CardTitle className="text-teal-800">Reconciliation Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={reconciliationStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {reconciliationStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">Cost Breakdown by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costBreakdownData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Amount"]} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="text-purple-800">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{pendingApprovals}</div>
            <p className="text-sm text-gray-600">Invoices awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800">Cost Leakage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">${costLeakage.toLocaleString()}</div>
            <p className="text-sm text-gray-600">{costLeakagePercent.toFixed(1)}% of total costs</p>
          </CardContent>
        </Card>

        <Card className="border-teal-200">
          <CardHeader>
            <CardTitle className="text-teal-800">Top Overcharged Agent</CardTitle>
          </CardHeader>
          <CardContent>
            {topOverchargedAgents.length > 0 ? (
              <div>
                <div className="text-lg font-bold text-teal-600">{topOverchargedAgents[0].agent}</div>
                <p className="text-sm text-gray-600">${topOverchargedAgents[0].variance.toLocaleString()} variance</p>
              </div>
            ) : (
              <p className="text-gray-500">No overcharges detected</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderReconciliation = () => {
    // Get reconciliation results for current page
    const reconciliationEntries = Array.from(allReconciliationResults.entries())
    const startIndex = (reconciliationPage - 1) * reconciliationPerPage
    const endIndex = startIndex + reconciliationPerPage
    const currentReconciliationResults = reconciliationEntries.slice(startIndex, endIndex)
    const totalReconciliationPages = Math.ceil(reconciliationEntries.length / reconciliationPerPage)

    // Calculate summary statistics
    const totalReconciled = reconciliationEntries.length
    const matchCount = reconciliationEntries.filter(([_, result]) => result.overallStatus === "reconciled").length
    const mismatchCount = reconciliationEntries.filter(([_, result]) => result.overallStatus === "mismatch").length
    const partialCount = reconciliationEntries.filter(([_, result]) => result.overallStatus === "matched").length
    const disputeCount = reconciliationEntries.filter(([_, result]) => result.hasDispute).length

    return (
      <div className="space-y-6">
        {/* Reconciliation Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-teal-200">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-teal-600">{totalReconciled}</div>
                <div className="text-sm text-gray-600">Total Reconciled</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{matchCount}</div>
                <div className="text-sm text-gray-600">Perfect Matches</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{mismatchCount}</div>
                <div className="text-sm text-gray-600">Mismatches</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{partialCount}</div>
                <div className="text-sm text-gray-600">Matched</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{disputeCount}</div>
                <div className="text-sm text-gray-600">Disputes Detected</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Auto-Reconciliation Controls */}
        <Card className="border-teal-200">
          <CardHeader>
            <CardTitle className="text-teal-800">Auto-Reconciliation</CardTitle>
            <CardDescription>Automatically reconcile all uploaded trade data against invoice records.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {uploadedTradeData.length} trade records available for reconciliation
                </p>
                {isAutoReconciling && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${reconciliationProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Processing... {reconciliationProgress.toFixed(0)}%</p>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={performAutoReconciliation}
                  disabled={isAutoReconciling || uploadedTradeData.length === 0}
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                >
                  {isAutoReconciling ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Run Auto-Reconciliation
                    </>
                  )}
                </Button>
                {allReconciliationResults.size > 0 && (
                  <Button
                    onClick={() => {
                      setAllReconciliationResults(new Map())
                      setReconciliationProgress(0)
                    }}
                    variant="outline"
                    className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                  >
                    Clear Results
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reconciliation Results */}
        {allReconciliationResults.size > 0 && (
          <Card className="border-teal-200">
            <CardHeader>
              <CardTitle className="text-teal-800">Reconciliation Results</CardTitle>
              <CardDescription>
                Detailed reconciliation results showing matches, mismatches, and dispute analysis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Pagination Controls */}
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, reconciliationEntries.length)} of{" "}
                  {reconciliationEntries.length} results
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => setReconciliationPage(Math.max(1, reconciliationPage - 1))}
                    disabled={reconciliationPage === 1}
                    variant="outline"
                    size="sm"
                    className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600 px-3 py-1">
                    Page {reconciliationPage} of {totalReconciliationPages}
                  </span>
                  <Button
                    onClick={() => setReconciliationPage(Math.min(totalReconciliationPages, reconciliationPage + 1))}
                    disabled={reconciliationPage === totalReconciliationPages}
                    variant="outline"
                    size="sm"
                    className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trade ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Counterparty Match</TableHead>
                      <TableHead>Amount Match</TableHead>
                      <TableHead>Commission Match</TableHead>
                      <TableHead>Dispute Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentReconciliationResults.map(([tradeId, result]) => (
                      <TableRow key={tradeId}>
                        <TableCell className="font-mono text-sm">
                          {
                            // Find the original trade object to get the real trade ID
                            (() => {
                              const trade = uploadedTradeData.find(
                                t => t.tradeId === tradeId || t["TradeID"] === tradeId || t["tradeID"] === tradeId || t["Trade Id"] === tradeId
                              );
                              return trade ? (trade["TradeID"] || trade["tradeID"] || trade["Trade Id"] || trade.tradeId) : tradeId;
                            })()
                          }
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              result.overallStatus === "reconciled"
                                ? "border-green-500 text-green-600"
                                : result.overallStatus === "matched"
                                  ? "border-blue-500 text-blue-600"
                                  : "border-red-500 text-red-600"
                            }
                          >
                            {result.overallStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {result.counterpartyMatch ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          {result.amountMatch ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          {result.commissionMatch ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          {result.hasDispute ? (
                            <div className="space-y-1">
                              {result.disputeTypes?.map((disputeType, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="border-red-500 text-red-600 text-xs block"
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {disputeType}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge variant="outline" className="border-green-500 text-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Clean
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() => {
                              // Create a mock invoice for detailed view
                              const mockInvoice: Invoice = {
                                id: `RECON-${tradeId}`,
                                agentName: result.actualValues.counterparty || "Unknown",
                                invoiceNumber: `INV-${tradeId}-RECON`,
                                tradeId: tradeId,
                                amount: result.actualValues.totalActual || 0,
                                currency: "USD",
                                serviceType: "Reconciliation",
                                uploadDate: new Date().toLocaleDateString(),
                                status: result.overallStatus === "reconciled" ? "reconciled" : "mismatch",
                                reconciliationDetails: result,
                              }
                              setSelectedInvoiceForReconciliation(mockInvoice)
                              setShowReconciliationModal(true)
                            }}
                            variant="outline"
                            size="sm"
                            className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reconciliation Detail Modal */}
        {showReconciliationModal && selectedInvoiceForReconciliation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Reconciliation Details - {selectedInvoiceForReconciliation.tradeId}
                </h2>
                <Button onClick={() => setShowReconciliationModal(false)} variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-6">
                {selectedInvoiceForReconciliation.reconciliationDetails && (
                  <div className="space-y-6">
                    {/* Overall Status */}
                    <div className="p-4 rounded-lg border">
                      <h3 className="font-semibold mb-2">Overall Status</h3>
                      <Badge
                        variant="outline"
                        className={
                          selectedInvoiceForReconciliation.reconciliationDetails.overallStatus === "reconciled"
                            ? "border-green-500 text-green-600"
                            : selectedInvoiceForReconciliation.reconciliationDetails.overallStatus === "matched"
                              ? "border-blue-500 text-blue-600"
                              : "border-red-500 text-red-600"
                        }
                      >
                        {selectedInvoiceForReconciliation.reconciliationDetails.overallStatus.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Dispute Information */}
                    {selectedInvoiceForReconciliation.reconciliationDetails.hasDispute && (
                      <div className="p-4 rounded-lg border border-red-200 bg-red-50">
                        <h3 className="font-semibold mb-2 text-red-800">Dispute Detected</h3>
                        <div className="space-y-2">
                          {selectedInvoiceForReconciliation.reconciliationDetails.disputeTypes?.map(
                            (disputeType, idx) => (
                              <Badge key={idx} variant="outline" className="border-red-500 text-red-600 mr-2">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {disputeType}
                              </Badge>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                    {/* Field-by-Field Comparison */}
                    <div className="p-4 rounded-lg border">
                      <h3 className="font-semibold mb-4">Field Comparison</h3>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Field</TableHead>
                              <TableHead>Expected</TableHead>
                              <TableHead>Actual</TableHead>
                              <TableHead>Match</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>Counterparty</TableCell>
                              <TableCell>
                                {selectedInvoiceForReconciliation.reconciliationDetails.expectedValues.counterparty}
                              </TableCell>
                              <TableCell>
                                {selectedInvoiceForReconciliation.reconciliationDetails.actualValues.counterparty}
                              </TableCell>
                              <TableCell>
                                {selectedInvoiceForReconciliation.reconciliationDetails.counterpartyMatch ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Commission</TableCell>
                              <TableCell>
                                $
                                {(
                                  selectedInvoiceForReconciliation.reconciliationDetails.expectedValues.commission || 0
                                ).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                $
                                {(
                                  selectedInvoiceForReconciliation.reconciliationDetails.actualValues.commission || 0
                                ).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {selectedInvoiceForReconciliation.reconciliationDetails.commissionMatch ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Total Amount</TableCell>
                              <TableCell>
                                $
                                {(
                                  selectedInvoiceForReconciliation.reconciliationDetails.expectedValues.totalExpected ||
                                  0
                                ).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                $
                                {(
                                  selectedInvoiceForReconciliation.reconciliationDetails.actualValues.totalActual || 0
                                ).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {selectedInvoiceForReconciliation.reconciliationDetails.amountMatch ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Discrepancies */}
                    {selectedInvoiceForReconciliation.reconciliationDetails.discrepancies.length > 0 && (
                      <div className="p-4 rounded-lg border border-red-200 bg-red-50">
                        <h3 className="font-semibold mb-2 text-red-800">Discrepancies Found</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {selectedInvoiceForReconciliation.reconciliationDetails.discrepancies.map(
                            (discrepancy, idx) => (
                              <li key={idx} className="text-sm text-red-700">
                                {discrepancy}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-4">
                <Button onClick={() => setShowReconciliationModal(false)} variant="outline">
                  Close
                </Button>
                {selectedInvoiceForReconciliation.reconciliationDetails?.hasDispute && (
                  <Button
                    onClick={() => {
                      // Handle dispute escalation
                      setShowReconciliationModal(false)
                      setActiveTab("disputes")
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    Escalate Dispute
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No Data State */}
        {uploadedTradeData.length === 0 && (
          <Card className="border-teal-200">
            <CardContent className="text-center py-12">
              <RefreshCw className="mx-auto h-12 w-12 text-teal-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Trade Data Available</h3>
              <p className="text-gray-500 mb-4">
                Please upload trade data in the Data Upload tab to perform reconciliation.
              </p>
              <Button onClick={() => setActiveTab("data-upload")} className="bg-teal-500 hover:bg-teal-600 text-white">
                Go to Data Upload
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const renderDisputes = () => {
    // Generate dispute summary data from reconciliation results
    const disputeSummaryData = Array.from(allReconciliationResults.entries())
      .filter(([_, result]) => result.hasDispute)
      .map(([tradeId, result], index) => {
        // Find matching invoice for this trade
        const matchingInvoice =
          invoices.find((inv) => inv.tradeId === tradeId) || uploadedInvoices.find((inv) => inv.tradeId === tradeId)

        // Find the actual trade data to get the properly formatted Trade ID
        const actualTrade = uploadedTradeData.find(
          t => t.tradeId === tradeId || t["TradeID"] === tradeId || t["tradeID"] === tradeId || t["Trade Id"] === tradeId
        );
        const displayTradeId = actualTrade ? (actualTrade["TradeID"] || actualTrade["tradeID"] || actualTrade["Trade Id"] || actualTrade.tradeId) : tradeId;

        return {
          disputeId: `DSP-${(index + 1).toString().padStart(4, "0")}`,
          tradeId: displayTradeId,
          invoiceNumber: matchingInvoice?.invoiceNumber || `INV-${displayTradeId}-AUTO`,
          agent: result.actualValues.counterparty || matchingInvoice?.agentName || "Unknown Agent",
          disputeTypes: result.disputeTypes || [],
          status: result.overallStatus === "mismatch" ? "Open" : "Resolved",
          raisedOn: new Date().toLocaleDateString(),
          lastUpdated: new Date().toLocaleDateString(),
          reconciliationResult: result,
        }
      })

    const renderDisputeSummary = () => (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dispute Summary</CardTitle>
            <CardDescription>Overview of all disputes identified during reconciliation process.</CardDescription>
          </CardHeader>
          <CardContent>
            {disputeSummaryData.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Disputes Found</h3>
                <p className="text-gray-500 mb-4">
                  No disputes have been identified in the current reconciliation results.
                </p>
                <Button
                  onClick={() => setActiveTab("reconciliation")}
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                >
                  Run Reconciliation
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispute ID</TableHead>
                      <TableHead>Trade ID</TableHead>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Dispute Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Raised On</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disputeSummaryData.map((dispute) => (
                      <TableRow key={dispute.disputeId}>
                        <TableCell className="font-medium font-mono text-sm">{dispute.disputeId}</TableCell>
                        <TableCell className="font-mono text-sm">{dispute.tradeId}</TableCell>
                        <TableCell className="font-medium">{dispute.invoiceNumber}</TableCell>
                        <TableCell>{dispute.agent}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {dispute.disputeTypes.map((disputeType, idx) => (
                              <Badge key={idx} variant="outline" className="border-red-500 text-red-600 text-xs block">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {disputeType}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              dispute.status === "Resolved"
                                ? "border-green-500 text-green-600"
                                : "border-red-500 text-red-600"
                            }
                          >
                            {dispute.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{dispute.raisedOn}</TableCell>
                        <TableCell>{dispute.lastUpdated}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              onClick={() => {
                                // View dispute details
                                const mockInvoice: Invoice = {
                                  id: `DISPUTE-${dispute.tradeId}`,
                                  agentName: dispute.agent,
                                  invoiceNumber: dispute.invoiceNumber,
                                  tradeId: dispute.tradeId,
                                  amount: dispute.reconciliationResult.actualValues.totalActual || 0,
                                  currency: "USD",
                                  serviceType: "Dispute Review",
                                  uploadDate: dispute.raisedOn,
                                  status: "disputed",
                                  reconciliationDetails: dispute.reconciliationResult,
                                }
                                setSelectedInvoiceForReconciliation(mockInvoice)
                                setShowReconciliationModal(true)
                              }}
                              variant="outline"
                              size="sm"
                              className="border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              onClick={() => {
                                // Resolve dispute action
                                console.log("Resolving dispute:", dispute.disputeId)
                              }}
                              variant="outline"
                              size="sm"
                              className="border-green-500 text-green-600 hover:bg-green-50 bg-transparent"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )

    return (
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setDisputeTab("summary")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                disputeTab === "summary"
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Dispute Summary
            </button>
            <button
              onClick={() => setDisputeTab("management")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                disputeTab === "management"
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Dispute Management
            </button>
            <button
              onClick={() => setDisputeTab("analytics")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                disputeTab === "analytics"
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Analytics
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {disputeTab === "summary" && renderDisputeSummary()}

        {/* Replace the dispute management tab content with the following enhanced dispute management section: */}
        {disputeTab === "management" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dispute Management</CardTitle>
                <CardDescription>Comprehensive dispute tracking and resolution workflow management.</CardDescription>
              </CardHeader>
              <CardContent>
                {disputeSummaryData.length === 0 ? (
                  <div className="text-center py-12">
                    <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Disputes</h3>
                    <p className="text-gray-500 mb-4">
                      No disputes have been identified. Run reconciliation to detect potential disputes.
                    </p>
                    <Button
                      onClick={() => setActiveTab("reconciliation")}
                      className="bg-teal-500 hover:bg-teal-600 text-white"
                    >
                      Run Reconciliation
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {/* Column 1: Key Information */}
                          <TableHead className="bg-teal-50 dark:bg-teal-950 border-r-2 border-teal-200">
                            <div className="font-semibold text-teal-800 dark:text-teal-200">Key Information</div>
                          </TableHead>
                          {/* Column 2: Details */}
                          <TableHead className="bg-blue-50 dark:bg-blue-950 border-r-2 border-blue-200">
                            <div className="font-semibold text-blue-800 dark:text-blue-200">Dispute Details</div>
                          </TableHead>
                          {/* Column 3: Workflow Management */}
                          <TableHead className="bg-purple-50 dark:bg-purple-950">
                            <div className="font-semibold text-purple-800 dark:text-purple-200">
                              Workflow Management
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {disputeSummaryData.map((dispute, index) => {
                          // Generate additional data from reconciliation results
                          const reconciliationResult = dispute.reconciliationResult
                          const expectedAmount = reconciliationResult.expectedValues.totalExpected || 0
                          const billedAmount = reconciliationResult.actualValues.totalActual || 0
                          const variance = billedAmount - expectedAmount

                          // Generate department based on trade characteristics
                          const department = generateDepartment(dispute.tradeId, dispute.agent)

                          // Generate priority based on variance and dispute types
                          const priority = generatePriority(variance, dispute.disputeTypes)

                          // Generate dynamic description
                          const description = generateDisputeDescription(dispute.disputeTypes, variance, dispute.agent)

                          // Generate resolution status and comments
                          const resolutionData = generateResolutionData(dispute.status, dispute.disputeTypes, variance)

                          return (
                            <TableRow key={dispute.disputeId} className="border-b">
                              {/* Column 1: Key Information */}
                              <TableCell className="bg-teal-50/30 dark:bg-teal-950/30 border-r-2 border-teal-100 align-top p-4">
                                <div className="space-y-3">
                                  <div>
                                    <div className="text-xs font-medium text-teal-700 dark:text-teal-300 uppercase tracking-wide">
                                      Invoice ID
                                    </div>
                                    <div className="font-mono text-sm font-medium">{dispute.invoiceNumber}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-teal-700 dark:text-teal-300 uppercase tracking-wide">
                                      Trade ID
                                    </div>
                                    <div className="font-mono text-sm font-medium">{dispute.tradeId}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-teal-700 dark:text-teal-300 uppercase tracking-wide">
                                      Agent Name
                                    </div>
                                    <div className="text-sm font-medium">{dispute.agent}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-teal-700 dark:text-teal-300 uppercase tracking-wide">
                                      Counterparty
                                    </div>
                                    <div className="text-sm">
                                      {reconciliationResult.actualValues.counterparty || "N/A"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-teal-700 dark:text-teal-300 uppercase tracking-wide">
                                      Date of Dispute
                                    </div>
                                    <div className="text-sm">{dispute.raisedOn}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-teal-700 dark:text-teal-300 uppercase tracking-wide">
                                      Department
                                    </div>
                                    <Badge variant="outline" className="border-teal-500 text-teal-600 text-xs">
                                      {department}
                                    </Badge>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Column 2: Details */}
                              <TableCell className="bg-blue-50/30 dark:bg-blue-950/30 border-r-2 border-blue-100 align-top p-4">
                                <div className="space-y-3">
                                  <div>
                                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                      Dispute Type
                                    </div>
                                    <div className="space-y-1">
                                      {dispute.disputeTypes.map((disputeType, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="outline"
                                          className="border-red-500 text-red-600 text-xs block w-fit"
                                        >
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          {disputeType}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                      Description
                                    </div>
                                    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                      {description}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <div className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                        Expected Amount
                                      </div>
                                      <div className="text-sm font-medium text-green-600">
                                        ${(expectedAmount || 0).toFixed(2)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                        Billed Amount
                                      </div>
                                      <div className="text-sm font-medium text-red-600">${(billedAmount || 0).toFixed(2)}</div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                      Variance
                                    </div>
                                    <div
                                      className={`text-sm font-medium ${variance > 0 ? "text-red-600" : "text-green-600"}`}
                                    >
                                      {variance > 0 ? "+" : ""}${(variance || 0).toFixed(2)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                      Supporting Evidence
                                    </div>
                                    <Button
                                      onClick={() => {
                                        // Find the trade data for this dispute
                                        const tradeData = uploadedTradeData.find((t) => t.tradeId === dispute.tradeId)
                                        if (tradeData) {
                                          setSelectedInvoiceData(tradeData)
                                          setShowInvoiceModal(true)
                                        }
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="border-blue-500 text-blue-600 hover:bg-blue-50 bg-transparent text-xs"
                                    >
                                      <FileText className="h-3 w-3 mr-1" />
                                      View Invoice Document
                                    </Button>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                      Priority
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${
                                        priority === "High"
                                          ? "border-red-500 text-red-600"
                                          : priority === "Medium"
                                            ? "border-orange-500 text-orange-600"
                                            : "border-green-500 text-green-600"
                                      }`}
                                    >
                                      {priority}
                                    </Badge>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Column 3: Workflow Management */}
                              <TableCell className="bg-purple-50/30 dark:bg-purple-950/30 align-top p-4">
                                <div className="space-y-3">
                                  <div>
                                    <div className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                                      Current Status
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${
                                        resolutionData.status === "Resolved"
                                          ? "border-green-500 text-green-600"
                                          : resolutionData.status === "Under Review"
                                            ? "border-blue-500 text-blue-600"
                                            : resolutionData.status === "Escalated"
                                              ? "border-red-500 text-red-600"
                                              : "border-orange-500 text-orange-600"
                                      }`}
                                    >
                                      {resolutionData.status}
                                    </Badge>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                                      Resolution Comments
                                    </div>
                                    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                                      {resolutionData.comments}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                                      Date Resolved
                                    </div>
                                    <div className="text-sm">
                                      {resolutionData.status === "Resolved" ? resolutionData.resolvedDate : "Pending"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                                      Actions
                                    </div>
                                    <div className="flex flex-col space-y-2">
                                      <Button
                                        onClick={() => {
                                          const mockInvoice: Invoice = {
                                            id: `DISPUTE-${dispute.tradeId}`,
                                            agentName: dispute.agent,
                                            invoiceNumber: dispute.invoiceNumber,
                                            tradeId: dispute.tradeId,
                                            amount: billedAmount,
                                            currency: "USD",
                                            serviceType: "Dispute Review",
                                            uploadDate: dispute.raisedOn,
                                            status: "disputed",
                                            reconciliationDetails: dispute.reconciliationResult,
                                          }
                                          setSelectedInvoiceForReconciliation(mockInvoice)
                                          setShowReconciliationModal(true)
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="border-purple-500 text-purple-600 hover:bg-purple-50 bg-transparent text-xs"
                                      >
                                        <Eye className="h-3 w-3 mr-1" />
                                        Review Details
                                      </Button>
                                      {resolutionData.status !== "Resolved" && (
                                        <Button
                                          onClick={() => {
                                            // Handle dispute resolution
                                            console.log("Resolving dispute:", dispute.disputeId)
                                          }}
                                          variant="outline"
                                          size="sm"
                                          className="border-green-500 text-green-600 hover:bg-green-50 bg-transparent text-xs"
                                        >
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Mark Resolved
                                        </Button>
                                      )}
                                      <Button
                                        onClick={() => {
                                          // Handle dispute escalation
                                          console.log("Escalating dispute:", dispute.disputeId)
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="border-red-500 text-red-600 hover:bg-red-50 bg-transparent text-xs"
                                      >
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        Escalate
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* End of dispute management tab content */}

        {disputeTab === "analytics" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dispute Analytics</CardTitle>
                <CardDescription>Analytics and insights on dispute patterns and trends.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Dispute Analytics</h3>
                  <p className="text-gray-500">Detailed analytics and reporting features coming soon.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  // Helper function to generate department based on trade characteristics
  const generateDepartment = (tradeId: string, agentName: string): string => {
    const departments = [
      "Fixed Income Trading",
      "Equity Trading",
      "FX Trading",
      "Prime Brokerage",
      "Securities Lending",
      "Custody Services",
      "Operations",
      "Risk Management",
    ]

    // Use trade ID hash to consistently assign department
    const hash = tradeId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)

    // Bias towards certain departments based on agent name
    if (agentName.toLowerCase().includes("fx") || agentName.toLowerCase().includes("currency")) {
      return "FX Trading"
    } else if (agentName.toLowerCase().includes("equity") || agentName.toLowerCase().includes("stock")) {
      return "Equity Trading"
    } else if (agentName.toLowerCase().includes("custody") || agentName.toLowerCase().includes("safekeeping")) {
      return "Custody Services"
    }

    return departments[hash % departments.length]
  }

  // Helper function to generate priority based on variance and dispute types
  const generatePriority = (variance: number, disputeTypes: string[]): string => {
    const absVariance = Math.abs(variance)

    // High priority conditions
    if (
      absVariance > 10000 ||
      disputeTypes.includes("Duplicate Charges") ||
      disputeTypes.includes("Service Not Rendered") ||
      disputeTypes.includes("Wrong Rate Card Applied")
    ) {
      return "High"
    }

    // Medium priority conditions
    if (
      absVariance > 1000 ||
      disputeTypes.includes("Overcharging") ||
      disputeTypes.includes("Incorrect Tax Application") ||
      disputeTypes.includes("Currency Conversion Error")
    ) {
      return "Medium"
    }

    return "Low"
  }

  // Helper function to generate dynamic dispute description
  const generateDisputeDescription = (disputeTypes: string[], variance: number, agentName: string): string => {
    if (disputeTypes.length === 0) return "No specific dispute identified."

    const descriptions: Record<string, string> = {
      Overcharging: `Agent ${agentName} has applied rates exceeding the agreed fee schedule, resulting in overcharges of $${Math.abs(variance).toFixed(2)}.`,
      "Duplicate Charges": `Duplicate billing detected for the same service or trade execution, leading to double charges of $${Math.abs(variance).toFixed(2)}.`,
      "Missing Trades": `Invoice includes charges for trades not found in our trade capture system, representing phantom charges of $${Math.abs(variance).toFixed(2)}.`,
      "Wrong Counterparty or Account": `Invoice shows incorrect counterparty information that doesn't match our trade records, affecting reconciliation accuracy.`,
      "Incorrect Tax Application": `Tax calculations appear incorrect or inappropriate for this trade type, resulting in excess tax charges of $${Math.abs(variance).toFixed(2)}.`,
      "Service Not Rendered": `Charges applied for services that were not actually provided or required for this trade type.`,
      "Fail Charges Disputed": `Settlement fail charges have been applied incorrectly or without proper justification.`,
      "Currency Conversion Error": `Foreign exchange conversion rates used in billing don't match agreed rates or market rates at trade time.`,
      "Wrong Rate Card Applied": `Incorrect fee schedule or rate card has been used, resulting in significantly higher charges than contracted rates.`,
      "Incorrect Billing Period": `Charges appear to be from wrong billing period or include adjustments from previous periods without proper documentation.`,
    }

    if (disputeTypes.length === 1) {
      return descriptions[disputeTypes[0]] || `Dispute identified: ${disputeTypes[0]}`
    } else {
      return `Multiple issues identified: ${disputeTypes.join(", ")}. Combined impact of $${Math.abs(variance).toFixed(2)} variance from expected amounts.`
    }
  }

  // Helper function to generate resolution data
  const generateResolutionData = (currentStatus: string, disputeTypes: string[], variance: number) => {
    const absVariance = Math.abs(variance)

    // Determine status based on dispute characteristics
    let status = "Open"
    let comments = "Dispute raised and pending initial review. Awaiting agent response and supporting documentation."
    let resolvedDate = null

    // Some disputes might be auto-resolved or under review
    const hash = disputeTypes
      .join("")
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const statusRandom = hash % 10

    if (statusRandom < 2) {
      // 20% resolved
      status = "Resolved"
      resolvedDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()

      if (absVariance > 5000) {
        comments = `Dispute resolved in favor of client. Agent acknowledged billing error and issued credit note for $${absVariance.toFixed(2)}. Rate card corrections implemented to prevent recurrence.`
      } else {
        comments = `Dispute resolved through negotiation. Partial credit of $${(absVariance * 0.7).toFixed(2)} agreed upon. Documentation updated for future reference.`
      }
    } else if (statusRandom < 5) {
      // 30% under review
      status = "Under Review"
      comments = `Dispute under active review. Agent has provided initial response and supporting documentation. Internal validation in progress with trade operations team.`
    } else if (statusRandom < 7) {
      // 20% escalated
      status = "Escalated"
      comments = `Dispute escalated to senior management due to significant variance or repeated issues with this agent. Legal and compliance teams engaged for resolution.`
    }

    return {
      status,
      comments,
      resolvedDate,
    }
  }

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

  // Cost Allocation State
  const [costAllocationData, setCostAllocationData] = useState<any[]>([])
  const [allocationMethod, setAllocationMethod] = useState<"equal" | "proportional" | "custom">("equal")
  const [allocationResults, setAllocationResults] = useState<any[]>([])
  const [costDataFile, setCostDataFile] = useState<File | null>(null)
  const [costDataHeaders, setCostDataHeaders] = useState<string[]>([])
  const [costDataRows, setCostDataRows] = useState<any[]>([])
  const [costFieldMapping, setCostFieldMapping] = useState<Record<string, string>>({})
  const [showCostAllocationResults, setShowCostAllocationResults] = useState(false)
  const [costAllocationLoading, setCostAllocationLoading] = useState(false)
  const [editingRow, setEditingRow] = useState<number | null>(null)

  // Payment Tracker State
  const [paymentTrackerData, setPaymentTrackerData] = useState<any[]>([])
  const [paymentTrackerLoading, setPaymentTrackerLoading] = useState(false)
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("all")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")

  // Cost Allocation Field Mapping
  const costAllocationFields = [
    { key: "agentId", label: "Agent ID", required: true },
    { key: "agentName", label: "Agent Name", required: true },
    { key: "tradeId", label: "Trade ID", required: true },
    { key: "costType", label: "Cost Type", required: true },
    { key: "amount", label: "Amount", required: true },
    { key: "currency", label: "Currency", required: false },
    { key: "costCenter", label: "Cost Center", required: false },
    { key: "department", label: "Department", required: false },
  ]

  // Handle cost data file upload
  const handleCostFileSelect = (event: any) => {
    const file = event.target.files[0]
    if (!file) return

    setCostDataFile(file)
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (jsonData.length > 0) {
          const headers = jsonData[0] as string[]
          const rows = jsonData.slice(1).map((row: any) => {
            const obj: any = {}
            headers.forEach((header, index) => {
              obj[header] = row[index]
            })
            return obj
          })

          setCostDataHeaders(headers)
          setCostDataRows(rows)
          
          // Auto-map fields
          const autoMapping: Record<string, string> = {}
          costAllocationFields.forEach(field => {
            const matchingHeader = headers.find(header => 
              header.toLowerCase().includes(field.key.toLowerCase()) ||
              header.toLowerCase().includes(field.label.toLowerCase())
            )
            if (matchingHeader) {
              autoMapping[field.key] = matchingHeader
            }
          })
          setCostFieldMapping(autoMapping)
        }
      } catch (error) {
        console.error("Error parsing cost data file:", error)
      }
    }

    reader.readAsArrayBuffer(file)
  }

  // Create cost allocation from Firebase data
  const createCostAllocationFromFirebase = async () => {
    setCostAllocationLoading(true)
    try {
      // Use the existing agent billing data from Firebase
      const firebaseData = await agentBillingOperations.getAllAgentBilling()
      
      // Transform Firebase data into cost allocation format
      const costData = firebaseData.map((item: any) => ({
        agentId: item.traderID || item.trader_id || "AGENT_" + Math.floor(Math.random() * 1000),
        agentName: item.counterparty || item.broker || "Agent " + (item.traderID || "Unknown"),
        tradeId: item.tradeId || item.trade_id || "TRADE_" + Math.floor(Math.random() * 1000),
        costType: "Commission", // Default cost type
        amount: item.commission || item.total_cost || Math.random() * 1000,
        currency: item.currency || "USD",
        costCenter: item.costCenter || "Trading",
        department: item.department || "Front Office"
      }))

      setCostAllocationData(costData)
      setCostDataRows(costData)
      setShowCostAllocationResults(true)
    } catch (error) {
      console.error("Error loading cost data from Firebase:", error)
    } finally {
      setCostAllocationLoading(false)
    }
  }

  // Perform cost allocation
  const performCostAllocation = () => {
    if (costAllocationData.length === 0) return

    const results: any[] = []
    const agents = [...new Set(costAllocationData.map(item => item.agentId))]
    
    // Group costs by trade
    const tradeGroups: Record<string, any[]> = {}
    costAllocationData.forEach(item => {
      if (!tradeGroups[item.tradeId]) {
        tradeGroups[item.tradeId] = []
      }
      tradeGroups[item.tradeId].push(item)
    })

    Object.entries(tradeGroups).forEach(([tradeId, costs]) => {
      const totalCost = costs.reduce((sum, cost) => sum + (cost.amount || 0), 0)
      
      if (allocationMethod === "equal") {
        // Equal split among all agents
        const costPerAgent = totalCost / agents.length
        agents.forEach(agentId => {
          results.push({
            tradeId,
            agentId,
            agentName: costAllocationData.find(item => item.agentId === agentId)?.agentName || agentId,
            originalCost: totalCost,
            allocatedAmount: costPerAgent,
            allocationMethod: "Equal Split",
            costType: costs[0]?.costType || "Commission",
            currency: costs[0]?.currency || "USD",
            status: "Allocated"
          })
        })
      } else if (allocationMethod === "proportional") {
        // Proportional allocation based on agent's contribution
        const agentContributions: Record<string, number> = {}
        costs.forEach(cost => {
          agentContributions[cost.agentId] = (agentContributions[cost.agentId] || 0) + cost.amount
        })
        
        const totalContribution = Object.values(agentContributions).reduce((sum, val) => sum + val, 0)
        
        Object.entries(agentContributions).forEach(([agentId, contribution]) => {
          const allocatedAmount = (contribution / totalContribution) * totalCost
          results.push({
            tradeId,
            agentId,
            agentName: costAllocationData.find(item => item.agentId === agentId)?.agentName || agentId,
            originalCost: totalCost,
            allocatedAmount,
            allocationMethod: "Proportional",
            costType: costs[0]?.costType || "Commission",
            currency: costs[0]?.currency || "USD",
            status: "Allocated"
          })
        })
      } else if (allocationMethod === "custom") {
        // Custom allocation - for now, just copy original costs
        costs.forEach(cost => {
          results.push({
            tradeId,
            agentId: cost.agentId,
            agentName: cost.agentName,
            originalCost: cost.amount,
            allocatedAmount: cost.amount,
            allocationMethod: "Custom",
            costType: cost.costType,
            currency: cost.currency,
            status: "Allocated"
          })
        })
      }
    })

    setAllocationResults(results)
    setShowCostAllocationResults(true)
  }

  // Update individual allocation status
  const updateAllocationStatus = (index: number, newStatus: string) => {
    const updatedResults = [...allocationResults]
    updatedResults[index] = { ...updatedResults[index], status: newStatus }
    setAllocationResults(updatedResults)
  }

  // Update individual allocation method
  const updateAllocationMethod = (index: number, newMethod: string) => {
    const updatedResults = [...allocationResults]
    updatedResults[index] = { ...updatedResults[index], allocationMethod: newMethod }
    setAllocationResults(updatedResults)
  }

  // Toggle edit mode for a row
  const toggleEditRow = (index: number) => {
    setEditingRow(editingRow === index ? null : index)
  }

  // Save changes for a row
  const saveRowChanges = (index: number) => {
    setEditingRow(null)
  }

  // Transform Firebase data into payment tracker format
  const transformToPaymentTrackerData = (firebaseData: any[]) => {
    return firebaseData.map((item: any, index: number) => {
      const departments = [
        "Network Management", "Reference Data", "Middle Office", "Confirmations",
        "Collateral Management", "Cost Management", "Settlements", "Compliance"
      ]
      
      // Generate random payment status based on index
      const statusOptions = ["Pending Approval", "Cost Allocated", "Payment Instruction Sent", "Payment Confirmed", "Payment Failed"]
      const statusIndex = index % statusOptions.length
      const status = statusOptions[statusIndex]
      
      // Generate random department allocation
      const departmentIndex = index % departments.length
      const department = departments[departmentIndex]
      
      // Generate invoice details
      const invoiceNumber = `INV-${item.tradeId || item.trade_id || "TRADE"}-${String(index + 1).padStart(3, '0')}`
      const amount = item.commission || item.total_cost || Math.random() * 5000 + 1000
      const dueDate = new Date(Date.now() + (Math.random() * 30 + 7) * 24 * 60 * 60 * 1000)
      
      return {
        id: `payment-${index}`,
        agentName: item.counterparty || item.broker || "Agent " + (item.traderID || "Unknown"),
        invoiceNumber,
        tradeId: item.tradeId || item.trade_id || "TRADE_" + Math.floor(Math.random() * 1000),
        amount: amount,
        currency: item.currency || "USD",
        department,
        status,
        dueDate: dueDate.toISOString().split('T')[0],
        costAllocation: {
          "Network Management": Math.random() * 0.2,
          "Reference Data": Math.random() * 0.15,
          "Middle Office": Math.random() * 0.2,
          "Confirmations": Math.random() * 0.1,
          "Collateral Management": Math.random() * 0.15,
          "Cost Management": Math.random() * 0.1,
          "Settlements": Math.random() * 0.05,
          "Compliance": Math.random() * 0.05
        },
        createdAt: item.created_at || new Date().toISOString(),
        updatedAt: item.updated_at || new Date().toISOString()
      }
    })
  }

  // Update payment status
  const updatePaymentStatus = (id: string, newStatus: string) => {
    setPaymentTrackerData(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, status: newStatus, updatedAt: new Date().toISOString() }
          : item
      )
    )
  }

  // Send to Settlements team
  const sendToSettlements = (id: string) => {
    updatePaymentStatus(id, "Payment Instruction Sent")
  }

  // Approve cost allocation
  const approveCostAllocation = (id: string) => {
    updatePaymentStatus(id, "Cost Allocated")
  }

  // Get filtered payment data
  const getFilteredPaymentData = () => {
    let filtered = paymentTrackerData

    if (selectedPaymentStatus !== "all") {
      filtered = filtered.filter(item => item.status === selectedPaymentStatus)
    }

    if (selectedDepartment !== "all") {
      filtered = filtered.filter(item => item.department === selectedDepartment)
    }

    return filtered
  }

  // Get payment statistics
  const getPaymentStats = () => {
    const total = paymentTrackerData.length
    const pending = paymentTrackerData.filter(item => item.status === "Pending Approval").length
    const approved = paymentTrackerData.filter(item => item.status === "Cost Allocated").length
    const sentToSettlements = paymentTrackerData.filter(item => item.status === "Payment Instruction Sent").length
    const confirmed = paymentTrackerData.filter(item => item.status === "Payment Confirmed").length
    const failed = paymentTrackerData.filter(item => item.status === "Payment Failed").length
    const totalAmount = paymentTrackerData.reduce((sum, item) => sum + item.amount, 0)
    const overdue = paymentTrackerData.filter(item => 
      new Date(item.dueDate) < new Date() && item.status !== "Payment Confirmed"
    ).length

    return {
      total,
      pending,
      approved,
      sentToSettlements,
      confirmed,
      failed,
      totalAmount,
      overdue
    }
  }

  // Render Payment Tracker Tab
  const renderPaymentTracker = () => {
    const stats = getPaymentStats()
    const filteredData = getFilteredPaymentData()

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Tracker</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Track agent invoice payments and cost allocation approvals
            </p>
          </div>
          <div className="flex space-x-2">
            {paymentTrackerData.length === 0 && (
              <Alert className="border-yellow-300 bg-yellow-100 dark:bg-yellow-900">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">No Data Available</AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  Click "Source Data from Firebase" in the Data Upload tab to populate payment tracker data.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Invoices</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">Pending Approval</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
              <div className="text-sm text-gray-600">Payment Confirmed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
              <div className="text-sm text-gray-600">Overdue Payments</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Status
                </label>
                <Select value={selectedPaymentStatus} onValueChange={setSelectedPaymentStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                    <SelectItem value="Cost Allocated">Cost Allocated</SelectItem>
                    <SelectItem value="Payment Instruction Sent">Payment Instruction Sent</SelectItem>
                    <SelectItem value="Payment Confirmed">Payment Confirmed</SelectItem>
                    <SelectItem value="Payment Failed">Payment Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Department
                </label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="Network Management">Network Management</SelectItem>
                    <SelectItem value="Reference Data">Reference Data</SelectItem>
                    <SelectItem value="Middle Office">Middle Office</SelectItem>
                    <SelectItem value="Confirmations">Confirmations</SelectItem>
                    <SelectItem value="Collateral Management">Collateral Management</SelectItem>
                    <SelectItem value="Cost Management">Cost Management</SelectItem>
                    <SelectItem value="Settlements">Settlements</SelectItem>
                    <SelectItem value="Compliance">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Tracker Table */}
        {paymentTrackerData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Tracking</CardTitle>
              <CardDescription>
                Track agent invoice payments and cost allocation status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trade ID</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.tradeId}</TableCell>
                        <TableCell>{item.agentName}</TableCell>
                        <TableCell>{item.invoiceNumber}</TableCell>
                        <TableCell>${item.amount.toFixed(2)} {item.currency}</TableCell>
                        <TableCell>{item.department}</TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              item.status === "Payment Confirmed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" :
                              item.status === "Pending Approval" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" :
                              item.status === "Cost Allocated" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" :
                              item.status === "Payment Instruction Sent" ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" :
                              "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={new Date(item.dueDate) < new Date() ? "text-red-600 font-medium" : ""}>
                            {item.dueDate}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {item.status === "Pending Approval" && (
                              <Button
                                size="sm"
                                onClick={() => approveCostAllocation(item.id)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Approve
                              </Button>
                            )}
                            {item.status === "Cost Allocated" && (
                              <Button
                                size="sm"
                                onClick={() => sendToSettlements(item.id)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Send to Settlements
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // View details modal could be added here
                                console.log("View details for:", item.id)
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Department Cost Allocation Summary */}
        {paymentTrackerData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Department Cost Allocation Summary</CardTitle>
              <CardDescription>
                Cost allocation breakdown across the 8 departments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {["Network Management", "Reference Data", "Middle Office", "Confirmations", 
                  "Collateral Management", "Cost Management", "Settlements", "Compliance"].map((dept) => {
                  const deptData = paymentTrackerData.filter(item => item.department === dept)
                  const totalAmount = deptData.reduce((sum, item) => sum + item.amount, 0)
                  const pendingCount = deptData.filter(item => item.status === "Pending Approval").length
                  
                  return (
                    <Card key={dept} className="p-4">
                      <div className="text-sm font-medium text-gray-600">{dept}</div>
                      <div className="text-lg font-bold text-gray-900">${totalAmount.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">{pendingCount} pending</div>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Render Cost Allocation Tab
  const renderCostAllocation = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cost Allocation</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Allocate costs across different agents and cost centers
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={createCostAllocationFromFirebase}
            disabled={costAllocationLoading}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {costAllocationLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Source Data from Firebase
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Data Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Cost Data Upload
          </CardTitle>
          <CardDescription>
            Upload cost data or use existing Firebase data for allocation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload Cost Data File
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleCostFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Allocation Method
              </label>
              <Select value={allocationMethod} onValueChange={(value: any) => setAllocationMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Equal Split</SelectItem>
                  <SelectItem value="proportional">Proportional</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {costDataRows.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Cost Data Preview</h3>
                <Button onClick={performCostAllocation} className="bg-blue-600 hover:bg-blue-700">
                  Perform Allocation
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent ID</TableHead>
                      <TableHead>Agent Name</TableHead>
                      <TableHead>Trade ID</TableHead>
                      <TableHead>Cost Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Currency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costDataRows.slice(0, 10).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.agentId || row.AgentID || "N/A"}</TableCell>
                        <TableCell>{row.agentName || row.AgentName || "N/A"}</TableCell>
                        <TableCell>{row.tradeId || row.TradeID || "N/A"}</TableCell>
                        <TableCell>{row.costType || row.CostType || "Commission"}</TableCell>
                        <TableCell>${(row.amount || row.Amount || 0).toFixed(2)}</TableCell>
                        <TableCell>{row.currency || row.Currency || "USD"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {costDataRows.length > 10 && (
                <p className="text-sm text-gray-500 mt-2">
                  Showing first 10 rows of {costDataRows.length} total rows
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocation Results */}
      {showCostAllocationResults && allocationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Allocation Results
            </CardTitle>
            <CardDescription>
              Cost allocation results based on {allocationMethod} method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-teal-600">
                      {allocationResults.length}
                    </div>
                    <div className="text-sm text-gray-600">Total Allocations</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {new Set(allocationResults.map(r => r.tradeId)).size}
                    </div>
                    <div className="text-sm text-gray-600">Unique Trades</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {new Set(allocationResults.map(r => r.agentId)).size}
                    </div>
                    <div className="text-sm text-gray-600">Agents Involved</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      ${allocationResults.reduce((sum, r) => sum + r.allocatedAmount, 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Total Allocated</div>
                  </CardContent>
                </Card>
              </div>

              {/* Results Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trade ID</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Original Cost</TableHead>
                      <TableHead>Allocated Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocationResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{result.tradeId}</TableCell>
                        <TableCell>{result.agentName}</TableCell>
                        <TableCell>${result.originalCost.toFixed(2)}</TableCell>
                        <TableCell>${result.allocatedAmount.toFixed(2)}</TableCell>
                        <TableCell>
                          {editingRow === index ? (
                            <Select 
                              value={result.allocationMethod} 
                              onValueChange={(value) => updateAllocationMethod(index, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Equal Split">Equal Split</SelectItem>
                                <SelectItem value="Proportional">Proportional</SelectItem>
                                <SelectItem value="Custom">Custom</SelectItem>
                                <SelectItem value="Manual">Manual</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{result.allocationMethod}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingRow === index ? (
                            <Select 
                              value={result.status} 
                              onValueChange={(value) => updateAllocationStatus(index, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Allocated">Allocated</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Rejected">Rejected</SelectItem>
                                <SelectItem value="Under Review">Under Review</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge 
                              className={
                                result.status === "Allocated" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" :
                                result.status === "Pending" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" :
                                result.status === "Approved" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" :
                                result.status === "Rejected" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" :
                                "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
                              }
                            >
                              {result.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {editingRow === index ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => saveRowChanges(index)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingRow(null)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleEditRow(index)}
                              >
                                <Settings className="h-3 w-3" />
                              </Button>
                            )}
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
      )}
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return renderDashboard()
      case "data-upload":
        return renderDataUpload()
      case "invoice-generation":
        return renderInvoiceGeneration()
      case "upload":
        return renderInvoiceUpload()
      case "reconciliation":
        return renderReconciliation()
      case "disputes":
        return renderDisputes()
      case "allocation":
        return renderCostAllocation()
      case "approval":
        return renderPlaceholderTab(
          "Approval Workflow",
          "Manage invoice approval workflows and authorization levels.",
          CheckCircle,
        )
      case "payment":
        return renderPaymentTracker()
      case "audit":
        return renderPlaceholderTab("Audit & Compliance", "Audit trails and compliance reporting features.", Shield)
      case "reports":
        return renderPlaceholderTab("Reports", "Generate comprehensive reports and analytics.", BarChart3)
      case "admin":
        return renderPlaceholderTab("Admin", "System administration and configuration settings.", Settings)
      default:
        return renderDashboard()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 border-l-2 border-white">
      <div className="flex">
        {/* Sidebar */}
        <div
          className={`${sidebarCollapsed ? "w-16" : "w-64"} bg-sidebar shadow-lg transition-all duration-300`}
        >
          <div className="p-4 border-b-2 border-white">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && <h1 className="text-xl font-bold text-sidebar-foreground">Agent Billing</h1>}
              <Button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <nav className="p-4 space-y-2">
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
                >
                  <IconComponent className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="ml-3">{item.label}</span>}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {sidebarItems.find((item) => item.id === activeTab)?.label || "Dashboard"}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {activeTab === "dashboard" && "Overview of agent billing and reconciliation metrics"}
                {activeTab === "data-upload" && "Upload and process trade data from various sources"}
                {activeTab === "invoice-generation" && "Generate invoices from uploaded trade data"}
                {activeTab === "upload" && "Upload agent invoices for processing and reconciliation"}
                {activeTab === "reconciliation" && "Reconcile invoices against trade data"}
                {activeTab === "disputes" && "Manage and resolve billing disputes"}
                {activeTab === "allocation" && "Allocate costs across cost centers"}
                {activeTab === "approval" && "Manage invoice approval workflows"}
                {activeTab === "payment" && "Track payment status and schedules"}
                {activeTab === "audit" && "Audit trails and compliance reporting"}
                {activeTab === "reports" && "Generate reports and analytics"}
                {activeTab === "admin" && "System administration and settings"}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
            </div>
          </div>

          {renderContent()}
        </div>
      </div>
    </div>
  )
}
