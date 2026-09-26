-- System States table for country-state dropdowns across the app
CREATE TABLE IF NOT EXISTS hris_saas.system_states (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(4) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    state_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(country_code, state_name)
);

CREATE INDEX IF NOT EXISTS idx_system_states_country ON hris_saas.system_states(country_code);

-- India
INSERT INTO hris_saas.system_states (country_code, state_name, state_code) VALUES
('IN', 'Andhra Pradesh', 'AP'), ('IN', 'Arunachal Pradesh', 'AR'), ('IN', 'Assam', 'AS'),
('IN', 'Bihar', 'BR'), ('IN', 'Chhattisgarh', 'CG'), ('IN', 'Goa', 'GA'),
('IN', 'Gujarat', 'GJ'), ('IN', 'Haryana', 'HR'), ('IN', 'Himachal Pradesh', 'HP'),
('IN', 'Jharkhand', 'JH'), ('IN', 'Karnataka', 'KA'), ('IN', 'Kerala', 'KL'),
('IN', 'Madhya Pradesh', 'MP'), ('IN', 'Maharashtra', 'MH'), ('IN', 'Manipur', 'MN'),
('IN', 'Meghalaya', 'ML'), ('IN', 'Mizoram', 'MZ'), ('IN', 'Nagaland', 'NL'),
('IN', 'Odisha', 'OD'), ('IN', 'Punjab', 'PB'), ('IN', 'Rajasthan', 'RJ'),
('IN', 'Sikkim', 'SK'), ('IN', 'Tamil Nadu', 'TN'), ('IN', 'Telangana', 'TS'),
('IN', 'Tripura', 'TR'), ('IN', 'Uttar Pradesh', 'UP'), ('IN', 'Uttarakhand', 'UK'),
('IN', 'West Bengal', 'WB'), ('IN', 'Andaman and Nicobar Islands', 'AN'),
('IN', 'Chandigarh', 'CH'), ('IN', 'Dadra and Nagar Haveli and Daman and Diu', 'DD'),
('IN', 'Delhi', 'DL'), ('IN', 'Jammu and Kashmir', 'JK'), ('IN', 'Ladakh', 'LA'),
('IN', 'Lakshadweep', 'LD'), ('IN', 'Puducherry', 'PY')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- Kuwait
INSERT INTO hris_saas.system_states (country_code, state_name) VALUES
('KW', 'Al Ahmadi'), ('KW', 'Al Farwaniyah'), ('KW', 'Al Asimah'),
('KW', 'Al Jahra'), ('KW', 'Hawalli'), ('KW', 'Mubarak Al-Kabeer')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- UAE
INSERT INTO hris_saas.system_states (country_code, state_name) VALUES
('AE', 'Abu Dhabi'), ('AE', 'Dubai'), ('AE', 'Sharjah'),
('AE', 'Ajman'), ('AE', 'Umm Al Quwain'), ('AE', 'Ras Al Khaimah'),
('AE', 'Fujairah')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- Saudi Arabia
INSERT INTO hris_saas.system_states (country_code, state_name) VALUES
('SA', 'Riyadh'), ('SA', 'Makkah'), ('SA', 'Madinah'),
('SA', 'Eastern Province'), ('SA', 'Asir'), ('SA', 'Tabuk'),
('SA', 'Ha''il'), ('SA', 'Northern Borders'), ('SA', 'Jizan'),
('SA', 'Najran'), ('SA', 'Al Bahah'), ('SA', 'Al Jawf'),
('SA', 'Al Qassim')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- Qatar
INSERT INTO hris_saas.system_states (country_code, state_name) VALUES
('QA', 'Doha'), ('QA', 'Al Rayyan'), ('QA', 'Al Wakrah'),
('QA', 'Al Khor'), ('QA', 'Al Shamal'), ('QA', 'Umm Salal'),
('QA', 'Al Daayen'), ('QA', 'Al Sheehaniya')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- Bahrain
INSERT INTO hris_saas.system_states (country_code, state_name) VALUES
('BH', 'Capital Governorate'), ('BH', 'Muharraq Governorate'),
('BH', 'Northern Governorate'), ('BH', 'Southern Governorate')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- Oman
INSERT INTO hris_saas.system_states (country_code, state_name) VALUES
('OM', 'Muscat'), ('OM', 'Dhofar'), ('OM', 'Musandam'),
('OM', 'Al Buraimi'), ('OM', 'Al Dakhiliyah'), ('OM', 'Al Batinah North'),
('OM', 'Al Batinah South'), ('OM', 'Al Sharqiyah North'), ('OM', 'Al Sharqiyah South'),
('OM', 'Al Dhahirah'), ('OM', 'Al Wusta')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- Pakistan
INSERT INTO hris_saas.system_states (country_code, state_name) VALUES
('PK', 'Punjab'), ('PK', 'Sindh'), ('PK', 'Khyber Pakhtunkhwa'),
('PK', 'Balochistan'), ('PK', 'Islamabad Capital Territory'), ('PK', 'Gilgit-Baltistan'),
('PK', 'Azad Jammu and Kashmir')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- Bangladesh
INSERT INTO hris_saas.system_states (country_code, state_name) VALUES
('BD', 'Dhaka'), ('BD', 'Chittagong'), ('BD', 'Rajshahi'),
('BD', 'Khulna'), ('BD', 'Barisal'), ('BD', 'Sylhet'),
('BD', 'Rangpur'), ('BD', 'Mymensingh')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- Egypt
INSERT INTO hris_saas.system_states (country_code, state_name) VALUES
('EG', 'Cairo'), ('EG', 'Alexandria'), ('EG', 'Giza'),
('EG', 'Luxor'), ('EG', 'Aswan'), ('EG', 'Asyut'),
('EG', 'Beheira'), ('EG', 'Beni Suef'), ('EG', 'Dakahlia'),
('EG', 'Damietta'), ('EG', 'Faiyum'), ('EG', 'Gharbia'),
('EG', 'Ismailia'), ('EG', 'Kafr El Sheikh'), ('EG', 'Matrouh'),
('EG', 'Minya'), ('EG', 'Monufia'), ('EG', 'New Valley'),
('EG', 'North Sinai'), ('EG', 'Port Said'), ('EG', 'Qalyubia'),
('EG', 'Qena'), ('EG', 'Red Sea'), ('EG', 'Sharqia'),
('EG', 'Sohag'), ('EG', 'South Sinai'), ('EG', 'Suez')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- United States (major states)
INSERT INTO hris_saas.system_states (country_code, state_name, state_code) VALUES
('US', 'Alabama', 'AL'), ('US', 'Alaska', 'AK'), ('US', 'Arizona', 'AZ'),
('US', 'Arkansas', 'AR'), ('US', 'California', 'CA'), ('US', 'Colorado', 'CO'),
('US', 'Connecticut', 'CT'), ('US', 'Delaware', 'DE'), ('US', 'Florida', 'FL'),
('US', 'Georgia', 'GA'), ('US', 'Hawaii', 'HI'), ('US', 'Idaho', 'ID'),
('US', 'Illinois', 'IL'), ('US', 'Indiana', 'IN'), ('US', 'Iowa', 'IA'),
('US', 'Kansas', 'KS'), ('US', 'Kentucky', 'KY'), ('US', 'Louisiana', 'LA'),
('US', 'Maine', 'ME'), ('US', 'Maryland', 'MD'), ('US', 'Massachusetts', 'MA'),
('US', 'Michigan', 'MI'), ('US', 'Minnesota', 'MN'), ('US', 'Mississippi', 'MS'),
('US', 'Missouri', 'MO'), ('US', 'Montana', 'MT'), ('US', 'Nebraska', 'NE'),
('US', 'Nevada', 'NV'), ('US', 'New Hampshire', 'NH'), ('US', 'New Jersey', 'NJ'),
('US', 'New Mexico', 'NM'), ('US', 'New York', 'NY'), ('US', 'North Carolina', 'NC'),
('US', 'North Dakota', 'ND'), ('US', 'Ohio', 'OH'), ('US', 'Oklahoma', 'OK'),
('US', 'Oregon', 'OR'), ('US', 'Pennsylvania', 'PA'), ('US', 'Rhode Island', 'RI'),
('US', 'South Carolina', 'SC'), ('US', 'South Dakota', 'SD'), ('US', 'Tennessee', 'TN'),
('US', 'Texas', 'TX'), ('US', 'Utah', 'UT'), ('US', 'Vermont', 'VT'),
('US', 'Virginia', 'VA'), ('US', 'Washington', 'WA'), ('US', 'West Virginia', 'WV'),
('US', 'Wisconsin', 'WI'), ('US', 'Wyoming', 'WY')
ON CONFLICT (country_code, state_name) DO NOTHING;

-- United Kingdom
INSERT INTO hris_saas.system_states (country_code, state_name) VALUES
('GB', 'England'), ('GB', 'Scotland'), ('GB', 'Wales'),
('GB', 'Northern Ireland')
ON CONFLICT (country_code, state_name) DO NOTHING;
