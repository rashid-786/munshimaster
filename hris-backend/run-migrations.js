const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) throw new Error('DATABASE_URL or DB_HOST/DB_USER/DB_NAME must be set');
  var url = `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/${DB_NAME}`;
} else {
  var url = DATABASE_URL;
}

const sep = url.includes('?') ? '&' : '?';
const searchPathOpt = 'options=-c%20search_path%3Dhris_saas%2Cpublic';
const connectionString = url + sep + searchPathOpt;

const ssl = url.includes('render.com') || url.includes('amazonaws.com') || process.env.PGSSLMODE === 'require'
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  connectionString,
  ssl,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
});

const migrationsDir = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS hris_saas.schema_migrations (
      filename    VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      checksum    VARCHAR(64) NOT NULL,
      duration_ms INT NOT NULL DEFAULT 0
    )
  `);
}

async function getApplied(client) {
  const res = await client.query('SELECT filename, checksum FROM hris_saas.schema_migrations ORDER BY filename');
  const map = {};
  for (const row of res.rows) map[row.filename] = row.checksum;
  return map;
}

function checksumOf(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

async function markAllApplied(client, files) {
  const marked = [];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8').trim();
    if (!sql) continue;
    const chk = checksumOf(sql);
    await client.query(
      'INSERT INTO hris_saas.schema_migrations (filename, checksum, duration_ms) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING',
      [file, chk]
    );
    marked.push(file);
  }
  console.log(`Marked ${marked.length} migration(s) as applied.`);
}

async function run() {
  const args = process.argv.slice(2);
  const markAll = args.includes('--mark-applied');

  const isMysql = (sql) => /MODIFY COLUMN|ENUM\s*\(|AFTER\s+\w+|ENGINE\s*=|AUTO_INCREMENT|ON DUPLICATE|ON UPDATE CURRENT_TIMESTAMP|TINYINT|DATETIME|CHARSET|COMMENT\s'/.test(sql);

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const filtered = files.filter(f => !isMysql(fs.readFileSync(path.join(migrationsDir, f), 'utf8')));

  console.log(`Found ${files.length} migration files (${files.length - filtered.length} MySQL-only skipped).\n`);

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    if (markAll) {
      await markAllApplied(client, filtered);
      return;
    }

    const applied = await getApplied(client);
    let ran = 0;

    for (const file of filtered) {
      if (applied[file]) {
        console.log(`  [SKIP] ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8').trim();
      if (!sql) {
        console.log(`  [EMPTY] ${file}`);
        continue;
      }

      const chk = checksumOf(sql);
      const start = Date.now();

      try {
        await client.query(sql);
        const ms = Date.now() - start;
        await client.query(
          'INSERT INTO hris_saas.schema_migrations (filename, checksum, duration_ms) VALUES ($1, $2, $3)',
          [file, chk, ms]
        );
        console.log(`  [OK]   ${file} (${ms}ms)`);
        ran++;
      } catch (err) {
        console.error(`\n  [FAIL] ${file}`);
        console.error(`         ${err.message.replace(/\n/g, '\n         ')}\n`);
        process.exit(1);
      }
    }

    console.log(`\nDone. ${ran} migration(s) applied.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration runner failed:', err.message);
  process.exit(1);
});
