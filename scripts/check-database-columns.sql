-- Check what columns actually exist in the trades table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'trades' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if the problematic columns exist
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'custody_fee') 
        THEN 'custody_fee column EXISTS' 
        ELSE 'custody_fee column MISSING' 
    END as custody_fee_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'fx_gain_loss') 
        THEN 'fx_gain_loss column EXISTS' 
        ELSE 'fx_gain_loss column MISSING' 
    END as fx_gain_loss_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'settlement_cost') 
        THEN 'settlement_cost column EXISTS' 
        ELSE 'settlement_cost column MISSING' 
    END as settlement_cost_status;
