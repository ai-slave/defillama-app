import { lazy, startTransition, Suspense, useMemo, useState } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { Select } from '~/components/Select/Select'
import {
	TokenPageTable,
	TokenPageTableIncomeCell,
	TokenPageTableIncomeHeaderCell,
	TokenPageTableScroller,
	TokenPageTableShell
} from '~/components/Table/helpers'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { TagGroup } from '~/ui/SegmentedControl'
import { TableToolbarControlGroup } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { formatMonthYear } from '~/utils/dateFormat'
import { tokenIconUrl } from '~/utils/icons'
import { formatUsd, formatPercent } from '~/utils/numberFormat'
import { getOffchainCostDisclosure } from './offchainCosts'
import type { IProtocolOverviewPageData } from './types'

const SankeyChart = lazy(() => import('~/components/ECharts/SankeyChart'))

const incomeStatementGroupByOptions = ['Yearly', 'Quarterly', 'Monthly', 'Cumulative'] as const
const EMPTY_BREAKDOWN_LABELS: Array<string> = []
const EMPTY_BREAKDOWN_METHODOLOGY: Record<string, string> = {}

type IncomeStatementGroupBy = (typeof incomeStatementGroupByOptions)[number]
type IncomeStatementGroupKey = 'monthly' | 'quarterly' | 'yearly' | 'cumulative'
const incomeStatementGroupKeys = {
	Yearly: 'yearly',
	Quarterly: 'quarterly',
	Monthly: 'monthly',
	Cumulative: 'cumulative'
} satisfies Record<IncomeStatementGroupBy, IncomeStatementGroupKey>
type IncomeStatementDisplayMetric = { value: number; 'by-label'?: Record<string, number> }
type IncomeStatementDataType =
	| 'gross protocol revenue'
	| 'cost of revenue'
	| 'gross profit'
	| 'incentives'
	| 'earnings'
	| 'token holder net income'
	| 'others token holder flows'

const getPeriodHeader = (
	key: string,
	groupKey: IncomeStatementGroupKey,
	timestamp: number
): { key: string; label: string; timestamp: number } => ({
	key,
	label:
		groupKey === 'cumulative'
			? 'Total'
			: groupKey === 'monthly'
				? (formatMonthYear(key.length === 7 ? `${key}-01` : key) ?? key)
				: groupKey === 'quarterly'
					? key.split('-').reverse().join(' ')
					: key,
	timestamp
})

type IncomeStatementView = 'table' | 'sankey' | 'both'

interface IncomeStatementProps {
	name: string
	incomeStatement: NonNullable<IProtocolOverviewPageData['incomeStatement']>
	hasIncentives?: boolean
	view?: IncomeStatementView
	anchorId?: string
	className?: string
	showTitles?: boolean
	titleClassName?: string
	description?: string | undefined
}

const toCsvNumber = (value: number | null | undefined) => {
	if (value == null) return 0
	// avoid exporting noisy float precision (eg. 1.23400000000002)
	return Number.isInteger(value) ? value : Math.round(value * 1e8) / 1e8
}

