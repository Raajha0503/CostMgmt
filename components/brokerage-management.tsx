"use client"

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react"
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Download,
  CreditCard,
  BarChart3,
  Building2,
  TrendingUp,
  Info,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { analyzeExcelData, mapExcelToTradeData, type ExcelAnalysis } from "@/lib/excel-processor"
import type { TradeData } from "@/lib/data-processor"
import * as XLSX from "xlsx"
import { useFirebase } from "@/hooks/use-firebase";
import { tradeOperations } from "@/lib/firebase-operations";

type BrokerageManagementProps = {}

export default function BrokerageManagement({}: BrokerageManagementProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "management" | "visualisations">("upload")
  const [trades, setTrades] = useState<TradeData[]>([])
  const [rawData, setRawData] = useState<any[]>([])
  const [dataType, setDataType] = useState<"equity" | "fx">("equity")
  const [loading, setLoading] = useState(false)

  const handleDataLoaded = (data: TradeData[], rawDataInput: any[], detectedType: "equity" | "fx") => {
    console.log(`Brokerage Management received ${data.length} trades with type ${detectedType}`)
    setTrades(data)
    setRawData(rawDataInput)
    setDataType(detectedType)
    setActiveTab("management")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 border-l-2 border-white">
      {/* Salesforce-inspired Header */}
      <div className="bg-white dark:bg-gray-800 border-b-2 border-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-black rounded-xl">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Brokerage Management</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Streamline your brokerage operations with intelligent cost management
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {trades.length > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-black">{trades.length.toLocaleString()}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {dataType ? dataType.toUpperCase() : ""} Trades Loaded
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Salesforce-inspired Tab Navigation */}
          <div className="flex space-x-1 mt-8 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === "upload"
                  ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Data Upload</span>
            </button>
            <button
              onClick={() => setActiveTab("management")}
              disabled={trades.length === 0}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === "management"
                  ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                  : trades.length === 0
                    ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Management</span>
            </button>
            <button
              onClick={() => setActiveTab("visualisations")}
              disabled={trades.length === 0}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === "visualisations"
                  ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                  : trades.length === 0
                    ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === "upload" ? (
          <BrokerageDataUpload onDataLoaded={handleDataLoaded} />
        ) : activeTab === "management" ? (
          <BrokerageManagementContent trades={trades} dataType={dataType} />
        ) : (
          <BrokerageVisualisations trades={trades} dataType={dataType} />
        )}
      </div>
    </div>
  )
}

