import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
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
import { DimensionProtocolChartByType } from '~/containers/AdapterMetrics/ProtocolChart'
import { getAdapterProtocolOverview } from '~/containers/AdapterMetrics/queries'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { formatAdapterData } from '~/containers/ProtocolOverview/formatAdapterData'
import { KeyMetrics } from '~/containers/ProtocolOverview/KeyMetrics'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { buildProtocolFeeChartPresentation } from '~/containers/ProtocolOverview/protocolFeeCharts'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelToolbar, ChartPanel, ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { FailedDataPopover } from '~/ui/FailedDataPopover'
import { Panel } from '~/ui/Panel'
import { formattedNum, slug } from '~/utils'
import { buildHallmarksWithGenuineSpikes } from '~/utils/hallmarks'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

type OptionalAdapterOverviewResult = {
	data: Awaited<ReturnType<typeof getAdapterProtocolOverview>> | null
	failed: boolean
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

export const getStaticProps = withPerformanceLogging(
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
		const metadata = [protocolRoute.route.id, protocolRoute.route.metadata] as const
		const canonicalProtocol = protocolRoute.route.canonicalSlug

		const [protocolData, feesData, revenueResult, holdersRevenueResult] = await Promise.all([
			fetchProtocolOverviewMetrics(canonicalProtocol),
			getAdapterProtocolOverview({
				adapterType: 'fees',
				protocol: metadata[1].displayName,
				excludeTotalDataChart: false
			}),
			fetchOptionalAdapterProtocolOverview(!!metadata[1].revenue, {
				adapterType: 'fees',
				protocol: metadata[1].displayName,
				excludeTotalDataChart: false,
				dataType: 'dailyRevenue'
			}),
			fetchOptionalAdapterProtocolOverview(!!metadata[1].holdersRevenue, {
				adapterType: 'fees',
				protocol: metadata[1].displayName,
				excludeTotalDataChart: false,
				dataType: 'dailyHoldersRevenue'
			})
		])
		const revenueData = revenueResult.data
		const holdersRevenueData = holdersRevenueResult.data
		const failedMetrics: Array<string> = []
		if (revenueResult.failed) failedMetrics.push('Revenue')
		if (holdersRevenueResult.failed) failedMetrics.push('Holders Revenue')

		const metrics = getProtocolMetricFlags({ protocolData, metadata: metadata[1] })

		const fees: IProtocolOverviewPageData['fees'] = formatAdapterData({ data: feesData, methodologyKey: 'Fees' })
		const revenue: IProtocolOverviewPageData['revenue'] = formatAdapterData({
			data: revenueData,
			methodologyKey: 'Revenue'
		})
		const holdersRevenue: IProtocolOverviewPageData['holdersRevenue'] = formatAdapterData({
			data: holdersRevenueData,
			methodologyKey: 'HoldersRevenue'
		})
		const linkedProtocolsSet = new Set((feesData?.linkedProtocols ?? []).slice(1))
		const linkedProtocolsWithFeesData = []
		const linkedProtocolsWithRevenueData = []
		if (protocolData.isParentProtocol) {
			for (const key in protocolMetadata) {
				if (linkedProtocolsSet.size === 0) break
				if (linkedProtocolsSet.has(protocolMetadata[key].displayName)) {
					if (protocolMetadata[key].fees) {
						linkedProtocolsWithFeesData.push(protocolMetadata[key])
					}
					if (protocolMetadata[key].revenue) {
						linkedProtocolsWithRevenueData.push(protocolMetadata[key])
					}
					linkedProtocolsSet.delete(protocolMetadata[key].displayName)
				}
			}
		}

		const charts = {
			fees: feesData?.totalDataChart ?? [],
			revenue: revenueData?.totalDataChart ?? [],
			holdersRevenue: holdersRevenueData?.totalDataChart ?? []
		}

		const defaultCharts = []

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
				otherProtocols: protocolData?.otherProtocols ?? [],
				category: protocolData?.category ?? null,
				metrics,
				fees,
				revenue: revenueData && revenueData.totalAllTime ? revenue : null,
				holdersRevenue: holdersRevenueData && holdersRevenueData.totalAllTime ? holdersRevenue : null,
				hasKeyMetrics: true,
				openSmolStatsSummaryByDefault: true,
				charts,
				defaultCharts,
				protocolChains: feesData?.chains ?? [],
				protocolFeesVersions: linkedProtocolsWithFeesData?.map((versionProtocol) => versionProtocol.displayName) ?? [],
				protocolRevenueVersions:
					linkedProtocolsWithRevenueData?.map((versionProtocol) => versionProtocol.displayName) ?? [],
				warningBanners: getProtocolWarningBanners(protocolData),
				defaultChartView:
					fees?.defaultChartView ?? revenue?.defaultChartView ?? holdersRevenue?.defaultChartView ?? 'daily',
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

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const [groupBy, setGroupBy] = useState<LowercaseDwmcGrouping>(props.defaultChartView)
	const [charts, setCharts] = useState<string[]>(props.defaultCharts)
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const finalCharts = useMemo(() => {
		return buildProtocolFeeChartPresentation({
			fees: props.charts.fees,
			revenue: props.charts.revenue,
			holdersRevenue: props.charts.holdersRevenue,
			selectedCharts: charts,
			groupBy
		})
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
					<h1 className="flex flex-wrap items-center gap-2 text-xl">
						<TokenLogo name={props.name} kind="token" size={24} alt={`Logo of ${props.name}`} />
						<span className="font-bold">{props.name}</span>
						{props.deprecated ? <DeprecatedProtocolMarker size={16} /> : null}
					</h1>
					<KeyMetrics {...props} formatPrice={(value) => formattedNum(value, true)} />
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
							filename={`${props.name}-fees-revenue`}
							title={props.name}
							iconUrl={tokenIconUrl(props.name)}
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={deferredFinalCharts.dataset}
							charts={deferredFinalCharts.charts}
							groupBy={groupBy}
							valueSymbol="$"
							hallmarks={props.hallmarks ?? undefined}
							onReady={handleChartReady}
						/>
					</Suspense>
					<FailedProtocolFeeMetricsPopover failedMetrics={props.failedMetrics ?? []} />
				</ChartPanel>
			</div>
			<div className="grid grid-cols-2 gap-2">
				{props.protocolChains?.length > 1 ? (
					<ChartPanel className="col-span-full xl:col-span-1 xl:only:col-span-full">
						<DimensionProtocolChartByType
							chartType="chain"
							protocolName={slug(props.name)}
							protocolDisplayName={props.name}
							adapterType="fees"
							breakdownNames={props.protocolChains}
							hallmarks={props.hallmarks ?? undefined}
							title="Fees by chain"
						/>
					</ChartPanel>
				) : null}
				{props.protocolFeesVersions?.length > 1 ? (
					<ChartPanel className="col-span-full xl:col-span-1 xl:only:col-span-full">
						<DimensionProtocolChartByType
							chartType="version"
							protocolName={slug(props.name)}
							protocolDisplayName={props.name}
							adapterType="fees"
							breakdownNames={props.protocolFeesVersions}
							hallmarks={props.hallmarks ?? undefined}
							title="Fees by protocol version"
						/>
					</ChartPanel>
				) : null}
				{props.protocolRevenueVersions?.length > 1 ? (
					<>
						{props.protocolChains?.length > 1 ? (
							<ChartPanel className="col-span-full xl:col-span-1 xl:only:col-span-full">
								<DimensionProtocolChartByType
									chartType="chain"
									protocolName={slug(props.name)}
									protocolDisplayName={props.name}
									adapterType="fees"
									dataType="dailyRevenue"
									breakdownNames={props.protocolChains}
									hallmarks={props.hallmarks ?? undefined}
									title="Revenue by chain"
								/>
							</ChartPanel>
						) : null}

						<ChartPanel className="col-span-full xl:col-span-1 xl:only:col-span-full">
							<DimensionProtocolChartByType
								chartType="version"
								protocolName={slug(props.name)}
								protocolDisplayName={props.name}
								adapterType="fees"
								dataType="dailyRevenue"
								breakdownNames={props.protocolRevenueVersions}
								hallmarks={props.hallmarks ?? undefined}
								title="Revenue by protocol version"
							/>
						</ChartPanel>
					</>
				) : null}
			</div>
		</ProtocolOverviewLayout>
	)
}

function FailedProtocolFeeMetricsPopover({ failedMetrics }: { failedMetrics: Array<string> }) {
	return <FailedDataPopover items={failedMetrics} ariaLabel="Show failed metric APIs" />
}
