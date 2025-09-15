"use client"

export type TradeData = {
  // Common fields for both equity and FX trades
  tradeId: string
  orderId?: string
  clientId?: string
  tradeType: string
  tradeDate: string
  settlementDate: string
  settlementStatus: string
  counterparty: string
  tradingVenue: string
  confirmationStatus: string
  commission?: number
  taxes?: number
  totalCost?: number

  // Equity-specific fields
  isin?: string
  symbol?: string
  quantity?: number
  price?: number
  tradeValue?: number
  currency?: string
  traderName?: string
  kycStatus?: string
  referenceDataValidated?: string
  countryOfTrade?: string
  opsTeamNotes?: string
  pricingSource?: string
  marketImpactCost?: number
  fxRateApplied?: number
  netAmount?: number
  collateralRequired?: number
  marginType?: string
  marginStatus?: string

  // FX-specific fields
  tradeTime?: string
  traderId?: string
  currencyPair?: string
  buySell?: string
  dealtCurrency?: string
  baseCurrency?: string
  termCurrency?: string
  notionalAmount?: number
  fxRate?: number
  settlementMethod?: string
  broker?: string
  executionVenue?: string
  productType?: string
  maturityDate?: string
  confirmationTimestamp?: string
  bookingLocation?: string
  portfolio?: string
  tradeVersion?: string
  cancellationFlag?: string
  amendmentFlag?: string
  riskSystemId?: string
  regulatoryReportingStatus?: string
  tradeSourceSystem?: string
  confirmationMethod?: string
  settlementInstructions?: string
  custodian?: string
  nettingEligibility?: string
  tradeComplianceStatus?: string
  kycCheck?: string
  sanctionsScreening?: string
  exceptionFlag?: string
  exceptionNotes?: string
  auditTrailRef?: string
  commissionAmount?: number
  commissionCurrency?: string
  brokerageFee?: number
  brokerageCurrency?: string
  custodyFee?: number
  custodyCurrency?: string
  settlementCost?: number
  settlementCurrency?: string
  fxGainLoss?: number
  pnlCalculated?: number
  costAllocationStatus?: string
  costCenter?: string
  expenseApprovalStatus?: string
  costBookedDate?: string

  // Metadata
  tradeType_original?: string // To store original value before normalization
  dataSource?: string // To track if it's from equity or FX dataset
} & {
  [key: string]: any;
};

export function parseCSVData(csvText: string, dataType: "equity" | "fx" = "equity"): TradeData[] {
  const lines = csvText.split("\n")
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))

  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      // Better CSV parsing to handle commas within quoted fields
      const values = []
      let current = ""
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === "," && !inQuotes) {
          values.push(current.trim().replace(/"/g, ""))
          current = ""
        } else {
          current += char
        }
      }
      values.push(current.trim().replace(/"/g, ""))

      if (dataType === "equity") {
        return parseEquityTrade(headers, values)
      } else {
        return parseFXTrade(headers, values)
      }
    })
}

function parseEquityTrade(headers: string[], values: string[]): TradeData {
  const trade: any = {}
  trade.dataSource = "equity"

  headers.forEach((header, index) => {
    const value = values[index] || ""

    switch (header) {
      case "Trade ID":
        trade.tradeId = value || `TID-${index}`
        break
      case "Order ID":
        trade.orderId = value || `OID-${index}`
        break
      case "Client ID":
        trade.clientId = value || `CID-${index}`
        break
      case "ISIN":
        trade.isin = value || "N/A"
        break
      case "Symbol":
        trade.symbol = value || "N/A"
        break
      case "Trade Type":
        trade.tradeType = value || "Buy"
        trade.tradeType_original = value
        break
      case "Quantity":
        trade.quantity = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "Price":
        trade.price = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "Trade Value":
        trade.tradeValue = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "Currency":
        trade.currency = value || "USD"
        break
      case "Trade Date":
        trade.tradeDate = value || new Date().toLocaleDateString()
        break
      case "Settlement Date":
        trade.settlementDate = value || new Date().toLocaleDateString()
        break
      case "Settlement Status":
        trade.settlementStatus = value || "Pending"
        break
      case "Counterparty":
        trade.counterparty = value || "Unknown"
        break
      case "Trading Venue":
        trade.tradingVenue = value || "Unknown"
        break
      case "Trader Name":
        trade.traderName = value || "Unknown"
        break
      case "KYC Status":
        trade.kycStatus = value || "Pending"
        break
      case "Reference Data Validated":
        trade.referenceDataValidated = value || "No"
        break
      case "Commission":
        trade.commission = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "Taxes":
        trade.taxes = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "Total Cost":
        trade.totalCost = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "Confirmation Status":
        trade.confirmationStatus = value || "Pending"
        break
      case "Country of Trade":
        trade.countryOfTrade = value || "US"
        break
      case "Ops Team Notes":
        trade.opsTeamNotes = value || ""
        break
      case "Pricing Source":
        trade.pricingSource = value || "Unknown"
        break
      case "Market Impact Cost":
        trade.marketImpactCost = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "FX Rate Applied":
        trade.fxRateApplied = Number.parseFloat(value.replace(/,/g, "")) || 1
        break
      case "Net Amount":
        trade.netAmount = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "Collateral Required":
        trade.collateralRequired = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "Margin Type":
        trade.marginType = value || "Initial"
        break
      case "Margin Status":
        trade.marginStatus = value || "Pending"
        break
    }
  })

  return trade as TradeData
}

