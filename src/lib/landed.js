// ── Warehouses ────────────────────────────────────────────────
export async function getWarehouses() {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('warehouses').select('*').order('name')
  if (error) throw error
  return data
}
export async function upsertWarehouse(w) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('warehouses').upsert({ ...w, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}
export async function deleteWarehouse(id) {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.from('warehouses').delete().eq('id', id)
  if (error) throw error
}

// ── Exchange rates ────────────────────────────────────────────
export async function getExchangeRates() {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('exchange_rates').select('*').order('valid_from', { ascending: false })
  if (error) throw error
  return data
}
export async function upsertExchangeRate(r) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('exchange_rates').upsert({ ...r, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}
export async function deleteExchangeRate(id) {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.from('exchange_rates').delete().eq('id', id)
  if (error) throw error
}
export async function getActiveRate(from, to, date = new Date().toISOString().split('T')[0]) {
  const { supabase } = await import('./supabase')
  const { data } = await supabase.from('exchange_rates')
    .select('*')
    .eq('currency_from', from).eq('currency_to', to)
    .lte('valid_from', date)
    .or(`valid_to.is.null,valid_to.gte.${date}`)
    .order('valid_from', { ascending: false })
    .limit(1).maybeSingle()
  return data
}

// ── Logistics partners ────────────────────────────────────────
export async function getLogisticsPartners() {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('logistics_partners').select('*').order('name')
  if (error) throw error
  return data
}
export async function upsertLogisticsPartner(p) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('logistics_partners').upsert({ ...p, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}
export async function deleteLogisticsPartner(id) {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.from('logistics_partners').delete().eq('id', id)
  if (error) throw error
}

// ── Logistics routes ──────────────────────────────────────────
export async function getLogisticsRoutes(partnerId = null) {
  const { supabase } = await import('./supabase')
  let q = supabase.from('logistics_routes').select('*, logistics_partners(*), logistics_price_tiers(*)').order('origin_country')
  if (partnerId) q = q.eq('partner_id', partnerId)
  const { data, error } = await q
  if (error) throw error
  return data
}
export async function upsertLogisticsRoute(r) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('logistics_routes').upsert({ ...r, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}
export async function deleteLogisticsRoute(id) {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.from('logistics_routes').delete().eq('id', id)
  if (error) throw error
}

// ── Price tiers ───────────────────────────────────────────────
export async function upsertPriceTier(t) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('logistics_price_tiers').upsert(t).select().single()
  if (error) throw error
  return data
}
export async function deletePriceTier(id) {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.from('logistics_price_tiers').delete().eq('id', id)
  if (error) throw error
}

// ── Ancillary costs ───────────────────────────────────────────
export async function getAncillaryCosts(partnerId) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('logistics_ancillary_costs').select('*').eq('partner_id', partnerId).order('name')
  if (error) throw error
  return data
}
export async function upsertAncillaryCost(c) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('logistics_ancillary_costs').upsert({ ...c, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}
export async function deleteAncillaryCost(id) {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.from('logistics_ancillary_costs').delete().eq('id', id)
  if (error) throw error
}

// ── Landed operations ─────────────────────────────────────────
export async function getLandedOperations() {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase
    .from('landed_operations')
    .select('*, logistics_routes(*, logistics_partners(*)), warehouses(*), landed_operation_lines(*, products(*))')
    .order('operation_date', { ascending: false })
  if (error) throw error
  return data
}
export async function upsertLandedOperation(op) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('landed_operations').upsert({ ...op, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}
export async function deleteLandedOperation(id) {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.from('landed_operations').delete().eq('id', id)
  if (error) throw error
}
export async function upsertLandedLine(line) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.from('landed_operation_lines').upsert(line).select().single()
  if (error) throw error
  return data
}
export async function deleteLandedLine(id) {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.from('landed_operation_lines').delete().eq('id', id)
  if (error) throw error
}
