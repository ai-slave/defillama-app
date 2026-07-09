import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/ChartGroupingSelector'
import { ensureChronologicalRows, formatBarChart } from '~/components/ECharts/utils'
import { feesOptions } from '~/components/Filters/options'
import { Select } from '~/components/Select/Select'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { CHART_COLORS } from '~/constants/colors'
import { DimensionProtocolChartByType } from '~/containers/AdapterMetrics/ProtocolChart'
import { getAdapterProtocolOverview } from '~/containers/AdapterMetrics/queries'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { formatAdapterData } from '~/containers/ProtocolOverview/formatAdapterData'
import { KeyMetrics } from '~/containers/ProtocolOverview/KeyMetrics'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { mergeProtocolFeeExtraChartSeries } from '~/containers/ProtocolOverview/protocolFeeCharts'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import {
	FEE_EXTRA_CONFIG_BY_SETTING,
	FEE_EXTRA_CONFIGS,
	FEE_EXTRA_METRIC_LABEL,
	type FeeExtraConfig,
	type FeeExtraMetric
} from '~/metrics/feeExtras'
import { ChartPanelToolbar, ChartPanel, ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { FailedDataPopover } from '~/ui/FailedDataPopover'
import { Panel } from '~/ui/Panel'
import { formattedNum, slug } from '~/utils'
import { buildHallmarksWithGenuineSpikes } from '~/utils/hallmarks'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

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

const isProtocolFeeExtraMetadataEnabled = (metadata: IProtocolMetadata, extra: FeeExtraConfig) =>
	!!metadata[extra.protocolMetadataField]

const isProtocolFeeExtraMetricEnabled = (metrics: IProtocolOverviewPageData['metrics'], extra: FeeExtraConfig) =>
	!!metrics[extra.protocolMetricField]

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

		const [protocolData, feesData, revenueResult, holdersRevenueResult, bribeRevenueResult, tokenTaxResult] =
			await Promise.all([
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
				}),
				fetchOptionalAdapterProtocolOverview(
					isProtocolFeeExtraMetadataEnabled(metadata[1], FEE_EXTRA_CONFIG_BY_SETTING.bribes),
					{
						adapterType: 'fees',
						protocol: metadata[1].displayName,
						excludeTotalDataChart: false,
						dataType: FEE_EXTRA_CONFIG_BY_SETTING.bribes.dataType
					}
				),
				fetchOptionalAdapterProtocolOverview(
					isProtocolFeeExtraMetadataEnabled(metadata[1], FEE_EXTRA_CONFIG_BY_SETTING.tokentax),
					{
						adapterType: 'fees',
						protocol: metadata[1].displayName,
						excludeTotalDataChart: false,
						dataType: FEE_EXTRA_CONFIG_BY_SETTING.tokentax.dataType
					}
				)
			])
		const revenueData = revenueResult.data
		const holdersRevenueData = holdersRevenueResult.data
		const bribeRevenueData = bribeRevenueResult.data
		const tokenTaxData = tokenTaxResult.data
		const failedMetrics: Array<string | FeeExtraMetric> = []
		if (revenueResult.failed) failedMetrics.push('Revenue')
		if (holdersRevenueResult.failed) failedMetrics.push('Holders Revenue')
		const feeExtraResults = { bribes: bribeRevenueResult, tokentax: tokenTaxResult }
		for (const extra of FEE_EXTRA_CONFIGS) {
			if (feeExtraResults[extra.setting].failed) {
				failedMetrics.push(extra.dataType)
			}
		}

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
		const bribeRevenue: IProtocolOverviewPageData['bribeRevenue'] = formatAdapterData({
			data: bribeRevenueData,
			methodologyKey: FEE_EXTRA_CONFIG_BY_SETTING.bribes.methodologyKey
		})
		const tokenTax: IProtocolOverviewPageData['tokenTax'] = formatAdapterData({
			data: tokenTaxData,
			methodologyKey: FEE_EXTRA_CONFIG_BY_SETTING.tokentax.methodologyKey
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

		const bribesCharts: Record<string, number> = {}
		for (const [date, value] of bribeRevenueData?.totalDataChart ?? []) {
			bribesCharts[date] = value
		}
		const tokenTaxCharts: Record<string, number> = {}
		for (const [date, value] of tokenTaxData?.totalDataChart ?? []) {
			tokenTaxCharts[date] = value
		}

		const charts = {
			fees: feesData?.totalDataChart ?? [],
			revenue: revenueData?.totalDataChart ?? [],
			holdersRevenue: holdersRevenueData?.totalDataChart ?? [],
			bribeRevenue: bribeRevenueData && bribeRevenueData.totalAllTime ? bribesCharts : null,
			tokenTax: tokenTaxData && tokenTaxData.totalAllTime ? tokenTaxCharts : null
		}

		const defaultCharts = []

		if (
			charts.fees.length > 0 ||
			bribeRevenueData?.totalDataChart?.length > 0 ||
			tokenTaxData?.totalDataChart?.length > 0
		) {
			defaultCharts.push('Fees')
		}

		if (
			charts.revenue.length > 0 ||
			bribeRevenueData?.totalDataChart?.length > 0 ||
			tokenTaxData?.totalDataChart?.length > 0
		) {
			defaultCharts.push('Revenue')
		}

		if (
			charts.holdersRevenue.length > 0 ||
			bribeRevenueData?.totalDataChart?.length > 0 ||
			tokenTaxData?.totalDataChart?.length > 0
		) {
			defaultCharts.push('Holders Revenue')
		}

		const toggleOptions = feesOptions.filter((option) =>
			isProtocolFeeExtraMetricEnabled(metrics, FEE_EXTRA_CONFIG_BY_SETTING[option.key])
		)

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
				bribeRevenue: bribeRevenueData && bribeRevenueData.totalAllTime ? bribeRevenue : null,
				tokenTax: tokenTaxData && tokenTaxData.totalAllTime ? tokenTax : null,
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
					fees?.defaultChartView ??
					revenue?.defaultChartView ??
					holdersRevenue?.defaultChartView ??
					bribeRevenue?.defaultChartView ??
					tokenTax?.defaultChartView ??
					'daily',
				toggleOptions,
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
	const [feesSettings] = useLocalStorageSettingsManager('fees')
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const finalCharts = useMemo(() => {
		const includeBribes = !!(feesSettings.bribes && props.bribeRevenue?.totalAllTime)
		const includeTokenTax = !!(feesSettings.tokentax && props.tokenTax?.totalAllTime)
		const chartExtraOptions = {
			bribeRevenue: props.charts.bribeRevenue,
			tokenTax: props.charts.tokenTax,
			includeBribes,
			includeTokenTax
		}
		const feesChart = mergeProtocolFeeExtraChartSeries({ base: props.charts.fees, ...chartExtraOptions })
		const revenueChart = mergeProtocolFeeExtraChartSeries({ base: props.charts.revenue, ...chartExtraOptions })
		const holdersRevenueChart = mergeProtocolFeeExtraChartSeries({
			base: props.charts.holdersRevenue,
			...chartExtraOptions
		})

		const seriesType = (groupBy === 'cumulative' ? 'line' : 'bar') as 'line' | 'bar'
		const seriesData: Record<string, Array<[number, number]>> = {}
		const chartsConfig = []

		if (charts.includes('Fees')) {
			seriesData['Fees'] = formatBarChart({ data: feesChart, groupBy, denominationPriceHistory: null, dateInMs: false })
			chartsConfig.push({
				type: seriesType,
				name: 'Fees',
				encode: { x: 'timestamp', y: 'Fees' },
				color: CHART_COLORS[0],
				stack: 'Fees'
			})
		}
		if (charts.includes('Revenue')) {
			seriesData['Revenue'] = formatBarChart({
				data: revenueChart,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: false
			})
			chartsConfig.push({
				type: seriesType,
				name: 'Revenue',
				encode: { x: 'timestamp', y: 'Revenue' },
				color: CHART_COLORS[1],
				stack: 'Revenue'
			})
		}
		if (charts.includes('Holders Revenue')) {
			seriesData['Holders Revenue'] = formatBarChart({
				data: holdersRevenueChart,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: false
			})
			chartsConfig.push({
				type: seriesType,
				name: 'Holders Revenue',
				encode: { x: 'timestamp', y: 'Holders Revenue' },
				color: CHART_COLORS[2],
				stack: 'Holders Revenue'
			})
		}

		const rowMap = new Map<number, Record<string, number>>()
		const seriesNames: string[] = []
		for (const seriesName in seriesData) {
			seriesNames.push(seriesName)
		}
		for (const name of seriesNames) {
			for (const [timestamp, value] of seriesData[name]) {
				const row = rowMap.get(timestamp) ?? { timestamp }
				row[name] = value
				rowMap.set(timestamp, row)
			}
		}

		return {
			dataset: {
				source: ensureChronologicalRows(Array.from(rowMap.values())),
				dimensions: ['timestamp', ...seriesNames]
			},
			charts: chartsConfig
		}
	}, [props.charts, charts, feesSettings, groupBy, props.bribeRevenue?.totalAllTime, props.tokenTax?.totalAllTime])
	const deferredFinalCharts = useDeferredValue(finalCharts)

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="fees"
			warningBanners={props.warningBanners}
			toggleOptions={props.toggleOptions}
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
						<MultiSeriesChart2
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
							metadata={{
								bribeRevenue: !!props.bribeRevenue,
								tokenTax: !!props.tokenTax
							}}
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
							metadata={{
								bribeRevenue: !!props.bribeRevenue,
								tokenTax: !!props.tokenTax
							}}
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
									metadata={{
										bribeRevenue: props.metrics.bribes ?? false,
										tokenTax: props.metrics.tokenTax ?? false
									}}
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
								metadata={{
									bribeRevenue: props.metrics.bribes ?? false,
									tokenTax: props.metrics.tokenTax ?? false
								}}
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
	return (
		<FailedDataPopover
			items={failedMetrics}
			ariaLabel="Show failed metric APIs"
			getLabel={(metric) =>
				metric in FEE_EXTRA_METRIC_LABEL ? FEE_EXTRA_METRIC_LABEL[metric as FeeExtraMetric] : metric
			}
		/>
	)
}
