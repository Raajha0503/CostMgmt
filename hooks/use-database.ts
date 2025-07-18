"use client"

import { useState, useEffect } from "react"
import {
  saveTrades,
  loadTrades,
  saveClaim,
  saveBulkClaims,
  loadClaims,
  loadBulkClaim,
  updateClaimStatus,
  saveInvestigationNote,
  getClaimsAnalytics,
} from "@/lib/database-operations"
import type { TradeData } from "@/lib/data-processor"
import type { Trade, Claim } from "@/lib/supabase-client"
import { supabase } from "@/lib/supabase-client"

export function useDatabase() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-save trades when uploaded
  const autoSaveTrades = async (trades: TradeData[], fileName: string) => {
    setLoading(true)
    setError(null)

    try {
      const savedTrades = await saveTrades(trades, fileName)
      console.log(`Auto-saved ${savedTrades.length} trades to database`)
      return savedTrades
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save trades"
      setError(errorMessage)
      console.error("Auto-save failed:", err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Auto-save claim registration
  const autoSaveClaim = async (claimData: any) => {
    setLoading(true)
    setError(null)

    try {
      const savedClaim = await saveClaim(claimData)
      console.log(`Auto-saved claim ${savedClaim.claim_id} to database`)
      return savedClaim
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save claim"
      setError(errorMessage)
      console.error("Auto-save claim failed:", err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Auto-save bulk claims
  const autoSaveBulkClaims = async (bulkId: string, claims: any[]) => {
    setLoading(true)
    setError(null)

    try {
      const result = await saveBulkClaims(bulkId, claims)
      console.log(`Auto-saved bulk claim ${bulkId} with ${claims.length} individual claims`)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save bulk claims"
      setError(errorMessage)
      console.error("Auto-save bulk claims failed:", err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Auto-save workflow updates
  const autoSaveWorkflowUpdate = async (
    claimId: string,
    newStatus: string,
    newWorkflowStage: string,
    notes?: string,
  ) => {
    try {
      const updatedClaim = await updateClaimStatus(claimId, newStatus, newWorkflowStage, notes)
      console.log(`Auto-saved workflow update for claim ${claimId}`)
      return updatedClaim
    } catch (err) {
      console.error("Auto-save workflow update failed:", err)
      throw err
    }
  }

  // Auto-save investigation notes
  const autoSaveNote = async (claimId: string, content: string, noteType = "investigation") => {
    try {
      const savedNote = await saveInvestigationNote(claimId, content, noteType)
      console.log(`Auto-saved investigation note for claim ${claimId}`)
      return savedNote
    } catch (err) {
      console.error("Auto-save note failed:", err)
      throw err
    }
  }

  return {
    loading,
    error,
    autoSaveTrades,
    autoSaveClaim,
    autoSaveBulkClaims,
    autoSaveWorkflowUpdate,
    autoSaveNote,
    // Direct database operations
    loadTrades,
    loadClaims,
    loadBulkClaim,
    getClaimsAnalytics,
  }
}

// Hook for real-time data updates
export function useRealtimeData() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [claims, setClaims] = useState<Claim[]>([])

  useEffect(() => {
    // Load initial data
    loadTrades().then(setTrades).catch(console.error)
    loadClaims().then(setClaims).catch(console.error)

    // Set up real-time subscriptions
    const tradesSubscription = supabase
      .channel("trades-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, (payload) => {
        console.log("Trades change received:", payload)
        // Refresh trades data
        loadTrades().then(setTrades).catch(console.error)
      })
      .subscribe()

    const claimsSubscription = supabase
      .channel("claims-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, (payload) => {
        console.log("Claims change received:", payload)
        // Refresh claims data
        loadClaims().then(setClaims).catch(console.error)
      })
      .subscribe()

    return () => {
      tradesSubscription.unsubscribe()
      claimsSubscription.unsubscribe()
    }
  }, [])

  return { trades, claims }
}
