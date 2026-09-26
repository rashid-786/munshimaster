-- kirana_parties.opening_balance is queried by kirana.controller.js but was never
-- created by the original kirana tables migration. Hostinger's fresh DB is missing
-- it, which breaks the buyers/sellers (parties) screens with "Failed to fetch parties."
ALTER TABLE hris_saas.kirana_parties ADD COLUMN IF NOT EXISTS opening_balance BIGINT DEFAULT NULL;