// Cost type is derived from category, not stored separately, so it can never drift out of sync.
export function costType(category) {
  return category === 'HIT' ? 'UNIT' : 'FIX'
}

export function lineRate(tc) {
  return (tc.value_override !== null && tc.value_override !== undefined)
    ? parseFloat(tc.value_override)
    : parseFloat(tc.cost_items?.value_per_unit ?? 0)
}

export function lineTotal(tc) {
  const raw = (parseFloat(tc.quantity) || 0) * lineRate(tc)
  const min = tc.min_charge !== null && tc.min_charge !== undefined && tc.min_charge !== ''
    ? parseFloat(tc.min_charge)
    : null
  return min !== null ? Math.max(raw, min) : raw
}
