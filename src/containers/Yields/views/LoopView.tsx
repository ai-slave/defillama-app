import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { fetchJson } from '~/utils/async'
import { formatNumber } from '~/utils/numberFormat'
import { YIELD_LOOPS_DATASET_API } from '../constants'
import type { LoopTableRow, TokenOption } from '../data/types'
import { prepareLoopsCsv } from '../domain/loopCsv'
import { YieldFilters } from '../Filters'
import { ApyViewControls } from '../Filters/ApyViewControls'
import { BORROW_ATTRIBUTE_IDS, type AttributeId } from '../Filters/attributeOptions'
import { IncludeTokens } from '../Filters/IncludeTokens'
import { LoopCountSelect } from '../Filters/LoopCountSelect'
import { useFormatYieldQueryParams } from '../hooks'
import { selectedSubsetQuery } from '../queryState'
import { PaginatedLoopsTable } from '../Tables/Loops'
import { useLegacyYieldsUrlNormalizer } from '../useLegacyYieldsUrlNormalizer'
import { useYieldsServerTable } from '../useYieldsServerTable'
import { YieldsTabs } from '../YieldsTabs'

const EMPTY_CATEGORIES: Array<string> = []
const EMPTY_STRINGS: Array<string> = []
const EMPTY_TOKENS: Array<TokenOption> = []
const LOOPS_DEFAULT_SORT = [{ id: 'loop_apy', desc: true }]

type LoopRowsResponse = { rows: Array<LoopTableRow> }

function LoopView({
	chainList = EMPTY_STRINGS,
	projectList = EMPTY_STRINGS,
	evmChains = EMPTY_STRINGS,
	tokens = EMPTY_TOKENS,
	attributeIds = BORROW_ATTRIBUTE_IDS
}: {
	chainList?: Array<string>
	projectList?: Array<string>
	evmChains?: Array<string>
	tokens?: Array<TokenOption>
	attributeIds?: Array<AttributeId>
}) {
	// Rewrite legacy bookmark params to canonical before the first fetch (gates `enabled`).
	const normalized = useLegacyYieldsUrlNormalizer({ page: 'loop', tokens })

	const { selectedChains, selectedProjects, selectedAttributes } = useFormatYieldQueryParams({
		projectList,
		chainList,
		categoryList: EMPTY_CATEGORIES,
		evmChains,
		projectQueryKey: 'protocol',
		excludeProjectQueryKey: 'excludeProtocol'
	})

	const attributeSet = new Set(selectedAttributes)
	const extraQuery = {
		chain: selectedSubsetQuery(selectedChains, chainList),
		protocol: selectedSubsetQuery(selectedProjects, projectList),
		hasAudit: attributeSet.has('audited') ? 'true' : undefined,
		potentialAirdrop: attributeSet.has('airdrop') ? 'true' : undefined,
		includeMemeTokens: attributeSet.has('include_meme_tokens') ? 'true' : undefined
	}

	const { rows, total, isLoading, rowsQuery, tableProps, buildAllRowsQueryString, query } =
		useYieldsServerTable<LoopTableRow>({
			endpoint: YIELD_LOOPS_DATASET_API,
			enabled: normalized,
			extraQuery,
			defaultSorting: LOOPS_DEFAULT_SORT
		})

	async function prepareCsv() {
		const url = `${YIELD_LOOPS_DATASET_API}${buildAllRowsQueryString()}`
		const data = await fetchJson<LoopRowsResponse>(url)
		return prepareLoopsCsv(data.rows, query)
	}

	return (
		<>
			<YieldsTabs
				active="looping"
				rightSlot={
					<p
						className={`hidden body-md text-secondary sm:block ${
							total && selectedProjects.length > 0 && selectedChains.length > 0 ? '' : 'invisible'
						}`}
					>
						Tracking <strong className="text-primary">{formatNumber(total)}</strong> looping strategies across{' '}
						<strong className="text-primary">{formatNumber(selectedProjects.length)}</strong> protocols on{' '}
						<strong className="text-primary">{formatNumber(selectedChains.length)}</strong> chains
					</p>
				}
			/>

			<YieldFilters
				showSearchOnMobile
				tokenSearch={<IncludeTokens tokens={tokens} placeholder="Search tokens" data-alwaysdisplay />}
				chainList={chainList}
				selectedChains={selectedChains}
				evmChains={evmChains}
				projectList={projectList}
				selectedProjects={selectedProjects}
				projectsLabel="Protocols"
				attributeIds={attributeIds}
				availableRange
				apyControls={
					<>
						<ApyViewControls ready={normalized} />
						<span className="mx-1 hidden h-5 w-px bg-border-medium sm:block" aria-hidden />
						<LoopCountSelect />
					</>
				}
				resetFilters
				prepareCsv={prepareCsv}
			/>

			{isLoading ? (
				<PanelLoadingStatus label="Loading looping strategies" />
			) : rowsQuery.isError && !rowsQuery.data ? (
				<PanelStatus variant="error">Couldn't load looping strategies.</PanelStatus>
			) : rows.length > 0 ? (
				<PaginatedLoopsTable data={rows} {...tableProps} />
			) : (
				<PanelStatus variant="empty">No looping strategies match the current selection.</PanelStatus>
			)}
		</>
	)
}

export default LoopView
