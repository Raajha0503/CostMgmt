"use client"

import { supabase, type Trade, type Claim, type InvestigationNote } from "./supabase-client"
import type { TradeData } from "./data-processor"

// Trade Operations
export async function saveTrades(trades: TradeData[], fileName: string, userId?: string) {
  try {
    const tradesToInsert = trades.map((trade) => ({
      trade_id: trade.tradeId,
      order_id: trade.orderId,
      client_id: trade.clientId,
      data_source: trade.dataSource as "equity" | "fx",
      trade_type: trade.tradeType,
      trade_date: trade.tradeDate,
      settlement_date: trade.settlementDate,
      value_date: trade.valueDate || trade.settlementDate,
      settlement_status: trade.settlementStatus,
      counterparty: trade.counterparty,
      trading_venue: trade.tradingVenue || trade.executionVenue,
      confirmation_status: trade.confirmationStatus,
      currency: trade.currency || trade.baseCurrency,

      // Equity fields
      isin: trade.isin,
      symbol: trade.symbol,
      quantity: trade.quantity,
      price: trade.price,
      trade_value: trade.tradeValue,
      trader_name: trade.traderName,
      kyc_status: trade.kycStatus,
      reference_data_validated: trade.referenceDataValidated === "Yes",

      // FX fields
      currency_pair: trade.currencyPair,
      buy_sell: trade.buySell,
      dealt_currency: trade.dealtCurrency,
      base_currency: trade.baseCurrency,
      term_currency: trade.termCurrency,
      notional_amount: trade.notionalAmount,
      fx_rate: trade.fxRate,

      // Financial fields
      commission: trade.commission,
      taxes: trade.taxes,
      total_cost: trade.totalCost,
      market_impact_cost: trade.marketImpactCost,
      fx_rate_applied: trade.fxRateApplied,
      net_amount: trade.netAmount,

      // Metadata
      uploaded_by: userId,
      original_file_name: fileName,
      raw_data: trade, // Store the original trade data as JSON
    }))

    const { data, error } = await supabase.from("trades").insert(tradesToInsert).select()

    if (error) {
      console.error("Error saving trades:", error)
      throw error
    }

    console.log(`Successfully saved ${data.length} trades to database`)
    return data
  } catch (error) {
    console.error("Failed to save trades:", error)
    throw error
  }
}

export async function loadTrades(dataSource?: "equity" | "fx", limit = 1000) {
  try {
    let query = supabase.from("trades").select("*").order("created_at", { ascending: false }).limit(limit)

    if (dataSource) {
      query = query.eq("data_source", dataSource)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error loading trades:", error)
      throw error
    }

    return data as Trade[]
  } catch (error) {
    console.error("Failed to load trades:", error)
    throw error
  }
}

