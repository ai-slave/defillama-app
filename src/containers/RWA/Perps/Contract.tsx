import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartMetricsDialog } from '~/components/ChartMetricsDialog'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { BasicLink } from '~/components/Link'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Card } from '~/ui/Card'
import { ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { metricChipStyles } from '~/ui/MetricChip'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { Panel } from '~/ui/Panel'
import { SummaryChange } from '~/ui/SummaryStats'
import { Tooltip } from '~/ui/Tooltip'
import { formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { rwaSlug } from '../rwaSlug'
import { RWASuspiciousWarning } from '../SuspiciousWarning'
import {
	buildRWAPerpsContractChartSpec,
	buildRWAPerpsContractInfoRows,
	buildRWAPerpsContractMetricSections,
	RWA_PERPS_CONTRACT_CHART_METRICS,
	type RWAPerpsContractChartMetricConfig,
	type RWAPerpsContractChartMetricKey
} from './contractPageUtils'
import { perpsDefinitions as d } from './definitions'
import type { IRWAPerpsContractData } from './types'

// A chip leaves once its metric turns off, after the URL updates. Focus moves to the next chip, else the previous one,
// else the metrics button before the chips.
const focusNeighbourChipOnLeave = passFocusOnLeave((chip) => {
	const next = neighbourRowControl(chip, chip)
	return next?.querySelector<HTMLElement>('input') ?? next
})

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const normalizeChartGroup = (value: string | null | undefined): LowercaseDwmGrouping | null => {
	const normalizedValue = value?.toLowerCase() ?? null
	for (const option of DWM_GROUPING_OPTIONS_LOWERCASE) {
		if (option.value === normalizedValue) return option.value
	}
	return null
}

const resolveVisibility = ({
	queryValue,
	defaultEnabled
}: {
	queryValue: string | null
	defaultEnabled: boolean
}): 'true' | 'false' => {
	if (queryValue === 'true') return 'true'
	if (queryValue === 'false') return 'false'
	return defaultEnabled ? 'true' : 'false'
}

const getQueryValueOnRemove = (isDefaultEnabled: boolean): 'false' | null => (isDefaultEnabled ? 'false' : null)

export function getRWAPerpsContractChartGroup(value: string | null | undefined): LowercaseDwmGrouping {
	return normalizeChartGroup(value) ?? 'daily'
}

export function getRWAPerpsContractEnabledMetrics(
	searchParams: URLSearchParams
): Array<RWAPerpsContractChartMetricKey> {
	return RWA_PERPS_CONTRACT_CHART_METRICS.filter(
		(metric) =>
			resolveVisibility({
				queryValue: searchParams.get(metric.queryKey),
				defaultEnabled: metric.defaultEnabled
			}) === 'true'
	).map((metric) => metric.key)
}

export function getRWAPerpsContractMetricQueryPatch({
	metric,
	isActive
}: {
	metric: Pick<RWAPerpsContractChartMetricConfig, 'queryKey' | 'defaultEnabled'>
	isActive: boolean
}) {
	return {
		[metric.queryKey]: isActive ? (getQueryValueOnRemove(metric.defaultEnabled) ?? undefined) : 'true'
	}
}

export function getRWAPerpsContractGroupByQueryPatch(nextGroupBy: LowercaseDwmGrouping) {
	return {
		groupBy: nextGroupBy === 'daily' ? undefined : nextGroupBy
	}
}

function RWAPerpsContractHeader({
	contract,
	headingAs: Tag = 'h1'
}: {
	contract: IRWAPerpsContractData
	headingAs?: 'h1' | 'div'
}) {
	const link = contract.contract.link

	return (
		<Tag className="flex min-w-0 items-center gap-2 heading-xs">
			<span className="min-w-0 truncate">{contract.contract.contract}</span>
			{contract.market.suspicious ? <RWASuspiciousWarning entity="market" /> : null}
			{link ? (
				<WebsiteGlobeLink
					url={link}
					name={contract.contract.contract}
					event="rwa-perps-website-click"
					eventData={{ contract: contract.contract.contract }}
					size="sm"
					className="ml-auto"
				/>
			) : null}
		</Tag>
	)
}

function RWAPerpsContractPriceSummary({ contract }: { contract: IRWAPerpsContractData }) {
	return (
		<div className="flex flex-nowrap items-end justify-between gap-8">
			<div className="flex flex-col">
				<Tooltip content={d.price.description} className="text-secondary underline decoration-dotted">
					{d.price.label}
				</Tooltip>
				<p className="min-h-8 truncate mono-xl">
					{formatUsd(contract.market.price, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				</p>
			</div>

			{contract.market.priceChange24h != null ? (
				<SummaryChange percent={contract.market.priceChange24h} comparison="over 24h" />
			) : null}
		</div>
	)
}

export function RWAPerpsContractSummaryMetrics({ contract }: { contract: IRWAPerpsContractData }) {
	return (
		<>
			<RWAPerpsContractPriceSummary contract={contract} />
			<RWAPerpsContractMetricsList contract={contract} />
		</>
	)
}

function RWAPerpsContractMetricsList({ contract }: { contract: IRWAPerpsContractData }) {
	const sections = buildRWAPerpsContractMetricSections(contract)

	return (
		<div className="flex flex-col">
			<MetricRow
				label={sections.openInterest.label}
				tooltip={sections.openInterest.tooltip}
				value={sections.openInterest.value}
			/>

			<MetricSection
				label={sections.volume.label}
				tooltip={sections.volume.tooltip ?? null}
				value={sections.volume.value}
			>
				{sections.volume.children.map((row) => (
					<SubMetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={row.value} />
				))}
			</MetricSection>

			<MetricSection label={sections.fees.label} tooltip={sections.fees.tooltip ?? null} value={sections.fees.value}>
				{sections.fees.children.map((row) => (
					<SubMetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={row.value} />
				))}
			</MetricSection>

			{sections.pointInTimeRows.map((row) => (
				<MetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={row.value} />
			))}

			<MetricSection
				label={sections.tradingParameters.label}
				tooltip={sections.tradingParameters.tooltip ?? null}
				value={sections.tradingParameters.value}
			>
				{sections.tradingParameters.children.map((row) => (
					<SubMetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={row.value} />
				))}
			</MetricSection>

			<MetricSection
				label={sections.marketReference.label}
				tooltip={sections.marketReference.tooltip ?? null}
				value={sections.marketReference.value}
			>
				{sections.marketReference.children.map((row) => (
					<SubMetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={row.value} />
				))}
			</MetricSection>
		</div>
	)
}

function RWAPerpsContractInfoCard({ contract }: { contract: IRWAPerpsContractData }) {
	const infoRows = buildRWAPerpsContractInfoRows(contract)
	const midpoint = Math.ceil(infoRows.length / 2)
	const desktopInfoColumns = [infoRows.slice(0, midpoint), infoRows.slice(midpoint)].filter((rows) => rows.length > 0)
	const renderInfoRowValue = (row: (typeof infoRows)[number]) =>
		row.label === d.venue.label ? (
			<BasicLink href={`/rwa/perps/venue/${rwaSlug(row.value)}`} className="text-link hover:underline">
				{row.value}
			</BasicLink>
		) : row.label === d.baseAsset.label ? (
			<BasicLink href={`/rwa/perps/asset/${rwaSlug(row.value)}`} className="text-link hover:underline">
				{row.value}
			</BasicLink>
		) : row.label === 'Website' ? (
			<a
				href={row.value}
				target="_blank"
				rel="noopener noreferrer"
				className="text-link hover:underline"
				data-umami-event="rwa-perps-website-click"
				data-umami-event-contract={contract.contract.contract}
				data-umami-event-placement="info"
				data-umami-event-url={row.value}
			>
				{row.value}
			</a>
		) : (
			row.value
		)

	return (
		<Card as="section" padding="sm" className="col-span-full flex flex-col gap-2">
			<h2 className="label-lg">Market Information</h2>
			{contract.contract.description ? <p className="body-sm">{contract.contract.description}</p> : null}
			<div className="flex flex-col xl:hidden">
				{infoRows.map((row) => (
					<MetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={renderInfoRowValue(row)} />
				))}
			</div>
			<div className="hidden gap-x-6 xl:grid xl:grid-cols-2">
				{desktopInfoColumns.map((rows, index) => (
					// oxlint-disable-next-line react/no-array-index-key -- These positions identify layout columns; metric rows have their own keys.
					<div className="flex flex-col" key={`info-column-${index}`}>
						{rows.map((row) => (
							<MetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={renderInfoRowValue(row)} />
						))}
					</div>
				))}
			</div>
		</Card>
	)
}

function RWAPerpsContractChartPanel({ contract }: { contract: IRWAPerpsContractData }) {
	const router = useRouter()
	const searchParams = useMemo(() => {
		// Use the raw URL so chart controls reflect the current search string before router.query is hydrated.
		const queryString = router.asPath.split('?')[1]?.split('#')[0] ?? ''
		return new URLSearchParams(queryString)
	}, [router.asPath])
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const groupBy = getRWAPerpsContractChartGroup(searchParams.get('groupBy'))
	const enabledMetrics = useMemo(() => getRWAPerpsContractEnabledMetrics(searchParams), [searchParams])

	const chartSpec = useMemo(
		() => ({
			...buildRWAPerpsContractChartSpec({
				marketPoints: contract.marketChart,
				fundingHistory: contract.fundingHistory,
				groupBy,
				enabledMetrics
			}),
			// Deferred together with the rows, so labels and exports never pair old rows with a new grouping.
			groupBy
		}),
		[contract.fundingHistory, contract.marketChart, enabledMetrics, groupBy]
	)
	const deferredChartSpec = useDeferredValue(chartSpec)
	const hasChartData = deferredChartSpec.charts.some((chart) => chart.data && chart.data.length > 0)
	const contractSlugBase = contract.contract.contract.replace(/:/g, '-').toLowerCase()

	return (
		<div className="flex flex-col gap-2">
			<ChartPanelToolbar
				leading={
					<>
						<ChartMetricsDialog
							groups={[
								{
									label: 'Market',
									options: RWA_PERPS_CONTRACT_CHART_METRICS.map((metric) => ({
										key: metric.key,
										label: metric.label,
										color: metric.color,
										active: enabledMetrics.includes(metric.key),
										metric
									}))
								}
							]}
							onToggle={(option) =>
								void pushShallowQuery(
									router,
									getRWAPerpsContractMetricQueryPatch({ metric: option.metric, isActive: option.active })
								)
							}
							clear={{
								kind: 'clear',
								onClear: () => {
									const patch: Record<string, string | undefined> = {}
									for (const metric of RWA_PERPS_CONTRACT_CHART_METRICS) {
										if (enabledMetrics.includes(metric.key))
											Object.assign(patch, getRWAPerpsContractMetricQueryPatch({ metric, isActive: true }))
									}
									void pushShallowQuery(router, patch)
								}
							}}
						/>

						{enabledMetrics.map((metricKey) => {
							const metric = RWA_PERPS_CONTRACT_CHART_METRICS.find((item) => item.key === metricKey)
							if (!metric) return null

							return (
								<label
									ref={focusNeighbourChipOnLeave}
									className="relative flex cursor-pointer flex-nowrap items-center gap-1 label-sm"
									key={metric.key}
								>
									<input
										type="checkbox"
										value={metric.key}
										checked
										onChange={() => {
											void pushShallowQuery(router, getRWAPerpsContractMetricQueryPatch({ metric, isActive: true }))
										}}
										className="peer absolute size-[1em] opacity-[0.00001]"
									/>
									<span className={metricChipStyles} style={{ borderColor: metric.color }}>
										<span>{metric.label}</span>
										<Icon name="x" className="size-3.5" />
									</span>
								</label>
							)
						})}
					</>
				}
			>
				<ChartGroupingSelector
					value={groupBy}
					onValueChange={(nextGroupBy) => {
						void pushShallowQuery(router, getRWAPerpsContractGroupByQueryPatch(nextGroupBy))
					}}
					options={DWM_GROUPING_OPTIONS_LOWERCASE}
				/>
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={`${contractSlugBase}-market-metrics`}
					title={`${contract.contract.contract} Market Metrics`}
					smol
					csvSource={{
						type: 'dataset',
						prepare: () => ({ ...deferredChartSpec.dataset, groupBy: deferredChartSpec.groupBy })
					}}
				/>
			</ChartPanelToolbar>

			{hasChartData ? (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={deferredChartSpec.dataset}
						charts={deferredChartSpec.charts}
						hideDefaultLegend={false}
						groupBy={deferredChartSpec.groupBy}
						valueSymbol="$"
						onReady={handleChartReady}
					/>
				</Suspense>
			) : enabledMetrics.length === 0 ? (
				<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
					Select at least one metric.
				</ChartPanelBodyFallback>
			) : (
				<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
					No chart data available for the selected metrics.
				</ChartPanelBodyFallback>
			)}
		</div>
	)
}

export function RWAPerpsContractPage({ contract }: { contract: IRWAPerpsContractData }) {
	return (
		<article className="flex flex-col gap-2">
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<Card padding="sm" className="col-span-1 hidden flex-col gap-6 xl:flex xl:min-h-[360px]">
					<RWAPerpsContractHeader contract={contract} headingAs="h1" />
					<RWAPerpsContractSummaryMetrics contract={contract} />
				</Card>

				<div className="col-span-1 grid grid-cols-2 gap-2 xl:col-[2/-1]">
					<Panel padding="none" className="col-span-full">
						<div className="flex flex-col gap-6 p-2 xl:hidden">
							<RWAPerpsContractHeader contract={contract} headingAs="h1" />
							<RWAPerpsContractPriceSummary contract={contract} />
						</div>

						<RWAPerpsContractChartPanel contract={contract} />
					</Panel>

					<Card padding="sm" className="col-span-full flex flex-col gap-6 xl:hidden">
						<RWAPerpsContractMetricsList contract={contract} />
					</Card>
				</div>

				<RWAPerpsContractInfoCard contract={contract} />
			</div>
		</article>
	)
}
