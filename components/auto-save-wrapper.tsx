"use client"

import type React from "react"

import { useState } from "react"
import { useDatabase } from "@/hooks/use-database"

interface AutoSaveWrapperProps {
  children: React.ReactNode
  onDataChange?: (data: any) => void
}

export default function AutoSaveWrapper({ children, onDataChange }: AutoSaveWrapperProps) {
  const { autoSaveTrades, autoSaveClaim, autoSaveBulkClaims, loading, error } = useDatabase()
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  // Auto-save notification component
  const SaveStatusIndicator = () => {
    if (saveStatus === "idle") return null

    return (
      <div
        className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300 ${
          saveStatus === "saving"
            ? "bg-blue-500 text-white"
            : saveStatus === "saved"
              ? "bg-green-500 text-white"
              : saveStatus === "error"
                ? "bg-red-500 text-white"
                : ""
        }`}
      >
        {saveStatus === "saving" && (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Saving...
          </div>
        )}
        {saveStatus === "saved" && "✓ Auto-saved"}
        {saveStatus === "error" && "✗ Save failed"}
      </div>
    )
  }

  // Auto-save function that can be called from child components
  const triggerAutoSave = async (data: any, type: "trades" | "claim" | "bulk_claims") => {
    setSaveStatus("saving")

    try {
      switch (type) {
        case "trades":
          await autoSaveTrades(data.trades, data.fileName)
          break
        case "claim":
          await autoSaveClaim(data)
          break
        case "bulk_claims":
          await autoSaveBulkClaims(data.bulkId, data.claims)
          break
      }

      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 3000) // Hide after 3 seconds

      if (onDataChange) {
        onDataChange(data)
      }
    } catch (err) {
      setSaveStatus("error")
      setTimeout(() => setSaveStatus("idle"), 5000) // Hide after 5 seconds
      console.error("Auto-save failed:", err)
    }
  }

  return (
    <div className="relative">
      {children}
      <SaveStatusIndicator />
    </div>
  )
}

// Context for auto-save functionality
import { createContext, useContext } from "react"

interface AutoSaveContextType {
  triggerAutoSave: (data: any, type: "trades" | "claim" | "bulk_claims") => Promise<void>
  saveStatus: "idle" | "saving" | "saved" | "error"
  loading: boolean
  error: string | null
}

const AutoSaveContext = createContext<AutoSaveContextType | null>(null)

export function AutoSaveProvider({ children }: { children: React.ReactNode }) {
  const database = useDatabase()
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const triggerAutoSave = async (data: any, type: "trades" | "claim" | "bulk_claims") => {
    setSaveStatus("saving")

    try {
      switch (type) {
        case "trades":
          await database.autoSaveTrades(data.trades, data.fileName)
          break
        case "claim":
          await database.autoSaveClaim(data)
          break
        case "bulk_claims":
          await database.autoSaveBulkClaims(data.bulkId, data.claims)
          break
      }

      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch (err) {
      setSaveStatus("error")
      setTimeout(() => setSaveStatus("idle"), 5000)
      throw err
    }
  }

  return (
    <AutoSaveContext.Provider
      value={{
        triggerAutoSave,
        saveStatus,
        loading: database.loading,
        error: database.error,
      }}
    >
      {children}
    </AutoSaveContext.Provider>
  )
}

export function useAutoSave() {
  const context = useContext(AutoSaveContext)
  if (!context) {
    throw new Error("useAutoSave must be used within an AutoSaveProvider")
  }
  return context
}
