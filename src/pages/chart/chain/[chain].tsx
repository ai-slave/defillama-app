import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import {
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { CumulativeUnavailableNotice } from '~/components/ECharts/shared/CumulativeUnavailableNotice'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { BAR_CHARTS, type ChainChartLabels, chainCharts } from '~/containers/ChainOverview/constants'
import { getChainOverviewData } from '~/containers/ChainOverview/queries.server'
import type { IChainOverviewData } from '~/containers/ChainOverview/types'
import { useFetchChainChartData } from '~/containers/ChainOverview/useFetchChainChartData'
import { TVL_SETTINGS } from '~/contexts/LocalStorage'
import { useIsClient } from '~/hooks/useIsClient'
import { LocalLoader } from '~/ui/Loaders'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { getChainDenominations } from '~/utils/metadata/chainDenominations'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'
import { isTruthyQueryParam, pushShallowQuery } from '~/utils/routerQuery'

const ChainCoreChart: any = lazy(() => import('~/containers/ChainOverview/Chart'))

const normalizeChartInterval = (value: string | null | undefined): LowercaseDwmcGrouping | null => {
	const normalizedValue = value?.toLowerCase() ?? null
	if (DWMC_GROUPING_OPTIONS_LOWERCASE.some((option) => option.value === normalizedValue)) {
		return normalizedValue as LowercaseDwmcGrouping
	}
	return null
}
export const getStaticProps = withPerformanceLogging(
	'chart/chain/[chain]',
	async ({ params }: GetStaticPropsContext<{ chain: string }>) => {
		let chain = !params.chain || params.chain === 'all' ? 'All' : params.chain
		const [{ default: metadataCache }, { resolveChainParamFromMetadata }] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/ChainOverview/server/routes')
		])

		if (chain === 'All') {
			if (params.chain !== 'all') {
				return canonicalRouteRedirect('/chart/chain/all')
			}
		} else {
			const chainRoute = resolveChainParamFromMetadata(chain, metadataCache)
			if (!chainRoute) {
				return { notFound: true }
			}
			if (chain !== chainRoute.canonicalSlug) {
				return canonicalRouteRedirect(`/chart/chain/${chainRoute.canonicalSlug}`)
			}
			chain = chainRoute.canonicalName
		}

		const data = await getChainOverviewData({
			chain,
			chainMetadata: metadataCache.chainMetadata,
			protocolMetadata: metadataCache.protocolMetadata,
			categoriesAndTagsMetadata: metadataCache.categoriesAndTags
		})

		if (!data) {
			throw new Error(`Missing page data for route=/chart/chain/[chain] chain=${chain}`)
		}

		return {
			props: data,
			revalidate: maxAgeForNext([22])
		}
	}
)

export const getStaticPaths = () => {
	// When this is true (in preview environments) don't
	// prerender any static pages
	// (faster builds, but slower initial page load)
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	return { paths: [], fallback: 'blocking' }
}

export default function ChainChartPage(props: IChainOverviewData) {
	const router = useRouter()
	const selectedChain = props.metadata.name
	const queryParamsString = useMemo(() => {
		const { tvl, ...rest } = router.query ?? {}
		return JSON.stringify(
			router.query
				? tvl === 'true'
					? rest
					: router.query
				: props.metadata.id !== 'all'
					? { chain: props.metadata.id }
					: {}
		)
	}, [router.query, props.metadata.id])

	const { toggledCharts, chainGeckoId, groupBy, denomination, tvlSettings, isThemeDark } = useMemo(() => {
		const queryParams = JSON.parse(queryParamsString)

		const chainGeckoId = props.chainTokenInfo?.gecko_id ?? null

		const tvlSettings = {}

		for (const setting in TVL_SETTINGS) {
			tvlSettings[TVL_SETTINGS[setting]] = isTruthyQueryParam(queryParams[`include_${TVL_SETTINGS[setting]}_in_tvl`])
		}

		const toggledCharts = props.charts.filter((tchart, index) =>
			index === 0 ? queryParams[chainCharts[tchart]] !== 'false' : queryParams[chainCharts[tchart]] === 'true'
		) as Array<ChainChartLabels>

		const hasAtleasOneBarChart = toggledCharts.some((chart) => BAR_CHARTS.includes(chart))

		const groupBy =
			hasAtleasOneBarChart && queryParams?.groupBy ? (normalizeChartInterval(queryParams.groupBy) ?? 'daily') : 'daily'

		const denomination =
			getChainDenominations(props.metadata).find(
				({ symbol }) =>
					typeof queryParams.currency === 'string' && symbol.toLowerCase() === queryParams.currency.toLowerCase()
			)?.symbol ?? 'USD'

		const isThemeDark = queryParams.theme === 'dark'

		return {
			chainGeckoId,
			toggledCharts,
			groupBy,
			denomination,
			tvlSettings,
			isThemeDark
		}
	}, [queryParamsString, props.charts, props.chainTokenInfo?.gecko_id, props.metadata])

	const { finalCharts, valueSymbol, isFetchingChartData } = useFetchChainChartData({
		denomination,
		selectedChain,
		tvlChart: props.tvlChart,
		tvlChartSummary: props.tvlChartSummary,
		extraTvlCharts: props.extraTvlCharts,
		tvlSettings,
		chainGeckoId,
		gasTokenGeckoId: props.metadata.gasTokenGeckoId ?? null,
		toggledCharts,
		groupBy
	})

	const isClient = useIsClient()

	useEffect(() => {
		if (!isThemeDark) {
			document.documentElement.classList.remove('dark')
		} else {
			document.documentElement.classList.add('dark')
		}

		const root = document.getElementById('__next')
		if (root) {
			root.setAttribute('style', 'flex-direction: column')
		}
	}, [isThemeDark])

	// The toggle stays on, so switching back from cumulative restores the series.
	const isActiveAddressesHidden = groupBy === 'cumulative' && toggledCharts.includes('Active Addresses')
	const showDaily = () => void pushShallowQuery(router, { groupBy: 'daily' })

	return (
		<div className="col-span-full flex min-h-[360px] flex-col">
			{isFetchingChartData || !router.isReady || !isClient ? (
				<div role="status" aria-live="polite" className="flex min-h-[360px] items-center justify-center">
					<LocalLoader />
					<span className="sr-only">Loading chart data</span>
				</div>
			) : isActiveAddressesHidden && toggledCharts.length === 1 ? (
				<CumulativeUnavailableNotice metric="Active Addresses" fill onShowDaily={showDaily} />
			) : (
				<Suspense fallback={<div className="flex min-h-[360px] items-center justify-center" />}>
					{isActiveAddressesHidden ? (
						<CumulativeUnavailableNotice metric="Active Addresses" fill={false} onShowDaily={showDaily} />
					) : null}
					<ChainCoreChart
						chartData={finalCharts}
						valueSymbol={valueSymbol}
						isThemeDark={isThemeDark}
						groupBy={groupBy}
					/>
				</Suspense>
			)}
		</div>
	)
}
