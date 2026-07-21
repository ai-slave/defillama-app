import type * as echarts from 'echarts/core'
import { lazy, Suspense, useMemo } from 'react'
import { CHART_COLORS } from '~/constants/colors'
import { LoadingSpinner } from '~/ui/Loaders'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { SQL_CHART_HEIGHT } from '../chartLayout'
import { readSqlNumber } from '../rowValues'
import { makeValueFormatter } from '../valueFormatters'

const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))

interface HBarChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: ClassifiedColumn[]
	onReady?: (instance: echarts.ECharts | null) => void
}

export function HBarChartAdapter({ config, result, classified, onReady }: HBarChartAdapterProps) {
	const formatter = useMemo(() => makeValueFormatter(config.numberFormat), [config.numberFormat])

	const { categories, values } = useMemo(() => {
		if (!config.xCol || config.yCols.length === 0) return { categories: [], values: [] }
		const yCol = classified.find((column) => column.name === config.yCols[0])
		const labelCol = classified.find((c) => c.name === config.xCol && c.coarse !== 'number')
		return labelCol && yCol ? buildSqlHBarData(result.rows, labelCol.index, yCol.index) : { categories: [], values: [] }
	}, [result, config, classified])

	const colors = useMemo(
		() => categories.map((_, i) => CHART_COLORS[(categories.length - 1 - i) % CHART_COLORS.length]),
		[categories]
	)

	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center" style={{ height: SQL_CHART_HEIGHT }}>
					<LoadingSpinner size={18} />
				</div>
			}
		>
			<HBarChart
				categories={categories}
				values={values}
				height={SQL_CHART_HEIGHT}
				valueSymbol={formatter.valueSymbol}
				colors={colors}
				onReady={onReady}
			/>
		</Suspense>
	)
}

export function buildSqlHBarData(rows: unknown[][], labelIndex: number, valueIndex: number, cap = 40) {
	const topPairs: Array<{ name: string; value: number }> = []
	for (const row of rows) {
		const nameRaw = row[labelIndex]
		const name = nameRaw == null ? '' : String(nameRaw)
		const value = readSqlNumber(row[valueIndex])
		if (name === '' || value == null) continue

		let insertAt = topPairs.length
		while (insertAt > 0 && topPairs[insertAt - 1].value < value) insertAt--
		if (insertAt >= cap) continue
		topPairs.splice(insertAt, 0, { name, value })
		if (topPairs.length > cap) topPairs.pop()
	}
	return {
		categories: topPairs.map((pair) => pair.name).reverse(),
		values: topPairs.map((pair) => pair.value).reverse()
	}
}
