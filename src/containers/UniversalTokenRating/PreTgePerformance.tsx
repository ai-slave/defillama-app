import type { EChartsOption } from 'echarts'
import { Panel } from '~/ui/Panel'
import { formatCompactNumber, formatNumber } from '~/utils/numberFormat'
import { ChartCaption, ChartLegend, SimpleChart, useChartAxisColor } from './SimpleChart'
import { GradeFooter, GradeFooterColumns, KvTable, NoDataPlaceholder } from './TokenPage'

const ROUND_COLOR = '#c0a03a'
const INVESTOR_QTY_COLOR = '#9C27B0'
const INVESTOR_USD_COLOR = '#4CAF50'

const MOCK_ROUNDS: [string, number][] = [
	['pre-Seed', 3_000_000],
	['Seed', 7_000_000],
	['Series A', 15_000_000],
	['Series B', 0],
	['Series C', 0]
]

const MOCK_INVESTOR_TIERS = [
	{ tier: 'Tier 1', quantity: 2, raisedUsd: 40_000_000 },
	{ tier: 'Tier 2', quantity: 5, raisedUsd: 60_000_000 },
	{ tier: 'Tier 3', quantity: 1, raisedUsd: 20_000_000 }
]

function buildRoundsOption(axisColor?: string): EChartsOption {
	return {
		grid: { left: 72, right: 24, top: 8, bottom: 24 },
		tooltip: {
			trigger: 'axis',
			valueFormatter: (value) => (typeof value === 'number' ? `$${formatNumber(value)}` : String(value ?? ''))
		},
		xAxis: {
			type: 'value',
			axisLabel: { color: axisColor, formatter: (value: number) => `$${formatCompactNumber(value)}` },
			splitLine: { lineStyle: { opacity: 0.3, type: 'dashed' } }
		},
		yAxis: {
			type: 'category',
			data: [...MOCK_ROUNDS.map(([round]) => round)].reverse(),
			axisLabel: { color: axisColor },
			splitLine: { show: false }
		},
		series: [
			{
				name: 'Capital Raised (USD)',
				type: 'bar',
				barCategoryGap: 10,
				itemStyle: { color: ROUND_COLOR },
				data: [...MOCK_ROUNDS.map(([, usd]) => usd)].reverse()
			}
		]
	}
}

function buildInvestorsOption(axisColor?: string): EChartsOption {
	return {
		grid: { left: 40, right: 56, top: 8, bottom: 24 },
		tooltip: { trigger: 'axis' },
		xAxis: {
			type: 'category',
			data: MOCK_INVESTOR_TIERS.map((entry) => entry.tier),
			axisLabel: { color: axisColor }
		},
		yAxis: [
			{
				type: 'value',
				axisLabel: { color: axisColor },
				splitLine: { lineStyle: { opacity: 0.3, type: 'dashed' } }
			},
			{
				type: 'value',
				axisLabel: { color: axisColor, formatter: (value: number) => `$${formatCompactNumber(value)}` },
				splitLine: { show: false }
			}
		],
		series: [
			{
				name: 'Quantity of Investors',
				type: 'bar',
				barCategoryGap: 16,
				barGap: '5%',
				itemStyle: { color: INVESTOR_QTY_COLOR },
				data: MOCK_INVESTOR_TIERS.map((entry) => entry.quantity)
			},
			{
				name: 'Amount raised (USD)',
				type: 'bar',
				yAxisIndex: 1,
				itemStyle: { color: INVESTOR_USD_COLOR },
				data: MOCK_INVESTOR_TIERS.map((entry) => entry.raisedUsd)
			}
		]
	}
}

