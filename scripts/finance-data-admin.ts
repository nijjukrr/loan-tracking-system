import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const mode = process.argv[2]
const confirmation = process.argv[3]
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never use a VITE_ variable for the service-role key.')
}
if (mode !== 'backup' && mode !== 'reset') throw new Error('Use: finance-data-admin.ts backup|reset [CLEAN_START]')
if (mode === 'reset' && confirmation !== 'CLEAN_START') throw new Error('Reset requires the exact confirmation CLEAN_START')

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const tables = ['customers', 'loans', 'installments', 'payments', 'ten_percent_entries', 'main_transactions'] as const

async function exportFinanceData() {
  const data: Record<string, unknown[]> = {}
  for (const table of tables) {
    const result = await db.from(table).select('*')
    if (result.error) throw new Error(`Backup failed for ${table}: ${result.error.message}`)
    data[table] = result.data || []
  }
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const directory = resolve('backups')
  const path = resolve(directory, `finance-backup-${stamp}.json`)
  await mkdir(directory, { recursive: true })
  await writeFile(path, JSON.stringify({ exported_at: new Date().toISOString(), project_url: url, data }, null, 2), { flag: 'wx' })
  return { path, counts: Object.fromEntries(tables.map((table) => [table, data[table].length])) }
}

const backup = await exportFinanceData()
console.log(`Backup saved locally: ${backup.path}`)
console.log('Backed-up row counts:', backup.counts)

if (mode === 'reset') {
  // Children first. Filters deliberately match every UUID/identity row while
  // keeping schemas, migrations, functions, and import source files intact.
  for (const table of ['payments', 'installments', 'loans', 'customers', 'ten_percent_entries', 'main_transactions'] as const) {
    const result = await db.from(table).delete().not('id', 'is', null)
    if (result.error) throw new Error(`Reset stopped at ${table}: ${result.error.message}. Restore from ${backup.path}`)
  }
  console.log('Clean start completed. All finance row tables now contain zero active records.')
}
