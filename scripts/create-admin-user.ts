import { createClient } from '@supabase/supabase-js'

const url = 'https://ajjaldaczjnmczdsfgln.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamFsZGFjempubWN6ZHNmZ2xuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTE4MTc0OSwiZXhwIjoyMTA2NzU3NzQ5fQ._f-gTA8umgUz5zOPKw0vRU-SIXOy-w8j8PlQW9hkoCo'

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function createAdmin() {
  const email = 'admin@financetracker.com'
  const password = 'Password123!'

  console.log(`Creating user in Supabase Auth: ${email}…`)

  // Check if user exists or create
  const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Admin' }
  })

  let userId = userData.user?.id

  if (createErr && createErr.message.includes('already exists')) {
    console.log('User already exists, fetching user list…')
    const { data: users } = await supabase.auth.admin.listUsers()
    const existing = users.users.find((u) => u.email === email)
    userId = existing?.id
    if (userId) {
      await supabase.auth.admin.updateUserById(userId, { password })
      console.log('Updated user password.')
    }
  } else if (createErr) {
    console.error('Error creating user:', createErr.message)
    return
  }

  if (!userId) {
    console.error('Could not obtain user ID.')
    return
  }

  console.log(`User ID: ${userId}`)

  // Insert into app_members table
  const { error: memberErr } = await supabase
    .from('app_members')
    .upsert({ user_id: userId, display_name: 'Admin', active: true }, { onConflict: 'user_id' })

  if (memberErr) {
    console.error('Error adding to app_members:', memberErr.message)
  } else {
    console.log('Successfully registered admin user in app_members table!')
  }

  console.log('\n=======================================')
  console.log('LOGIN CREDENTIALS CREATED SUCCESSFULLY:')
  console.log(`Email:    ${email}`)
  console.log(`Password: ${password}`)
  console.log('=======================================\n')
}

createAdmin()
