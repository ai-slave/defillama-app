import { useRouter } from 'next/router'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { fetchJson } from '~/utils/async'
import { YIELD_BORROW_MARKETS_DATASET_API, YIELD_BORROW_ROUTES_DATASET_API } from '../constants'
import type { MarketTableRow, RouteTableRow, TokenOption } from '../data/types'
import { prepareBorrowMarketsCsv, prepareBorrowRoutesCsv } from '../domain/borrowCsv'
import { YieldFilters } from '../Filters'
import { ApyViewControls } from '../Filters/ApyViewControls'
import { BORROW_ATTRIBUTE_IDS, type AttributeId } from '../Filters/attributeOptions'
import { BorrowTokenPickers } from '../Filters/BorrowTokenPickers'
import { useFormatYieldQueryParams } from '../hooks'
import { selectedSubsetQuery } from '../queryState'
import { PaginatedBorrowMarketsTable, PaginatedBorrowRoutesTable } from '../Tables/Borrow'
import { useLegacyYieldsUrlNormalizer } from '../useLegacyYieldsUrlNormalizer'
import { useYieldsServerTable } from '../useYieldsServerTable'
import { YieldsTabs } from '../YieldsTabs'

const MARKETS_DEFAULT_SORT = [{ id: 'available_borrow', desc: true }]
// Routes mode defaults to Net APY DESC — the mode's verdict column.
const ROUTES_DEFAULT_SORT = [{ id: 'net_apy', desc: true }]
const EMPTY_STRINGS: string[] = []
const EMPTY_TOKENS: TokenOption[] = []

type BorrowRowsResponse<TRow> = { rows: TRow[] }

const BorrowView = ({
	chainList = EMPTY_STRINGS,
	projectList = EMPTY_STRINGS,
	categoryList = EMPTY_STRINGS,
	evmChains = EMPTY_STRINGS,
	collateralTokens = EMPTY_TOKENS,
	borrowTokens = EMPTY_TOKENS,
	attributeIds = BORROW_ATTRIBUTE_IDS
}: {
	chainList?: string[]
	projectList?: string[]
	categoryList?: string[]
	evmChains?: string[]
	collateralTokens?: TokenOption[]
	borrowTokens?: TokenOption[]
	attributeIds?: AttributeId[]
}) => {
	const router = useRouter()

	// Routes mode is entered as soon as either token picker has a selection.
	const routesMode = Boolean(router.query.collateralToken || router.query.borrowToken)

	// Rewrite legacy bookmark params to canonical before the first fetch (gates `enabled`).
	const normalized = useLegacyYieldsUrlNormalizer({ page: 'borrow', tokens: collateralTokens })

	const { selectedChains, selectedProjects, selectedCategories, selectedAttributes } = useFormatYieldQueryParams({
		projectList,
		chainList,
		categoryList,
		evmChains,
		projectQueryKey: 'protocol',
		excludeProjectQueryKey: 'excludeProtocol'
	})

	const attributeSet = new Set(selectedAttributes)
	const extraQuery = {
		chain: selectedSubsetQuery(selectedChains, chainList),
		protocol: selectedSubsetQuery(selectedProjects, projectList),
		category: selectedSubsetQuery(selectedCategories, categoryList),
		hasAudit: attributeSet.has('audited') ? 'true' : undefined,
		protocolHasToken: attributeSet.has('no_protocol_token') ? 'false' : undefined,
		includeMemeTokens: attributeSet.has('include_meme_tokens') ? 'true' : undefined
	}

	const endpoint = routesMode ? YIELD_BORROW_ROUTES_DATASET_API : YIELD_BORROW_MARKETS_DATASET_API
	const defaultSorting = routesMode ? ROUTES_DEFAULT_SORT : MARKETS_DEFAULT_SORT

	const { rows, total, rowsQuery, tableProps, buildAllRowsQueryString } = useYieldsServerTable<
		MarketTableRow | RouteTableRow
	>({
		endpoint,
		enabled: normalized,
		extraQuery,
		defaultSorting
	})

	async function prepareCsv() {
		const url = `${endpoint}${buildAllRowsQueryString()}`
		if (routesMode) {
			const data = await fetchJson<BorrowRowsResponse<RouteTableRow>>(url)
			return prepareBorrowRoutesCsv(data.rows, router.query)
		}
		const data = await fetchJson<BorrowRowsResponse<MarketTableRow>>(url)
		return prepareBorrowMarketsCsv(data.rows, router.query)
	}

	const emptyMessage = routesMode
		? 'No routes for the selected tokens. Try a different selection.'
		: 'No borrow markets match current filters.'
	const errorMessage = routesMode ? "Couldn't load borrow routes." : "Couldn't load borrow markets."

	return (
		<>
			<YieldsTabs
				active="borrow"
				rightSlot={
					<p
						className={`hidden body-md text-secondary sm:block ${
							total && selectedProjects.length && selectedChains.length ? '' : 'invisible'
						}`}
					>
						Tracking <strong className="text-primary">{total.toLocaleString()}</strong>{' '}
						{routesMode ? 'borrow routes' : 'borrow markets'} across{' '}
						<strong className="text-primary">{selectedProjects.length.toLocaleString()}</strong> protocols on{' '}
						<strong className="text-primary">{selectedChains.length.toLocaleString()}</strong> chains
					</p>
				}
			/>

			<YieldFilters
				showSearchOnMobile
				tokenSearch={<BorrowTokenPickers collateralTokens={collateralTokens} borrowTokens={borrowTokens} />}
				chainList={chainList}
				selectedChains={selectedChains}
				evmChains={evmChains}
				projectList={projectList}
				selectedProjects={selectedProjects}
				projectsLabel="Protocols"
				categoryList={categoryList}
				selectedCategories={selectedCategories}
				categoriesLabel="Categories"
				attributeIds={attributeIds}
				availableRange={true}
				apyControls={<ApyViewControls />}
				resetFilters={true}
				resetFiltersLabel="Reset Filters"
				prepareCsv={prepareCsv}
			/>

			{!rowsQuery.data && !rowsQuery.isError ? (
				<PanelLoadingStatus label={routesMode ? 'Loading routes' : 'Loading borrow markets'} />
			) : rowsQuery.isError && !rowsQuery.data ? (
				<PanelStatus variant="error">{errorMessage}</PanelStatus>
			) : rows.length > 0 ? (
				routesMode ? (
					<PaginatedBorrowRoutesTable data={rows as RouteTableRow[]} {...tableProps} />
				) : (
					<PaginatedBorrowMarketsTable data={rows as MarketTableRow[]} {...tableProps} />
				)
			) : (
				<PanelStatus variant="empty">{emptyMessage}</PanelStatus>
			)}
		</>
	)
}

export default BorrowView
