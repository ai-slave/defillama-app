import type * as echarts from 'echarts/core'
import { lazy, Suspense, useMemo } from 'react'
import type { CandlestickPoint } from '~/components/ECharts/CandlestickChart/types'
import { LoadingSpinner } from '~/ui/Loaders'
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
			<div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-subtle body-md text-secondary">
				Candlestick needs timestamp + open/close/high/low columns. Map them in Advanced settings.
			</div>
		)
	if (data.length === 0)
		return (
			<div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-subtle body-md text-secondary">
				No candles could be built from the current column mapping.
			</div>
		)

	void config
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center" style={{ height }}>
					<LoadingSpinner size={18} />
				</div>
			}
		>
			<CandlestickChart data={data} height={height} onReady={onReady} />
		</Suspense>
	)
}
