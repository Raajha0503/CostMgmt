"use client"

import { useState, useEffect } from "react"
import { Search, AlertTriangle, CheckCircle, FileText, Download, Filter, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TradeData } from "@/lib/data-processor"

interface AgreementManagementProps {
  trades: TradeData[]
  dataType: "equity" | "fx"
}

export default function AgreementManagement({ trades, dataType }: AgreementManagementProps) {
  const [agreements, setAgreements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAgreement, setSelectedAgreement] = useState<any | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  // Extract agreements from trades based on data type
  useEffect(() => {
    console.log(`AgreementManagement: Processing ${trades.length} trades for ${dataType} agreements`)

    if (!trades || trades.length === 0) {
      console.log("No trades data available")
      setAgreements([])
      setLoading(false)
      return
    }

    try {
      // Process trades to extract agreement data
      const extractedAgreements = extractAgreementsFromTrades(trades, dataType)
      console.log(`Extracted ${extractedAgreements.length} ${dataType} agreements`)

      setAgreements(extractedAgreements)
    } catch (error) {
      console.error("Error processing agreements:", error)
    } finally {
      setLoading(false)
    }
  }, [trades, dataType])

  // Function to extract agreements from trades based on data type
  const extractAgreementsFromTrades = (trades: TradeData[], dataType: "equity" | "fx"): any[] => {
    // Filter trades based on data type
    const filteredTrades = trades.filter(
      (trade) =>
        trade.dataSource === dataType ||
        (dataType === "equity" && (trade.symbol || trade.isin)) ||
        (dataType === "fx" && (trade.currencyPair || trade.baseCurrency)),
    )

    console.log(`Filtered ${filteredTrades.length} ${dataType} trades`)

    if (filteredTrades.length === 0) {
      return []
    }

    // Group trades by counterparty to create agreements
    const counterpartyMap = new Map<string, any>()

    filteredTrades.forEach((trade) => {
      const counterparty = trade.counterparty || "Unknown"

      if (!counterpartyMap.has(counterparty)) {
        // Create a new agreement entry
        counterpartyMap.set(counterparty, {
          id: `AGR-${Math.floor(Math.random() * 10000)}`,
          counterparty,
          type: dataType === "equity" ? "Equity CMTA" : "FX CMTA",
          status: Math.random() > 0.3 ? "Active" : Math.random() > 0.5 ? "Pending" : "Expired",
          effectiveDate: trade.tradeDate || new Date().toISOString().split("T")[0],
          expiryDate: addDays(new Date(), 365).toISOString().split("T")[0],
          trades: [],
          dataType,
        })
      }

      // Add trade to the agreement
      const agreement = counterpartyMap.get(counterparty)
      agreement.trades.push(trade)
    })

    // Convert map to array
    return Array.from(counterpartyMap.values())
  }

  // Helper function to add days to a date
  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  // Filter agreements based on search term and status filter
  const filteredAgreements = agreements.filter((agreement) => {
    const matchesSearch =
      !searchTerm ||
      agreement.counterparty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.id.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter = !filterStatus || agreement.status === filterStatus

    return matchesSearch && matchesFilter
  })

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Agreement Management - {dataType === "equity" ? "Equity" : "FX"} View
        </h1>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search agreements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="relative">
            <select
              value={filterStatus || ""}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
            </select>
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          </div>
          <Button className="flex items-center">
            <Plus size={16} className="mr-2" />
            New Agreement
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredAgreements.length === 0 ? (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm m-4 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No {dataType.toUpperCase()} Agreements Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {trades.length === 0
              ? `Please upload ${dataType} trade data using the Data Upload section.`
              : `No agreements could be extracted from your ${dataType} trade data.`}
          </p>
          <Button onClick={() => (window.location.href = "#data-upload")}>Go to Data Upload</Button>
        </div>
      ) : (
        <div className="p-4 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgreements.map((agreement) => (
              <div
                key={agreement.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedAgreement(agreement)}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {agreement.counterparty}
                    </h3>
                    <Badge
                      variant={
                        agreement.status === "Active"
                          ? "success"
                          : agreement.status === "Pending"
                            ? "warning"
                            : "destructive"
                      }
                    >
                      {agreement.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">ID: {agreement.id}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Type</div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{agreement.type}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Trades</div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{agreement.trades.length}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Effective Date</div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{agreement.effectiveDate}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Expiry Date</div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{agreement.expiryDate}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm">
                      <FileText size={16} className="mr-1" />
                      View Details
                    </div>
                    <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
                      <Download size={16} className="mr-1" />
                      Download
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedAgreement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 shadow-lg rounded-md max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Agreement Details: {selectedAgreement.id}
              </h2>
              <Badge
                variant={
                  selectedAgreement.status === "Active"
                    ? "success"
                    : selectedAgreement.status === "Pending"
                      ? "warning"
                      : "destructive"
                }
              >
                {selectedAgreement.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Counterparty</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{selectedAgreement.counterparty}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Agreement Type</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{selectedAgreement.type}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Effective Date</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{selectedAgreement.effectiveDate}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Expiry Date</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{selectedAgreement.expiryDate}</div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Associated Trades</h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {selectedAgreement.dataType === "equity" ? (
                        <>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Trade ID
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Symbol
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Trade Type
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Price
                          </th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Trade ID
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Currency Pair
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Buy/Sell
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Notional
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            FX Rate
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {selectedAgreement.trades.slice(0, 5).map((trade: any) => (
                      <tr key={trade.tradeId}>
                        {selectedAgreement.dataType === "equity" ? (
                          <>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{trade.tradeId}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{trade.symbol}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{trade.tradeType}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                              {Number(trade.quantity).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                              {Number(trade.price).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{trade.tradeId}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{trade.currencyPair}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{trade.buySell}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                              {Number(trade.notionalAmount).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{trade.fxRate}</td>
                          </>
                        )}
                      </tr>
                    ))}
                    {selectedAgreement.trades.length > 5 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-sm text-center text-gray-500 dark:text-gray-400">
                          + {selectedAgreement.trades.length - 5} more trades
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setSelectedAgreement(null)}>
                Close
              </Button>
              <div className="flex space-x-2">
                <Button variant="outline" className="flex items-center">
                  <Download size={16} className="mr-2" />
                  Download
                </Button>
                <Button className="flex items-center">
                  <CheckCircle size={16} className="mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
