import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Auth helpers ──────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (error) console.error('Profile error:', error)
  return data
}

// ── Config de instancia ───────────────────────────────────────
export async function getInstanceConfig() {
  const { data, error } = await supabase.from('instance_config').select('*').single()
  if (error) throw error
  return data
}

export async function updateInstanceConfig(updates) {
  const { data, error } = await supabase
    .from('instance_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', (await getInstanceConfig()).id)
    .select().single()
  if (error) throw error
  return data
}

// ── Cost items ────────────────────────────────────────────────
export async function getCostItems(category = null) {
  let q = supabase.from('cost_items').select('*').order('name')
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function upsertCostItem(item) {
  const { data, error } = await supabase
    .from('cost_items')
    .upsert({ ...item, updated_at: new Date().toISOString() })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteCostItem(id) {
  const { error } = await supabase.from('cost_items').delete().eq('id', id)
  if (error) throw error
}

// ── Técnicas de impresión ─────────────────────────────────────
export async function getPrintTechniques() {
  const { data, error } = await supabase
    .from('print_techniques')
    .select(`*, technique_costs(*, cost_items(*))`)
    .order('name')
  if (error) throw error
  return data
}

export async function upsertPrintTechnique(technique) {
  const { data, error } = await supabase
    .from('print_techniques')
    .upsert({ ...technique, updated_at: new Date().toISOString() })
    .select().single()
  if (error) throw error
  return data
}

export async function deletePrintTechnique(id) {
  const { error } = await supabase.from('print_techniques').delete().eq('id', id)
  if (error) throw error
}

export async function upsertTechniqueCost(tc) {
  const { data, error } = await supabase.from('technique_costs').upsert(tc).select().single()
  if (error) throw error
  return data
}

export async function deleteTechniqueCost(id) {
  const { error } = await supabase.from('technique_costs').delete().eq('id', id)
  if (error) throw error
}

// ── Productos ─────────────────────────────────────────────────
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(`*, product_costs(*, cost_items(*))`)
    .order('name')
  if (error) throw error
  return data
}

export async function upsertProduct(product) {
  const { data, error } = await supabase
    .from('products')
    .upsert({ ...product, updated_at: new Date().toISOString() })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function upsertProductCost(pc) {
  const { data, error } = await supabase.from('product_costs').upsert(pc).select().single()
  if (error) throw error
  return data
}

export async function deleteProductCost(id) {
  const { error } = await supabase.from('product_costs').delete().eq('id', id)
  if (error) throw error
}

// ── Usuarios (superadmin) ─────────────────────────────────────
export async function getUsers() {
  const { data, error } = await supabase.from('user_profiles').select('*').order('email')
  if (error) throw error
  return data
}

export async function updateUserRole(userId, role) {
  const { error } = await supabase.from('user_profiles').update({ role }).eq('id', userId)
  if (error) throw error
}

// ── Margin tiers ──────────────────────────────────────────────
export async function getMarginTiers() {
  const { data, error } = await supabase
    .from('margin_tiers')
    .select('*')
    .order('qty_from')
  if (error) throw error
  return data
}

export async function upsertMarginTier(tier) {
  const { data, error } = await supabase
    .from('margin_tiers')
    .upsert(tier)
    .select().single()
  if (error) throw error
  return data
}

export async function deleteMarginTier(id) {
  const { error } = await supabase.from('margin_tiers').delete().eq('id', id)
  if (error) throw error
}

// ── Qty breaks ────────────────────────────────────────────────
export async function getQtyBreaks() {
  const { data, error } = await supabase
    .from('qty_breaks')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

export async function upsertQtyBreak(brk) {
  const { data, error } = await supabase
    .from('qty_breaks')
    .upsert(brk)
    .select().single()
  if (error) throw error
  return data
}

export async function deleteQtyBreak(id) {
  const { error } = await supabase.from('qty_breaks').delete().eq('id', id)
  if (error) throw error
}
