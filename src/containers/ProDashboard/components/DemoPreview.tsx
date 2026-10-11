import { useRouter } from 'next/router'
import * as React from 'react'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { formatUsd } from '~/utils/numberFormat'
import type { ChartConfig, MultiChartConfig, TextConfig } from '../types'
import { getProDashboardChartTypeConfig } from '../types'
import { getChartEntityKey, getDashboardEntityColors, getMultiChartSeriesColors } from '../utils/colorManager'
import { buildMultiChartSeriesView, type MultiChartInputSeries } from './multiChartSeries'
import { TextCard } from './TextCard'
import UnifiedTable from './UnifiedTable'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const DEMO_CHAINS = ['Ethereum']

const generateFakeChartData = (baseValue: number, volatility = 0.1): MultiSeriesChartDataset['source'] => {
	const data = new Array<MultiSeriesChartDataset['source'][number]>(90)
	const now = new Date()
	let currentValue = baseValue

	for (let i = 89, dataIndex = 0; i >= 0; i--, dataIndex++) {
		const date = new Date(now)
		date.setDate(date.getDate() - i)
		const change = (Math.random() - 0.5) * 2 * volatility * currentValue
		currentValue = Math.max(0, currentValue + change)

		if (i > 60) currentValue *= 1.0005
		if (i < 30) currentValue *= 1.001

		data[dataIndex] = [date.getTime(), Math.round(currentValue)]
	}

	return data
}

function DemoChartCard({ chart }: { chart: ChartConfig }) {
	const chartTypeDetails = getProDashboardChartTypeConfig(chart.type) ?? {
		title: chart.type.toUpperCase(),
		chartType: 'area'
	}
	const color = DEMO_ENTITY_COLORS[getChartEntityKey(chart)]
	const itemName = chart.subjectType === 'protocol' ? chart.protocol : chart.chain

	const dataset = React.useMemo<MultiSeriesChartDataset>(
		() => ({
			source: generateFakeChartData(
				chart.type === 'tvl'
					? 50_000_000
					: chart.type === 'volume'
						? 10_000_000
						: chart.type === 'fees'
							? 500_000
							: 2_000_000,
				chart.type === 'tvl' ? 0.05 : 0.15
			),
			dimensions: ['timestamp', 'Value']
		}),
		[chart.type]
	)
	const charts = React.useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() => [
			{
				type: chartTypeDetails.chartType === 'bar' ? 'bar' : 'line',
				name: 'Value',
				encode: { x: 'timestamp', y: 'Value' },
				color,
				stack: 'value',
				large: false
			}
		],
		[chartTypeDetails.chartType, color]
	)

	return (
		<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]">
			<div className="mr-auto flex items-center gap-1 p-1 md:p-3">
				<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand body-sm text-on-brand">
					{itemName.charAt(0).toUpperCase()}
				</div>
				<h2 className="title-lg">
					{itemName} {chartTypeDetails.title}
				</h2>
			</div>
			<div className="flex-1">
				<React.Suspense fallback={null}>
					<MultiSeriesChart
						dataset={dataset}
						charts={charts}
						valueSymbol="$"
						height="300px"
						hideDataZoom
						exportButtons="hidden"
						chartOptions={chartOptions}
					/>
				</React.Suspense>
			</div>
		</div>
	)
}

const normalizeDemoBaseType = (chartType: string): MultiChartInputSeries['baseType'] => {
	if (chartType === 'bar' || chartType === 'area') return chartType
	return 'line'
}

