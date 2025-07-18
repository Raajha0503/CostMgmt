"use client"

import { createClient } from "@supabase/supabase-js"
import type { TradeData } from "./data-processor"

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create a mock client when environment variables are not available
const createMockClient = () => ({
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: [], error: null }),
    update: () => Promise.resolve({ data: [], error: null }),
    delete: () => Promise.resolve({ data: [], error: null }),
    upsert: () => Promise.resolve({ data: [], error: null }),
    eq: function () {
      return this
    },
    in: function () {
      return this
    },
    single: () => Promise.resolve({ data: null, error: null }),
    order: function () {
      return this
    },
  }),
})

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : createMockClient()

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey)

// Helper function to safely convert values
const safeDecimal = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null
  const num = Number(value)
  return isNaN(num) ? null : num
}

const safeString = (value: any, maxLength = 255): string | null => {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str.length === 0 ? null : str.substring(0, maxLength)
}

const safeDate = (value: any): string | null => {
  if (!value) return null
  try {
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date.toISOString().split("T")[0]
  } catch {
    return null
  }
}

// Auto-save trades with upsert to handle duplicates
export async function autoSaveTradesFromApp(trades: TradeData[], fileName: string) {
  if (!isSupabaseConfigured) {
    console.log("Supabase not configured - skipping auto-save")
    return []
  }

  try {
    console.log(`Auto-saving ${trades.length} trades to Supabase...`)

    const tradesToSave = trades.map((trade, index) => {
      // Calculate the exact same values as shown in your app
      let tradeDate, valueDate, settlementDate

      if (trade.dataSource === "fx") {
        tradeDate = safeDate(trade.tradeDate) || new Date().toISOString().split("T")[0]
        valueDate = safeDate(trade.settlementDate) || safeDate(trade.valueDate) || tradeDate
        settlementDate = safeDate(trade.settlementDate) || valueDate
      } else {
        tradeDate = safeDate(trade.tradeDate) || new Date().toISOString().split("T")[0]
        valueDate = safeDate(trade.tradeDate) || tradeDate
        settlementDate =
          safeDate(trade.settlementDate) ||
          (() => {
            const tradeDateObj = new Date(tradeDate)
            tradeDateObj.setDate(tradeDateObj.getDate() + 2)
            return tradeDateObj.toISOString().split("T")[0]
          })()
      }

      // Generate a unique trade_id if not provided
      const tradeId = safeString(trade.tradeId) || `TRD-${Date.now()}-${String(index + 1).padStart(3, "0")}`

      // Only include fields that definitely exist in the database schema
      return {
        trade_id: tradeId,
        order_id: safeString(trade.orderId),
        client_id: safeString(trade.clientId) || "N/A",
        data_source: trade.dataSource,
        trade_type: safeString(trade.tradeType),
        trade_date: tradeDate,
        settlement_date: settlementDate,
        value_date: valueDate,
        settlement_status:
          safeString(trade.settlementStatus || trade.tradeStatus || trade.confirmationStatus) || "Unknown",
        counterparty: safeString(trade.counterparty) || "N/A",
        trading_venue: safeString(trade.tradingVenue || trade.executionVenue),
        confirmation_status: safeString(trade.confirmationStatus),
        currency: safeString(trade.currency || trade.dealtCurrency || trade.baseCurrency) || "USD",

        // Equity fields
        isin: safeString(trade.isin),
        symbol: safeString(trade.symbol),
        quantity: safeDecimal(trade.quantity),
        price: safeDecimal(trade.price),
        trade_value: safeDecimal(trade.tradeValue || trade.notionalAmount) || 0,
        trader_name: safeString(trade.traderName),
        kyc_status: safeString(trade.kycStatus),
        reference_data_validated: trade.referenceDataValidated === "Yes",

        // FX fields
        currency_pair: safeString(trade.currencyPair),
        buy_sell: safeString(trade.buySell),
        dealt_currency: safeString(trade.dealtCurrency),
        base_currency: safeString(trade.baseCurrency),
        term_currency: safeString(trade.termCurrency),
        notional_amount: safeDecimal(trade.notionalAmount),
        fx_rate: safeDecimal(trade.fxRate),

        // Core financial fields that should exist
        commission: safeDecimal(trade.commission),
        taxes: safeDecimal(trade.taxes),
        total_cost: safeDecimal(trade.totalCost),
        market_impact_cost: safeDecimal(trade.marketImpactCost),
        fx_rate_applied: safeDecimal(trade.fxRateApplied),
        net_amount: safeDecimal(trade.netAmount),

        // Metadata
        uploaded_by: "Interest Claims App",
        original_file_name: fileName,
        raw_data: trade,
      }
    })

    console.log("Sample trade record to save:", JSON.stringify(tradesToSave[0], null, 2))

    // Use upsert to handle duplicate trade_ids
    const { data, error } = await supabase
      .from("trades")
      .upsert(tradesToSave, {
        onConflict: "trade_id",
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      console.error("Error saving trades:", error)
      console.error("Error details:", error.details)
      console.error("Error hint:", error.hint)
      throw error
    }

    console.log(`✅ Successfully saved/updated ${data.length} trades to Supabase`)
    return data
  } catch (error) {
    console.error("Failed to auto-save trades:", error)
    throw error
  }
}

// Alternative approach: Check for existing trades first, then insert only new ones
export async function autoSaveTradesFromAppSafe(trades: TradeData[], fileName: string) {
  if (!isSupabaseConfigured) {
    console.log("Supabase not configured - skipping auto-save")
    return []
  }

  try {
    console.log(`Auto-saving ${trades.length} trades to Supabase (safe mode)...`)

    // Get all existing trade IDs
    const tradeIds = trades.map((trade) => trade.tradeId).filter(Boolean)
    const { data: existingTrades } = await supabase.from("trades").select("trade_id").in("trade_id", tradeIds)

    const existingTradeIds = new Set(existingTrades?.map((t) => t.trade_id) || [])

    // Filter out trades that already exist
    const newTrades = trades.filter((trade) => !existingTradeIds.has(trade.tradeId))

    if (newTrades.length === 0) {
      console.log("All trades already exist in database")
      return []
    }

    console.log(`Found ${newTrades.length} new trades to save (${trades.length - newTrades.length} already exist)`)

    const tradesToSave = newTrades.map((trade, index) => {
      // Calculate the exact same values as shown in your app
      let tradeDate, valueDate, settlementDate

      if (trade.dataSource === "fx") {
        tradeDate = safeDate(trade.tradeDate) || new Date().toISOString().split("T")[0]
        valueDate = safeDate(trade.settlementDate) || safeDate(trade.valueDate) || tradeDate
        settlementDate = safeDate(trade.settlementDate) || valueDate
      } else {
        tradeDate = safeDate(trade.tradeDate) || new Date().toISOString().split("T")[0]
        valueDate = safeDate(trade.tradeDate) || tradeDate
        settlementDate =
          safeDate(trade.settlementDate) ||
          (() => {
            const tradeDateObj = new Date(tradeDate)
            tradeDateObj.setDate(tradeDateObj.getDate() + 2)
            return tradeDateObj.toISOString().split("T")[0]
          })()
      }

      // Generate a unique trade_id if not provided
      const tradeId = safeString(trade.tradeId) || `TRD-${Date.now()}-${String(index + 1).padStart(3, "0")}`

      return {
        trade_id: tradeId,
        order_id: safeString(trade.orderId),
        client_id: safeString(trade.clientId) || "N/A",
        data_source: trade.dataSource,
        trade_type: safeString(trade.tradeType),
        trade_date: tradeDate,
        settlement_date: settlementDate,
        value_date: valueDate,
        settlement_status:
          safeString(trade.settlementStatus || trade.tradeStatus || trade.confirmationStatus) || "Unknown",
        counterparty: safeString(trade.counterparty) || "N/A",
        trading_venue: safeString(trade.tradingVenue || trade.executionVenue),
        confirmation_status: safeString(trade.confirmationStatus),
        currency: safeString(trade.currency || trade.dealtCurrency || trade.baseCurrency) || "USD",

        // Equity fields
        isin: safeString(trade.isin),
        symbol: safeString(trade.symbol),
        quantity: safeDecimal(trade.quantity),
        price: safeDecimal(trade.price),
        trade_value: safeDecimal(trade.tradeValue || trade.notionalAmount) || 0,
        trader_name: safeString(trade.traderName),
        kyc_status: safeString(trade.kycStatus),
        reference_data_validated: trade.referenceDataValidated === "Yes",

        // FX fields
        currency_pair: safeString(trade.currencyPair),
        buy_sell: safeString(trade.buySell),
        dealt_currency: safeString(trade.dealtCurrency),
        base_currency: safeString(trade.baseCurrency),
        term_currency: safeString(trade.termCurrency),
        notional_amount: safeDecimal(trade.notionalAmount),
        fx_rate: safeDecimal(trade.fxRate),

        // Core financial fields
        commission: safeDecimal(trade.commission),
        taxes: safeDecimal(trade.taxes),
        total_cost: safeDecimal(trade.totalCost),
        market_impact_cost: safeDecimal(trade.marketImpactCost),
        fx_rate_applied: safeDecimal(trade.fxRateApplied),
        net_amount: safeDecimal(trade.netAmount),

        // Metadata
        uploaded_by: "Interest Claims App",
        original_file_name: fileName,
        raw_data: trade,
      }
    })

    const { data, error } = await supabase.from("trades").insert(tradesToSave).select()

    if (error) {
      console.error("Error saving trades:", error)
      throw error
    }

    console.log(`✅ Successfully saved ${data.length} new trades to Supabase`)
    return data
  } catch (error) {
    console.error("Failed to auto-save trades:", error)
    throw error
  }
}

// Auto-save individual claim registration
export async function autoSaveClaimRegistration(claimData: {
  claimId: string
  tradeId: string
  clientId: string
  counterparty: string
  valueDate: string
  tradeValue: string
  currency: string
  settlementStatus: string
  tradeData?: any
}) {
  if (!isSupabaseConfigured) {
    console.log("Supabase not configured - skipping claim registration save")
    return null
  }

  try {
    console.log(`Auto-saving claim registration: ${claimData.claimId}`)

    // Find the corresponding trade in database
    const { data: tradeRecord } = await supabase.from("trades").select("*").eq("trade_id", claimData.tradeId).single()

    // Calculate claim amount based on available trade data
    let claimAmount = 0
    if (tradeRecord) {
      // Use market_impact_cost as the primary claim amount for now
      claimAmount = tradeRecord.market_impact_cost || 0

      // If no market impact cost, use a percentage of trade value
      if (claimAmount === 0 && tradeRecord.trade_value) {
        claimAmount = tradeRecord.trade_value * 0.001 // 0.1% of trade value
      }
    }

    const claimToSave = {
      claim_id: claimData.claimId,
      trade_id: tradeRecord?.id,
      claim_amount: claimAmount,
      currency: claimData.currency || tradeRecord?.currency || "USD", // Ensure currency is never null
      interest_rate: 5.0, // Default rate
      delay_days: 0, // Calculate based on settlement dates
      claim_reason: "Settlement Delay",
      claim_type: "receivable",
      status: "registered",
      workflow_stage: "registration",
      registration_date: new Date().toISOString().split("T")[0],
      created_by: "Interest Claims App",

      // Add other required fields that might be missing
      trade_reference: claimData.tradeId,
      client_id: claimData.clientId || "N/A",
      counterparty: claimData.counterparty || "Unknown",
      value_date: claimData.valueDate || new Date().toISOString().split("T")[0],
      trade_date: tradeRecord?.trade_date || claimData.valueDate || new Date().toISOString().split("T")[0],
      settlement_date: tradeRecord?.settlement_date || claimData.valueDate || new Date().toISOString().split("T")[0],
      trade_value: Number.parseFloat(claimData.tradeValue) || tradeRecord?.trade_value || 0,
      settlement_status: claimData.settlementStatus || "Unknown",
      documents_uploaded: false,
      document_checklist: {
        tradeConfirmation: false,
        settlementInstructions: false,
        emailCorrespondence: false,
      },
    }

    const { data, error } = await supabase.from("claims").insert(claimToSave).select().single()

    if (error) {
      console.error("Error saving claim:", error)
      throw error
    }

    // Log workflow history
    await supabase.from("claim_workflow_history").insert({
      claim_id: data.id,
      from_stage: null,
      to_stage: "registration",
      from_status: null,
      to_status: "registered",
      notes: "Claim registered through Interest Claims App",
      changed_by: "Interest Claims App",
    })

    console.log(`✅ Successfully saved claim: ${claimData.claimId}`)
    return data
  } catch (error) {
    console.error("Failed to auto-save claim:", error)
    throw error
  }
}

// Auto-save bulk claim registration
export async function autoSaveBulkClaimRegistration(bulkData: {
  bulkId: string
  claims: any[]
  totalClaims: number
}) {
  if (!isSupabaseConfigured) {
    console.log("Supabase not configured - skipping bulk claim registration save")
    return null
  }

  try {
    console.log(`Auto-saving bulk claim registration: ${bulkData.bulkId}`)

    // Create bulk claim record
    const { data: bulkClaim, error: bulkError } = await supabase
      .from("bulk_claims")
      .insert({
        bulk_id: bulkData.bulkId,
        total_claims: bulkData.totalClaims,
        registration_date: new Date().toISOString().split("T")[0],
        status: "Under Investigation",
        created_by: "Interest Claims App",
      })
      .select()
      .single()

    if (bulkError) throw bulkError

    // Save individual claims
    const claimsToSave = []

    for (const claim of bulkData.claims) {
      // Find corresponding trade
      const { data: tradeRecord } = await supabase.from("trades").select("*").eq("trade_id", claim.tradeId).single()

      const claimRecord = {
        claim_id: claim.claimId,
        trade_id: tradeRecord?.id,
        trade_reference: claim.tradeId,
        client_id: claim.clientId || "N/A",
        counterparty: claim.counterparty || "Unknown",
        claim_amount: claim.claimAmount || tradeRecord?.market_impact_cost || 0,
        currency: claim.currency || tradeRecord?.currency || "USD", // Ensure currency is never null
        interest_rate: 5.0,
        delay_days: 0, // Will be calculated by database trigger if available
        claim_reason: "Settlement Delay",
        claim_type: "receivable",
        status: "registered",
        workflow_stage: "registration",
        registration_date: new Date().toISOString().split("T")[0],
        value_date: claim.tradeDate || new Date().toISOString().split("T")[0],
        trade_date: tradeRecord?.trade_date || claim.tradeDate || new Date().toISOString().split("T")[0],
        settlement_date: tradeRecord?.settlement_date || claim.tradeDate || new Date().toISOString().split("T")[0],
        trade_value: claim.tradeValue || tradeRecord?.trade_value || 0,
        settlement_status: claim.status || "Unknown",
        documents_uploaded: false,
        document_checklist: {
          tradeConfirmation: false,
          settlementInstructions: false,
          emailCorrespondence: false,
        },
        created_by: "Interest Claims App",
      }

      claimsToSave.push(claimRecord)
    }

    // Insert all claims
    const { data: savedClaims, error: claimsError } = await supabase.from("claims").insert(claimsToSave).select()

    if (claimsError) throw claimsError

    // Link claims to bulk registration
    const bulkItems = savedClaims.map((claim) => ({
      bulk_claim_id: bulkClaim.id,
      claim_id: claim.id,
    }))

    const { error: linkError } = await supabase.from("bulk_claim_items").insert(bulkItems)

    if (linkError) throw linkError

    console.log(`✅ Successfully saved bulk claim: ${bulkData.bulkId} with ${savedClaims.length} individual claims`)
    return { bulkClaim, claims: savedClaims }
  } catch (error) {
    console.error("Failed to auto-save bulk claim:", error)
    throw error
  }
}

// Load trades exactly as they appear in your app
export async function loadTradesForApp(dataSource?: "equity" | "fx") {
  if (!isSupabaseConfigured) {
    console.log("Supabase not configured - returning empty trades array")
    return []
  }

  try {
    let query = supabase.from("trades").select("*").order("created_at", { ascending: false })

    if (dataSource) {
      query = query.eq("data_source", dataSource)
    }

    const { data, error } = await query

    if (error) throw error

    // Transform back to app format
    return data.map((trade) => ({
      tradeId: trade.trade_id,
      orderId: trade.order_id,
      clientId: trade.client_id,
      dataSource: trade.data_source,
      tradeType: trade.trade_type,
      tradeDate: trade.trade_date,
      settlementDate: trade.settlement_date,
      valueDate: trade.value_date,
      settlementStatus: trade.settlement_status,
      counterparty: trade.counterparty,
      tradingVenue: trade.trading_venue,
      confirmationStatus: trade.confirmation_status,
      currency: trade.currency,

      // Equity fields
      isin: trade.isin,
      symbol: trade.symbol,
      quantity: trade.quantity,
      price: trade.price,
      tradeValue: trade.trade_value,
      traderName: trade.trader_name,
      kycStatus: trade.kyc_status,
      referenceDataValidated: trade.reference_data_validated ? "Yes" : "No",

      // FX fields
      currencyPair: trade.currency_pair,
      buySell: trade.buy_sell,
      dealtCurrency: trade.dealt_currency,
      baseCurrency: trade.base_currency,
      termCurrency: trade.term_currency,
      notionalAmount: trade.notional_amount,
      fxRate: trade.fx_rate,

      // Financial fields
      commission: trade.commission,
      taxes: trade.taxes,
      totalCost: trade.total_cost,
      marketImpactCost: trade.market_impact_cost,
      fxRateApplied: trade.fx_rate_applied,
      netAmount: trade.net_amount,

      // Optional fields that may or may not exist
      fxGainLoss: trade.fx_gain_loss,
      custodyFee: trade.custody_fee,
      settlementCost: trade.settlement_cost,

      // Calculated fields from database (if they exist)
      slaBreachDays: trade.sla_breach_days,
      claimAmount: trade.claim_amount,
      eligibilityStatus: trade.eligibility_status,
    }))
  } catch (error) {
    console.error("Failed to load trades:", error)
    return []
  }
}

// Load claims exactly as they appear in your app
export async function loadClaimsForApp() {
  if (!isSupabaseConfigured) {
    console.log("Supabase not configured - returning empty claims array")
    return []
  }

  try {
    const { data, error } = await supabase
      .from("claims")
      .select(`
        *,
        trade:trades(*)
      `)
      .order("created_at", { ascending: false })

    if (error) throw error

    return data
  } catch (error) {
    console.error("Failed to load claims:", error)
    return []
  }
}

// Load bulk claims with all details
export async function loadBulkClaimForApp(bulkId: string) {
  if (!isSupabaseConfigured) {
    console.log("Supabase not configured - returning null for bulk claim")
    return null
  }

  try {
    const { data, error } = await supabase
      .from("bulk_claims")
      .select(`
        *,
        bulk_claim_items(
          claim:claims(
            *,
            trade:trades(*)
          )
        )
      `)
      .eq("bulk_id", bulkId)
      .single()

    if (error) throw error

    // Transform to match app format
    return {
      bulkId: data.bulk_id,
      totalClaims: data.total_claims,
      registrationDate: data.registration_date,
      status: data.status,
      claims: data.bulk_claim_items.map((item: any) => ({
        claimId: item.claim.claim_id,
        tradeId: item.claim.trade_reference,
        clientId: item.claim.client_id,
        counterparty: item.claim.counterparty,
        claimAmount: item.claim.claim_amount,
        currency: item.claim.currency,
        tradeDate: item.claim.trade_date,
        status: item.claim.status,
        originalTradeData: item.claim.trade,
      })),
    }
  } catch (error) {
    console.error("Failed to load bulk claim:", error)
    return null
  }
}

// Get all registered bulk claims
export async function getAllBulkClaims() {
  if (!isSupabaseConfigured) {
    console.log("Supabase not configured - returning empty bulk claims array")
    return []
  }

  try {
    const { data, error } = await supabase.from("bulk_claims").select("*").order("created_at", { ascending: false })

    if (error) throw error

    return data.map((bulk) => ({
      bulkId: bulk.bulk_id,
      totalClaims: bulk.total_claims,
      registrationDate: bulk.registration_date,
      status: bulk.status,
    }))
  } catch (error) {
    console.error("Failed to load bulk claims:", error)
    return []
  }
}
