-- Add notes column to kirana_parties for storing buyer/seller notes
ALTER TABLE hris_saas.kirana_parties ADD COLUMN IF NOT EXISTS notes TEXT;
