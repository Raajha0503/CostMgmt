"use client"

import { useState } from "react"
import {
  autoSaveClaimRegistration,
  autoSaveBulkClaimRegistration,
  loadTradesForApp,
  loadClaimsForApp,
  getAllBulkClaims,
  loadBulkClaimForApp,
  autoSaveTradesFromAppSafe,
} from "@/lib/supabase-integration"
import type { TradeData } from "@/lib/data-processor"

export function useSupabaseSync() {
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncStatus, setSyncStatus] = useState<string>("")

  // Auto-sync trades when uploaded
  const syncTrades = async (trades: TradeData[], fileName: string) => {
    setSyncing(true)
    setSyncStatus("Syncing trades to database...")

    try {
      // Use the safe version that checks for duplicates first
      await autoSaveTradesFromAppSafe(trades, fileName)
      setLastSync(new Date())
      setSyncStatus(`✅ Synced ${trades.length} trades successfully`)

      // Clear status after 3 seconds
      setTimeout(() => setSyncStatus(""), 3000)
    } catch (error) {
      setSyncStatus("❌ Failed to sync trades")
      console.error("Sync error:", error)
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync claim registration
  const syncClaimRegistration = async (claimData: any) => {
    setSyncing(true)
    setSyncStatus("Syncing claim registration...")

    try {
      await autoSaveClaimRegistration(claimData)
      setLastSync(new Date())
      setSyncStatus(`✅ Synced claim ${claimData.claimId}`)

      setTimeout(() => setSyncStatus(""), 3000)
    } catch (error) {
      setSyncStatus("❌ Failed to sync claim")
      console.error("Sync error:", error)
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync bulk claim registration
  const syncBulkClaimRegistration = async (bulkData: any) => {
    setSyncing(true)
    setSyncStatus("Syncing bulk claim registration...")

    try {
      await autoSaveBulkClaimRegistration(bulkData)
      setLastSync(new Date())
      setSyncStatus(`✅ Synced bulk claim ${bulkData.bulkId}`)

      setTimeout(() => setSyncStatus(""), 3000)
    } catch (error) {
      setSyncStatus("❌ Failed to sync bulk claim")
      console.error("Sync error:", error)
    } finally {
      setSyncing(false)
    }
  }

  // Load data from database
  const loadFromDatabase = async (dataSource?: "equity" | "fx") => {
    setSyncing(true)
    setSyncStatus("Loading data from database...")

    try {
      const trades = await loadTradesForApp(dataSource)
      const claims = await loadClaimsForApp()
      const bulkClaims = await getAllBulkClaims()

      setSyncStatus(`✅ Loaded ${trades.length} trades, ${claims.length} claims`)
      setTimeout(() => setSyncStatus(""), 3000)

      return { trades, claims, bulkClaims }
    } catch (error) {
      setSyncStatus("❌ Failed to load data")
      console.error("Load error:", error)
      return { trades: [], claims: [], bulkClaims: [] }
    } finally {
      setSyncing(false)
    }
  }

  return {
    syncing,
    lastSync,
    syncStatus,
    syncTrades,
    syncClaimRegistration,
    syncBulkClaimRegistration,
    loadFromDatabase,
    loadBulkClaimForApp,
  }
}
