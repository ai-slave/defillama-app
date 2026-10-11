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
import { Select } from '~/components/Select/Select'
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
import {
	buildProtocolFlowChart,
	normalizeProtocolFlowChart,
	type ProtocolFlowChartSeries
} from '~/containers/ProtocolOverview/protocolFlowChart'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { CHART_FILL, ChartPanelToolbar } from '~/ui/ChartPanel'
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

type OptionsProtocolChartName = 'Premium Volume' | 'Notional Volume'

interface OptionsProtocolPageProps {
	name: string
	deprecated: boolean
	otherProtocols: Array<string>
	category: string | null
	metrics: IProtocolOverviewPageData['metrics']
	hasKeyMetrics: true
	openSmolStatsSummaryByDefault: true
	optionsPremiumVolume: IProtocolOverviewPageData['optionsPremiumVolume']
	optionsNotionalVolume: IProtocolOverviewPageData['optionsNotionalVolume']
	charts: Partial<Record<OptionsProtocolChartName, Array<TimePoint>>>
	defaultCharts: Array<OptionsProtocolChartName>
	protocolChains: Array<string>
	protocolVersions: Array<string>
	warningBanners: ReturnType<typeof getProtocolWarningBanners>
	hallmarks: Array<HallmarkPoint> | null
	defaultChartView: LowercaseDwmcGrouping
	seoTitle: string
	seoDescription: string
}

export const getStaticProps = withPerformanceLogging<OptionsProtocolPageProps, { protocol: string }>(
	'protocol/options/[protocol]',
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
			hasMetric: (metadata) => Boolean(metadata.optionsPremiumVolume || metadata.optionsNotionalVolume),
			metadataCache,
			protocol,
			routePrefix: 'protocol/options'
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

		const [protocolData, premiumVolumeData, notionalVolumeData] = await Promise.all([
			fetchProtocolOverviewMetrics(canonicalProtocol),
			metadata.optionsPremiumVolume
				? getAdapterProtocolOverview({
						adapterType: 'options',
						protocol: protocolDisplayName,
						excludeTotalDataChart: false
					}).catch(() => null)
				: null,
			metadata.optionsNotionalVolume
				? getAdapterProtocolOverview({
						adapterType: 'options',
						protocol: protocolDisplayName,
						excludeTotalDataChart: false,
						dataType: 'dailyNotionalVolume'
					}).catch(() => null)
				: null
		])

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const hallmarks = buildHallmarksWithGenuineSpikes({
			dimensions: protocolData.dimensions
		})

		const seoTitle = `${protocolData.name} Options Trading Volume - DefiLlama`
		const seoDescription = `Track ${protocolData.name} options premium and notional trading volume with historical charts on DefiLlama.`

		const optionsPremiumVolume = formatAdapterData({
			data: premiumVolumeData,
			methodologyKey: 'optionsPremiumVolume'
		})

		const optionsNotionalVolume = formatAdapterData({
			data: notionalVolumeData,
			methodologyKey: 'optionsNotionalVolume'
		})

		const linkedProtocolVersions = getLinkedAdapterProtocolVersions({
			isParentProtocol: protocolData.isParentProtocol === true,
			linkedProtocols: premiumVolumeData?.linkedProtocols,
			protocolMetadata
		})
		const protocolVersions = getLinkedAdapterProtocolVersionNames({
			versions: linkedProtocolVersions,
			metric: 'optionsPremiumVolume'
		})

		const charts: OptionsProtocolPageProps['charts'] = {}
		const defaultCharts: Array<OptionsProtocolChartName> = []
		if (premiumVolumeData && premiumVolumeData.totalDataChart.length > 0) {
			charts['Premium Volume'] = normalizeProtocolFlowChart(premiumVolumeData.totalDataChart)
			defaultCharts.push('Premium Volume')
		}
		if (notionalVolumeData && notionalVolumeData.totalDataChart.length > 0) {
			charts['Notional Volume'] = normalizeProtocolFlowChart(notionalVolumeData.totalDataChart)
			defaultCharts.push('Notional Volume')
		}

		return {
			props: {
				name: protocolData.name,
				deprecated: protocolData.deprecated ?? false,
				otherProtocols: protocolData.otherProtocols ?? [],
				category: protocolData.category ?? null,
				metrics,
				hasKeyMetrics: true,
				openSmolStatsSummaryByDefault: true,
				optionsPremiumVolume,
				optionsNotionalVolume,
				charts,
				defaultCharts,
				protocolChains: premiumVolumeData?.chains ?? [],
				protocolVersions,
				warningBanners: getProtocolWarningBanners(protocolData),
				hallmarks,
				defaultChartView: optionsPremiumVolume?.defaultChartView ?? optionsNotionalVolume?.defaultChartView ?? 'daily',
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

export default function Protocols(props: OptionsProtocolPageProps) {
	const [groupBy, setGroupBy] = useState<LowercaseDwmcGrouping>(props.defaultChartView)
	const [charts, setCharts] = useState<Array<string>>(props.defaultCharts)
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const finalCharts = useMemo(() => {
		const series: Array<ProtocolFlowChartSeries> = []

		const premiumVolumePoints = props.charts['Premium Volume']
		if (charts.includes('Premium Volume') && premiumVolumePoints) {
			series.push({
				name: 'Premium Volume',
				color: CHART_COLORS[0],
				stack: 'Premium Volume',
				points: premiumVolumePoints
			})
		}
		const notionalVolumePoints = props.charts['Notional Volume']
		if (charts.includes('Notional Volume') && notionalVolumePoints) {
			series.push({
				name: 'Notional Volume',
				color: CHART_COLORS[1],
				stack: 'Notional Volume',
				points: notionalVolumePoints
			})
		}
		return {
			...buildProtocolFlowChart({ groupBy, series }),
			// Deferred together with the rows, so labels and exports never pair old rows with a new grouping.
			groupBy
		}
	}, [charts, groupBy, props.charts])
	const deferredFinalCharts = useDeferredValue(finalCharts)

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="options"
			toggleOptions={EMPTY_TOGGLE_OPTIONS}
			warningBanners={props.warningBanners}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<SummaryCardGrid>
				<SummaryStatsCard padding="md" className="xl:min-h-[360px]">
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
						{props.defaultCharts.length > 1 ? (
							<Select
								allValues={props.defaultCharts}
								selectedValues={charts}
								setSelectedValues={setCharts}
								label="Charts"
								variant="filter"
								labelType="smol"
								size="md"
							/>
						) : null}
						<ChartExportButtons
							chartInstance={chartInstance}
							filename={`${props.name}-options-volume`}
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
							dataset={deferredFinalCharts.dataset}
							charts={deferredFinalCharts.charts}
							groupBy={deferredFinalCharts.groupBy}
							containerClassName={CHART_FILL}
							valueSymbol="$"
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
							onReady={handleChartReady}
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
							adapterType="options"
							breakdownNames={props.protocolChains}
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
							title="Options Premium Volume by chain"
						/>
					</Panel>
				) : null}
				{props.protocolVersions.length > 1 ? (
					<Panel className="col-span-full xl:col-span-1 xl:only:col-span-full">
						<DimensionProtocolChartByType
							chartType="version"
							protocolName={slug(props.name)}
							protocolDisplayName={props.name}
							adapterType="options"
							breakdownNames={props.protocolVersions}
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
							title="Options Premium Volume by protocol version"
						/>
					</Panel>
				) : null}
			</div>
		</ProtocolOverviewLayout>
	)
}
