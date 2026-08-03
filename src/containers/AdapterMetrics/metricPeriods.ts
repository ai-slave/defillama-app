type NullableNumber = number | null

export type MetricPeriodFields = {
	total24h?: NullableNumber
	total48hto24h?: NullableNumber
	total7d?: NullableNumber
	total14dto7d?: NullableNumber
	total30d?: NullableNumber
	total60dto30d?: NullableNumber
	total7DaysAgo?: NullableNumber
	total30DaysAgo?: NullableNumber
	total1y?: NullableNumber
	annualized1y?: NullableNumber
	totalAllTime?: NullableNumber
	change_1d?: NullableNumber
	change_7d?: NullableNumber
	change_1m?: NullableNumber
	change_7dover7d?: NullableNumber
	change_30dover30d?: NullableNumber
}

type MetricPeriodChanges = Pick<
	MetricPeriodFields,
	'change_1d' | 'change_7d' | 'change_1m' | 'change_7dover7d' | 'change_30dover30d'
>

const ACTIVITY_PERIOD_FIELDS = [
	'total24h',
	'total48hto24h',
	'total7d',
	'total14dto7d',
	'total30d',
	'total60dto30d',
	'total7DaysAgo',
	'total30DaysAgo',
	'total1y',
	'totalAllTime'
] as const

const ANNUALIZED_PARENT_CONTRIBUTOR_FIELDS = ['total24h', 'total7d', 'total30d', 'total1y', 'totalAllTime'] as const

function sumAvailablePeriods(left: NullableNumber | undefined, right: NullableNumber | undefined) {
	if (left == null && right == null) return null
	return (left ?? 0) + (right ?? 0)
}

function sumCompletePeriods(left: NullableNumber | undefined, right: NullableNumber | undefined) {
	return left == null || right == null ? null : left + right
}

function hasAnnualizedParentContributor(protocol: MetricPeriodFields) {
	for (const field of ANNUALIZED_PARENT_CONTRIBUTOR_FIELDS) {
		const value = protocol[field]
		if (value != null && value !== 0) return true
	}
	return protocol.annualized1y != null && protocol.annualized1y !== 0
}

function getPercentChange(valueNow: NullableNumber | undefined, valuePrevious: NullableNumber | undefined) {
	if (valueNow == null || valuePrevious == null || valuePrevious === 0) return null

	return ((valueNow - valuePrevious) / valuePrevious) * 100
}

export function deriveMetricChanges<T extends MetricPeriodFields>(protocol: T): T & MetricPeriodChanges {
	protocol.change_1d = getPercentChange(protocol.total24h, protocol.total48hto24h)
	protocol.change_7d = getPercentChange(protocol.total24h, protocol.total7DaysAgo)
	protocol.change_1m = getPercentChange(protocol.total24h, protocol.total30DaysAgo)
	protocol.change_7dover7d = getPercentChange(protocol.total7d, protocol.total14dto7d)
	protocol.change_30dover30d = getPercentChange(protocol.total30d, protocol.total60dto30d)

	return protocol
}

export function mergeMetricPeriods<T extends MetricPeriodFields>(
	existing: T,
	protocol: MetricPeriodFields
): T & MetricPeriodChanges {
	const existingContributesToAnnualized = hasAnnualizedParentContributor(existing)
	const protocolContributesToAnnualized = hasAnnualizedParentContributor(protocol)
	for (const field of ACTIVITY_PERIOD_FIELDS) {
		existing[field] = sumAvailablePeriods(existing[field], protocol[field])
	}
	if (protocolContributesToAnnualized) {
		existing.annualized1y = existingContributesToAnnualized
			? sumCompletePeriods(existing.annualized1y, protocol.annualized1y)
			: (protocol.annualized1y ?? null)
	}

	return deriveMetricChanges(existing)
}

/** Earnings exposes unavailable comparison periods as null; those periods must stay unavailable when chains are merged. */
export function mergeEarningsMetricPeriods<T extends MetricPeriodFields>(
	existing: T,
	protocol: MetricPeriodFields
): T & MetricPeriodChanges {
	for (const field of ACTIVITY_PERIOD_FIELDS) {
		existing[field] = sumCompletePeriods(existing[field], protocol[field])
	}
	existing.annualized1y = null

	return deriveMetricChanges(existing)
}

export function mergeParentMetricPeriods<T extends MetricPeriodFields>(protocols: Iterable<T>) {
	let periodTotals: MetricPeriodFields | null = null
	let hasAnnualized1y = false
	let isAnnualized1yIncomplete = false

	for (const protocol of protocols) {
		periodTotals = periodTotals === null ? { ...protocol } : mergeMetricPeriods(periodTotals, protocol)
		const contributesPeriods = hasAnnualizedParentContributor(protocol)
		if (protocol.annualized1y != null) {
			hasAnnualized1y = true
		} else if (contributesPeriods) {
			isAnnualized1yIncomplete = true
		}
	}

	const totals = periodTotals ?? {}
	totals.annualized1y = hasAnnualized1y && !isAnnualized1yIncomplete ? (totals.annualized1y ?? null) : null

	return deriveMetricChanges(totals)
}

export function mergeParentEarningsMetricPeriods<T extends MetricPeriodFields>(protocols: Iterable<T>) {
	let periodTotals: MetricPeriodFields | null = null

	for (const protocol of protocols) {
		periodTotals = periodTotals === null ? { ...protocol } : mergeEarningsMetricPeriods(periodTotals, protocol)
	}

	return deriveMetricChanges(periodTotals ?? {})
}