export function IncomeStatement({
	name,
	incomeStatement,
	hasIncentives = false,
	view = 'both',
	anchorId,
	className,
	showTitles = true,
	titleClassName,
	description
}: IncomeStatementProps) {
	const [groupBy, setGroupBy] = useState<IncomeStatementGroupBy>('Quarterly')
	const [sankeyGroupBy, setSankeyGroupBy] = useState<IncomeStatementGroupBy>('Quarterly')
	const [selectedSankeyPeriod, setSelectedSankeyPeriod] = useState<string | null>(null)
	const { chartInstance: sankeyChartInstance, handleChartReady: handleSankeyChartReady } = useGetChartInstance()
	const headerId = anchorId ?? 'income-statement'
	const showTable = view === 'table' || view === 'both'
	const showSankey = view === 'sankey' || view === 'both'
	const offchainCosts = getOffchainCostDisclosure(name)

	const {
		tableHeaders,
		grossProtocolRevenueData,
		costOfRevenueData,
		grossProfitData,
		incentivesData,
		earningsData,
		tokenHolderNetIncomeData,
		othersTokenHolderFlowsData,
		grossProtocolRevenueByLabels,
		costOfRevenueByLabels,
		grossProfitByLabels,
		incentivesByLabels,
		tokenHolderNetIncomeByLabels,
		othersTokenHolderFlowsByLabels
	} = useMemo(() => {
		const groupKey = incomeStatementGroupKeys[groupBy]
		const tableHeaders: Array<[string, string, number]> = []
		const grossProtocolRevenueData: Record<string, IncomeStatementDisplayMetric> = {}
		const costOfRevenueData: Record<string, IncomeStatementDisplayMetric> = {}
		const grossProfitData: Record<string, IncomeStatementDisplayMetric> = {}
		const incentivesData: Record<string, IncomeStatementDisplayMetric> = {}
		const earningsData: Record<string, IncomeStatementDisplayMetric> = {}
		const tokenHolderNetIncomeData: Record<string, IncomeStatementDisplayMetric> = {}
		const othersTokenHolderFlowsData: Record<string, IncomeStatementDisplayMetric> = {}

		const groupData = incomeStatement.data[groupKey]
		for (const key in groupData) {
			const period = groupData[key]
			if (period === undefined) continue
			const periodData = period.values
			const header = getPeriodHeader(key, groupKey, period.timestamp)
			tableHeaders.push([header.key, header.label, header.timestamp])

			grossProtocolRevenueData[key] = periodData['Gross Protocol Revenue'] ?? {
				value: 0,
				'by-label': {}
			}

			costOfRevenueData[key] = periodData['Cost Of Revenue'] ?? {
				value: 0,
				'by-label': {}
			}

			grossProfitData[key] = periodData['Gross Profit'] ?? {
				value: 0,
				'by-label': {}
			}

			incentivesData[key] = periodData['Incentives'] ?? {
				value: 0,
				'by-label': {}
			}

			earningsData[key] = periodData['Earnings'] ?? {
				value: 0,
				'by-label': {}
			}

			tokenHolderNetIncomeData[key] = periodData['Token Holder Net Income'] ?? {
				value: 0,
				'by-label': {}
			}

			othersTokenHolderFlowsData[key] = periodData['Others Token Holder Flows'] ?? {
				value: 0,
				'by-label': {}
			}
		}

		return {
			tableHeaders: tableHeaders.sort((a, b) => b[2] - a[2]),
			grossProtocolRevenueData,
			costOfRevenueData,
			grossProfitData,
			incentivesData,
			earningsData,
			tokenHolderNetIncomeData,
			othersTokenHolderFlowsData,
			grossProtocolRevenueByLabels: incomeStatement.labelsByType['Gross Protocol Revenue'] ?? [],
			costOfRevenueByLabels: incomeStatement.labelsByType['Cost Of Revenue'] ?? [],
			grossProfitByLabels: incomeStatement.labelsByType['Gross Profit'] ?? [],
			incentivesByLabels: incomeStatement.labelsByType['Incentives'] ?? [],
			tokenHolderNetIncomeByLabels: incomeStatement.labelsByType['Token Holder Net Income'] ?? [],
			othersTokenHolderFlowsByLabels: incomeStatement.labelsByType['Others Token Holder Flows'] ?? []
		}
	}, [groupBy, incomeStatement])

	// Compute Sankey chart data for the selected period
	const { sankeyData, sankeyPeriodOptions, validSankeyPeriod } = useMemo(() => {
		const sankeyGroupKey = incomeStatementGroupKeys[sankeyGroupBy]
		const sankeyHeaders: Array<[string, string, number]> = []
		const sankeyGrossProtocolRevenueData: Record<string, IncomeStatementDisplayMetric> = {}
		const sankeyCostOfRevenueData: Record<string, IncomeStatementDisplayMetric> = {}
		const sankeyGrossProfitData: Record<string, IncomeStatementDisplayMetric> = {}
		const sankeyIncentivesData: Record<string, IncomeStatementDisplayMetric> = {}
		const sankeyEarningsData: Record<string, IncomeStatementDisplayMetric> = {}
		const sankeyTokenHolderNetIncomeData: Record<string, IncomeStatementDisplayMetric> = {}

		const sankeyGroupData = incomeStatement.data[sankeyGroupKey]
		for (const key in sankeyGroupData) {
			const period = sankeyGroupData[key]
			if (period === undefined) continue
			const periodData = period.values
			const header = getPeriodHeader(key, sankeyGroupKey, period.timestamp)
			sankeyHeaders.push([header.key, header.label, header.timestamp])

			sankeyGrossProtocolRevenueData[key] = periodData['Gross Protocol Revenue'] ?? { value: 0, 'by-label': {} }

			sankeyCostOfRevenueData[key] = periodData['Cost Of Revenue'] ?? {
				value: 0,
				'by-label': {}
			}

			sankeyGrossProfitData[key] = periodData['Gross Profit'] ?? {
				value: 0,
				'by-label': {}
			}

			sankeyIncentivesData[key] = periodData['Incentives'] ?? {
				value: 0,
				'by-label': {}
			}

			sankeyEarningsData[key] = periodData['Earnings'] ?? {
				value: 0,
				'by-label': {}
			}

			sankeyTokenHolderNetIncomeData[key] = periodData['Token Holder Net Income'] ?? {
				value: 0,
				'by-label': {}
			}
		}

		const sortedSankeyHeaders = sankeyHeaders.sort((a, b) => b[2] - a[2])
		const periodOptions = sortedSankeyHeaders.map((h) => ({ key: h[0], label: h[1] }))

		if (sortedSankeyHeaders.length === 0)
			return { sankeyData: { nodes: [], links: [] }, sankeyPeriodOptions: [], validSankeyPeriod: null }

		// Use selected period if it's valid for current grouping, otherwise default to most recent complete period (index 1, since 0 is incomplete)
		const validSelectedPeriod =
			selectedSankeyPeriod && sortedSankeyHeaders.some((h) => h[0] === selectedSankeyPeriod)
				? selectedSankeyPeriod
				: null
		const periodKey = validSelectedPeriod ?? sortedSankeyHeaders[1]?.[0] ?? sortedSankeyHeaders[0]?.[0]
		const periodLabel =
			sortedSankeyHeaders.find((h) => h[0] === periodKey)?.[1] ??
			sortedSankeyHeaders[1]?.[1] ??
			sortedSankeyHeaders[0]?.[1]
		if (!periodKey)
			return { sankeyData: { nodes: [], links: [] }, sankeyPeriodOptions: periodOptions, validSankeyPeriod: null }

		const grossProtocolRevenue = sankeyGrossProtocolRevenueData[periodKey]?.value ?? 0
		const costOfRevenue = sankeyCostOfRevenueData[periodKey]?.value ?? 0
		const grossProfit = sankeyGrossProfitData[periodKey]?.value ?? 0
		const incentives = sankeyIncentivesData[periodKey]?.value ?? 0
		const earnings = sankeyEarningsData[periodKey]?.value ?? 0
		const tokenHolderNetIncome = sankeyTokenHolderNetIncomeData[periodKey]?.value ?? 0

		// Get breakdown by labels for fees
		const grossProtocolRevenueByLabelData = sankeyGrossProtocolRevenueData[periodKey]?.['by-label'] ?? {}
		const costOfRevenueByLabelData = sankeyCostOfRevenueData[periodKey]?.['by-label'] ?? {}
		const incentivesByLabelData = sankeyIncentivesData[periodKey]?.['by-label'] ?? {}

		const nodes: Array<{
			name: string
			color?: string
			description?: string
			displayValue?: number | string
			depth?: number
			percentageLabel?: string
		}> = []
		const links: Array<{ source: string; target: string; value: number; color?: string }> = []

		// Colors: gray for neutral/input, green for profit, red for costs
		const COLORS = {
			gray: '#6b7280',
			green: '#22c55e',
			red: '#ef4444'
		}

		// Helper to format percentage
		const formatIncomePercent = (value: number, total: number) => {
			if (total === 0) return '0%'
			const pct = (value / total) * 100
			const absPct = Math.abs(pct)
			const sign = pct < 0 ? '-' : ''
			return absPct >= 1
				? `${sign}${formatPercent(absPct, { input: 'percent', maximumFractionDigits: 0, useGrouping: false })}`
				: absPct >= 0.1
					? `${sign}${formatPercent(absPct, { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
					: '<0.1%'
		}

		// Only add fee breakdown nodes if breakdown labels are available
		let hasGrossRevenueBreakdown = false
		for (const _ in grossProtocolRevenueByLabelData) {
			hasGrossRevenueBreakdown = true
			break
		}
		if (hasGrossRevenueBreakdown) {
			nodes.push({
				name: 'Gross Protocol Revenue',
				color: COLORS.gray,
				description: incomeStatement.methodology['Gross Protocol Revenue'] ?? '',
				displayValue: grossProtocolRevenue, // Show actual gross protocol revenue value, not sum of flows
				depth: 1
			})
			for (const label in grossProtocolRevenueByLabelData) {
				const value = grossProtocolRevenueByLabelData[label]
				if (value !== undefined && value > 0) {
					nodes.push({
						name: label,
						color: COLORS.gray,
						description: incomeStatement.breakdownMethodology['Gross Protocol Revenue']?.[label] ?? '',
						depth: 0,
						percentageLabel: formatIncomePercent(value, grossProtocolRevenue)
					})
					links.push({ source: label, target: 'Gross Protocol Revenue', value })
				}
			}
		} else if (grossProtocolRevenue > 0) {
			// No breakdown available, start from Gross Protocol Revenue directly
			nodes.push({
				name: 'Gross Protocol Revenue',
				color: COLORS.gray,
				description: incomeStatement.methodology['Gross Protocol Revenue'] ?? '',
				displayValue: grossProtocolRevenue, // Show actual gross protocol revenue value, not sum of flows
				depth: 1
			})
		}

		if (costOfRevenue > 0) {
			nodes.push({
				name: 'Cost of Revenue',
				color: COLORS.red,
				description: incomeStatement.methodology['Cost Of Revenue'] ?? '',
				displayValue: costOfRevenue, // Show actual cost of revenue value
				depth: 2,
				percentageLabel: formatIncomePercent(costOfRevenue, grossProtocolRevenue)
			})
			links.push({ source: 'Gross Protocol Revenue', target: 'Cost of Revenue', value: costOfRevenue })

			// Only add cost breakdown if labels are available
			let hasCostBreakdown = false
			for (const _ in costOfRevenueByLabelData) {
				hasCostBreakdown = true
				break
			}
			if (hasCostBreakdown) {
				for (const label in costOfRevenueByLabelData) {
					const value = costOfRevenueByLabelData[label]
					if (value !== undefined && value > 0) {
						const costLabel = `${label} (Cost)`
						nodes.push({
							name: costLabel,
							color: COLORS.red,
							description: incomeStatement.breakdownMethodology['Cost Of Revenue']?.[label] ?? '',
							depth: 3,
							percentageLabel: formatIncomePercent(value, costOfRevenue)
						})
						links.push({ source: 'Cost of Revenue', target: costLabel, value })
					}
				}
			}
		}

		if (grossProfit > 0) {
			const hasIncentivesData = incentives > 0 && hasIncentives

			nodes.push({
				name: 'Gross Profit',
				color: COLORS.green,
				description: incomeStatement.methodology['Gross Profit'] ?? '',
				displayValue: grossProfit, // Show actual revenue value
				depth: 2,
				percentageLabel: formatIncomePercent(grossProfit, grossProtocolRevenue)
			})
			links.push({ source: 'Gross Protocol Revenue', target: 'Gross Profit', value: grossProfit })

			if (hasIncentivesData) {
				// Incentives is at the same depth as Gross Profit so both flow horizontally into Earnings
				nodes.push({
					name: 'Incentives',
					color: COLORS.red,
					description: incomeStatement.methodology['Incentives'] ?? '',
					displayValue: incentives,
					depth: 2 // Same depth as Gross Profit
				})

				// Add incentives breakdown if labels are available (sources flow INTO Incentives)
				let hasIncentivesBreakdown = false
				for (const _ in incentivesByLabelData) {
					hasIncentivesBreakdown = true
					break
				}
				if (hasIncentivesBreakdown) {
					for (const label in incentivesByLabelData) {
						const value = incentivesByLabelData[label]
						if (value !== undefined && value > 0) {
							const incentiveLabel = `${label} (Incentive)`
							nodes.push({
								name: incentiveLabel,
								color: COLORS.red,
								description: incomeStatement.breakdownMethodology['Incentives']?.[label] ?? '',
								percentageLabel: formatIncomePercent(value, incentives)
							})
							links.push({ source: incentiveLabel, target: 'Incentives', value })
						}
					}
				}

				// Both Gross Profit and Incentives flow into Earnings
				nodes.push({
					name: 'Earnings',
					color: earnings >= 0 ? COLORS.green : COLORS.red,
					description: `Gross Profit (${formatUsd(grossProfit, { compact: true })}) minus Incentives (${formatUsd(incentives, { compact: true })})`,
					displayValue: earnings, // Show actual earnings value, not the sum of flows
					depth: 3,
					percentageLabel: formatIncomePercent(earnings, grossProfit)
				})

				// Gross Profit flows to Earnings (green)
				links.push({ source: 'Gross Profit', target: 'Earnings', value: grossProfit, color: COLORS.green })
				// Incentives flows to Earnings (red - as a cost being subtracted)
				links.push({ source: 'Incentives', target: 'Earnings', value: incentives, color: COLORS.red })

				if (earnings > 0 && tokenHolderNetIncome > 0) {
					nodes.push({
						name: 'Value Distributed to Token Holders',
						color: COLORS.green,
						description: incomeStatement.methodology['Token Holder Net Income'] ?? '',
						depth: 4,
						percentageLabel: formatIncomePercent(tokenHolderNetIncome, earnings)
					})
					links.push({ source: 'Earnings', target: 'Value Distributed to Token Holders', value: tokenHolderNetIncome })
				}
			} else if (earnings > 0) {
				// No incentives: Gross Profit flows directly to Earnings
				nodes.push({
					name: 'Earnings',
					color: COLORS.green,
					description: incomeStatement.methodology['Gross Profit'] ?? '',
					depth: 3,
					percentageLabel: formatIncomePercent(earnings, grossProfit)
				})
				links.push({ source: 'Gross Profit', target: 'Earnings', value: earnings })

				if (tokenHolderNetIncome > 0) {
					nodes.push({
						name: 'Value Distributed to Token Holders',
						color: COLORS.green,
						description: incomeStatement.methodology['Token Holder Net Income'] ?? '',
						depth: 4,
						percentageLabel: formatIncomePercent(tokenHolderNetIncome, earnings)
					})
					links.push({
						source: 'Earnings',
						target: 'Value Distributed to Token Holders',
						value: tokenHolderNetIncome
					})
				}
			}
		}

		return {
			sankeyData: { nodes, links, periodLabel },
			sankeyPeriodOptions: periodOptions,
			validSankeyPeriod: periodKey
		}
	}, [sankeyGroupBy, selectedSankeyPeriod, incomeStatement, hasIncentives])

	const { sankeyPeriodSelectOptions, sankeyPeriodLabel } = useMemo(() => {
		return {
			sankeyPeriodSelectOptions: sankeyPeriodOptions.map((option, idx) => ({
				key: option.key,
				name: idx === 0 ? `${option.label} *` : option.label
			})),
			sankeyPeriodLabel: sankeyPeriodOptions.find((o) => o.key === validSankeyPeriod)?.label ?? 'Select Period'
		}
	}, [sankeyPeriodOptions, validSankeyPeriod])

	const hasAnyBreakdownRows = Boolean(
		grossProtocolRevenueByLabels.length > 0 ||
		costOfRevenueByLabels.length > 0 ||
		offchainCosts != null ||
		grossProfitByLabels.length > 0 ||
		(hasIncentives && incentivesByLabels.length > 0) ||
		(incomeStatement.hasTokenHolderNetIncome && tokenHolderNetIncomeByLabels.length > 0) ||
		(incomeStatement.hasOtherTokenHolderFlows && othersTokenHolderFlowsByLabels.length > 0)
	)

	const prepareTableCsv = () => {
		const isCumulative = groupBy === 'Cumulative'
		// Match the rendered table header row: blank top-left cell, then the period labels.
		// (No need to include the "*" incomplete marker in CSV.)
		const headers = isCumulative ? ['Name', 'Total'] : ['', ...tableHeaders.map((h) => h[1])]
		const rows: Array<Array<string | number | boolean>> = [headers]

		const pushMetric = (
			metricLabel: string,
			metricData: Record<string, IncomeStatementDisplayMetric>,
			breakdownLabels: Array<string>
		) => {
			if (isCumulative) {
				const totalHeader = tableHeaders[0]?.[0]
				rows.push([metricLabel, toCsvNumber(totalHeader ? metricData[totalHeader]?.value : 0)])
			} else {
				rows.push([metricLabel, ...tableHeaders.map((h) => toCsvNumber(metricData[h[0]]?.value))])
			}

			if (breakdownLabels.length > 0) {
				for (const breakdownLabel of breakdownLabels) {
					if (isCumulative) {
						const totalHeader = tableHeaders[0]?.[0]
						rows.push([
							`  ${breakdownLabel}`,
							toCsvNumber(totalHeader ? metricData[totalHeader]?.['by-label']?.[breakdownLabel] : 0)
						])
					} else {
						rows.push([
							`  ${breakdownLabel}`,
							...tableHeaders.map((h) => toCsvNumber(metricData[h[0]]?.['by-label']?.[breakdownLabel]))
						])
					}
				}
			}
		}

		pushMetric('Gross Protocol Revenue', grossProtocolRevenueData, grossProtocolRevenueByLabels)
		pushMetric('Cost of Revenue', costOfRevenueData, costOfRevenueByLabels)
		pushMetric('Gross Profit', grossProfitData, grossProfitByLabels)
		if (hasIncentives) pushMetric('Incentives', incentivesData, incentivesByLabels)
		pushMetric('Earnings', earningsData, EMPTY_BREAKDOWN_LABELS)
		if (incomeStatement.hasTokenHolderNetIncome)
			pushMetric('Token Holder Net Income', tokenHolderNetIncomeData, tokenHolderNetIncomeByLabels)
		if (incomeStatement.hasOtherTokenHolderFlows)
			pushMetric('Others Token Holder Flows', othersTokenHolderFlowsData, othersTokenHolderFlowsByLabels)

		const safeProtocolName = name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')

		return {
			filename: `income-statement-${safeProtocolName || 'protocol'}-${groupBy.toLowerCase()}`,
			rows
		}
	}

	return (
		<Panel padding="sm" className={`col-span-full gap-4 ${className ?? ''}`}>
			<div className="flex flex-wrap items-center justify-between gap-2">
				{showTitles ? (
					<div>
						<h2 className={`group relative flex items-center gap-1 heading-xs ${titleClassName ?? ''}`} id={headerId}>
							Income Statement for {name}
							<a
								aria-hidden="true"
								tabIndex={-1}
								href={`#${headerId}`}
								className="absolute top-0 right-0 z-10 flex size-full items-center"
							/>
							<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
						</h2>
						{description ? <p className="mt-1 body-sm text-secondary">{description}</p> : null}
					</div>
				) : null}
				{showTable ? (
					<TableToolbarControlGroup className="ml-auto">
						<TagGroup
							variant="default"
							size="md"
							values={incomeStatementGroupByOptions}
							selectedValue={groupBy}
							setValue={(groupOption) => {
								startTransition(() => setGroupBy(groupOption))
							}}
							className="min-h-8"
						/>
						<CSVDownloadButton prepareCsv={prepareTableCsv} smol size="md" />
					</TableToolbarControlGroup>
				) : null}
			</div>
			{showTable ? (
				<TokenPageTableShell>
					<TokenPageTableScroller>
						<div className="pointer-events-none sticky left-0 z-0 h-0 w-full max-sm:hidden" style={{ top: '50%' }}>
							<img
								src="/assets/defillama-dark-neutral.webp"
								alt="defillama"
								height={53}
								width={155}
								className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 dark:hidden"
							/>
							<img
								src="/assets/defillama-light-neutral.webp"
								alt="defillama"
								height={53}
								width={155}
								className="absolute left-1/2 hidden -translate-x-1/2 -translate-y-1/2 opacity-30 dark:block"
							/>
						</div>
						<TokenPageTable
							separated
							className="z-10 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0"
						>
							<thead>
								<tr>
									<TokenPageTableIncomeHeaderCell sticky surface="app" className="min-w-[120px] font-semibold">
										{groupBy === 'Cumulative' ? 'Name' : null}
									</TokenPageTableIncomeHeaderCell>
									{tableHeaders.map((header, i) => (
										<TokenPageTableIncomeHeaderCell
											key={`${name}-${groupBy}-income-statement-${header[0]}`}
											surface="app"
											className="min-w-[120px] font-semibold"
											lastColumn={i === tableHeaders.length - 1}
										>
											{i === 0 && groupBy !== 'Cumulative' ? (
												<span className="-mr-2 flex items-center justify-start gap-1">
													<span className="truncate">{header[1]}</span>
													<Tooltip
														content={`Current ${groupBy.toLowerCase()} data is incomplete`}
														className="title-sm text-data-down"
													>
														*
													</Tooltip>
												</span>
											) : (
												header[1]
											)}
										</TokenPageTableIncomeHeaderCell>
									))}
								</tr>
							</thead>
							<tbody>
								<IncomeStatementByLabel
									protocolName={name}
									groupBy={groupBy}
									data={grossProtocolRevenueData}
									dataType="gross protocol revenue"
									label="Gross Protocol Revenue"
									methodology={incomeStatement.methodology['Gross Protocol Revenue'] ?? ''}
									tableHeaders={tableHeaders}
									breakdownByLabels={grossProtocolRevenueByLabels}
									breakdownMethodology={
										incomeStatement.breakdownMethodology['Gross Protocol Revenue'] ?? EMPTY_BREAKDOWN_METHODOLOGY
									}
									alignWithBreakdownRows={hasAnyBreakdownRows}
								/>
								<IncomeStatementByLabel
									protocolName={name}
									groupBy={groupBy}
									data={costOfRevenueData}
									dataType="cost of revenue"
									label="Cost of Revenue"
									methodology={incomeStatement.methodology['Cost Of Revenue'] ?? ''}
									tableHeaders={tableHeaders}
									breakdownByLabels={costOfRevenueByLabels}
									breakdownMethodology={
										incomeStatement.breakdownMethodology['Cost Of Revenue'] ?? EMPTY_BREAKDOWN_METHODOLOGY
									}
									unknownBreakdown={offchainCosts?.costOfRevenue}
									alignWithBreakdownRows={hasAnyBreakdownRows}
								/>
								<IncomeStatementByLabel
									protocolName={name}
									groupBy={groupBy}
									data={grossProfitData}
									dataType="gross profit"
									label="Gross Profit"
									methodology={incomeStatement.methodology['Gross Profit'] ?? ''}
									tableHeaders={tableHeaders}
									breakdownByLabels={grossProfitByLabels}
									breakdownMethodology={
										incomeStatement.breakdownMethodology['Gross Profit'] ?? EMPTY_BREAKDOWN_METHODOLOGY
									}
									alignWithBreakdownRows={hasAnyBreakdownRows}
								/>
								{hasIncentives ? (
									<IncomeStatementByLabel
										protocolName={name}
										groupBy={groupBy}
										data={incentivesData}
										dataType="incentives"
										label="Incentives"
										methodology={incomeStatement.methodology['Incentives'] ?? ''}
										tableHeaders={tableHeaders}
										breakdownByLabels={incentivesByLabels}
										breakdownMethodology={
											incomeStatement.breakdownMethodology['Incentives'] ?? EMPTY_BREAKDOWN_METHODOLOGY
										}
										alignWithBreakdownRows={hasAnyBreakdownRows}
									/>
								) : null}
								<IncomeStatementByLabel
									protocolName={name}
									groupBy={groupBy}
									data={earningsData}
									dataType="earnings"
									label="Earnings"
									methodology={[incomeStatement.methodology['Earnings'], offchainCosts?.earningsNote]
										.filter(Boolean)
										.join(' ')}
									tableHeaders={tableHeaders}
									breakdownByLabels={EMPTY_BREAKDOWN_LABELS}
									breakdownMethodology={EMPTY_BREAKDOWN_METHODOLOGY}
									alignWithBreakdownRows={hasAnyBreakdownRows}
								/>
								{incomeStatement.hasTokenHolderNetIncome ? (
									<IncomeStatementByLabel
										protocolName={name}
										groupBy={groupBy}
										data={tokenHolderNetIncomeData}
										dataType="token holder net income"
										label="Token Holder Net Income"
										methodology={incomeStatement.methodology['Token Holder Net Income'] ?? ''}
										tableHeaders={tableHeaders}
										breakdownByLabels={tokenHolderNetIncomeByLabels}
										breakdownMethodology={
											incomeStatement.breakdownMethodology['Token Holder Net Income'] ?? EMPTY_BREAKDOWN_METHODOLOGY
										}
										alignWithBreakdownRows={hasAnyBreakdownRows}
									/>
								) : null}
								{incomeStatement.hasOtherTokenHolderFlows ? (
									<IncomeStatementByLabel
										protocolName={name}
										groupBy={groupBy}
										data={othersTokenHolderFlowsData}
										dataType="others token holder flows"
										label="Others Token Holder Flows"
										methodology={incomeStatement.methodology['Others Token Holder Flows'] ?? ''}
										tableHeaders={tableHeaders}
										breakdownByLabels={othersTokenHolderFlowsByLabels}
										breakdownMethodology={
											incomeStatement.breakdownMethodology['Others Token Holder Flows'] ?? EMPTY_BREAKDOWN_METHODOLOGY
										}
										alignWithBreakdownRows={hasAnyBreakdownRows}
									/>
								) : null}
							</tbody>
						</TokenPageTable>
					</TokenPageTableScroller>
				</TokenPageTableShell>
			) : null}

			{showSankey ? (
				<div className={`border-subtle ${showTable ? 'border-t pt-4' : ''}`}>
					{sankeyData.nodes.length > 0 ? (
						<Suspense
							fallback={
								<div className="flex min-h-[450px] items-center justify-center body-sm text-tertiary">
									Loading chart...
								</div>
							}
						>
							<div className="mb-2 flex flex-wrap items-center gap-2 px-2">
								{showTitles ? <h3 className="mr-auto heading-xs">Income Flow Visualization</h3> : null}
								<TagGroup
									variant="default"
									size="md"
									values={incomeStatementGroupByOptions}
									selectedValue={sankeyGroupBy}
									setValue={(groupOption) => {
										startTransition(() => {
											setSankeyGroupBy(groupOption)
											setSelectedSankeyPeriod(null)
										})
									}}
									className="min-h-8"
								/>
								{sankeyGroupBy !== 'Cumulative' && sankeyPeriodSelectOptions.length > 0 ? (
									<Select
										heading="Period"
										allValues={sankeyPeriodSelectOptions}
										selectedValues={validSankeyPeriod ?? ''}
										setSelectedValues={(value: string) => startTransition(() => setSelectedSankeyPeriod(value))}
										label={sankeyPeriodLabel}
										labelType="none"
										variant="filter"
										size="md"
									/>
								) : null}
								<ChartPngExportButton
									chartInstance={sankeyChartInstance}
									filename={`${name}-income-statement`}
									title={`Income Statement for ${name}`}
									iconUrl={tokenIconUrl(name)}
								/>
							</div>
							<SankeyChart
								nodes={sankeyData.nodes}
								links={sankeyData.links}
								height={`${Math.max(450, sankeyData.nodes.length * 50)}px`}
								onReady={handleSankeyChartReady}
							/>
						</Suspense>
					) : (
						<div className="flex h-[200px] items-center justify-center body-sm text-tertiary">
							No data available for the selected period
						</div>
					)}
				</div>
			) : null}
		</Panel>
	)
}

