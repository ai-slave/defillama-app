import type { GetStaticPropsContext } from 'next'
import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { Select } from '~/components/Select/Select'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import type { IAdapterChart } from '~/containers/AdapterMetrics/api.types'
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
	buildProtocolFeeChartPresentation,
	getProtocolFeeBreakdownPanels
} from '~/containers/ProtocolOverview/protocolFeeCharts'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelToolbar, ChartPanel, ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { FailedDataNote } from '~/ui/ScopeNote'
import { slug } from '~/utils'
import { buildHallmarksWithGenuineSpikes } from '~/utils/hallmarks'
import type { HallmarkPoint } from '~/utils/hallmarks'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

type ProtocolFeeChartName = 'Fees' | 'Revenue' | 'Holders Revenue'
type OptionalProtocolFeeMetric = Exclude<ProtocolFeeChartName, 'Fees'>

type OptionalAdapterOverviewResult = {
	data: Awaited<ReturnType<typeof getAdapterProtocolOverview>> | null
	failed: boolean
}

interface ProtocolFeesPageProps {
	name: string
	deprecated: boolean
	otherProtocols: Array<string>
	category: string | null
	metrics: IProtocolOverviewPageData['metrics']
	fees: NonNullable<IProtocolOverviewPageData['fees']>
	revenue: IProtocolOverviewPageData['revenue']
	holdersRevenue: IProtocolOverviewPageData['holdersRevenue']
	hasKeyMetrics: true
	openSmolStatsSummaryByDefault: true
	charts: {
		fees: IAdapterChart
		revenue: IAdapterChart
		holdersRevenue: IAdapterChart
	}
	defaultCharts: Array<ProtocolFeeChartName>
	protocolChains: Array<string>
	protocolRevenueChains: Array<string>
	protocolFeesVersions: Array<string>
	protocolRevenueVersions: Array<string>
	warningBanners: ReturnType<typeof getProtocolWarningBanners>
	defaultChartView: LowercaseDwmcGrouping
	hallmarks: Array<HallmarkPoint> | null
	seoTitle: string
	seoDescription: string
	failedMetrics: Array<OptionalProtocolFeeMetric>
}

const fetchOptionalAdapterProtocolOverview = async (
	enabled: boolean,
	params: Parameters<typeof getAdapterProtocolOverview>[0]
): Promise<OptionalAdapterOverviewResult> => {
	if (!enabled) return { data: null, failed: false }

	try {
		return { data: await getAdapterProtocolOverview(params), failed: false }
	} catch {
		return { data: null, failed: true }
	}
}

