import type { TradeData } from "@/lib/data-processor"

interface InvoiceDocumentProps {
  trade: TradeData
}

// Define dispute types - EXACTLY 10 types
const DISPUTE_TYPES = [
  "Overcharging",
  "Duplicate Charges",
  "Missing Trades",
  "Wrong Counterparty or Account",
  "Incorrect Tax Application",
  "Service Not Rendered",
  "Fail Charges Disputed",
  "Currency Conversion Error",
  "Wrong Rate Card Applied",
  "Incorrect Billing Period",
]

export function InvoiceDocument({ trade }: InvoiceDocumentProps) {
  // Ensure tradeId exists, provide fallback
  const tradeId = trade.tradeId || trade.tradeID || `TRADE-${Date.now()}`
  const invoiceNumber = `INV-${tradeId}-${new Date().getFullYear()}`
  const invoiceDate = new Date().toLocaleDateString()
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()

  // Generate agent name based on trade characteristics
  const generateAgentName = (trade: TradeData) => {
    const agentPools = {
      equity: [
        "Barclays Capital",
        "Goldman Sachs Securities",
        "Morgan Stanley Capital",
        "JPMorgan Securities",
        "UBS Investment Bank",
      ],
      fx: ["Deutsche Bank AG", "Citibank N.A.", "HSBC Bank PLC", "BNP Paribas", "Credit Suisse AG"],
    }

    const pool = trade.dataSource === "equity" ? agentPools.equity : agentPools.fx
    // Use tradeId hash to consistently assign same agent to same trade
    const safeTradeId = trade.tradeId || trade.tradeID || "DEFAULT"
    const hash = safeTradeId
      .toString()
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return pool[hash % pool.length]
  }

  const agentName = generateAgentName(trade)

  // Determine if this invoice should have a dispute (2 out of 15 invoices)
  const shouldHaveDispute = () => {
    const safeTradeId = trade.tradeId || trade.tradeID || "DEFAULT"
    const hash = safeTradeId
      .toString()
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)

    // Use modulo 15 to create batches, and select positions 3 and 11 for disputes
    const batchPosition = hash % 15
    return batchPosition === 3 || batchPosition === 11
  }

  const hasDispute = shouldHaveDispute()

  // Get specific dispute types for this trade (1-2 types max)
  const getTradeDisputeTypes = () => {
    if (!hasDispute) return []

    const safeTradeId = trade.tradeId || trade.tradeID || "DEFAULT"
    const hash = safeTradeId
      .toString()
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)

    // Determine number of dispute types (1 or 2)
    const numDisputeTypes = hash % 3 === 0 ? 2 : 1 // ~33% chance of 2 disputes, 67% chance of 1

    // Select specific dispute types
    const selectedTypes: string[] = []

    // First dispute type
    const firstDisputeHash = Math.abs(hash * 7 + safeTradeId.length * 13) % DISPUTE_TYPES.length
    selectedTypes.push(DISPUTE_TYPES[firstDisputeHash])

    // Second dispute type (if applicable)
    if (numDisputeTypes === 2) {
      const secondDisputeHash = Math.abs(hash * 11 + safeTradeId.length * 17) % DISPUTE_TYPES.length
      const secondType = DISPUTE_TYPES[secondDisputeHash]

      // Ensure we don't duplicate the same dispute type
      if (secondType !== selectedTypes[0]) {
        selectedTypes.push(secondType)
      }
    }

    return selectedTypes
  }

  const disputeTypes = getTradeDisputeTypes()
  const primaryDisputeType = disputeTypes[0] || null

  // Helper function to safely convert to number
  const safeToNumber = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null
    const num = typeof value === 'string' ? parseFloat(value) : Number(value)
    return isNaN(num) ? null : num
  }

  // Extract actual costs from dataset
  const getActualCosts = (trade: TradeData) => {
    if (trade.dataSource === "equity") {
      return {
        commission: safeToNumber(trade.commission),
        taxes: safeToNumber(trade.taxes),
        custodyFee: null, // Not available in equity dataset
        settlementCost: null, // Not available in equity dataset
        brokerageFee: null, // Not available in equity dataset
      }
    } else {
      // FX dataset
      return {
        commission: safeToNumber(trade.commissionAmount || trade.commission),
        taxes: null, // Not available in FX dataset
        custodyFee: safeToNumber(trade.custodyFee),
        settlementCost: safeToNumber(trade.settlementCost),
        brokerageFee: safeToNumber(trade.brokerageFee),
      }
    }
  }

  const actualCosts = getActualCosts(trade)

  // Apply dispute modifications to costs based on specific dispute types
  const getDisputeModifiedCosts = () => {
    if (!hasDispute || disputeTypes.length === 0) return actualCosts

    const modifiedCosts = { ...actualCosts }

    // Apply modifications for each dispute type this trade has
    disputeTypes.forEach((disputeType) => {
      switch (disputeType) {
        case "Overcharging":
          // Increase all fees by 25-50%
          if (modifiedCosts.commission) modifiedCosts.commission *= 1.35
          if (modifiedCosts.taxes) modifiedCosts.taxes *= 1.25
          if (modifiedCosts.custodyFee) modifiedCosts.custodyFee *= 1.45
          if (modifiedCosts.settlementCost) modifiedCosts.settlementCost *= 1.3
          if (modifiedCosts.brokerageFee) modifiedCosts.brokerageFee *= 1.4
          break

        case "Duplicate Charges":
          // Double one of the main fees
          if (modifiedCosts.commission) modifiedCosts.commission *= 2
          else if (modifiedCosts.brokerageFee) modifiedCosts.brokerageFee *= 2
          break

        case "Missing Trades":
          // Add phantom charges for non-existent trades
          if (trade.dataSource === "equity") {
            modifiedCosts.commission = (modifiedCosts.commission || 0) + 450
          } else {
            modifiedCosts.brokerageFee = (modifiedCosts.brokerageFee || 0) + 350
          }
          break

        case "Wrong Counterparty or Account":
          // Keep costs same but counterparty will be wrong (handled separately)
          // Add a small processing fee for the "error"
          if (modifiedCosts.commission) modifiedCosts.commission += 25
          break

        case "Incorrect Tax Application":
          // Add excessive or incorrect tax
          if (trade.dataSource === "equity") {
            modifiedCosts.taxes = (modifiedCosts.taxes || 0) + 500
          } else {
            // For FX, add a "tax" even though it shouldn't have one
            modifiedCosts.taxes = 275
          }
          break

        case "Service Not Rendered":
          // Add charges for services not provided
          if (trade.dataSource === "fx") {
            modifiedCosts.custodyFee = (modifiedCosts.custodyFee || 0) + 750
          } else {
            modifiedCosts.commission = (modifiedCosts.commission || 0) + 300
          }
          break

        case "Fail Charges Disputed":
          // Add fail charges that shouldn't be there
          if (trade.dataSource === "equity") {
            modifiedCosts.commission = (modifiedCosts.commission || 0) + 200
          } else {
            modifiedCosts.settlementCost = (modifiedCosts.settlementCost || 0) + 150
          }
          break

        case "Currency Conversion Error":
          // Apply wrong FX rate (increase by 15-25%)
          Object.keys(modifiedCosts).forEach((key) => {
            if (modifiedCosts[key as keyof typeof modifiedCosts]) {
              modifiedCosts[key as keyof typeof modifiedCosts]! *= 1.2
            }
          })
          break

        case "Wrong Rate Card Applied":
          // Apply incorrect rates (increase by 60-80%)
          if (modifiedCosts.commission) modifiedCosts.commission *= 1.75
          if (modifiedCosts.brokerageFee) modifiedCosts.brokerageFee *= 1.65
          if (modifiedCosts.custodyFee) modifiedCosts.custodyFee *= 1.55
          break

        case "Incorrect Billing Period":
          // Add charges from wrong period or double billing
          if (modifiedCosts.commission) modifiedCosts.commission *= 1.3
          if (modifiedCosts.settlementCost) modifiedCosts.settlementCost *= 1.4
          // Add a "previous period adjustment"
          if (trade.dataSource === "equity") {
            modifiedCosts.commission = (modifiedCosts.commission || 0) + 125
          } else {
            modifiedCosts.brokerageFee = (modifiedCosts.brokerageFee || 0) + 85
          }
          break

        default:
          // Fallback: general overcharge
          if (modifiedCosts.commission) modifiedCosts.commission *= 1.25
          break
      }
    })

    return modifiedCosts
  }

  const displayCosts = getDisputeModifiedCosts()

  // Calculate total from display costs
  const calculateTotal = () => {
    let total = 0
    total += displayCosts.commission || 0
    total += displayCosts.taxes || 0
    total += displayCosts.custodyFee || 0
    total += displayCosts.settlementCost || 0
    total += displayCosts.brokerageFee || 0
    return total
  }

  const totalAmount = calculateTotal()

  // Get potentially wrong counterparty for disputes
  const getDisplayCounterparty = () => {
    if (hasDispute && disputeTypes.includes("Wrong Counterparty or Account")) {
      const wrongCounterparties = ["WRONG BANK LTD", "INCORRECT ENTITY", "MISMATCHED CORP", "WRONG ACCOUNT"]
      const safeTradeId = trade.tradeId || trade.tradeID || "DEFAULT"
      const hash = safeTradeId
        .toString()
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0)
      return wrongCounterparties[hash % wrongCounterparties.length]
    }
    return trade.counterparty || "N/A"
  }

  // Helper function to check if this trade has a specific dispute type
  const hasSpecificDispute = (disputeType: string) => {
    return disputeTypes.includes(disputeType)
  }

  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto shadow-lg">
      {/* Professional Invoice Header */}
      <div className="border-b-2 border-gray-800 pb-6 mb-8">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="mb-4">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">INVOICE</h1>
              <div className="text-lg text-gray-600">
                <div className="mb-1">
                  <span className="font-semibold">Invoice Number:</span> {invoiceNumber}
                </div>
                <div className="mb-1">
                  <span className="font-semibold">Invoice Date:</span> {invoiceDate}
                </div>
                <div>
                  <span className="font-semibold">Due Date:</span> {dueDate}
                </div>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{agentName}</h2>
              <div className="text-gray-600">
                <div>Agent Services Division</div>
                <div>1 Churchill Place</div>
                <div>London E14 5HP</div>
                <div>United Kingdom</div>
                <div className="mt-2">
                  <div>Tel: +44 20 7623 2323</div>
                  <div>Email: billing@{agentName.toLowerCase().replace(/\s+/g, "")}.com</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-300 pb-1">BILL TO:</h3>
          <div className="text-gray-700">
            <div className="font-semibold text-lg">CLIENT SERVICES DEPARTMENT</div>
            <div>Trade Processing Unit</div>
            <div>Financial Services Division</div>
            <div>123 Trading Street</div>
            <div>New York, NY 10001</div>
            <div>United States</div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-300 pb-1">TRADE REFERENCE:</h3>
          <div className="text-gray-700">
            <div>
              <span className="font-semibold">Trade ID:</span> {tradeId}
            </div>
            <div>
              <span className="font-semibold">Agent:</span> {agentName}
            </div>
            <div>
              <span className="font-semibold">Counterparty:</span> {getDisplayCounterparty()}
            </div>
            <div>
              <span className="font-semibold">Service Type:</span>{" "}
              {trade.dataSource === "equity" ? "Equity Services" : "FX Services"}
            </div>
            {/* Hidden dispute info for debugging - remove in production */}
            {hasDispute && disputeTypes.length > 0 && (
              <div className="text-xs text-red-600 mt-2 opacity-50">DEBUG: Disputes - {disputeTypes.join(", ")}</div>
            )}
          </div>
        </div>
      </div>

      {/* Trade Details Section */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-300 pb-1">TRADE DETAILS</h3>
        <div className="bg-gray-50 p-4 rounded">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="mb-2">
                <span className="font-semibold">Trade Type:</span>{" "}
                {trade.dataSource === "equity" ? "Equity" : "Foreign Exchange"}
              </div>
              <div className="mb-2">
                <span className="font-semibold">Trade Date:</span> {trade.tradeDate || "N/A"}
              </div>
              <div className="mb-2">
                <span className="font-semibold">Settlement Date:</span> {trade.settlementDate || "N/A"}
              </div>
              <div>
                <span className="font-semibold">Trading Venue:</span>{" "}
                {trade.tradingVenue || trade.executionVenue || "N/A"}
              </div>
            </div>
            <div>
              {trade.dataSource === "equity" ? (
                <>
                  <div className="mb-2">
                    <span className="font-semibold">Symbol:</span> {trade.symbol || "N/A"}
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Quantity:</span> {trade.quantity?.toLocaleString() || "N/A"}
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Price:</span> ${trade.price?.toLocaleString() || "N/A"}
                  </div>
                  <div>
                    <span className="font-semibold">Trade Value:</span> ${trade.tradeValue?.toLocaleString() || "N/A"}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-2">
                    <span className="font-semibold">Currency Pair:</span> {trade.currencyPair || "N/A"}
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Notional Amount:</span>{" "}
                    {trade.notionalAmount?.toLocaleString() || "N/A"}
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">FX Rate:</span> {trade.fxRate || "N/A"}
                  </div>
                  <div>
                    <span className="font-semibold">USD Equivalent:</span> $
                    {((trade.notionalAmount || 0) * (trade.fxRate || 1)).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Services Provided Section */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-300 pb-1">SERVICES PROVIDED</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
          <div>
            <div className="flex items-center mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <span>Trade Execution Services</span>
            </div>
            <div className="flex items-center mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <span>Settlement & Clearing</span>
            </div>
          </div>
          <div>
            <div className="flex items-center mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <span>Custody & Safekeeping</span>
            </div>
            <div className="flex items-center mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <span>Regulatory Reporting</span>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Fees Table */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-300 pb-1">FEES & CHARGES</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white shadow-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-4 text-left font-semibold">Description</th>
                <th className="border border-gray-300 p-4 text-center font-semibold">Rate/Basis</th>
                <th className="border border-gray-300 p-4 text-right font-semibold">Amount (USD)</th>
              </tr>
            </thead>
            <tbody>
              {displayCosts.commission && (
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-4">
                    Commission Fee
                    {hasDispute &&
                      (hasSpecificDispute("Overcharging") ||
                        hasSpecificDispute("Duplicate Charges") ||
                        hasSpecificDispute("Wrong Rate Card Applied")) && (
                        <span className="text-xs text-red-600 block">* Includes disputed charges</span>
                      )}
                  </td>
                  <td className="border border-gray-300 p-4 text-center text-gray-600">Per Trade</td>
                  <td className="border border-gray-300 p-4 text-right font-mono">
                    ${(displayCosts.commission || 0).toFixed(2)}
                  </td>
                </tr>
              )}

              {displayCosts.taxes && (
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-4">
                    Taxes & Regulatory Fees
                    {hasDispute && hasSpecificDispute("Incorrect Tax Application") && (
                      <span className="text-xs text-red-600 block">* Incorrect tax applied</span>
                    )}
                  </td>
                  <td className="border border-gray-300 p-4 text-center text-gray-600">Statutory</td>
                  <td className="border border-gray-300 p-4 text-right font-mono">${(displayCosts.taxes || 0).toFixed(2)}</td>
                </tr>
              )}

              {displayCosts.custodyFee && (
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-4">
                    Custody & Safekeeping Fee
                    {hasDispute && hasSpecificDispute("Service Not Rendered") && (
                      <span className="text-xs text-red-600 block">* Service not rendered</span>
                    )}
                  </td>
                  <td className="border border-gray-300 p-4 text-center text-gray-600">Asset Based</td>
                  <td className="border border-gray-300 p-4 text-right font-mono">
                    ${(displayCosts.custodyFee || 0).toFixed(2)}
                  </td>
                </tr>
              )}

              {displayCosts.settlementCost && (
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-4">
                    Settlement & Clearing Fee
                    {hasDispute && hasSpecificDispute("Fail Charges Disputed") && (
                      <span className="text-xs text-red-600 block">* Includes fail charges</span>
                    )}
                  </td>
                  <td className="border border-gray-300 p-4 text-center text-gray-600">Per Transaction</td>
                  <td className="border border-gray-300 p-4 text-right font-mono">
                    ${(displayCosts.settlementCost || 0).toFixed(2)}
                  </td>
                </tr>
              )}

              {displayCosts.brokerageFee && (
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-4">
                    Brokerage Fee
                    {hasDispute &&
                      (hasSpecificDispute("Missing Trades") || hasSpecificDispute("Incorrect Billing Period")) && (
                        <span className="text-xs text-red-600 block">* Includes disputed period charges</span>
                      )}
                  </td>
                  <td className="border border-gray-300 p-4 text-center text-gray-600">Percentage</td>
                  <td className="border border-gray-300 p-4 text-right font-mono">
                    ${(displayCosts.brokerageFee || 0).toFixed(2)}
                  </td>
                </tr>
              )}

              {/* Add special line items for certain dispute types */}
              {hasDispute && hasSpecificDispute("Missing Trades") && (
                <tr className="hover:bg-gray-50 bg-red-50">
                  <td className="border border-gray-300 p-4">
                    Additional Trade Processing
                    <span className="text-xs text-red-600 block">* Phantom trade charges</span>
                  </td>
                  <td className="border border-gray-300 p-4 text-center text-gray-600">Special</td>
                  <td className="border border-gray-300 p-4 text-right font-mono">
                    ${trade.dataSource === "equity" ? "450.00" : "350.00"}
                  </td>
                </tr>
              )}

              {hasDispute && hasSpecificDispute("Currency Conversion Error") && (
                <tr className="hover:bg-gray-50 bg-red-50">
                  <td className="border border-gray-300 p-4">
                    FX Conversion Adjustment
                    <span className="text-xs text-red-600 block">* Wrong rate applied</span>
                  </td>
                  <td className="border border-gray-300 p-4 text-center text-gray-600">Rate Error</td>
                  <td className="border border-gray-300 p-4 text-right font-mono">
                    ${((totalAmount * 0.2) / 1.2).toFixed(2)}
                  </td>
                </tr>
              )}

              {/* Subtotal */}
              <tr className="bg-gray-50">
                <td className="border border-gray-300 p-4 font-semibold" colSpan={2}>
                  SUBTOTAL
                </td>
                <td className="border border-gray-300 p-4 text-right font-mono font-semibold">
                  ${totalAmount.toFixed(2)}
                </td>
              </tr>

              {/* Total */}
              <tr className="bg-gray-800 text-white">
                <td className="border border-gray-300 p-4 font-bold text-lg" colSpan={2}>
                  TOTAL AMOUNT DUE
                </td>
                <td className="border border-gray-300 p-4 text-right font-mono font-bold text-lg">
                  ${totalAmount.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-300 pb-1">PAYMENT TERMS</h3>
          <div className="text-gray-700 space-y-2">
            <div>• Payment due within 30 days of invoice date</div>
            <div>• Late payments subject to 1.5% monthly service charge</div>
            <div>• All amounts in USD unless otherwise specified</div>
            <div>• Payments should reference invoice number</div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-300 pb-1">REMITTANCE DETAILS</h3>
          <div className="text-gray-700 space-y-2">
            <div>
              <span className="font-semibold">Bank:</span> {agentName} Bank
            </div>
            <div>
              <span className="font-semibold">Account:</span> 1234567890
            </div>
            <div>
              <span className="font-semibold">SWIFT:</span> AGNTUS33
            </div>
            <div>
              <span className="font-semibold">Reference:</span> {invoiceNumber}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-300 pt-6 text-center text-gray-600">
        <div className="mb-2">
          <span className="font-semibold">Questions about this invoice?</span>
        </div>
        <div>Contact us at billing@{agentName.toLowerCase().replace(/\s+/g, "")}.com or +44 20 7623 2323</div>
        <div className="mt-4 text-sm">This invoice is generated electronically and is valid without signature.</div>
      </div>
    </div>
  )
}
