"use client"

import { useState, useEffect } from "react"
import { ArrowRight, Download, Calendar, TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface CostData {
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

interface CMSFile {
  id: string
  name: string
  data: any[]
  headers: string[]
}

export default function ForwardToSettlements() {
  const [costData, setCostData] = useState<CostData[]>([])
  const [cmsFiles, setCMSFiles] = useState<CMSFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCostData = async () => {
      try {
        const response = await fetch(
          "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/cost%20mgmt%20creation-hPo6mKs7ZdTVGQ2w8ZA4Gx0CkAbNfi.csv",
        )
        const csvText = await response.text()

        const lines = csvText.split("\n").filter((line) => line.trim())
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))

        const data = lines.slice(1).map((line) => {
          const values = parseCSVRow(line)
          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ""
          })
          return row as CostData
        })

        setCostData(data)
      } catch (err) {
        setError("Failed to fetch cost management data")
        console.error("Error fetching cost data:", err)
      }
    }

    const loadCMSFiles = () => {
      try {
        const savedFiles = localStorage.getItem("cmsUploadedFiles")
        if (savedFiles) {
          setCMSFiles(JSON.parse(savedFiles))
        }
      } catch (err) {
        console.error("Error loading CMS files:", err)
      }
    }

    fetchCostData()
    loadCMSFiles()
    setLoading(false)
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

  const calculateSummary = () => {
    const totalFXGainLoss = costData.reduce((sum, item) => {
      const value = Number.parseFloat(item.FXGainLoss) || 0
      return sum + value
    }, 0)

    const totalPnL = costData.reduce((sum, item) => {
      const value = Number.parseFloat(item.PnlCalculated) || 0
      return sum + value
    }, 0)

    const totalCommission = costData.reduce((sum, item) => {
      const value = Number.parseFloat(item.CommissionAmount) || 0
      return sum + value
    }, 0)

    const totalBrokerage = costData.reduce((sum, item) => {
      const value = Number.parseFloat(item.BrokerageFee) || 0
      return sum + value
    }, 0)

    return { totalFXGainLoss, totalPnL, totalCommission, totalBrokerage }
  }

  const downloadCombinedCSV = () => {
    try {
      // Combine cost data with CMS file data
      let combinedData: any[] = [...costData]

      // Add CMS file data
      cmsFiles.forEach((file) => {
        if (file.data && file.data.length > 0) {
          combinedData = [...combinedData, ...file.data]
        }
      })

      if (combinedData.length === 0) {
        alert("No data available to download")
        return
      }

      // Get all unique headers
      const allHeaders = new Set<string>()
      combinedData.forEach((row) => {
        Object.keys(row).forEach((key) => allHeaders.add(key))
      })

      const headers = Array.from(allHeaders)

      // Create CSV content
      let csvContent = headers.join(",") + "\n"

      combinedData.forEach((row) => {
        const values = headers.map((header) => {
          const value = row[header] || ""
          return `"${String(value).replace(/"/g, '""')}"`
        })
        csvContent += values.join(",") + "\n"
      })

      // Download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      link.setAttribute("href", url)
      link.setAttribute("download", `combined_settlement_data_${new Date().toISOString().split("T")[0]}.csv`)
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

  const formatCurrency = (value: string) => {
    const num = Number.parseFloat(value)
    if (isNaN(num)) return "N/A"
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num)
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString()
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    )
  }

  const summary = calculateSummary()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-black rounded-xl">
                <ArrowRight className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Forward to Settlements</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Process and forward settlement data to downstream systems
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-2xl font-bold text-black dark:text-white">{costData.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Settlement Records</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-8">
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-red-800 dark:text-red-200">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div
                  className={`p-2 rounded-lg ${summary.totalFXGainLoss >= 0 ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}
                >
                  {summary.totalFXGainLoss >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total FX Gain/Loss</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-600 mb-3" />
              <p className={`text-lg font-bold ${summary.totalFXGainLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(summary.totalFXGainLoss.toString())}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div
                  className={`p-2 rounded-lg ${summary.totalPnL >= 0 ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}
                >
                  {summary.totalPnL >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total P&L</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-600 mb-3" />
              <p className={`text-lg font-bold ${summary.totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(summary.totalPnL.toString())}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Commission</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-600 mb-3" />
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary.totalCommission.toString())}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                  <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Brokerage</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-600 mb-3" />
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary.totalBrokerage.toString())}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Settlement Data</CardTitle>
              <CardDescription>Cost management and settlement records ready for processing</CardDescription>
            </div>
            <Button onClick={downloadCombinedCSV} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Combined CSV
            </Button>
          </CardHeader>
          <CardContent>
            {/* Information Panel */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Download Information</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">The CSV download will include:</p>
              <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 ml-4 list-disc">
                <li>All settlement data from the cost management system ({costData.length} records)</li>
                <li>All uploaded files from the "Captured from CMS" section ({cmsFiles.length} files)</li>
                <li>Combined data with all unique columns from both sources</li>
              </ul>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                      Cost Booked Date
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">FX Gain/Loss</th>
                    <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                      P&L Calculated
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Commission</th>
                    <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                      Brokerage Fee
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                      Cost Allocation
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                      Expense Approval
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {costData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-3 text-gray-900 dark:text-gray-100">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{formatDate(item.CostBookedDate)}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-medium ${Number.parseFloat(item.FXGainLoss) >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {formatCurrency(item.FXGainLoss)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-medium ${Number.parseFloat(item.PnlCalculated) >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {formatCurrency(item.PnlCalculated)}
                        </span>
                      </td>
                      <td className="p-3 text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.CommissionAmount)} {item.CommissionCurrency}
                      </td>
                      <td className="p-3 text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.BrokerageFee)} {item.BrokerageCurrency}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            item.CostAllocationStatus === "Completed"
                              ? "default"
                              : item.CostAllocationStatus === "Failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {item.CostAllocationStatus}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            item.ExpenseApprovalStatus === "Approved"
                              ? "default"
                              : item.ExpenseApprovalStatus === "Rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {item.ExpenseApprovalStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