// Data Upload Component with Salesforce styling
function BrokerageDataUpload({
  onDataLoaded,
}: {
  onDataLoaded: (data: TradeData[], rawData: any[], dataType: "equity" | "fx") => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<ExcelAnalysis | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"upload" | "analyze" | "map" | "complete">("upload")
  const [rawData, setRawData] = useState<any[]>([])
  const [dataType, setDataType] = useState<"equity" | "fx">("equity")
  const [error, setError] = useState<string | null>(null)
  const [uploadingAsIs, setUploadingAsIs] = useState(false)
  const [uploadAsIsSuccess, setUploadAsIsSuccess] = useState(false)
  const [showInfoMessage, setShowInfoMessage] = useState(false)
  const { trades: firebaseTrades, loadTrades, loading: firebaseLoading, createTrade } = useFirebase();
  const dataTypeRef = useRef(dataType);
  React.useEffect(() => { dataTypeRef.current = dataType }, [dataType]);

  // Handler for sourcing data from Firebase
  const handleSourceFromFirebase = async () => {
    await loadTrades();
    const currentType = dataTypeRef.current;
    const detectedType =
      firebaseTrades.length > 0 && firebaseTrades[0].data_source
        ? (firebaseTrades[0].data_source as "equity" | "fx")
        : currentType;
    // Add fallback for data_source in case it's missing
    const tradesWithType = firebaseTrades.map(t => ({ ...t, data_source: t.data_source || detectedType }));
    setRawData(tradesWithType);
    // Generate headers from the first row
    const headers = tradesWithType.length > 0 ? Object.keys(tradesWithType[0]) : [];
    const analysisResult = { headers };
    setAnalysis(analysisResult as any);
    // Use the latest dataType selection for mapping
    const fields = currentType === "fx" ? fxFields : equityFields;
    const autoMapping = createExactMapping(fields, headers);
    setFieldMapping(autoMapping);
    setDataType(currentType);
    setStep("map");
  };

  // When processing uploaded data, also save to Firestore
  const handleProcessData = async (parsedData: TradeData[], rawData: any[], detectedType: "equity" | "fx") => {
    // Only process data locally, do not upload to Firebase
    onDataLoaded(parsedData.map(t => ({ ...t, data_source: detectedType })), rawData, detectedType);
  };

  // Add handler for uploading raw data as-is
  const handleUploadAsIs = async () => {
    if (!rawData.length) return;
    setUploadingAsIs(true);
    setUploadAsIsSuccess(false);
    try {
      for (const row of rawData) {
        await import("@/lib/firebase-operations").then(mod => mod.tradeOperations.createTrade(row));
      }
      setUploadAsIsSuccess(true);
    } catch (e) {
      setError('Error uploading raw data as-is.');
      setUploadAsIsSuccess(false);
    }
    setUploadingAsIs(false);
  };

  // Define field groups for both equity and FX trades
  const equityFields = [
    { key: "tradeId", label: "Trade ID", required: true },
    { key: "orderId", label: "Order ID", required: false },
    { key: "clientId", label: "Client ID", required: false },
    { key: "isin", label: "ISIN", required: false },
    { key: "symbol", label: "Symbol", required: false },
    { key: "tradeType", label: "Trade Type", required: false },
    { key: "quantity", label: "Quantity", required: false },
    { key: "price", label: "Price", required: false },
    { key: "tradeValue", label: "Trade Value", required: false },
    { key: "currency", label: "Currency", required: false },
    { key: "tradeDate", label: "Trade Date", required: false },
    { key: "settlementDate", label: "Settlement Date", required: false },
    { key: "settlementStatus", label: "Settlement Status", required: false },
    { key: "counterparty", label: "Counterparty", required: false },
    { key: "tradingVenue", label: "Trading Venue", required: false },
    { key: "traderName", label: "Trader Name", required: false },
    { key: "kycStatus", label: "KYC Status", required: false },
    { key: "referenceDataValidated", label: "Reference Data Validated", required: false },
    { key: "commission", label: "Commission", required: false },
    { key: "taxes", label: "Taxes", required: false },
    { key: "totalCost", label: "Total Cost", required: false },
    { key: "confirmationStatus", label: "Confirmation Status", required: false },
    { key: "countryOfTrade", label: "Country of Trade", required: false },
    { key: "opsTeamNotes", label: "Ops Team Notes", required: false },
    { key: "pricingSource", label: "Pricing Source", required: false },
    { key: "marketImpactCost", label: "Market Impact Cost", required: false },
    { key: "fxRateApplied", label: "FX Rate Applied", required: false },
    { key: "netAmount", label: "Net Amount", required: false },
    { key: "collateralRequired", label: "Collateral Required", required: false },
    { key: "marginType", label: "Margin Type", required: false },
    { key: "marginStatus", label: "Margin Status", required: false },
  ]

  const fxFields = [
    // Trade Identification & Basic Info
    { key: "tradeId", label: "TradeID", required: true },
    { key: "tradeDate", label: "TradeDate", required: false },
    { key: "valueDate", label: "ValueDate", required: false },
    { key: "tradeTime", label: "TradeTime", required: false },
    { key: "traderId", label: "TraderID", required: false },
    { key: "counterparty", label: "Counterparty", required: false },
    { key: "portfolio", label: "Portfolio", required: false },

    // Currency & Trade Details
    { key: "currencyPair", label: "CurrencyPair", required: false },
    { key: "buySell", label: "BuySell", required: false },
    { key: "dealtCurrency", label: "DealtCurrency", required: false },
    { key: "baseCurrency", label: "BaseCurrency", required: false },
    { key: "termCurrency", label: "TermCurrency", required: false },
    { key: "notionalAmount", label: "NotionalAmount", required: false },
    { key: "fxRate", label: "FXRate", required: false },
    { key: "productType", label: "ProductType", required: false },

    // Trade Status & Processing
    { key: "tradeStatus", label: "TradeStatus", required: false },
    { key: "settlementStatus", label: "SettlementStatus", required: false },
    { key: "settlementMethod", label: "SettlementMethod", required: false },
    { key: "tradeVersion", label: "TradeVersion", required: false },
    { key: "cancellationFlag", label: "CancellationFlag", required: false },
    { key: "amendmentFlag", label: "AmendmentFlag", required: false },
    { key: "confirmationStatus", label: "ConfirmationStatus", required: false },
    { key: "confirmationMethod", label: "ConfirmationMethod", required: false },
    { key: "confirmationTimestamp", label: "ConfirmationTimestamp", required: false },
    { key: "settlementDate", label: "SettlementDate", required: false },

    // Execution & Venue
    { key: "broker", label: "Broker", required: false },
    { key: "executionVenue", label: "ExecutionVenue", required: false },
    { key: "bookingLocation", label: "BookingLocation", required: false },
    { key: "maturityDate", label: "MaturityDate", required: false },

    // Risk & Compliance
    { key: "riskSystemId", label: "RiskSystemID", required: false },
    { key: "regulatoryReportingStatus", label: "RegulatoryReportingStatus", required: false },
    { key: "tradeComplianceStatus", label: "TradeComplianceStatus", required: false },
    { key: "kycCheck", label: "KYCCheck", required: false },
    { key: "sanctionsScreening", label: "SanctionsScreening", required: false },
    { key: "nettingEligibility", label: "NettingEligibility", required: false },
    { key: "exceptionFlag", label: "ExceptionFlag", required: false },
    { key: "exceptionNotes", label: "ExceptionNotes", required: false },
    { key: "auditTrailRef", label: "AuditTrailRef", required: false },

    // Operations & Settlement
    { key: "tradeSourceSystem", label: "TradeSourceSystem", required: false },
    { key: "settlementInstructions", label: "SettlementInstructions", required: false },
    { key: "custodian", label: "Custodian", required: false },
    { key: "costBookedDate", label: "CostBookedDate", required: false },

    // Fees & Costs
    { key: "commissionAmount", label: "CommissionAmount", required: false },
    { key: "commissionCurrency", label: "CommissionCurrency", required: false },
    { key: "brokerageFee", label: "BrokerageFee", required: false },
    { key: "brokerageCurrency", label: "BrokerageCurrency", required: false },
    { key: "custodyFee", label: "CustodyFee", required: false },
    { key: "custodyCurrency", label: "CustodyCurrency", required: false },
    { key: "settlementCost", label: "SettlementCost", required: false },
    { key: "settlementCurrency", label: "SettlementCurrency", required: false },
    { key: "fxGainLoss", label: "FXGainLoss", required: false },
    { key: "pnlCalculated", label: "PnlCalculated", required: false },
    { key: "costAllocationStatus", label: "CostAllocationStatus", required: false },
    { key: "costCenter", label: "CostCenter", required: false },
    { key: "expenseApprovalStatus", label: "ExpenseApprovalStatus", required: false },
  ]

  const tradeFields = dataType === "equity" ? equityFields : fxFields

  const handleFileUpload = useCallback(
    async (uploadedFile: File) => {
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

            const workbook = XLSX.read(new Uint8Array(arrayBuffer as ArrayBuffer), { type: "array" })
            const firstSheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[firstSheetName]
            const data = XLSX.utils.sheet_to_json(worksheet)

            const isFXData = detectFXData(data)
            setDataType(isFXData ? "fx" : "equity")

            const analysisResult = analyzeExcelData(data)
            setFile(uploadedFile)
            setRawData(data)
            setAnalysis(analysisResult)

            const fields = isFXData ? fxFields : equityFields
            const autoMapping = createExactMapping(fields, analysisResult.headers)
            setFieldMapping(autoMapping)

            setStep("map")
          } catch (error) {
            console.error("Error processing Excel data:", error)
            setError(`Error processing Excel file: ${error.message}`)
          } finally {
            setLoading(false)
          }
        }

        reader.readAsArrayBuffer(uploadedFile)
      } catch (error) {
        console.error("Error handling file upload:", error)
        setError(`Error uploading file: ${error.message}`)
        setLoading(false)
      }
    },
    [fxFields, equityFields],
  )

  const detectFXData = (data: any[]): boolean => {
    if (!data || data.length === 0) return false
    const firstRow = data[0]
    const headers = Object.keys(firstRow).map((h) => h.toLowerCase())
    const fxIndicators = ["tradeid", "currencypair", "buysell", "notionalamount", "fxrate"]
    return fxIndicators.some((indicator) => headers.some((header) => header === indicator))
  }

  const createExactMapping = (fields: { key: string; label: string; required: boolean }[], headers: string[]) => {
    const mapping: Record<string, string> = {}
    fields.forEach((field) => {
      if (headers.includes(field.label)) {
        mapping[field.key] = field.label
      }
    })
    return mapping
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0]
        if (
          droppedFile.name.endsWith(".xlsx") ||
          droppedFile.name.endsWith(".xls") ||
          droppedFile.name.endsWith(".csv")
        ) {
          handleFileUpload(droppedFile)
        } else {
          setError("Please upload an Excel or CSV file (.xlsx, .xls, .csv)")
        }
      }
    },
    [handleFileUpload],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        handleFileUpload(selectedFile)
      }
    },
    [handleFileUpload],
  )

  const processData = () => {
    if (!rawData.length || Object.keys(fieldMapping).length === 0) {
      setError("No data to process or field mapping missing")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const mappedData = mapExcelToTradeData(rawData, fieldMapping)
      const dataWithSource = mappedData.map((trade) => ({
        ...trade,
        dataSource: dataType,
      }))

      handleProcessData(dataWithSource, rawData, dataType)
      setStep("complete")
    } catch (error) {
      console.error("Error processing data:", error)
      setError(`Error processing data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    if (dataType === "equity") {
      const templateData = [
        {
          "Trade ID": "TID001",
          "Order ID": "OID001",
          "Client ID": "CLIENT001",
          Symbol: "AAPL",
          "Trade Type": "Buy",
          Quantity: 100,
          Price: 150.5,
          "Trade Value": 15050,
          Currency: "USD",
          "Trade Date": "2024-01-15",
          "Settlement Date": "2024-01-17",
          Counterparty: "Goldman Sachs",
          "Trading Venue": "NASDAQ",
          Commission: 15.05,
          "Brokerage Fee": 25.0,
        },
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Equity Brokerage Template")
      XLSX.writeFile(wb, "equity_brokerage_template.xlsx")
    } else {
      const templateData = [
        {
          TradeID: "FX001",
          TradeDate: "2024-01-15",
          ValueDate: "2024-01-17",
          TradeTime: "09:30:00",
          TraderID: "TDR001",
          Counterparty: "JPMorgan",
          Portfolio: "PORT1",
          CurrencyPair: "EUR/USD",
          BuySell: "Buy",
          DealtCurrency: "EUR",
          BaseCurrency: "EUR",
          TermCurrency: "USD",
          NotionalAmount: 1000000,
          FXRate: 1.0875,
          ProductType: "Spot",
          TradeStatus: "Confirmed",
          SettlementStatus: "Pending",
          SettlementMethod: "CLS",
          Broker: "Prime Broker",
          ExecutionVenue: "360T",
          CommissionAmount: 100,
          BrokerageFee: 150,
        },
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "FX Brokerage Template")
      XLSX.writeFile(wb, "fx_brokerage_template.xlsx")
    }
  }

  if (step === "upload") {
    return (
      <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Upload or Source Brokerage Data</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowInfoMessage(!showInfoMessage)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Information"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={handleSourceFromFirebase}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              disabled={firebaseLoading}
            >
              {firebaseLoading ? "Loading..." : "Next"}
            </button>
          </div>
        </div>
        
        {/* Info Message */}
        {showInfoMessage && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
              <div>
                <p className="text-blue-800 dark:text-blue-200 font-medium">Data Loading Information</p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  Equity trades are not loaded, FX trades are available. Please click on "FX Trades" first, then click the "Next" button to load data.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-xl p-6 mb-8">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
                <p className="text-red-800 dark:text-red-200 font-medium">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-12">
            {/* Upload Area */}
            <div className="space-y-8">
              <div className="flex justify-center">
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                  <button
                    onClick={() => setDataType("equity")}
                    className={`px-6 py-3 rounded-lg flex items-center space-x-3 font-medium transition-all duration-200 ${
                      dataType === "equity"
                        ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <BarChart3 className="h-5 w-5" />
                    <span>Equity Trades</span>
                  </button>
                  <button
                    onClick={() => setDataType("fx")}
                    className={`px-6 py-3 rounded-lg flex items-center space-x-3 font-medium transition-all duration-200 ${
                      dataType === "fx"
                        ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <CreditCard className="h-5 w-5" />
                    <span>FX Trades</span>
                  </button>
                </div>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="card-bw p-12 text-center hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer"
              >
                <div className="p-4 bg-gray-100 dark:bg-black rounded-full w-fit mx-auto mb-6">
                  <FileSpreadsheet size={48} className="text-black dark:text-black" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Drop files here</h3>
                <div className="flex justify-center">
                  <label className="btn-primary cursor-pointer inline-flex items-center space-x-2">
                    <Upload size={20} />
                    <span>Browse Files</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={loading}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={downloadTemplate}
                  className="text-black dark:text-black hover:text-black dark:hover:text-black flex items-center space-x-2 font-medium"
                >
                  <Download size={16} />
                  <span>Download Template</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === "map") {
    const mappingFields = dataType === 'fx' ? fxFields : equityFields;
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Field Mapping</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {dataType.toUpperCase()} TRADES - {mappingFields.length} fields
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-xl p-6 mb-8">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
                <p className="text-red-800 dark:text-red-200 font-medium">{error}</p>
              </div>
            </div>
          )}

          <div className="card-bw p-8 mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Field Mapping</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {Object.keys(fieldMapping).length} of {mappingFields.length} fields mapped
                </p>
              </div>
              <div className="flex gap-2">
              <button onClick={() => setStep("upload")} className="btn-secondary">
                Back to Upload
              </button>
                <button
                  onClick={() => {
                    const headers = analysis?.headers || [];
                    const autoMapping = createExactMapping(mappingFields, headers);
                    setFieldMapping(autoMapping);
                  }}
                  className="btn-primary"
                >
                  Auto-map Fields
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-96 rounded-lg border border-gray-200 dark:border-gray-600">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Brokerage Field
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Excel Column
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Required
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {mappingFields.map((field) => (
                    <tr key={field.key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{field.label}</td>
                      <td className="px-6 py-4">
                        <select
                          value={fieldMapping[field.key] || ""}
                          onChange={(e) => setFieldMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-black focus:border-black"
                        >
                          <option value="">-- Select Column --</option>
                          {analysis?.headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {field.required ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Required
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            Optional
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={handleUploadAsIs}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              disabled={uploadingAsIs || !rawData.length}
            >
              {uploadingAsIs ? "Uploading..." : "Upload"}
            </button>
            {uploadAsIsSuccess && <span className="text-green-600 text-sm ml-2">Upload successful!</span>}
            <button
              onClick={processData}
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing Data..." : "Process Data"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === "complete") {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full w-fit mx-auto mb-8">
            <CheckCircle size={64} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Processing Complete</h2>
          <div className="card-bw p-8 mb-8">
            <div className="text-4xl font-bold text-black mb-2">{rawData.length.toLocaleString()}</div>
            <div className="text-gray-600 dark:text-gray-400">Records processed</div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// Enhanced Brokerage Management Content Component with Salesforce styling
function BrokerageManagementContent({
  trades,
  dataType,
}: {
  trades: TradeData[]
  dataType: "equity" | "fx"
}) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [tableData, setTableData] = useState<any[]>([])
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const [editValue, setEditValue] = useState<string>("")
  const [savingCell, setSavingCell] = useState<{ row: number; col: string } | null>(null)
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>("")

  // Add pagination state after the existing state variables:
  const [currentPage, setCurrentPage] = useState<string>("1-50")
  const [pageOptions] = useState([
    { value: "1-50", label: "1-50", start: 0, end: 50 },
    { value: "51-100", label: "51-100", start: 50, end: 100 },
    { value: "101-150", label: "101-150", start: 100, end: 150 },
    { value: "151-200", label: "151-200", start: 150, end: 200 },
  ])

  // Extract available columns from the raw data
  useEffect(() => {
    if (trades.length > 0) {
      // Get all possible columns from the first trade record
      const firstTrade = trades[0] as any
      const columns = Object.keys(firstTrade).filter(
        (key) => key !== "dataSource" && firstTrade[key] !== undefined && firstTrade[key] !== null,
      )
      setAvailableColumns(columns)

      // Set default selection (first 9 columns)
      const defaultColumns = columns.slice(0, 9)
      setSelectedColumns(defaultColumns)
    }
  }, [trades])

  // Update table data when columns change
  useEffect(() => {
    if (trades.length > 0 && selectedColumns.length > 0) {
      const data = trades.map((trade) => {
        const row: any = {}
        selectedColumns.forEach((col) => {
          row[col] = (trade as any)[col] || ""
        })
        row.id = (trade as any).id // Attach id for update
        return row
      })
      setTableData(data)
    }
  }, [trades, selectedColumns])

  // Handle cell edit
  const handleCellEdit = (rowIdx: number, col: string, value: string) => {
    setSavingCell({ row: rowIdx, col })
    const row = tableData[rowIdx]
    const id = row.id
    if (!id) return
    // Update local state optimistically
    setTableData(prev => prev.map((r, i) => i === rowIdx ? { ...r, [col]: value } : r))
    tradeOperations.updateTrade(id, { [col]: value })
      .catch(() => {
        // Optionally handle error, revert value if needed
      })
      .finally(() => {
        setSavingCell(null)
      })
  }

  const handleColumnChange = (column: string, isSelected: boolean) => {
    if (isSelected && selectedColumns.length < 9) {
      setSelectedColumns([...selectedColumns, column])
    } else if (!isSelected) {
      setSelectedColumns(selectedColumns.filter((col) => col !== column))
    }
  }

  const clearAllColumns = () => {
    setSelectedColumns([])
  }

  const selectDefaultColumns = () => {
    const defaultColumns = availableColumns.slice(0, 9)
    setSelectedColumns(defaultColumns)
  }

  // Filter columns based on search query
  const filteredColumns = availableColumns.filter(column =>
    column.toLowerCase().includes(columnSearchQuery.toLowerCase())
  )

  if (trades.length === 0) {
    return (
      <div className="p-8">
        <div className="card-bw p-12 text-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-6">
            <Building2 className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">No Data</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Column Selection */}
      <div className="card-bw p-8">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Column Selection</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Select up to 9 columns to display ({selectedColumns.length}/9 selected) - {dataType.toUpperCase()} Dataset:{" "}
          {availableColumns.length} columns available
        </p>

        {/* Control Buttons and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex space-x-4">
            <button onClick={clearAllColumns} className="btn-secondary">
              Clear All
            </button>
            <button onClick={selectDefaultColumns} className="btn-primary">
              Select Default (First 9)
            </button>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search columns..."
                value={columnSearchQuery}
                onChange={(e) => setColumnSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-black focus:border-black placeholder-gray-500 dark:placeholder-gray-400"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {columnSearchQuery && (
                <button
                  onClick={() => setColumnSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {columnSearchQuery && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Showing {filteredColumns.length} of {availableColumns.length} columns
              </p>
            )}
          </div>
        </div>

        {/* Column Selection Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredColumns.map((column) => {
            const isSelected = selectedColumns.includes(column)
            const canSelect = selectedColumns.length < 9 || isSelected

            return (
              <label
                key={column}
                className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700"
                    : canSelect
                      ? "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                      : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => handleColumnChange(column, e.target.checked)}
                  disabled={!canSelect}
                  className="rounded border-gray-300 text-black focus:ring-black"
                />
                <span
                  className={`text-sm font-medium ${
                    isSelected ? "text-black dark:text-gray-200" : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {column}
                </span>
              </label>
            )
          })}
        </div>

        {/* No results message */}
        {columnSearchQuery && filteredColumns.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No columns found matching "{columnSearchQuery}"
            </p>
          </div>
        )}
      </div>

      {/* Data Table */}
      {selectedColumns.length > 0 && (
        <div className="card-bw overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Data Table</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {tableData.length.toLocaleString()} records with {selectedColumns.length} selected columns
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show rows:</label>
                <select
                  value={currentPage}
                  onChange={(e) => setCurrentPage(e.target.value)}
                  className="text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-black focus:border-black"
                >
                  {pageOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={tableData.length <= option.start}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {selectedColumns.map((column) => (
                    <th
                      key={column}
                      className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600 last:border-r-0"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(() => {
                  const currentOption = pageOptions.find((option) => option.value === currentPage)
                  const startIndex = currentOption?.start || 0
                  const endIndex = currentOption?.end || 50
                  const paginatedData = tableData.slice(startIndex, endIndex)
                  return paginatedData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      {selectedColumns.map((column) => {
                        const isEditing = editingCell && editingCell.row === startIndex + index && editingCell.col === column
                        const isSaving = savingCell && savingCell.row === startIndex + index && savingCell.col === column
                        return (
                        <td
                          key={column}
                          className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600 last:border-r-0"
                            onClick={() => {
                              if (!isEditing && !isSaving) {
                                setEditingCell({ row: startIndex + index, col: column })
                                setEditValue(row[column] ?? "")
                              }
                            }}
                          >
                            {isEditing ? (
                              <input
                                className="w-full bg-white dark:bg-gray-800 border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={editValue}
                                autoFocus
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => {
                                  setEditingCell(null)
                                  if (editValue !== row[column]) {
                                    handleCellEdit(startIndex + index, column, editValue)
                                  }
                                }}
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    setEditingCell(null)
                                    if (editValue !== row[column]) {
                                      handleCellEdit(startIndex + index, column, editValue)
                                    }
                                  } else if (e.key === "Escape") {
                                    setEditingCell(null)
                                  }
                                }}
                              />
                            ) : isSaving ? (
                              <span className="text-blue-500 text-xs">Saving...</span>
                            ) : (
                              row[column] || "-"
                            )}
                        </td>
                        )
                      })}
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>

          {tableData.length > 50 && (
            <div className="px-8 py-4 bg-gray-50 dark:bg-gray-700 text-center border-t border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing rows {(() => {
                  const currentOption = pageOptions.find((option) => option.value === currentPage)
                  const startIndex = (currentOption?.start || 0) + 1
                  const endIndex = Math.min(currentOption?.end || 50, tableData.length)
                  return `${startIndex}-${endIndex}`
                })()} of {tableData.length.toLocaleString()} total records
              </p>
            </div>
          )}
        </div>
      )}

      {selectedColumns.length === 0 && (
        <div className="card-bw p-12 text-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-6">
            <BarChart3 className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Select Columns</h3>
        </div>
      )}
    </div>
  )
}

