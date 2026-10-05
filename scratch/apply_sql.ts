import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamFsZGFjempubWN6ZHNmZ2xuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTE4MTc0OSwiZXhwIjoyMTA2NzU3NzQ5fQ._f-gTA8umgUz5zOPKw0vRU-SIXOy-w8j8PlQW9hkoCo'

async function applySql() {
  const m1 = await readFile(resolve('supabase/migrations/20261005084100_add_ten_percent_profit.sql'), 'utf8')
  const m2 = await readFile(resolve('supabase/migrations/20261005090000_complete_loan_tracking_schema.sql'), 'utf8')

  const fullSql = `${m1}\n${m2}`

  // Try endpoints
  const endpoints = [
    'https://ajjaldaczjnmczdsfgln.supabase.co/rest/v1/sql',
    'https://ajjaldaczjnmczdsfgln.supabase.co/pg/v1/query',
    'https://ajjaldaczjnmczdsfgln.supabase.co/rest/v1/query',
  ]

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ApiKey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: fullSql }),
      })
      console.log(`Endpoint ${ep} status: ${res.status}`)
      const text = await res.text()
      console.log(`Response: ${text.slice(0, 300)}`)
    } catch (e: any) {
      console.log(`Endpoint ${ep} error: ${e.message}`)
    }
  }
}

applySql()
