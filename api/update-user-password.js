import { createClient } from '@supabase/supabase-js'
import { requireSuperAdmin } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, password } = req.body
  if (!userId || !password) return res.status(400).json({ error: 'userId and password required' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const auth = await requireSuperAdmin(req, supabase)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const { error } = await supabase.auth.admin.updateUserById(userId, { password })
  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ success: true })
}
