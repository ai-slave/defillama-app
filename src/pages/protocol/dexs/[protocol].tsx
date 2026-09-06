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
import { formatAdapterData, getAdapterMethodology } from '~/containers/ProtocolOverview/formatAdapterData'
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
import { ChartPanelToolbar, ChartPanel, ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
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

type DexProtocolChartName = 'DEX Volume' | 'Notional Volume'

interface DexProtocolPageProps {
	name: string
	deprecated: boolean
	otherProtocols: Array<string>
	category: string | null
	metrics: IProtocolOverviewPageData['metrics']
	hasKeyMetrics: true
	openSmolStatsSummaryByDefault: true
	dexVolume: IProtocolOverviewPageData['dexVolume']
	dexNotionalVolume: IProtocolOverviewPageData['dexNotionalVolume']
	charts: Partial<Record<DexProtocolChartName, Array<TimePoint>>>
	defaultCharts: Array<DexProtocolChartName>
	protocolChains: Array<string>
	protocolVersions: Array<string>
	warningBanners: ReturnType<typeof getProtocolWarningBanners>
	hallmarks: Array<HallmarkPoint> | null
	defaultChartView: LowercaseDwmcGrouping
	seoTitle: string
	seoDescription: string
}

export const getStaticProps = withPerformanceLogging<DexProtocolPageProps, { protocol: string }>(
	'protocol/dexs/[protocol]',
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
			hasMetric: (metadata) => Boolean(metadata.dexs || metadata.dexsNotionalVolume),
			metadataCache,
			protocol,
			routePrefix: 'protocol/dexs'
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

		const [protocolData, volumeData, notionalVolumeData] = await Promise.all([
			fetchProtocolOverviewMetrics(canonicalProtocol),
			metadata.dexs
				? getAdapterProtocolOverview({
						adapterType: 'dexs',
						protocol: protocolDisplayName,
						excludeTotalDataChart: false
					}).catch(() => null)
				: null,
			metadata.dexsNotionalVolume
				? getAdapterProtocolOverview({
						adapterType: 'dexs',
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

		const seoTitle = `${protocolData.name} DEX Trading Volume & Stats - DefiLlama`
		const seoDescription = `Track ${protocolData.name} decentralized exchange trading volume with daily, weekly, and cumulative charts on DefiLlama.`

		const dexVolume = formatAdapterData({
			data: volumeData,
			methodologyKey: getAdapterMethodology(volumeData?.methodology ?? null, 'Volume') ? 'Volume' : 'dexs'
		})

		const dexNotionalVolume = formatAdapterData({
			data: notionalVolumeData,
			methodologyKey: 'dexsNotionalVolume'
		})

		const linkedProtocolVersions = getLinkedAdapterProtocolVersions({
			isParentProtocol: protocolData.isParentProtocol === true,
			linkedProtocols: volumeData?.linkedProtocols,
			protocolMetadata
		})
		const protocolVersions = getLinkedAdapterProtocolVersionNames({
			versions: linkedProtocolVersions,
			metric: 'dexs'
		})

		const charts: DexProtocolPageProps['charts'] = {}
		const defaultCharts: Array<DexProtocolChartName> = []
		if (volumeData && volumeData.totalDataChart.length > 0) {
			charts['DEX Volume'] = normalizeProtocolFlowChart(volumeData.totalDataChart)
			defaultCharts.push('DEX Volume')
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
				dexVolume,
				dexNotionalVolume,
				charts,
				defaultCharts,
				protocolChains: volumeData?.chains ?? [],
				protocolVersions,
				warningBanners: getProtocolWarningBanners(protocolData),
				hallmarks,
				defaultChartView: dexVolume?.defaultChartView ?? dexNotionalVolume?.defaultChartView ?? 'daily',
				seoTitle,
				seoDescription
			},
			revalidate: maxAgeForNext([22])
		}
	}
)

export const getStaticPaths = () => {
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	return { paths: [], fallback: 'blocking' }
}

export default function Protocols(props: DexProtocolPageProps) {
	const [groupBy, setGroupBy] = useState<LowercaseDwmcGrouping>(props.defaultChartView)
	const [charts, setCharts] = useState<Array<string>>(props.defaultCharts)
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const finalCharts = useMemo(() => {
		const series: Array<ProtocolFlowChartSeries> = []

		const dexVolumePoints = props.charts['DEX Volume']
		if (charts.includes('DEX Volume') && dexVolumePoints) {
			series.push({
				name: 'DEX Volume',
				color: CHART_COLORS[0],
				stack: 'DEX Volume',
				points: dexVolumePoints
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
		return buildProtocolFlowChart({ groupBy, series })
	}, [charts, groupBy, props.charts])
	const deferredFinalCharts = useDeferredValue(finalCharts)

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="dexs"
			warningBanners={props.warningBanners}
			toggleOptions={EMPTY_TOGGLE_OPTIONS}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<Panel padding="md" className="col-span-1 gap-6 xl:min-h-[360px]">
					<h1 className="flex flex-wrap items-center gap-2 text-xl">
						<TokenLogo name={props.name} kind="token" size={24} alt={`Logo of ${props.name}`} />
						<span className="font-bold">{props.name}</span>
						{props.deprecated ? <DeprecatedProtocolMarker size={16} /> : null}
					</h1>
					<KeyMetrics
						{...props}
						isOracleProtocol={false}
						oracleTvs={null}
						formatPrice={(value) =>
							formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						}
					/>
				</Panel>
				<ChartPanel className="col-span-1 xl:col-[2/-1]">
					<ChartPanelToolbar className="justify-end">
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
							filename={`${props.name}-dex-volume`}
							title={props.name}
							iconUrl={tokenIconUrl(props.name)}
							csvSource={{ type: 'dataset', prepare: () => deferredFinalCharts.dataset }}
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={deferredFinalCharts.dataset}
							charts={deferredFinalCharts.charts}
							groupBy={groupBy}
							valueSymbol="$"
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
							onReady={handleChartReady}
						/>
					</Suspense>
				</ChartPanel>
			</div>
			<div className="grid grid-cols-2 gap-2">
				{props.protocolChains.length > 1 ? (
					<ChartPanel className="col-span-full xl:col-span-1 xl:only:col-span-full">
						<DimensionProtocolChartByType
							chartType="chain"
							protocolName={slug(props.name)}
							protocolDisplayName={props.name}
							adapterType="dexs"
							breakdownNames={props.protocolChains}
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
							title="DEX Volume by chain"
						/>
					</ChartPanel>
				) : null}
				{props.protocolVersions.length > 1 ? (
					<ChartPanel className="col-span-full xl:col-span-1 xl:only:col-span-full">
						<DimensionProtocolChartByType
							chartType="version"
							protocolName={slug(props.name)}
							protocolDisplayName={props.name}
							adapterType="dexs"
							breakdownNames={props.protocolVersions}
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
							title="DEX Volume by protocol version"
						/>
					</ChartPanel>
				) : null}
			</div>
		</ProtocolOverviewLayout>
	)
}
