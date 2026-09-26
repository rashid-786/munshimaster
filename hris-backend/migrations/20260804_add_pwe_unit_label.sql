ALTER TABLE hris_saas.piece_work_entries ADD COLUMN IF NOT EXISTS unit_label VARCHAR(50) DEFAULT 'pcs';