function DemoMultiChartCard({ multi }: { multi: MultiChartConfig }) {
	const chartView = React.useMemo(() => {
		const colors = getMultiChartSeriesColors(multi.items, DEMO_ENTITY_COLORS)
		const series: Array<MultiChartInputSeries> = multi.items.map((item, index) => {
			const fakeData = generateFakeChartData(
				30_000_000 + index * 10_000_000, // Different base values for each series
				0.08
			)

			const data: Array<[number, number]> = fakeData.map((row, rowIndex) => {
				const timestamp = row[0]
				const value = row[1]
				if (typeof timestamp !== 'number' || typeof value !== 'number') {
					throw new Error(`Invalid demo chart point at index ${rowIndex}`)
				}
				return [Math.floor(timestamp / 1000), value]
			})

			const chartType = getProDashboardChartTypeConfig(item.type) ?? { title: item.type, chartType: 'line' }

			return {
				name: `${item.subjectType === 'protocol' ? item.protocol : item.chain} ${chartType.title}`,
				baseType: normalizeDemoBaseType(chartType.chartType),
				data,
				color: colors[item.id],
				metricType: item.type
			}
		})
		return buildMultiChartSeriesView({
			series,
			showCumulative: false,
			showPercentage: false,
			stackSeries: false
		})
	}, [multi.items])

	const chartOptions = React.useMemo(
		() => ({
			yAxis: {
				axisLabel: { formatter: (value: number) => formatUsd(value, { compact: true, maximumFractionDigits: 1 }) }
			},
			grid: chartGrid({ top: chartView.charts.length > 5 ? 80 : CHART_LEGEND_RESERVE }),
			legend: {
				top: CHART_INSET,
				type: 'scroll',
				pageButtonPosition: 'end',
				height: chartView.charts.length > 5 ? 80 : 40
			}
		}),
		[chartView.charts.length]
	)

	return (
		<div className="flex min-h-[400px] flex-col p-1 md:min-h-[416px]">
			<h2 className="p-1 title-lg md:p-3">{multi.name}</h2>
			<div className="flex-1">
				<React.Suspense fallback={null}>
					<MultiSeriesChart
						dataset={chartView.dataset}
						charts={chartView.charts}
						valueSymbol="$"
						hideDataZoom
						showLegend
						exportButtons="hidden"
						chartOptions={chartOptions}
					/>
				</React.Suspense>
			</div>
		</div>
	)
}

const demoCharts: Array<ChartConfig> = [
	{
		id: 'demo-ethereum-tvl',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Ethereum',
		type: 'tvl',
		grouping: 'day',
		colSpan: 2
	},
	{
		id: 'demo-ethereum-volume',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Ethereum',
		type: 'volume',
		grouping: 'day',
		colSpan: 1
	},
	{
		id: 'demo-arbitrum-users',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Arbitrum',
		type: 'activeUsers',
		grouping: 'day',
		colSpan: 1
	},
	{
		id: 'demo-uniswap-tvl',
		kind: 'chart',
		subjectType: 'protocol',
		protocol: 'Uniswap',
		geckoId: 'uniswap',
		type: 'tvl',
		grouping: 'day',
		colSpan: 1
	},
	{
		id: 'demo-aave-tokenPrice',
		kind: 'chart',
		subjectType: 'protocol',
		protocol: 'Aave',
		geckoId: 'aave',
		type: 'tokenPrice',
		grouping: 'day',
		colSpan: 1
	},
	{
		id: 'demo-ethereum-fees',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Ethereum',
		type: 'fees',
		grouping: 'week',
		colSpan: 1
	},
	{
		id: 'demo-base-txs',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Base',
		type: 'txs',
		grouping: 'day',
		colSpan: 1
	},
	{
		id: 'demo-polygon-gasUsed',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Polygon',
		type: 'gasUsed',
		grouping: 'day',
		colSpan: 1
	},
	{
		id: 'demo-ethereum-perps',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Ethereum',
		type: 'perps',
		grouping: 'day',
		colSpan: 1
	}
]

