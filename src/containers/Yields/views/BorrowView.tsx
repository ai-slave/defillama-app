import { useRouter } from 'next/router'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { fetchJson } from '~/utils/async'
import { formatNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { YIELD_BORROW_MARKETS_DATASET_API, YIELD_BORROW_ROUTES_DATASET_API } from '../constants'
import type { MarketTableRow, RouteTableRow, TokenOption } from '../data/types'
import { prepareBorrowMarketsCsv, prepareBorrowRoutesCsv } from '../domain/borrowCsv'
import { YieldFilters } from '../Filters'
import { ApyViewControls } from '../Filters/ApyViewControls'
import { BORROW_ATTRIBUTE_IDS, type AttributeId } from '../Filters/attributeOptions'
import { BorrowTokenPickers } from '../Filters/BorrowTokenPickers'
import { useFormatYieldQueryParams } from '../hooks'
import { PaginatedBorrowMarketsTable, PaginatedBorrowRoutesTable } from '../Tables/Borrow'
import { useLegacyYieldsUrlNormalizer } from '../useLegacyYieldsUrlNormalizer'
import { useYieldsServerTable } from '../useYieldsServerTable'
import { YieldsTabs } from '../YieldsTabs'

const MARKETS_DEFAULT_SORT = [{ id: 'available_borrow', desc: true }]
// Routes mode defaults to Net APY DESC — the mode's verdict column.
const ROUTES_DEFAULT_SORT = [{ id: 'net_apy', desc: true }]
const EMPTY_STRINGS: Array<string> = []
const EMPTY_TOKENS: Array<TokenOption> = []

type BorrowRowsResponse<TRow> = { rows: Array<TRow> }

function BorrowView({
	chainList = EMPTY_STRINGS,
	projectList = EMPTY_STRINGS,
	categoryList = EMPTY_STRINGS,
	evmChains = EMPTY_STRINGS,
	collateralTokens = EMPTY_TOKENS,
	borrowTokens = EMPTY_TOKENS,
	attributeIds = BORROW_ATTRIBUTE_IDS
}: {
	chainList?: Array<string>
	projectList?: Array<string>
	categoryList?: Array<string>
	evmChains?: Array<string>
	collateralTokens?: Array<TokenOption>
	borrowTokens?: Array<TokenOption>
	attributeIds?: Array<AttributeId>
}) {
	const router = useRouter()

	// Routes mode is entered as soon as either token picker has a selection.
	const routesMode = Boolean(router.query.collateralToken || router.query.borrowToken)

	// Rewrite legacy bookmark params to canonical before the first fetch (gates `enabled`).
	const normalized = useLegacyYieldsUrlNormalizer({ page: 'borrow', tokens: collateralTokens })

	const { selectedChains, selectedProjects, selectedAttributes } = useFormatYieldQueryParams({
		projectList,
		chainList
	})

	const attributeSet = new Set(selectedAttributes)
	const extraQuery = {
		hasAudit: attributeSet.has('audited') ? 'true' : undefined,
		potentialAirdrop: attributeSet.has('airdrop') ? 'true' : undefined,
		includeMemeTokens: attributeSet.has('include_meme_tokens') ? 'true' : undefined
	}

	const endpoint = routesMode ? YIELD_BORROW_ROUTES_DATASET_API : YIELD_BORROW_MARKETS_DATASET_API
	const defaultSorting = routesMode ? ROUTES_DEFAULT_SORT : MARKETS_DEFAULT_SORT

	const { rows, total, data, isLoading, rowsQuery, tableProps, buildAllRowsQueryString } = useYieldsServerTable<
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
			const csvData = await fetchJson<BorrowRowsResponse<RouteTableRow>>(url)
			return prepareBorrowRoutesCsv(csvData.rows, router.query)
		}
		const csvData = await fetchJson<BorrowRowsResponse<MarketTableRow>>(url)
		return prepareBorrowMarketsCsv(csvData.rows, router.query)
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
							total && selectedProjects.length > 0 && selectedChains.length > 0 ? '' : 'invisible'
						}`}
					>
						Tracking <strong className="text-primary">{formatNumber(total)}</strong>{' '}
						{routesMode ? 'borrow routes' : 'borrow markets'} across{' '}
						<strong className="text-primary">{formatNumber(selectedProjects.length)}</strong> protocols on{' '}
						<strong className="text-primary">{formatNumber(selectedChains.length)}</strong> chains
					</p>
				}
			/>

			<YieldFilters
				showSearchOnMobile
				tokenSearch={<BorrowTokenPickers collateralTokens={collateralTokens} borrowTokens={borrowTokens} />}
				chainList={chainList}
				evmChains={evmChains}
				projectList={projectList}
				projectsLabel="Protocols"
				categoryList={categoryList}
				categoriesLabel="Categories"
				attributeIds={attributeIds}
				availableRange={data?.availableQuickPicks ?? []}
				apyControls={<ApyViewControls ready={normalized} />}
				resetFilters
				prepareCsv={prepareCsv}
			/>

			{queryReadFailed(rowsQuery) ? (
				<PanelStatus variant="error" retry={rowsQuery}>
					{errorMessage}
				</PanelStatus>
			) : isLoading ? (
				<PanelLoadingStatus label={routesMode ? 'Loading routes' : 'Loading borrow markets'} />
			) : rows.length > 0 ? (
				routesMode ? (
					<PaginatedBorrowRoutesTable data={rows as Array<RouteTableRow>} {...tableProps} />
				) : (
					<PaginatedBorrowMarketsTable data={rows as Array<MarketTableRow>} {...tableProps} />
				)
			) : (
				<PanelStatus variant="empty">{emptyMessage}</PanelStatus>
			)}
		</>
	)
}

export default BorrowView
