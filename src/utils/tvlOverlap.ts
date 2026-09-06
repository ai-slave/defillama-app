import { TVL_SETTINGS } from '~/contexts/LocalStorage'

export const DC_AND_LS_OVERLAP_API_KEY = 'dcAndLsOverlap'
const FORK_ORACLE_EXTRA_TVL_CHART_API_KEYS = new Set(['staking', 'borrowed', 'pool2', 'vesting', 'all', 'OwnTokens'])

type EnabledTvlKeys = ReadonlyArray<string> | ReadonlySet<string>

function hasEnabledTvlKey(enabledKeys: EnabledTvlKeys, key: string): boolean {
	return 'has' in enabledKeys ? enabledKeys.has(key) : enabledKeys.includes(key)
}

function hasEnabledTvlOverlap(extraTvlsEnabled: Record<string, boolean>): boolean {
	return !!extraTvlsEnabled[TVL_SETTINGS.DOUBLE_COUNT] && !!extraTvlsEnabled[TVL_SETTINGS.LIQUID_STAKING]
}

export function getEnabledExtraTvlApiKeys(extraTvlsEnabled: Record<string, boolean>): Array<string> {
	const apiKeys: Array<string> = []
	for (const [settingKey, enabled] of Object.entries(extraTvlsEnabled)) {
		if (!enabled || settingKey.toLowerCase() === 'tvl') continue
		apiKeys.push(settingKey)
	}

	if (hasEnabledTvlOverlap(extraTvlsEnabled)) {
		apiKeys.push(DC_AND_LS_OVERLAP_API_KEY)
	}

	return apiKeys.toSorted((a, b) => a.localeCompare(b))
}

export function getEnabledForkOracleExtraTvlChartApiKeys(extraTvlsEnabled: Record<string, boolean>): Array<string> {
	const apiKeys: Array<string> = []
	for (const [settingKey, enabled] of Object.entries(extraTvlsEnabled)) {
		if (!enabled || settingKey.toLowerCase() === 'tvl' || !FORK_ORACLE_EXTRA_TVL_CHART_API_KEYS.has(settingKey)) {
			continue
		}
		apiKeys.push(settingKey)
	}

	return apiKeys.toSorted((a, b) => a.localeCompare(b))
}

export function shouldSubtractTvlOverlapSeries(enabledExtraApiKeys: EnabledTvlKeys): boolean {
	return (
		hasEnabledTvlKey(enabledExtraApiKeys, TVL_SETTINGS.DOUBLE_COUNT) &&
		hasEnabledTvlKey(enabledExtraApiKeys, TVL_SETTINGS.LIQUID_STAKING)
	)
}

export function getExtraTvlSeriesSign({
	apiKey,
	shouldSubtractOverlapSeries
}: {
	apiKey: string
	shouldSubtractOverlapSeries: boolean
}): 1 | -1 {
	return apiKey.toLowerCase() === 'dcandlsoverlap' && shouldSubtractOverlapSeries ? -1 : 1
}

export function getFailedExtraTvlApiKeys<T>(
	enabledApiKeys: ReadonlyArray<string>,
	queries: ReadonlyArray<{ data: T | undefined; isError: boolean }>
): Array<string> {
	const failedApiKeys: Array<string> = []
	for (let index = 0; index < queries.length; index++) {
		const query = queries[index]
		const apiKey = enabledApiKeys[index]
		if (query?.isError && query.data === undefined && apiKey) failedApiKeys.push(apiKey)
	}
	return failedApiKeys
}

/** Both inputs are successful measurements. Missing values contribute zero at the other input's timestamp. */
export function mergeBaseAndExtraTvlHistory({
	base,
	extra
}: {
	base: ReadonlyArray<readonly [number, number]>
	extra: ReadonlyMap<number, number>
}): ReadonlyArray<readonly [number, number]> {
	if (extra.size === 0) return base

	const valuesByTimestamp = new Map<number, number>()
	for (const [timestamp, value] of base) valuesByTimestamp.set(timestamp, value)

	for (const [timestamp, value] of extra) {
		valuesByTimestamp.set(timestamp, (valuesByTimestamp.get(timestamp) ?? 0) + value)
	}

	const history: Array<[number, number]> = []
	for (const point of valuesByTimestamp) history.push(point)
	history.sort((a, b) => a[0] - b[0])
	return history
}

export function calculateTotalWithExtraToggles({
	values,
	extraTvlsEnabled
}: {
	values: Record<string, number>
	extraTvlsEnabled: Record<string, boolean>
}): number {
	let sum = values.tvl ?? 0

	for (const [metricName, metricValue] of Object.entries(values)) {
		const normalizedMetricName = metricName.toLowerCase()
		if (normalizedMetricName === 'tvl') continue

		if (normalizedMetricName === 'dcandlsoverlap') {
			if (hasEnabledTvlOverlap(extraTvlsEnabled)) {
				sum -= metricValue ?? 0
			}
			continue
		}

		if (extraTvlsEnabled[normalizedMetricName]) {
			sum += metricValue ?? 0
		}
	}

	return sum
}
