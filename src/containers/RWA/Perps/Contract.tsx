import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/ChartGroupingSelector'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { PercentChange } from '~/components/PercentChange'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { metricChipStyles, metricOptionChipStyles } from '~/ui/MetricChip'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { Panel } from '~/ui/Panel'
import { Tooltip } from '~/ui/Tooltip'
import { formattedNum } from '~/utils'
import { pushShallowQuery } from '~/utils/routerQuery'
import { rwaSlug } from '../rwaSlug'
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

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

const normalizeChartGroup = (value: string | null | undefined): LowercaseDwmGrouping | null => {
	const normalizedValue = value?.toLowerCase() ?? null
	if (DWM_GROUPING_OPTIONS_LOWERCASE.some((option) => option.value === normalizedValue)) {
		return normalizedValue as LowercaseDwmGrouping
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

export function getRWAPerpsContractEnabledMetrics(searchParams: URLSearchParams): RWAPerpsContractChartMetricKey[] {
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
		<Tag className="flex min-w-0 items-center justify-between gap-2 heading-xs">
			<span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{contract.contract.contract}</span>
			{link ? (
				<Tooltip content="Open market website" placement="top">
					<a
						href={link}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={`Open ${contract.contract.contract} website`}
						className={`${buttonStyles({ variant: 'ghost', size: 'sm', square: true })} ml-auto`}
					>
						<Icon name="external-link" className="size-4" />
					</a>
				</Tooltip>
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
				<p className="min-h-8 overflow-hidden font-jetbrains text-2xl font-semibold text-ellipsis whitespace-nowrap">
					{formattedNum(contract.market.price, true)}
				</p>
			</div>

			{contract.market.priceChange24h != null ? (
				<p className="relative bottom-0.5 flex flex-nowrap items-center gap-2">
					<span className="overflow-hidden font-jetbrains text-ellipsis whitespace-nowrap">
						<PercentChange percent={contract.market.priceChange24h} fontWeight={600} />
					</span>
					<span className="text-secondary">24h</span>
				</p>
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

			<MetricSection label={sections.volume.label} tooltip={sections.volume.tooltip} value={sections.volume.value}>
				{sections.volume.children.map((row) => (
					<SubMetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={row.value} />
				))}
			</MetricSection>

			<MetricSection label={sections.fees.label} tooltip={sections.fees.tooltip} value={sections.fees.value}>
				{sections.fees.children.map((row) => (
					<SubMetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={row.value} />
				))}
			</MetricSection>

			{sections.pointInTimeRows.map((row) => (
				<MetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={row.value} />
			))}

			<MetricSection
				label={sections.tradingParameters.label}
				tooltip={sections.tradingParameters.tooltip}
				value={sections.tradingParameters.value}
			>
				{sections.tradingParameters.children.map((row) => (
					<SubMetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={row.value} />
				))}
			</MetricSection>

			<MetricSection
				label={sections.marketReference.label}
				tooltip={sections.marketReference.tooltip}
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
		) : row.label === 'Website' ? (
			<a href={row.value} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
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
	const metricsDialogStore = Ariakit.useDialogStore()
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const groupBy = getRWAPerpsContractChartGroup(searchParams.get('groupBy'))
	const enabledMetrics = useMemo(() => getRWAPerpsContractEnabledMetrics(searchParams), [searchParams])

	const chartSpec = useMemo(
		() =>
			buildRWAPerpsContractChartSpec({
				marketPoints: contract.marketChart,
				fundingHistory: contract.fundingHistory,
				groupBy,
				enabledMetrics
			}),
		[contract.fundingHistory, contract.marketChart, enabledMetrics, groupBy]
	)
	const deferredChartSpec = useDeferredValue(chartSpec)
	const contractSlugBase = contract.contract.contract.replace(/:/g, '-').toLowerCase()

	return (
		<div className="flex flex-col gap-2">
			<ChartPanelToolbar>
				<Ariakit.DialogProvider store={metricsDialogStore}>
					<Ariakit.DialogDisclosure className={buttonStyles({ size: 'md' })}>
						<span>Add Metrics</span>
						<Icon name="plus" className="size-3.5" />
					</Ariakit.DialogDisclosure>
					<Ariakit.Dialog className={dialogSurfaceStyles} unmountOnHide portal>
						<div className="flex items-center gap-2 border-b border-subtle p-2">
							<DialogHeading>Add metrics to chart</DialogHeading>
							<DialogCloseButton className="ml-auto" />
						</div>

						<div className="flex flex-wrap gap-2 p-2">
							{RWA_PERPS_CONTRACT_CHART_METRICS.map((metric) => {
								const isActive = enabledMetrics.includes(metric.key)
								return (
									<button
										key={`add-metric-${metric.key}`}
										onClick={() => {
											void pushShallowQuery(router, getRWAPerpsContractMetricQueryPatch({ metric, isActive })).then(
												() => {
													metricsDialogStore.toggle()
												}
											)
										}}
										data-active={isActive}
										className={metricOptionChipStyles}
									>
										<span>{metric.label}</span>
										{isActive ? <Icon name="x" className="size-3.5" /> : <Icon name="plus" className="size-3.5" />}
									</button>
								)
							})}
						</div>
					</Ariakit.Dialog>
				</Ariakit.DialogProvider>

				{enabledMetrics.map((metricKey) => {
					const metric = RWA_PERPS_CONTRACT_CHART_METRICS.find((item) => item.key === metricKey)
					if (!metric) return null

					return (
						<label
							className="relative flex cursor-pointer flex-nowrap items-center gap-1 label-sm last-of-type:mr-auto"
							key={metric.key}
						>
							<input
								type="checkbox"
								value={metric.key}
								checked={true}
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

				<div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
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
					/>
				</div>
			</ChartPanelToolbar>

			{deferredChartSpec.charts.length > 0 && deferredChartSpec.dataset.source.length > 0 ? (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart2
						dataset={deferredChartSpec.dataset}
						charts={deferredChartSpec.charts}
						hideDefaultLegend={false}
						groupBy={groupBy}
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
