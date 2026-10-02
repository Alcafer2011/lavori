// Manda comandi SQL al database Supabase della galleria (password in C:\Users\infoa\Chiavi\.env, mai stampata).
// Uso: node strumenti/db.mjs <file.sql | "select ...">
// Serve il pacchetto "pg" (npm i pg) raggiungibile da qui o da NODE_PATH.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');

const env = Object.fromEntries(readFileSync('C:/Users/infoa/Chiavi/.env', 'utf8').split(/\r?\n/)
  .map(r => r.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim()]));
const ref = new URL(env.CARPENTERIA_SUPABASE_URL).hostname.split('.')[0];
const host = process.env.PGHOST_CARPENTERIA || 'aws-0-eu-west-1.pooler.supabase.com';

const arg = process.argv[2];
const sql = existsSync(arg) ? readFileSync(arg, 'utf8') : arg;
const c = new Client({ host, port: 5432, user: 'postgres.' + ref, password: env.CARPENTERIA_DB_PASSWORD,
  database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const r = await c.query(sql);
  for (const x of [].concat(r)) if (x.rows && x.rows.length) console.table(x.rows);
  console.log('fatto');
} finally { await c.end(); }
