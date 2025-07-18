"use client"

export interface DataColumn {
  name: string
  type: "string" | "number" | "date" | "currency" | "percentage" | "boolean"
  values: any[]
  uniqueCount: number
  nullCount: number
  sampleValues: any[]
  suggestedMapping?: string
}

export interface DataAnalytics {
  totalRecords: number
  columns: DataColumn[]
  dataQuality: {
    completeness: number
    consistency: number
    accuracy: number
    issues: string[]
  }
  businessMetrics: {
    totalTradeValue: number
    averageTradeSize: number
    topCounterparties: Array<{ name: string; count: number; value: number }>
    topSymbols: Array<{ symbol: string; count: number; value: number }>
    settlementStatusBreakdown: Record<string, number>
    tradingVenueBreakdown: Record<string, number>
    monthlyTrends: Array<{ month: string; count: number; value: number }>
  }
}

export function analyzeDataIntelligently(data: any[]): DataAnalytics {
  if (!data || data.length === 0) {
    return createEmptyAnalytics()
  }

  const columns = analyzeColumns(data)
  const dataQuality = assessDataQuality(data, columns)
  const businessMetrics = calculateBusinessMetrics(data, columns)

  return {
    totalRecords: data.length,
    columns,
    dataQuality,
    businessMetrics,
  }
}

function analyzeColumns(data: any[]): DataColumn[] {
  const headers = Object.keys(data[0])

  return headers.map((header) => {
    const values = data.map((row) => row[header]).filter((v) => v !== null && v !== undefined && v !== "")
    const uniqueValues = [...new Set(values)]

    return {
      name: header,
      type: detectColumnType(header, values),
      values: values,
      uniqueCount: uniqueValues.length,
      nullCount: data.length - values.length,
      sampleValues: uniqueValues.slice(0, 5),
      suggestedMapping: suggestFieldMapping(header),
    }
  })
}

function detectColumnType(columnName: string, values: any[]): DataColumn["type"] {
  const name = columnName.toLowerCase()

  // Check for currency fields
  if (
    name.includes("price") ||
    name.includes("value") ||
    name.includes("cost") ||
    name.includes("amount") ||
    name.includes("commission") ||
    name.includes("fee") ||
    name.includes("tax") ||
    name.includes("gain") ||
    name.includes("loss") ||
    name.includes("pnl")
  ) {
    return "currency"
  }

  // Check for date fields
  if (name.includes("date") || name.includes("time") || name.includes("timestamp") || name.includes("booked")) {
    return "date"
  }

  // Check for percentage fields
  if (name.includes("rate") || name.includes("percent")) {
    return "percentage"
  }

  // Check for boolean fields
  if (
    (name.includes("status") || name.includes("flag") || name.includes("check") || name.includes("eligibility")) &&
    values.length > 0
  ) {
    const uniqueValues = [...new Set(values)]
    if (
      uniqueValues.length <= 5 &&
      uniqueValues.some(
        (v) =>
          typeof v === "string" &&
          (v.toLowerCase().includes("yes") ||
            v.toLowerCase().includes("no") ||
            v.toLowerCase().includes("true") ||
            v.toLowerCase().includes("false") ||
            v.toLowerCase().includes("pass") ||
            v.toLowerCase().includes("fail") ||
            v.toLowerCase().includes("complete") ||
            v.toLowerCase().includes("incomplete") ||
            v.toLowerCase().includes("pending") ||
            v.toLowerCase().includes("settled") ||
            v.toLowerCase().includes("confirmed") ||
            v.toLowerCase().includes("disputed")),
      )
    ) {
      return "boolean"
    }
  }

  // Check if numeric
  if (values.length > 0 && values.every((v) => !isNaN(Number(v)))) {
    return "number"
  }

  return "string"
}

