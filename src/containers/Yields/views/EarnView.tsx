import { useRouter } from 'next/router'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { useEntityQuestions } from '~/containers/LlamaAI/hooks/useEntityQuestions'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { fetchJson } from '~/utils/async'
import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { YIELD_EARN_DATASET_API } from '../constants'
import type { TokenOption } from '../data/types'
import { prepareYieldPoolsCsv } from '../domain/poolCsv'
import { YieldFilters } from '../Filters'
import { ApyViewControls } from '../Filters/ApyViewControls'
import { EARN_ATTRIBUTE_IDS, type AttributeId } from '../Filters/attributeOptions'
import { CuratedViews } from '../Filters/CuratedViews'
import { IncludeTokens } from '../Filters/IncludeTokens'
import { getYieldsQuestionContext } from '../getYieldsQuestionContext'
import { useFormatYieldQueryParams } from '../hooks'
import { YIELD_PERCENT_OPTIONS } from '../poolDetail/format'
import { selectedSubsetQuery } from '../queryState'
import { PaginatedYieldsPoolTable } from '../Tables/Pools'
import type { IYieldTableRow } from '../Tables/types'
import { useLegacyYieldsUrlNormalizer } from '../useLegacyYieldsUrlNormalizer'
import { useYieldsServerTable } from '../useYieldsServerTable'
import type { YieldsPaginatedTableResponse } from '../yieldsTableQuery'
import { YieldsTabs } from '../YieldsTabs'

const EMPTY_POOL_ROWS: IYieldTableRow[] = []
const EMPTY_STRINGS: string[] = []
const EMPTY_TOKENS: TokenOption[] = []
type EarnRowsResponse = { rows: IYieldTableRow[] }

