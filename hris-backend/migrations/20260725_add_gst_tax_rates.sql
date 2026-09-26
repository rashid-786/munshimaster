CREATE TABLE IF NOT EXISTS hris_saas.gst_tax_rates (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    gst_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    cess_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO hris_saas.gst_tax_rates (id, name, gst_percentage, cess_percentage, description, is_active, display_order) VALUES
('gst-00', 'Tax Exempted', 0, 0, 'No tax applicable', true, 1),
('gst-01', 'GST @ 0%', 0, 0, 'Zero rated supply', true, 2),
('gst-02', 'GST @ 0.1%', 0.1, 0, NULL, true, 3),
('gst-03', 'GST @ 0.25%', 0.25, 0, NULL, true, 4),
('gst-04', 'GST @ 1.5%', 1.5, 0, NULL, true, 5),
('gst-05', 'GST @ 3%', 3, 0, NULL, true, 6),
('gst-06', 'GST @ 5%', 5, 0, NULL, true, 7),
('gst-07', 'GST @ 6%', 6, 0, NULL, true, 8),
('gst-08', 'GST @ 8.9%', 8.9, 0, NULL, true, 9),
('gst-09', 'GST @ 12%', 12, 0, NULL, true, 10),
('gst-10', 'GST @ 13.8%', 13.8, 0, NULL, true, 11),
('gst-11', 'GST @ 14% + Cess @ 12%', 14, 12, '14% GST with 12% Cess', true, 12),
('gst-12', 'GST @ 18%', 18, 0, NULL, true, 13),
('gst-13', 'GST @ 28%', 28, 0, NULL, true, 14),
('gst-14', 'GST @ 28% + Cess @ 5%', 28, 5, '28% GST with 5% Cess', true, 15),
('gst-15', 'GST @ 40%', 40, 0, NULL, true, 16),
('gst-16', 'GST @ 28% + Cess @ 36%', 28, 36, '28% GST with 36% Cess', true, 17),
('gst-17', 'GST @ 28% + Cess @ 60%', 28, 60, '28% GST with 60% Cess', true, 18)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, gst_percentage=EXCLUDED.gst_percentage, cess_percentage=EXCLUDED.cess_percentage, description=EXCLUDED.description, is_active=EXCLUDED.is_active, display_order=EXCLUDED.display_order;