function suggestFieldMapping(columnName: string): string | undefined {
  const name = columnName.toLowerCase().trim()

  // Common mappings for both equity and FX trades
  const commonMappings: Record<string, string> = {
    "trade id": "tradeId",
    tradeid: "tradeId",
    id: "tradeId",
    trade_id: "tradeId",
    "trade-id": "tradeId",
    "trade#": "tradeId",
    "order id": "orderId",
    orderid: "orderId",
    order_id: "orderId",
    "order-id": "orderId",
    "client id": "clientId",
    clientid: "clientId",
    client: "clientId",
    client_id: "clientId",
    "client-id": "clientId",
    "customer id": "clientId",
    "account id": "clientId",
    "trade date": "tradeDate",
    tradedate: "tradeDate",
    trade_date: "tradeDate",
    "transaction date": "tradeDate",
    "execution date": "tradeDate",
    date: "tradeDate",
    "settlement date": "settlementDate",
    settlementdate: "settlementDate",
    settlement_date: "settlementDate",
    "settle date": "settlementDate",
    "value date": "settlementDate",
    valuedate: "settlementDate",
    "settlement status": "settlementStatus",
    settlementstatus: "settlementStatus",
    settlement_status: "settlementStatus",
    "settle status": "settlementStatus",
    status: "settlementStatus",
    counterparty: "counterparty",
    "counter party": "counterparty",
    "counterparty name": "counterparty",
    cp: "counterparty",
    broker: "counterparty",
    "trading venue": "tradingVenue",
    tradingvenue: "tradingVenue",
    trading_venue: "tradingVenue",
    venue: "tradingVenue",
    exchange: "tradingVenue",
    market: "tradingVenue",
    executionvenue: "tradingVenue",
    "execution venue": "tradingVenue",
    execution_venue: "tradingVenue",
    "confirmation status": "confirmationStatus",
    confirmationstatus: "confirmationStatus",
    confirmation_status: "confirmationStatus",
    tradestatus: "confirmationStatus",
    "trade status": "confirmationStatus",
    trade_status: "confirmationStatus",
    commission: "commission",
    commissionamount: "commission",
    "commission amount": "commission",
    commission_amount: "commission",
    fee: "commission",
    fees: "commission",
    taxes: "taxes",
    tax: "taxes",
    "tax amount": "taxes",
    "total cost": "totalCost",
    totalcost: "totalCost",
    total_cost: "totalCost",
    "all in cost": "totalCost",
    "all-in cost": "totalCost",
  }

  // Equity-specific mappings
  const equityMappings: Record<string, string> = {
    isin: "isin",
    "isin code": "isin",
    "isin number": "isin",
    symbol: "symbol",
    ticker: "symbol",
    instrument: "symbol",
    security: "symbol",
    "trade type": "tradeType",
    tradetype: "tradeType",
    trade_type: "tradeType",
    type: "tradeType",
    side: "tradeType",
    quantity: "quantity",
    qty: "quantity",
    size: "quantity",
    volume: "quantity",
    price: "price",
    "trade price": "price",
    "execution price": "price",
    "executed price": "price",
    "trade value": "tradeValue",
    tradevalue: "tradeValue",
    trade_value: "tradeValue",
    value: "tradeValue",
    notional: "tradeValue",
    "notional value": "tradeValue",
    "total value": "tradeValue",
    currency: "currency",
    ccy: "currency",
    "currency code": "currency",
    "trader name": "traderName",
    tradername: "traderName",
    trader_name: "traderName",
    trader: "traderName",
    "kyc status": "kycStatus",
    kycstatus: "kycStatus",
    kyc_status: "kycStatus",
    "reference data validated": "referenceDataValidated",
    reference_data_validated: "referenceDataValidated",
    "ref data validated": "referenceDataValidated",
    "country of trade": "countryOfTrade",
    country_of_trade: "countryOfTrade",
    country: "countryOfTrade",
    "ops team notes": "opsTeamNotes",
    ops_team_notes: "opsTeamNotes",
    notes: "opsTeamNotes",
    comments: "opsTeamNotes",
    "pricing source": "pricingSource",
    pricing_source: "pricingSource",
    "market impact cost": "marketImpactCost",
    market_impact_cost: "marketImpactCost",
    "fx rate applied": "fxRateApplied",
    fx_rate_applied: "fxRateApplied",
    "fx rate": "fxRateApplied",
    "net amount": "netAmount",
    netamount: "netAmount",
    net_amount: "netAmount",
    "collateral required": "collateralRequired",
    collateral_required: "collateralRequired",
    margin: "collateralRequired",
    "margin type": "marginType",
    margin_type: "marginType",
    "margin status": "marginStatus",
    margin_status: "marginStatus",
  }

  // FX-specific mappings
  const fxMappings: Record<string, string> = {
    tradetime: "tradeTime",
    "trade time": "tradeTime",
    trade_time: "tradeTime",
    time: "tradeTime",
    traderid: "traderId",
    "trader id": "traderId",
    trader_id: "traderId",
    "dealer id": "traderId",
    dealer: "traderId",
    currencypair: "currencyPair",
    "currency pair": "currencyPair",
    currency_pair: "currencyPair",
    pair: "currencyPair",
    "ccy pair": "currencyPair",
    "fx pair": "currencyPair",
    buysell: "buySell",
    "buy/sell": "buySell",
    buy_sell: "buySell",
    direction: "buySell",
    side: "buySell",
    dealtcurrency: "dealtCurrency",
    "dealt currency": "dealtCurrency",
    dealt_currency: "dealtCurrency",
    basecurrency: "baseCurrency",
    "base currency": "baseCurrency",
    base_currency: "baseCurrency",
    "base ccy": "baseCurrency",
    "primary currency": "baseCurrency",
    termcurrency: "termCurrency",
    "term currency": "termCurrency",
    term_currency: "termCurrency",
    "term ccy": "termCurrency",
    "secondary currency": "termCurrency",
    "quote currency": "termCurrency",
    notionalamount: "notionalAmount",
    "notional amount": "notionalAmount",
    notional_amount: "notionalAmount",
    principal: "notionalAmount",
    amount: "notionalAmount",
    fxrate: "fxRate",
    "fx rate": "fxRate",
    fx_rate: "fxRate",
    rate: "fxRate",
    "exchange rate": "fxRate",
    "execution rate": "fxRate",
    settlementmethod: "settlementMethod",
    "settlement method": "settlementMethod",
    settlement_method: "settlementMethod",
    "settle method": "settlementMethod",
    "settlement type": "settlementMethod",
    producttype: "productType",
    "product type": "productType",
    product_type: "productType",
    product: "productType",
    "instrument type": "productType",
    maturitydate: "maturityDate",
    "maturity date": "maturityDate",
    maturity_date: "maturityDate",
    expiry: "maturityDate",
    "expiry date": "maturityDate",
    confirmationtimestamp: "confirmationTimestamp",
    "confirmation timestamp": "confirmationTimestamp",
    confirmation_timestamp: "confirmationTimestamp",
    "confirm time": "confirmationTimestamp",
    bookinglocation: "bookingLocation",
    "booking location": "bookingLocation",
    booking_location: "bookingLocation",
    location: "bookingLocation",
    portfolio: "portfolio",
    book: "portfolio",
    "trading book": "portfolio",
    tradeversion: "tradeVersion",
    "trade version": "tradeVersion",
    trade_version: "tradeVersion",
    version: "tradeVersion",
    cancellationflag: "cancellationFlag",
    "cancellation flag": "cancellationFlag",
    cancellation_flag: "cancellationFlag",
    cancelled: "cancellationFlag",
    amendmentflag: "amendmentFlag",
    "amendment flag": "amendmentFlag",
    amendment_flag: "amendmentFlag",
    amended: "amendmentFlag",
    risksystemid: "riskSystemId",
    "risk system id": "riskSystemId",
    risk_system_id: "riskSystemId",
    "risk id": "riskSystemId",
    regulatoryreportingstatus: "regulatoryReportingStatus",
    "regulatory reporting status": "regulatoryReportingStatus",
    regulatory_reporting_status: "regulatoryReportingStatus",
    "reg reporting": "regulatoryReportingStatus",
    tradesourcesystem: "tradeSourceSystem",
    "trade source system": "tradeSourceSystem",
    trade_source_system: "tradeSourceSystem",
    "source system": "tradeSourceSystem",
    confirmationmethod: "confirmationMethod",
    "confirmation method": "confirmationMethod",
    confirmation_method: "confirmationMethod",
    "confirm method": "confirmationMethod",
    settlementinstructions: "settlementInstructions",
    "settlement instructions": "settlementInstructions",
    settlement_instructions: "settlementInstructions",
    "settle instructions": "settlementInstructions",
    custodian: "custodian",
    "custodian bank": "custodian",
    nettingeligibility: "nettingEligibility",
    "netting eligibility": "nettingEligibility",
    netting_eligibility: "nettingEligibility",
    "eligible for netting": "nettingEligibility",
    tradecompliancestatus: "tradeComplianceStatus",
    "trade compliance status": "tradeComplianceStatus",
    trade_compliance_status: "tradeComplianceStatus",
    "compliance status": "tradeComplianceStatus",
    kyccheck: "kycCheck",
    "kyc check": "kycCheck",
    kyc_check: "kycCheck",
    sanctionsscreening: "sanctionsScreening",
    "sanctions screening": "sanctionsScreening",
    sanctions_screening: "sanctionsScreening",
    sanctions: "sanctionsScreening",
    exceptionflag: "exceptionFlag",
    "exception flag": "exceptionFlag",
    exception_flag: "exceptionFlag",
    exception: "exceptionFlag",
    exceptionnotes: "exceptionNotes",
    "exception notes": "exceptionNotes",
    exception_notes: "exceptionNotes",
    "exception comments": "exceptionNotes",
    audittrailref: "auditTrailRef",
    "audit trail ref": "auditTrailRef",
    audit_trail_ref: "auditTrailRef",
    "audit ref": "auditTrailRef",
    commissioncurrency: "commissionCurrency",
    "commission currency": "commissionCurrency",
    commission_currency: "commissionCurrency",
    "fee currency": "commissionCurrency",
    brokeragefee: "brokerageFee",
    "brokerage fee": "brokerageFee",
    brokerage_fee: "brokerageFee",
    brokerage: "brokerageFee",
    brokeragecurrency: "brokerageCurrency",
    "brokerage currency": "brokerageCurrency",
    brokerage_currency: "brokerageCurrency",
    custodyfee: "custodyFee",
    "custody fee": "custodyFee",
    custody_fee: "custodyFee",
    custodycurrency: "custodyCurrency",
    "custody currency": "custodyCurrency",
    custody_currency: "custodyCurrency",
    settlementcost: "settlementCost",
    "settlement cost": "settlementCost",
    settlement_cost: "settlementCost",
    "settle cost": "settlementCost",
    settlementcurrency: "settlementCurrency",
    "settlement currency": "settlementCurrency",
    settlement_currency: "settlementCurrency",
    "settle currency": "settlementCurrency",
    fxgainloss: "fxGainLoss",
    "fx gain loss": "fxGainLoss",
    fx_gain_loss: "fxGainLoss",
    "fx pnl": "fxGainLoss",
    pnlcalculated: "pnlCalculated",
    "pnl calculated": "pnlCalculated",
    pnl_calculated: "pnlCalculated",
    pnl: "pnlCalculated",
    "profit and loss": "pnlCalculated",
    costallocationstatus: "costAllocationStatus",
    "cost allocation status": "costAllocationStatus",
    cost_allocation_status: "costAllocationStatus",
    "allocation status": "costAllocationStatus",
    costcenter: "costCenter",
    "cost center": "costCenter",
    cost_center: "costCenter",
    expenseapprovalstatus: "expenseApprovalStatus",
    "expense approval status": "expenseApprovalStatus",
    expense_approval_status: "expenseApprovalStatus",
    "expense status": "expenseApprovalStatus",
    costbookeddate: "costBookedDate",
    "cost booked date": "costBookedDate",
    cost_booked_date: "costBookedDate",
    "booking date": "costBookedDate",
  }

  // Combine all mappings
  const allMappings = { ...commonMappings, ...equityMappings, ...fxMappings }

  // Try exact match first
  if (allMappings[name]) {
    return allMappings[name]
  }

  // Try partial matches
  for (const [key, value] of Object.entries(allMappings)) {
    if (name.includes(key) || key.includes(name)) {
      return value
    }
  }

  return undefined
}