const EarnView = ({
	projectList = EMPTY_STRINGS,
	chainList = EMPTY_STRINGS,
	categoryList = EMPTY_STRINGS,
	evmChains = EMPTY_STRINGS,
	tokens = EMPTY_TOKENS,
	attributeIds = EARN_ATTRIBUTE_IDS,
	entityQuestions: baseQuestions,
	initialEarnPage,
	initialEarnPageGeneratedAt
}: {
	projectList?: string[]
	chainList?: string[]
	categoryList?: string[]
	evmChains?: string[]
	tokens?: TokenOption[]
	attributeIds?: AttributeId[]
	entityQuestions?: string[]
	initialEarnPage?: YieldsPaginatedTableResponse<IYieldTableRow>
	initialEarnPageGeneratedAt?: number
}) => {
	const router = useRouter()

	// Rewrite legacy bookmark params to canonical before the first fetch (gates `enabled`).
	const normalized = useLegacyYieldsUrlNormalizer({ page: 'earn', tokens })

	const { selectedProjects, selectedChains, selectedAttributes, selectedCategories } = useFormatYieldQueryParams({
		projectList,
		chainList,
		categoryList,
		evmChains,
		projectQueryKey: 'protocol',
		excludeProjectQueryKey: 'excludeProtocol'
	})

	// Translate the shared filter selections into the earn route params.
	// (Token filtering flows through `token` on the URL directly — the token search
	// already emits option keys — so it is not overridden here.)
	const attributeSet = new Set(selectedAttributes)
	// 'Single asset' → singleAssetExposure=true; 'Multi asset' → =false. Both selected
	// sends both values, which the tri-state server AND-s to zero rows.
	const single = attributeSet.has('single_exposure')
	const multi = attributeSet.has('multi_exposure')
	const singleAssetExposure: string | string[] | undefined =
		single && multi ? ['true', 'false'] : single ? 'true' : multi ? 'false' : undefined
	const extraQuery = {
		chain: selectedSubsetQuery(selectedChains, chainList),
		protocol: selectedSubsetQuery(selectedProjects, projectList),
		category: selectedSubsetQuery(selectedCategories, categoryList),
		stablecoin: attributeSet.has('stablecoins') ? 'true' : undefined,
		halal: attributeSet.has('halal') ? 'true' : undefined,
		singleAssetExposure,
		noIlRisk: attributeSet.has('no_il') ? 'true' : undefined,
		hasAudit: attributeSet.has('audited') ? 'true' : undefined,
		protocolHasToken: attributeSet.has('no_protocol_token') ? 'false' : undefined,
		includeMemeTokens: attributeSet.has('include_meme_tokens') ? 'true' : undefined
	}

	const {
		rows: serverRows,
		total: serverTotal,
		medianApy,
		rowsQuery,
		tableProps,
		buildAllRowsQueryString
	} = useYieldsServerTable<IYieldTableRow>({
		endpoint: YIELD_EARN_DATASET_API,
		enabled: normalized,
		extraQuery,
		initialData: initialEarnPage,
		initialDataUpdatedAt: initialEarnPageGeneratedAt
	})
	const poolsData = serverRows.length > 0 ? serverRows : EMPTY_POOL_ROWS

	// Strip median is deliberately token-gated: unfiltered it would be the market blend.
	const selectedTokenValues = Array.isArray(router.query.token)
		? router.query.token
		: router.query.token
			? [router.query.token]
			: EMPTY_STRINGS
	const medianLabel =
		selectedTokenValues.length === 1
			? (tokens.find(([, value]) => value === selectedTokenValues[0])?.[0] ?? 'selection')
			: 'selection'

	const filterContext = getYieldsQuestionContext(router.query)
	const { data: filteredQuestionsData, isFetching: isQuestionsLoading } = useEntityQuestions(
		'yields',
		'page',
		!!filterContext,
		filterContext ?? undefined
	)
	const questions = filteredQuestionsData?.questions?.length ? filteredQuestionsData.questions : baseQuestions

	const prepareCsv = async () => {
		const csvData = await fetchJson<EarnRowsResponse>(`${YIELD_EARN_DATASET_API}${buildAllRowsQueryString()}`)
		return prepareYieldPoolsCsv(csvData.rows, router.query)
	}

	return (
		<>
			<YieldsTabs
				active="earn"
				rightSlot={
					<p
						className={`hidden body-md text-secondary sm:block ${
							serverTotal && selectedProjects.length && selectedChains.length ? '' : 'invisible'
						}`}
					>
						Tracking <strong className="text-primary">{formatNumber(serverTotal)}</strong> pools across{' '}
						<strong className="text-primary">{formatNumber(selectedProjects.length)}</strong> protocols on{' '}
						<strong className="text-primary">{formatNumber(selectedChains.length)}</strong> chains
						{selectedTokenValues.length > 0 && medianApy != null ? (
							<>
								{' · '}
								{medianLabel === 'selection' ? 'median APY of selection' : `${medianLabel} median APY`}{' '}
								<strong className="text-primary">{formatPercent(medianApy, YIELD_PERCENT_OPTIONS)}</strong>
							</>
						) : null}
					</p>
				}
			/>

			<YieldFilters
				tokenSearch={<IncludeTokens tokens={tokens} matchOn data-alwaysdisplay={false} />}
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
				showColumns
				apyControls={<ApyViewControls />}
				curatedViews={<CuratedViews />}
				tvlRange={true}
				tvlRangeLabel="TVL"
				apyRange={true}
				resetFilters={true}
				resetFiltersLabel="Reset Filters"
				prepareCsv={prepareCsv}
				watchlist
			/>

			<NewsletterSignup layout="strip" />

			{questions?.length > 0 || isQuestionsLoading ? (
				<EntityQuestionsStrip
					questions={questions ?? []}
					entitySlug="yields"
					entityType="page"
					entityName="Yields"
					isLoading={isQuestionsLoading}
				/>
			) : null}

			{!rowsQuery.data && !rowsQuery.isError ? (
				<PanelLoadingStatus label="Loading pools" />
			) : rowsQuery.isError && !rowsQuery.data ? (
				<PanelStatus variant="error">Couldn't load pools.</PanelStatus>
			) : poolsData.length > 0 ? (
				<PaginatedYieldsPoolTable data={poolsData} {...tableProps} />
			) : (
				<PanelStatus variant="empty">No pools match current filters.</PanelStatus>
			)}
		</>
	)
}

export default EarnView
