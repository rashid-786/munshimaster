const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const DB_URL = process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:5432/${process.env.DB_NAME}`;

const pool = new Pool({ connectionString: DB_URL });

const PASSWORD = 'Password@123';
const SALT_ROUNDS = 10;

// Current month in YYYY-MM-01 format for usage records
const NOW = new Date();
const USAGE_MONTH = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-01`;

const TEST_TENANTS = [
  {
    planLabel: 'FREE',
    companyName: 'Free Demo Store',
    subdomain: 'free-demo',
    phone: '+917838087811',
    subscriptionPlan: 'FREE',
    subscriptionStatus: 'active',
    planId: 'free',
    usage: { entity_count: 1, transaction_count: 125, cashbook_entry_count: 35, staff_count: 0 },
  },
  {
    planLabel: 'MANAGE',
    companyName: 'Manage Demo Store',
    subdomain: 'manage-demo',
    phone: '+917838087822',
    subscriptionPlan: 'MANAGE',
    subscriptionStatus: 'active',
    planId: 'manage',
    usage: { entity_count: 2, transaction_count: 250, cashbook_entry_count: 50, staff_count: 7 },
  },
  {
    planLabel: 'BUSINESS',
    companyName: 'Business Demo Store',
    subdomain: 'business-demo',
    phone: '+917838087833',
    subscriptionPlan: 'BUSINESS',
    subscriptionStatus: 'active',
    planId: 'business',
    usage: { entity_count: 3, transaction_count: 850, cashbook_entry_count: 0, staff_count: 12 },
  },
  {
    planLabel: 'BUSINESS_PRO',
    companyName: 'Business Pro Demo Store',
    subdomain: 'business-pro-demo',
    phone: '+917838087844',
    subscriptionPlan: 'BUSINESS_PRO',
    subscriptionStatus: 'active',
    planId: 'business_pro',
    usage: { entity_count: 5, transaction_count: 1500, cashbook_entry_count: 0, staff_count: 20 },
  },
];

async function ensureSubscriptionPlans(client) {
  const { rows } = await client.query(
    `SELECT id FROM hris_saas.subscription_plans WHERE id IN ('manage', 'business_pro')`
  );
  const existing = new Set(rows.map(r => r.id));

  if (!existing.has('manage')) {
    console.log('  [seed] Inserting plan: manage');
    await client.query(
      `INSERT INTO hris_saas.subscription_plans (id, name, price_inr, period, trial_days, features)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'manage',
        'Manage',
        0,
        'year',
        14,
        JSON.stringify({
          ledger_customers: 250, staff_members: 10, monthly_txns: 3000,
          reports: 'basic', invoices: true, purchase_orders: true, payroll: false,
          inventory: false, branches: 1, export: true, whatsapp: false, api: false,
          branding: false, support: 'email',
        }),
      ]
    );
  }

  if (!existing.has('business_pro')) {
    console.log('  [seed] Inserting plan: business_pro');
    await client.query(
      `INSERT INTO hris_saas.subscription_plans (id, name, price_inr, period, trial_days, features)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'business_pro',
        'Business Pro',
        4999,
        'year',
        14,
        JSON.stringify({
          ledger_customers: -1, staff_members: -1, monthly_txns: -1,
          reports: 'advanced', invoices: true, purchase_orders: true, payroll: true,
          inventory: true, branches: 5, export: true, whatsapp: true, api: true,
          branding: true, support: 'phone',
        }),
      ]
    );
  }
}

async function tenantExists(client, phone) {
  const { rows } = await client.query(
    `SELECT id FROM hris_saas.tenants WHERE phone = $1 LIMIT 1`,
    [phone]
  );
  return rows.length > 0;
}

