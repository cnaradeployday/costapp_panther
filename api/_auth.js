// Verifies the request carries a valid session for a superadmin user.
// Both /users admin actions (invite, password reset) require this.
export async function requireSuperAdmin(req, supabase) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { error: 'Missing authorization token', status: 401 }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) return { error: 'Invalid session', status: 401 }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'superadmin') return { error: 'Forbidden', status: 403 }

  return { user }
}
