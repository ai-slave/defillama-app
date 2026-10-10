import type * as echarts from 'echarts/core'
import { lazy, Suspense, useMemo } from 'react'
import type { CandlestickPoint } from '~/components/ECharts/CandlestickChart/types'
import { ChartPanelBodyLoading } from '~/ui/ChartPanel'
import { EmptyState } from '~/ui/Status'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { readSqlNumber, readSqlTimestampMs } from '../rowValues'

const CandlestickChart = lazy(() => import('~/components/ECharts/CandlestickChart'))

interface CandlestickChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: Array<ClassifiedColumn>
	onReady?: (instance: echarts.ECharts | null) => void
	height: string
}

export function CandlestickChartAdapter({ config, result, classified, onReady, height }: CandlestickChartAdapterProps) {
	const mapping = config.candlestick
	const data = useMemo(() => {
		if (!mapping) return []
		const tsIndex = classified.find((column) => column.name === mapping.ts)?.index ?? -1
		const openIndex = classified.find((column) => column.name === mapping.open)?.index ?? -1
		const closeIndex = classified.find((column) => column.name === mapping.close)?.index ?? -1
		const lowIndex = classified.find((column) => column.name === mapping.low)?.index ?? -1
		const highIndex = classified.find((column) => column.name === mapping.high)?.index ?? -1
		const volumeIndex = mapping.volume ? (classified.find((column) => column.name === mapping.volume)?.index ?? -1) : -1
		const out: Array<CandlestickPoint> = []
		for (const row of result.rows) {
			const ts = readSqlTimestampMs(row[tsIndex])
			const open = readSqlNumber(row[openIndex])
			const close = readSqlNumber(row[closeIndex])
			const low = readSqlNumber(row[lowIndex])
			const high = readSqlNumber(row[highIndex])
			if (ts == null || open == null || close == null || low == null || high == null) continue
			const volume = volumeIndex >= 0 ? (readSqlNumber(row[volumeIndex]) ?? 0) : 0
			out.push([ts, open, close, low, high, volume])
		}
		return out
	}, [result, mapping, classified])

	if (!mapping)
		return (
			<EmptyState size="md" icon="bar-chart-2" title="Candlestick columns not mapped" framed className="h-[220px]">
				Candlestick needs timestamp + open/close/high/low columns. Map them in Advanced settings.
			</EmptyState>
		)
	if (data.length === 0)
		return (
			<EmptyState size="md" icon="bar-chart-2" title="No candles to draw" framed className="h-[220px]">
				No candles could be built from the current column mapping.
			</EmptyState>
		)

	void config
	return (
		<Suspense fallback={<ChartPanelBodyLoading className="min-h-0 w-full" style={{ height }} />}>
			<CandlestickChart data={data} height={height} onReady={onReady} />
		</Suspense>
	)
}