async function seedTenant(client, tenant, passwordHash) {
  const tenantId = uuidv4();
  const ownerId = uuidv4();
  const subId = uuidv4();
  const usageId = uuidv4();
  const ownerName = tenant.planLabel === 'FREE' ? 'Free Store Owner'
    : tenant.planLabel === 'MANAGE' ? 'Manage Store Owner'
    : tenant.planLabel === 'BUSINESS' ? 'Business Store Owner'
    : 'Business Pro Store Owner';

  const ownerEmail = `owner@${tenant.subdomain}.com`;

  // 1. Create tenant
  await client.query(
    `INSERT INTO hris_saas.tenants
       (id, company_name, tenant_name, subdomain, subscription_plan, subscription_status,
        start_date, expiry_date, phone, status, settings)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), '2099-12-31', $7, 'active', '{}')`,
    [
      tenantId, tenant.companyName, tenant.companyName, tenant.subdomain,
      tenant.subscriptionPlan, tenant.subscriptionStatus, tenant.phone,
    ]
  );

  // 2. Create owner employee (tenant_admin)
  await client.query(
    `INSERT INTO hris_saas.employees
       (id, tenant_id, first_name, last_name, email, phone, password_hash, role, base_salary, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'tenant_admin', 0, 'active', NOW())`,
    [ownerId, tenantId, ownerName, '', ownerEmail, tenant.phone, passwordHash]
  );

  // 3. Create subscription record
  await client.query(
    `INSERT INTO hris_saas.subscriptions
       (id, tenant_id, plan_id, status, current_period_start, current_period_end)
     VALUES ($1, $2, $3, 'active', NOW(), '2099-12-31')`,
    [subId, tenantId, tenant.planId]
  );

  // 4. Create usage record for current month
  await client.query(
    `INSERT INTO hris_saas.tenant_usage
       (id, tenant_id, usage_month, entity_count, transaction_count, cashbook_entry_count, staff_count, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      usageId, tenantId, USAGE_MONTH,
      tenant.usage.entity_count, tenant.usage.transaction_count,
      tenant.usage.cashbook_entry_count, tenant.usage.staff_count,
    ]
  );

  return { tenantId, ownerId, subId, usageId };
}

async function main() {
  const client = await pool.connect();
  try {
    console.log('Bahi360 Subscription Test Data Seeder\n');

    const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

    // -----------------------------------------------------------------------
    // STEP 1: Ensure subscription_plans exist for manage & business_pro
    // -----------------------------------------------------------------------
    console.log('[1/4] Ensuring subscription plans exist...');
    await client.query('BEGIN');
    await ensureSubscriptionPlans(client);
    await client.query('COMMIT');
    console.log('  Done.\n');

    // -----------------------------------------------------------------------
    // STEP 2: Check which tenants already exist (idempotent)
    // -----------------------------------------------------------------------
    console.log('[2/4] Checking existing tenants...');
    const existingPhones = new Set();
    for (const tenant of TEST_TENANTS) {
      const exists = await tenantExists(client, tenant.phone);
      if (exists) {
        existingPhones.add(tenant.phone);
        console.log(`  Skipping ${tenant.companyName} (already exists)`);
      }
    }
    const toCreate = TEST_TENANTS.filter(t => !existingPhones.has(t.phone));
    console.log(`  ${toCreate.length} tenant(s) to create.\n`);

    if (toCreate.length === 0) {
      console.log('All test tenants already exist. Nothing to do.');
      return;
    }

    // -----------------------------------------------------------------------
    // STEP 3: Create tenants in individual transactions
    // -----------------------------------------------------------------------
    console.log('[3/4] Creating tenants...');
    const created = [];
    for (const tenant of toCreate) {
      try {
        await client.query('BEGIN');
        const ids = await seedTenant(client, tenant, passwordHash);
        await client.query('COMMIT');
        created.push({ ...ids, companyName: tenant.companyName, plan: tenant.planLabel });
        console.log(`  Created ${tenant.companyName} (${tenant.planLabel})`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  Failed to create ${tenant.companyName}: ${err.message}`);
        throw err;
      }
    }

    // -----------------------------------------------------------------------
    // STEP 4: Summary
    // -----------------------------------------------------------------------
    console.log(`\n[4/4] Summary`);
    console.log(`  Total created: ${created.length}`);
    console.log(`  Common password: ${PASSWORD}`);
    console.log(`\n  Tenant Details:`);

    for (const t of created) {
      console.log(`    ${t.companyName}`);
      console.log(`       ID:      ${t.tenantId}`);
      console.log(`       Plan:    ${t.plan}`);
      console.log(`       Sub:     ${TEST_TENANTS.find(v => v.planLabel === t.plan)?.subdomain}.localhost`);
      console.log(`       Phone:   ${TEST_TENANTS.find(v => v.planLabel === t.plan)?.phone}`);
      console.log();
    }

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
