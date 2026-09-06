import { parseEnumQueryValue, parseOptionalStringTarget } from '../requestParsers'
import type { RWAPerpsChartMetricKey } from './types'

const RWA_PERPS_CHART_METRIC_KEYS = ['openInterest', 'volume24h', 'markets'] as const

export function parseChartMetricKey(value: string | Array<string> | undefined): RWAPerpsChartMetricKey | null {
	return parseEnumQueryValue(value, RWA_PERPS_CHART_METRIC_KEYS)
}

export function parseOptionalTarget(value: string | Array<string> | undefined): string | null | undefined {
	return parseOptionalStringTarget(value)
}
