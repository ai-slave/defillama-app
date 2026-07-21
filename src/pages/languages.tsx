import * as React from 'react'
import type {
	CanonicalMultiSeriesChartDataset,
	IMultiSeriesChartProps,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { SERVER_URL } from '~/constants'
import Layout from '~/layout'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { PageTitleStrip } from '~/ui/EntityTitleStrip'
import { getDominancePercent, getNDistinctColors } from '~/utils'
import { fetchJson } from '~/utils/async'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

function buildDataset(
	langs: Record<string, Record<string, number>>,
	mode: 'absolute' | 'dominance'
): { dataset: CanonicalMultiSeriesChartDataset; keys: string[] } {
	const keysSet = new Set<string>()
	const entries: [string, Record<string, number>][] = []
	for (const date in langs) {
		const tvlByLang = langs[date]
		entries.push([date, tvlByLang])
		for (const lang in tvlByLang) keysSet.add(lang)
	}
	entries.sort((a, b) => Number(a[0]) - Number(b[0]))
	const keys = Array.from(keysSet)

	const source = new Array<number[]>(entries.length)
	for (let i = 0; i < entries.length; i++) {
		const [date, tvlByLang] = entries[i]
		const row = new Array<number>(keys.length + 1)
		row[0] = +date * 1e3
		if (mode === 'dominance') {
			let daySum = 0
			for (const lang in tvlByLang) daySum += tvlByLang[lang]
			for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
				row[keyIndex + 1] = getDominancePercent(tvlByLang[keys[keyIndex]] ?? 0, daySum)
			}
		} else {
			for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
				row[keyIndex + 1] = tvlByLang[keys[keyIndex]] ?? 0
			}
		}
		source[i] = row
	}

	return { dataset: { source, dimensions: ['timestamp', ...keys] }, keys }
}

function buildCharts(keys: string[], colors: Record<string, string>, stack?: string): MultiSeriesChartSeriesConfig[] {
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

	const { dataset: tvlDataset, keys: langsUnique } = buildDataset(data.chart, 'absolute')
	const { dataset: dominanceDataset } = buildDataset(data.chart, 'dominance')
	const { dataset: osDataset, keys: osUnique } = buildDataset(data.sumDailySolanaOpenSourceTvls, 'dominance')

	const allColors = getNDistinctColors(langsUnique.length)
	const colors = {}
	for (let i = 0; i < langsUnique.length; i++) {
		colors[langsUnique[i]] = allColors[i]
	}

	const tvlCharts = buildCharts(langsUnique, colors, 'A')
	const dominanceCharts = buildCharts(langsUnique, colors, 'A')
	const osColors = Object.assign({}, sourceTypeColor)
	const missingOsKeys = osUnique.filter((k) => !osColors[k])
	if (missingOsKeys.length > 0) {
		const fallback = getNDistinctColors(missingOsKeys.length)
		for (let i = 0; i < missingOsKeys.length; i++) {
			osColors[missingOsKeys[i]] = fallback[i]
		}
		console.log(`[languages] Missing sourceTypeColor for keys: ${missingOsKeys.join(', ')}`)
	}
	const osCharts = buildCharts(osUnique, osColors, 'A')

	return {
		props: {
			tvlDataset,
			tvlCharts,
			dominanceDataset,
			dominanceCharts,
			osDataset,
			osCharts
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['TVL', 'by', 'Smart Contract Languages']

export default function Protocols({ tvlDataset, tvlCharts, dominanceDataset, dominanceCharts, osDataset, osCharts }) {
	return (
		<Layout
			title={`DeFi Programming Languages by TVL - DefiLlama`}
			description={`TVL breakdown by smart contract programming languages. Track which languages power the most value in DeFi - Solidity, Rust, Move, and more. Real-time language dominance analytics.`}
			canonicalUrl={`/languages`}
			pageName={pageName}
		>
			<PageTitleStrip title="Breakdown by Smart Contract Languages" />

			<ChartPanel className="relative">
				<React.Suspense fallback={<ChartPanelExportShellFallback />}>
					<MultiSeriesChart
						dataset={tvlDataset}
						charts={tvlCharts}
						title="TVL"
						valueSymbol="$"
						stacked
						hideDefaultLegend={false}
					/>
				</React.Suspense>
			</ChartPanel>
			<ChartPanel className="relative">
				<React.Suspense fallback={<ChartPanelExportShellFallback />}>
					<MultiSeriesChart
						dataset={dominanceDataset}
						charts={dominanceCharts}
						title="TVL Dominance"
						valueSymbol="%"
						expandTo100Percent
						hideDefaultLegend={false}
					/>
				</React.Suspense>
			</ChartPanel>

			<ChartPanel className="relative">
				<React.Suspense fallback={<ChartPanelExportShellFallback />}>
					<MultiSeriesChart
						dataset={osDataset}
						charts={osCharts}
						valueSymbol="%"
						expandTo100Percent
						title="Open/Closed Source breakdown of solana protocols"
					/>
				</React.Suspense>
			</ChartPanel>
		</Layout>
	)
}

const sourceTypeColor: Record<string, string> = {
	opensource: '#3fb950',
	closedsource: '#f85149'
}
