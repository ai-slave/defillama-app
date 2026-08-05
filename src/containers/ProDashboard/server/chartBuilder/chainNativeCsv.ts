import type { Writable } from 'node:stream'
import type { ChartBuilderCsvRequest } from '~/containers/ProDashboard/chartBuilderCsvContract'
import {
	displayChainName,
	resolveAllowedChainNamesFromCategories
} from '~/containers/ProDashboard/server/chartBuilder/breakdownChains'
import { llamaDb } from '~/server/db/llama'
import { toInternalSlug } from '~/utils/chainNormalizer'
import { disambiguateCsvLabels } from './csvStream'
import { normalizeLegacyChartBuilderChains } from './filters'
import { getCsvDateBounds, streamSnapshotCsv, type SnapshotCsvEntity } from './snapshotCsv'

type ChainNativeMetric = 'chain-fees' | 'chain-revenue'

type ChainNativeEntityRow = { chain: string }

type ChainNativeValueRow = ChainNativeEntityRow & {
	date: string
	value: number | null
}

const LENS_COLUMN: Record<ChainNativeMetric, 'chain_fees_1d' | 'chain_revenue_1d'> = {
	'chain-fees': 'chain_fees_1d',
	'chain-revenue': 'chain_revenue_1d'
}

async function allowedCategoryChains(categories: string[]): Promise<string[]> {
	if (categories.length === 0) return []
	const names = await resolveAllowedChainNamesFromCategories(categories)
	return Array.from(names, toInternalSlug)
}

export async function streamChainNativeCsv(request: ChartBuilderCsvRequest, output: Writable): Promise<number> {
	if (
		request.config.mode !== 'protocol' ||
		(request.config.metric !== 'chain-fees' && request.config.metric !== 'chain-revenue')
	) {
		throw new Error('Chain-native CSV requires a chain fees or chain revenue request grouped by chain')
	}
	const column = LENS_COLUMN[request.config.metric]
	const { startDate, endDate } = getCsvDateBounds(request)
	const selectedChains = normalizeLegacyChartBuilderChains(request.config.chains).map(toInternalSlug)
	const categoryChains = await allowedCategoryChains(request.config.chainCategories ?? [])
	const params: unknown[] = [startDate, endDate]
	let chainPredicate = ''
	if (selectedChains.length > 0) {
		params.push(selectedChains)
		const parameter = `$${params.length}::text[]`
		chainPredicate =
			request.config.chainFilterMode === 'include'
				? `AND lower(chain) = ANY(${parameter})`
				: `AND lower(chain) <> ALL(${parameter})`
	}
	let categoryPredicate = ''
	if (categoryChains.length > 0) {
		params.push(categoryChains)
		const parameter = `$${params.length}::text[]`
		categoryPredicate =
			request.config.chainCategoryFilterMode === 'include'
				? `AND lower(chain) = ANY(${parameter})`
				: `AND lower(chain) <> ALL(${parameter})`
	}
	const selected = `
		SELECT date, chain, ${column}::double precision AS value
		FROM lens.metrics_chain_daily
		WHERE
			date < CURRENT_DATE
			AND ($1::date IS NULL OR date >= $1::date)
			AND ($2::date IS NULL OR date <= $2::date)
			AND ${column} IS NOT NULL
			${chainPredicate}
			${categoryPredicate}
	`
	const entityRows = await llamaDb.any<ChainNativeEntityRow>(
		`WITH selected AS (${selected}) SELECT DISTINCT chain FROM selected`,
		params
	)
	const entities = disambiguateCsvLabels<SnapshotCsvEntity>(
		entityRows
			.map(({ chain }) => ({ key: chain, label: displayChainName(chain) }))
			.sort((left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key))
	)
	if (entities.length === 0) return 0
	return streamSnapshotCsv<ChainNativeValueRow>({
		query: `
			WITH selected AS (${selected})
			SELECT to_char(date, 'YYYY-MM-DD') AS date, chain, value
			FROM selected
			ORDER BY date, chain
		`,
		params,
		entities,
		getEntityKey: (row) => row.chain,
		grouping: request.grouping,
		displayAs: request.config.displayAs,
		treemap: request.config.chartType === 'treemap',
		aggregation: 'flow',
		treemapValue: request.config.treemapValue ?? 'latest',
		output
	})
}
