-- Create the complete Interest Claims database schema
-- This will store all data exactly as it appears in your app

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS claim_workflow_history CASCADE;
DROP TABLE IF EXISTS investigation_notes CASCADE;
DROP TABLE IF EXISTS bulk_claim_items CASCADE;
DROP TABLE IF EXISTS bulk_claims CASCADE;
DROP TABLE IF EXISTS claims CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS file_uploads CASCADE;

-- Create trades table to store all uploaded trade data
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255),
    client_id VARCHAR(255),
    data_source VARCHAR(10) CHECK (data_source IN ('equity', 'fx')),
    trade_type VARCHAR(50),
    trade_date DATE,
    settlement_date DATE,
    value_date DATE,
    settlement_status VARCHAR(50),
    counterparty VARCHAR(255),
    trading_venue VARCHAR(255),
    confirmation_status VARCHAR(50),
    currency VARCHAR(10),
    
    -- Equity specific fields
    isin VARCHAR(50),
    symbol VARCHAR(20),
    quantity DECIMAL(15,2),
    price DECIMAL(15,4),
    trade_value DECIMAL(15,2),
    trader_name VARCHAR(255),
    kyc_status VARCHAR(50),
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
    
    -- Calculated fields (as they appear in your app)
    sla_breach_days INTEGER DEFAULT 0,
    claim_amount DECIMAL(15,2) DEFAULT 0,
    eligibility_status VARCHAR(20) DEFAULT 'Not Eligible',
    
    -- Metadata
    uploaded_by VARCHAR(255),
    original_file_name VARCHAR(255),
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create claims table to store registered claims exactly as they appear
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id VARCHAR(255) UNIQUE NOT NULL,
    trade_id UUID REFERENCES trades(id),
    trade_reference VARCHAR(255), -- The trade ID as shown in app
    client_id VARCHAR(255),
    counterparty VARCHAR(255),
    claim_amount DECIMAL(15,2),
    currency VARCHAR(10),
    interest_rate DECIMAL(5,2),
    delay_days INTEGER,
    claim_reason VARCHAR(255) DEFAULT 'Settlement Delay',
    claim_type VARCHAR(20) DEFAULT 'receivable',
    
    -- Workflow status
    status VARCHAR(50) DEFAULT 'registered',
    workflow_stage VARCHAR(50) DEFAULT 'registration',
    
    -- Dates
    registration_date DATE DEFAULT CURRENT_DATE,
    value_date DATE,
    trade_date DATE,
    settlement_date DATE,
    investigation_start_date DATE,
    approval_date DATE,
    issuance_date DATE,
    settlement_completion_date DATE,
    closure_date DATE,
    
    -- Form data as it appears in registration
    trade_value DECIMAL(15,2),
    settlement_status VARCHAR(50),
    
    -- Supporting documents
    documents_uploaded BOOLEAN DEFAULT FALSE,
    document_checklist JSONB,
    
    -- Investigation details
    investigation_status VARCHAR(50),
    assigned_investigator VARCHAR(255),
    priority_level VARCHAR(20),
    investigation_notes TEXT,
    
    -- Approval details
    approval_decision VARCHAR(50),
    approved_amount DECIMAL(15,2),
    approver VARCHAR(255),
    approval_comments TEXT,
    
    -- Issuance details
    claim_notice_id VARCHAR(255),
    delivery_method VARCHAR(50),
    recipient_email VARCHAR(255),
    template_used VARCHAR(100),
    notice_sent_date DATE,
    due_date DATE,
    
    -- Settlement details
    settlement_method VARCHAR(50),
    payment_reference VARCHAR(255),
    received_amount DECIMAL(15,2),
    settlement_notes TEXT,
    
    -- Closure details
    closure_notes TEXT,
    closed_by VARCHAR(255),
    recovery_rate DECIMAL(5,2),
    
    -- Metadata
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bulk claims table for bulk registrations
CREATE TABLE bulk_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bulk_id VARCHAR(255) UNIQUE NOT NULL,
    total_claims INTEGER NOT NULL,
    registration_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'Under Investigation',
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bulk claim items to link individual claims to bulk registrations
CREATE TABLE bulk_claim_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bulk_claim_id UUID REFERENCES bulk_claims(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow history to track all status changes
CREATE TABLE claim_workflow_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50),
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    notes TEXT,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create investigation notes table
CREATE TABLE investigation_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    note_type VARCHAR(50) DEFAULT 'investigation',
    content TEXT NOT NULL,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create file uploads table
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(100),
    storage_path VARCHAR(500),
    upload_type VARCHAR(50),
    related_entity_id UUID,
    uploaded_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_trades_trade_id ON trades(trade_id);