const demoMultiCharts: Array<MultiChartConfig> = [
	{
		id: 'demo-multi-chain-tvl',
		kind: 'multi',
		name: '🔗 L2 TVL Comparison',
		items: [
			{
				id: 'polygon-tvl-multi',
				kind: 'chart',
				subjectType: 'chain',
				chain: 'Polygon',
				type: 'tvl',
				grouping: 'day'
			},
			{
				id: 'arbitrum-tvl-multi',
				kind: 'chart',
				subjectType: 'chain',
				chain: 'Arbitrum',
				type: 'tvl',
				grouping: 'day'
			},
			{
				id: 'base-tvl-multi',
				kind: 'chart',
				subjectType: 'chain',
				chain: 'Base',
				type: 'tvl',
				grouping: 'day'
			}
		],
		grouping: 'day',
		colSpan: 2
	},
	{
		id: 'demo-multi-protocol-comparison',
		kind: 'multi',
		name: '📊 Blue Chip DeFi Protocols',
		items: [
			{
				id: 'uniswap-tvl-multi2',
				kind: 'chart',
				subjectType: 'protocol',
				protocol: 'Uniswap',
				type: 'tvl',
				grouping: 'day'
			},
			{
				id: 'aave-tvl-multi2',
				kind: 'chart',
				subjectType: 'protocol',
				protocol: 'Aave',
				type: 'tvl',
				grouping: 'day'
			},
			{
				id: 'curve-tvl-multi2',
				kind: 'chart',
				subjectType: 'protocol',
				protocol: 'Curve',
				type: 'tvl',
				grouping: 'day'
			}
		],
		grouping: 'day',
		colSpan: 2
	},
	{
		id: 'demo-multi-volume-comparison',
		kind: 'multi',
		name: '💹 DEX Volume Leaders',
		items: [
			{
				id: 'ethereum-volume-multi3',
				kind: 'chart',
				subjectType: 'chain',
				chain: 'Ethereum',
				type: 'volume',
				grouping: 'day'
			},
			{
				id: 'arbitrum-volume-multi3',
				kind: 'chart',
				subjectType: 'chain',
				chain: 'Arbitrum',
				type: 'volume',
				grouping: 'day'
			},
			{
				id: 'solana-volume-multi3',
				kind: 'chart',
				subjectType: 'chain',
				chain: 'Solana',
				type: 'volume',
				grouping: 'day'
			}
		],
		grouping: 'day',
		colSpan: 2
	}
]

// The demo colours its entities like a dashboard would, in the order the cards appear on the page.
const DEMO_ENTITY_COLORS = getDashboardEntityColors([
	...demoCharts.slice(0, 2),
	demoMultiCharts[0],
	...demoCharts.slice(2, 4),
	demoMultiCharts[1],
	...demoCharts.slice(4),
	demoMultiCharts[2]
])

const demoTextCard: TextConfig = {
	id: 'demo-text-intro',
	kind: 'text',
	title: '📊 Pro Dashboard Features Showcase',
	content: `This dashboard demonstrates all available Pro Dashboard features including:

- **Chart Types**: TVL, Volume, Fees, Revenue, Users, Transactions
- **Protocol Charts**: Individual protocol metrics and token data
- **Chain Charts**: Ecosystem-wide metrics across different chains
- **Multi-Charts**: Combined visualizations for comparison
- **Tables**: Protocol rankings and data tables
- **Text Cards**: Documentation and insights

*Built with DefiLlama Pro Dashboard*`,
	colSpan: 1
}

const demoTextCard2: TextConfig = {
	id: 'demo-text-metrics',
	kind: 'text',
	title: '📈 Understanding DeFi Metrics',
	content: `**Key DeFi Metrics Explained:**

- **TVL (Total Value Locked)**: The total value of assets locked in DeFi protocols
- **Volume**: Trading volume across DEXs and protocols
- **Fees**: Protocol fees generated from user activity
- **Revenue**: Net revenue earned by protocols
- **Users**: Active user count on the platform
- **Transactions**: Number of Onchain transactions

*These metrics help assess protocol health, adoption, and market trends.*`,
	colSpan: 1
}

const demoTextCard3: TextConfig = {
	id: 'demo-text-dashboard-table',
	kind: 'text',
	title: '🔧 Advanced Protocol Rankings',
	content: `**Dashboard Table Features:**

- **Dynamic Columns**: Show/hide columns, reorder as needed
- **Column Presets**: Essential, Fees, Volume, Advanced views
- **Export Capabilities**: Download data as CSV for analysis
- **Real-time Search**: Filter protocols instantly
- **Custom Sorting**: Sort by any metric ascending/descending
- **Pagination**: Handle large datasets efficiently

*Professional-grade data tables for serious DeFi analysis.*`,
	colSpan: 1
}

