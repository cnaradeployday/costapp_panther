import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, role } = req.body
  if (!email || !role) return res.status(400).json({ error: 'Email and role required' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Crear usuario con invitación
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { role }
  })

  if (error) return res.status(400).json({ error: error.message })

  // Insertar perfil con el rol correcto
  await supabase.from('user_profiles').upsert({
    id: data.user.id,
    email: data.user.email,
    full_name: data.user.email,
    role,
  })

  return res.status(200).json({ success: true, user: data.user })
}
