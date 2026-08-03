import { toDisplayName } from '~/utils/chainNormalizer'
import type { UnversionedUnifiedTableConfig } from '../persisted'
import type {
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

function normalizeList(values: readonly string[]): string[] {
	const normalized: string[] = []
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

function normalizeChains(values: readonly string[]): string[] {
	const normalized: string[] = []
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
	chains?: readonly string[]
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
		...(chains.length ? { params: { chains } } : {}),
		...(categories.length || excludedCategories.length
			? {
					filters: {
						...(categories.length ? { categories } : {}),
						...(excludedCategories.length ? { excludedCategories } : {})
					}
				}
			: {}),
		activePresetId: PROTOCOL_METRIC_DATASET_PRESET[config.datasetType],
		...(config.colSpan === undefined ? {} : { colSpan: config.colSpan })
	}
}
