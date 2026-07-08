import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/ChartGroupingSelector'
import { formatBarChart } from '~/components/ECharts/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { CHART_COLORS } from '~/constants/colors'
import { DimensionProtocolChartByType } from '~/containers/AdapterMetrics/ProtocolChart'
import { getAdapterProtocolOverview } from '~/containers/AdapterMetrics/queries'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { formatAdapterData } from '~/containers/ProtocolOverview/formatAdapterData'
import { KeyMetrics } from '~/containers/ProtocolOverview/KeyMetrics'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Panel } from '~/ui/Panel'
import { ChartPanelToolbar } from '~/ui/Toolbar'
import { formattedNum, slug } from '~/utils'
import { buildHallmarksWithGenuineSpikes } from '~/utils/hallmarks'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const EMPTY_TOGGLE_OPTIONS = []

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

export const getStaticProps = withPerformanceLogging(
	'protocol/bridge-aggregators/[protocol]',
	async ({ params }: GetStaticPropsContext<{ protocol: string }>) => {
		if (!params?.protocol) {
			return { notFound: true }
		}
		const { protocol } = params
		const [{ default: metadataCache }, { resolveProtocolFeatureRouteFromMetadata }] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/ProtocolOverview/server/routes')
		])
		const { protocolMetadata } = metadataCache
		const protocolRoute = resolveProtocolFeatureRouteFromMetadata({
			hasMetric: (metadata) => Boolean(metadata.bridgeAggregators),
			metadataCache,
			protocol,
			routePrefix: 'protocol/bridge-aggregators'
		})
		if (!protocolRoute) {
			return { notFound: true }
		}
		if (protocolRoute.type === 'redirect') {
			return canonicalRouteRedirect(protocolRoute.destination)
		}
		const metadata = [protocolRoute.route.id, protocolRoute.route.metadata] as const
		const canonicalProtocol = protocolRoute.route.canonicalSlug

		const [protocolData, adapterData] = await Promise.all([
			fetchProtocolOverviewMetrics(canonicalProtocol),
			getAdapterProtocolOverview({
				adapterType: 'bridge-aggregators',
				protocol: metadata[1].displayName,
				excludeTotalDataChart: false
			})
		])

		if (!protocolData) {
			return { notFound: true }
		}

		const metrics = getProtocolMetricFlags({ protocolData, metadata: metadata[1] })
		const hallmarks = buildHallmarksWithGenuineSpikes({
			dimensions: protocolData.dimensions
		})

		const seoTitle = `${protocolData.name} Bridge Aggregator Volume - DefiLlama`
		const seoDescription = `Track ${protocolData.name} bridge aggregator volume across chains with daily and cumulative charts on DefiLlama.`

		const bridgeAggregatorVolume: IProtocolOverviewPageData['bridgeAggregatorVolume'] = formatAdapterData({
			data: adapterData,
			methodologyKey: 'bridgeAggregators'
		})

		const linkedProtocolsSet = new Set((adapterData?.linkedProtocols ?? []).slice(1))
		const linkedProtocolsWithAdapterData = []
		if (protocolData.isParentProtocol) {
			for (const key in protocolMetadata) {
				if (linkedProtocolsSet.size === 0) break
				if (linkedProtocolsSet.has(protocolMetadata[key].displayName)) {
					if (protocolMetadata[key].bridgeAggregators) {
						linkedProtocolsWithAdapterData.push(protocolMetadata[key])
					}
					linkedProtocolsSet.delete(protocolMetadata[key].displayName)
				}
			}
		}

		let chart = (adapterData.totalDataChart ?? []).map(([date, value]) => [+date * 1e3, value] as [number, number])
		const nonZeroIndex = chart.findIndex(([_date, value]) => value > 0)
		if (nonZeroIndex !== -1) {
			chart = chart.slice(nonZeroIndex)
		}

		return {
			props: {
				name: protocolData.name,
				deprecated: protocolData.deprecated ?? false,
				otherProtocols: protocolData?.otherProtocols ?? [],
				category: protocolData?.category ?? null,
				metrics,
				hasKeyMetrics: true,
				openSmolStatsSummaryByDefault: true,
				bridgeAggregatorVolume,
				chart,
				protocolChains: adapterData?.chains ?? [],
				protocolVersions: linkedProtocolsWithAdapterData?.map((versionProtocol) => versionProtocol.displayName) ?? [],
				warningBanners: getProtocolWarningBanners(protocolData),
				hallmarks,
				defaultChartView: bridgeAggregatorVolume?.defaultChartView ?? 'daily',
				seoTitle,
				seoDescription
			},
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

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const [groupBy, setGroupBy] = useState<LowercaseDwmcGrouping>(props.defaultChartView)
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const finalCharts = useMemo(() => {
		const formattedData = formatBarChart({
			data: props.chart,
			groupBy,
			denominationPriceHistory: null,
			dateInMs: true
		})
		return {
			dataset: {
				source: formattedData.map(([timestamp, value]) => ({ timestamp, 'Bridge Aggregator Volume': value })),
				dimensions: ['timestamp', 'Bridge Aggregator Volume']
			},
			charts: [
				{
					type: (groupBy === 'cumulative' ? 'line' : 'bar') as 'line' | 'bar',
					name: 'Bridge Aggregator Volume',
					encode: { x: 'timestamp', y: 'Bridge Aggregator Volume' },
					color: CHART_COLORS[0],
					stack: 'Bridge Aggregator Volume'
				}
			]
		}
	}, [props.chart, groupBy])
	const deferredFinalCharts = useDeferredValue(finalCharts)

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="bridgeAggregators"
			warningBanners={props.warningBanners}
			toggleOptions={EMPTY_TOGGLE_OPTIONS}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<Panel padding="sm" className="col-span-1 gap-6 xl:min-h-[360px]">
					<h1 className="flex flex-wrap items-center gap-2 text-xl">
						<TokenLogo name={props.name} kind="token" size={24} alt={`Logo of ${props.name}`} />
						<span className="font-bold">{props.name}</span>
						{props.deprecated ? <DeprecatedProtocolMarker size={16} /> : null}
					</h1>
					<KeyMetrics {...props} formatPrice={(value) => formattedNum(value, true)} />
				</Panel>
				<Panel className="col-span-1 xl:col-[2/-1]">
					<ChartPanelToolbar className="justify-end">
						<ChartGroupingSelector value={groupBy} setValue={setGroupBy} options={DWMC_GROUPING_OPTIONS_LOWERCASE} />
						<ChartExportButtons
							chartInstance={chartInstance}
							filename={`${props.name}-bridge-aggregator-volume`}
							title={props.name}
							iconUrl={tokenIconUrl(props.name)}
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<div className="min-h-[360px]" />}>
						<MultiSeriesChart2
							dataset={deferredFinalCharts.dataset}
							charts={deferredFinalCharts.charts}
							groupBy={groupBy}
							valueSymbol="$"
							hallmarks={props.hallmarks ?? undefined}
							onReady={handleChartReady}
						/>
					</Suspense>
				</Panel>
			</div>
			<div className="grid grid-cols-2 gap-2">
				{props.protocolChains?.length > 1 ? (
					<Panel className="col-span-full xl:col-span-1 xl:only:col-span-full">
						<DimensionProtocolChartByType
							chartType="chain"
							protocolName={slug(props.name)}
							protocolDisplayName={props.name}
							adapterType="bridge-aggregators"
							breakdownNames={props.protocolChains}
							hallmarks={props.hallmarks ?? undefined}
							title="Bridge Aggregator Volume by chain"
						/>
					</Panel>
				) : null}
				{props.protocolVersions?.length > 1 ? (
					<Panel className="col-span-full xl:col-span-1 xl:only:col-span-full">
						<DimensionProtocolChartByType
							chartType="version"
							protocolName={slug(props.name)}
							protocolDisplayName={props.name}
							adapterType="bridge-aggregators"
							breakdownNames={props.protocolVersions}
							hallmarks={props.hallmarks ?? undefined}
							title="Bridge Aggregator Volume by protocol version"
						/>
					</Panel>
				) : null}
			</div>
		</ProtocolOverviewLayout>
	)
}
