"use client"

import type React from "react"
import { useSupabaseSync } from "@/hooks/use-supabase-sync"

interface AutoSyncIntegrationProps {
  children: React.ReactNode
}

export default function AutoSyncIntegration({ children }: AutoSyncIntegrationProps) {
  const { syncStatus, syncing } = useSupabaseSync()

  return (
    <div className="relative">
      {/* Sync Status Indicator */}
      {(syncing || syncStatus) && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`px-4 py-2 rounded-lg shadow-lg ${
              syncStatus.includes("✅")
                ? "bg-green-100 text-green-800"
                : syncStatus.includes("❌")
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-100 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {syncing && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>}
              <span className="text-sm font-medium">{syncStatus}</span>
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  )
}
