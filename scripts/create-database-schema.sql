-- Create database schema for Interest Claims Management System
-- Run this script to set up your Supabase database

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create enum types
CREATE TYPE trade_data_source AS ENUM ('equity', 'fx');
CREATE TYPE claim_status AS ENUM ('pending', 'registered', 'under_investigation', 'approved', 'rejected', 'issued', 'settled', 'closed');
CREATE TYPE workflow_status AS ENUM ('receipt', 'registration', 'investigation', 'approval', 'issuance', 'settlement', 'follow_up');

-- Trades table - stores all uploaded trade data
CREATE TABLE trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trade_id VARCHAR(50) UNIQUE NOT NULL,
    order_id VARCHAR(50),
    client_id VARCHAR(50),
    data_source trade_data_source NOT NULL,
    
    -- Common fields
    trade_type VARCHAR(20),
    trade_date DATE,
    settlement_date DATE,
    value_date DATE,
    settlement_status VARCHAR(20),
    counterparty VARCHAR(100),
    trading_venue VARCHAR(100),
    confirmation_status VARCHAR(20),
    currency VARCHAR(10),
    
    -- Equity specific fields
    isin VARCHAR(20),
    symbol VARCHAR(20),
    quantity DECIMAL(15,2),
    price DECIMAL(15,4),
    trade_value DECIMAL(15,2),
    trader_name VARCHAR(100),
    kyc_status VARCHAR(20),
    reference_data_validated BOOLEAN,
    
    -- FX specific fields
    currency_pair VARCHAR(10),
    buy_sell VARCHAR(10),
    dealt_currency VARCHAR(10),
    base_currency VARCHAR(10),
    term_currency VARCHAR(10),
    notional_amount DECIMAL(15,2),
    fx_rate DECIMAL(10,6),
    
    -- Financial fields
    commission DECIMAL(15,2),
    taxes DECIMAL(15,2),
    total_cost DECIMAL(15,2),
    market_impact_cost DECIMAL(15,2),
    fx_rate_applied DECIMAL(10,6),
    net_amount DECIMAL(15,2),
    fx_gain_loss DECIMAL(15,2),
    custody_fee DECIMAL(15,2),
    settlement_cost DECIMAL(15,2),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id),
    original_file_name VARCHAR(255),
    raw_data JSONB -- Store original CSV row data
);

