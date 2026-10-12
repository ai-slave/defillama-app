import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	buildSelectedPercentageChart,
	selectChartDatasetColumns
} from '~/components/ECharts/MultiSeriesChart/selection'
import type {
	MultiSeriesChartDataset,
	IMultiSeriesChartProps,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SERVER_URL } from '~/constants'
import { chartColor } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import Layout from '~/layout'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Panel } from '~/ui/Panel'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { fetchJson } from '~/utils/async'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

function buildDataset(langs: Record<string, Record<string, number>>): {
	dataset: MultiSeriesChartDataset
	keys: Array<string>
} {
	const keysSet = new Set<string>()
	const entries: Array<[string, Record<string, number>]> = []
	for (const date in langs) {
		const tvlByLang = langs[date]
		entries.push([date, tvlByLang])
		for (const lang in tvlByLang) keysSet.add(lang)
	}
	entries.sort((a, b) => Number(a[0]) - Number(b[0]))
	// Largest first by the latest day, so series colors and the stack follow rank.
	const latest = entries.at(-1)?.[1] ?? {}
	const keys = Array.from(keysSet).sort((a, b) => (latest[b] ?? 0) - (latest[a] ?? 0))

	const source = new Array<Array<number>>(entries.length)
	for (let i = 0; i < entries.length; i++) {
		const [date, tvlByLang] = entries[i]
		const row = new Array<number>(keys.length + 1)
		row[0] = +date * 1e3
		for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
			row[keyIndex + 1] = tvlByLang[keys[keyIndex]] ?? 0
		}
		source[i] = row
	}

	return { dataset: { source, dimensions: ['timestamp', ...keys] }, keys }
}

function buildCharts(
	keys: Array<string>,
	colors: Record<string, string>,
	stack?: string
): Array<MultiSeriesChartSeriesConfig> {
	return keys.map((name) => ({
		type: 'line' as const,
		name,
		encode: { x: 'timestamp', y: name },
		color: colors[name],
		...(stack ? { stack } : {})
	}))
}

export const getStaticProps = withPerformanceLogging('languages', async () => {
	const data = await fetchJson(`${SERVER_URL}/langs`)

	const { dataset: tvlDataset, keys: langsUnique } = buildDataset(data.chart)
	const { dataset: osDataset, keys: osUnique } = buildDataset(data.sumDailySolanaOpenSourceTvls)

	const colors = {}
	for (let i = 0; i < langsUnique.length; i++) {
		colors[langsUnique[i]] = chartColor(i)
	}

	const tvlCharts = buildCharts(langsUnique, colors, 'A')
	const dominanceCharts = buildCharts(langsUnique, colors, 'A')
	const osColors = Object.assign({}, sourceTypeColor)
	const missingOsKeys = osUnique.filter((k) => !osColors[k])
	if (missingOsKeys.length > 0) {
		for (let i = 0; i < missingOsKeys.length; i++) {
			osColors[missingOsKeys[i]] = chartColor(i)
		}
		console.log(`[languages] Missing sourceTypeColor for keys: ${missingOsKeys.join(', ')}`)
	}
	const osCharts = buildCharts(osUnique, osColors, 'A')

	return {
		props: {
			tvlDataset,
			tvlCharts,
			dominanceCharts,
			osDataset,
			osCharts
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['TVL', 'by', 'Smart Contract Languages']

export default function Protocols({ tvlDataset, tvlCharts, dominanceCharts, osDataset, osCharts }) {
	return (
		<Layout
			title="DeFi Programming Languages by TVL - DefiLlama"
			description="TVL breakdown by smart contract programming languages. Track which languages power the most value in DeFi - Solidity, Rust, Move, and more. Real-time language dominance analytics."
			canonicalUrl="/languages"
			pageName={pageName}
		>
			<EntityTitleStrip title="Breakdown by smart contract languages" />

			<LanguageSeriesChart dataset={tvlDataset} charts={tvlCharts} title="TVL" label="Language" stacked />
			<LanguageSeriesChart
				dataset={tvlDataset}
				charts={dominanceCharts}
				title="TVL Dominance"
				label="Language"
				expandTo100Percent
			/>
			<LanguageSeriesChart
				dataset={osDataset}
				charts={osCharts}
				title="Open/closed source breakdown of Solana protocols"
				label="Source"
				expandTo100Percent
			/>
		</Layout>
	)
}

function LanguageSeriesChart({
	dataset,
	charts,
	title,
	label,
	stacked,
	expandTo100Percent
}: {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	title: string
	label: 'Language' | 'Source'
	stacked?: boolean
	expandTo100Percent?: boolean
}) {
	const series = React.useMemo(() => charts.map((chart) => chart.name), [charts])
	const { activeSeries, selectedCharts, setSelectedSeries } = useLocalSelection({
		scope: 'languages-tvl',
		availableSeries: series
	})
	const selectedPercentage = React.useMemo(
		() =>
			expandTo100Percent
				? buildSelectedPercentageChart({
						dataset,
						charts,
						selectedCharts,
						missingValuePolicy: 'require-complete'
					})
				: {
						dataset,
						charts,
						csvSource: {
							type: 'dataset' as const,
							prepare: () =>
								selectChartDatasetColumns(
									dataset,
									charts.filter((chart) => selectedCharts.has(chart.name))
								)
						}
					},
		[charts, dataset, expandTo100Percent, selectedCharts]
	)
	const chartExport = useGetChartInstance()
	const filename = title
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replaceAll(/(^-|-$)/g, '')

	return (
		<Panel className="relative">
			<ChartPanelToolbar>
				<h2 className="mr-auto heading-xs">{title}</h2>
				{series.length > 1 ? (
					<SelectWithCombobox
						allValues={series}
						selectedValues={activeSeries}
						setSelectedValues={setSelectedSeries}
						label={label}
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<ChartExportButtons
					chart={chartExport}
					filename={filename}
					title={title}
					csvSource={selectedPercentage.csvSource}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
				<MultiSeriesChart
					exportButtons={chartExport}
					dataset={selectedPercentage.dataset}
					charts={selectedPercentage.charts}
					csvSource={selectedPercentage.csvSource}
					selectedCharts={expandTo100Percent ? undefined : selectedCharts}
					valueSymbol={expandTo100Percent ? '%' : '$'}
					stacked={stacked}
					expandTo100Percent={expandTo100Percent}
					showLegend
				/>
			</React.Suspense>
		</Panel>
	)
}

const sourceTypeColor: Record<string, string> = {
	opensource: '#3fb950',
	closedsource: '#f85149'
}
