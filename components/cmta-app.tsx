"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, CheckCircle, Upload, BarChart3, CreditCard, Bot } from "lucide-react"
import {
  fetchTradeData,
  calculateSummaryMetrics,
  safeToLocaleString,
  safeToCurrency,
  type TradeData,
} from "@/lib/data-processor"
import ExcelUpload from "./excel-upload"
import CMTAHomepage from "./cmta-homepage"
import AgreementManagement from "./agreement-management"
import BrokerageManagement from "./brokerage-management"
import CommissionManagement from "./commission-management"
import AgentBilling from "./agent-billing"
import AIAssistantPanel from "./ai-assistant-panel"
import IssueResolutionModal from "./issue-resolution-modal"
import { ThemeToggle } from "./theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import InterestClaims from "./interest-claims"
import CapturedFromCMS from "./captured-from-cms"
import ForwardToSettlements from "./forward-to-settlements"

// Reusable UI components
// Add the card-bw and btn-primary/btn-secondary classes
const Card = ({ children, className = "" }) => {
  return <div className={`card-bw p-6 ${className}`}>{children}</div>
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
    </div>
  )
}

// Update TradeEnrichmentPage header styling
function TradeEnrichmentPage({ trades, dataType }: { trades: TradeData[]; dataType: "equity" | "fx" }) {
  const [sel, setSel] = useState<TradeData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const tradesPerPage = 15

  // Filter trades based on data type
  const filteredTrades = trades.filter(
    (trade) =>
      trade.dataSource === dataType ||
      (dataType === "equity" && (trade.symbol || trade.isin)) ||
      (dataType === "fx" && (trade.currencyPair || trade.baseCurrency)),
  )

  const startIndex = (currentPage - 1) * tradesPerPage
  const endIndex = startIndex + tradesPerPage
  const currentTrades = filteredTrades.slice(startIndex, endIndex)
  const totalPages = Math.ceil(filteredTrades.length / tradesPerPage)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Salesforce-inspired Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-black rounded-xl">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Trade Enrichment - {dataType === "equity" ? "Equity" : "FX"} View
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Enrich and validate trade data with intelligent processing
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              {filteredTrades.length > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-black dark:text-white">
                    {filteredTrades.length.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{dataType.toUpperCase()} Trades</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-8">
        {filteredTrades.length === 0 ? (
          <div className="card-bw p-12 text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-6">
              <AlertTriangle className="h-16 w-16 text-gray-400" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              No {dataType.toUpperCase()} Trade Data Available
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please upload {dataType} trade data using the Data Upload section.
            </p>
          </div>
        ) : (
          <div className="card-bw overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Trade Data Table</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {filteredTrades.length.toLocaleString()} trades with enrichment status
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {dataType === "equity"
                      ? [
                          "Trade ID",
                          "Date",
                          "Symbol",
                          "ISIN",
                          "Client",
                          "KYC Status",
                          "Ref Data",
                          "Confirmation",
                          "Actions",
                        ].map((h) => (
                          <th key={h} className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                            {h}
                          </th>
                        ))
                      : [
                          "Trade ID",
                          "Date",
                          "Currency Pair",
                          "Buy/Sell",
                          "Notional Amount",
                          "FX Rate",
                          "Counterparty",
                          "Settlement Status",
                          "Actions",
                        ].map((h) => (
                          <th key={h} className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                            {h}
                          </th>
                        ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {currentTrades.map((trade) => (
                    <tr key={trade.tradeId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-3 text-gray-900 dark:text-gray-100 font-mono text-sm">{trade.tradeId}</td>
                      <td className="p-3 text-gray-900 dark:text-gray-100 text-sm">{trade.tradeDate}</td>

                      {dataType === "equity" ? (
                        <>
                          <td className="p-3 text-gray-900 dark:text-gray-100 font-semibold">{trade.symbol}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100 font-mono text-xs">{trade.isin}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{trade.clientId}</td>
                          <td className="p-3">
                            <Badge variant={trade.kycStatus === "Passed" ? "default" : "destructive"}>
                              {trade.kycStatus || "Unknown"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={trade.referenceDataValidated === "Yes" ? "default" : "destructive"}>
                              {trade.referenceDataValidated || "No"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={trade.confirmationStatus === "Confirmed" ? "default" : "destructive"}>
                              {trade.confirmationStatus || "Pending"}
                            </Badge>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 text-gray-900 dark:text-gray-100 font-semibold">{trade.currencyPair}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{trade.buySell}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">
                            {safeToLocaleString(trade.notionalAmount)}
                          </td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{trade.fxRate}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{trade.counterparty}</td>
                          <td className="p-3">
                            <Badge variant={trade.settlementStatus === "Settled" ? "default" : "destructive"}>
                              {trade.settlementStatus || "Pending"}
                            </Badge>
                          </td>
                        </>
                      )}

                      <td className="p-3">
                        <button onClick={() => setSel(trade)} className="btn-primary text-sm">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-8 py-4 bg-gray-50 dark:bg-gray-700 text-center border-t border-gray-200 dark:border-gray-600">
                <div className="flex justify-center items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {sel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 shadow-lg rounded-md max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Trade Details: {sel.tradeId}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {dataType === "equity" ? (
                <>
                  <div>
                    <span className="font-medium">Symbol:</span> {sel.symbol || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">ISIN:</span> {sel.isin || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Trade Type:</span> {sel.tradeType || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Quantity:</span> {safeToLocaleString(sel.quantity)}
                  </div>
                  <div>
                    <span className="font-medium">Price:</span> {safeToCurrency(sel.price)}
                  </div>
                  <div>
                    <span className="font-medium">Trade Value:</span> {safeToCurrency(sel.tradeValue)}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="font-medium">Currency Pair:</span> {sel.currencyPair || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Buy/Sell:</span> {sel.buySell || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Base Currency:</span> {sel.baseCurrency || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Term Currency:</span> {sel.termCurrency || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Notional Amount:</span> {safeToCurrency(sel.notionalAmount)}
                  </div>
                  <div>
                    <span className="font-medium">FX Rate:</span> {sel.fxRate || "N/A"}
                  </div>
                </>
              )}
              <div>
                <span className="font-medium">Currency:</span> {sel.currency || sel.baseCurrency || "N/A"}
              </div>
              <div>
                <span className="font-medium">Counterparty:</span> {sel.counterparty || "N/A"}
              </div>
              <div>
                <span className="font-medium">Trading Venue:</span> {sel.tradingVenue || sel.executionVenue || "N/A"}
              </div>
              <div>
                <span className="font-medium">Settlement Status:</span> {sel.settlementStatus || "N/A"}
              </div>
            </div>
            <button
              onClick={() => setSel(null)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 mt-4"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Update ClearingAllocationPage with similar styling
function ClearingAllocationPage({ trades, dataType }: { trades: TradeData[]; dataType: "equity" | "fx" }) {
  const [sel, setSel] = useState<TradeData | null>(null)

  // Filter trades based on data type
  const filteredTrades = trades.filter(
    (trade) =>
      trade.dataSource === dataType ||
      (dataType === "equity" && (trade.symbol || trade.isin)) ||
      (dataType === "fx" && (trade.currencyPair || trade.baseCurrency)),
  )

  // Group trades by settlement status for summary cards
  const statusCounts = filteredTrades.reduce(
    (acc, trade) => {
      const status = trade.settlementStatus || "Pending"
      acc[status] = (acc[status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Salesforce-inspired Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-black rounded-xl">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Clearing & Settlement - {dataType === "equity" ? "Equity" : "FX"} View
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Monitor clearing and settlement processes across all trades
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-8">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="card-bw p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div
                  className={`p-2 rounded-lg ${
                    status === "Settled"
                      ? "bg-green-100 dark:bg-green-900"
                      : status === "Pending"
                        ? "bg-teal-100 dark:bg-teal-900"
                        : "bg-red-100 dark:bg-red-900"
                  }`}
                >
                  {status === "Settled" && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
                  {status === "Pending" && <AlertTriangle className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
                  {status === "Failed" && <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{status}</p>
              </div>
              <hr className="border-gray-200 dark:border-gray-600 mb-3" />
              <p className="text-lg font-bold text-gray-900 dark:text-white">{count}</p>
            </div>
          ))}
        </div>

        {filteredTrades.length === 0 ? (
          <div className="card-bw p-12 text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-6">
              <AlertTriangle className="h-16 w-16 text-gray-400" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              No {dataType.toUpperCase()} Trade Data Available
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please upload {dataType} trade data using the Data Upload section.
            </p>
          </div>
        ) : (
          <div className="card-bw overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Trade Data Table</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Displaying settlement details for {filteredTrades.length.toLocaleString()} trades
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {dataType === "equity"
                      ? [
                          "Trade ID",
                          "Settlement Date",
                          "Symbol",
                          "Counterparty",
                          "Venue",
                          "Margin Type",
                          "Margin Status",
                          "Status",
                          "Actions",
                        ].map((h) => (
                          <th key={h} className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                            {h}
                          </th>
                        ))
                      : [
                          "Trade ID",
                          "Settlement Date",
                          "Currency Pair",
                          "Counterparty",
                          "Notional Amount",
                          "Settlement Method",
                          "Status",
                          "Actions",
                        ].map((h) => (
                          <th key={h} className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                            {h}
                          </th>
                        ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTrades.slice(0, 50).map((trade) => (
                    <tr key={trade.tradeId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-3 text-gray-900 dark:text-gray-100 font-mono text-sm">{trade.tradeId}</td>
                      <td className="p-3 text-gray-900 dark:text-gray-100 text-sm">{trade.settlementDate}</td>

                      {dataType === "equity" ? (
                        <>
                          <td className="p-3 text-gray-900 dark:text-gray-100 font-semibold">{trade.symbol}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{trade.counterparty}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{trade.tradingVenue}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{trade.marginType || "Initial"}</td>
                          <td className="p-3">
                            <Badge variant={trade.marginStatus === "Satisfied" ? "default" : "secondary"}>
                              {trade.marginStatus || "Pending"}
                            </Badge>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 text-gray-900 dark:text-gray-100 font-semibold">{trade.currencyPair}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{trade.counterparty}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">
                            {safeToLocaleString(trade.notionalAmount)}
                          </td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">
                            {trade.settlementMethod || "Standard"}
                          </td>
                        </>
                      )}

                      <td className="p-3">
                        <Badge
                          variant={
                            !trade.settlementStatus
                              ? "outline"
                              : trade.settlementStatus === "Settled"
                                ? "default"
                                : trade.settlementStatus === "Pending"
                                  ? "secondary"
                                  : "destructive"
                          }
                        >
                          {trade.settlementStatus || "Pending"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <button onClick={() => setSel(trade)} className="btn-primary text-sm">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {sel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 shadow-lg rounded-md max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Settlement Details: {sel.tradeId}
            </h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Settlement Date:</span> {sel.settlementDate || "N/A"}
              </div>
              {dataType === "equity" ? (
                <>
                  <div>
                    <span className="font-medium">Symbol:</span> {sel.symbol || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Margin Required:</span> {safeToCurrency(sel.collateralRequired)}
                  </div>
                  <div>
                    <span className="font-medium">Margin Type:</span> {sel.marginType || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Margin Status:</span> {sel.marginStatus || "N/A"}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="font-medium">Currency Pair:</span> {sel.currencyPair || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Settlement Method:</span> {sel.settlementMethod || "Standard"}
                  </div>
                  <div>
                    <span className="font-medium">Notional Amount:</span> {safeToCurrency(sel.notionalAmount)}
                  </div>
                </>
              )}
              <div>
                <span className="font-medium">Counterparty:</span> {sel.counterparty || "N/A"}
              </div>
              <div>
                <span className="font-medium">Status:</span> {sel.settlementStatus || "N/A"}
              </div>
            </div>
            <button
              onClick={() => setSel(null)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 mt-4"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Update MonitoringExceptionsPage with similar styling
function MonitoringExceptionsPage({ trades, dataType }: { trades: TradeData[]; dataType: "equity" | "fx" }) {
  const [selectedTrade, setSelectedTrade] = useState<TradeData | null>(null)
  const [showResolutionModal, setShowResolutionModal] = useState(false)

  // Filter trades with issues based on data type
  const filteredTrades = trades.filter(
    (trade) =>
      trade.dataSource === dataType ||
      (dataType === "equity" && (trade.symbol || trade.isin)) ||
      (dataType === "fx" && (trade.currencyPair || trade.baseCurrency)),
  )

  const exceptions = filteredTrades.filter(
    (trade) =>
      trade.kycStatus === "Failed" ||
      trade.confirmationStatus === "Failed" ||
      trade.referenceDataValidated === "No" ||
      trade.settlementStatus === "Failed",
  )

  const handleResolve = (trade: TradeData) => {
    setSelectedTrade(trade)
    setShowResolutionModal(true)
  }

  const getIssueTypes = (trade: TradeData): string[] => {
    const issues = []
    if (trade.kycStatus === "Failed" || trade.kycCheck === "Incomplete") issues.push("kyc_failed")
    if (trade.confirmationStatus === "Failed") issues.push("confirmation_failed")
    if (trade.referenceDataValidated === "No") issues.push("reference_data_invalid")
    if (trade.settlementStatus === "Failed") issues.push("settlement_failed")
    return issues
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Salesforce-inspired Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-black rounded-xl">
                <AlertTriangle className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Monitoring & Exceptions - {dataType === "equity" ? "Equity" : "FX"} View
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Monitor trade exceptions and resolve issues efficiently
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600">{exceptions.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Active Issues</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-8">
        {filteredTrades.length === 0 ? (
          <div className="card-bw p-12 text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-6">
              <AlertTriangle className="h-16 w-16 text-gray-400" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              No {dataType.toUpperCase()} Trade Data Available
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please upload {dataType} trade data using the Data Upload section.
            </p>
          </div>
        ) : (
          <div className="card-bw overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Trade Exceptions</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {exceptions.length} trade exceptions require attention
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {[
                      "Trade ID",
                      "Date",
                      dataType === "equity" ? "Symbol" : "Currency Pair",
                      "Issue Type",
                      dataType === "equity" ? "Client" : "Counterparty",
                      "Status",
                      dataType === "equity" ? "Trader" : "Trader ID",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {exceptions.map((trade) => {
                    const issueType = []
                    if (trade.kycStatus === "Failed" || trade.kycCheck === "Incomplete") issueType.push("KYC Failed")
                    if (trade.confirmationStatus === "Failed") issueType.push("Confirmation Failed")
                    if (trade.referenceDataValidated === "No") issueType.push("Ref Data Invalid")
                    if (trade.settlementStatus === "Failed") issueType.push("Settlement Failed")

                    return (
                      <tr key={trade.tradeId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="p-3 text-gray-900 dark:text-gray-100 font-mono text-sm">{trade.tradeId}</td>
                        <td className="p-3 text-gray-900 dark:text-gray-100 text-sm">{trade.tradeDate}</td>
                        <td className="p-3 text-gray-900 dark:text-gray-100 font-semibold">
                          {dataType === "equity" ? trade.symbol : trade.currencyPair}
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {issueType.map((issue, idx) => (
                              <Badge key={idx} variant="destructive">
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-gray-900 dark:text-gray-100">
                          {dataType === "equity" ? trade.clientId : trade.counterparty}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className="bg-teal-500 text-white">
                            Open
                          </Badge>
                        </td>
                        <td className="p-3 text-gray-900 dark:text-gray-100">
                          {dataType === "equity" ? trade.traderName : trade.traderId}
                        </td>
                        <td className="p-3">
                          <button onClick={() => handleResolve(trade)} className="btn-primary text-sm">
                            Resolve
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Issue Resolution Modal */}
        <IssueResolutionModal
          isOpen={showResolutionModal}
          onClose={() => {
            setShowResolutionModal(false)
            setSelectedTrade(null)
          }}
          trade={selectedTrade}
          issueTypes={selectedTrade ? getIssueTypes(selectedTrade) : []}
        />
      </div>
    </div>
  )
}

// Update CostAllocationBillingPage with similar styling
function CostAllocationBillingPage({ trades, dataType }: { trades: TradeData[]; dataType: "equity" | "fx" }) {
  // Filter trades based on data type
  const filteredTrades = trades.filter(
    (trade) =>
      trade.dataSource === dataType ||
      (dataType === "equity" && (trade.symbol || trade.isin)) ||
      (dataType === "fx" && (trade.currencyPair || trade.baseCurrency)),
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Salesforce-inspired Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-black rounded-xl">
                <CreditCard className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Cost Allocation & Billing - {dataType === "equity" ? "Equity" : "FX"} View
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Allocate costs and manage billing across all trading activities
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-8">
        {filteredTrades.length === 0 ? (
          <div className="card-bw p-12 text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-6">
              <AlertTriangle className="h-16 w-16 text-gray-400" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              No {dataType.toUpperCase()} Trade Data Available
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please upload {dataType} trade data using the Data Upload section.
            </p>
          </div>
        ) : (
          <div className="card-bw overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Cost and Billing Data</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Review cost allocation and billing details for {filteredTrades.length.toLocaleString()} trades
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {dataType === "equity"
                      ? [
                          "Trade ID",
                          "Date",
                          "Symbol",
                          "Client",
                          "Commission",
                          "Taxes",
                          "Market Impact",
                          "Total Cost",
                          "Net Amount",
                          "Status",
                          "Actions",
                        ].map((h) => (
                          <th key={h} className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                            {h}
                          </th>
                        ))
                      : [
                          "Trade ID",
                          "Date",
                          "Currency Pair",
                          "Counterparty",
                          "Commission",
                          "Brokerage Fee",
                          "Settlement Cost",
                          "FX Gain/Loss",
                          "PnL",
                          "Status",
                          "Actions",
                        ].map((h) => (
                          <th key={h} className="p-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                            {h}
                          </th>
                        ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTrades.slice(0, 50).map((trade) => (
                    <tr key={trade.tradeId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-3 text-gray-900 dark:text-gray-100 font-mono text-sm">
                        {trade.tradeId || "N/A"}
                      </td>
                      <td className="p-3 text-gray-900 dark:text-gray-100 text-sm">{trade.tradeDate || "N/A"}</td>

                      {dataType === "equity" ? (
                        <>
                          <td className="p-3 text-gray-900 dark:text-gray-100 font-semibold">
                            {trade.symbol || "N/A"}
                          </td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{trade.clientId || "N/A"}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{safeToCurrency(trade.commission)}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{safeToCurrency(trade.taxes)}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">
                            {safeToCurrency(trade.marketImpactCost)}
                          </td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{safeToCurrency(trade.totalCost)}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{safeToCurrency(trade.netAmount)}</td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 text-gray-900 dark:text-gray-100 font-semibold">
                            {trade.currencyPair || "N/A"}
                          </td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{trade.counterparty || "N/A"}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">
                            {safeToCurrency(trade.commissionAmount || trade.commission)}
                          </td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{safeToCurrency(trade.brokerageFee)}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">
                            {safeToCurrency(trade.settlementCost)}
                          </td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{safeToCurrency(trade.fxGainLoss)}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">
                            {safeToCurrency(trade.pnlCalculated)}
                          </td>
                        </>
                      )}

                      <td className="p-3">
                        <Badge variant={trade.settlementStatus === "Settled" ? "default" : "secondary"}>
                          {trade.costAllocationStatus ||
                            (trade.settlementStatus === "Settled" ? "Allocated" : "Pending")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <button className="btn-primary text-sm">Allocate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// DataUploadPage component
function DataUploadPage({
  onDataLoaded,
}: { onDataLoaded: (data: TradeData[], rawData: any[], dataType: "equity" | "fx") => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ExcelUpload
        onDataLoaded={(data, rawData) => {
          // Detect data type from the first trade
          const detectedType =
            data.length > 0 && data[0].dataSource
              ? (data[0].dataSource as "equity" | "fx")
              : data.length > 0 && data[0].currencyPair
                ? "fx"
                : "equity"

          console.log(`DataUploadPage detected type: ${detectedType}`)
          onDataLoaded(data, rawData, detectedType)
        }}
      />
    </div>
  )
}

// Update the main app header styling
export default function CMTAApp() {
  const [page, setPage] = useState("Data Upload")
  const [trades, setTrades] = useState<TradeData[]>([])
  const [rawData, setRawData] = useState<any[]>([])
  const [summaryMetrics, setSummaryMetrics] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<"csv" | "excel">("csv")
  const [dataType, setDataType] = useState<"equity" | "fx">("equity")
  const [showAIPanel, setShowAIPanel] = useState(false)

  const topMenu = [
    "Data Upload",
    "Home",
    "Agreement Management",
    "Trade Capture & Execution",
    "Clearing Allocation",
    "Monitoring",
    "Cost Allocation",
  ]

  const sidebarMenu = [
    "Captured from CMS",
    "Commission Management",
    "Brokerage Management",
    "Agent Billing",
    "Interest Claims",
    "Clearing Member Trading Agreement",
    "Forward to Settlements",
  ]

  const initializeData = async () => {
    if (trades.length === 0 && !loading) {
      setLoading(true)
      try {
        const tradeData = await fetchTradeData()
        setTrades(tradeData)
        setRawData(tradeData)
        setSummaryMetrics(calculateSummaryMetrics(tradeData))
      } catch (error) {
        console.error("Failed to load trade data:", error)
      } finally {
        setLoading(false)
      }
    }
  }

  // Call this only once when component mounts
  useEffect(() => {
    initializeData()
  }, []) // Empty dependency array to run only once

  const handleExcelDataLoaded = (data: TradeData[], rawDataInput: any[], detectedType: "equity" | "fx") => {
    console.log(`Received ${data.length} trades with type ${detectedType}`)
    setDataType(detectedType)
    setTrades(data)
    setRawData(rawDataInput)
    setSummaryMetrics(calculateSummaryMetrics(data))
    setDataSource("excel")
    setPage("Home")
  }

  const handleDataTypeChange = (type: "equity" | "fx") => {
    console.log(`Changing data type to ${type}`)
    setDataType(type)
  }

  const renderPage = () => {
    if (loading) {
      return <LoadingSpinner />
    }

    switch (page) {
      case "Home":
        return <CMTAHomepage trades={trades} />
      case "Data Upload":
        return <DataUploadPage onDataLoaded={handleExcelDataLoaded} />
      case "Agreement Management":
        return <AgreementManagement trades={trades} dataType={dataType} />
      case "Trade Capture & Execution":
        return <TradeEnrichmentPage trades={trades} dataType={dataType} />
      case "Clearing Allocation":
        return <ClearingAllocationPage trades={trades} dataType={dataType} />
      case "Monitoring":
        return <MonitoringExceptionsPage trades={trades} dataType={dataType} />
      case "Cost Allocation":
        return <CostAllocationBillingPage trades={trades} dataType={dataType} />
      default:
        return <div className="p-8 text-center text-gray-500">Page not found</div>
    }
  }

  const [activeSidebarSection, setActiveSidebarSection] = useState("Interest Claims")

  const renderSidebarContent = () => {
    switch (activeSidebarSection) {
      case "Captured from CMS":
        return <CapturedFromCMS />
      case "Brokerage Management":
        return <BrokerageManagement />
      case "Commission Management":
        return <CommissionManagement />
      case "Agent Billing":
        return <AgentBilling />
      case "Interest Claims":
        return <InterestClaims />
      case "Clearing Member Trading Agreement":
        return renderPage()
      case "Forward to Settlements":
        return <ForwardToSettlements />
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8">
              <h3 className="text-xl font-semibold mb-2">{activeSidebarSection}</h3>
              <p className="text-gray-500">This section is under development.</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeSidebarSection}</h2>
            </div>

            {activeSidebarSection === "Clearing Member Trading Agreement" && (
              <nav className="flex space-x-1">
                {topMenu.map((item) => (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      page === item
                        ? "bg-black text-white shadow-sm"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {item === "Data Upload" && <Upload size={14} className="inline mr-1" />}
                    {item}
                  </button>
                ))}
              </nav>
            )}

            <div className="flex items-center gap-2">
              {activeSidebarSection !== "Clearing Member Trading Agreement" && (
                <div className="text-sm text-gray-500">Navigation options for {activeSidebarSection}</div>
              )}

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* AI Assistant Toggle */}
              <Button
                onClick={() => setShowAIPanel(!showAIPanel)}
                variant={showAIPanel ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-2"
              >
                <Bot className="h-4 w-4" />
                AI Assistant
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-gray-800 dark:bg-gray-950 overflow-y-auto p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Cost Management</h3>
          <nav className="space-y-2">
            {sidebarMenu.map((item) => (
              <button
                key={item}
                onClick={() => setActiveSidebarSection(item)}
                className={`w-full text-left py-2 px-3 rounded-md transition ${
                  activeSidebarSection === item
                    ? "bg-black text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          {activeSidebarSection === "Clearing Member Trading Agreement" && !loading && trades.length > 0 && (
            <div className="mt-8 p-4 bg-gray-700 dark:bg-gray-800 rounded-md">
              <h3 className="text-white font-semibold mb-2">Data Summary</h3>
              <div className="text-sm text-gray-300 space-y-1">
                <div>Total Trades: {trades.length.toLocaleString()}</div>
                <div>Data Type: {dataType.toUpperCase()}</div>
                <div className="text-xs text-gray-400 mt-2">Source: {dataSource.toUpperCase()}</div>
              </div>
            </div>
          )}

          {activeSidebarSection === "Clearing Member Trading Agreement" && (
            <div className="mt-8 p-4 bg-gray-700 dark:bg-gray-800 rounded-md">
              <h3 className="text-white font-semibold mb-2">Data Type</h3>
              <div className="flex flex-col space-y-2 mt-2">
                <button
                  onClick={() => handleDataTypeChange("equity")}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition flex items-center ${
                    dataType === "equity" ? "bg-black text-white" : "bg-gray-600 text-white hover:bg-gray-500"
                  }`}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Equity
                </button>
                <button
                  onClick={() => handleDataTypeChange("fx")}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition flex items-center ${
                    dataType === "fx" ? "bg-black text-white" : "bg-gray-600 text-white hover:bg-gray-500"
                  }`}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  FX
                </button>
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 flex overflow-hidden">
          <section className="flex-1 overflow-auto">{renderSidebarContent()}</section>

          {/* AI Assistant Panel */}
          {showAIPanel && (
            <AIAssistantPanel
              trades={trades}
              dataType={dataType}
              currentSection={
                activeSidebarSection === "Clearing Member Trading Agreement" ? page : activeSidebarSection
              }
              sectionData={{
                page,
                activeSidebarSection,
                summaryMetrics,
                rawData,
              }}
            />
          )}
        </main>
      </div>
    </div>
  )
}
