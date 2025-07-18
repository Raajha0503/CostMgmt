"use client"

import { useState, useEffect, useMemo } from "react"
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  PieChart,
  Activity,
  AlertTriangle,
  CheckCircle,
  Download,
  Search,
  Calendar,
  Building,
  Target,
  Zap,
  Eye,
  RefreshCw,
  ArrowUpDown,
  CreditCard,
} from "lucide-react"
import {
  analyzeDataIntelligently,
  formatCurrency,
  formatNumber,
  formatPercentage,
  type DataAnalytics,
} from "@/lib/intelligent-data-processor"
import type { TradeData } from "@/lib/data-processor"

interface IntelligentTradeCaptureProps {
  trades: TradeData[]
  rawData: any[]
}

export default function IntelligentTradeCapture({ trades, rawData }: IntelligentTradeCaptureProps) {
  const [analytics, setAnalytics] = useState<DataAnalytics | null>(null)
  const [selectedView, setSelectedView] = useState<"overview" | "data" | "analytics" | "quality">("overview")
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [tradeType, setTradeType] = useState<"all" | "equity" | "fx">("all")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const itemsPerPage = 25

  useEffect(() => {
    if (rawData && rawData.length > 0) {
      setLoading(true)
      try {
        const analysisResult = analyzeDataIntelligently(rawData)
        setAnalytics(analysisResult)
      } catch (error) {
        console.error("Error analyzing data:", error)
      } finally {
        setLoading(false)
      }
    }
  }, [rawData])

  // Filter data based on trade type
  const filteredByTradeType = useMemo(() => {
    if (tradeType === "all") return rawData
    return rawData.filter((row) => {
      if (tradeType === "equity") {
        return row.dataSource === "equity" || (!row.dataSource && !row.CurrencyPair)
      } else {
        return row.dataSource === "fx" || (!row.dataSource && row.CurrencyPair)
      }
    })
  }, [rawData, tradeType])

  // Apply search and column filters
  const filteredData = useMemo(() => {
    if (!filteredByTradeType) return []

    return filteredByTradeType.filter((row) => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch = Object.entries(row).some(([key, value]) => {
          if (value === null || value === undefined) return false
          return String(value).toLowerCase().includes(searchLower)
        })
        if (!matchesSearch) return false
      }

      // Apply column filters
      for (const [column, filterValue] of Object.entries(filters)) {
        if (filterValue && row[column] !== filterValue) {
          return false
        }
      }

      return true
    })
  }, [filteredByTradeType, searchTerm, filters])

  // Apply sorting
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn]
      const bValue = b[sortColumn]

      // Handle null/undefined values
      if (aValue === undefined || aValue === null) return sortDirection === "asc" ? -1 : 1
      if (bValue === undefined || bValue === null) return sortDirection === "asc" ? 1 : -1

      // Handle numeric values
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue
      }

      // Handle string values
      const aString = String(aValue).toLowerCase()
      const bString = String(bValue).toLowerCase()
      return sortDirection === "asc" ? aString.localeCompare(bString) : bString.localeCompare(aString)
    })
  }, [filteredData, sortColumn, sortDirection])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedData.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedData, currentPage])

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("desc") // Default to descending when selecting a new column
    }
  }

  const displayColumns = useMemo(() => {
    if (!analytics || !analytics.columns || analytics.columns.length === 0) return []

    // Common columns for all trade types
    const commonColumns = [
      "tradeId",
      "tradeDate",
      "settlementDate",
      "settlementStatus",
      "counterparty",
      "confirmationStatus",
    ]

    // Equity-specific columns
    const equityColumns = ["symbol", "tradeType", "quantity", "price", "tradeValue", "currency"]

    // FX-specific columns
    const fxColumns = ["currencyPair", "buySell", "notionalAmount", "fxRate", "baseCurrency", "termCurrency"]

    // Get column names from analytics
    const columnNames = analytics.columns.map((col) => col.name)

    // Filter columns based on trade type
    let selectedColumns: string[] = []

    if (tradeType === "all") {
      // For all trades, show common columns and detect if we have equity or FX data
      selectedColumns = commonColumns

      // Check if we have equity columns
      const hasEquityColumns = equityColumns.some(
        (col) => columnNames.includes(col) || columnNames.some((name) => name.toLowerCase() === col.toLowerCase()),
      )

      // Check if we have FX columns
      const hasFXColumns = fxColumns.some(
        (col) => columnNames.includes(col) || columnNames.some((name) => name.toLowerCase() === col.toLowerCase()),
      )

      // Add type-specific columns based on what's available
      if (hasEquityColumns) {
        selectedColumns = [...selectedColumns, "symbol", "tradeType", "price"]
      }

      if (hasFXColumns) {
        selectedColumns = [...selectedColumns, "currencyPair", "buySell", "fxRate"]
      }
    } else if (tradeType === "equity") {
      selectedColumns = [...commonColumns, ...equityColumns]
    } else {
      // fx
      selectedColumns = [...commonColumns, ...fxColumns]
    }

    // Map selected columns to actual column names in the data
    return selectedColumns
      .map((col) => {
        // Find exact match
        const exactMatch = analytics.columns.find((c) => c.name.toLowerCase() === col.toLowerCase())
        if (exactMatch) return exactMatch.name

        // Find column with similar name
        const similarMatch = analytics.columns.find(
          (c) => c.name.toLowerCase().includes(col.toLowerCase()) || col.toLowerCase().includes(c.name.toLowerCase()),
        )
        if (similarMatch) return similarMatch.name

        // Return original name if no match found
        return col
      })
      .filter((col, index, self) => self.indexOf(col) === index) // Remove duplicates
  }, [analytics, tradeType])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg">Analyzing your data...</span>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Data Available</h3>
        <p className="text-gray-600 dark:text-gray-400">Upload data to see intelligent analysis and insights.</p>
      </div>
    )
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Trade Type Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trade Type</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setTradeType("all")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                tradeType === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              }`}
            >
              All Trades
            </button>
            <button
              onClick={() => setTradeType("equity")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                tradeType === "equity"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              }`}
            >
              <BarChart3 className="inline-block mr-1 h-4 w-4" />
              Equity
            </button>
            <button
              onClick={() => setTradeType("fx")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                tradeType === "fx"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              }`}
            >
              <CreditCard className="inline-block mr-1 h-4 w-4" />
              FX
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Records</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(tradeType === "all" ? analytics.totalRecords : filteredByTradeType.length)}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Trade Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(analytics.businessMetrics.totalTradeValue)}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Trade Size</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(analytics.businessMetrics.averageTradeSize)}
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Data Quality</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercentage(analytics.dataQuality.completeness)}
              </p>
            </div>
            <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <Zap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Building className="h-5 w-5 mr-2" />
            Top Counterparties
          </h3>
          <div className="space-y-3">
            {analytics.businessMetrics.topCounterparties.map((cp, index) => (
              <div key={cp.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-400">
                    {index + 1}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{cp.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{cp.count} trades</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(cp.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            {tradeType === "fx" ? "Top Currency Pairs" : "Top Instruments"}
          </h3>
          <div className="space-y-3">
            {analytics.businessMetrics.topSymbols.map((symbol, index) => (
              <div key={symbol.symbol} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-sm font-medium text-green-600 dark:text-green-400">
                    {index + 1}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{symbol.symbol}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{symbol.count} trades</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(symbol.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <PieChart className="h-5 w-5 mr-2" />
            Settlement Status
          </h3>
          <div className="space-y-2">
            {Object.entries(analytics.businessMetrics.settlementStatusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{status}</span>
                <div className="flex items-center">
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${(count / analytics.totalRecords) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Building className="h-5 w-5 mr-2" />
            {tradeType === "fx" ? "Execution Venues" : "Trading Venues"}
          </h3>
          <div className="space-y-2">
            {Object.entries(analytics.businessMetrics.tradingVenueBreakdown).map(([venue, count]) => (
              <div key={venue} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{venue}</span>
                <div className="flex items-center">
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${(count / analytics.totalRecords) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderDataView = () => {
    return (
      <div className="space-y-6">
        {/* Filters and Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search across all fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => {
                  setSearchTerm("")
                  setFilters({})
                  setCurrentPage(1)
                  setSortColumn(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Clear Filters
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, sortedData.length)}{" "}
                of {sortedData.length} records
              </span>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  {displayColumns.map((colName) => {
                    // Find the column in analytics
                    const column = analytics.columns.find((c) => c.name === colName)
                    const columnType = column?.type || "string"

                    return (
                      <th
                        key={colName}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort(colName)}
                      >
                        <div className="flex items-center space-x-1">
                          <span>{colName}</span>
                          {sortColumn === colName && <ArrowUpDown className="h-3 w-3" />}
                          {columnType === "currency" && <DollarSign className="h-3 w-3" />}
                          {columnType === "date" && <Calendar className="h-3 w-3" />}
                          {columnType === "number" && <BarChart3 className="h-3 w-3" />}
                        </div>
                      </th>
                    )
                  })}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    {displayColumns.map((colName) => {
                      // Find the column in analytics
                      const column = analytics.columns.find((c) => c.name === colName)
                      const columnType = column?.type || "string"
                      const value = row[colName]

                      return (
                        <td key={colName} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {columnType === "currency" ? (
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {formatCurrency(Number.parseFloat(value) || 0)}
                            </span>
                          ) : columnType === "number" ? (
                            <span className="font-mono">{formatNumber(Number.parseFloat(value) || 0)}</span>
                          ) : columnType === "date" ? (
                            <span className="text-gray-600 dark:text-gray-400">
                              {value ? new Date(value).toLocaleDateString() : "—"}
                            </span>
                          ) : (
                            <span>{value || "—"}</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="mx-4 text-sm text-gray-700 dark:text-gray-200">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderAnalytics = () => (
    <div className="space-y-6">
      {/* Monthly Trends */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Monthly Trading Trends
        </h3>
        <div className="space-y-4">
          {analytics.businessMetrics.monthlyTrends.map((trend) => (
            <div key={trend.month} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{trend.month}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{trend.count} trades</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(trend.value)}</p>
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${(trend.value / Math.max(...analytics.businessMetrics.monthlyTrends.map((t) => t.value))) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Column Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Column Analysis</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Column
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Unique Values
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Missing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Sample Values
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {analytics.columns
                .filter((column) => {
                  if (tradeType === "all") return true
                  if (tradeType === "equity") {
                    return (
                      !column.name.toLowerCase().includes("currency") &&
                      !column.name.toLowerCase().includes("fx") &&
                      !column.name.toLowerCase().includes("broker")
                    )
                  }
                  if (tradeType === "fx") {
                    return (
                      column.name.toLowerCase().includes("currency") ||
                      column.name.toLowerCase().includes("fx") ||
                      column.name.toLowerCase().includes("broker") ||
                      column.name.toLowerCase().includes("settlement") ||
                      column.name.toLowerCase().includes("trade")
                    )
                  }
                  return true
                })
                .map((column) => (
                  <tr key={column.name}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {column.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {column.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatNumber(column.uniqueCount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {column.nullCount > 0 ? (
                        <span className="text-red-600 dark:text-red-400">{column.nullCount}</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="max-w-xs truncate">{column.sampleValues.slice(0, 3).join(", ")}</div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderQuality = () => (
    <div className="space-y-6">
      {/* Quality Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completeness</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercentage(analytics.dataQuality.completeness)}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Consistency</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercentage(analytics.dataQuality.consistency)}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Accuracy</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercentage(analytics.dataQuality.accuracy)}
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Issues */}
      {analytics.dataQuality.issues.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
            Data Quality Issues
          </h3>
          <div className="space-y-3">
            {analytics.dataQuality.issues.map((issue, index) => (
              <div key={index} className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <p className="text-sm text-gray-600 dark:text-gray-400">{issue}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Type Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <PieChart className="h-5 w-5 mr-2" />
          Data Type Distribution
        </h3>

        {/* Calculate data type distribution */}
        {(() => {
          const typeCount: Record<string, number> = {}
          analytics.columns.forEach((col) => {
            typeCount[col.type] = (typeCount[col.type] || 0) + 1
          })

          const totalColumns = analytics.columns.length

          return (
            <div className="space-y-3">
              {Object.entries(typeCount).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full mr-2 ${
                        type === "string"
                          ? "bg-blue-500"
                          : type === "number"
                            ? "bg-green-500"
                            : type === "date"
                              ? "bg-purple-500"
                              : type === "currency"
                                ? "bg-yellow-500"
                                : type === "boolean"
                                  ? "bg-red-500"
                                  : "bg-gray-500"
                      }`}
                    ></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{type}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                      <div
                        className={`h-2 rounded-full ${
                          type === "string"
                            ? "bg-blue-500"
                            : type === "number"
                              ? "bg-green-500"
                              : type === "date"
                                ? "bg-purple-500"
                                : type === "currency"
                                  ? "bg-yellow-500"
                                  : type === "boolean"
                                    ? "bg-red-500"
                                    : "bg-gray-500"
                        }`}
                        style={{ width: `${(count / totalColumns) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {count} ({((count / totalColumns) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Intelligent Trade Capture</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI-powered analysis of your trade data with automatic insights
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { key: "overview", label: "Overview", icon: BarChart3 },
                { key: "data", label: "Data", icon: Eye },
                { key: "analytics", label: "Analytics", icon: Activity },
                { key: "quality", label: "Quality", icon: CheckCircle },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedView(key as any)}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedView === key
                      ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6">
        {selectedView === "overview" && renderOverview()}
        {selectedView === "data" && renderDataView()}
        {selectedView === "analytics" && renderAnalytics()}
        {selectedView === "quality" && renderQuality()}
      </div>
    </div>
  )
}
