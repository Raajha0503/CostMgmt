"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download, CreditCard, BarChart3 } from "lucide-react"
import { analyzeExcelData, mapExcelToTradeData, type ExcelAnalysis } from "@/lib/excel-processor"
import type { TradeData } from "@/lib/data-processor"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"

interface ExcelUploadProps {
  onDataLoaded: (data: TradeData[], rawData: any[], dataType: "equity" | "fx") => void
}

export default function ExcelUpload({ onDataLoaded }: ExcelUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<ExcelAnalysis | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"upload" | "analyze" | "map" | "complete">("upload")
  const [rawData, setRawData] = useState<any[]>([])
  const [dataType, setDataType] = useState<"equity" | "fx">("equity")
  const [error, setError] = useState<string | null>(null)

  // Define field groups for both equity and FX trades with EXACT column headers from the CSV files
  const equityFields = [
    { key: "tradeId", label: "Trade ID", required: true },
    { key: "orderId", label: "Order ID", required: false },
    { key: "clientId", label: "Client ID", required: true },
    { key: "isin", label: "ISIN", required: false },
    { key: "symbol", label: "Symbol", required: true },
    { key: "tradeType", label: "Trade Type", required: true },
    { key: "quantity", label: "Quantity", required: true },
    { key: "price", label: "Price", required: true },
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
    { key: "tradeId", label: "TradeID", required: true },
    { key: "tradeDate", label: "TradeDate", required: false },
    { key: "settlementDate", label: "ValueDate", required: false },
    { key: "tradeTime", label: "TradeTime", required: false },
    { key: "traderId", label: "TraderID", required: false },
    { key: "counterparty", label: "Counterparty", required: false },
    { key: "currencyPair", label: "CurrencyPair", required: true },
    { key: "buySell", label: "BuySell", required: true },
    { key: "dealtCurrency", label: "DealtCurrency", required: false },
    { key: "baseCurrency", label: "BaseCurrency", required: false },
    { key: "termCurrency", label: "TermCurrency", required: false },
    { key: "notionalAmount", label: "NotionalAmount", required: true },
    { key: "fxRate", label: "FXRate", required: true },
    { key: "confirmationStatus", label: "TradeStatus", required: false },
    { key: "settlementStatus", label: "SettlementStatus", required: false },
    { key: "settlementMethod", label: "SettlementMethod", required: false },
    { key: "broker", label: "Broker", required: false },
    { key: "tradingVenue", label: "ExecutionVenue", required: false },
    { key: "productType", label: "ProductType", required: false },
    { key: "maturityDate", label: "MaturityDate", required: false },
    { key: "confirmationTimestamp", label: "ConfirmationTimestamp", required: false },
    { key: "settlementDate2", label: "SettlementDate", required: false },
    { key: "bookingLocation", label: "BookingLocation", required: false },
    { key: "portfolio", label: "Portfolio", required: false },
    { key: "tradeVersion", label: "TradeVersion", required: false },
    { key: "cancellationFlag", label: "CancellationFlag", required: false },
    { key: "amendmentFlag", label: "AmendmentFlag", required: false },
    { key: "riskSystemId", label: "RiskSystemID", required: false },
    { key: "regulatoryReportingStatus", label: "RegulatoryReportingStatus", required: false },
    { key: "tradeSourceSystem", label: "TradeSourceSystem", required: false },
    { key: "confirmationMethod", label: "ConfirmationMethod", required: false },
    { key: "confirmationStatus2", label: "ConfirmationStatus", required: false },
    { key: "settlementInstructions", label: "SettlementInstructions", required: false },
    { key: "custodian", label: "Custodian", required: false },
    { key: "nettingEligibility", label: "NettingEligibility", required: false },
    { key: "tradeComplianceStatus", label: "TradeComplianceStatus", required: false },
    { key: "kycCheck", label: "KYCCheck", required: false },
    { key: "sanctionsScreening", label: "SanctionsScreening", required: false },
    { key: "exceptionFlag", label: "ExceptionFlag", required: false },
    { key: "exceptionNotes", label: "ExceptionNotes", required: false },
    { key: "auditTrailRef", label: "AuditTrailRef", required: false },
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
    { key: "costBookedDate", label: "CostBookedDate", required: false },
  ]

  // Get the appropriate fields based on the selected data type
  const tradeFields = dataType === "equity" ? equityFields : fxFields

  // Function to process CSV text into JSON
  const processCSV = (csvText: string) => {
    try {
      // Parse CSV text to rows
      const rows = csvText.split("\n")
      const headers = rows[0].split(",").map((header) => header.trim())

      // Convert rows to JSON objects
      return rows
        .slice(1)
        .filter((row) => row.trim()) // Skip empty rows
        .map((row) => {
          const values = parseCSVRow(row)
          const obj: Record<string, any> = {}

          headers.forEach((header, i) => {
            obj[header] = values[i] || ""
          })

          return obj
        })
    } catch (error) {
      console.error("Error processing CSV:", error)
      setError(`Error processing CSV: ${error.message}`)
      return []
    }
  }

  // Parse CSV row handling quoted values with commas
  const parseCSVRow = (row: string) => {
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

  // Create exact field mapping based on headers
  const createExactMapping = (fields: { key: string; label: string; required: boolean }[], headers: string[]) => {
    const mapping: Record<string, string> = {}

    fields.forEach((field) => {
      // Try to find exact match first
      if (headers.includes(field.label)) {
        mapping[field.key] = field.label
      }
    })

    console.log("Created exact field mapping:", mapping)
    return mapping
  }

  const handleFileUpload = useCallback(
    async (uploadedFile: File) => {
      setLoading(true)
      setError(null)
      try {
        console.log("Processing file:", uploadedFile.name)

        // Create a new FileReader
        const reader = new FileReader()

        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result
            if (!arrayBuffer) {
              throw new Error("Failed to read file")
            }

            // Parse the Excel file
            const workbook = XLSX.read(new Uint8Array(arrayBuffer as ArrayBuffer), { type: "array" })
            const firstSheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[firstSheetName]
            const data = XLSX.utils.sheet_to_json(worksheet)

            console.log("Excel data parsed successfully:", data.length, "rows")

            // Detect if it's likely an FX dataset
            const isFXData = detectFXData(data)
            setDataType(isFXData ? "fx" : "equity")

            // Analyze the data
            const analysisResult = analyzeExcelData(data)
            console.log("Analysis headers:", analysisResult.headers)

            // Update state
            setFile(uploadedFile)
            setRawData(data)
            setAnalysis(analysisResult)

            // Create automatic field mapping
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

        reader.onerror = () => {
          console.error("FileReader error")
          setError("Error reading the file. Please try again.")
          setLoading(false)
        }

        // Read the file as an array buffer
        reader.readAsArrayBuffer(uploadedFile)
      } catch (error) {
        console.error("Error handling file upload:", error)
        setError(`Error uploading file: ${error.message}`)
        setLoading(false)
      }
    },
    [fxFields, equityFields],
  )

  // Function to detect if the data is likely FX data
  const detectFXData = (data: any[]): boolean => {
    if (!data || data.length === 0) return false

    const firstRow = data[0]
    const headers = Object.keys(firstRow).map((h) => h.toLowerCase())

    // Check for FX-specific fields from the FX CSV file
    const fxIndicators = [
      "tradeid",
      "currencypair",
      "buysell",
      "dealtcurrency",
      "basecurrency",
      "termcurrency",
      "notionalamount",
      "fxrate",
    ]

    return fxIndicators.some((indicator) => headers.some((header) => header === indicator))
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      console.log("File dropped")

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0]
        console.log("Dropped file:", droppedFile.name, droppedFile.type)

        if (
          droppedFile.name.endsWith(".xlsx") ||
          droppedFile.name.endsWith(".xls") ||
          droppedFile.name.endsWith(".csv") ||
          droppedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          droppedFile.type === "application/vnd.ms-excel" ||
          droppedFile.type === "text/csv"
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

  const handleFieldMapping = (tradeField: string, excelField: string) => {
    setFieldMapping((prev) => ({
      ...prev,
      [tradeField]: excelField,
    }))
  }

  const autoMapFields = () => {
    if (!analysis || !analysis.headers) return

    const fields = dataType === "equity" ? equityFields : fxFields
    const exactMapping = createExactMapping(fields, analysis.headers)

    // If we have missing required fields, try case-insensitive matching
    const requiredFields = fields.filter((f) => f.required)
    const missingRequired = requiredFields.filter((f) => !exactMapping[f.key])

    if (missingRequired.length > 0) {
      const headerLowerMap: Record<string, string> = {}

      // Create a map of lowercase header names to actual header names
      analysis.headers.forEach((header) => {
        headerLowerMap[header.toLowerCase().trim()] = header
      })

      // Try case-insensitive matching for required fields
      missingRequired.forEach((field) => {
        const lowerLabel = field.label.toLowerCase().trim()
        if (headerLowerMap[lowerLabel]) {
          exactMapping[field.key] = headerLowerMap[lowerLabel]
        }
      })
    }

    console.log("Auto-mapped fields:", exactMapping)
    setFieldMapping(exactMapping)
  }

  const getMappingStatus = () => {
    if (!fieldMapping || Object.keys(fieldMapping).length === 0)
      return { mapped: 0, required: 0, total: tradeFields.length }

    const requiredFields = tradeFields.filter((f) => f.required)
    const mappedRequiredFields = requiredFields.filter((f) => fieldMapping[f.key])
    const totalMappedFields = Object.keys(fieldMapping).length

    return {
      mapped: totalMappedFields,
      required: mappedRequiredFields.length === requiredFields.length,
      total: tradeFields.length,
    }
  }

  const processData = () => {
    if (!rawData.length) {
      setError("No data to process. Please upload a file first.")
      return
    }

    if (Object.keys(fieldMapping).length === 0) {
      setError("No field mapping defined. Please map fields first.")
      return
    }

    setLoading(true)
    setError(null)
    try {
      console.log("Processing data with fieldMapping:", fieldMapping)
      console.log("Raw data sample:", rawData.slice(0, 2))

      const mappedData = mapExcelToTradeData(rawData, fieldMapping)
      console.log("Mapped data length:", mappedData.length)
      console.log("Mapped data sample:", mappedData.slice(0, 2))

      // Add dataSource property to each trade
      const dataWithSource = mappedData.map((trade) => ({
        ...trade,
        dataSource: dataType, // Add dataType as dataSource
      }))

      console.log(`Final processed data (${dataType}):`, dataWithSource.length, "trades")

      // Call the callback with the processed data
      onDataLoaded(dataWithSource, rawData, dataType)
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
          ISIN: "US0378331005",
          Symbol: "AAPL",
          "Trade Type": "Buy",
          Quantity: 100,
          Price: 150.5,
          "Trade Value": 15050,
          Currency: "USD",
          "Trade Date": "2024-01-15",
          "Settlement Date": "2024-01-17",
          "Settlement Status": "Settled",
          Counterparty: "Goldman Sachs",
          "Trading Venue": "NASDAQ",
          "Trader Name": "John Smith",
          "KYC Status": "Passed",
          "Reference Data Validated": "Yes",
          Commission: 15.05,
          Taxes: 30.1,
          "Total Cost": 15095.15,
          "Confirmation Status": "Confirmed",
          "Country of Trade": "US",
          "Ops Team Notes": "",
          "Pricing Source": "Bloomberg",
          "Market Impact Cost": 1.25,
          "FX Rate Applied": 1.0,
          "Net Amount": 15095.15,
          "Collateral Required": 2000,
          "Margin Type": "Initial",
          "Margin Status": "Satisfied",
        },
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Equity Trade Template")
      XLSX.writeFile(wb, "equity_trade_template.xlsx")
    } else {
      const templateData = [
        {
          TradeID: "FX001",
          TradeDate: "2024-01-15",
          ValueDate: "2024-01-17",
          TradeTime: "10:30:00",
          TraderID: "TDR123",
          Counterparty: "JPMorgan",
          CurrencyPair: "EUR/USD",
          BuySell: "Buy",
          DealtCurrency: "EUR",
          BaseCurrency: "EUR",
          TermCurrency: "USD",
          NotionalAmount: 1000000,
          FXRate: 1.0875,
          TradeStatus: "Confirmed",
          SettlementStatus: "Pending",
          SettlementMethod: "CLS",
          Broker: "None",
          ExecutionVenue: "360T",
          ProductType: "Spot",
        },
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "FX Trade Template")
      XLSX.writeFile(wb, "fx_trade_template.xlsx")
    }
  }

  const loadSampleData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Check if running in browser environment
      if (typeof window !== "undefined") {
        const equityUrl =
          "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/equity_trade_lifecycle_dataset-beq6qvON9ARbbAUA0bZdAAv4E6aQY7.csv"
        const fxUrl =
          "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fx_trade_lifecycle_full_dataset-ejMPk6T6t52ZGxH6RmNjCWFazbvoXF.csv"

        // Fetch the data based on selected type
        const url = dataType === "equity" ? equityUrl : fxUrl
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch ${dataType} data: ${response.status}`)
        }

        const text = await response.text()

        // Process the CSV to JSON
        const data = processCSV(text)
        console.log(`Fetched ${dataType} data:`, data.length, "rows")

        // Set as the current data
        setRawData(data)
        const analysisResult = analyzeExcelData(data)
        setAnalysis(analysisResult)

        // Pre-map the fields
        const mapping = createExactMapping(dataType === "equity" ? equityFields : fxFields, analysisResult.headers)
        setFieldMapping(mapping)

        setStep("map")
      }
    } catch (error) {
      console.error("Error fetching data from URLs:", error)
      setError(`Failed to load sample data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (step === "upload") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8"></div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          {/* Upload Area */}
          <div className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="flex space-x-2">
                <button
                  onClick={() => setDataType("equity")}
                  className={`px-4 py-2 rounded-md flex items-center ${
                    dataType === "equity"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Equity Trades
                </button>
                <button
                  onClick={() => setDataType("fx")}
                  className={`px-4 py-2 rounded-md flex items-center ${
                    dataType === "fx"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  FX Trades
                </button>
              </div>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
            >
              <FileSpreadsheet size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Drag & Drop Excel or CSV File</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">or click the button below to browse files</p>
              <div className="flex justify-center">
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md inline-flex items-center">
                  <Upload size={16} className="mr-2" />
                  Browse Files
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

            <div className="flex justify-between items-center">
              <button
                onClick={downloadTemplate}
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center text-sm"
              >
                <Download size={14} className="mr-1" />
                Download Template
              </button>

              <button
                onClick={loadSampleData}
                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-md text-sm"
                disabled={loading}
              >
                {loading ? "Loading..." : "Use Sample Data"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === "map") {
    const mappingStatus = getMappingStatus()

    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Map Excel Fields</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Match your Excel columns to the required CMTA Portal fields
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Field Mapping</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {mappingStatus.mapped} of {mappingStatus.total} fields mapped
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={autoMapFields}
                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-md text-sm"
              >
                Auto-Map Fields
              </button>
              <button
                onClick={() => setStep("upload")}
                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-md text-sm"
              >
                Back
              </button>
            </div>
          </div>

          <div className="overflow-auto max-h-96">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    CMTA Field
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Excel Column
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Required
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Sample Data
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tradeFields.map((field) => (
                  <tr key={field.key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{field.label}</td>
                    <td className="px-4 py-2">
                      <select
                        value={fieldMapping[field.key] || ""}
                        onChange={(e) => handleFieldMapping(field.key, e.target.value)}
                        className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">-- Select Column --</option>
                        {analysis?.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {field.required ? (
                        <span className="text-red-500 dark:text-red-400">Yes</span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {fieldMapping[field.key] && rawData.length > 0
                        ? String(rawData[0][fieldMapping[field.key]] || "").substring(0, 30)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={processData}
            disabled={loading || !mappingStatus.required}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md"
          >
            {loading ? "Processing..." : "Process Data"}
          </Button>
        </div>
      </div>
    )
  }

  if (step === "complete") {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Data Processed Successfully</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Your {dataType.toUpperCase()} trade data has been successfully processed and loaded into the CMTA Portal.
        </p>
        <div className="bg-green-50 dark:bg-green-900 p-6 rounded-lg mb-8">
          <p className="text-green-800 dark:text-green-200 text-lg">{rawData.length} records processed and imported</p>
        </div>
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => setStep("upload")}
            className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 px-6 rounded-md"
          >
            Upload Another File
          </button>
        </div>
      </div>
    )
  }

  return null
}