export const getStaticProps = withPerformanceLogging<ProtocolFeesPageProps, { protocol: string }>(
	'protocol/fees/[protocol]',
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
			hasMetric: (metadata) => Boolean(metadata.fees),
			metadataCache,
			protocol,
			routePrefix: 'protocol/fees'
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

		const [protocolData, feesData, revenueResult, holdersRevenueResult] = await Promise.all([
			fetchProtocolOverviewMetrics(canonicalProtocol),
			getAdapterProtocolOverview({
				adapterType: 'fees',
				protocol: protocolDisplayName,
				excludeTotalDataChart: false
			}),
			fetchOptionalAdapterProtocolOverview(!!metadata.revenue, {
				adapterType: 'fees',
				protocol: protocolDisplayName,
				excludeTotalDataChart: false,
				dataType: 'dailyRevenue'
			}),
			fetchOptionalAdapterProtocolOverview(!!metadata.holdersRevenue, {
				adapterType: 'fees',
				protocol: protocolDisplayName,
				excludeTotalDataChart: false,
				dataType: 'dailyHoldersRevenue'
			})
		])
		const revenueData = revenueResult.data
		const holdersRevenueData = holdersRevenueResult.data
		const failedMetrics: Array<OptionalProtocolFeeMetric> = []
		if (revenueResult.failed) failedMetrics.push('Revenue')
		if (holdersRevenueResult.failed) failedMetrics.push('Holders Revenue')

		const metrics = getProtocolMetricFlags({ protocolData, metadata })

		const fees = formatAdapterData({ data: feesData, methodologyKey: 'Fees' })
		const revenue = formatAdapterData({
			data: revenueData,
			methodologyKey: 'Revenue'
		})
		const holdersRevenue = formatAdapterData({
			data: holdersRevenueData,
			methodologyKey: 'HoldersRevenue'
		})
		const linkedProtocolVersions = getLinkedAdapterProtocolVersions({
			isParentProtocol: protocolData.isParentProtocol === true,
			linkedProtocols: feesData.linkedProtocols,
			protocolMetadata
		})
		const linkedProtocolsWithFeesData = getLinkedAdapterProtocolVersionNames({
			versions: linkedProtocolVersions,
			metric: 'fees'
		})
		const linkedProtocolsWithRevenueData = getLinkedAdapterProtocolVersionNames({
			versions: linkedProtocolVersions,
			metric: 'revenue'
		})

		const charts = {
			fees: feesData.totalDataChart,
			revenue: revenueData?.totalDataChart ?? [],
			holdersRevenue: holdersRevenueData?.totalDataChart ?? []
		}

		const defaultCharts: Array<ProtocolFeeChartName> = []

		if (charts.fees.length > 0) {
			defaultCharts.push('Fees')
		}

		if (charts.revenue.length > 0) {
			defaultCharts.push('Revenue')
		}

		if (charts.holdersRevenue.length > 0) {
			defaultCharts.push('Holders Revenue')
		}

		const hallmarks = buildHallmarksWithGenuineSpikes({
			dimensions: protocolData.dimensions
		})

		const seoTitle = `${protocolData.name} ${defaultCharts.join(', ')} - DefiLlama`
		const seoDescription = `Financial overview of ${protocolData.name} including ${defaultCharts.join(', ').toLowerCase()} with daily, weekly, monthly, and cumulative charts and historical data.`

		return {
			props: {
				name: protocolData.name,
				deprecated: protocolData.deprecated ?? false,
				otherProtocols: protocolData.otherProtocols ?? [],
				category: protocolData.category ?? null,
				metrics,
				fees,
				revenue,
				holdersRevenue,
				hasKeyMetrics: true,
				openSmolStatsSummaryByDefault: true,
				charts,
				defaultCharts,
				protocolChains: feesData.chains,
				protocolRevenueChains: revenueData?.chains ?? [],
				protocolFeesVersions: linkedProtocolsWithFeesData,
				protocolRevenueVersions: linkedProtocolsWithRevenueData,
				warningBanners: getProtocolWarningBanners(protocolData),
				defaultChartView:
					fees.defaultChartView ?? revenue?.defaultChartView ?? holdersRevenue?.defaultChartView ?? 'daily',
				hallmarks,
				seoTitle,
				seoDescription,
				failedMetrics
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

export default function Protocols(props: ProtocolFeesPageProps) {
	const [groupBy, setGroupBy] = useState<LowercaseDwmcGrouping>(props.defaultChartView)
	const [charts, setCharts] = useState<Array<string>>(props.defaultCharts)
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const finalCharts = useMemo(() => {
		return {
			...buildProtocolFeeChartPresentation({
				fees: props.charts.fees,
				revenue: props.charts.revenue,
				holdersRevenue: props.charts.holdersRevenue,
				selectedCharts: charts,
				groupBy
			}),
			// Deferred together with the rows, so labels and exports never pair old rows with a new grouping.
			groupBy
		}
	}, [props.charts, charts, groupBy])
	const deferredFinalCharts = useDeferredValue(finalCharts)

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="fees"
			warningBanners={props.warningBanners}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<Panel padding="md" className="col-span-1 gap-6 xl:min-h-[360px]">
					<h1 className="flex flex-wrap items-center gap-2 heading-sm">
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
							filename={`${props.name}-fees-revenue`}
							title={props.name}
							iconUrl={tokenIconUrl(props.name)}
							csvSource={{
								type: 'dataset',
								prepare: () => ({ ...deferredFinalCharts.dataset, groupBy: deferredFinalCharts.groupBy })
							}}
						/>
					</ChartPanelToolbar>
					<FailedDataNote labels={props.failedMetrics} shows="The chart shows the other metrics." />
					<Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={deferredFinalCharts.dataset}
							charts={deferredFinalCharts.charts}
							groupBy={deferredFinalCharts.groupBy}
							valueSymbol="$"
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
							onReady={handleChartReady}
						/>
					</Suspense>
				</ChartPanel>
			</div>
			<div className="grid grid-cols-2 gap-2">
				{getProtocolFeeBreakdownPanels(props).map((panel) => (
					<ChartPanel key={panel.title} className="col-span-full xl:col-span-1 xl:only:col-span-full">
						<DimensionProtocolChartByType
							chartType={panel.chartType}
							protocolName={slug(props.name)}
							protocolDisplayName={props.name}
							adapterType="fees"
							{...(panel.dataType ? { dataType: panel.dataType } : {})}
							breakdownNames={panel.breakdownNames}
							{...(props.hallmarks ? { hallmarks: props.hallmarks } : {})}
							title={panel.title}
						/>
					</ChartPanel>
				))}
			</div>
		</ProtocolOverviewLayout>
	)
}