function parseFXTrade(headers: string[], values: string[]): TradeData {
  const trade: any = {}
  trade.dataSource = "fx"

  headers.forEach((header, index) => {
    const value = values[index] || ""

    switch (header) {
      case "TradeID":
        trade.tradeId = value || `FX-${index}`
        break
      case "TradeDate":
        trade.tradeDate = value || new Date().toLocaleDateString()
        break
      case "ValueDate":
        trade.settlementDate = value || new Date().toLocaleDateString()
        break
      case "TradeTime":
        trade.tradeTime = value || ""
        break
      case "TraderID":
        trade.traderId = value || ""
        break
      case "Counterparty":
        trade.counterparty = value || "Unknown"
        break
      case "CurrencyPair":
        trade.currencyPair = value || ""
        break
      case "BuySell":
        trade.buySell = value || ""
        trade.tradeType = value || "Buy" // Normalize to common field
        trade.tradeType_original = value
        break
      case "DealtCurrency":
        trade.dealtCurrency = value || ""
        break
      case "BaseCurrency":
        trade.baseCurrency = value || ""
        break
      case "TermCurrency":
        trade.termCurrency = value || ""
        break
      case "NotionalAmount":
        trade.notionalAmount = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "FXRate":
        trade.fxRate = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "TradeStatus":
        trade.confirmationStatus = value || "Pending" // Map to common field
        break
      case "SettlementStatus":
        trade.settlementStatus = value || "Pending"
        break
      case "SettlementMethod":
        trade.settlementMethod = value || ""
        break
      case "Broker":
        trade.broker = value || ""
        break
      case "ExecutionVenue":
        trade.executionVenue = value || ""
        trade.tradingVenue = value || "Unknown" // Map to common field
        break
      case "ProductType":
        trade.productType = value || ""
        break
      case "MaturityDate":
        trade.maturityDate = value || ""
        break
      case "ConfirmationTimestamp":
        trade.confirmationTimestamp = value || ""
        break
      case "SettlementDate":
        if (!trade.settlementDate) {
          trade.settlementDate = value || new Date().toLocaleDateString()
        }
        break
      case "BookingLocation":
        trade.bookingLocation = value || ""
        break
      case "Portfolio":
        trade.portfolio = value || ""
        break
      case "TradeVersion":
        trade.tradeVersion = value || ""
        break
      case "CancellationFlag":
        trade.cancellationFlag = value || ""
        break
      case "AmendmentFlag":
        trade.amendmentFlag = value || ""
        break
      case "RiskSystemID":
        trade.riskSystemId = value || ""
        break
      case "RegulatoryReportingStatus":
        trade.regulatoryReportingStatus = value || ""
        break
      case "TradeSourceSystem":
        trade.tradeSourceSystem = value || ""
        break
      case "ConfirmationMethod":
        trade.confirmationMethod = value || ""
        break
      case "ConfirmationStatus":
        if (!trade.confirmationStatus) {
          trade.confirmationStatus = value || "Pending"
        }
        break
      case "SettlementInstructions":
        trade.settlementInstructions = value || ""
        break
      case "Custodian":
        trade.custodian = value || ""
        break
      case "NettingEligibility":
        trade.nettingEligibility = value || ""
        break
      case "TradeComplianceStatus":
        trade.tradeComplianceStatus = value || ""
        break
      case "KYCCheck":
        trade.kycCheck = value || ""
        trade.kycStatus = value || "Pending" // Map to common field
        break
      case "SanctionsScreening":
        trade.sanctionsScreening = value || ""
        break
      case "ExceptionFlag":
        trade.exceptionFlag = value || ""
        break
      case "ExceptionNotes":
        trade.exceptionNotes = value || ""
        break
      case "AuditTrailRef":
        trade.auditTrailRef = value || ""
        break
      case "CommissionAmount":
        trade.commissionAmount = Number.parseFloat(value.replace(/,/g, "")) || 0
        trade.commission = Number.parseFloat(value.replace(/,/g, "")) || 0 // Map to common field
        break
      case "CommissionCurrency":
        trade.commissionCurrency = value || ""
        break
      case "BrokerageFee":
        trade.brokerageFee = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "BrokerageCurrency":
        trade.brokerageCurrency = value || ""
        break
      case "CustodyFee":
        trade.custodyFee = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "CustodyCurrency":
        trade.custodyCurrency = value || ""
        break
      case "SettlementCost":
        trade.settlementCost = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "SettlementCurrency":
        trade.settlementCurrency = value || ""
        break
      case "FXGainLoss":
        trade.fxGainLoss = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "PnlCalculated":
        trade.pnlCalculated = Number.parseFloat(value.replace(/,/g, "")) || 0
        break
      case "CostAllocationStatus":
        trade.costAllocationStatus = value || ""
        break
      case "CostCenter":
        trade.costCenter = value || ""
        break
      case "ExpenseApprovalStatus":
        trade.expenseApprovalStatus = value || ""
        break
      case "CostBookedDate":
        trade.costBookedDate = value || ""
        break
    }
  })

  return trade as TradeData
}

