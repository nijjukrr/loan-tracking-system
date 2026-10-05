import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.FINANCE_ADMIN_EMAIL
const password = process.env.FINANCE_ADMIN_PASSWORD

if (!url || !serviceRoleKey || !email || !password) {
  throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FINANCE_ADMIN_EMAIL, and FINANCE_ADMIN_PASSWORD.')
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function createAdmin() {
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

  console.log('Admin account is ready. Credentials were not printed.')
}

createAdmin()
