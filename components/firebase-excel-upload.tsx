"use client"

import React, { useState, useCallback } from "react"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download, CreditCard, BarChart3, Trash2, Eye, Cloud } from "lucide-react"
import { analyzeExcelData, mapExcelToTradeData, type ExcelAnalysis } from "@/lib/excel-processor"
import type { TradeData } from "@/lib/data-processor"
import { useFirebaseStorage } from "@/hooks/use-firebase-storage"
import { useFirebase } from "@/hooks/use-firebase"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface FirebaseExcelUploadProps {
  onDataLoaded: (data: TradeData[], rawData: any[], dataType: "equity" | "fx") => void
}

export default function FirebaseExcelUpload({ onDataLoaded }: FirebaseExcelUploadProps) {
  const { uploadFile, uploadedFiles, loading, error, uploadProgress, downloadFile, deleteFile, clearError } = useFirebaseStorage()
  const { createTrade } = useFirebase()
  
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<ExcelAnalysis | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [step, setStep] = useState<"upload" | "analyze" | "map" | "complete">("upload")
  const [rawData, setRawData] = useState<any[]>([])
  const [dataType, setDataType] = useState<"equity" | "fx">("equity")
  const [currentFileId, setCurrentFileId] = useState<string | null>(null)

  // Define field groups for both equity and FX trades
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
  ]

  const fxFields = [
    { key: "tradeId", label: "TradeID", required: true },
    { key: "tradeDate", label: "TradeDate", required: false },
    { key: "settlementDate", label: "ValueDate", required: false },
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
  ]

  const tradeFields = dataType === "equity" ? equityFields : fxFields

  // Function to process CSV text into JSON
  const processCSV = (csvText: string) => {
    try {
      const rows = csvText.split("\n")
      const headers = rows[0].split(",").map((header) => header.trim())

      return rows
        .slice(1)
        .filter((row) => row.trim())
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
      throw new Error(`Error processing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      if (headers.includes(field.label)) {
        mapping[field.key] = field.label
      }
    })

    return mapping
  }

  // Detect if data is FX or Equity
  const detectFXData = (data: any[]): boolean => {
    if (data.length === 0) return false

    const headers = Object.keys(data[0]).map((h) => h.toLowerCase())
    const fxIndicators = [
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

  // Handle file upload to Firebase Storage
  const handleFileUpload = useCallback(
    async (uploadedFile: File) => {
      try {
        console.log("Processing file:", uploadedFile.name)

        // First, upload to Firebase Storage
        const fileMetadata = await uploadFile(uploadedFile, dataType, 'excel')
        setCurrentFileId(fileMetadata.id)

        // Create a new FileReader to process the file
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
            throw new Error(`Error processing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }

        reader.onerror = () => {
          throw new Error("Error reading the file. Please try again.")
        }

        // Read the file as an array buffer
        reader.readAsArrayBuffer(uploadedFile)
      } catch (error) {
        console.error("Error handling file upload:", error)
        throw new Error(`Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },
    [uploadFile, dataType, fxFields, equityFields]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0]

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
          throw new Error("Please upload an Excel or CSV file (.xlsx, .xls, .csv)")
        }
      }
    },
    [handleFileUpload]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        handleFileUpload(selectedFile)
      }
    },
    [handleFileUpload]
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

    // Try case-insensitive matching for required fields
    const requiredFields = fields.filter((f) => f.required)
    const missingRequired = requiredFields.filter((f) => !exactMapping[f.key])

    if (missingRequired.length > 0) {
      const headerLowerMap: Record<string, string> = {}

      analysis.headers.forEach((header) => {
        headerLowerMap[header.toLowerCase().trim()] = header
      })

      missingRequired.forEach((field) => {
        const lowerLabel = field.label.toLowerCase().trim()
        if (headerLowerMap[lowerLabel]) {
          exactMapping[field.key] = headerLowerMap[lowerLabel]
        }
      })
    }

    setFieldMapping(exactMapping)
  }

  const getMappingStatus = () => {
    if (!fieldMapping || Object.keys(fieldMapping).length === 0)
      return { mapped: 0, required: false, total: tradeFields.length }

    const requiredFields = tradeFields.filter((f) => f.required)
    const mappedRequiredFields = requiredFields.filter((f) => fieldMapping[f.key])
    const totalMappedFields = Object.keys(fieldMapping).length

    return {
      mapped: totalMappedFields,
      required: mappedRequiredFields.length === requiredFields.length,
      total: tradeFields.length,
    }
  }

  const processData = async () => {
    if (!rawData.length) {
      throw new Error("No data to process. Please upload a file first.")
    }

    if (Object.keys(fieldMapping).length === 0) {
      throw new Error("No field mapping defined. Please map fields first.")
    }

    try {
      console.log("Processing data with fieldMapping:", fieldMapping)

      const mappedData = mapExcelToTradeData(rawData, fieldMapping)
      console.log("Mapped data length:", mappedData.length)

      // Add dataSource property to each trade
      const dataWithSource = mappedData.map((trade) => ({
        ...trade,
        dataSource: dataType,
      }))

      console.log(`Final processed data (${dataType}):`, dataWithSource.length, "trades")

      // Save trades to Firebase
      for (const trade of dataWithSource) {
        await createTrade(trade)
      }

      // Call the callback with the processed data
      onDataLoaded(dataWithSource, rawData, dataType)
      setStep("complete")
    } catch (error) {
      console.error("Error processing data:", error)
      throw new Error(`Error processing data: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
        },
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "FX Trade Template")
      XLSX.writeFile(wb, "fx_trade_template.xlsx")
    }
  }

  const handleDownloadFile = async (fileMetadata: any) => {
    try {
      await downloadFile(fileMetadata)
    } catch (error) {
      console.error("Error downloading file:", error)
    }
  }

  const handleDeleteFile = async (fileMetadata: any) => {
    if (confirm('Are you sure you want to delete this file?')) {
      try {
        await deleteFile(fileMetadata)
      } catch (error) {
        console.error("Error deleting file:", error)
      }
    }
  }

  if (step === "upload") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Upload Excel Files to Firebase</h2>
          <p className="text-gray-600 dark:text-gray-400">Upload and manage your Excel files in the cloud</p>
        </div>

        {error && (
          <Alert className="bg-red-50 border-red-200 mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800">
              {error}
              <Button variant="outline" size="sm" className="ml-2" onClick={clearError}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
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
              <Cloud size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Drag & Drop Excel or CSV File</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Files will be uploaded to Firebase Storage</p>
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

            {uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading to Firebase...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            <div className="flex justify-between items-center">
              <button
                onClick={downloadTemplate}
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center text-sm"
              >
                <Download size={14} className="mr-1" />
                Download Template
              </button>
            </div>
          </div>

          {/* Uploaded Files List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Cloud className="mr-2 h-5 w-5" />
                Uploaded Files ({uploadedFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {uploadedFiles.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No files uploaded yet</p>
              ) : (
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{file.originalName}</div>
                        <div className="text-sm text-gray-600">
                          {file.dataType.toUpperCase()} • {(file.fileSize / 1024).toFixed(1)} KB • {file.status}
                        </div>
                        <div className="text-xs text-gray-500">
                          Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Badge variant={file.status === 'processed' ? 'default' : 'secondary'}>
                          {file.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadFile(file)}
                        >
                          <Download size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteFile(file)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
          <Alert className="bg-red-50 border-red-200 mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800">
              {error}
              <Button variant="outline" size="sm" className="ml-2" onClick={clearError}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
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
              <Button
                onClick={autoMapFields}
                variant="outline"
                size="sm"
              >
                Auto-Map Fields
              </Button>
              <Button
                onClick={() => setStep("upload")}
                variant="outline"
                size="sm"
              >
                Back
              </Button>
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
          Your {dataType.toUpperCase()} trade data has been successfully processed and uploaded to Firebase.
        </p>
        <div className="bg-green-50 dark:bg-green-900 p-6 rounded-lg mb-8">
          <p className="text-green-800 dark:text-green-200 text-lg">{rawData.length} records processed and imported</p>
        </div>
        <div className="flex justify-center space-x-4">
          <Button
            onClick={() => setStep("upload")}
            variant="outline"
          >
            Upload Another File
          </Button>
        </div>
      </div>
    )
  }

  return null
} 