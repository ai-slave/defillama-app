import { toDisplayName } from '~/utils/chainNormalizer'
import type {
	UnversionedUnifiedTableConfig,
	PersistedProtocolMetricDatasetFilters,
	PersistedProtocolMetricDatasetTableConfig,
	PersistedProtocolMetricDatasetType
} from '../persisted'

const PROTOCOL_METRIC_DATASET_PRESET = {
	fees: 'fees-protocols',
	revenue: 'revenue-protocols',
	'holders-revenue': 'holders-protocols',
	earnings: 'earnings-protocols',
	dexs: 'volume-protocols',
	perps: 'perps-protocols',
	aggregators: 'aggregators-protocols',
	'bridge-aggregators': 'bridge-aggregators-protocols',
	options: 'options-protocols'
} as const satisfies Readonly<Record<PersistedProtocolMetricDatasetType, string>>

function isPersistedProtocolMetricDatasetType(
	datasetType: string | undefined
): datasetType is PersistedProtocolMetricDatasetType {
	return datasetType !== undefined && Object.hasOwn(PROTOCOL_METRIC_DATASET_PRESET, datasetType)
}

export function isPersistedProtocolMetricDatasetTable(config: {
	datasetType: string
}): config is PersistedProtocolMetricDatasetTableConfig {
	return isPersistedProtocolMetricDatasetType(config.datasetType)
}

function normalizeList(values: ReadonlyArray<string>): Array<string> {
	const normalized: Array<string> = []
	const seen = new Set<string>()
	for (const value of values) {
		const trimmed = value.trim()
		const identity = trimmed.toLowerCase()
		if (!trimmed || seen.has(identity)) continue
		seen.add(identity)
		normalized.push(trimmed)
	}
	return normalized
}

function normalizeChains(values: ReadonlyArray<string>): Array<string> {
	const normalized: Array<string> = []
	const seen = new Set<string>()
	for (const value of values) {
		const trimmed = value.trim()
		if (!trimmed) continue
		if (trimmed.toLowerCase() === 'all') return []
		const chain = toDisplayName(trimmed)
		const identity = chain.toLowerCase()
		if (seen.has(identity)) continue
		seen.add(identity)
		normalized.push(chain)
	}
	return normalized
}

interface ProtocolMetricDatasetTableMigrationInput {
	id: string
	datasetType: PersistedProtocolMetricDatasetType
	chains?: ReadonlyArray<string>
	filters?: PersistedProtocolMetricDatasetFilters
	colSpan?: UnversionedUnifiedTableConfig['colSpan']
}

/**
 * Protocol metric dataset-table migration history.
 *
 * These nine parallel tables now use the canonical Unified Table presets. Only their semantic
 * row scope survives: normalized chain selection and included/excluded protocol categories.
 * Dataset-specific rendering and presentation state intentionally do not enter the runtime model.
 */
export function migrateProtocolMetricDatasetTable(
	config: ProtocolMetricDatasetTableMigrationInput
): UnversionedUnifiedTableConfig {
	const chains = normalizeChains(config.chains ?? [])
	const categories = normalizeList(config.filters?.categories ?? [])
	const excludedCategories = normalizeList(config.filters?.excludedCategories ?? [])
	return {
		id: config.id,
		kind: 'unified-table',
		rowHeaders: ['parent-protocol', 'protocol'],
		...(chains.length > 0 ? { params: { chains } } : {}),
		...(categories.length > 0 || excludedCategories.length > 0
			? {
					filters: {
						...(categories.length > 0 ? { categories } : {}),
						...(excludedCategories.length > 0 ? { excludedCategories } : {})
					}
				}
			: {}),
		activePresetId: PROTOCOL_METRIC_DATASET_PRESET[config.datasetType],
		...(config.colSpan === undefined ? {} : { colSpan: config.colSpan })
	}
}
