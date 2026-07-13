// Cost type is derived from category, not stored separately, so it can never drift out of sync.
export function costType(category) {
  return category === 'HIT' ? 'UNIT' : 'FIX'
}

// A cost item linked to a labour rate always reflects that rate's current €/hour ÷ 60,
// so raising a labour rate updates every cost item and technique line that uses it.
export function effectiveRate(costItem) {
  if (!costItem) return 0
  if (costItem.labour_rates) return (parseFloat(costItem.labour_rates.cost_per_hour) || 0) / 60
  return parseFloat(costItem.value_per_unit ?? 0)
}

export function lineRate(tc) {
  return (tc.value_override !== null && tc.value_override !== undefined)
    ? parseFloat(tc.value_override)
    : effectiveRate(tc.cost_items)
}

export function lineTotal(tc) {
  const raw = (parseFloat(tc.quantity) || 0) * lineRate(tc)
  const min = tc.min_charge !== null && tc.min_charge !== undefined && tc.min_charge !== ''
    ? parseFloat(tc.min_charge)
    : null
  return min !== null ? Math.max(raw, min) : raw
}
