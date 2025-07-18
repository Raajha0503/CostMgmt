"use client"

import { createClient } from "@supabase/supabase-js"

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create a mock client when environment variables are not available
const createMockClient = () => ({
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: [], error: null }),
    update: () => ({ data: [], error: null }),
    delete: () => ({ data: [], error: null }),
    upsert: () => ({ data: [], error: null }),
    eq: function () {
      return this
    },
    in: function () {
      return this
    },
    single: () => ({ data: null, error: null }),
    order: function () {
      return this
    },
  }),
  auth: {
    signUp: () => ({ data: null, error: null }),
    signIn: () => ({ data: null, error: null }),
    signOut: () => ({ error: null }),
    getUser: () => ({ data: { user: null }, error: null }),
  },
})

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : createMockClient()

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

// Database types based on our schema
export interface Trade {
  id: string
  trade_id: string
  order_id?: string
  client_id?: string
  data_source: "equity" | "fx"
  trade_type?: string
  trade_date?: string
  settlement_date?: string
  value_date?: string
  settlement_status?: string
  counterparty?: string
  trading_venue?: string
  confirmation_status?: string
  currency?: string

  // Equity fields
  isin?: string
  symbol?: string
  quantity?: number
  price?: number
  trade_value?: number
  trader_name?: string
  kyc_status?: string
  reference_data_validated?: boolean

  // FX fields
  currency_pair?: string
  buy_sell?: string
  dealt_currency?: string
  base_currency?: string
  term_currency?: string
  notional_amount?: number
  fx_rate?: number

  // Financial fields
  commission?: number
  taxes?: number
  total_cost?: number
  market_impact_cost?: number
  fx_rate_applied?: number
  net_amount?: number

  // Metadata
  created_at: string
  updated_at: string
  uploaded_by?: string
  original_file_name?: string
  raw_data?: any
}

export interface Claim {
  id: string
  claim_id: string
  trade_id: string
  claim_amount: number
  currency: string
  interest_rate?: number
  delay_days?: number
  claim_reason?: string
  claim_type?: string
  status: "pending" | "registered" | "under_investigation" | "approved" | "rejected" | "issued" | "settled" | "closed"
  workflow_stage: "receipt" | "registration" | "investigation" | "approval" | "issuance" | "settlement" | "follow_up"
  priority?: string

  // Dates
  registration_date?: string
  investigation_start_date?: string
  approval_date?: string
  issuance_date?: string
  settlement_date?: string
  closure_date?: string

  // Assignments
  assigned_investigator?: string
  approved_by?: string

  // Metadata
  created_at: string
  updated_at: string
  created_by?: string

  // Relations
  trade?: Trade
}

export interface BulkClaim {
  id: string
  bulk_id: string
  total_claims: number
  registration_date: string
  status: string
  created_by?: string
  created_at: string

  // Relations
  claims?: Claim[]
}

export interface InvestigationNote {
  id: string
  claim_id: string
  note_type?: string
  content: string
  attachments?: any
  created_by?: string
  created_at: string
}

export interface FileUpload {
  id: string
  file_name: string
  file_size?: number
  file_type?: string
  storage_path?: string
  upload_type?: string
  related_entity_type?: string
  related_entity_id?: string
  uploaded_by?: string
  uploaded_at: string
}