-- Add missing columns to trades table for Interest Claims app compatibility
ALTER TABLE trades ADD COLUMN IF NOT EXISTS sla_breach_days INTEGER;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS claim_amount DECIMAL(15,2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(20);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS fx_gain_loss DECIMAL(15,2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS custody_fee DECIMAL(15,2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS settlement_cost DECIMAL(15,2);

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_trades_sla_breach_days ON trades(sla_breach_days);
CREATE INDEX IF NOT EXISTS idx_trades_claim_amount ON trades(claim_amount);
CREATE INDEX IF NOT EXISTS idx_trades_eligibility_status ON trades(eligibility_status);

-- Add a function to calculate SLA breach days
CREATE OR REPLACE FUNCTION calculate_sla_breach_days(value_date DATE, settlement_date DATE)
RETURNS INTEGER AS $$
BEGIN
    IF value_date IS NULL OR settlement_date IS NULL THEN
        RETURN 0;
    END IF;
    
    RETURN GREATEST(0, settlement_date - value_date);
END;
$$ LANGUAGE plpgsql;

-- Add a function to calculate claim amount
CREATE OR REPLACE FUNCTION calculate_claim_amount(data_source trade_data_source, market_impact_cost DECIMAL, fx_gain_loss DECIMAL, custody_fee DECIMAL, settlement_cost DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF data_source = 'fx' THEN
        RETURN COALESCE(ABS(fx_gain_loss), 0) + COALESCE(custody_fee, 0) + COALESCE(settlement_cost, 0);
    ELSE
        RETURN COALESCE(market_impact_cost, 0);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add a trigger to automatically calculate these fields
CREATE OR REPLACE FUNCTION update_calculated_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate SLA breach days
    NEW.sla_breach_days = calculate_sla_breach_days(NEW.value_date, NEW.settlement_date);
    
    -- Calculate claim amount
    NEW.claim_amount = calculate_claim_amount(
        NEW.data_source, 
        NEW.market_impact_cost, 
        NEW.fx_gain_loss, 
        NEW.custody_fee, 
        NEW.settlement_cost
    );
    
    -- Calculate eligibility status
    IF (NEW.settlement_status IN ('Failed', 'Delayed')) AND (NEW.claim_amount > 1000) THEN
        NEW.eligibility_status = 'Eligible';
    ELSE
        NEW.eligibility_status = 'Not Eligible';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS calculate_fields_trigger ON trades;
CREATE TRIGGER calculate_fields_trigger
    BEFORE INSERT OR UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_calculated_fields();

-- Claims table - stores interest claims
CREATE TABLE claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    claim_id VARCHAR(50) UNIQUE NOT NULL,
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    
    -- Claim details
    claim_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    interest_rate DECIMAL(5,4),
    delay_days INTEGER,
    claim_reason TEXT,
    claim_type VARCHAR(20), -- 'receivable' or 'payable'
    
    -- Status and workflow
    status claim_status DEFAULT 'pending',
    workflow_stage workflow_status DEFAULT 'receipt',
    priority VARCHAR(10) DEFAULT 'medium',
    
    -- Dates
    registration_date DATE,
    investigation_start_date DATE,
    approval_date DATE,
    issuance_date DATE,
    settlement_date DATE,
    closure_date DATE,
    
    -- Assignments
    assigned_investigator UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Bulk claims table - for bulk registrations
CREATE TABLE bulk_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bulk_id VARCHAR(50) UNIQUE NOT NULL,
    total_claims INTEGER NOT NULL,
    registration_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'under_investigation',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link individual claims to bulk claims
CREATE TABLE bulk_claim_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bulk_claim_id UUID REFERENCES bulk_claims(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Claim workflow history - audit trail
CREATE TABLE claim_workflow_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    from_stage workflow_status,
    to_stage workflow_status NOT NULL,
    from_status claim_status,
    to_status claim_status NOT NULL,
    notes TEXT,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Investigation notes
CREATE TABLE investigation_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    note_type VARCHAR(20), -- 'investigation', 'approval', 'settlement', etc.
    content TEXT NOT NULL,
    attachments JSONB, -- Store file references
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File uploads tracking
CREATE TABLE file_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(50),
    storage_path VARCHAR(500),
    upload_type VARCHAR(20), -- 'trade_data', 'supporting_document', etc.
    related_entity_type VARCHAR(20), -- 'trade', 'claim', etc.
    related_entity_id UUID,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_trades_trade_id ON trades(trade_id);
CREATE INDEX idx_trades_data_source ON trades(data_source);
CREATE INDEX idx_trades_trade_date ON trades(trade_date);
CREATE INDEX idx_trades_counterparty ON trades(counterparty);
CREATE INDEX idx_claims_claim_id ON claims(claim_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_workflow_stage ON claims(workflow_stage);
CREATE INDEX idx_claims_trade_id ON claims(trade_id);
CREATE INDEX idx_bulk_claims_bulk_id ON bulk_claims(bulk_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_claim_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_workflow_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic - you may want to customize based on your auth requirements)
CREATE POLICY "Users can view their own trades" ON trades
    FOR SELECT USING (uploaded_by = auth.uid());

CREATE POLICY "Users can insert their own trades" ON trades
    FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can view all claims" ON claims FOR SELECT USING (true);
CREATE POLICY "Users can insert claims" ON claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update claims" ON claims FOR UPDATE USING (true);

-- Similar policies for other tables...
CREATE POLICY "Users can view bulk claims" ON bulk_claims FOR SELECT USING (true);
CREATE POLICY "Users can insert bulk claims" ON bulk_claims FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view workflow history" ON claim_workflow_history FOR SELECT USING (true);
CREATE POLICY "Users can insert workflow history" ON claim_workflow_history FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view investigation notes" ON investigation_notes FOR SELECT USING (true);
CREATE POLICY "Users can insert investigation notes" ON investigation_notes FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view file uploads" ON file_uploads FOR SELECT USING (true);
CREATE POLICY "Users can insert file uploads" ON file_uploads FOR INSERT WITH CHECK (true);
