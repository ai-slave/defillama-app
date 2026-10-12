import type { GetStaticPropsContext } from 'next'
import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import type { TimePoint } from '~/components/ECharts/MultiSeriesChart/timeSeriesBuilder'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { CHART_COLORS } from '~/constants/colors'
import { DimensionProtocolChartByType } from '~/containers/AdapterMetrics/ProtocolChart'
import { getAdapterProtocolOverview } from '~/containers/AdapterMetrics/queries'
import {
	getLinkedAdapterProtocolVersionNames,
	getLinkedAdapterProtocolVersions
} from '~/containers/ProtocolOverview/adapterProtocolPage'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { formatAdapterData } from '~/containers/ProtocolOverview/formatAdapterData'
import { KeyMetrics } from '~/containers/ProtocolOverview/KeyMetrics'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { buildProtocolFlowChart, normalizeProtocolFlowChart } from '~/containers/ProtocolOverview/protocolFlowChart'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { slug } from '~/utils'
import { buildHallmarksWithGenuineSpikes } from '~/utils/hallmarks'
import type { HallmarkPoint } from '~/utils/hallmarks'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const EMPTY_TOGGLE_OPTIONS: Array<{ name: string; key: string }> = []

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

interface DexAggregatorProtocolPageProps {
	name: string
	deprecated: boolean
	otherProtocols: Array<string>
	category: string | null
	metrics: IProtocolOverviewPageData['metrics']
	hasKeyMetrics: true
	openSmolStatsSummaryByDefault: true
	dexAggregatorVolume: NonNullable<IProtocolOverviewPageData['dexAggregatorVolume']>
	chart: Array<TimePoint>
	protocolChains: Array<string>
	protocolVersions: Array<string>
	warningBanners: ReturnType<typeof getProtocolWarningBanners>
	hallmarks: Array<HallmarkPoint> | null
	defaultChartView: LowercaseDwmcGrouping
	seoTitle: string
	seoDescription: string
}