export function calculateSummaryMetrics(trades: TradeData[]) {
  const totalTrades = trades.length

  // Handle both equity and FX trades
  const settledTrades = trades.filter((t) => t.settlementStatus === "Settled").length
  const successRate = totalTrades > 0 ? ((settledTrades / totalTrades) * 100).toFixed(1) : "0"

  // For KYC status, check both fields
  const failedKYC = trades.filter((t) => t.kycStatus === "Failed" || t.kycCheck === "Incomplete").length
  const failedConfirmations = trades.filter(
    (t) => t.confirmationStatus === "Failed" || t.confirmationStatus === "Disputed",
  ).length
  const totalErrors = failedKYC + failedConfirmations

  // Calculate average trade value based on available fields
  let avgTradeValue = "0"
  if (trades.length > 0) {
    const totalValue = trades.reduce((sum, t) => {
      if (t.dataSource === "equity" && t.tradeValue) {
        return sum + t.tradeValue
      } else if (t.dataSource === "fx" && t.notionalAmount && t.fxRate) {
        return sum + t.notionalAmount * t.fxRate
      }
      return sum
    }, 0)
    avgTradeValue = (totalValue / trades.length).toFixed(2)
  }

  // Get trading venues from both datasets
  const tradingVenues = new Set(trades.map((t) => t.tradingVenue || t.executionVenue).filter(Boolean))

  return [
    { label: "Total Trades Captured", value: totalTrades.toLocaleString() },
    { label: "Settlement Success Rate", value: `${successRate}%` },
    { label: "Average Trade Value", value: `$${avgTradeValue}` },
    { label: "Active Trading Venues", value: tradingVenues.size.toString() },
    { label: "Error Alerts", value: totalErrors.toString() },
  ]
}

// Generate sample data instead of fetching from files
function generateSampleEquityTrades(): TradeData[] {
  const sampleTrades: TradeData[] = []

  for (let i = 1; i <= 50; i++) {
    sampleTrades.push({
      tradeId: `EQ-${i.toString().padStart(6, "0")}`,
      orderId: `ORD-${i.toString().padStart(6, "0")}`,
      clientId: `CLIENT-${Math.floor(Math.random() * 100) + 1}`,
      tradeType: Math.random() > 0.5 ? "Buy" : "Sell",
      tradeDate: new Date(
        2024,
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1,
      ).toLocaleDateString(),
      settlementDate: new Date(
        2024,
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1,
      ).toLocaleDateString(),
      settlementStatus: ["Settled", "Pending", "Failed"][Math.floor(Math.random() * 3)],
      counterparty: ["Goldman Sachs", "Morgan Stanley", "JP Morgan", "Citi", "Bank of America"][
        Math.floor(Math.random() * 5)
      ],
      tradingVenue: ["NYSE", "NASDAQ", "LSE", "Euronext"][Math.floor(Math.random() * 4)],
      confirmationStatus: ["Confirmed", "Pending", "Failed"][Math.floor(Math.random() * 3)],
      isin: `US${Math.random().toString().substr(2, 10)}`,
      symbol: ["AAPL", "GOOGL", "MSFT", "TSLA", "AMZN", "META", "NVDA"][Math.floor(Math.random() * 7)],
      quantity: Math.floor(Math.random() * 10000) + 100,
      price: Math.random() * 500 + 50,
      tradeValue: Math.random() * 1000000 + 50000,
      currency: "USD",
      traderName: ["John Smith", "Jane Doe", "Mike Johnson", "Sarah Wilson"][Math.floor(Math.random() * 4)],
      kycStatus: ["Passed", "Failed", "Pending"][Math.floor(Math.random() * 3)],
      referenceDataValidated: Math.random() > 0.3 ? "Yes" : "No",
      commission: Math.random() * 1000 + 50,
      taxes: Math.random() * 500 + 25,
      totalCost: Math.random() * 2000 + 100,
      countryOfTrade: "US",
      marketImpactCost: Math.random() * 100,
      fxRateApplied: 1.0,
      netAmount: Math.random() * 1000000 + 50000,
      collateralRequired: Math.random() * 50000,
      marginType: ["Initial", "Variation"][Math.floor(Math.random() * 2)],
      marginStatus: ["Satisfied", "Pending"][Math.floor(Math.random() * 2)],
      dataSource: "equity",
    })
  }

  return sampleTrades
}

