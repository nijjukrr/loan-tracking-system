import { createClient } from '@supabase/supabase-js'

const url = 'https://ajjaldaczjnmczdsfgln.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamFsZGFjempubWN6ZHNmZ2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExODE3NDksImV4cCI6MjEwNjc1Nzc0OX0.FzfLJsvBAXDZtUdWstYLV7smU06wr4i-5EDViA41t_E'

const supabase = createClient(url, key)

async function test() {
  const tables = ['customers', 'loans', 'installments', 'payments', 'main_transactions', 'ten_percent_entries', 'app_members']
  console.log('Testing connection to Supabase project...')
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('count', { count: 'exact', head: true })
    if (error) {
      console.log(`Table '${t}': ERROR -> ${error.message}`)
    } else {
      console.log(`Table '${t}': EXISTS (rows: ${data})`)
    }
  }
}

test()
