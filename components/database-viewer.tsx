"use client"

import { useState, useEffect } from "react"
import { Database, RefreshCw, Eye } from "lucide-react"
import { useSupabaseSync } from "@/hooks/use-supabase-sync"
import { safeToCurrency } from "@/lib/data-processor"

export default function DatabaseViewer() {
  const { loadFromDatabase, syncing, syncStatus } = useSupabaseSync()
  const [data, setData] = useState<any>({ trades: [], claims: [], bulkClaims: [] })
  const [activeTab, setActiveTab] = useState<"trades" | "claims" | "bulk">("trades")
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const result = await loadFromDatabase()
    setData(result)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-black rounded-xl">
                <Database className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Database Viewer</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  View all data stored in Supabase exactly as it appears in your Interest Claims app
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={loadData} disabled={loading} className="btn-secondary flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Sync Status */}
          {syncStatus && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">{syncStatus}</p>
            </div>
          )}

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.trades.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Trades</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.claims.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Registered Claims</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.bulkClaims.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Bulk Claims</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 mb-6">
          <div className="flex space-x-1 p-1">
            {[
              { key: "trades", label: "Trades Data", count: data.trades.length },
              { key: "claims", label: "Claims Data", count: data.claims.length },
              { key: "bulk", label: "Bulk Claims", count: data.bulkClaims.length },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === key
                    ? "bg-black text-white"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <span>{label}</span>
                <span className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full text-xs">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
          {activeTab === "trades" && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Trades Data (Exactly as shown in app)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Trade ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Client ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Counterparty</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Trade Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Value Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                        Settlement Date
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                        SLA Breach Days
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Trade Value</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Claim Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                        Settlement Status
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Eligibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data.trades.map((trade: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{trade.tradeId}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{trade.clientId}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{trade.counterparty}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{trade.tradeDate}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{trade.valueDate}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{trade.settlementDate}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              trade.slaBreachDays > 3
                                ? "bg-red-100 text-red-800"
                                : trade.slaBreachDays > 2
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                            }`}
                          >
                            {trade.slaBreachDays} days
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {safeToCurrency(trade.tradeValue)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {safeToCurrency(trade.claimAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              trade.settlementStatus === "Failed"
                                ? "bg-red-100 text-red-800"
                                : trade.settlementStatus === "Delayed"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {trade.settlementStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              trade.eligibilityStatus === "Eligible"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {trade.eligibilityStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "claims" && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Registered Claims (Exactly as registered in app)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Claim ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Trade ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Client ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Counterparty</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Claim Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Currency</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                        Workflow Stage
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                        Registration Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data.claims.map((claim: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{claim.claim_id}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{claim.trade_reference}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{claim.client_id}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{claim.counterparty}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {safeToCurrency(claim.claim_amount)}
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{claim.currency}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {claim.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {claim.workflow_stage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{claim.registration_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "bulk" && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Bulk Claims (Exactly as registered in app)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Bulk ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Total Claims</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                        Registration Date
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data.bulkClaims.map((bulk: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{bulk.bulkId}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{bulk.totalClaims}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{bulk.registrationDate}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {bulk.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="btn-secondary flex items-center gap-2">
                            <Eye className="h-4 w-4" />
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

          {/* Empty State */}
          {activeTab === "trades" && data.trades.length === 0 && (
            <div className="text-center py-12">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Trades Data</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Upload some trade data in the Interest Claims app to see it here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