function assessDataQuality(data: any[], columns: DataColumn[]) {
  const totalFields = data.length * columns.length
  const nullFields = columns.reduce((sum, col) => sum + col.nullCount, 0)
  const completeness = ((totalFields - nullFields) / totalFields) * 100

  const issues: string[] = []

  // Check for high null rates
  columns.forEach((col) => {
    const nullRate = (col.nullCount / data.length) * 100
    if (nullRate > 20) {
      issues.push(`${col.name} has ${nullRate.toFixed(1)}% missing values`)
    }
  })

  // Check for data consistency - for both equity and FX trades
  const tradeValueCol = columns.find((c) => c.suggestedMapping === "tradeValue")
  const priceCol = columns.find((c) => c.suggestedMapping === "price")
  const quantityCol = columns.find((c) => c.suggestedMapping === "quantity")

  // For equity trades
  if (tradeValueCol && priceCol && quantityCol) {
    // Check if trade value = price * quantity (with some tolerance)
    let inconsistentCount = 0
    data.forEach((row) => {
      const tradeValue = Number.parseFloat(row[tradeValueCol.name]) || 0
      const price = Number.parseFloat(row[priceCol.name]) || 0
      const quantity = Number.parseFloat(row[quantityCol.name]) || 0
      const calculated = price * quantity

      if (Math.abs(tradeValue - calculated) > calculated * 0.01) {
        // 1% tolerance
        inconsistentCount++
      }
    })

    if (inconsistentCount > 0) {
      issues.push(`${inconsistentCount} records have inconsistent trade value calculations`)
    }
  }

  // For FX trades
  const notionalCol = columns.find((c) => c.suggestedMapping === "notionalAmount")
  const fxRateCol = columns.find((c) => c.suggestedMapping === "fxRate")

  if (notionalCol && fxRateCol) {
    let inconsistentCount = 0
    data.forEach((row) => {
      if (row.ProductType === "Spot" || !row.ProductType) {
        // Only check for spot trades
        const notional = Number.parseFloat(row[notionalCol.name]) || 0
        const fxRate = Number.parseFloat(row[fxRateCol.name]) || 0

        // Check if FX rate is reasonable (not zero or extremely high)
        if (fxRate > 0 && fxRate < 10000 && notional === 0) {
          inconsistentCount++
        }
      }
    })

    if (inconsistentCount > 0) {
      issues.push(`${inconsistentCount} FX trades have zero notional amount with valid FX rates`)
    }
  }

  return {
    completeness,
    consistency: issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 10),
    accuracy: 95, // Placeholder - would need more sophisticated checks
    issues,
  }
}