function PreTgeCard({
	title,
	value,
	score,
	grade,
	columnsFooter,
	children
}: {
	title: string
	value?: string
	score: number | null
	grade?: string | null
	columnsFooter?: boolean
	children?: React.ReactNode
}) {
	return (
		<Panel padding="none">
			<div className={`flex flex-col gap-0.5 px-4 py-3 ${children ? 'border-b border-subtle' : ''}`}>
				<h3 className="body-sm text-secondary">{title}</h3>
				{value ? <span className="label-lg">{value}</span> : null}
			</div>
			{children ? <div className="flex flex-1 flex-col gap-3 p-4">{children}</div> : <div className="flex-1" />}
			{columnsFooter ? (
				<GradeFooterColumns score={score} grade={grade} percentile={score == null ? null : 85.28} />
			) : (
				<GradeFooter score={score} grade={grade} percentile={score == null ? null : 85.28} />
			)}
		</Panel>
	)
}

export function PreTgePerformance({ live = false }: { live?: boolean }) {
	const axisColor = useChartAxisColor()
	return (
		<>
			<h2 className="heading-sm">Performance Overview: Fundraising</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<PreTgeCard title="Total Amount Fundraised (by Round)" score={live ? null : 8.5} grade={live ? null : 'AA'}>
					{live ? (
						<NoDataPlaceholder />
					) : (
						<>
							<ChartCaption>Capital Raised (USD)</ChartCaption>
							<SimpleChart option={buildRoundsOption(axisColor)} className="h-[260px] w-full" />
						</>
					)}
					<div className="mt-auto">
						<KvTable rows={[['Aggregate Amount Fundraised ($)', live ? 'N/A' : `$${formatNumber(25_000_000)}`]]} />
					</div>
				</PreTgeCard>
				<PreTgeCard title="Quality of Investors (Tiers 1 - 3)" score={live ? null : 8.5} grade={live ? null : 'AAA'}>
					{live ? (
						<NoDataPlaceholder />
					) : (
						<>
							<ChartCaption>Quantity of Investors | Amount raised (USD)</ChartCaption>
							<SimpleChart option={buildInvestorsOption(axisColor)} className="h-[260px] w-full" />
							<ChartLegend
								items={[
									{ label: 'Quantity of Investors', color: INVESTOR_QTY_COLOR },
									{ label: 'Amount raised (USD)', color: INVESTOR_USD_COLOR }
								]}
							/>
						</>
					)}
					<div className="mt-auto">
						<KvTable
							rows={[
								['Percentage of Dollars Raised from Tier-1 Investors', live ? 'N/A' : `$${formatNumber(15_000_000)}`]
							]}
						/>
					</div>
				</PreTgeCard>
			</div>

			<h2 className="heading-sm">Performance Overview: Roadmap & Audibility</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<PreTgeCard
					title="Past Roadmap Items Achieved On-time"
					value={live ? 'N/A' : 'Yes'}
					score={live ? null : 7.8}
					grade={live ? null : 'BB'}
					columnsFooter
				/>
				<PreTgeCard
					title="Core software accessible by All"
					value={live ? 'N/A' : 'No'}
					score={live ? null : 7.8}
					grade={live ? null : 'BB'}
					columnsFooter
				/>
				<PreTgeCard
					title="Smart Contract Audits Made Public"
					value={live ? 'N/A' : 'Yes'}
					score={live ? null : 8.5}
					grade={live ? null : 'AA'}
					columnsFooter
				/>
			</div>

			<h2 className="heading-sm">Performance Overview: Commercial Performance</h2>
			<PreTgeCard
				title="Revenue Generated Relative to Peers"
				value={live ? 'N/A' : '$999,999'}
				score={live ? null : 8.5}
				grade={live ? null : 'AA'}
			/>

			<h2 className="heading-sm">Performance Overview: Community Engagement</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<PreTgeCard
					title="Community Interest & Distribution"
					value={live ? 'N/A' : '3:1'}
					score={live ? null : 8.5}
					grade={live ? null : 'AA'}
				/>
				<PreTgeCard
					title="Historical Community Retention"
					value={live ? 'N/A' : '$999,999,999'}
					score={live ? null : 8.5}
					grade={live ? null : 'AA'}
				/>
			</div>
		</>
	)
}
