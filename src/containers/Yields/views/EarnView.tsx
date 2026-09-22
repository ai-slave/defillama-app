import { useRouter } from 'next/router'
import type * as React from 'react'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { useEntityQuestions } from '~/containers/LlamaAI/hooks/useEntityQuestions'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { fetchJson, handleSimpleFetchResponse } from '~/utils/async'
import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { YIELD_EARN_DATASET_API, YIELD_EARN_PRIVATE_API } from '../constants'
import type { EarnPageMeta } from '../data/earnMeta.server'
import { prepareYieldPoolsCsv } from '../domain/poolCsv'
import { YieldFilters } from '../Filters'
import { ApyViewControls } from '../Filters/ApyViewControls'
import { resolveEarnColumnAccess } from '../Filters/columnOptions'
import { CuratedViews } from '../Filters/CuratedViews'
import { IncludeTokens } from '../Filters/IncludeTokens'
import { VerifiedFilterToggle } from '../Filters/VerifiedFilterToggle'
import { getYieldsQuestionContext } from '../getYieldsQuestionContext'
import { useFormatYieldQueryParams } from '../hooks'
import { YIELD_PERCENT_OPTIONS } from '../poolDetail/format'
import { selectedSubsetQuery } from '../queryState'
import { PaginatedYieldsPoolTable } from '../Tables/Pools'
import type { IYieldTableRow } from '../Tables/types'
import { useLegacyYieldsUrlNormalizer } from '../useLegacyYieldsUrlNormalizer'
import { useVerifiedAccess } from '../useVerifiedAccess'
import { useYieldsServerTable } from '../useYieldsServerTable'
import { VerifiedApyAnnouncement } from '../VerifiedApyAnnouncement'
import type { YieldsPaginatedTableResponse } from '../yieldsTableQuery'
import { YieldsTabs } from '../YieldsTabs'

const EMPTY_POOL_ROWS: Array<IYieldTableRow> = []
const EMPTY_STRINGS: Array<string> = []
type EarnRowsResponse = { rows: Array<IYieldTableRow> }

export type EarnViewProps = EarnPageMeta & {
	entityQuestions: Array<string>
	/** Null when the server could not establish the reader's tier; the client fetches its own. */
	initialEarnPage: YieldsPaginatedTableResponse<IYieldTableRow> | null
	initialEarnPageGeneratedAt: number
	/** True when the server rendered the measured rows for a subscriber, so the seed matches their tier. */
	initialEarnPageVerifiedAccess?: boolean
	/**
	 * Route-level filters for a standalone earn document (e.g. /yields/stablecoins).
	 * Merged over the URL-derived params so the route's subject cannot be filtered
	 * away, and folded into the seed's default query so the ISR rows still render at
	 * SSR. Pair with a reduced `attributeIds` so the UI can't offer to unset them.
	 */
	lockedQuery?: Record<string, string>
	/** Above-table copy that makes the page its own document rather than a filter state. */
	intro?: React.ReactNode
}

