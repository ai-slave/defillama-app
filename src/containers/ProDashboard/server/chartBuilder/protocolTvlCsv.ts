import type { Writable } from 'node:stream'
import type { ChartBuilderCsvRequest } from '~/containers/ProDashboard/chartBuilderCsvContract'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { llamaDb } from '~/server/db/llama'
import { toInternalSlug } from '~/utils/chainNormalizer'
import { disambiguateCsvLabels } from './csvStream'
import { normalizeLegacyChartBuilderChains } from './filters'
import { getCsvDateBounds, streamSnapshotCsv, type SnapshotCsvEntity } from './snapshotCsv'

type ProtocolTvlEntityRow = {
	sub_protocol: string
	protocol: string
	name: string
	exclude_tvl_from_parent: boolean
}

type ProtocolTvlValueRow = ProtocolTvlEntityRow & {
	date: string
	value: number | null
}

type ProtocolTvlSql = {
	entityQuery: string
	valueQuery: string
	params: unknown[]
}

function buildProtocolTvlSql(request: ChartBuilderCsvRequest): ProtocolTvlSql {
	const chains = normalizeLegacyChartBuilderChains(request.config.chains).map(toInternalSlug)
	const useChainRows = chains.length > 0
	const table = useChainRows ? 'lens.metrics_sub_protocol_by_chain_daily' : 'lens.metrics_sub_protocol_daily'
	const { startDate, endDate } = getCsvDateBounds(request)
	const categories = request.config.categories.map((category) => category.toLowerCase())
	const params: unknown[] = [startDate, endDate]
	let chainPredicate = ''
	if (useChainRows) {
		params.push(chains)
		const parameter = `$${params.length}::text[]`
		chainPredicate =
			request.config.chainFilterMode === 'include'
				? `AND lower(m.chain) = ANY(${parameter})`
				: `AND lower(m.chain) <> ALL(${parameter})`
	}
	let categoryPredicate = ''
	if (categories.length > 0) {
		params.push(categories)
		const parameter = `$${params.length}::text[]`
		categoryPredicate =
			request.config.categoryFilterMode === 'include'
				? `AND lower(m.category) = ANY(${parameter})`
				: `AND lower(m.category) <> ALL(${parameter})`
	}
	const where = `
		m.date < CURRENT_DATE
		AND ($1::date IS NULL OR m.date >= $1::date)
		AND ($2::date IS NULL OR m.date <= $2::date)
		${chainPredicate}
		${categoryPredicate}
	`
	const selected = `
		-- Entity exports include every protocol matching the user's filters. Global-total
		-- exclusion is already represented only by canonical aggregate sources.
		SELECT
			m.date,
			m.sub_protocol,
			m.protocol,
			metadata.name,
			metadata.exclude_tvl_from_parent,
			SUM(m.tvl_base)::double precision AS value
		FROM ${table} m
		JOIN dim.protocol metadata ON metadata.slug = m.sub_protocol
		WHERE ${where}
		GROUP BY m.date, m.sub_protocol, m.protocol, metadata.name, metadata.exclude_tvl_from_parent
	`
	return {
		entityQuery: `
			WITH selected AS (${selected})
			SELECT DISTINCT sub_protocol, protocol, name, exclude_tvl_from_parent
			FROM selected
			WHERE value IS NOT NULL
		`,
		valueQuery: `
			WITH selected AS (${selected})
			SELECT to_char(date, 'YYYY-MM-DD') AS date, sub_protocol, protocol, name, exclude_tvl_from_parent, value
			FROM selected
			ORDER BY date, sub_protocol
		`,
		params
	}
}

function entityKey(row: ProtocolTvlEntityRow, groupByParent: boolean): string {
	if (groupByParent && row.protocol !== row.sub_protocol && !row.exclude_tvl_from_parent) {
		return `parent:${row.protocol}`
	}
	return `protocol:${row.sub_protocol}`
}

async function buildEntities(rows: ProtocolTvlEntityRow[], groupByParent: boolean): Promise<SnapshotCsvEntity[]> {
	const parentNameBySlug = new Map<string, string>()
	if (groupByParent) {
		const metadata = await fetchProtocols()
		for (const parent of metadata.parentProtocols) {
			if (parent.id) parentNameBySlug.set(parent.id.replace(/^parent#/, ''), parent.name)
		}
	}

	const entityByKey = new Map<string, SnapshotCsvEntity>()
	for (const row of rows) {
		const key = entityKey(row, groupByParent)
		if (entityByKey.has(key)) continue
		const isParent = key.startsWith('parent:')
		entityByKey.set(key, {
			key,
			label: isParent ? (parentNameBySlug.get(row.protocol) ?? row.protocol) : row.name
		})
	}
	const entities = Array.from(entityByKey.values()).sort(
		(left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key)
	)
	return disambiguateCsvLabels(entities)
}

export async function streamProtocolTvlCsv(request: ChartBuilderCsvRequest, output: Writable): Promise<number> {
	if (request.config.metric !== 'tvl' || request.config.mode !== 'chains') {
		throw new Error('Protocol TVL stream requires a Group by Protocol TVL request')
	}
	const sql = buildProtocolTvlSql(request)
	const entityRows = await llamaDb.any<ProtocolTvlEntityRow>(sql.entityQuery, sql.params)
	const entities = await buildEntities(entityRows, request.config.groupByParent === true)
	if (entities.length === 0) return 0
	return streamSnapshotCsv<ProtocolTvlValueRow>({
		query: sql.valueQuery,
		params: sql.params,
		entities,
		getEntityKey: (row) => entityKey(row, request.config.groupByParent === true),
		grouping: request.grouping,
		displayAs: request.config.displayAs,
		treemap: request.config.chartType === 'treemap',
		output
	})
}