function generateSampleFXTrades(): TradeData[] {
  const sampleTrades: TradeData[] = []

  for (let i = 1; i <= 50; i++) {
    sampleTrades.push({
      tradeId: `FX-${i.toString().padStart(6, "0")}`,
      tradeType: Math.random() > 0.5 ? "Buy" : "Sell",
      tradeDate: new Date(
        2024,
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1,
      ).toLocaleDateString(),
      settlementDate: new Date(
        2024,
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1,
      ).toLocaleDateString(),
      settlementStatus: ["Settled", "Pending", "Failed"][Math.floor(Math.random() * 3)],
      counterparty: ["Deutsche Bank", "UBS", "Credit Suisse", "Barclays", "HSBC"][Math.floor(Math.random() * 5)],
      tradingVenue: ["EBS", "Reuters", "Bloomberg", "Currenex"][Math.floor(Math.random() * 4)],
      confirmationStatus: ["Confirmed", "Pending", "Failed"][Math.floor(Math.random() * 3)],
      tradeTime: `${Math.floor(Math.random() * 24)}:${Math.floor(Math.random() * 60)}:${Math.floor(Math.random() * 60)}`,
      traderId: `TRADER-${Math.floor(Math.random() * 100) + 1}`,
      currencyPair: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF"][Math.floor(Math.random() * 5)],
      buySell: Math.random() > 0.5 ? "Buy" : "Sell",
      baseCurrency: ["EUR", "GBP", "USD", "AUD"][Math.floor(Math.random() * 4)],
      termCurrency: ["USD", "JPY", "CHF", "CAD"][Math.floor(Math.random() * 4)],
      notionalAmount: Math.random() * 10000000 + 1000000,
      fxRate: Math.random() * 2 + 0.5,
      settlementMethod: ["Standard", "Same Day", "Next Day"][Math.floor(Math.random() * 3)],
      broker: ["Prime Broker A", "Prime Broker B", "Prime Broker C"][Math.floor(Math.random() * 3)],
      executionVenue: ["EBS", "Reuters", "Bloomberg"][Math.floor(Math.random() * 3)],
      productType: ["Spot", "Forward", "Swap"][Math.floor(Math.random() * 3)],
      kycCheck: ["Complete", "Incomplete", "Pending"][Math.floor(Math.random() * 3)],
      kycStatus: ["Passed", "Failed", "Pending"][Math.floor(Math.random() * 3)],
      commissionAmount: Math.random() * 1000 + 50,
      commission: Math.random() * 1000 + 50,
      brokerageFee: Math.random() * 500 + 25,
      settlementCost: Math.random() * 200 + 10,
      fxGainLoss: (Math.random() - 0.5) * 10000,
      pnlCalculated: (Math.random() - 0.5) * 50000,
      costAllocationStatus: ["Allocated", "Pending"][Math.floor(Math.random() * 2)],
      dataSource: "fx",
    })
  }

  return sampleTrades
}

export async function fetchTradeData(): Promise<TradeData[]> {
  try {
    // Try to fetch from files first, but fallback to sample data if files don't exist
    try {
      const equityResponse = await fetch("/data/equity_trade_lifecycle_dataset.csv")
      const fxResponse = await fetch("/data/fx_trade_lifecycle_full_dataset.csv")

      if (equityResponse.ok && fxResponse.ok) {
        const equityCsvText = await equityResponse.text()
        const fxCsvText = await fxResponse.text()

        const equityTrades = parseCSVData(equityCsvText, "equity")
        const fxTrades = parseCSVData(fxCsvText, "fx")

        return [...equityTrades, ...fxTrades]
      }
    } catch (fetchError) {
      console.log("CSV files not found, using sample data")
    }

    // Generate sample data if files are not available
    const equityTrades = generateSampleEquityTrades()
    const fxTrades = generateSampleFXTrades()

    return [...equityTrades, ...fxTrades]
  } catch (error) {
    console.error("Error generating trade data:", error)
    return []
  }
}

// Add a safe number formatter
export function safeToLocaleString(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "0"
  }
  return value.toLocaleString()
}

// Add a safe currency formatter
export function safeToCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "$0.00"
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