export const getStaticProps = withPerformanceLogging<DexAggregatorProtocolPageProps, { protocol: string }>(
	'protocol/dex-aggregators/[protocol]',
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
			hasMetric: (metadata) => Boolean(metadata.dexAggregators),
			metadataCache,
			protocol,
			routePrefix: 'protocol/dex-aggregators'
		})
		if (!protocolRoute) {
			return { notFound: true }
		}
		if (protocolRoute.type === 'redirect') {
			return canonicalRouteRedirect(protocolRoute.destination)
		}
		const metadata = protocolRoute.route.metadata
		const protocolDisplayName = metadata.displayName
		if (!protocolDisplayName) return { notFound: true }
		const canonicalProtocol = protocolRoute.route.canonicalSlug

		const [protocolData, adapterData] = await Promise.all([
			fetchProtocolOverviewMetrics(canonicalProtocol),
			getAdapterProtocolOverview({
				adapterType: 'aggregators',
				protocol: protocolDisplayName,
				excludeTotalDataChart: false
			})
		])

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const hallmarks = buildHallmarksWithGenuineSpikes({
			dimensions: protocolData.dimensions
		})

		const seoTitle = `${protocolData.name} DEX Aggregator Volume - DefiLlama`
		const seoDescription = `Track ${protocolData.name} DEX aggregator trading volume across chains with daily and cumulative charts on DefiLlama.`

		const dexAggregatorVolume = formatAdapterData({
			data: adapterData,
			methodologyKey: 'dexAggregators'
		})

		const linkedProtocolVersions = getLinkedAdapterProtocolVersions({
			isParentProtocol: protocolData.isParentProtocol === true,
			linkedProtocols: adapterData.linkedProtocols,
			protocolMetadata
		})
		const protocolVersions = getLinkedAdapterProtocolVersionNames({
			versions: linkedProtocolVersions,
			metric: 'dexAggregators'
		})

		const chart = normalizeProtocolFlowChart(adapterData.totalDataChart, true)

		return {
			props: {
				name: protocolData.name,
				deprecated: protocolData.deprecated ?? false,
				otherProtocols: protocolData.otherProtocols ?? [],
				category: protocolData.category ?? null,
				metrics,
				hasKeyMetrics: true,
				openSmolStatsSummaryByDefault: true,
				dexAggregatorVolume,
				chart,
				protocolChains: adapterData.chains,
				protocolVersions,
				warningBanners: getProtocolWarningBanners(protocolData),
				hallmarks,
				defaultChartView: dexAggregatorVolume.defaultChartView ?? 'daily',
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

export default function Protocols(props: DexAggregatorProtocolPageProps) {
	const [groupBy, setGroupBy] = useState<LowercaseDwmcGrouping>(props.defaultChartView)
	const chartExport = useGetChartInstance()

	const finalCharts = useMemo(() => {
		return {
			...buildProtocolFlowChart({
				groupBy,
				series: [
					{
						name: 'DEX Aggregator Volume',
						color: CHART_COLORS[0],
						stack: 'DEX Aggregator Volume',
						points: props.chart
					}
				]
			}),
			// Deferred together with the rows, so labels and exports never pair old rows with a new grouping.
			groupBy
		}
	}, [props.chart, groupBy])
	const deferredFinalCharts = useDeferredValue(finalCharts)

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="dexAggregators"
			warningBanners={props.warningBanners}
			toggleOptions={EMPTY_TOGGLE_OPTIONS}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<SummaryCardGrid>
				<SummaryStatsCard padding="sm" className="xl:min-h-[360px]">
					<h1 className="flex flex-wrap items-center gap-2 heading-sm">
						<TokenLogo name={props.name} kind="token" size={24} alt={`Logo of ${props.name}`} />
						<span className="font-bold">{props.name}</span>
						{props.deprecated ? <DeprecatedProtocolMarker size="size-4" /> : null}
					</h1>
					<KeyMetrics
						{...props}
						isOracleProtocol={false}
						oracleTvs={null}
						formatPrice={(value) =>
							formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						}
					/>
				</SummaryStatsCard>
				<Panel className="col-span-2">
					<ChartPanelToolbar>
						<ChartGroupingSelector value={groupBy} setValue={setGroupBy} options={DWMC_GROUPING_OPTIONS_LOWERCASE} />
						<ChartExportButtons
							chart={chartExport}
							filename={`${props.name}-dex-aggregator-volume`}
							title={props.name}
							iconUrl={tokenIconUrl(props.name)}
							csvSource={{
								type: 'dataset',
								prepare: () => ({ ...deferredFinalCharts.dataset, groupBy: deferredFinalCharts.groupBy })
							}}
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
						<MultiSeriesChart
							exportButtons={chartExport}
							dataset={deferredFinalCharts.dataset}
							charts={deferredFinalCharts.charts}
							groupBy={deferredFinalCharts.groupBy}
							valueSymbol="$"
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
						/>
					</Suspense>
				</Panel>
			</SummaryCardGrid>
			<div className="grid grid-cols-2 gap-2">
				{props.protocolChains.length > 1 ? (
					<Panel className="col-span-full xl:col-span-1 xl:only:col-span-full">
						<DimensionProtocolChartByType
							chartType="chain"
							protocolName={slug(props.name)}
							protocolDisplayName={props.name}
							adapterType="aggregators"
							breakdownNames={props.protocolChains}
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
							title="DEX Aggregator Volume by chain"
						/>
					</Panel>
				) : null}
				{props.protocolVersions.length > 1 ? (
					<Panel className="col-span-full xl:col-span-1 xl:only:col-span-full">
						<DimensionProtocolChartByType
							chartType="version"
							protocolName={slug(props.name)}
							protocolDisplayName={props.name}
							adapterType="aggregators"
							breakdownNames={props.protocolVersions}
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
							title="DEX Aggregator Volume by protocol version"
						/>
					</Panel>
				) : null}
			</div>
		</ProtocolOverviewLayout>
	)
}
