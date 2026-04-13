import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

function createSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: 'costapp-auth-token',
      lock: async (_name, _acquireTimeout, fn) => fn()
    }
  })
}

// Cliente singleton — se recrea si la pestaña vuelve de inactividad
let _client = createSupabaseClient()

export function getSupabaseClient() {
  return _client
}

// Al volver a la pestaña, recrear el cliente para evitar estado corrupto
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      _client = createSupabaseClient()
    }
  })
}

export const supabase = new Proxy({}, {
  get(_, prop) {
    return _client[prop]
  }
})

// ── Auth helpers ──────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await _client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await _client.auth.signOut()
  if (error) throw error
}

export async function getCurrentProfile() {
  const { data: { user } } = await _client.auth.getUser()
  if (!user) return null
  const { data, error } = await _client
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (error) console.error('Profile error:', error)
  return data
}

// ── Config de instancia ───────────────────────────────────────
export async function getInstanceConfig() {
  const { data, error } = await _client.from('instance_config').select('*').single()
  if (error) throw error
  return data
}

export async function updateInstanceConfig(updates) {
  const { data, error } = await _client
    .from('instance_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', (await getInstanceConfig()).id)
    .select().single()
  if (error) throw error
  return data
}

// ── Cost items ────────────────────────────────────────────────
export async function getCostItems(category = null) {
  let q = _client.from('cost_items').select('*').order('name')
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function upsertCostItem(item) {
  const { data, error } = await _client
    .from('cost_items')
    .upsert({ ...item, updated_at: new Date().toISOString() })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteCostItem(id) {
  const { error } = await _client.from('cost_items').delete().eq('id', id)
  if (error) throw error
}

// ── Técnicas de impresión ─────────────────────────────────────
export async function getPrintTechniques() {
  const { data, error } = await _client
    .from('print_techniques')
    .select(`*, technique_costs(*, cost_items(*))`)
    .order('name')
  if (error) throw error
  return data
}

export async function upsertPrintTechnique(technique) {
  const { data, error } = await _client
    .from('print_techniques')
    .upsert({ ...technique, updated_at: new Date().toISOString() })
    .select().single()
  if (error) throw error
  return data
}

export async function deletePrintTechnique(id) {
  const { error } = await _client.from('print_techniques').delete().eq('id', id)
  if (error) throw error
}

export async function upsertTechniqueCost(tc) {
  const { data, error } = await _client.from('technique_costs').upsert(tc).select().single()
  if (error) throw error
  return data
}

export async function deleteTechniqueCost(id) {
  const { error } = await _client.from('technique_costs').delete().eq('id', id)
  if (error) throw error
}

// ── Productos ─────────────────────────────────────────────────
export async function getProducts() {
  const { data, error } = await _client
    .from('products')
    .select(`*, product_costs(*, cost_items(*))`)
    .order('name')
  if (error) throw error
  return data
}

export async function upsertProduct(product) {
  const { data, error } = await _client
    .from('products')
    .upsert({ ...product, updated_at: new Date().toISOString() })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteProduct(id) {
  const { error } = await _client.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function upsertProductCost(pc) {
  const { data, error } = await _client.from('product_costs').upsert(pc).select().single()
  if (error) throw error
  return data
}

export async function deleteProductCost(id) {
  const { error } = await _client.from('product_costs').delete().eq('id', id)
  if (error) throw error
}

// ── Usuarios (superadmin) ─────────────────────────────────────
export async function getUsers() {
  const { data, error } = await _client.from('user_profiles').select('*').order('email')
  if (error) throw error
  return data
}

export async function updateUserRole(userId, role) {
  const { error } = await _client.from('user_profiles').update({ role }).eq('id', userId)
  if (error) throw error
}

// ── Margin tiers ──────────────────────────────────────────────
export async function getMarginTiers() {
  const { data, error } = await _client
    .from('margin_tiers')
    .select('*')
    .order('qty_from')
  if (error) throw error
  return data
}

export async function upsertMarginTier(tier) {
  const { data, error } = await _client
    .from('margin_tiers')
    .upsert(tier)
    .select().single()
  if (error) throw error
  return data
}

export async function deleteMarginTier(id) {
  const { error } = await _client.from('margin_tiers').delete().eq('id', id)
  if (error) throw error
}

// ── Qty breaks ────────────────────────────────────────────────
export async function getQtyBreaks() {
  const { data, error } = await _client
    .from('qty_breaks')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

export async function upsertQtyBreak(brk) {
  const { data, error } = await _client
    .from('qty_breaks')
    .upsert(brk)
    .select().single()
  if (error) throw error
  return data
}

export async function deleteQtyBreak(id) {
  const { error } = await _client.from('qty_breaks').delete().eq('id', id)
  if (error) throw error
}