function calculateBusinessMetrics(data: any[], columns: DataColumn[]) {
  // Find relevant columns for both equity and FX trades
  const tradeValueCol = columns.find((c) => c.suggestedMapping === "tradeValue")
  const notionalCol = columns.find((c) => c.suggestedMapping === "notionalAmount")
  const fxRateCol = columns.find((c) => c.suggestedMapping === "fxRate")
  const counterpartyCol = columns.find((c) => c.suggestedMapping === "counterparty")
  const symbolCol = columns.find((c) => c.suggestedMapping === "symbol")
  const currencyPairCol = columns.find((c) => c.suggestedMapping === "currencyPair")
  const settlementStatusCol = columns.find((c) => c.suggestedMapping === "settlementStatus")
  const tradingVenueCol = columns.find((c) => c.suggestedMapping === "tradingVenue")
  const executionVenueCol = columns.find((c) => c.suggestedMapping === "executionVenue")
  const tradeDateCol = columns.find((c) => c.suggestedMapping === "tradeDate")

  // Calculate total trade value across both equity and FX trades
  let totalTradeValue = 0

  data.forEach((row) => {
    if (tradeValueCol && row[tradeValueCol.name]) {
      // For equity trades
      totalTradeValue += Number.parseFloat(row[tradeValueCol.name]) || 0
    } else if (notionalCol && fxRateCol && row[notionalCol.name] && row[fxRateCol.name]) {
      // For FX trades
      const notional = Number.parseFloat(row[notionalCol.name]) || 0
      const fxRate = Number.parseFloat(row[fxRateCol.name]) || 0
      totalTradeValue += notional * fxRate
    }
  })

  const averageTradeSize = totalTradeValue / data.length

  // Top counterparties
  const counterpartyStats: Record<string, { count: number; value: number }> = {}
  if (counterpartyCol) {
    data.forEach((row) => {
      const cp = row[counterpartyCol.name]
      if (!cp) return

      let value = 0
      if (tradeValueCol && row[tradeValueCol.name]) {
        value = Number.parseFloat(row[tradeValueCol.name]) || 0
      } else if (notionalCol && fxRateCol && row[notionalCol.name] && row[fxRateCol.name]) {
        const notional = Number.parseFloat(row[notionalCol.name]) || 0
        const fxRate = Number.parseFloat(row[fxRateCol.name]) || 0
        value = notional * fxRate
      }

      if (!counterpartyStats[cp]) {
        counterpartyStats[cp] = { count: 0, value: 0 }
      }
      counterpartyStats[cp].count++
      counterpartyStats[cp].value += value
    })
  }

  const topCounterparties = Object.entries(counterpartyStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  // Top symbols/currency pairs
  const symbolStats: Record<string, { count: number; value: number }> = {}

  data.forEach((row) => {
    let symbol = ""
    let value = 0

    // Handle both equity symbols and FX currency pairs
    if (symbolCol && row[symbolCol.name]) {
      symbol = row[symbolCol.name]
      if (tradeValueCol) {
        value = Number.parseFloat(row[tradeValueCol.name]) || 0
      }
    } else if (currencyPairCol && row[currencyPairCol.name]) {
      symbol = row[currencyPairCol.name]
      if (notionalCol && fxRateCol) {
        const notional = Number.parseFloat(row[notionalCol.name]) || 0
        const fxRate = Number.parseFloat(row[fxRateCol.name]) || 0
        value = notional * fxRate
      }
    }

    if (symbol) {
      if (!symbolStats[symbol]) {
        symbolStats[symbol] = { count: 0, value: 0 }
      }
      symbolStats[symbol].count++
      symbolStats[symbol].value += value
    }
  })

  const topSymbols = Object.entries(symbolStats)
    .map(([symbol, stats]) => ({ symbol, ...stats }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  // Settlement status breakdown
  const settlementStatusBreakdown: Record<string, number> = {}
  if (settlementStatusCol) {
    data.forEach((row) => {
      const status = row[settlementStatusCol.name] || "Unknown"
      settlementStatusBreakdown[status] = (settlementStatusBreakdown[status] || 0) + 1
    })
  }

  // Trading venue breakdown - combine trading venue and execution venue
  const tradingVenueBreakdown: Record<string, number> = {}
  data.forEach((row) => {
    let venue = ""
    if (tradingVenueCol && row[tradingVenueCol.name]) {
      venue = row[tradingVenueCol.name]
    } else if (executionVenueCol && row[executionVenueCol.name]) {
      venue = row[executionVenueCol.name]
    }

    if (venue) {
      tradingVenueBreakdown[venue] = (tradingVenueBreakdown[venue] || 0) + 1
    }
  })

  // Monthly trends
  const monthlyStats: Record<string, { count: number; value: number }> = {}
  if (tradeDateCol) {
    data.forEach((row) => {
      const dateStr = row[tradeDateCol.name]
      if (dateStr) {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

          let value = 0
          if (tradeValueCol && row[tradeValueCol.name]) {
            value = Number.parseFloat(row[tradeValueCol.name]) || 0
          } else if (notionalCol && fxRateCol && row[notionalCol.name] && row[fxRateCol.name]) {
            const notional = Number.parseFloat(row[notionalCol.name]) || 0
            const fxRate = Number.parseFloat(row[fxRateCol.name]) || 0
            value = notional * fxRate
          }

          if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { count: 0, value: 0 }
          }
          monthlyStats[monthKey].count++
          monthlyStats[monthKey].value += value
        }
      }
    })
  }

  const monthlyTrends = Object.entries(monthlyStats)
    .map(([month, stats]) => ({ month, ...stats }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalTradeValue,
    averageTradeSize,
    topCounterparties,
    topSymbols,
    settlementStatusBreakdown,
    tradingVenueBreakdown,
    monthlyTrends,
  }
}

function createEmptyAnalytics(): DataAnalytics {
  return {
    totalRecords: 0,
    columns: [],
    dataQuality: {
      completeness: 0,
      consistency: 0,
      accuracy: 0,
      issues: [],
    },
    businessMetrics: {
      totalTradeValue: 0,
      averageTradeSize: 0,
      topCounterparties: [],
      topSymbols: [],
      settlementStatusBreakdown: {},
      tradingVenueBreakdown: {},
      monthlyTrends: [],
    },
  }
}

export function autoMapFields(columns: DataColumn[]): Record<string, string> {
  const mapping: Record<string, string> = {}

  columns.forEach((column) => {
    if (column.suggestedMapping) {
      mapping[column.suggestedMapping] = column.name
    }
  })

  return mapping
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}
