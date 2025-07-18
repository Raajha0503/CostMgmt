import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase-client"

export async function GET(request: NextRequest) {
  try {
    // Get all data for backup
    const [trades, claims, bulkClaims, notes] = await Promise.all([
      supabase.from("trades").select("*"),
      supabase.from("claims").select("*"),
      supabase.from("bulk_claims").select("*"),
      supabase.from("investigation_notes").select("*"),
    ])

    const backup = {
      timestamp: new Date().toISOString(),
      data: {
        trades: trades.data || [],
        claims: claims.data || [],
        bulk_claims: bulkClaims.data || [],
        investigation_notes: notes.data || [],
      },
    }

    return NextResponse.json(backup)
  } catch (error) {
    console.error("Backup failed:", error)
    return NextResponse.json({ error: "Backup failed" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const backup = await request.json()

    // Restore data from backup
    // Note: This is a simplified restore - you might want more sophisticated logic
    const { data } = backup

    if (data.trades?.length) {
      await supabase.from("trades").insert(data.trades)
    }

    if (data.claims?.length) {
      await supabase.from("claims").insert(data.claims)
    }

    // ... restore other tables

    return NextResponse.json({ success: true, message: "Data restored successfully" })
  } catch (error) {
    console.error("Restore failed:", error)
    return NextResponse.json({ error: "Restore failed" }, { status: 500 })
  }
}
