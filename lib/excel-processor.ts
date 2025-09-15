"use client"

import * as XLSX from "xlsx"
import type { TradeData } from "./data-processor"

export interface ExcelAnalysis {
  headers: string[]
  rowCount: number
  sampleData: any[]
}

// Function to analyze Excel data
export function analyzeExcelData(data: any[]): ExcelAnalysis {
  if (!data || data.length === 0) {
    return {
      headers: [],
      rowCount: 0,
      sampleData: [],
    }
  }

  const headers = Object.keys(data[0])
  const sampleData = data.slice(0, 5)

  return {
    headers,
    rowCount: data.length,
    sampleData,
  }
}

export function mapExcelToTradeData(data: any[], fieldMapping: Record<string, string>): TradeData[] {
  if (!data || data.length === 0) {
    return []
  }

  console.log("Starting to map Excel data to TradeData")
  console.log("Field mapping:", fieldMapping)

  // Detect if it's likely FX data
  const isFXData = detectFXData(data)
  console.log("Data type detected:", isFXData ? "FX" : "Equity")

  return data.map((row, index) => {
    try {
      const mappedData: Partial<TradeData> = {}

      // Add dataSource property based on detection
      mappedData.dataSource = isFXData ? "fx" : "equity"

      // Map fields based on the provided mapping
      Object.entries(fieldMapping).forEach(([tradeField, excelField]) => {
        if (excelField && row[excelField] !== undefined && row[excelField] !== null && row[excelField] !== "") {
          let value = row[excelField]

          // Handle numeric fields
          if (
            [
              "quantity",
              "price",
              "tradeValue",
              "commission",
              "taxes",
              "totalCost",
              "marketImpactCost",
              "fxRateApplied",
              "netAmount",
              "collateralRequired",
              "notionalAmount",
              "fxRate",
              "commissionAmount",
              "brokerageFee",
              "custodyFee",
              "settlementCost",
              "fxGainLoss",
              "pnlCalculated",
            ].includes(tradeField)
          ) {
            value = parseNumber(value)
          }

          // Handle date fields
          if (["tradeDate", "settlementDate", "maturityDate", "costBookedDate"].includes(tradeField)) {
            value = formatDate(value)
          }

          mappedData[tradeField] = value
        }
      })

      // Add a unique tradeId if not present
      if (!mappedData.tradeId) {
        mappedData.tradeId = `TRADE-${String(index + 1).padStart(6, "0")}`
      }

      // Ensure required fields have default values
      if (!mappedData.tradeDate) {
        mappedData.tradeDate = new Date().toLocaleDateString()
      }

      if (!mappedData.settlementDate) {
        mappedData.settlementDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString() // T+2
      }

      return mappedData as TradeData
    } catch (error) {
      console.error(`Error mapping row ${index}:`, error)
      return {
        tradeId: `ERROR-${index + 1}`,
        dataSource: isFXData ? "fx" : "equity",
        tradeDate: new Date().toLocaleDateString(),
        settlementDate: new Date().toLocaleDateString(),
      } as TradeData
    }
  })
}

// Function to detect if the data is likely FX data
function detectFXData(data: any[]): boolean {
  if (!data || data.length === 0) return false

  const firstRow = data[0]
  const headers = Object.keys(firstRow).map((h) => h.toLowerCase())

  // Check for FX-specific fields
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

// Function to process CSV text into JSON
export function processCSV(csvText: string): any[] {
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
    return []
  }
}

// Parse CSV row handling quoted values with commas
function parseCSVRow(row: string): string[] {
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
export function createExactMapping(
  fields: { key: string; label: string; required: boolean }[],
  headers: string[],
): Record<string, string> {
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

function isDateString(value: string): boolean {
  const datePatterns = [/^\d{1,2}\/\d{1,2}\/\d{4}$/, /^\d{4}-\d{2}-\d{2}$/, /^\d{1,2}-\d{1,2}-\d{4}$/]
  return datePatterns.some((pattern) => pattern.test(value))
}

function isCurrencyString(value: string): boolean {
  return /^[$€£¥₹]?[\d,]+\.?\d*$/.test(value.replace(/\s/g, ""))
}

export function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        if (!e.target || !e.target.result) {
          reject(new Error("Failed to read file"))
          return
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })

        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          reject(new Error("Excel file contains no sheets"))
          return
        }

        const worksheet = workbook.Sheets[firstSheetName]

        // Convert to JSON with header: true to ensure column names are used
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: "A" })

        // If the first row contains headers, use them
        if (jsonData.length > 0) {
          const headers = jsonData[0]
          const dataWithHeaders = jsonData.slice(1).map((row) => {
            const obj: any = {}
            Object.keys(row).forEach((key) => {
              const headerKey = headers[key] || key
              obj[headerKey] = row[key]
            })
            return obj
          })
          resolve(dataWithHeaders)
        } else {
          // If no data or just headers, return empty array
          resolve([])
        }
      } catch (error) {
        console.error("Error parsing Excel file:", error)
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })
}

function hasEquityFields(row: any): boolean {
  // Check for equity-specific fields
  return Boolean(row.Symbol || row.ISIN || row.Quantity || row["Trade Value"] || row.Price)
}

function hasFXFields(row: any): boolean {
  // Check for FX-specific fields
  return Boolean(row.CurrencyPair || row.BaseCurrency || row.TermCurrency || row.NotionalAmount || row.FXRate)
}

// Helper function to parse numbers
function parseNumber(value: any): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    // Remove currency symbols, commas, and spaces
    const cleaned = value.replace(/[$€£¥₹,\s]/g, "")
    const parsed = Number.parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

// Helper function to format dates
function formatDate(value: any): string {
  if (!value) return new Date().toLocaleDateString()

  // If it's already a date object
  if (value instanceof Date) {
    return value.toLocaleDateString()
  }

  // If it's a string, try to parse it
  if (typeof value === "string") {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString()
    }
  }

  // If it's an Excel date number
  if (typeof value === "number") {
    try {
      const date = new Date((value - 25569) * 86400 * 1000) // Excel date conversion
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString()
      }
    } catch (error) {
      console.warn("Error converting Excel date:", error)
    }
  }

  return value?.toString() || new Date().toLocaleDateString()
}
