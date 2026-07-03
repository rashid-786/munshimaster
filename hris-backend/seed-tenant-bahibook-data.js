require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const url = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:5432/${process.env.DB_NAME}`;
const pool = new Pool({ connectionString: url });

const TENANT_ID = '9eb1bc28-cb14-4ea5-ab7e-bc3aad1e5333';
const EMPLOYEE_ID = '85e99cd7-65a8-4618-acd6-61151f800912';
const CURRENT_MONTH = '2026-07-01';

// ── Helpers ──

function randomDate(startDays, endDays) {
  const d = new Date();
  d.setDate(d.getDate() - startDays - Math.floor(Math.random() * (endDays - startDays + 1)));
  return d.toISOString().split('T')[0];
}

function cents(rupees) {
  return Math.round(rupees * 100);
}

// ── Data ──

const buyers = [
  { name: 'Ramesh General Store', phone: '+919876543210' },
  { name: 'Priya Provisions', phone: '+919876543211' },
  { name: 'Vinayak Tea Stall', phone: '+919876543212' },
  { name: 'Saraswati Kirana', phone: '+919876543213' },
  { name: 'Laxmi Medicals', phone: '+919876543214' },
];

const sellers = [
  { name: 'ITC Wholesale', phone: '+919876543215' },
  { name: 'Britannia Distributors', phone: '+919876543216' },
  { name: 'HUL Supply Chain', phone: '+919876543217' },
  { name: 'Patanjali Agencies', phone: '+919876543218' },
  { name: 'Nestle Trading Co', phone: '+919876543219' },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Clearing existing BahiBook data for Free Demo Store...');
    await client.query('DELETE FROM hris_saas.kirana_transactions WHERE tenant_id = $1', [TENANT_ID]);
    await client.query('DELETE FROM hris_saas.kirana_cashbook WHERE tenant_id = $1', [TENANT_ID]);
    await client.query('DELETE FROM hris_saas.kirana_parties WHERE tenant_id = $1', [TENANT_ID]);

    // ── 1. Seed Buyers (kirana_parties type = 'buyer') ──
    console.log('\nSeeding Buyers...');
    const buyerIds = [];
    for (const b of buyers) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO hris_saas.kirana_parties (id, tenant_id, type, name, phone, created_at)
         VALUES ($1, $2, 'buyer', $3, $4, NOW())`,
        [id, TENANT_ID, b.name, b.phone]
      );
      buyerIds.push(id);
      console.log(`  Buyer: ${b.name} (${id})`);
    }

    // ── 2. Seed Sellers (kirana_parties type = 'seller') ──
    console.log('\nSeeding Sellers...');
    const sellerIds = [];
    for (const s of sellers) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO hris_saas.kirana_parties (id, tenant_id, type, name, phone, created_at)
         VALUES ($1, $2, 'seller', $3, $4, NOW())`,
        [id, TENANT_ID, s.name, s.phone]
      );
      sellerIds.push(id);
      console.log(`  Seller: ${s.name} (${id})`);
    }

    // ── 3. Seed Kirana Transactions ──
    console.log('\nSeeding Transactions (23 entries)...');
    for (let i = 0; i < 23; i++) {
      const isBuyerTxn = Math.random() > 0.4;
      const party = isBuyerTxn
        ? buyerIds[Math.floor(Math.random() * buyerIds.length)]
        : sellerIds[Math.floor(Math.random() * sellerIds.length)];
      const txnType = isBuyerTxn ? 'given' : 'received';
      const amount = cents(Math.floor(Math.random() * 5000) + 100);
      const entryDate = randomDate(30, 0);

      await client.query(
        `INSERT INTO hris_saas.kirana_transactions (id, tenant_id, party_id, type, amount, note, entry_date, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [uuidv4(), TENANT_ID, party, txnType, amount, `Transaction #${i + 1}`, entryDate, EMPLOYEE_ID]
      );
    }
    console.log('  23 transactions created.');

    // ── 4. Seed Cashbook Entries ──
    console.log('\nSeeding Cashbook Entries (6 entries)...');
    const cashCategories = ['Rent', 'Electricity', 'Salary', 'Miscellaneous', 'Transport', 'Office Supplies'];
    for (let i = 0; i < 6; i++) {
      const type = i % 3 === 0 ? 'IN' : 'OUT';
      const amount = cents(Math.floor(Math.random() * 20000) + 500);
      const entryDate = randomDate(30, 0);

      await client.query(
        `INSERT INTO hris_saas.kirana_cashbook (id, tenant_id, type, category, amount, note, entry_date, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [uuidv4(), TENANT_ID, type, cashCategories[i], amount, `Cash ${type === 'IN' ? 'deposit' : 'expense'} #${i + 1}`, entryDate, EMPLOYEE_ID]
      );
    }
    console.log('  6 cashbook entries created.');

    // ── 5. Update tenant_usage to match actual counts ──
    console.log('\nUpdating tenant_usage counters...');
    const txnCount = 23;
    const cashCount = 6;
    const partyCount = buyers.length + sellers.length;

    await client.query(
      `UPDATE hris_saas.tenant_usage
       SET transaction_count = GREATEST(transaction_count, $1),
           cashbook_entry_count = GREATEST(cashbook_entry_count, $2),
           updated_at = NOW()
       WHERE tenant_id = $3 AND usage_month = $4`,
      [txnCount, cashCount, TENANT_ID, CURRENT_MONTH]
    );
    console.log(`  tenant_usage updated (txns=${txnCount}, cashbook=${cashCount})`);

    await client.query('COMMIT');
    console.log('\nBahiBook seed data created successfully!');
    console.log(`  Buyers: ${buyerIds.length}`);
    console.log(`  Sellers: ${sellerIds.length}`);
    console.log(`  Transactions: 23`);
    console.log(`  Cashbook Entries: 6`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
