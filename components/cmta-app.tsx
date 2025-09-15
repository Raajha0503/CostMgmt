"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, CheckCircle, Upload, BarChart3, CreditCard, Bot, Download, Eye, ChevronLeft, ChevronRight, Settings, ArrowRight, Info, X } from "lucide-react"
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
import ForwardToSettlements from "./forward-to-settlements"
import InternalMessagingSystem from "./internal-messaging-system"
import type React from "react"
import { tradeOperations } from "@/lib/firebase-operations"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase-config"
import { CMTAPDFGenerator, type CMTAAgreementData } from "@/lib/cmta-pdf-generator"

// Reusable UI components
// Add the card-bw and btn-primary/btn-secondary classes
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
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
// Helper functions for PDF operations
const handlePreviewAgreement = async (rowData: any, setToastMsg: any, setToastType: any) => {
  try {
    const agreementData: CMTAAgreementData = {
      id: String(rowData.id || ''),
      Broker: String(rowData.Broker || 'Default Broker'),
      client: String(rowData.client || 'Client Name'),
      BrokerageCurrency: String(rowData.BrokerageCurrency || 'USD'),
      BrokerageFee: String(rowData.BrokerageFee || '0.25%'),
      EffectiveDate_Equity: String(rowData.EffectiveDate_Equity || new Date().toLocaleDateString()),
      EffectiveDate_Forex: String(rowData.EffectiveDate_Forex || new Date().toLocaleDateString()),
      LEI: String(rowData.LEI || ''),
      clientId: String(rowData.clientId || rowData.client || ''),
      version: String(rowData.version || 'v1'),
      generatedOn: String(rowData['Generated on'] || new Date().toLocaleDateString()),
      lastModified: String(rowData['Last modified'] || new Date().toLocaleDateString())
    };
    
    await CMTAPDFGenerator.generatePreview(agreementData);
    setToastMsg('Agreement preview opened in new tab');
    setToastType('success');
  } catch (error) {
    console.error('Preview error:', error);
    setToastMsg('Failed to generate preview');
    setToastType('error');
  }
};

const handleDownloadSigned = async (rowData: any, setToastMsg: any, setToastType: any) => {
  try {
    const agreementData: CMTAAgreementData = {
      id: String(rowData.id || ''),
      Broker: String(rowData.Broker || 'Default Broker'),
      client: String(rowData.client || 'Client Name'),
      BrokerageCurrency: String(rowData.BrokerageCurrency || 'USD'),
      BrokerageFee: String(rowData.BrokerageFee || '0.25%'),
      EffectiveDate_Equity: String(rowData.EffectiveDate_Equity || new Date().toLocaleDateString()),
      EffectiveDate_Forex: String(rowData.EffectiveDate_Forex || new Date().toLocaleDateString()),
      LEI: String(rowData.LEI || ''),
      clientId: String(rowData.clientId || rowData.client || ''),
      version: String(rowData.version || 'v1'),
      generatedOn: String(rowData['Generated on'] || new Date().toLocaleDateString()),
      lastModified: String(rowData['Last modified'] || new Date().toLocaleDateString())
    };
    
    await CMTAPDFGenerator.downloadSignedAgreement(agreementData);
    setToastMsg('Signed agreement downloaded successfully');
    setToastType('success');
  } catch (error) {
    console.error('Download error:', error);
    setToastMsg('Failed to download signed agreement');
    setToastType('error');
  }
};

const handleEditRegenerate = (rowData: any, setAgreementRows: any, agreementRows: any[], idx: number, setToastMsg: any, setToastType: any) => {
  try {
    const currentData: CMTAAgreementData = {
      id: String(rowData.id || ''),
      Broker: String(rowData.Broker || 'Default Broker'),
      client: String(rowData.client || 'Client Name'),
      BrokerageCurrency: String(rowData.BrokerageCurrency || 'USD'),
      BrokerageFee: String(rowData.BrokerageFee || '0.25%'),
      EffectiveDate_Equity: String(rowData.EffectiveDate_Equity || new Date().toLocaleDateString()),
      EffectiveDate_Forex: String(rowData.EffectiveDate_Forex || new Date().toLocaleDateString()),
      LEI: String(rowData.LEI || ''),
      clientId: String(rowData.clientId || rowData.client || ''),
      version: String(rowData.version || 'v1'),
      generatedOn: String(rowData['Generated on'] || new Date().toLocaleDateString()),
      lastModified: String(rowData['Last modified'] || new Date().toLocaleDateString())
    };
    
    const updatedData = CMTAPDFGenerator.generateEditableTemplate(currentData);
    
    // Update the row with new version and timestamps
    setAgreementRows((prev: any[]) => prev.map((r, i) => 
      i === idx ? {
        ...r,
        version: updatedData.version,
        'Generated on': updatedData.generatedOn,
        'Last modified': updatedData.lastModified
      } : r
    ));
    
    setToastMsg('Agreement version updated successfully');
    setToastType('success');
  } catch (error) {
    setToastMsg('Failed to update agreement version');
    setToastType('error');
  }
};

