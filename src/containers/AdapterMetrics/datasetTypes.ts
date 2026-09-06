import type { MetricPeriodFields } from './metricPeriods'

export const DIMENSION_DATASET_TYPES = [
	'dexs',
	'perps',
	'aggregators',
	'fees',
	'revenue',
	'earnings',
	'holders-revenue',
	'options',
	'bridge-aggregators'
] as const

export type DimensionDatasetType = (typeof DIMENSION_DATASET_TYPES)[number]

export interface DimensionDatasetProtocol extends MetricPeriodFields {
	name: string
	displayName?: string
	defillamaId?: string
	category?: string | null
	logo?: string
	slug?: string
	parentProtocol?: string | null
	chains: Array<string>
	chainBreakdown?: Record<string, DimensionDatasetProtocol & { chain: string }>
}

export type DimensionDatasetResult<T = DimensionDatasetProtocol> =
	| { status: 'complete'; protocols: Array<T> }
	| { status: 'partial'; protocols: Array<T>; unavailableChains: Array<string> }

export const DIMENSION_DATASET_PUBLIC_ROUTE = {
	dexs: 'dexs',
	perps: 'perps',
	aggregators: 'dex-aggregators',
	fees: 'fees',
	revenue: 'revenue',
	earnings: 'earnings',
	'holders-revenue': 'holders-revenue',
	options: 'options',
	'bridge-aggregators': 'bridge-aggregators'
} as const satisfies Record<DimensionDatasetType, string>

export function isDimensionDatasetType(value: string): value is DimensionDatasetType {
	return Object.hasOwn(DIMENSION_DATASET_PUBLIC_ROUTE, value)
}

export function getDimensionDatasetTypeByPublicRoute(route: string): DimensionDatasetType | undefined {
	for (const datasetType of DIMENSION_DATASET_TYPES) {
		if (DIMENSION_DATASET_PUBLIC_ROUTE[datasetType] === route) return datasetType
	}
	return undefined
}
