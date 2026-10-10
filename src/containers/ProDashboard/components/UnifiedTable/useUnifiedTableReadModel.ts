import { useQuery } from '@tanstack/react-query'
import { useContext, useDeferredValue, useMemo } from 'react'
import { fetchJson } from '~/utils/async'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { StreamDoneContext } from '../../queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '../../queryPolicy'
import type { UnifiedTableConfig } from '../../unifiedTable/config/current'
import type { FilteredShareMetricKey } from '../../unifiedTable/config/filteredShareColumns'
import type { UnifiedRowHeaderType } from '../../unifiedTable/config/types'
import type {
	ParentProtocolMetrics,
	ProtocolTableSourceRow,
	ProtocolsUnifiedTableResponse
} from '../../unifiedTable/contracts'
import { buildUnifiedTableQueryString, getUnifiedTableQueryIdentity } from '../../unifiedTableQuery'
import {
	buildProtocolTableReadModel,
	collectProtocolTableLeaves,
	filterProtocolTableSourceRows,
	setProtocolTableFilteredShares
} from './readModel'
import { getProtocolAggregationPlan } from './utils/aggregation'
import { filterReadModelRowsByConfig, filterRowsByConfig, hasProtocolSubsetFilters } from './utils/dataFilters'

const EMPTY_ROWS: Array<ProtocolTableSourceRow> = []
const EMPTY_PARENT_METRICS: Record<string, ParentProtocolMetrics> = {}
const EMPTY_CHAIN_METRICS: NonNullable<ProtocolsUnifiedTableResponse['chainMetrics']> = {}

const fetchUnifiedTableRows = async (config: UnifiedTableConfig, rowHeaders: Array<UnifiedRowHeaderType>) => {
	const queryString = buildUnifiedTableQueryString(config, rowHeaders)
	return fetchJson<ProtocolsUnifiedTableResponse>(
		`/api/public/pro-dashboard/unified-table/${config.strategy}?${queryString}`
	)
}

/** Fetch and prepare economic rows before table sorting, expansion, and pagination. */
export function useUnifiedTableReadModel({
	config,
	rowHeaders,
	searchTerm,
	filteredShareMetricKeys
}: {
	config: UnifiedTableConfig
	rowHeaders: Array<UnifiedRowHeaderType>
	searchTerm: string
	filteredShareMetricKeys: ReadonlyArray<FilteredShareMetricKey>
}) {
	const { getProtocolInfo } = useProDashboardCatalog()

	const queryIdentity = useMemo(() => getUnifiedTableQueryIdentity(config, rowHeaders), [config, rowHeaders])
	const { queryKey } = queryIdentity
	const aggregationPlan = getProtocolAggregationPlan(queryIdentity)

	const streamDone = useContext(StreamDoneContext)
	const rowsQuery = useQuery({
		queryKey,
		queryFn: () => fetchUnifiedTableRows(config, rowHeaders),
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME,
		retry: 1,
		enabled: streamDone
	})

	const { data, dataUpdatedAt, isLoading, isFetching, refetch } = rowsQuery
	const deferredSearchTerm = useDeferredValue(searchTerm)

	const parentMetrics = data?.parentMetrics ?? EMPTY_PARENT_METRICS
	const chainMetrics = data?.chainMetrics ?? EMPTY_CHAIN_METRICS
	const sourceRows = useMemo(
		() =>
			filterRowsByConfig(data?.rows ?? EMPTY_ROWS, config.filters, parentMetrics, chainMetrics, {
				getListedAt: (protocolId) => getProtocolInfo(protocolId)?.listedAt,
				nowSeconds: dataUpdatedAt / 1000
			}),
		[data?.rows, dataUpdatedAt, config.filters, parentMetrics, chainMetrics, getProtocolInfo]
	)
	const visibleSourceRows = useMemo(
		() => filterProtocolTableSourceRows(sourceRows, deferredSearchTerm, parentMetrics),
		[sourceRows, deferredSearchTerm, parentMetrics]
	)
	const readModel = useMemo(() => {
		const chainMetricScope =
			rowHeaders[0] !== 'chain'
				? 'group'
				: queryIdentity.rowMembership.kind === 'all-protocols' &&
					  !deferredSearchTerm.trim() &&
					  !config.params?.category &&
					  !hasProtocolSubsetFilters(config.filters)
					? 'canonical'
					: 'partial'
		const model = buildProtocolTableReadModel({
			rows: visibleSourceRows,
			rowHeaders,
			parentMetrics,
			chainMetrics,
			customColumns: config.customColumns ?? [],
			chainMetricScope,
			aggregationPlan
		})
		const rows = filterReadModelRowsByConfig(model.rows, config.filters)
		setProtocolTableFilteredShares(rows, filteredShareMetricKeys)
		if (rows === model.rows) return model
		return { rows, leaves: collectProtocolTableLeaves(rows) }
	}, [
		visibleSourceRows,
		rowHeaders,
		parentMetrics,
		chainMetrics,
		config.customColumns,
		config.filters,
		config.params?.category,
		queryIdentity.rowMembership.kind,
		deferredSearchTerm,
		filteredShareMetricKeys,
		aggregationPlan
	])
	return {
		rows: readModel.rows,
		leaves: readModel.leaves,
		isLoading: isLoading || (!streamDone && data === undefined),
		// A failed refetch keeps the cached rows, so it is a refresh failure, not an empty table.
		loadError: queryReadFailed(rowsQuery)
			? ('initial' as const)
			: queryRefreshFailed(rowsQuery)
				? ('refresh' as const)
				: null,
		isFetching,
		refetch
	}
}