const demoTextCard4: TextConfig = {
	id: 'demo-text-dashboard',
	kind: 'text',
	title: '🚀 Dashboard Management',
	content: `**Dashboard Capabilities:**

- **Multiple Dashboards**: Create unlimited custom dashboards
- **Auto-save**: Changes saved automatically as you work
- **Sharing**: Share read-only dashboards with your team
- **Flexible Layout**: 1x1 and 2x1 grid spans for optimal viewing
- **Chart Composer**: Combine multiple metrics in single charts
- **Time Controls**: Synchronize time periods across all charts

*Build the perfect analytics workspace for your DeFi research.*`,
	colSpan: 1
}

const features = [
	{
		icon: 'bar-chart-2',
		title: 'Customizable Charts'
	},
	{
		icon: 'activity',
		title: 'Multiple Dashboards'
	},
	{
		icon: 'percent',
		title: 'Advanced Analytics'
	},
	{
		icon: 'layers',
		title: 'Multi-Charts'
	}
] satisfies Array<{ icon: React.ComponentProps<typeof Icon>['name']; title: string }>

export function DemoPreview() {
	const router = useRouter()
	const [firstMultiChart, secondMultiChart, thirdMultiChart] = demoMultiCharts
	if (!firstMultiChart || !secondMultiChart || !thirdMultiChart) {
		throw new Error('Demo preview requires three multi-chart examples')
	}
	const createAccountHref = `/subscription?returnUrl=${encodeURIComponent(router.asPath)}`

	return (
		<div className="relative min-h-screen">
			<div className="border-b border-subtle bg-page py-6">
				<div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
					<div className="text-center">
						<h1 className="mb-2 heading-lg text-primary">Build your own DeFi dashboard</h1>
						<p className="body-xl text-secondary">
							Combine TVL, fees, volume and protocol tables into one live view, then share it with a link.
						</p>
					</div>

					<div className="flex items-center justify-center">
						<div className="grid gap-2 sm:grid-cols-2 lg:gap-6 xl:grid-cols-4">
							{features.map((feature) => (
								<div
									key={feature.title}
									className="flex flex-wrap items-center justify-center gap-2 rounded-sm bg-linear-to-b from-brand-faint to-transparent px-8 py-15 body-md text-secondary"
								>
									<div className="align-center flex gap-2">
										<Icon name={feature.icon} className="size-8 shrink-0 text-link" />
										<span className="heading-xs whitespace-nowrap">{feature.title}</span>
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="mx-auto max-w-5xl">
						<div className="grid items-stretch gap-8 md:grid-cols-2">
							<div className="flex flex-col rounded-sm border border-subtle bg-surface px-6 py-8 text-center">
								<h3 className="mb-3 heading-sm text-primary">Free Account</h3>
								<div className="mb-6 heading-lg text-primary">
									$0
									<span className="body-lg text-secondary">/month</span>
								</div>
								<ul className="mb-8 flex-1 space-y-3 text-left body-md">
									<li className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="check" className="size-3.5 text-success" />
										</span>
										<span className="text-secondary">Access to public dashboards</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="check" className="size-3.5 text-success" />
										</span>
										<span className="text-secondary">View community-created dashboards</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="check" className="size-3.5 text-success" />
										</span>
										<span className="text-secondary">Basic DeFi data access</span>
									</li>
								</ul>
								<Button as={BasicLink} href={createAccountHref} variant="outline" size="lg">
									Create Free Account
								</Button>
							</div>

							<div className="relative flex flex-col rounded-sm border-2 border-brand bg-linear-to-br from-brand-faint to-pro-ai-tint px-6 py-8 text-center">
								<h3 className="mb-3 bg-linear-to-r from-link to-pro-ai-text bg-clip-text heading-sm text-transparent">
									Pro
								</h3>
								<div className="mb-6 heading-lg text-link">
									$49<span className="body-lg text-secondary">/month</span>
								</div>
								<ul className="mb-8 flex-1 space-y-3 text-left body-md">
									<li className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="star" className="size-3.5 text-link" />
										</span>
										<span className="font-semibold text-primary">Everything in Free, plus:</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="check" className="size-3.5 text-success" />
										</span>
										<span className="text-primary">Create unlimited custom dashboards</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="check" className="size-3.5 text-success" />
										</span>
										<span className="text-primary">CSV data downloads</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="check" className="size-3.5 text-success" />
										</span>
										<span className="text-primary">Advanced analytics & custom columns</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="check" className="size-3.5 text-success" />
										</span>
										<span className="text-primary">Full LlamaFeed access with AI summaries</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="check" className="size-3.5 text-success" />
										</span>
										<span className="text-primary">Priority access to new features</span>
									</li>
								</ul>
								<Button as={BasicLink} href={createAccountHref} variant="primary" size="lg">
									<Icon name="sparkles" className="size-3.5" />
									Upgrade to Pro
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="sticky top-0 z-20 border-b border-subtle bg-page">
				<div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
					<p className="body-md text-secondary">
						Start free to browse community dashboards, upgrade to Pro to build your own.
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<Button as={BasicLink} href="/pro?tab=discover" size="md" data-umami-event="demo-preview-discover">
							See community dashboards
						</Button>
						<Button
							as={BasicLink}
							href={createAccountHref}
							variant="primary"
							size="md"
							data-umami-event="demo-preview-create-account"
						>
							Create a free account
						</Button>
					</div>
				</div>
			</div>

			<div className="mx-auto grid w-full max-w-7xl grid-flow-dense grid-cols-1 gap-2 lg:grid-cols-2">
				<p className="col-span-full p-2 text-center body-sm text-secondary italic">
					Sample charts use illustrative data
				</p>

				<Card padding="none" className={`${demoTextCard.colSpan === 1 ? 'col-span-1' : 'col-span-full'}`}>
					<TextCard text={demoTextCard} />
				</Card>

				{demoCharts.slice(0, 2).map((chart) => (
					<Card key={chart.id} padding="none" className={`${chart.colSpan === 1 ? 'col-span-1' : 'col-span-full'}`}>
						<DemoChartCard chart={chart} />
					</Card>
				))}

				<Card padding="none" className={`${firstMultiChart.colSpan === 1 ? 'col-span-1' : 'col-span-full'}`}>
					<DemoMultiChartCard multi={firstMultiChart} />
				</Card>

				{demoCharts.slice(2, 4).map((chart) => (
					<Card key={chart.id} padding="none" className={`${chart.colSpan === 1 ? 'col-span-1' : 'col-span-full'}`}>
						<DemoChartCard chart={chart} />
					</Card>
				))}

				<Card padding="none" className={`${demoTextCard2.colSpan === 1 ? 'col-span-1' : 'col-span-full'}`}>
					<TextCard text={demoTextCard2} />
				</Card>

				<Card padding="none" className={`${demoTextCard3.colSpan === 1 ? 'col-span-1' : 'col-span-full'}`}>
					<TextCard text={demoTextCard3} />
				</Card>

				<Card padding="none" className={`${secondMultiChart.colSpan === 1 ? 'col-span-1' : 'col-span-full'}`}>
					<DemoMultiChartCard multi={secondMultiChart} />
				</Card>

				{demoCharts.slice(4).map((chart) => (
					<Card key={chart.id} padding="none" className={`${chart.colSpan === 1 ? 'col-span-1' : 'col-span-full'}`}>
						<DemoChartCard chart={chart} />
					</Card>
				))}

				<Card padding="none" className={`${demoTextCard4.colSpan === 1 ? 'col-span-1' : 'col-span-full'}`}>
					<TextCard text={demoTextCard4} />
				</Card>

				<Card padding="none" className={`${thirdMultiChart.colSpan === 1 ? 'col-span-1' : 'col-span-full'}`}>
					<DemoMultiChartCard multi={thirdMultiChart} />
				</Card>
			</div>

			<div className="mx-auto flex w-full max-w-7xl flex-col gap-2">
				<p className="p-2 text-center body-sm text-secondary italic">Live data from DefiLlama</p>
				<Card padding="none">
					<UnifiedTable
						config={{
							id: 'demo-ethereum-protocols',
							kind: 'unified-table',
							configVersion: 3,
							strategy: 'protocols',
							rowHeaders: ['parent-protocol', 'protocol'],
							params: { chains: DEMO_CHAINS }
						}}
					/>
				</Card>
			</div>
		</div>
	)
}

const chartOptions = {
	...createSingleSeriesChartOptions('$'),
	grid: chartGrid()
}
