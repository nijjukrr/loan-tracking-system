import { createClient } from '@supabase/supabase-js'

const url = 'https://ajjaldaczjnmczdsfgln.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamFsZGFjempubWN6ZHNmZ2xuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTE4MTc0OSwiZXhwIjoyMTA2NzU3NzQ5fQ._f-gTA8umgUz5zOPKw0vRU-SIXOy-w8j8PlQW9hkoCo'

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function run() {
  console.log('Testing Service Role Key connection...')
  // Test query
  const res = await supabase.from('main_transactions').select('*')
  console.log('main_transactions query result:', res)
}

run()