// Brokerage Visualisations Component with KPI/KRI toggles
function BrokerageVisualisations({
  trades,
  dataType,
}: {
  trades: TradeData[]
  dataType: "equity" | "fx"
}) {
  const [activeView, setActiveView] = useState<"kpis" | "kris">("kpis")
  const [selectedBroker, setSelectedBroker] = useState<string>("")
  const [brokerTradesPage, setBrokerTradesPage] = useState(0)
  const tradesPerPage = 10

  useEffect(() => {
    setBrokerTradesPage(0)
  }, [selectedBroker])

  if (trades.length === 0) {
    return (
      <div className="p-8">
        <div className="card-bw p-12 text-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-6">
            <TrendingUp className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">No Analytics</h3>
        </div>
      </div>
    )
  }

  // Calculate KPI metrics
  const totalBrokerageFees = trades.reduce((sum, trade) => {
    const fee = trade.brokerageFee
    return sum + (typeof fee === "number" ? fee : Number.parseFloat(fee as string) || 0)
  }, 0)

  const avgBrokerageFeePerTrade = totalBrokerageFees / trades.length

  const totalCommissionPaid = trades.reduce((sum, trade) => {
    const commission = dataType === "equity" ? trade.commission : trade.commissionAmount
    return sum + (typeof commission === "number" ? commission : Number.parseFloat(commission as string) || 0)
  }, 0)

  const totalNotionalAmount = trades.reduce((sum, trade) => {
    const notional = dataType === "equity" ? trade.tradeValue : trade.notionalAmount
    return sum + (typeof notional === "number" ? notional : Number.parseFloat(notional as string) || 0)
  }, 0)

  const brokerageCostPercentage = totalNotionalAmount > 0 ? (totalBrokerageFees / totalNotionalAmount) * 100 : 0

  // Get unique brokers
  const brokers = [...new Set(trades.map((trade) => trade.counterparty || trade.broker || "Unknown").filter(Boolean))]

  // Calculate trades per broker
  const tradesPerBroker = trades.reduce(
    (acc, trade) => {
      const broker = trade.counterparty || trade.broker || "Unknown"
      if (!acc[broker]) {
        acc[broker] = []
      }
      acc[broker].push(trade)
      return acc
    },
    {} as Record<string, any[]>,
  )

  // Calculate settlement costs by broker
  const settlementCostsByBroker = trades.reduce(
    (acc, trade) => {
      const broker = trade.counterparty || trade.broker || "Unknown"
      const settlementCost =
        typeof trade.settlementCost === "number"
          ? trade.settlementCost
          : Number.parseFloat(trade.settlementCost as string) || 0

      if (!acc[broker]) {
        acc[broker] = 0
      }
      acc[broker] += settlementCost
      return acc
    },
    {} as Record<string, number>,
  )

  const selectedBrokerTrades = selectedBroker ? tradesPerBroker[selectedBroker] || [] : []

  return (
    <div className="p-8 space-y-8">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Analytics Dashboard</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            {dataType.toUpperCase()} brokerage analytics - {trades.length.toLocaleString()} trades
          </p>
        </div>

        {/* KPI/KRI Toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
          <button
            onClick={() => setActiveView("kpis")}
            className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeView === "kpis"
                ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            KPIs
          </button>
          <button
            onClick={() => setActiveView("kris")}
            className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeView === "kris"
                ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            KRIs
          </button>
        </div>
      </div>

      {activeView === "kpis" ? (
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Brokerage Fees */}
            <div className="card-bw p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Brokerage Fees</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-600 mb-3" />
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                $
                {totalBrokerageFees.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            {/* Average Brokerage Fee per Trade */}
            <div className="card-bw p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Avg Brokerage Fee per Trade</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-600 mb-3" />
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                $
                {avgBrokerageFeePerTrade.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            {/* Total Commission Paid */}
            <div className="card-bw p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Commission Paid</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-600 mb-3" />
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                $
                {totalCommissionPaid.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            {/* Brokerage Cost as % of Trade Notional */}
            <div className="card-bw p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Brokerage Cost % of Notional</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-600 mb-3" />
              <p className="text-lg font-bold text-gray-900 dark:text-white">{brokerageCostPercentage.toFixed(3)}%</p>
            </div>
          </div>

          {/* Number of Trades per Broker Table */}
          <div className="card-bw p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Number of Trades per Broker</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Trade distribution across brokers with detailed breakdown
                </p>
              </div>
              {selectedBroker && (
                <button onClick={() => setSelectedBroker("")} className="btn-secondary flex items-center space-x-2">
                  <span>← Back to All Brokers</span>
                </button>
              )}
            </div>

            {!selectedBroker ? (
              // Overview table: All brokers
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Broker
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Number of Trades
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Total Value
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Total Brokerage Fees
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {Object.entries(tradesPerBroker)
                      .sort(([, a], [, b]) => b.length - a.length)
                      .slice(0, 10)
                      .map(([broker, brokerTrades]) => {
                        const totalValue = brokerTrades.reduce((sum, trade) => {
                          const value =
                            dataType === "equity"
                              ? typeof trade.tradeValue === "number"
                                ? trade.tradeValue
                                : Number.parseFloat(trade.tradeValue as string) || 0
                              : typeof trade.notionalAmount === "number"
                                ? trade.notionalAmount
                                : Number.parseFloat(trade.notionalAmount as string) || 0
                          return sum + value
                        }, 0)

                        const totalFees = brokerTrades.reduce((sum, trade) => {
                          const fee =
                            typeof trade.brokerageFee === "number"
                              ? trade.brokerageFee
                              : Number.parseFloat(trade.brokerageFee as string) || 0
                          return sum + fee
                        }, 0)

                        return (
                          <tr key={broker} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{broker}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                              {brokerTrades.length.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                              $
                              {totalValue.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                              $
                              {totalFees.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <button
                                onClick={() => setSelectedBroker(broker)}
                                className="text-black dark:text-black hover:text-black dark:hover:text-black font-medium"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              // Drill-down table: Individual trades for selected broker
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 dark:bg-black rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-black dark:text-gray-100">Trades for {selectedBroker}</h4>
                      <p className="text-sm text-black dark:text-gray-200">
                        Showing {Math.min((brokerTradesPage + 1) * tradesPerPage, selectedBrokerTrades.length)} of{" "}
                        {selectedBrokerTrades.length} trades
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-black dark:text-gray-100">
                        {selectedBrokerTrades.length} total trades
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Trade ID
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {dataType === "equity" ? "Trade Value" : "Notional Amount"}
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Brokerage Fee
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Trade Date
                        </th>
                        {dataType === "equity" && (
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Symbol
                          </th>
                        )}
                        {dataType === "fx" && (
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Currency Pair
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedBrokerTrades
                        .slice(brokerTradesPage * tradesPerPage, (brokerTradesPage + 1) * tradesPerPage)
                        .map((trade, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {trade.tradeId || `Trade ${brokerTradesPage * tradesPerPage + index + 1}`}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                              ${(() => {
                                const value =
                                  dataType === "equity"
                                    ? typeof trade.tradeValue === "number"
                                      ? trade.tradeValue
                                      : Number.parseFloat(trade.tradeValue as string) || 0
                                    : typeof trade.notionalAmount === "number"
                                      ? trade.notionalAmount
                                      : Number.parseFloat(trade.notionalAmount as string) || 0
                                return value.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              })()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                              ${(() => {
                                const fee =
                                  typeof trade.brokerageFee === "number"
                                    ? trade.brokerageFee
                                    : Number.parseFloat(trade.brokerageFee as string) || 0
                                return fee.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              })()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                              {trade.tradeDate || "-"}
                            </td>
                            {dataType === "equity" && (
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                                {trade.symbol || "-"}
                              </td>
                            )}
                            {dataType === "fx" && (
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                                {trade.currencyPair || "-"}
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination for broker trades */}
                {selectedBrokerTrades.length > tradesPerPage && (
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setBrokerTradesPage(Math.max(0, brokerTradesPage - 1))}
                      disabled={brokerTradesPage === 0}
                      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Page {brokerTradesPage + 1} of {Math.ceil(selectedBrokerTrades.length / tradesPerPage)}
                    </span>
                    <button
                      onClick={() =>
                        setBrokerTradesPage(
                          Math.min(Math.ceil(selectedBrokerTrades.length / tradesPerPage) - 1, brokerTradesPage + 1),
                        )
                      }
                      disabled={brokerTradesPage >= Math.ceil(selectedBrokerTrades.length / tradesPerPage) - 1}
                      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Brokerage Settlement Cost by Broker */}
          <div className="card-bw p-8">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
              Brokerage Settlement Cost by Broker
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Broker
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Number of Trades
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Total Settlement Cost
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Avg Settlement Cost per Trade
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {Object.entries(settlementCostsByBroker)
                    .sort(([, a], [, b]) => b - a)
                    .map(([broker, totalCost]) => {
                      const tradeCount = tradesPerBroker[broker]?.length || 0
                      const avgCost = tradeCount > 0 ? totalCost / tradeCount : 0

                      return (
                        <tr key={broker} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{broker}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                            {tradeCount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                            $
                            {totalCost.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                            ${avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* KRI Placeholder */}
                  <div className="space-y-8">
          {/* KRI: Counterparty Trade Concentration */}
          <div className="card-bw p-6 relative flex flex-col gap-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">1. KRI: Counterparty Trade Concentration</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg min-h-16">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Total Counterparties</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {new Set(trades.map(t => t.counterparty || 'Unknown')).size}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg min-h-16">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Total Trades</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">{trades.length}</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg min-h-16">
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-1">Top 3 Concentration</p>
                <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
                  {(() => {
                    const counterpartyCounts = trades.reduce((acc: { [key: string]: number }, trade) => {
                      const cp = trade.counterparty || 'Unknown'
                      acc[cp] = (acc[cp] || 0) + 1
                      return acc
                    }, {})
                    const top3 = Object.values(counterpartyCounts).sort((a, b) => b - a).slice(0, 3).reduce((sum, count) => sum + count, 0)
                    return trades.length > 0 ? `${((top3 / trades.length) * 100).toFixed(1)}%` : '0%'
                  })()}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <strong>Insight:</strong> Detects over-reliance on a few counterparties, increasing concentration risk.
            </p>
            <div className="w-full min-h-[20rem]">
              <CounterpartyConcentrationChart trades={trades} />
            </div>
            <p className="text-xs text-gray-500 mt-6 italic">
              Cursor Hint: group by counterparty, count tradeId
            </p>
          </div>

          {/* KRI: Aged Trades (T+ Failures or Delays) */}
          <div className="card-bw p-6 relative flex flex-col gap-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">3. KRI: Aged Trades (T+ Failures or Delays)</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg min-h-16">
                <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mb-1">Pending Trades</p>
                <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                  {trades.filter(t => (t.tradeStatus || t.status || '').toLowerCase().includes('pending')).length}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg min-h-16">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Failed Trades</p>
                <p className="text-lg font-bold text-red-700 dark:text-red-300">
                  {trades.filter(t => (t.tradeStatus || t.status || '').toLowerCase().includes('failed')).length}
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg min-h-16">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">Settlement Rate</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {(() => {
                    const settled = trades.filter(t => (t.tradeStatus || t.status || '').toLowerCase().includes('settled')).length
                    return trades.length > 0 ? `${((settled / trades.length) * 100).toFixed(1)}%` : '0%'
                  })()}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <strong>Insight:</strong> Shows settlement delays or processing risk.
            </p>
            <div className="w-full min-h-[20rem]">
              <AgedTradesChart trades={trades} />
            </div>
            <p className="text-xs text-gray-500 mt-6 italic">
              Cursor Hint: group by tradeDate and tradeStatus
            </p>
          </div>

          {/* KRI: Client Trade Concentration */}
          <div className="card-bw p-6 relative flex flex-col gap-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">4. KRI: Client Trade Concentration</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg min-h-16">
                <p className="text-xs text-cyan-600 dark:text-cyan-400 font-medium mb-1">Total Clients</p>
                <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">
                  {new Set(trades.map(t => t.clientId || t.accountId || t.client || 'Unknown')).size}
                </p>
              </div>
              <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg min-h-16">
                <p className="text-xs text-pink-600 dark:text-pink-400 font-medium mb-1">Total Volume</p>
                <p className="text-lg font-bold text-pink-700 dark:text-pink-300">
                  ${(() => {
                    const totalVolume = trades.reduce((sum, t) => {
                      const volume = parseFloat(t.notionalAmount || t.tradeAmount || '0') || 0
                      return sum + volume
                    }, 0)
                    return (totalVolume / 1000000).toFixed(1)
                  })()}M
                </p>
              </div>
              <div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-lg min-h-16">
                <p className="text-xs text-violet-600 dark:text-violet-400 font-medium mb-1">Top Client Share</p>
                <p className="text-lg font-bold text-violet-700 dark:text-violet-300">
                  {(() => {
                    const clientVolumes = trades.reduce((acc: { [key: string]: number }, trade) => {
                      const client = trade.clientId || trade.accountId || trade.client || 'Unknown'
                      const volume = parseFloat(trade.notionalAmount || trade.tradeAmount || '0') || 0
                      acc[client] = (acc[client] || 0) + volume
                      return acc
                    }, {})
                    const totalVolume = Object.values(clientVolumes).reduce((sum, vol) => sum + vol, 0)
                    const maxVolume = Math.max(...Object.values(clientVolumes), 0)
                    return totalVolume > 0 ? `${((maxVolume / totalVolume) * 100).toFixed(1)}%` : '0%'
                  })()}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <strong>Insight:</strong> Identifies operational dependency on a few high-volume clients.
            </p>
            <div className="w-full min-h-[20rem]">
              <ClientConcentrationChart trades={trades} />
            </div>
            <p className="text-xs text-gray-500 mt-6 italic">
              Cursor Hint: group by client/account, sum volume or count tradeId
            </p>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}

// KRI Chart Components
function CounterpartyConcentrationChart({ trades }: { trades: TradeData[] }) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  const data = useMemo(() => {
    const counterpartyCount: { [key: string]: number } = {}
    trades.forEach(trade => {
      const counterparty = trade.counterparty || 'Unknown'
      counterpartyCount[counterparty] = (counterpartyCount[counterparty] || 0) + 1
    })
    
    return Object.entries(counterpartyCount)
      .map(([counterparty, count]) => ({ counterparty, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 counterparties
  }, [trades])

  if (viewMode === 'table') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Counterparty Trade Concentration - Data Table</h4>
          <button 
            onClick={() => setViewMode('chart')}
            className="btn-primary"
          >
            📊 View Chart
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left font-semibold">Rank</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Counterparty</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Trade Count</th>
                <th className="px-4 py-2 border-b text-left font-semibold">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const percentage = ((item.count / trades.length) * 100).toFixed(1)
                return (
                  <tr key={item.counterparty} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b">{index + 1}</td>
                    <td className="px-4 py-2 border-b font-medium">{item.counterparty}</td>
                    <td className="px-4 py-2 border-b">{item.count}</td>
                    <td className="px-4 py-2 border-b">{percentage}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Counterparty Trade Concentration - Chart View</h4>
        <button 
          onClick={() => setViewMode('table')}
          className="btn-secondary"
        >
          📋 Back to Table
        </button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart layout="horizontal" data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="counterparty" type="category" width={100} />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#ef4444" name="Trade Count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function AgedTradesChart({ trades }: { trades: TradeData[] }) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  const data = useMemo(() => {
    const dateStatusCount: { [key: string]: { Pending: number, Settled: number, Failed: number } } = {}
    
    trades.forEach(trade => {
      try {
        const tradeDate = trade.tradeDate || trade.timestamp || new Date().toISOString()
        const dateObj = new Date(tradeDate)
        if (!isNaN(dateObj.getTime())) {
          const date = dateObj.toISOString().split('T')[0]
          const status = trade.tradeStatus || trade.status || 'Pending'
          
          if (!dateStatusCount[date]) {
            dateStatusCount[date] = { Pending: 0, Settled: 0, Failed: 0 }
          }
          
          if (status.toLowerCase().includes('settled')) {
            dateStatusCount[date].Settled++
          } else if (status.toLowerCase().includes('failed')) {
            dateStatusCount[date].Failed++
          } else {
            dateStatusCount[date].Pending++
          }
        }
      } catch (error) {
        // Skip invalid dates
      }
    })
    
    return Object.entries(dateStatusCount)
      .map(([date, statuses]) => ({ date, ...statuses }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // Last 30 days
  }, [trades])

  if (viewMode === 'table') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Aged Trades (T+ Failures/Delays) - Data Table</h4>
          <button 
            onClick={() => setViewMode('chart')}
            className="btn-primary"
          >
            📊 View Chart
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left font-semibold">Date</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Pending</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Settled</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Failed</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => {
                const total = item.Pending + item.Settled + item.Failed
                return (
                  <tr key={item.date} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b font-medium">{item.date}</td>
                    <td className="px-4 py-2 border-b text-yellow-600">{item.Pending}</td>
                    <td className="px-4 py-2 border-b text-green-600">{item.Settled}</td>
                    <td className="px-4 py-2 border-b text-red-600">{item.Failed}</td>
                    <td className="px-4 py-2 border-b font-semibold">{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Aged Trades (T+ Failures/Delays) - Chart View</h4>
        <button 
          onClick={() => setViewMode('table')}
          className="btn-secondary"
        >
          📋 Back to Table
        </button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Pending" stackId="a" fill="#fbbf24" name="Pending" />
          <Bar dataKey="Settled" stackId="a" fill="#10b981" name="Settled" />
          <Bar dataKey="Failed" stackId="a" fill="#ef4444" name="Failed" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ClientConcentrationChart({ trades }: { trades: TradeData[] }) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  const data = useMemo(() => {
    const clientData: { [key: string]: { count: number, volume: number } } = {}
    
    trades.forEach(trade => {
      try {
        const client = trade.clientId || trade.accountId || trade.client || 'Unknown'
        const volumeStr = trade.notionalAmount || trade.tradeAmount || '0'
        const volume = parseFloat(volumeStr) || 0
        
        if (!clientData[client]) {
          clientData[client] = { count: 0, volume: 0 }
        }
        
        clientData[client].count++
        clientData[client].volume += volume
      } catch (error) {
        // Skip invalid entries
      }
    })
    
    return Object.entries(clientData)
      .map(([client, data]) => ({ 
        client, 
        count: data.count, 
        volume: data.volume,
        volumeFormatted: (data.volume / 1000000).toFixed(2) // In millions
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 15) // Top 15 clients
  }, [trades])

  if (viewMode === 'table') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Client Trade Concentration - Data Table</h4>
          <button 
            onClick={() => setViewMode('chart')}
            className="btn-primary"
          >
            📊 View Chart
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left font-semibold">Rank</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Client</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Trade Count</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Volume ($M)</th>
                <th className="px-4 py-2 border-b text-left font-semibold">% of Total Volume</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const totalVolume = data.reduce((sum, d) => sum + d.volume, 0)
                const volumePercentage = totalVolume > 0 ? ((item.volume / totalVolume) * 100).toFixed(1) : '0.0'
                return (
                  <tr key={item.client} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b">{index + 1}</td>
                    <td className="px-4 py-2 border-b font-medium">{item.client}</td>
                    <td className="px-4 py-2 border-b">{item.count}</td>
                    <td className="px-4 py-2 border-b">${item.volumeFormatted}M</td>
                    <td className="px-4 py-2 border-b">{volumePercentage}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Client Trade Concentration - Chart View</h4>
        <button 
          onClick={() => setViewMode('table')}
          className="btn-secondary"
        >
          📋 Back to Table
        </button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="client" angle={-45} textAnchor="end" height={100} />
          <YAxis />
          <Tooltip formatter={(value, name) => [
            name === 'count' ? value : `$${value}M`,
            name === 'count' ? 'Trade Count' : 'Volume (Millions)'
          ]} />
          <Legend />
          <Bar dataKey="count" fill="#3b82f6" name="Trade Count" />
          <Bar dataKey="volumeFormatted" fill="#ef4444" name="Volume (Millions)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Utility to format Firestore Timestamps and other values
function formatDate(value: any) {
  if (value && typeof value === 'object' && value.seconds) {
    // Firestore Timestamp object
    return new Date(value.seconds * 1000).toLocaleString();
  }
  return value ? value.toString() : '';
}
