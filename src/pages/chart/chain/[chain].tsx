import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import { CumulativeUnavailableNotice } from '~/components/ECharts/shared/CumulativeUnavailableNotice'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { getChainChartColors } from '~/containers/ChainOverview/constants'
import {
	getActiveAddressesCumulativeNotice,
	getEmbeddedChainChartSettings
} from '~/containers/ChainOverview/embeddedChartSettings'
import { getChainOverviewData } from '~/containers/ChainOverview/queries.server'
import type { IChainOverviewData } from '~/containers/ChainOverview/types'
import { useFetchChainChartData } from '~/containers/ChainOverview/useFetchChainChartData'
import { useIsClient } from '~/hooks/useIsClient'
import { FailedDataNote } from '~/ui/ScopeNote'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'
import { pushShallowQuery } from '~/utils/routerQuery'

const ChainCoreChart: any = lazy(() => import('~/containers/ChainOverview/Chart'))

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

		// The TVL settings series load from the chain charts API when the embed's settings turn one on.
		const { extraTvlCharts: _extraTvlCharts, ...overview } = data
		return {
			props: overview,
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

export default function ChainChartPage(props: Omit<IChainOverviewData, 'extraTvlCharts'>) {
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

	const { toggledCharts, chainGeckoId, groupBy, denomination, tvlSettings, isThemeDark } = useMemo(
		() =>
			getEmbeddedChainChartSettings(JSON.parse(queryParamsString), {
				charts: props.charts,
				chainTokenInfo: props.chainTokenInfo,
				metadata: props.metadata
			}),
		[queryParamsString, props.charts, props.chainTokenInfo, props.metadata]
	)

	const chartColors = useMemo(() => getChainChartColors(toggledCharts), [toggledCharts])
	const { finalCharts, valueSymbol, isFetchingChartData, tvlSettingsFailed } = useFetchChainChartData({
		denomination,
		selectedChain,
		tvlChart: props.tvlChart,
		tvlChartSummary: props.tvlChartSummary,
		extraTvlCharts: null,
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

	const activeAddressesNotice = getActiveAddressesCumulativeNotice(groupBy, toggledCharts)
	const showDaily = () => void pushShallowQuery(router, { groupBy: 'daily' })

	return (
		<div className="col-span-full flex min-h-[360px] flex-col">
			{isFetchingChartData || !router.isReady || !isClient ? (
				<SurfaceBodyLoadingStatus label="Loading chart data" />
			) : activeAddressesNotice === 'fill' ? (
				<CumulativeUnavailableNotice metric="Active Addresses" fill onShowDaily={showDaily} />
			) : (
				<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
					{tvlSettingsFailed ? <FailedDataNote labels={['your TVL settings']} shows="TVL leaves them out." /> : null}
					{activeAddressesNotice === 'inline' ? (
						<CumulativeUnavailableNotice metric="Active Addresses" fill={false} onShowDaily={showDaily} />
					) : null}
					<ChainCoreChart
						chartData={finalCharts}
						chartColors={chartColors}
						valueSymbol={valueSymbol}
						isThemeDark={isThemeDark}
						groupBy={groupBy}
					/>
				</Suspense>
			)}
		</div>
	)
}