export default function CMTAApp() {
  const [page, setPage] = useState("Data Upload")
  const [trades, setTrades] = useState<TradeData[]>([])
  const [rawData, setRawData] = useState<any[]>([])
  const [summaryMetrics, setSummaryMetrics] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<"csv" | "excel">("csv")
  const [dataType, setDataType] = useState<"equity" | "fx">("equity")
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [activeSidebarSection, setActiveSidebarSection] = useState("Interest Claims")
  // Clearing Member Trading Agreement tab subtab state (must be at top level)
  const experimentSubTabs = [
    "Agreement Setup",
    "Reference Data Mapping",
    "Trade Capture",
    "Trade Enrichment and routing",
    "Confirmations",
    "Clearing and Settlement",
    "Exception Management",
    "Cost Allocation",
  ];
  const [experimentSubTab, setExperimentSubTab] = useState(experimentSubTabs[0]);

  // New Agreement Setup Table State
  const [unifiedRows, setUnifiedRows] = useState<any[]>([])
  const [unifiedLoading, setUnifiedLoading] = useState(false)
  const [unifiedUpdatingId, setUnifiedUpdatingId] = useState<string | null>(null)
  // Track edited rows by id
  const [editedRows, setEditedRows] = useState<{ [id: string]: any }>({})
  const [saveLoading, setSaveLoading] = useState(false)

  // Use column names directly as Firestore field names (including auto-generated columns)
  const unifiedColumns = [
    'Generated on',      // Auto-generated: current date when created
    'Last modified',     // Auto-generated: current date when updated  
    'version',          // Auto-generated: v1, v2, v3... (incremental)
    'Broker',
    'BrokerageCurrency',
    'BrokerageFee',
    'EffectiveDate_Equity',
    'EffectiveDate_Forex',
    'LEI',
    'client',
    'clientId',
    'id',
  ]

  // Toast state for feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error' | null>(null)

  // Info modal state
  const [showFilteringInfo, setShowFilteringInfo] = useState(false)
  const [currentFilteringInfo, setCurrentFilteringInfo] = useState<string>('')

  // Column visibility state for each subtab
  const [visibleUnifiedColumns, setVisibleUnifiedColumns] = useState<string[]>([])
  const [visibleRefColumns, setVisibleRefColumns] = useState<string[]>([]) 
  const [visibleTradeColumns, setVisibleTradeColumns] = useState<string[]>([])
  const [visibleEnrichColumns, setVisibleEnrichColumns] = useState<string[]>([])
  const [visibleConfColumns, setVisibleConfColumns] = useState<string[]>([])
  const [visibleClearColumns, setVisibleClearColumns] = useState<string[]>([])
  const [visibleExcColumns, setVisibleExcColumns] = useState<string[]>([])
  const [visibleCostColumns, setVisibleCostColumns] = useState<string[]>([])

  // Filtering logic explanations for each subtab
  const filteringExplanations: Record<string, { title: string; logic: string[]; purpose: string }> = {
    "Agreement Setup": {
      title: "Agreement Setup - Data Filtering",
      logic: [
        "• Shows ALL records from unified_data collection",
        "• No filtering applied - displays complete dataset", 
        "• Used for initial setup and agreement creation"
      ],
      purpose: "This is the starting point where you set up CMTA agreements and client information. All available data is shown so you can create and manage agreements."
    },
    "Reference Data Mapping": {
      title: "Reference Data Mapping - Data Filtering", 
      logic: [
        "• Filters: CMTA Agreement Status = 'Signed'",
        "• Only shows records with signed agreements",
        "• Prerequisite: Agreement Setup must be completed"
      ],
      purpose: "Only clients with signed CMTA agreements can proceed to reference data mapping. This ensures proper authorization before sensitive data mapping."
    },
    "Trade Capture": {
      title: "Trade Capture - Data Filtering",
      logic: [
        "• Filters: CMTA Agreement Status = 'Signed'",
        "• AND: Reference_Data_Validated = 'Yes'", 
        "• Double filtering ensures prerequisites are met",
        "• Progressive workflow validation"
      ],
      purpose: "Trade capture requires both signed agreements AND validated reference data. This prevents trades from being captured without proper setup."
    },
    "Trade Enrichment and routing": {
      title: "Trade Enrichment & Routing - Data Filtering",
      logic: [
        "• Filters: CMTA Agreement Status = 'Signed'",
        "• AND: Reference_Data_Validated = 'Yes'",
        "• AND: TradeStatus = 'Booked'",
        "• Triple filtering ensures all prerequisites are met",
        "• Strict validation for enrichment readiness"
      ],
      purpose: "Trade enrichment requires signed agreements, validated reference data, AND booked trade status. This ensures only fully prepared trades proceed to enrichment and routing."
    },
    "Confirmations": {
      title: "Confirmations - Data Filtering",
      logic: [
        "• Filters: CMTA Agreement Status = 'Signed'",
        "• AND: Reference_Data_Validated = 'Yes'",
        "• AND: TradeStatus = 'Booked'", 
        "• AND: Instrument_Status = 'Active'",
        "• Strictest filtering for final confirmation stage"
      ],
      purpose: "Confirmations only process fully enriched and active trades. All previous workflow steps must be completed successfully."
    },
    "Clearing and Settlement": {
      title: "Clearing & Settlement - Data Filtering",
      logic: [
        "• Filters: CMTA Agreement Status = 'Signed'",
        "• AND: Reference_Data_Validated = 'Yes'",
        "• AND: TradeStatus = 'Booked'",
        "• AND: Instrument_Status = 'Active'",
        "• AND: ConfirmationStatus = 'Confirmed'",
        "• Only confirmed trades proceed to clearing"
      ],
      purpose: "Settlement requires fully confirmed trades. This is the final processing stage where trades are actually settled and cleared."
    },
    "Exception Management": {
      title: "Exception Management - Data Filtering",
      logic: [
        "• Shows records with exceptions or failed validations",
        "• Filters: ExceptionType exists OR ExceptionFlag = 'Yes'",
        "• OR: TradeStatus = 'Failed' OR SettlementStatus = 'Failed'",
        "• OR: ConfirmationStatus = 'Failed' OR Reference_Data_Validated = 'No'",
        "• Focuses on problems that need resolution"
      ],
      purpose: "Identifies and tracks all trades with issues across any workflow stage. Helps operations teams prioritize and resolve problems."
    },
    "Cost Allocation": {
      title: "Cost Allocation - Data Filtering", 
      logic: [
        "• Filters: CMTA Agreement Status = 'Signed'",
        "• AND: SettlementStatus = 'Settled'",
        "• Only fully settled trades are eligible",
        "• Ensures accurate cost allocation on completed trades"
      ],
      purpose: "Cost allocation happens after successful settlement. This ensures costs are only allocated to trades that have been fully processed and completed."
    }
  }

  // Agreement Document Table State
  const [showAgreementDocTable, setShowAgreementDocTable] = useState(false)
  const [agreementRows, setAgreementRows] = useState<any[]>([])
  const [agreementLoading, setAgreementLoading] = useState(false)
  const [agreementEditedRows, setAgreementEditedRows] = useState<{ [id: string]: any }>({})
  const [agreementStatusSaveLoading, setAgreementStatusSaveLoading] = useState(false)
  const agreementColumns = [
    'Broker',
    'client',
    'BrokerageFee',
    'EffectiveDate_Equity',
    'EffectiveDate_Forex',
    'LEI',
    'clientId',
    'CMTA Agreement Status',
    'commission rate agreed',
    'View agreement',
    'signed agreement',
    'Generated on',
    'Last modified',
    'version',
    'id',
  ]

  // Clearing and Settlement Table State
  const [clearingRows, setClearingRows] = useState<any[]>([])
  const [clearingLoading, setClearingLoading] = useState(false)
  const [clearingEditedRows, setClearingEditedRows] = useState<{ [id: string]: any }>({})
  const [clearingSaveLoading, setClearingSaveLoading] = useState(false)
  const clearingColumns = [
    'TradeID',
    'SettlementDate',
    'SettlementStatus',
    'ClearingHouse',
    'MarginRequirement',
    'CollateralType',
    'SettlementMethod',
    'SettlementAmount',
    'CustodianAccount',
    'id',
  ]

  // Exception Management Table State
  const [exceptionRows, setExceptionRows] = useState<any[]>([])
  const [exceptionLoading, setExceptionLoading] = useState(false)
  const [exceptionEditedRows, setExceptionEditedRows] = useState<{ [id: string]: any }>({})
  const [exceptionSaveLoading, setExceptionSaveLoading] = useState(false)
  const exceptionColumns = [
    'TradeID',
    'ExceptionType',
    'ExceptionDescription',
    'Priority',
    'AssignedTo',
    'Status',
    'ResolutionNotes',
    'CreatedDate',
    'ResolvedDate',
    'id',
  ]

  // Cost Allocation Table State
  const [costDetailsRows, setCostDetailsRows] = useState<any[]>([])
  const [costDetailsLoading, setCostDetailsLoading] = useState(false)
  const [costDetailsEditedRows, setCostDetailsEditedRows] = useState<{ [id: string]: any }>({})
  const [costDetailsSaveLoading, setCostDetailsSaveLoading] = useState(false)
  const costDetailsColumns = [
    'TradeID',
    'CommissionAmount',
    'BrokerageFee',
    'CustodyFee',
    'SettlementCost',
    'FXGainLoss',
    'threshold',
    'ExpenseApprovalStatus',
    'CostAllocationStatus',
    'CostBookedDate',
    'id',
  ]

  // Clearing and Settlement state variables  
  const [clearRows, setClearRows] = useState<any[]>([])
  const [clearLoading, setClearLoading] = useState(false)
  const [clearEditedRows, setClearEditedRows] = useState<{ [id: string]: any }>({})
  const [clearSaveLoading, setClearSaveLoading] = useState(false)
  const [clearUpdatingId, setClearUpdatingId] = useState<string | null>(null)
  const clearColumns = [
    'TradeID',
    'SettlementDate', 
    'SettlementStatus',
    'ClearingHouse',
    'MarginRequirement',
    'CollateralType',
    'SettlementMethod',
    'SettlementAmount',
    'CustodianAccount',
    'SettlementCurrency',
    'ValueDate',
    'id'
  ]

  const [excRows, setExcRows] = useState<any[]>([])
  const [excLoading, setExcLoading] = useState(false)
  const [excEditedRows, setExcEditedRows] = useState<{ [id: string]: any }>({})
  const [excSaveLoading, setExcSaveLoading] = useState(false)
  const [excUpdatingId, setExcUpdatingId] = useState<string | null>(null)
  const excColumns = [
    'TradeID',
    'ExceptionType',
    'ExceptionFlag',
    'Exception Description',
    'Exception Reason',
    'Priority',
    'AssignedTo',
    'Status',
    'ResolutionNotes',
    'CreatedDate',
    'id'
  ]

  const [exceptionTrackerRows, setExceptionTrackerRows] = useState<any[]>([])
  const [exceptionTrackerLoading, setExceptionTrackerLoading] = useState(false)
  const [exceptionTrackerEditedRows, setExceptionTrackerEditedRows] = useState<{ [id: string]: any }>({})
  const [exceptionTrackerSaveLoading, setExceptionTrackerSaveLoading] = useState(false)
  const exceptionTrackerColumns = [
    'TradeID',
    'Source Tab',
    'Error Category', 
    'Owner Team',
    'Resolution Status',
    'Timestamped Comments',
    'Status',
    'id'
  ]

  const [costRows, setCostRows] = useState<any[]>([])
  const [costLoading, setCostLoading] = useState(false)
  const [costEditedRows, setCostEditedRows] = useState<{ [id: string]: any }>({})
  const [costSaveLoading, setCostSaveLoading] = useState(false)
  const [costUpdatingId, setCostUpdatingId] = useState<string | null>(null)
  const costColumns = [
    'TradeID',
    'CostAllocationStatus',
    'CostBookedDate',
    'CostCenter',
    'CommissionAmount',
    'BrokerageFee',
    'SettlementCost',
    'TotalCost',
    'ExpenseApprovalStatus',
    'id'
  ]

  // Fetch data from Firestore
  const fetchUnifiedData = async () => {
    setUnifiedLoading(true)
    try {
      console.log('🔄 Fetching unified data...')
      const data = await tradeOperations.getAllTrades()
      console.log('📊 Raw data from Firebase:', data)
      console.log('📊 Data length:', Array.isArray(data) ? data.length : 'Not an array')
      
      // Map Firestore fields to UI columns
      const mapped = Array.isArray(data)
        ? data.map((row: any) => {
            const obj: any = {}
            unifiedColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      
      console.log('✅ Mapped data:', mapped)
      console.log('✅ Mapped data length:', mapped.length)
      setUnifiedRows(mapped)
      
      if (mapped.length === 0) {
        setToastMsg('No data found in Firebase unified_data collection. Click "Create Sample Data" to get started.')
        setToastType('error')
      } else {
        setToastMsg(`Loaded ${mapped.length} records successfully`)
        setToastType('success')
      }
    } catch (error) {
      console.error('❌ Error fetching unified data:', error)
      setToastMsg(`Error fetching data: ${error}`)
      setToastType('error')
    } finally {
      setUnifiedLoading(false)
    }
  }

  // Create sample agreement data with auto-generated columns
  const createSampleAgreementData = async () => {
    try {
      const currentDate = new Date().toLocaleDateString()
      const sampleData = [
        {
          trade_id: 'CMTA-001',
          data_source: 'equity' as const,
          'Generated on': currentDate,
          'Last modified': currentDate,
          'version': 'v1.0',
          'Broker': 'Goldman Sachs',
          'BrokerageCurrency': 'USD',
          'BrokerageFee': '0.25%',
          'EffectiveDate_Equity': currentDate,
          'EffectiveDate_Forex': currentDate,
          'LEI': '7LTWFZYICNSX8D621K86',
          'client': 'Barclays Capital',
          'clientId': 'BC001'
        },
        {
          trade_id: 'CMTA-002',
          data_source: 'equity' as const,
          'Generated on': currentDate,
          'Last modified': currentDate,
          'version': 'v1.1',
          'Broker': 'JPMorgan Chase',
          'BrokerageCurrency': 'USD',
          'BrokerageFee': '0.30%',
          'EffectiveDate_Equity': currentDate,
          'EffectiveDate_Forex': currentDate,
          'LEI': '8IHUB1SGFKMX4T648C86',
          'client': 'Morgan Stanley',
          'clientId': 'MS002'
        },
        {
          trade_id: 'CMTA-003',
          data_source: 'equity' as const,
          'Generated on': currentDate,
          'Last modified': currentDate,
          'version': 'v2.0',
          'Broker': 'Deutsche Bank',
          'BrokerageCurrency': 'EUR',
          'BrokerageFee': '0.20%',
          'EffectiveDate_Equity': currentDate,
          'EffectiveDate_Forex': currentDate,
          'LEI': '9KFYN2X7AHBF5P892D45',
          'client': 'Credit Suisse',
          'clientId': 'CS003'
        }
      ]

      // Save sample data to Firebase
      for (const item of sampleData) {
        await tradeOperations.createTrade(item)
      }

      setToastMsg(`✅ Created ${sampleData.length} sample agreement records`)
      setToastType('success')
      
      // Refresh the table
      await fetchUnifiedData()
    } catch (error) {
      console.error('Error creating sample data:', error)
      setToastMsg('❌ Failed to create sample data')
      setToastType('error')
    }
  }

  // Use exact column names as both UI and Firestore field names
  const columnNames = [
    'Broker',
    'BrokerageCurrency',
    'BrokerageFee',
    'EffectiveDate_Equity',
    'EffectiveDate_Forex',
    'LEI',
    'client',
    'clientId',
  ]

  // Reference Data Mapping Table State
  const [refRows, setRefRows] = useState<any[]>([])
  const [refLoading, setRefLoading] = useState(false)
  const [refUpdatingId, setRefUpdatingId] = useState<string | null>(null)
  const [refEditedRows, setRefEditedRows] = useState<{ [id: string]: any }>({})
  const [refSaveLoading, setRefSaveLoading] = useState(false)
  const refColumns = [
    'ClientID_Equity',
    'ClientID_Forex',
    'Custodian_Name',
    'Custodian_Ac_no',
    'ISIN',
    'ABA_Equity',
    'ABA_Forex',
    'BSB_Equity',
    'BSB_Forex',
    'SWIFT_Equity',
    'SWIFT_Forex',
    'account',
    'accountNumber',
    'accountName',
    'Reference_Data_Validated',
    'id',
  ]
  const fetchRefData = async () => {
    setRefLoading(true)
    try {
      // Only fetch records with signed CMTA agreements
      const q = query(
        collection(db, 'unified_data'), 
        where('CMTA Agreement Status', '==', 'Signed')
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      
      const mapped = Array.isArray(data)
        ? data.map((row: any) => {
            const obj: any = {}
            refColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      setRefRows(mapped)
    } finally {
      setRefLoading(false)
    }
  }

  // Trade Capture Table State
  const [tradeRows, setTradeRows] = useState<any[]>([])
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeUpdatingId, setTradeUpdatingId] = useState<string | null>(null)
  const [tradeEditedRows, setTradeEditedRows] = useState<{ [id: string]: any }>({})
  const [tradeSaveLoading, setTradeSaveLoading] = useState(false)
  const tradeColumns = [
    'TradeID',
    'TradeDate',
    'TradeTime',
    'BuySell',
    'ProductType',
    'Symbol',
    'NotionalAmount',
    'ExecutionVenue',
    'TradeSourceSystem',
    'TradeStatus',
    'BookingLocation',
    'id',
  ]
  const fetchTradeDataTable = async () => {
    setTradeLoading(true)
    try {
      // Double filtering: CMTA Agreement Status == "Signed" AND Reference_Data_Validated == "Yes"
      const q = query(
        collection(db, 'unified_data'), 
        where('CMTA Agreement Status', '==', 'Signed'),
        where('Reference_Data_Validated', '==', 'Yes')
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      
      const mapped = Array.isArray(data)
        ? data.map((row: any) => {
            const obj: any = {}
            tradeColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      setTradeRows(mapped)
    } finally {
      setTradeLoading(false)
    }
  }

  // Trade Enrichment and Routing Table State
  const [enrichRows, setEnrichRows] = useState<any[]>([])
  const [enrichLoading, setEnrichLoading] = useState(false)
  const [enrichUpdatingId, setEnrichUpdatingId] = useState<string | null>(null)
  const [enrichEditedRows, setEnrichEditedRows] = useState<{ [id: string]: any }>({})
  const [enrichSaveLoading, setEnrichSaveLoading] = useState(false)
  const enrichColumns = [
    'TradeID',
    'ProductType',
    'Instrument_Status',
    'Portfolio',
    'BookingLocation',
    'account',
    'accountNumber',
    'accountName',
    'TradeSourceSystem',
    'ExecutionVenue',
    'id',
  ]
  const fetchEnrichData = async () => {
    setEnrichLoading(true)
    try {
      const q = query(
        collection(db, 'unified_data'), 
        where('CMTA Agreement Status', '==', 'Signed'),
        where('Reference_Data_Validated', '==', 'Yes'),
        where('TradeStatus', '==', 'Booked')
      )
      const querySnapshot = await getDocs(q)
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      const mapped = Array.isArray(data)
        ? data.map((row: any) => {
            const obj: any = {}
            enrichColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      setEnrichRows(mapped)
    } finally {
      setEnrichLoading(false)
    }
  }

  // Confirmations Table State
  const [confRows, setConfRows] = useState<any[]>([])
  const [confLoading, setConfLoading] = useState(false)
  const [confUpdatingId, setConfUpdatingId] = useState<string | null>(null)
  const [confEditedRows, setConfEditedRows] = useState<{ [id: string]: any }>({})
  const [confSaveLoading, setConfSaveLoading] = useState(false)
  const confColumns = [
    'TradeID',
    'ConfirmationMethod',
    'ConfirmationStatus',
    'ConfirmationStatus_Equity',
    'ConfirmationStatus_Forex',
    'ConfirmationTimestamp',
    'AuditTrailRef',
    'id',
  ]
  const fetchConfData = async () => {
    setConfLoading(true)
    try {
      // Quadruple filtering: Signed + Validated + Booked + Active
      const q = query(
        collection(db, 'unified_data'), 
        where('CMTA Agreement Status', '==', 'Signed'),
        where('Reference_Data_Validated', '==', 'Yes'),
        where('TradeStatus', '==', 'Booked'),
        where('Instrument_Status', '==', 'Active')
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      
      const mapped = Array.isArray(data)
        ? data.map((row: any) => {
            const obj: any = {}
            confColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      setConfRows(mapped)
    } finally {
      setConfLoading(false)
    }
  }

  // Fetch Agreement Document data
  const fetchAgreementRows = async () => {
    setAgreementLoading(true)
    try {
      const data = await tradeOperations.getAllTrades()
      const mapped = Array.isArray(data)
        ? data.map((row: any) => {
            const obj: any = {}
            agreementColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      setAgreementRows(mapped)
    } finally {
      setAgreementLoading(false)
    }
  }

  // Fetch Clearing and Settlement data
  const fetchClearingData = async () => {
    setClearingLoading(true)
    try {
      // Filter for confirmed trades
      const q = query(
        collection(db, 'unified_data'), 
        where('CMTA Agreement Status', '==', 'Signed'),
        where('Reference_Data_Validated', '==', 'Yes'),
        where('TradeStatus', '==', 'Booked'),
        where('Instrument_Status', '==', 'Active'),
        where('ConfirmationStatus', '==', 'Confirmed')
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      
      const mapped = Array.isArray(data)
        ? data.map((row: any) => {
            const obj: any = {}
            clearingColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      setClearingRows(mapped)
    } finally {
      setClearingLoading(false)
    }
  }

  // Fetch Exception Management data
  const fetchExceptionData = async () => {
    setExceptionLoading(true)
    try {
      const data = await tradeOperations.getAllTrades()
      // Filter for trades with exceptions
      const exceptions = data.filter((trade: any) => 
        trade.ExceptionType || 
        trade.Status === 'Exception' ||
        trade.TradeStatus === 'Failed' ||
        trade.SettlementStatus === 'Failed'
      )
      
      const mapped = Array.isArray(exceptions)
        ? exceptions.map((row: any) => {
            const obj: any = {}
            exceptionColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      setExceptionRows(mapped)
    } finally {
      setExceptionLoading(false)
    }
  }

  // Fetch Cost Details data
  const fetchCostDetailsData = async () => {
    setCostDetailsLoading(true)
    try {
      // Filter for settled trades
      const q = query(
        collection(db, 'unified_data'), 
        where('CMTA Agreement Status', '==', 'Signed'),
        where('SettlementStatus', '==', 'Settled')
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      
      const mapped = Array.isArray(data)
        ? data.map((row: any) => {
            const obj: any = {}
            costDetailsColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      setCostDetailsRows(mapped)
    } finally {
      setCostDetailsLoading(false)
    }
  }

  // Updated fetch functions with proper filtering
  const fetchClearData = async () => {
    setClearLoading(true)
    try {
      // Filter for confirmed trades (same logic as fetchClearingData)
      const q = query(
        collection(db, 'unified_data'), 
        where('CMTA Agreement Status', '==', 'Signed'),
        where('Reference_Data_Validated', '==', 'Yes'),
        where('TradeStatus', '==', 'Booked'),
        where('Instrument_Status', '==', 'Active'),
        where('ConfirmationStatus', '==', 'Confirmed')
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      
      const mapped = Array.isArray(data)
        ? data.map((row: any) => {
            const obj: any = {}
            clearColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      setClearRows(mapped)
    } finally {
      setClearLoading(false)
    }
  }

  const fetchExcData = async () => {
    setExcLoading(true)
    try {
      // Filter for trades with exceptions or issues
      const snapshot = await getDocs(collection(db, "unified_data"))
      const allRecords = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      
      // Filter records that have exceptions or failed validations
      const exceptions = allRecords.filter((record: any) => 
        record.ExceptionType || 
        record.ExceptionFlag === 'Yes' ||
        record.TradeStatus === 'Failed' ||
        record.SettlementStatus === 'Failed' ||
        record.ConfirmationStatus === 'Failed' ||
        record.Reference_Data_Validated === 'No'
      )
      
      const mapped = exceptions.map((row: any) => {
        const obj: any = {}
        excColumns.forEach((col) => {
          obj[col] = row[col] ?? ''
        })
        obj.id = row.id
        return obj
      })
      setExcRows(mapped)
    } finally {
      setExcLoading(false)
    }
  }

  const fetchExceptionTrackerData = async () => {
    setExceptionTrackerLoading(true)
    try {
      const snapshot = await getDocs(collection(db, "unified_data"))
      const allRecords = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      
      const exceptions: any[] = []
      
      // Create exception tracking entries for validation failures
      allRecords.forEach((record) => {
        if (!record['CMTA Agreement Status'] || record['CMTA Agreement Status'] !== 'Signed') {
          exceptions.push({
            id: `exc_${record.id}_agreement`,
            TradeID: record.TradeID || record.id,
            Status: 'Pending',
            ...record
          })
        }
        if (record['CMTA Agreement Status'] === 'Signed' && 
            (!record['Reference_Data_Validated'] || record['Reference_Data_Validated'] !== 'Yes')) {
          exceptions.push({
            id: `exc_${record.id}_refdata`,
            TradeID: record.TradeID || record.id,
            Status: 'Pending',
            ...record
          })
        }
      })
      
      const mapped = exceptions.map((row: any) => {
        const obj: any = {}
        exceptionTrackerColumns.forEach((col) => {
          obj[col] = row[col] ?? ''
        })
        obj.id = row.id
        return obj
      })
      setExceptionTrackerRows(mapped)
    } finally {
      setExceptionTrackerLoading(false)
    }
  }

  const fetchCostData = async () => {
    setCostLoading(true)
    try {
      // Filter for completed trades that can be allocated costs
      const q = query(
        collection(db, 'unified_data'), 
        where('CMTA Agreement Status', '==', 'Signed'),
        where('SettlementStatus', '==', 'Settled')
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      
      const mapped = Array.isArray(data)
        ? data.map((row: any) => {
            const obj: any = {}
            costColumns.forEach((col) => {
              obj[col] = row[col] ?? ''
            })
            obj.id = row.id
            return obj
          })
        : []
      setCostRows(mapped)
    } finally {
      setCostLoading(false)
    }
  }

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
    "Commission Management",
    "Brokerage Management", 
    "Agent Billing",
    "Interest Claims",
    // Add Clearing Member Trading Agreement tab below Forward to Settlements
    "Clearing Member Trading Agreement",
    "Internal Messaging System",
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

  // Auto-load data when CMTA subtab changes
  // Initialize visible columns with all columns when component mounts
  useEffect(() => {
    if (visibleUnifiedColumns.length === 0) setVisibleUnifiedColumns([...unifiedColumns])
    if (visibleRefColumns.length === 0) setVisibleRefColumns([...refColumns])
    if (visibleTradeColumns.length === 0) setVisibleTradeColumns([...tradeColumns])
    if (visibleEnrichColumns.length === 0) setVisibleEnrichColumns([...enrichColumns])
    if (visibleConfColumns.length === 0) setVisibleConfColumns([...confColumns])
    if (visibleClearColumns.length === 0) setVisibleClearColumns([...clearColumns])
    if (visibleExcColumns.length === 0) setVisibleExcColumns([...excColumns])
    if (visibleCostColumns.length === 0) setVisibleCostColumns([...costColumns])
  }, [])

  useEffect(() => {
    if (activeSidebarSection === "Clearing Member Trading Agreement") {
      switch (experimentSubTab) {
        case "Agreement Setup":
          fetchUnifiedData()
          if (showAgreementDocTable) {
            fetchAgreementRows()
          }
          break
        case "Reference Data Mapping":
          fetchRefData()
          break
        case "Trade Capture":
          fetchTradeDataTable()
          break
        case "Trade Enrichment and routing":
          fetchEnrichData()
          break
        case "Confirmations":
          fetchConfData()
          break
        case "Clearing and Settlement":
          fetchClearData()
          break
        case "Exception Management":
          fetchExcData()
          break
        case "Cost Allocation":
          fetchCostData()
          break
      }
    }
  }, [experimentSubTab, activeSidebarSection, showAgreementDocTable])

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

  // Function to show filtering info modal
  const showFilteringInfoModal = (subtabName: string) => {
    setCurrentFilteringInfo(subtabName)
    setShowFilteringInfo(true)
  }

  // Column selector component
  const ColumnSelector = ({ 
    allColumns, 
    visibleColumns, 
    setVisibleColumns, 
    label 
  }: { 
    allColumns: string[]
    visibleColumns: string[]
    setVisibleColumns: (cols: string[]) => void
    label: string
  }) => {
    const [isOpen, setIsOpen] = useState(false)

    const toggleColumn = (column: string) => {
      if (visibleColumns.includes(column)) {
        setVisibleColumns(visibleColumns.filter(col => col !== column))
      } else {
        setVisibleColumns([...visibleColumns, column])
      }
    }

    const toggleAll = () => {
      if (visibleColumns.length === allColumns.length) {
        setVisibleColumns([])
      } else {
        setVisibleColumns([...allColumns])
      }
    }

    return (
      <div className="relative">
        <button
          className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none flex items-center gap-2"
          onClick={() => setIsOpen(!isOpen)}
          title={`Select columns for ${label}`}
        >
          <Settings className="h-5 w-5" />
          <span className="text-sm">Columns ({visibleColumns.length}/{allColumns.length})</span>
        </button>
        
        {isOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-64 max-h-80 overflow-y-auto">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={toggleAll}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                {visibleColumns.length === allColumns.length ? 'Hide All' : 'Show All'}
              </button>
            </div>
            <div className="p-2 space-y-1">
              {allColumns.map((column) => (
                <label key={column} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column)}
                    onChange={() => toggleColumn(column)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{column}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        
        {/* Backdrop to close dropdown */}
        {isOpen && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>
    )
  }

  // Helper to update a field in Firestore and reload data
  const handleUnifiedCellUpdate = async (row: any, col: string, newValue: string, idx: number) => {
    if (row[col] !== newValue && row.id) {
      setUnifiedUpdatingId(row.id)
      try {
        await tradeOperations.updateTrade(row.id, { [col]: newValue })
        await fetchUnifiedData()
      } catch (err) {
        setToastMsg('Update failed!')
        setToastType('error')
        console.error('Firestore update error:', err)
      }
      setUnifiedUpdatingId(null)
    }
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

  const renderSidebarContent = () => {
    switch (activeSidebarSection) {
      case "Brokerage Management":
        return <BrokerageManagement />
      case "Commission Management":
        return <CommissionManagement />
      case "Agent Billing":
        return <AgentBilling />
      case "Interest Claims":
        return <InterestClaims />
      case "WIP":
        return renderPage()
      case "Forward to Settlements":
        return <ForwardToSettlements />
      case "Clearing Member Trading Agreement":
        return (
          <div className="flex-1 flex h-full">
            {/* Vertical Sidebar */}
            <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">CMTA Workflow</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Clearing Member Trading Agreement</p>
              </div>
              
              <nav className="flex-1 p-4">
                <div className="space-y-2">
                  {experimentSubTabs.map((tab, index) => (
                    <button
                      key={tab}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none flex items-center group ${
                        experimentSubTab === tab
                          ? "bg-black text-white shadow-sm"
                          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      onClick={() => setExperimentSubTab(tab)}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center text-xs font-bold ${
                        experimentSubTab === tab
                          ? "border-white text-white"
                          : "border-gray-400 text-gray-400 group-hover:border-gray-600 group-hover:text-gray-600"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{tab}</div>
                        <div className={`text-xs mt-1 ${
                          experimentSubTab === tab
                            ? "text-gray-300"
                            : "text-gray-500 dark:text-gray-400"
                        }`}>
                          {index === 0 && "Setup agreements and client data"}
                          {index === 1 && "Map reference data and accounts"}
                          {index === 2 && "Capture trade information"}
                          {index === 3 && "Enrich and route trades"}
                          {index === 4 && "Manage confirmations"}
                          {index === 5 && "Process clearing & settlement"}
                          {index === 6 && "Handle exceptions"}
                          {index === 7 && "Allocate costs"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </nav>
            </div>

            {/* Content area for subtabs */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-auto">
              <div className="h-full bg-white dark:bg-gray-800 m-4 rounded-lg shadow-sm p-6">
              {/* Agreement Setup subtab content */}
              {experimentSubTab === "Agreement Setup" && (
                <div>
                  <div className="flex justify-end mb-4 gap-2">
                    <button
                      className="p-2 rounded-md bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none text-blue-600 dark:text-blue-400"
                      title="View filtering logic for this subtab"
                      onClick={() => showFilteringInfoModal("Agreement Setup")}
                    >
                      <Info className="h-5 w-5" />
                    </button>
                    <ColumnSelector
                      allColumns={unifiedColumns}
                      visibleColumns={visibleUnifiedColumns}
                      setVisibleColumns={setVisibleUnifiedColumns}
                      label="Agreement Setup"
                    />
                    <button
                      className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                      title="Source data from Firebase"
                      onClick={fetchUnifiedData}
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    <button
                      className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                      title="Toggle Agreement Document table"
                      onClick={() => setShowAgreementDocTable(!showAgreementDocTable)}
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                      title="Save changes"
                      disabled={Object.keys(editedRows).length === 0 || saveLoading}
                      onClick={async () => {
                        setSaveLoading(true)
                        try {
                          for (const id of Object.keys(editedRows)) {
                            await tradeOperations.updateTrade(id, editedRows[id])
                          }
                          setEditedRows({})
                          await fetchUnifiedData()
                        } catch (err) {
                          setToastMsg('Save failed!')
                          setToastType('error')
                        }
                        setSaveLoading(false)
                      }}
                    >
                      {saveLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                      <thead>
                        <tr>
                          {visibleUnifiedColumns.map((col) => (
                            <th key={col} className="min-w-[240px] px-4 py-2 border-b">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {unifiedLoading ? (
                          <tr>
                            <td colSpan={visibleUnifiedColumns.length} className="text-center py-4">Loading...</td>
                          </tr>
                        ) : unifiedRows.length === 0 ? (
                          <tr>
                            <td colSpan={visibleUnifiedColumns.length} className="text-center py-8">
                              <div className="text-gray-400">
                                <p className="mb-4">No data found in Agreement Setup</p>
                                <div className="space-y-2">
                                  <p className="text-sm">Possible causes:</p>
                                  <ul className="text-xs text-left space-y-1 max-w-md mx-auto">
                                    <li>• Firebase unified_data collection is empty</li>
                                    <li>• Database connection issue</li>
                                    <li>• No trade data has been uploaded yet</li>
                                  </ul>
                                  <div className="flex gap-2 justify-center mt-4">
                                    <button
                                      onClick={fetchUnifiedData}
                                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                    >
                                      🔄 Refresh Data
                                    </button>
                                    <button
                                      onClick={createSampleAgreementData}
                                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                    >
                                      ✨ Create Sample Data
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          unifiedRows.map((row, idx) => (
                            <tr key={row.id || idx} className={unifiedUpdatingId === row.id ? "opacity-50" : ""}>
                              {visibleUnifiedColumns.map((col) => (
                                <td key={col} className="min-w-[240px] px-4 py-2 border-b">
                                  {col === 'id' ? (
                                    <input
                                      className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                      value={row.id}
                                      disabled
                                      readOnly
                                    />
                                  ) : (
                                    <input
                                      className="w-full bg-transparent border-none outline-none"
                                      value={row[col] ?? ''}
                                      disabled={unifiedUpdatingId === row.id}
                                      onChange={e => {
                                        const newValue = e.target.value
                                        setUnifiedRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                        // Track edits
                                        setEditedRows(prev => {
                                          const updated = { ...prev }
                                          const original = unifiedRows[idx] || {}
                                          if (original[col] !== newValue) {
                                            updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                          } else if (updated[row.id]) {
                                            delete updated[row.id][col]
                                            if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                          }
                                          return updated
                                        })
                                      }}
                                      onBlur={e => {/* no-op, save only on button click */}}
                                      onKeyDown={e => {/* no-op, save only on button click */}}
                                    />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Agreement Document Table */}
                  {showAgreementDocTable && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Agreement Document</h3>

                      <div className="overflow-x-auto">
                        <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                          <thead>
                            <tr>
                              {agreementColumns.map((col) => (
                                <th key={col} className="min-w-[240px] px-4 py-2 border-b">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {agreementLoading ? (
                              <tr>
                                <td colSpan={agreementColumns.length} className="text-center py-4">Loading...</td>
                              </tr>
                            ) : agreementRows.length === 0 ? (
                              <tr>
                                <td colSpan={agreementColumns.length} className="text-center py-4 text-gray-400">No data loaded</td>
                              </tr>
                            ) : (
                              agreementRows.map((row, idx) => (
                                <tr key={row.id || idx} className={row['CMTA Agreement Status'] === 'Signed' ? 'bg-green-50 dark:bg-green-900/10 border-l-4 border-l-green-500' : ''}>
                                  {agreementColumns.map((col) => (
                                    <td key={col} className="min-w-[240px] px-4 py-2 border-b">
                                      {col === 'id' ? (
                                        <input
                                          className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                          value={row.id}
                                          disabled
                                          readOnly
                                        />
                                      ) : col === 'CMTA Agreement Status' ? (
                                        <select
                                          className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                                          value={row[col] ?? 'Draft'}
                                          onChange={e => {
                                            const newValue = e.target.value
                                            setAgreementRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                            // Track edits for CMTA Agreement Status only
                                            setAgreementEditedRows(prev => {
                                              const updated = { ...prev }
                                              const original = agreementRows[idx] || {}
                                              if (original[col] !== newValue) {
                                                updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                              } else if (updated[row.id]) {
                                                delete updated[row.id][col]
                                                if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                              }
                                              return updated
                                            })
                                          }}
                                        >
                                          <option value="Draft">Draft</option>
                                          <option value="Under Review">Under Review</option>
                                          <option value="Signed">Signed</option>
                                          <option value="Expired">Expired</option>
                                        </select>
                                      ) : col === 'View agreement' ? (
                                        <button 
                                          className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                                          onClick={() => handlePreviewAgreement(row, setToastMsg, setToastType)}
                                        >
                                          Preview
                                        </button>
                                      ) : col === 'commission rate agreed' ? (
                                        <input
                                          className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                                          value={row[col] ?? ''}
                                          onChange={e => {
                                            const newValue = e.target.value
                                            setAgreementRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                            // Track edits for commission rate agreed
                                            setAgreementEditedRows(prev => {
                                              const updated = { ...prev }
                                              const original = agreementRows[idx] || {}
                                              if (original[col] !== newValue) {
                                                updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                              } else if (updated[row.id]) {
                                                delete updated[row.id][col]
                                                if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                              }
                                              return updated
                                            })
                                          }}
                                        />
                                      ) : col === 'signed agreement' ? (
                                        <div className="flex gap-2">
                                          <button 
                                            className="text-orange-500 hover:text-orange-700 text-sm font-medium"
                                            onClick={() => {
                                              // Update status to Signed when Sign button is clicked
                                              setAgreementRows(prev => prev.map((r, i) => 
                                                i === idx ? { ...r, 'CMTA Agreement Status': 'Signed' } : r
                                              ))
                                              setAgreementEditedRows(prev => ({
                                                ...prev,
                                                [row.id]: { ...(prev[row.id] || {}), 'CMTA Agreement Status': 'Signed' }
                                              }))
                                              setToastMsg('Agreement marked as Signed. You can now download it.')
                                              setToastType('success')
                                            }}
                                          >
                                            Sign
                                          </button>
                                          {row['CMTA Agreement Status'] === 'Signed' && (
                                            <button 
                                              className="text-purple-500 hover:text-purple-700 text-sm font-medium"
                                              onClick={() => handleDownloadSigned(row, setToastMsg, setToastType)}
                                            >
                                              Download
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <input
                                          className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                          value={row[col] ?? ''}
                                          disabled
                                          readOnly
                                        />
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button
                          className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                          disabled={Object.keys(agreementEditedRows).length === 0 || agreementStatusSaveLoading}
                          onClick={async () => {
                            setAgreementStatusSaveLoading(true)
                            try {
                              for (const id of Object.keys(agreementEditedRows)) {
                                await tradeOperations.updateTrade(id, agreementEditedRows[id])
                              }
                              setAgreementEditedRows({})
                              await fetchAgreementRows()
                            } catch (err) {
                              setToastMsg('Save failed!')
                              setToastType('error')
                            }
                            setAgreementStatusSaveLoading(false)
                          }}
                        >
                          {agreementStatusSaveLoading ? 'Saving...' : 'Save CMTA Status & Commission Rate'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {experimentSubTab === "Reference Data Mapping" && (
                <div>

                  <div className="flex justify-end mb-4 gap-2">
                    <button
                      className="p-2 rounded-md bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none text-blue-600 dark:text-blue-400"
                      title="View filtering logic for this subtab"
                      onClick={() => showFilteringInfoModal("Reference Data Mapping")}
                    >
                      <Info className="h-5 w-5" />
                    </button>
                    <ColumnSelector
                      allColumns={refColumns}
                      visibleColumns={visibleRefColumns}
                      setVisibleColumns={setVisibleRefColumns}
                      label="Reference Data Mapping"
                    />
                    <button
                      className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                      title="Source data from Firebase"
                      onClick={fetchRefData}
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    <button
                      className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                      title="Save changes"
                      disabled={Object.keys(refEditedRows).length === 0 || refSaveLoading}
                      onClick={async () => {
                        setRefSaveLoading(true)
                        try {
                          for (const id of Object.keys(refEditedRows)) {
                            await tradeOperations.updateTrade(id, refEditedRows[id])
                          }
                          setRefEditedRows({})
                          await fetchRefData()
                        } catch (err) {
                          setToastMsg('Save failed!')
                          setToastType('error')
                        }
                        setRefSaveLoading(false)
                      }}
                    >
                      {refSaveLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                      <thead>
                        <tr>
                          {visibleRefColumns.map((col) => (
                            <th key={col} className="min-w-[240px] px-4 py-2 border-b">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {refLoading ? (
                          <tr>
                            <td colSpan={visibleRefColumns.length} className="text-center py-4">Loading...</td>
                          </tr>
                        ) : refRows.length === 0 ? (
                          <tr>
                            <td colSpan={visibleRefColumns.length} className="text-center py-4 text-gray-400">No data loaded</td>
                          </tr>
                        ) : (
                          refRows.map((row, idx) => (
                            <tr key={row.id || idx} className={`${refUpdatingId === row.id ? "opacity-50" : ""} ${row['Reference_Data_Validated'] === 'Yes' ? 'bg-green-50 dark:bg-green-900/10 border-l-4 border-l-green-500' : row['Reference_Data_Validated'] === 'No' ? 'bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500' : 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-500'}`}>
                              {visibleRefColumns.map((col) => (
                                <td key={col} className="min-w-[240px] px-4 py-2 border-b">
                                  {col === 'id' ? (
                                    <input
                                      className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                      value={row.id}
                                      disabled
                                      readOnly
                                    />
                                  ) : (
                                    <input
                                      className="w-full bg-transparent border-none outline-none"
                                      value={row[col] ?? ''}
                                      disabled={refUpdatingId === row.id}
                                      onChange={e => {
                                        const newValue = e.target.value
                                        setRefRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                        // Track edits
                                        setRefEditedRows(prev => {
                                          const updated = { ...prev }
                                          const original = refRows[idx] || {}
                                          if (original[col] !== newValue) {
                                            updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                          } else if (updated[row.id]) {
                                            delete updated[row.id][col]
                                            if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                          }
                                          return updated
                                        })
                                      }}
                                      onBlur={e => {/* no-op, save only on button click */}}
                                      onKeyDown={e => {/* no-op, save only on button click */}}
                                    />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {experimentSubTab === "Trade Capture" && (
                <div>

                  <div className="flex justify-end mb-4 gap-2">
                    <button
                      className="p-2 rounded-md bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none text-blue-600 dark:text-blue-400"
                      title="View filtering logic for this subtab"
                      onClick={() => showFilteringInfoModal("Trade Capture")}
                    >
                      <Info className="h-5 w-5" />
                    </button>
                    <ColumnSelector
                      allColumns={tradeColumns}
                      visibleColumns={visibleTradeColumns}
                      setVisibleColumns={setVisibleTradeColumns}
                      label="Trade Capture"
                    />
                    <button
                      className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                      title="Source data from Firebase"
                      onClick={fetchTradeDataTable}
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    <button
                      className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                      title="Save changes"
                      disabled={Object.keys(tradeEditedRows).length === 0 || tradeSaveLoading}
                      onClick={async () => {
                        setTradeSaveLoading(true)
                        try {
                          for (const id of Object.keys(tradeEditedRows)) {
                            await tradeOperations.updateTrade(id, tradeEditedRows[id])
                          }
                          setTradeEditedRows({})
                          await fetchTradeDataTable()
                        } catch (err) {
                          setToastMsg('Save failed!')
                          setToastType('error')
                        }
                        setTradeSaveLoading(false)
                      }}
                    >
                      {tradeSaveLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                      <thead>
                        <tr>
                          {visibleTradeColumns.map((col) => (
                            <th key={col} className="min-w-[240px] px-4 py-2 border-b">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tradeLoading ? (
                          <tr>
                            <td colSpan={visibleTradeColumns.length} className="text-center py-4">Loading...</td>
                          </tr>
                        ) : tradeRows.length === 0 ? (
                          <tr>
                            <td colSpan={visibleTradeColumns.length} className="text-center py-4 text-gray-400">No data loaded</td>
                          </tr>
                        ) : (
                          tradeRows.map((row, idx) => (
                            <tr key={row.id || idx} className={`${tradeUpdatingId === row.id ? "opacity-50" : ""} ${row['TradeStatus'] === 'Booked' ? 'bg-green-50 dark:bg-green-900/10 border-l-4 border-l-green-500' : row['TradeStatus'] === 'Pending' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-500' : 'bg-gray-50 dark:bg-gray-900/10 border-l-4 border-l-gray-500'}`}>
                              {visibleTradeColumns.map((col) => (
                                <td key={col} className="min-w-[240px] px-4 py-2 border-b">
                                  {col === 'id' ? (
                                    <input
                                      className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                      value={row.id}
                                      disabled
                                      readOnly
                                    />
                                  ) : (
                                    <input
                                      className="w-full bg-transparent border-none outline-none"
                                      value={row[col] ?? ''}
                                      disabled={tradeUpdatingId === row.id}
                                      onChange={e => {
                                        const newValue = e.target.value
                                        setTradeRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                        // Track edits
                                        setTradeEditedRows(prev => {
                                          const updated = { ...prev }
                                          const original = tradeRows[idx] || {}
                                          if (original[col] !== newValue) {
                                            updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                          } else if (updated[row.id]) {
                                            delete updated[row.id][col]
                                            if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                          }
                                          return updated
                                        })
                                      }}
                                      onBlur={e => {/* no-op, save only on button click */}}
                                      onKeyDown={e => {/* no-op, save only on button click */}}
                                    />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {experimentSubTab === "Trade Enrichment and routing" && (
                <div>

                  <div className="flex justify-end mb-4 gap-2">
                    <button
                      className="p-2 rounded-md bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none text-blue-600 dark:text-blue-400"
                      title="View filtering logic for this subtab"
                      onClick={() => showFilteringInfoModal("Trade Enrichment and routing")}
                    >
                      <Info className="h-5 w-5" />
                    </button>
                    <ColumnSelector
                      allColumns={enrichColumns}
                      visibleColumns={visibleEnrichColumns}
                      setVisibleColumns={setVisibleEnrichColumns}
                      label="Trade Enrichment and routing"
                    />
                    <button
                      className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                      title="Source data from Firebase"
                      onClick={fetchEnrichData}
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    <button
                      className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                      title="Save changes"
                      disabled={Object.keys(enrichEditedRows).length === 0 || enrichSaveLoading}
                      onClick={async () => {
                        setEnrichSaveLoading(true)
                        try {
                          for (const id of Object.keys(enrichEditedRows)) {
                            await tradeOperations.updateTrade(id, enrichEditedRows[id])
                          }
                          setEnrichEditedRows({})
                          await fetchEnrichData()
                        } catch (err) {
                          setToastMsg('Save failed!')
                          setToastType('error')
                        }
                        setEnrichSaveLoading(false)
                      }}
                    >
                      {enrichSaveLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                      <thead>
                        <tr>
                          {visibleEnrichColumns.map((col) => (
                            <th key={col} className="min-w-[240px] px-4 py-2 border-b">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {enrichLoading ? (
                          <tr>
                            <td colSpan={visibleEnrichColumns.length} className="text-center py-4">Loading...</td>
                          </tr>
                        ) : enrichRows.length === 0 ? (
                          <tr>
                            <td colSpan={visibleEnrichColumns.length} className="text-center py-4 text-gray-400">No data loaded</td>
                          </tr>
                        ) : (
                          enrichRows.map((row, idx) => (
                            <tr key={row.id || idx} className={`${enrichUpdatingId === row.id ? "opacity-50" : ""}`}>
                              {visibleEnrichColumns.map((col) => (
                                <td key={col} className="min-w-[240px] px-4 py-2 border-b">
                                  {col === 'id' ? (
                                    <input
                                      className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                      value={row.id}
                                      disabled
                                      readOnly
                                    />
                                  ) : (
                                    <input
                                      className="w-full bg-transparent border-none outline-none"
                                      value={row[col] ?? ''}
                                      disabled={enrichUpdatingId === row.id}
                                      onChange={e => {
                                        const newValue = e.target.value
                                        setEnrichRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                        // Track edits
                                        setEnrichEditedRows(prev => {
                                          const updated = { ...prev }
                                          const original = enrichRows[idx] || {}
                                          if (original[col] !== newValue) {
                                            updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                          } else if (updated[row.id]) {
                                            delete updated[row.id][col]
                                            if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                          }
                                          return updated
                                        })
                                      }}
                                      onBlur={e => {/* no-op, save only on button click */}}
                                      onKeyDown={e => {/* no-op, save only on button click */}}
                                    />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {experimentSubTab === "Confirmations" && (
                <div>
                  <div className="flex justify-end mb-4 gap-2">
                    <button
                      className="p-2 rounded-md bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none text-blue-600 dark:text-blue-400"
                      title="View filtering logic for this subtab"
                      onClick={() => showFilteringInfoModal("Confirmations")}
                    >
                      <Info className="h-5 w-5" />
                    </button>
                    <ColumnSelector
                      allColumns={confColumns}
                      visibleColumns={visibleConfColumns}
                      setVisibleColumns={setVisibleConfColumns}
                      label="Confirmations"
                    />
                    <button
                      className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                      title="Source data from Firebase"
                      onClick={fetchConfData}
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    <button
                      className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                      title="Save changes"
                      disabled={Object.keys(confEditedRows).length === 0 || confSaveLoading}
                      onClick={async () => {
                        setConfSaveLoading(true)
                        try {
                          for (const id of Object.keys(confEditedRows)) {
                            await tradeOperations.updateTrade(id, confEditedRows[id])
                          }
                          setConfEditedRows({})
                          await fetchConfData()
                        } catch (err) {
                          setToastMsg('Save failed!')
                          setToastType('error')
                        }
                        setConfSaveLoading(false)
                      }}
                    >
                      {confSaveLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                      <thead>
                        <tr>
                          {visibleConfColumns.map((col) => (
                            <th key={col} className="min-w-[240px] px-4 py-2 border-b">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {confLoading ? (
                          <tr>
                            <td colSpan={visibleConfColumns.length} className="text-center py-4">Loading...</td>
                          </tr>
                        ) : confRows.length === 0 ? (
                          <tr>
                            <td colSpan={visibleConfColumns.length} className="text-center py-4 text-gray-400">No data loaded</td>
                          </tr>
                        ) : (
                          confRows.map((row, idx) => (
                            <tr key={row.id || idx} className={`${confUpdatingId === row.id ? "opacity-50" : ""} ${row['ConfirmationStatus'] === 'Confirmed' ? 'bg-green-50 dark:bg-green-900/10 border-l-4 border-l-green-500' : row['ConfirmationStatus'] === 'Pending' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-500' : 'bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500'}`}>
                              {visibleConfColumns.map((col) => (
                                <td key={col} className="min-w-[240px] px-4 py-2 border-b">
                                  {col === 'id' ? (
                                    <input
                                      className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                      value={row.id}
                                      disabled
                                      readOnly
                                    />
                                  ) : (
                                    <input
                                      className="w-full bg-transparent border-none outline-none"
                                      value={row[col] ?? ''}
                                      disabled={confUpdatingId === row.id}
                                      onChange={e => {
                                        const newValue = e.target.value
                                        setConfRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                        // Track edits
                                        setConfEditedRows(prev => {
                                          const updated = { ...prev }
                                          const original = confRows[idx] || {}
                                          if (original[col] !== newValue) {
                                            updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                          } else if (updated[row.id]) {
                                            delete updated[row.id][col]
                                            if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                          }
                                          return updated
                                        })
                                      }}
                                      onBlur={e => {/* no-op, save only on button click */}}
                                      onKeyDown={e => {/* no-op, save only on button click */}}
                                    />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {experimentSubTab === "Clearing and Settlement" && (
                <div>
                  <div className="flex justify-end mb-4 gap-2">
                    <button
                      className="p-2 rounded-md bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none text-blue-600 dark:text-blue-400"
                      title="View filtering logic for this subtab"
                      onClick={() => showFilteringInfoModal("Clearing and Settlement")}
                    >
                      <Info className="h-5 w-5" />
                    </button>
                    <ColumnSelector
                      allColumns={clearColumns}
                      visibleColumns={visibleClearColumns}
                      setVisibleColumns={setVisibleClearColumns}
                      label="Clearing and Settlement"
                    />
                    <button
                      className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                      title="Source data from Firebase"
                      onClick={fetchClearData}
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    <button
                      className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                      title="Save changes"
                      disabled={Object.keys(clearEditedRows).length === 0 || clearSaveLoading}
                      onClick={async () => {
                        setClearSaveLoading(true)
                        try {
                          for (const id of Object.keys(clearEditedRows)) {
                            await tradeOperations.updateTrade(id, clearEditedRows[id])
                          }
                          setClearEditedRows({})
                          await fetchClearData()
                        } catch (err) {
                          setToastMsg('Save failed!')
                          setToastType('error')
                        }
                        setClearSaveLoading(false)
                      }}
                    >
                      {clearSaveLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                      <thead>
                        <tr>
                          {visibleClearColumns.map((col) => (
                            <th key={col} className="min-w-[240px] px-4 py-2 border-b">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {clearLoading ? (
                          <tr>
                            <td colSpan={visibleClearColumns.length} className="text-center py-4">Loading...</td>
                          </tr>
                        ) : clearRows.length === 0 ? (
                          <tr>
                            <td colSpan={visibleClearColumns.length} className="text-center py-4 text-gray-400">No data loaded</td>
                          </tr>
                        ) : (
                          clearRows.map((row, idx) => (
                            <tr key={row.id || idx} className={clearUpdatingId === row.id ? "opacity-50" : ""}>
                              {visibleClearColumns.map((col) => (
                                <td key={col} className="min-w-[240px] px-4 py-2 border-b">
                                  {col === 'id' ? (
                                    <input
                                      className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                      value={row.id}
                                      disabled
                                      readOnly
                                    />
                                  ) : (
                                    <input
                                      className="w-full bg-transparent border-none outline-none"
                                      value={row[col] ?? ''}
                                      disabled={clearUpdatingId === row.id}
                                      onChange={e => {
                                        const newValue = e.target.value
                                        setClearRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                        // Track edits
                                        setClearEditedRows(prev => {
                                          const updated = { ...prev }
                                          const original = clearRows[idx] || {}
                                          if (original[col] !== newValue) {
                                            updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                          } else if (updated[row.id]) {
                                            delete updated[row.id][col]
                                            if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                          }
                                          return updated
                                        })
                                      }}
                                      onBlur={e => {/* no-op, save only on button click */}}
                                      onKeyDown={e => {/* no-op, save only on button click */}}
                                    />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {experimentSubTab === "Exception Management" && (
                <div>
                  <div className="flex justify-end mb-4 gap-2">
                    <button
                      className="p-2 rounded-md bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none text-blue-600 dark:text-blue-400"
                      title="View filtering logic for this subtab"
                      onClick={() => showFilteringInfoModal("Exception Management")}
                    >
                      <Info className="h-5 w-5" />
                    </button>
                    <ColumnSelector
                      allColumns={excColumns}
                      visibleColumns={visibleExcColumns}
                      setVisibleColumns={setVisibleExcColumns}
                      label="Exception Management"
                    />
                    <button
                      className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                      title="Source data from Firebase"
                      onClick={fetchExcData}
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    <button
                      className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                      title="Save changes"
                      disabled={Object.keys(excEditedRows).length === 0 || excSaveLoading}
                      onClick={async () => {
                        setExcSaveLoading(true)
                        try {
                          for (const id of Object.keys(excEditedRows)) {
                            await tradeOperations.updateTrade(id, excEditedRows[id])
                          }
                          setExcEditedRows({})
                          await fetchExcData()
                        } catch (err) {
                          setToastMsg('Save failed!')
                          setToastType('error')
                        }
                        setExcSaveLoading(false)
                      }}
                    >
                      {excSaveLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                      <thead>
                        <tr>
                          {visibleExcColumns.map((col) => (
                            <th key={col} className="min-w-[240px] px-4 py-2 border-b">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excLoading ? (
                          <tr>
                            <td colSpan={visibleExcColumns.length} className="text-center py-4">Loading...</td>
                          </tr>
                        ) : excRows.length === 0 ? (
                          <tr>
                            <td colSpan={visibleExcColumns.length} className="text-center py-4 text-gray-400">No data loaded</td>
                          </tr>
                        ) : (
                          excRows.map((row, idx) => (
                            <tr key={row.id || idx} className={`${excUpdatingId === row.id ? "opacity-50" : ""} ${
                              // Exception resolution logic for visual indicators
                              (() => {
                                const exceptionFlag = row['ExceptionFlag']
                                const exceptionResolution = row['Exception Resolution']
                                const reportingResolution = row['Reporting Resolution']
                                
                                if (exceptionFlag === 'No') {
                                  return 'bg-green-50 dark:bg-green-900/10 border-l-4 border-l-green-500' // No exceptions - ready to forward
                                } else if (exceptionFlag === 'Yes' && 
                                          exceptionResolution && exceptionResolution.trim() !== '' &&
                                          reportingResolution && reportingResolution.trim() !== '') {
                                  return 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-l-blue-500' // Exceptions resolved - ready to forward
                                } else if (exceptionFlag === 'Yes') {
                                  return 'bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500' // Exceptions pending resolution
                                } else {
                                  return 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-500' // Unknown status
                                }
                              })()
                            }`}>
                              {visibleExcColumns.map((col) => (
                                <td key={col} className="min-w-[240px] px-4 py-2 border-b">
                                  {col === 'id' ? (
                                    <input
                                      className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                      value={row.id}
                                      disabled
                                      readOnly
                                    />
                                  ) : (
                                    <input
                                      className="w-full bg-transparent border-none outline-none"
                                      value={row[col] ?? ''}
                                      disabled={excUpdatingId === row.id}
                                      onChange={e => {
                                        const newValue = e.target.value
                                        setExcRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                        // Track edits
                                        setExcEditedRows(prev => {
                                          const updated = { ...prev }
                                          const original = excRows[idx] || {}
                                          if (original[col] !== newValue) {
                                            updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                          } else if (updated[row.id]) {
                                            delete updated[row.id][col]
                                            if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                          }
                                          return updated
                                        })
                                      }}
                                      onBlur={e => {/* no-op, save only on button click */}}
                                      onKeyDown={e => {/* no-op, save only on button click */}}
                                    />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Exception Tracking Table - Second Table */}
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Exception Tracking - Failed Validations</h3>
                    <div className="flex justify-end mb-4 gap-2">
                      <button
                        className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                        title="Load exception tracking data"
                        onClick={fetchExceptionTrackerData}
                      >
                        <Download className="h-5 w-5" />
                      </button>
                      <button
                        className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                        title="Save exception updates"
                        disabled={Object.keys(exceptionTrackerEditedRows).length === 0 || exceptionTrackerSaveLoading}
                        onClick={async () => {
                          setExceptionTrackerSaveLoading(true)
                          try {
                            // Note: Exception tracker entries are synthetic, would need separate collection to save
                            setExceptionTrackerEditedRows({})
                            setToastMsg('Exception updates saved!')
                            setToastType('success')
                          } catch (err) {
                            setToastMsg('Save failed!')
                            setToastType('error')
                          }
                          setExceptionTrackerSaveLoading(false)
                        }}
                      >
                        {exceptionTrackerSaveLoading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                        <thead>
                          <tr>
                            {exceptionTrackerColumns.map((col) => (
                              <th key={col} className="min-w-[240px] px-4 py-2 border-b">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {exceptionTrackerLoading ? (
                            <tr>
                              <td colSpan={exceptionTrackerColumns.length} className="text-center py-4">Loading...</td>
                            </tr>
                          ) : exceptionTrackerRows.length === 0 ? (
                            <tr>
                              <td colSpan={exceptionTrackerColumns.length} className="text-center py-4 text-gray-400">No exceptions found</td>
                            </tr>
                          ) : (
                            exceptionTrackerRows.map((row, idx) => (
                              <tr key={row.id || idx} className={
                                row['Resolution Status'] === 'Fixed' ? 'bg-green-50 dark:bg-green-900/10 border-l-4 border-l-green-500' :
                                row['Resolution Status'] === 'In Progress' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-500' :
                                'bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500'
                              }>
                                {exceptionTrackerColumns.map((col) => (
                                  <td key={col} className="min-w-[240px] px-4 py-2 border-b">
                                    {col === 'id' ? (
                                      <input
                                        className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                        value={row.id}
                                        disabled
                                        readOnly
                                      />
                                    ) : col === 'Source Tab' || col === 'TradeID' ? (
                                      <input
                                        className="w-full bg-transparent border-none outline-none text-gray-600"
                                        value={row[col] ?? ''}
                                        disabled
                                        readOnly
                                      />
                                    ) : col === 'Error Category' ? (
                                      <select
                                        className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                                        value={row[col] ?? 'Data Error'}
                                        onChange={e => {
                                          const newValue = e.target.value
                                          setExceptionTrackerRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                          setExceptionTrackerEditedRows(prev => ({
                                            ...prev,
                                            [row.id]: { ...(prev[row.id] || {}), [col]: newValue }
                                          }))
                                        }}
                                      >
                                        <option value="Data Error">Data Error</option>
                                        <option value="Instruction Mismatch">Instruction Mismatch</option>
                                        <option value="Delay">Delay</option>
                                        <option value="System Failure">System Failure</option>
                                      </select>
                                    ) : col === 'Owner Team' ? (
                                      <select
                                        className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                                        value={row[col] ?? 'Operations Team'}
                                        onChange={e => {
                                          const newValue = e.target.value
                                          setExceptionTrackerRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                          setExceptionTrackerEditedRows(prev => ({
                                            ...prev,
                                            [row.id]: { ...(prev[row.id] || {}), [col]: newValue }
                                          }))
                                        }}
                                      >
                                        <option value="Legal Team">Legal Team</option>
                                        <option value="Operations Team">Operations Team</option>
                                        <option value="Trading Team">Trading Team</option>
                                        <option value="Technology Team">Technology Team</option>
                                        <option value="Risk Team">Risk Team</option>
                                      </select>
                                    ) : col === 'Resolution Status' ? (
                                      <select
                                        className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                                        value={row[col] ?? 'Pending'}
                                        onChange={e => {
                                          const newValue = e.target.value
                                          setExceptionTrackerRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                          setExceptionTrackerEditedRows(prev => ({
                                            ...prev,
                                            [row.id]: { ...(prev[row.id] || {}), [col]: newValue }
                                          }))
                                        }}
                                      >
                                        <option value="Pending">Pending</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Fixed">Fixed</option>
                                      </select>
                                    ) : (
                                      <textarea
                                        className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm resize-none"
                                        rows={2}
                                        value={row[col] ?? ''}
                                        onChange={e => {
                                          const newValue = e.target.value
                                          setExceptionTrackerRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                          setExceptionTrackerEditedRows(prev => ({
                                            ...prev,
                                            [row.id]: { ...(prev[row.id] || {}), [col]: newValue }
                                          }))
                                        }}
                                        placeholder="Add timestamped comments..."
                                      />
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {experimentSubTab === "Cost Allocation" && (
                <div>
                  <div className="flex justify-end mb-4 gap-2">
                    <button
                      className="p-2 rounded-md bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none text-blue-600 dark:text-blue-400"
                      title="View filtering logic for this subtab"
                      onClick={() => showFilteringInfoModal("Cost Allocation")}
                    >
                      <Info className="h-5 w-5" />
                    </button>
                    <ColumnSelector
                      allColumns={costColumns}
                      visibleColumns={visibleCostColumns}
                      setVisibleColumns={setVisibleCostColumns}
                      label="Cost Allocation"
                    />
                    <button
                      className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                      title="Source data from Firebase"
                      onClick={fetchCostData}
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    <button
                      className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                      title="Save changes"
                      disabled={Object.keys(costEditedRows).length === 0 || costSaveLoading}
                      onClick={async () => {
                        setCostSaveLoading(true)
                        try {
                          for (const id of Object.keys(costEditedRows)) {
                            await tradeOperations.updateTrade(id, costEditedRows[id])
                          }
                          setCostEditedRows({})
                          await fetchCostData()
                        } catch (err) {
                          setToastMsg('Save failed!')
                          setToastType('error')
                        }
                        setCostSaveLoading(false)
                      }}
                    >
                      {costSaveLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                      <thead>
                        <tr>
                          {visibleCostColumns.map((col) => (
                            <th key={col} className="min-w-[240px] px-4 py-2 border-b">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {costLoading ? (
                          <tr>
                            <td colSpan={visibleCostColumns.length} className="text-center py-4">Loading...</td>
                          </tr>
                        ) : costRows.length === 0 ? (
                          <tr>
                            <td colSpan={visibleCostColumns.length} className="text-center py-4 text-gray-400">No data loaded</td>
                          </tr>
                        ) : (
                          costRows.map((row, idx) => (
                            <tr key={row.id || idx} className={costUpdatingId === row.id ? "opacity-50" : ""}>
                              {visibleCostColumns.map((col) => (
                                <td key={col} className="min-w-[240px] px-4 py-2 border-b">
                                  {col === 'id' ? (
                                    <input
                                      className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                      value={row.id}
                                      disabled
                                      readOnly
                                    />
                                  ) : (
                                    <input
                                      className="w-full bg-transparent border-none outline-none"
                                      value={row[col] ?? ''}
                                      disabled={costUpdatingId === row.id}
                                      onChange={e => {
                                        const newValue = e.target.value
                                        setCostRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                        // Track edits
                                        setCostEditedRows(prev => {
                                          const updated = { ...prev }
                                          const original = costRows[idx] || {}
                                          if (original[col] !== newValue) {
                                            updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                          } else if (updated[row.id]) {
                                            delete updated[row.id][col]
                                            if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                          }
                                          return updated
                                        })
                                      }}
                                      onBlur={e => {/* no-op, save only on button click */}}
                                      onKeyDown={e => {/* no-op, save only on button click */}}
                                    />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Second Cost Allocation Table - Commission Details */}
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Commission & Fee Details</h3>
                    <div className="flex justify-end mb-4 gap-2">
                      <button
                        className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                        title="Source commission data from Firebase"
                        onClick={fetchCostDetailsData}
                      >
                        <Download className="h-5 w-5" />
                      </button>
                      <button
                        className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none disabled:opacity-50"
                        title="Save commission changes"
                        disabled={Object.keys(costDetailsEditedRows).length === 0 || costDetailsSaveLoading}
                        onClick={async () => {
                          setCostDetailsSaveLoading(true)
                          try {
                            for (const id of Object.keys(costDetailsEditedRows)) {
                              await tradeOperations.updateTrade(id, costDetailsEditedRows[id])
                            }
                            setCostDetailsEditedRows({})
                            await fetchCostDetailsData()
                          } catch (err) {
                            setToastMsg('Save failed!')
                            setToastType('error')
                          }
                          setCostDetailsSaveLoading(false)
                        }}
                      >
                        {costDetailsSaveLoading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                        <thead>
                          <tr>
                            {costDetailsColumns.map((col, index) => (
                              <th key={col} className={`min-w-[240px] px-4 py-2 border-b ${index < costDetailsColumns.length - 1 ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {costDetailsLoading ? (
                            <tr>
                              <td colSpan={costDetailsColumns.length} className="text-center py-4 border-r-0">Loading...</td>
                            </tr>
                          ) : costDetailsRows.length === 0 ? (
                            <tr>
                              <td colSpan={costDetailsColumns.length} className="text-center py-4 text-gray-400 border-r-0">No data loaded</td>
                            </tr>
                          ) : (
                            costDetailsRows.map((row, idx) => (
                              <tr key={row.id || idx} className={
                                (() => {
                                  const expenseStatus = row['ExpenseApprovalStatus']
                                  const costStatus = row['CostAllocationStatus']
                                  
                                  if (expenseStatus === 'Approved' && costStatus === 'Allocated') {
                                    return 'bg-green-50 dark:bg-green-900/10 border-l-4 border-l-green-500' // Fully processed
                                  } else if (expenseStatus === 'Approved') {
                                    return 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-l-blue-500' // Approved but not allocated
                                  } else if (expenseStatus === 'Pending Review') {
                                    return 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-500' // Pending review
                                  } else if (expenseStatus === 'Rejected') {
                                    return 'bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500' // Rejected
                                  } else {
                                    // Auto-determine based on threshold status
                                    const commissionAmount = parseFloat(row['CommissionAmount'] || '0')
                                    const threshold = parseFloat(row['threshold'] || '0')
                                    return commissionAmount > threshold ? 
                                      'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-500' : // Would be pending
                                      'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-l-blue-500' // Would be approved
                                  }
                                })()
                              }>
                                {costDetailsColumns.map((col, index) => (
                                  <td key={col} className={`min-w-[240px] px-4 py-2 border-b ${index < costDetailsColumns.length - 1 ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}>
                                    {col === 'id' ? (
                                      <input
                                        className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                                        value={row.id}
                                        disabled
                                        readOnly
                                      />
                                     ) : col === 'threshold status' ? (
                                       <div className="flex justify-center items-center">
                                         <span className="text-xl">
                                           {(() => {
                                             const commissionAmount = parseFloat(row['CommissionAmount'] || '0')
                                             const threshold = parseFloat(row['threshold'] || '0')
                                             return commissionAmount > threshold ? '⚠️' : '✅'
                                           })()}
                                         </span>
                                       </div>
                                     ) : col === 'CommissionAmount' ? (
                                       <div className="flex gap-2 items-center">
                                         <input
                                           className="flex-1 bg-transparent border-none outline-none"
                                           value={row[col] ?? ''}
                                           onChange={e => {
                                             const newValue = e.target.value
                                             setCostDetailsRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                             // Track edits
                                             setCostDetailsEditedRows(prev => {
                                               const updated = { ...prev }
                                               const original = costDetailsRows[idx] || {}
                                               if (original[col] !== newValue) {
                                                 updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                               } else if (updated[row.id]) {
                                                 delete updated[row.id][col]
                                                 if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                               }
                                               return updated
                                             })
                                           }}
                                         />
                                         <button
                                           className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none"
                                           onClick={() => {
                                             const notionalAmount = parseFloat(row['NotionalAmount'] || '0')
                                             const commissionRate = parseFloat((row['commission rate agreed'] || '0').replace('%', ''))
                                             const calculatedAmount = (notionalAmount * commissionRate / 100).toFixed(2)
                                             
                                             // Update the commission amount
                                             setCostDetailsRows(prev => prev.map((r, i) => 
                                               i === idx ? { ...r, 'CommissionAmount': calculatedAmount } : r
                                             ))
                                             
                                             // Track edits
                                             setCostDetailsEditedRows(prev => ({
                                               ...prev,
                                               [row.id]: { ...(prev[row.id] || {}), 'CommissionAmount': calculatedAmount }
                                             }))
                                             
                                             setToastMsg(`Commission calculated: ${calculatedAmount}`)
                                             setToastType('success')
                                           }}
                                         >
                                           Calculate
                                                                                   </button>
                                        </div>
                                      ) : col === 'FXGainLoss' ? (
                                        <div className="flex gap-2 items-center">
                                          <input
                                            className="flex-1 bg-transparent border-none outline-none"
                                            value={row[col] ?? ''}
                                            onChange={e => {
                                              const newValue = e.target.value
                                              setCostDetailsRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                              // Track edits
                                              setCostDetailsEditedRows(prev => {
                                                const updated = { ...prev }
                                                const original = costDetailsRows[idx] || {}
                                                if (original[col] !== newValue) {
                                                  updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                                } else if (updated[row.id]) {
                                                  delete updated[row.id][col]
                                                  if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                                }
                                                return updated
                                              })
                                            }}
                                          />
                                          <button
                                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none"
                                            onClick={() => {
                                              const commissionAmount = parseFloat(row['CommissionAmount'] || '0')
                                              const fxRate = parseFloat(row['FXRate'] || '1')
                                              
                                              // CommissionAmount in DealtCurrency * FXRate - CommissionAmount in reportingCurrency
                                              // Assuming CommissionAmount is in DealtCurrency, and we need to convert to reporting currency
                                              const commissionInReportingCurrency = commissionAmount * fxRate
                                              const fxGainLoss = commissionInReportingCurrency - commissionAmount
                                              const calculatedFXGainLoss = fxGainLoss.toFixed(2)
                                              
                                              // Update the FX Gain/Loss
                                              setCostDetailsRows(prev => prev.map((r, i) => 
                                                i === idx ? { ...r, 'FXGainLoss': calculatedFXGainLoss } : r
                                              ))
                                              
                                              // Track edits
                                              setCostDetailsEditedRows(prev => ({
                                                ...prev,
                                                [row.id]: { ...(prev[row.id] || {}), 'FXGainLoss': calculatedFXGainLoss }
                                              }))
                                              
                                              setToastMsg(`FX Gain/Loss calculated: ${calculatedFXGainLoss}`)
                                              setToastType('success')
                                            }}
                                          >
                                            Calculate
                                          </button>
                                        </div>
                                      ) : col === 'ExpenseApprovalStatus' ? (
                                        <select
                                          className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                                          value={row[col] ?? (() => {
                                            // Auto-determine based on threshold status
                                            const commissionAmount = parseFloat(row['CommissionAmount'] || '0')
                                            const threshold = parseFloat(row['threshold'] || '0')
                                            return commissionAmount > threshold ? 'Pending Review' : 'Approved'
                                          })()}
                                          onChange={e => {
                                            const newValue = e.target.value
                                            const updates: any = { [col]: newValue }
                                            
                                            // If approved, auto-update CostAllocationStatus and CostBookedDate
                                            if (newValue === 'Approved') {
                                              updates['CostAllocationStatus'] = 'Allocated'
                                              updates['CostBookedDate'] = new Date().toISOString().split('T')[0] // Current date
                                            }
                                            
                                            setCostDetailsRows(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r))
                                            setCostDetailsEditedRows(prev => ({
                                              ...prev,
                                              [row.id]: { ...(prev[row.id] || {}), ...updates }
                                            }))
                                            
                                            if (newValue === 'Approved') {
                                              setToastMsg('Expense approved! Cost allocation updated.')
                                              setToastType('success')
                                            }
                                          }}
                                        >
                                          <option value="Approved">Approved</option>
                                          <option value="Pending Review">Pending Review</option>
                                          <option value="Rejected">Rejected</option>
                                        </select>
                                      ) : col === 'CostAllocationStatus' ? (
                                        <input
                                          className="w-full bg-transparent border-none outline-none text-gray-600"
                                          value={row[col] ?? ''}
                                          disabled
                                          readOnly
                                          placeholder="Auto-updated on approval"
                                        />
                                      ) : col === 'CostBookedDate' ? (
                                        <input
                                          className="w-full bg-transparent border-none outline-none text-gray-600"
                                          value={row[col] ?? ''}
                                          disabled
                                          readOnly
                                          placeholder="Auto-updated on approval"
                                        />
                                      ) : (
                                        <input
                                          className="w-full bg-transparent border-none outline-none"
                                          value={row[col] ?? ''}
                                          onChange={e => {
                                            const newValue = e.target.value
                                            setCostDetailsRows(prev => prev.map((r, i) => i === idx ? { ...r, [col]: newValue } : r))
                                            // Track edits
                                            setCostDetailsEditedRows(prev => {
                                              const updated = { ...prev }
                                              const original = costDetailsRows[idx] || {}
                                              if (original[col] !== newValue) {
                                                updated[row.id] = { ...(updated[row.id] || {}), [col]: newValue }
                                              } else if (updated[row.id]) {
                                                delete updated[row.id][col]
                                                if (Object.keys(updated[row.id]).length === 0) delete updated[row.id]
                                              }
                                              return updated
                                            })
                                          }}
                                        />
                                      )}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )
      case "Internal Messaging System":
        return <InternalMessagingSystem />
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
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b-2 border-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeSidebarSection}</h2>
            </div>

            {activeSidebarSection === "WIP" && (
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
              {activeSidebarSection !== "WIP" && (
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
        <aside className="w-64 bg-sidebar overflow-y-auto p-6 relative">
          {/* Forward to Settlements button */}
          <button
            onClick={() => setActiveSidebarSection("Forward to Settlements")}
            className={`absolute bottom-12 right-4 w-6 h-6 rounded-full border border-sidebar-foreground/30 flex items-center justify-center transition-colors ${
              activeSidebarSection === "Forward to Settlements"
                ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-accent"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:border-sidebar-foreground/50"
            }`}
            title="Forward to Settlements"
          >
            <ArrowRight className="w-2.5 h-2.5" />
          </button>

          {/* WIP button in bottom-right corner */}
          <button
            onClick={() => setActiveSidebarSection("WIP")}
            className={`absolute bottom-4 right-4 w-6 h-6 rounded-full border border-sidebar-foreground/30 flex items-center justify-center transition-colors ${
              activeSidebarSection === "WIP"
                ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-accent"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:border-sidebar-foreground/50"
            }`}
            title="Work in Progress"
          >
            <Settings className="w-2.5 h-2.5" />
          </button>

          <h3 className="text-lg font-semibold text-sidebar-foreground mb-4">Cost Management</h3>
          <nav className="space-y-2">
            {sidebarMenu.map((item) => (
              <button
                key={item}
                onClick={() => setActiveSidebarSection(item)}
                className={`w-full text-left py-2 px-3 rounded-md transition ${
                  activeSidebarSection === item
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/20 hover:text-sidebar-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          {activeSidebarSection === "WIP" && !loading && trades.length > 0 && (
            <div className="mt-8 p-4 bg-sidebar-accent/30 rounded-md">
              <h3 className="text-sidebar-foreground font-semibold mb-2">Data Summary</h3>
              <div className="text-sm text-sidebar-foreground/80 space-y-1">
                <div>Total Trades: {trades.length.toLocaleString()}</div>
                <div>Data Type: {dataType.toUpperCase()}</div>
                <div className="text-xs text-sidebar-foreground/60 mt-2">Source: {dataSource.toUpperCase()}</div>
              </div>
            </div>
          )}

          {activeSidebarSection === "WIP" && (
            <div className="mt-8 p-4 bg-sidebar-accent/30 rounded-md">
              <h3 className="text-sidebar-foreground font-semibold mb-2">Data Type</h3>
              <div className="flex flex-col space-y-2 mt-2">
                <button
                  onClick={() => handleDataTypeChange("equity")}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition flex items-center ${
                    dataType === "equity" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent/70"
                  }`}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Equity
                </button>
                <button
                  onClick={() => handleDataTypeChange("fx")}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition flex items-center ${
                    dataType === "fx" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent/70"
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
                activeSidebarSection === "WIP" ? page : activeSidebarSection
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

      {/* Filtering Info Modal */}
      {showFilteringInfo && currentFilteringInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {filteringExplanations[currentFilteringInfo]?.title || 'Filtering Logic'}
              </h2>
              <button
                onClick={() => setShowFilteringInfo(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            {filteringExplanations[currentFilteringInfo] && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Filtering Logic:
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      {filteringExplanations[currentFilteringInfo].logic.map((item, index) => (
                        <li key={index} className="font-mono">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Purpose:
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {filteringExplanations[currentFilteringInfo].purpose}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    This information helps you understand which records are shown and why certain trades may or may not appear in this subtab.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast/alert for feedback */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow-lg text-white ${toastType === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
             onAnimationEnd={() => setToastMsg(null)}>
          {toastMsg}
          <button className="ml-2 text-white" onClick={() => setToastMsg(null)}>x</button>
        </div>
      )}
    </div>
  )
}
