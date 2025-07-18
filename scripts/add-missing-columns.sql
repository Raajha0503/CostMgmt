-- Migration script to add missing columns to existing trades table
-- Run this script in your Supabase SQL editor

-- Add missing financial columns to trades table
ALTER TABLE trades ADD COLUMN IF NOT EXISTS fx_gain_loss DECIMAL(15,2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS custody_fee DECIMAL(15,2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS settlement_cost DECIMAL(15,2);

-- Add missing calculated columns
ALTER TABLE trades ADD COLUMN IF NOT EXISTS sla_breach_days INTEGER;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS claim_amount DECIMAL(15,2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(20);

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_trades_sla_breach_days ON trades(sla_breach_days);
CREATE INDEX IF NOT EXISTS idx_trades_claim_amount ON trades(claim_amount);
CREATE INDEX IF NOT EXISTS idx_trades_eligibility_status ON trades(eligibility_status);
CREATE INDEX IF NOT EXISTS idx_trades_fx_gain_loss ON trades(fx_gain_loss);
CREATE INDEX IF NOT EXISTS idx_trades_custody_fee ON trades(custody_fee);
CREATE INDEX IF NOT EXISTS idx_trades_settlement_cost ON trades(settlement_cost);

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

-- Update existing records to populate the new calculated fields
UPDATE trades SET 
    sla_breach_days = calculate_sla_breach_days(value_date, settlement_date),
    claim_amount = calculate_claim_amount(data_source, market_impact_cost, fx_gain_loss, custody_fee, settlement_cost),
    eligibility_status = CASE 
        WHEN (settlement_status IN ('Failed', 'Delayed')) AND (calculate_claim_amount(data_source, market_impact_cost, fx_gain_loss, custody_fee, settlement_cost) > 1000) THEN 'Eligible'
        ELSE 'Not Eligible'
    END
WHERE sla_breach_days IS NULL OR claim_amount IS NULL OR eligibility_status IS NULL;

-- Verify the columns were added successfully
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'trades' 
AND column_name IN ('fx_gain_loss', 'custody_fee', 'settlement_cost', 'sla_breach_days', 'claim_amount', 'eligibility_status')
ORDER BY column_name;