// Claim Operations
export async function saveClaim(claimData: {
  claim_id: string
  trade_id: string
  claim_amount: number
  currency: string
  interest_rate?: number
  delay_days?: number
  claim_reason?: string
  claim_type?: string
  created_by?: string
}) {
  try {
    const { data, error } = await supabase
      .from("claims")
      .insert({
        ...claimData,
        status: "registered",
        workflow_stage: "registration",
        registration_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single()

    if (error) {
      console.error("Error saving claim:", error)
      throw error
    }

    // Log workflow history
    await logWorkflowChange(data.id, null, "registration", null, "registered", "Claim registered", claimData.created_by)

    return data as Claim
  } catch (error) {
    console.error("Failed to save claim:", error)
    throw error
  }
}

export async function saveBulkClaims(bulkId: string, claims: any[], userId?: string) {
  try {
    // First create the bulk claim record
    const { data: bulkClaim, error: bulkError } = await supabase
      .from("bulk_claims")
      .insert({
        bulk_id: bulkId,
        total_claims: claims.length,
        registration_date: new Date().toISOString().split("T")[0],
        created_by: userId,
      })
      .select()
      .single()

    if (bulkError) throw bulkError

    // Then create individual claims
    const claimsToInsert = claims.map((claim) => ({
      claim_id: claim.claimId,
      trade_id: claim.tradeId, // This should be the UUID from the trades table
      claim_amount: claim.claimAmount || 0,
      currency: claim.currency,
      claim_reason: "Settlement Delay",
      claim_type: "receivable",
      status: "registered" as const,
      workflow_stage: "registration" as const,
      registration_date: new Date().toISOString().split("T")[0],
      created_by: userId,
    }))

    const { data: savedClaims, error: claimsError } = await supabase.from("claims").insert(claimsToInsert).select()

    if (claimsError) throw claimsError

    // Link claims to bulk claim
    const bulkItems = savedClaims.map((claim) => ({
      bulk_claim_id: bulkClaim.id,
      claim_id: claim.id,
    }))

    const { error: linkError } = await supabase.from("bulk_claim_items").insert(bulkItems)

    if (linkError) throw linkError

    return { bulkClaim, claims: savedClaims }
  } catch (error) {
    console.error("Failed to save bulk claims:", error)
    throw error
  }
}

export async function loadClaims(status?: string, workflowStage?: string) {
  try {
    let query = supabase
      .from("claims")
      .select(`
        *,
        trade:trades(*)
      `)
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    if (workflowStage) {
      query = query.eq("workflow_stage", workflowStage)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error loading claims:", error)
      throw error
    }

    return data as Claim[]
  } catch (error) {
    console.error("Failed to load claims:", error)
    throw error
  }
}

export async function loadBulkClaim(bulkId: string) {
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

    if (error) {
      console.error("Error loading bulk claim:", error)
      throw error
    }

    return data
  } catch (error) {
    console.error("Failed to load bulk claim:", error)
    throw error
  }
}

// Workflow Operations
export async function updateClaimStatus(
  claimId: string,
  newStatus: string,
  newWorkflowStage: string,
  notes?: string,
  userId?: string,
) {
  try {
    // Get current claim to log the change
    const { data: currentClaim } = await supabase
      .from("claims")
      .select("status, workflow_stage")
      .eq("id", claimId)
      .single()

    // Update the claim
    const { data, error } = await supabase
      .from("claims")
      .update({
        status: newStatus,
        workflow_stage: newWorkflowStage,
        ...(newWorkflowStage === "investigation" && {
          investigation_start_date: new Date().toISOString().split("T")[0],
        }),
        ...(newStatus === "approved" && { approval_date: new Date().toISOString().split("T")[0] }),
        ...(newWorkflowStage === "settlement" && { settlement_date: new Date().toISOString().split("T")[0] }),
        ...(newStatus === "closed" && { closure_date: new Date().toISOString().split("T")[0] }),
      })
      .eq("id", claimId)
      .select()
      .single()

    if (error) throw error

    // Log the workflow change
    if (currentClaim) {
      await logWorkflowChange(
        claimId,
        currentClaim.workflow_stage,
        newWorkflowStage,
        currentClaim.status,
        newStatus,
        notes,
        userId,
      )
    }

    return data
  } catch (error) {
    console.error("Failed to update claim status:", error)
    throw error
  }
}

export async function logWorkflowChange(
  claimId: string,
  fromStage: string | null,
  toStage: string,
  fromStatus: string | null,
  toStatus: string,
  notes?: string,
  userId?: string,
) {
  try {
    const { error } = await supabase.from("claim_workflow_history").insert({
      claim_id: claimId,
      from_stage: fromStage,
      to_stage: toStage,
      from_status: fromStatus,
      to_status: toStatus,
      notes,
      changed_by: userId,
    })

    if (error) throw error
  } catch (error) {
    console.error("Failed to log workflow change:", error)
  }
}

// Investigation Notes
export async function saveInvestigationNote(
  claimId: string,
  content: string,
  noteType = "investigation",
  userId?: string,
) {
  try {
    const { data, error } = await supabase
      .from("investigation_notes")
      .insert({
        claim_id: claimId,
        note_type: noteType,
        content,
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw error
    return data as InvestigationNote
  } catch (error) {
    console.error("Failed to save investigation note:", error)
    throw error
  }
}

// File Upload Operations
export async function uploadFile(file: File, uploadType: string, relatedEntityId?: string) {
  try {
    const fileName = `${Date.now()}-${file.name}`
    const filePath = `${uploadType}/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage.from("documents").upload(filePath, file)

    if (uploadError) throw uploadError

    // Save file record to database
    const { data: fileRecord, error: dbError } = await supabase
      .from("file_uploads")
      .insert({
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: uploadData.path,
        upload_type: uploadType,
        related_entity_id: relatedEntityId,
      })
      .select()
      .single()

    if (dbError) throw dbError

    return fileRecord
  } catch (error) {
    console.error("Failed to upload file:", error)
    throw error
  }
}

// Analytics and Reporting
export async function getClaimsAnalytics() {
  try {
    const { data, error } = await supabase
      .from("claims")
      .select("status, workflow_stage, claim_amount, currency, created_at")

    if (error) throw error

    // Process analytics data
    const analytics = {
      totalClaims: data.length,
      totalAmount: data.reduce((sum, claim) => sum + (claim.claim_amount || 0), 0),
      statusBreakdown: data.reduce(
        (acc, claim) => {
          acc[claim.status] = (acc[claim.status] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
      workflowBreakdown: data.reduce(
        (acc, claim) => {
          acc[claim.workflow_stage] = (acc[claim.workflow_stage] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
    }

    return analytics
  } catch (error) {
    console.error("Failed to get claims analytics:", error)
    throw error
  }
}
