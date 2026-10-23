import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const mode = process.argv[2]
const confirmation = process.argv[3]
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (mode !== 'backup' && mode !== 'reset') {
  console.log('Usage: finance-data-admin.ts backup|reset [CLEAN_START]')
  process.exit(1)
}

if (mode === 'reset' && confirmation !== 'CLEAN_START') {
  console.error('Reset requires the exact confirmation CLEAN_START')
  process.exit(1)
}

const isSupabaseConfigured = Boolean(url && serviceKey)

async function run() {
  const directory = resolve('backups')
  await mkdir(directory, { recursive: true })
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

  if (isSupabaseConfigured) {
    const db = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } })
    const tables = ['customers', 'loans', 'installments', 'payments', 'ten_percent_entries', 'main_transactions'] as const
    const data: Record<string, unknown[]> = {}
    for (const table of tables) {
      const result = await db.from(table).select('*')
      if (result.error) throw new Error(`Backup failed for ${table}: ${result.error.message}`)
      data[table] = result.data || []
    }
    const path = resolve(directory, `finance-backup-supabase-${stamp}.json`)
    await writeFile(path, JSON.stringify({ exported_at: new Date().toISOString(), project_url: url, data }, null, 2), { flag: 'wx' })
    console.log(`Supabase backup saved locally: ${path}`)
    console.log('Backed-up row counts:', Object.fromEntries(tables.map((t) => [t, data[t].length])))

    if (mode === 'reset') {
      for (const table of ['payments', 'installments', 'loans', 'customers', 'ten_percent_entries', 'main_transactions'] as const) {
        const result = await db.from(table).delete().not('id', 'is', null)
        if (result.error) throw new Error(`Reset stopped at ${table}: ${result.error.message}. Restore from ${path}`)
      }
      console.log('Clean start completed. All finance row tables now contain zero active records.')
    }
  } else {
    console.log('Operating in Local Preview mode (SUPABASE_SERVICE_ROLE_KEY not configured).')
    const localDataPath = resolve('src/data/imported-finance.json')
    let localData = {}
    try {
      const raw = await readFile(localDataPath, 'utf8')
      localData = JSON.parse(raw)
    } catch {
      localData = { loans: [], mainTransactions: [], tenPercentEntries: [] }
    }
    const path = resolve(directory, `finance-backup-local-${stamp}.json`)
    await writeFile(path, JSON.stringify({ exported_at: new Date().toISOString(), mode: 'local', data: localData }, null, 2))
    console.log(`Local backup saved: ${path}`)

    if (mode === 'reset') {
      const emptyState = {
        source: { fileName: '', sha256: '', importedAt: '' },
        verification: { mainRows: 0, dailyCount: 0, dailyPrincipal: 0, dailyMainSheetNos: [], weeklyCount: 0, weeklyPrincipal: 0, weeklyMainSheetNos: [], tenPercentCount: 0, tenPercentProfit: 0 },
        ledgerSummary: { cashInBank: 0, loanReceived: 0, outstanding: 0, creditGrandTotal: 0 },
        mainTransactions: [],
        tenPercentEntries: [],
        loans: []
      }
      await writeFile(localDataPath, `${JSON.stringify(emptyState, null, 2)}\n`, 'utf8')
      console.log('Clean start completed. Local preview finance data has been reset to empty.')
    }
  }
}

run().catch((err) => {
  console.error('Data admin operation failed:', err)
  process.exit(1)
})
