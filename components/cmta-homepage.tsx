"use client"
import { BarChart3, DollarSign, AlertTriangle, Users, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { TradeData } from "@/lib/data-processor"

interface CMTAHomepageProps {
  trades: TradeData[]
}

export default function CMTAHomepage({ trades }: CMTAHomepageProps) {
  // Calculate metrics
  const totalTrades = trades.length

  // Calculate total clearing costs (sum of commission, fees, etc.)
  const totalClearingCosts = trades.reduce((sum, trade) => {
    const commission = trade.commission || 0
    const brokerageFee = trade.brokerageFee || 0
    const custodyFee = trade.custodyFee || 0
    const settlementCost = trade.settlementCost || 0

    return sum + commission + brokerageFee + custodyFee + settlementCost
  }, 0)

  // Calculate percentage of trades with pending/failed margin or cost status
  const tradesWithIssues = trades.filter(
    (trade) =>
      trade.marginStatus === "Failed" ||
      trade.marginStatus === "Pending" ||
      trade.costAllocationStatus === "Failed" ||
      trade.costAllocationStatus === "Pending",
  ).length

  const issuePercentage = totalTrades > 0 ? (tradesWithIssues / totalTrades) * 100 : 0

  // Calculate top cost-contributing clients
  const clientCosts = trades.reduce(
    (acc, trade) => {
      const clientId = trade.clientId || "Unknown"
      const cost =
        (trade.commission || 0) + (trade.brokerageFee || 0) + (trade.custodyFee || 0) + (trade.settlementCost || 0)

      if (!acc[clientId]) {
        acc[clientId] = 0
      }
      acc[clientId] += cost
      return acc
    },
    {} as Record<string, number>,
  )

  const topClients = Object.entries(clientCosts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([clientId, cost]) => ({ clientId, cost }))

  // Calculate equity vs FX breakdown
  const equityTrades = trades.filter((trade) => trade.dataSource === "equity" || trade.symbol).length
  const fxTrades = trades.filter((trade) => trade.dataSource === "fx" || trade.currencyPair).length

  // Calculate month-over-month change (mock data for demonstration)
  const isPositiveChange = Math.random() > 0.5
  const changePercentage = (Math.random() * 15).toFixed(1)

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <header className="p-6 bg-white border-b border-gray-200">
        <h1 className="text-3xl font-bold text-black">CMTA Overview</h1>
        <p className="text-gray-600 mt-2">Comprehensive view of all CMTA-related operations and metrics</p>
      </header>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Trades Card */}
        <div className="card-bw p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Trades Captured</p>
              <h3 className="text-2xl font-bold mt-2 text-black">{totalTrades.toLocaleString()}</h3>
              <div className={`flex items-center mt-2 text-sm ${isPositiveChange ? "text-gray-600" : "text-gray-600"}`}>
                {isPositiveChange ? (
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                )}
                <span>{changePercentage}% from last month</span>
              </div>
            </div>
            <div className="h-12 w-12 bg-black rounded-lg flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <div className="flex items-center mr-4">
              <div className="h-3 w-3 rounded-full bg-black mr-1"></div>
              <span>Equity: {equityTrades}</span>
            </div>
            <div className="flex items-center">
              <div className="h-3 w-3 rounded-full bg-gray-500 mr-1"></div>
              <span>FX: {fxTrades}</span>
            </div>
          </div>
        </div>

        {/* Total Clearing Costs Card */}
        <div className="card-bw p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Clearing Costs</p>
              <h3 className="text-2xl font-bold mt-2 text-black">
                ${totalClearingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </h3>
              <div className={`flex items-center mt-2 text-sm text-gray-600`}>
                {isPositiveChange ? (
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                )}
                <span>{(Math.random() * 10).toFixed(1)}% from last month</span>
              </div>
            </div>
            <div className="h-12 w-12 bg-black rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500">Commission</p>
              <p className="font-medium text-black">
                ${(totalClearingCosts * 0.4).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Brokerage</p>
              <p className="font-medium text-black">
                ${(totalClearingCosts * 0.3).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Custody</p>
              <p className="font-medium text-black">
                ${(totalClearingCosts * 0.2).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Settlement</p>
              <p className="font-medium text-black">
                ${(totalClearingCosts * 0.1).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>

        {/* Trades with Issues Card */}
        <div className="card-bw p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Trades with Issues</p>
              <h3 className="text-2xl font-bold mt-2 text-black">{issuePercentage.toFixed(1)}%</h3>
              <div className="flex items-center mt-2 text-sm text-gray-600">
                <span>{tradesWithIssues} trades require attention</span>
              </div>
            </div>
            <div className="h-12 w-12 bg-black rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Margin Issues</span>
              <span className="font-medium text-black">{(tradesWithIssues * 0.6).toFixed(0)}</span>
            </div>
            <Progress value={60} className="h-2 bg-gray-200" />

            <div className="flex justify-between text-sm mb-1 mt-3">
              <span className="text-gray-500">Cost Allocation Issues</span>
              <span className="font-medium text-black">{(tradesWithIssues * 0.4).toFixed(0)}</span>
            </div>
            <Progress value={40} className="h-2 bg-gray-200" />
          </div>
        </div>

        {/* Top Cost-Contributing Clients Card */}
        <div className="card-bw p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Top Cost-Contributing Clients</p>
              <h3 className="text-2xl font-bold mt-2 text-black">{topClients.length}</h3>
            </div>
            <div className="h-12 w-12 bg-black rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {topClients.map((client, index) => (
              <div key={client.clientId} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-black">
                    {index + 1}
                  </div>
                  <span className="ml-2 text-sm font-medium truncate max-w-[120px] text-black">{client.clientId}</span>
                </div>
                <span className="text-sm font-medium text-black">
                  ${client.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional sections */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown by Trade Type */}
        <div className="card-bw p-6">
          <h3 className="text-lg font-semibold mb-4 text-black">Cost Breakdown by Trade Type</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-black">Equity Trades</span>
                <span className="text-black">
                  ${(totalClearingCosts * 0.65).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <Progress value={65} className="h-3 bg-gray-200" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-black">FX Trades</span>
                <span className="text-black">
                  ${(totalClearingCosts * 0.35).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <Progress value={35} className="h-3 bg-gray-200" />
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3 text-black">Top Cost Categories</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Commission</span>
                <span className="font-medium text-black">42%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Brokerage Fees</span>
                <span className="font-medium text-black">28%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Custody Fees</span>
                <span className="font-medium text-black">18%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Settlement Costs</span>
                <span className="font-medium text-black">12%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card-bw p-6">
          <h3 className="text-lg font-semibold mb-4 text-black">Recent Activity</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((_, index) => (
              <div key={index} className="flex items-start">
                <div
                  className={`w-2 h-2 mt-1.5 rounded-full ${
                    index % 3 === 0 ? "bg-gray-600" : index % 3 === 1 ? "bg-gray-500" : "bg-gray-400"
                  } mr-3`}
                ></div>
                <div>
                  <p className="text-sm font-medium text-black">
                    {index % 3 === 0
                      ? "Trade settlement completed"
                      : index % 3 === 1
                        ? "Margin requirement updated"
                        : "Cost allocation failed"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {index % 2 === 0 ? "Client ID: CL-" : "Trade ID: TR-"}
                    {1000 + index * 57} • {index} hour{index !== 1 ? "s" : ""} ago
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-secondary mt-4 w-full text-center">View All Activity</button>
        </div>
      </div>
    </div>
  )
}
