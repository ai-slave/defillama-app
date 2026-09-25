import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import { CumulativeUnavailableNotice } from '~/components/ECharts/shared/CumulativeUnavailableNotice'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { resolveEmbedTvlSettings, resolveProtocolChartQuery } from '~/containers/ProtocolOverview/chartQuery'
import { getProtocolOverviewPageData } from '~/containers/ProtocolOverview/queries'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { useFetchProtocolChartData } from '~/containers/ProtocolOverview/useFetchProtocolChartData'
import { LocalLoader } from '~/ui/Loaders'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'
import { pushShallowQuery } from '~/utils/routerQuery'

const ProtocolCoreChart = lazy(() => import('~/containers/ProtocolOverview/Chart'))

export const getStaticProps = withPerformanceLogging(
	'chart/protocol/[protocol]',
	async ({ params }: GetStaticPropsContext<{ protocol: string }>) => {
		if (!params?.protocol) {
			return { notFound: true }
		}

		const protocol = params.protocol
		const [{ default: metadataCache }, { resolveProtocolParamFromMetadata }] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/ProtocolOverview/server/routes')
		])
		const protocolRoute = resolveProtocolParamFromMetadata(protocol, metadataCache)
		if (!protocolRoute) {
			return { notFound: true }
		}
		if (protocol !== protocolRoute.canonicalSlug) {
			return canonicalRouteRedirect(`/chart/protocol/${protocolRoute.canonicalSlug}`)
		}

		const yieldsSnapshot = protocolRoute.metadata.yields
			? await import('~/containers/Yields/server/dataset.server').then(({ acquireOptionalYieldsSnapshot }) =>
					acquireOptionalYieldsSnapshot()
				)
			: null
		const data = await getProtocolOverviewPageData({
			protocolId: protocolRoute.id,
			currentProtocolMetadata: protocolRoute.metadata,
			rwaPlatformActiveAum: protocolRoute.metadata.rwaPlatformSlug
				? (metadataCache.rwaPlatformsIndex.platforms[protocolRoute.metadata.rwaPlatformSlug]?.activeAum ?? null)
				: null,
			chainMetadata: metadataCache.chainMetadata,
			tokenlist: metadataCache.tokenlist,
			cgExchangeIdentifiers: metadataCache.cgExchangeIdentifiers,
			emissionsSupplyMetrics: metadataCache.emissionsSupplyMetrics,
			yieldsSnapshot,
			includeFaq: false
		})

		if (!data) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		return { props: data, revalidate: maxAgeForNext([22]) }
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

export default function ProtocolChartPage(props: IProtocolOverviewPageData) {
	const router = useRouter()

	const { toggledMetrics, groupBy, tvlSettings } = useMemo(() => {
		const chartQuery = resolveProtocolChartQuery({
			getQueryValue: (key) => router.query[key],
			availableCharts: props.availableCharts,
			defaultToggledCharts: props.defaultToggledCharts,
			chartDenominations: props.chartDenominations,
			hallmarks: props.hallmarks,
			rangeHallmarks: props.rangeHallmarks,
			defaultChartView: props.defaultChartView
		})

		return {
			toggledMetrics: chartQuery.toggledMetrics,
			groupBy: chartQuery.groupBy,
			tvlSettings: resolveEmbedTvlSettings((key) => router.query[key])
		}
	}, [
		router.query,
		props.availableCharts,
		props.defaultToggledCharts,
		props.chartDenominations,
		props.hallmarks,
		props.rangeHallmarks,
		props.defaultChartView
	])

	const isThemeDark = router.query.theme === 'dark'

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

	const { finalCharts, valueSymbol, loadingCharts } = useFetchProtocolChartData({
		...props,
		toggledMetrics,
		groupBy,
		tvlSettings
	})
	const hasVisibleCharts = Object.keys(finalCharts).length > 0
	// The toggle stays on, so switching back from cumulative restores the series.
	const isActiveAddressesHidden = groupBy === 'cumulative' && toggledMetrics.activeAddresses === 'true'
	const showDaily = () => void pushShallowQuery(router, { groupBy: 'daily' })

	return (
		<div className="col-span-full flex min-h-[360px] flex-col">
			{isActiveAddressesHidden && !hasVisibleCharts && loadingCharts.length === 0 ? (
				<CumulativeUnavailableNotice metric="Active Addresses" fill onShowDaily={showDaily} />
			) : !hasVisibleCharts && loadingCharts.length > 0 ? (
				<div role="status" aria-live="polite" className="flex min-h-[360px] items-center justify-center">
					<LocalLoader />
					<span className="sr-only">Loading chart data</span>
				</div>
			) : (
				<Suspense fallback={<div className="flex min-h-[360px] items-center justify-center" />}>
					{isActiveAddressesHidden ? (
						<CumulativeUnavailableNotice metric="Active Addresses" fill={false} onShowDaily={showDaily} />
					) : null}
					<ProtocolCoreChart
						chartData={finalCharts}
						chartColors={props.chartColors}
						isThemeDark={isThemeDark}
						valueSymbol={valueSymbol}
						groupBy={groupBy}
						hallmarks={toggledMetrics.events === 'true' ? props.hallmarks : null}
						rangeHallmarks={toggledMetrics.events === 'true' ? props.rangeHallmarks : null}
						unlockTokenSymbol={props.token.symbol}
					/>
				</Suspense>
			)}
		</div>
	)
}