function EarnView({
	projectList,
	projectGroups,
	chainList,
	categoryList,
	evmChains,
	tokens,
	attributeIds,
	entityQuestions: baseQuestions,
	initialEarnPage,
	initialEarnPageGeneratedAt,
	initialEarnPageVerifiedAccess = false,
	lockedQuery,
	intro
}: EarnViewProps) {
	const router = useRouter()
	const { authorizedFetch, hasAccess: paidYields, isDenied } = useVerifiedAccess()

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
	const { verifiedAccess: effectiveVerifiedAccess, defaultColumns } = resolveEarnColumnAccess({
		hasAccess: paidYields,
		initialVerifiedAccess: initialEarnPageVerifiedAccess,
		isDenied,
		verifiedFilter: attributeSet.has('verified')
	})
	// 'Single asset' → singleAssetExposure=true; 'Multi asset' → =false. Both selected
	// sends both values, which the tri-state server AND-s to zero rows.
	const single = attributeSet.has('single_exposure')
	const multi = attributeSet.has('multi_exposure')
	const singleAssetExposure: string | Array<string> | undefined =
		single && multi ? ['true', 'false'] : single ? 'true' : multi ? 'false' : undefined
	const extraQuery = {
		chain: selectedSubsetQuery(selectedChains, chainList),
		protocol: router.query.excludeProtocol ? router.query.protocol : selectedSubsetQuery(selectedProjects, projectList),
		category: selectedSubsetQuery(selectedCategories, categoryList),
		stablecoin: attributeSet.has('stablecoins') ? 'true' : undefined,
		halal: attributeSet.has('halal') ? 'true' : undefined,
		singleAssetExposure,
		noIlRisk: attributeSet.has('no_il') ? 'true' : undefined,
		hasAudit: attributeSet.has('audited') ? 'true' : undefined,
		potentialAirdrop: attributeSet.has('airdrop') ? 'true' : undefined,
		includeMemeTokens: attributeSet.has('include_meme_tokens') ? 'true' : undefined,
		verified: attributeSet.has('verified') ? 'true' : undefined,
		// Last so a locked route filter wins over anything the URL says.
		...lockedQuery
	}

	const {
		rows: serverRows,
		total: serverTotal,
		medianApy,
		data,
		isLoading,
		rowsQuery,
		tableProps,
		buildAllRowsQueryString
	} = useYieldsServerTable<IYieldTableRow>({
		endpoint: YIELD_EARN_DATASET_API,
		privateEndpoint: YIELD_EARN_PRIVATE_API,
		enabled: normalized,
		extraQuery,
		...(initialEarnPage
			? {
					initialSeed: {
						initialData: initialEarnPage,
						initialDataUpdatedAt: initialEarnPageGeneratedAt,
						verifiedAccess: initialEarnPageVerifiedAccess
					}
				}
			: {})
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
	// Same gate as the strip; the cells surface the comparison as a tooltip-only pp delta.
	const apyCellMedian =
		selectedTokenValues.length > 0 && medianApy != null ? { label: medianLabel, apy: medianApy } : undefined

	const filterContext = getYieldsQuestionContext(router.query)
	// Never a skeleton here: a filter change keeps the current chips (or the page's own set) on screen
	// and swaps them once the filtered set lands. The strip simply stays away while there is nothing.
	const { data: filteredQuestionsData } = useEntityQuestions(
		'yields',
		'page',
		!!filterContext,
		filterContext ?? undefined,
		{
			keepPreviousData: true
		}
	)
	const questions = filteredQuestionsData?.questions?.length ? filteredQuestionsData.questions : baseQuestions

	// Must follow the same endpoint choice the table made, or a paying reader silently exports the
	// locked numbers.
	const prepareCsv = async () => {
		const query = buildAllRowsQueryString()
		const csvData = effectiveVerifiedAccess
			? await authorizedFetch(`${YIELD_EARN_PRIVATE_API}${query}`)
					.then((res) => (res ? handleSimpleFetchResponse(res) : Promise.reject(new Error('Authentication required'))))
					.then((res) => res.json() as Promise<EarnRowsResponse>)
			: await fetchJson<EarnRowsResponse>(`${YIELD_EARN_DATASET_API}${query}`)
		return prepareYieldPoolsCsv(csvData.rows, router.query, defaultColumns)
	}

	return (
		<>
			<YieldsTabs
				active="earn"
				rightSlot={
					<p
						className={`hidden body-md text-secondary sm:block ${
							serverTotal && selectedProjects.length > 0 && selectedChains.length > 0 ? '' : 'invisible'
						}`}
					>
						Tracking <strong className="text-primary">{formatNumber(serverTotal)}</strong> pools across{' '}
						<strong className="text-primary">{formatNumber(selectedProjects.length)}</strong> protocols on{' '}
						<strong className="text-primary">{formatNumber(selectedChains.length)}</strong> chains
						{selectedTokenValues.length > 0 && medianApy != null ? (
							<>
								{' · '}
								{medianLabel === 'selection' ? 'median APY of selection' : `${medianLabel} median APY`}{' '}
								<strong className="rounded-md bg-brand-muted px-1.5 py-0.5 text-link-on-tint">
									{formatPercent(medianApy, YIELD_PERCENT_OPTIONS)}
								</strong>
							</>
						) : null}
					</p>
				}
			/>

			{intro}

			<YieldFilters
				tokenSearch={<IncludeTokens tokens={tokens} matchOn data-alwaysdisplay={false} />}
				mobileActions={<IncludeTokens tokens={tokens} matchOn compact />}
				chainList={chainList}
				selectedChains={selectedChains}
				evmChains={evmChains}
				projectList={projectList}
				projectGroups={projectGroups}
				selectedProjects={selectedProjects}
				projectsLabel="Protocols"
				categoryList={categoryList}
				selectedCategories={selectedCategories}
				categoriesLabel="Categories"
				attributeIds={attributeIds}
				showColumns
				defaultColumns={defaultColumns}
				apyControls={
					<>
						<ApyViewControls ready={normalized} />
						<span className="mx-0.5 hidden h-5 w-px bg-border-medium sm:block" aria-hidden />
						<span className="hidden sm:block">
							<VerifiedFilterToggle />
						</span>
					</>
				}
				curatedViews={<CuratedViews />}
				menuHeader={
					<>
						<CuratedViews nestedMenu />
						<VerifiedFilterToggle nestedMenu />
					</>
				}
				tvlRange
				tvlRangeLabel="TVL"
				apyRange
				resetFilters
				prepareCsv={prepareCsv}
				watchlist
			/>

			<NewsletterSignup layout="strip" />

			{questions.length > 0 ? (
				<EntityQuestionsStrip questions={questions} entitySlug="yields" entityType="page" entityName="Yields" />
			) : null}

			<VerifiedApyAnnouncement hasAccess={effectiveVerifiedAccess} />

			{isLoading ? (
				<PanelLoadingStatus label="Loading pools" />
			) : rowsQuery.isError && !data ? (
				<PanelStatus variant="error">Couldn't load pools.</PanelStatus>
			) : poolsData.length > 0 ? (
				<PaginatedYieldsPoolTable
					data={poolsData}
					{...(apyCellMedian ? { median: apyCellMedian } : {})}
					{...tableProps}
					defaultColumns={defaultColumns}
				/>
			) : (
				<PanelStatus variant="empty">No pools match current filters.</PanelStatus>
			)}
		</>
	)
}

export default EarnView