function IncomeStatementByLabel({
	protocolName,
	groupBy,
	data,
	dataType,
	label,
	methodology,
	tableHeaders,
	breakdownByLabels,
	breakdownMethodology,
	unknownBreakdown,
	alignWithBreakdownRows
}: {
	protocolName: string
	groupBy: IncomeStatementGroupBy
	data: Record<string, IncomeStatementDisplayMetric>
	dataType: IncomeStatementDataType
	label: string
	methodology: string
	tableHeaders: Array<[string, string, number]>
	breakdownByLabels: Array<string>
	breakdownMethodology: Record<string, string>
	// label -> explanation, for costs we know exist but can't measure onchain
	unknownBreakdown?: Record<string, string> | undefined
	alignWithBreakdownRows: boolean
}) {
	const isEarnings = dataType === 'earnings'
	const hasBreakdownRows = breakdownByLabels.length > 0 || unknownBreakdown != null
	const showComparison = groupBy !== 'Cumulative'
	const [isExpanded, setIsExpanded] = useState(true)
	const getBreakdownValue = (header: [string, string, number] | undefined, breakdownLabel: string) => {
		if (!header) return null
		const period = data[header[0]]
		if (!period) return null
		return period['by-label']?.[breakdownLabel] ?? 0
	}
	return (
		<>
			<tr className="group">
				<TokenPageTableIncomeHeaderCell sticky className="w-[36%] font-semibold group-hover:bg-hover-row">
					{/* No handler here: the label can be a tooltip anchor, which cannot live inside the
					    disclosure button, so the chevron is the only control. */}
					<div className="flex items-center gap-1">
						{hasBreakdownRows ? (
							<button
								type="button"
								aria-expanded={isExpanded}
								aria-label={`${isExpanded ? 'Hide' : 'Show'} ${label} breakdown`}
								onClick={(e) => {
									e.stopPropagation()
									setIsExpanded((expanded) => !expanded)
								}}
								className="-ml-1 flex size-5 shrink-0 items-center justify-center rounded-sm text-secondary transition-transform hover:bg-hover-row focus-visible:bg-hover-row"
							>
								<Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} height={14} width={14} />
							</button>
						) : alignWithBreakdownRows ? (
							<span aria-hidden="true" className="-ml-1 block size-5 shrink-0" />
						) : null}
						{methodology ? (
							<Tooltip
								content={methodology}
								className="flex items-center justify-start gap-1 underline decoration-current decoration-dotted"
							>
								{label}
								<Icon name="help-circle" height={14} width={14} className="relative top-0.25 shrink-0" />
							</Tooltip>
						) : (
							<>{label}</>
						)}
					</div>
				</TokenPageTableIncomeHeaderCell>
				{tableHeaders.map((header, i) => {
					const currentValue = data[header[0]]?.value
					const previousHeader = tableHeaders[i + 1]
					const previousValue = previousHeader ? (data[previousHeader[0]]?.value ?? null) : null
					return (
						<TokenPageTableIncomeCell
							key={`${protocolName}-${groupBy}-${dataType}-${header[0]}`}
							lastColumn={i === tableHeaders.length - 1}
							className={`font-medium group-hover:bg-hover-row ${isEarnings ? (currentValue !== undefined && currentValue >= 0 ? 'text-data-up' : 'text-data-down') : ''}`}
						>
							{currentValue === undefined ? null : showComparison && i !== 0 && previousHeader ? (
								<Tooltip
									content={
										<PerformanceTooltipContent
											currentValue={currentValue}
											previousValue={previousValue}
											groupBy={groupBy}
											dataType={dataType}
										/>
									}
									className={`justify-start underline decoration-dotted ${isEarnings ? (currentValue >= 0 ? 'decoration-data-up/60' : 'decoration-data-down/60') : 'decoration-current'}`}
								>
									{formatUsd(currentValue, { compact: true })}
								</Tooltip>
							) : (
								<>{formatUsd(currentValue, { compact: true })}</>
							)}
						</TokenPageTableIncomeCell>
					)
				})}
			</tr>
			{hasBreakdownRows && isExpanded ? (
				<>
					{breakdownByLabels.map((breakdownlabel) => (
						<tr key={`${protocolName}-${groupBy}-${dataType}-${breakdownlabel}`} className="group text-secondary">
							<TokenPageTableIncomeHeaderCell
								sticky
								className="w-[36%] pl-9 font-normal italic group-hover:bg-hover-row"
							>
								{breakdownMethodology[breakdownlabel] ? (
									<Tooltip
										content={breakdownMethodology[breakdownlabel]}
										className="flex justify-start underline decoration-current decoration-dotted"
									>
										{breakdownlabel}
									</Tooltip>
								) : (
									<>{breakdownlabel}</>
								)}
							</TokenPageTableIncomeHeaderCell>
							{tableHeaders.map((header, i) => (
								<TokenPageTableIncomeCell
									key={`${protocolName}-${groupBy}-${dataType}-by-label-${breakdownlabel}-${header[0]}`}
									lastColumn={i === tableHeaders.length - 1}
									className="font-normal group-hover:bg-hover-row"
								>
									{getBreakdownValue(header, breakdownlabel) == null ? null : i !== 0 &&
									  showComparison &&
									  tableHeaders[i + 1] &&
									  getBreakdownValue(tableHeaders[i + 1], breakdownlabel) != null ? (
										<Tooltip
											content={
												<PerformanceTooltipContent
													currentValue={getBreakdownValue(header, breakdownlabel) ?? null}
													previousValue={getBreakdownValue(tableHeaders[i + 1], breakdownlabel) ?? null}
													groupBy={groupBy}
													dataType={dataType}
													label={breakdownlabel}
												/>
											}
											className="justify-start underline decoration-current decoration-dotted"
										>
											{formatUsd(getBreakdownValue(header, breakdownlabel), { compact: true })}
										</Tooltip>
									) : (
										<>{formatUsd(getBreakdownValue(header, breakdownlabel), { compact: true })}</>
									)}
								</TokenPageTableIncomeCell>
							))}
						</tr>
					))}
					{unknownBreakdown
						? Object.entries(unknownBreakdown).map(([unknownLabel, explanation]) => (
								<tr
									key={`${protocolName}-${groupBy}-${dataType}-unknown-${unknownLabel}`}
									className="group text-secondary"
								>
									<TokenPageTableIncomeHeaderCell
										sticky
										className="w-[36%] pl-9 font-normal italic group-hover:bg-hover-row"
									>
										<Tooltip
											content={explanation}
											className="flex justify-start underline decoration-current decoration-dotted"
										>
											{unknownLabel}
										</Tooltip>
									</TokenPageTableIncomeHeaderCell>
									{tableHeaders.map((header, i) => (
										<TokenPageTableIncomeCell
											key={`${protocolName}-${groupBy}-${dataType}-unknown-${unknownLabel}-${header[0]}`}
											lastColumn={i === tableHeaders.length - 1}
											className="font-normal text-tertiary group-hover:bg-hover-row"
										>
											Unknown
										</TokenPageTableIncomeCell>
									))}
								</tr>
							))
						: null}
				</>
			) : null}
		</>
	)
}

function PerformanceTooltipContent({
	currentValue,
	previousValue,
	groupBy,
	dataType,
	label
}: {
	currentValue: number | null
	previousValue: number | null
	groupBy: IncomeStatementGroupBy
	dataType: IncomeStatementDataType
	label?: string
}) {
	if (previousValue == null || currentValue == null) return null
	const valueChange = currentValue - previousValue
	const percentageChange = previousValue !== 0 ? (valueChange / Math.abs(previousValue)) * 100 : 0
	const percentageChangeText = formatPercent(percentageChange, {
		input: 'percent',
		signDisplay: 'exceptZero'
	})
	const displayLabel = label ? label.toLowerCase() : dataType
	return (
		<p className="body-sm">
			<span className={percentageChange > 0 ? 'text-data-up' : 'text-data-down'}>{`${percentageChangeText}`}</span>{' '}
			<span>
				compared to previous {groupBy === 'Yearly' ? 'year' : groupBy === 'Quarterly' ? 'quarter' : 'month'} total{' '}
				{displayLabel}
			</span>
		</p>
	)
}
