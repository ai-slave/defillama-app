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

type ChainTvlEntityRow = { chain: string }

type ChainTvlValueRow = ChainTvlEntityRow & {
	date: string
	value: number | null
}

async function allowedCategoryChains(categories: string[]): Promise<string[]> {
	if (categories.length === 0) return []
	const names = await resolveAllowedChainNamesFromCategories(categories)
	return Array.from(names, toInternalSlug)
}

export async function streamChainTvlCsv(request: ChartBuilderCsvRequest, output: Writable): Promise<number> {
	if (request.config.metric !== 'tvl' || request.config.mode !== 'protocol') {
		throw new Error('Chain TVL stream requires a Group by Chains TVL request')
	}
	const protocol = request.config.protocol?.toLowerCase() === 'all' ? undefined : request.config.protocol
	const { startDate, endDate } = getCsvDateBounds(request)
	const selectedChains = normalizeLegacyChartBuilderChains(request.config.chains).map(toInternalSlug)
	const categoryChains = await allowedCategoryChains(request.config.chainCategories ?? [])
	const params: unknown[] = [startDate, endDate]
	let protocolPredicate = ''
	let source = 'lens.metrics_chain_daily m'
	if (protocol) {
		params.push(protocol)
		const parameter = `$${params.length}`
		source = 'lens.metrics_sub_protocol_by_chain_daily m JOIN dim.protocol metadata ON metadata.slug = m.sub_protocol'
		// Global-total exclusion flags do not hide a protocol the user explicitly selected.
		protocolPredicate = `AND (
			m.sub_protocol = ${parameter}
			OR (m.protocol = ${parameter} AND m.sub_protocol <> m.protocol AND NOT metadata.exclude_tvl_from_parent)
		)`
	}
	let chainPredicate = ''
	if (selectedChains.length > 0) {
		params.push(selectedChains)
		const parameter = `$${params.length}::text[]`
		chainPredicate =
			request.config.chainFilterMode === 'include'
				? `AND lower(m.chain) = ANY(${parameter})`
				: `AND lower(m.chain) <> ALL(${parameter})`
	}
	let categoryPredicate = ''
	if (categoryChains.length > 0) {
		params.push(categoryChains)
		const parameter = `$${params.length}::text[]`
		categoryPredicate =
			request.config.chainCategoryFilterMode === 'include'
				? `AND lower(m.chain) = ANY(${parameter})`
				: `AND lower(m.chain) <> ALL(${parameter})`
	}
	const selected = `
		SELECT m.date, m.chain, SUM(m.tvl_base)::double precision AS value
		FROM ${source}
		WHERE
			m.date < CURRENT_DATE
			AND ($1::date IS NULL OR m.date >= $1::date)
			AND ($2::date IS NULL OR m.date <= $2::date)
			${protocolPredicate}
			${chainPredicate}
			${categoryPredicate}
		GROUP BY m.date, m.chain
	`
	const entityRows = await llamaDb.any<ChainTvlEntityRow>(
		`WITH selected AS (${selected}) SELECT DISTINCT chain FROM selected WHERE value IS NOT NULL`,
		params
	)
	const entities = disambiguateCsvLabels<SnapshotCsvEntity>(
		entityRows
			.map(({ chain }) => ({ key: chain, label: displayChainName(chain) }))
			.sort((left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key))
	)
	if (entities.length === 0) return 0
	return streamSnapshotCsv<ChainTvlValueRow>({
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
		output
	})
}
