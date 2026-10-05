import { createClient } from '@supabase/supabase-js'

const url = 'https://ajjaldaczjnmczdsfgln.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamFsZGFjempubWN6ZHNmZ2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExODE3NDksImV4cCI6MjEwNjc1Nzc0OX0.FzfLJsvBAXDZtUdWstYLV7smU06wr4i-5EDViA41t_E'

const supabase = createClient(url, anonKey)

async function testLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@financetracker.com',
    password: 'Password123!'
  })

  if (error) {
    console.error('Login failed:', error.message)
  } else {
    console.log('✓ LOGIN SUCCESSFUL!')
    console.log('User ID:', data.user?.id)
    console.log('User Email:', data.user?.email)
  }
}

testLogin()