CREATE INDEX idx_trades_data_source ON trades(data_source);
CREATE INDEX idx_trades_counterparty ON trades(counterparty);
CREATE INDEX idx_trades_trade_date ON trades(trade_date);
CREATE INDEX idx_trades_settlement_status ON trades(settlement_status);

CREATE INDEX idx_claims_claim_id ON claims(claim_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_workflow_stage ON claims(workflow_stage);
CREATE INDEX idx_claims_counterparty ON claims(counterparty);
CREATE INDEX idx_claims_registration_date ON claims(registration_date);

CREATE INDEX idx_bulk_claims_bulk_id ON bulk_claims(bulk_id);
CREATE INDEX idx_bulk_claims_registration_date ON bulk_claims(registration_date);

CREATE INDEX idx_workflow_history_claim_id ON claim_workflow_history(claim_id);
CREATE INDEX idx_workflow_history_changed_at ON claim_workflow_history(changed_at);

-- Create triggers to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bulk_claims_updated_at BEFORE UPDATE ON bulk_claims FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data that matches your app's display format
INSERT INTO trades (
    trade_id, client_id, data_source, trade_type, trade_date, settlement_date, value_date,
    settlement_status, counterparty, trading_venue, currency, symbol, quantity, price, trade_value,
    market_impact_cost, sla_breach_days, claim_amount, eligibility_status
) VALUES 
(
    'TRD-000001', 'CLIENT-001', 'equity', 'Buy', '2024-12-20', '2024-12-22', '2024-12-20',
    'Failed', 'Goldman Sachs', 'NYSE', 'USD', 'AAPL', 1000, 150.25, 150250.00,
    2500.00, 5, 2500.00, 'Eligible'
),
(
    'TRD-000002', 'CLIENT-002', 'equity', 'Sell', '2024-12-21', '2024-12-23', '2024-12-21',
    'Delayed', 'Morgan Stanley', 'NASDAQ', 'USD', 'GOOGL', 500, 2800.50, 1400250.00,
    1800.00, 3, 1800.00, 'Eligible'
),
(
    'FX-000001', 'CLIENT-003', 'fx', 'Buy', '2024-12-19', '2024-12-21', '2024-12-19',
    'Failed', 'JPMorgan', 'FX Market', 'USD', NULL, NULL, NULL, NULL,
    0, 7, 3200.00, 'Eligible'
);

-- Update calculated fields to match app display
UPDATE trades SET 
    sla_breach_days = CASE 
        WHEN settlement_status IN ('Failed', 'Delayed') THEN 
            EXTRACT(DAY FROM (settlement_date - value_date))
        ELSE 0 
    END,
    claim_amount = CASE 
        WHEN data_source = 'equity' THEN COALESCE(market_impact_cost, 0)
        WHEN data_source = 'fx' THEN COALESCE(fx_gain_loss, 0) + COALESCE(custody_fee, 0) + COALESCE(settlement_cost, 0)
        ELSE 0
    END,
    eligibility_status = CASE 
        WHEN settlement_status IN ('Failed', 'Delayed') AND 
             (COALESCE(market_impact_cost, 0) > 1000 OR 
              COALESCE(fx_gain_loss, 0) + COALESCE(custody_fee, 0) + COALESCE(settlement_cost, 0) > 1000)
        THEN 'Eligible'
        ELSE 'Not Eligible'
    END;

COMMIT;
