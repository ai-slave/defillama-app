import type * as echarts from 'echarts/core'
import { useCallback, useMemo, useRef } from 'react'
import { EmptyState } from '~/ui/Status'
import { ChartRouter } from './chart'
import { ChartExportButton } from './chart/ChartExportButton'
import { ChartToolbar } from './chart/ChartToolbar'
import { defaultChartConfig, migrateChartConfig, type ChartConfig } from './chartConfig'
import { classifyColumns } from './columnKind'
import type { QueryResult } from './exportResults'

interface ResultsChartProps {
	result: QueryResult
	chartConfig: ChartConfig | undefined
	onChartConfigChange: (next: ChartConfig | null) => void
}

export function ResultsChart({ result, chartConfig, onChartConfigChange }: ResultsChartProps) {
	const chartInstanceRef = useRef<echarts.ECharts | null>(null)
	const handleChartReady = useCallback((instance: echarts.ECharts | null) => {
		chartInstanceRef.current = instance
	}, [])
	const getChartInstance = useCallback(() => chartInstanceRef.current, [])
	const classified = useMemo(() => classifyColumns(result), [result])

	// The stored config is the reader's last edit; the chart shows it fitted to this result's columns. Nothing writes
	// the fitted config back: the next edit stores it, and every reader of a stored config (share links, saved
	// queries, notebook cells) fits it to its own result the same way.
	const resolvedConfig = useMemo<ChartConfig>(() => {
		if (!chartConfig) return defaultChartConfig(classified)
		return migrateChartConfig(chartConfig, classified)
	}, [chartConfig, classified])

	const hasNumeric = classified.some((c) => c.coarse === 'number')
	if (!hasNumeric) {
		return (
			<EmptyState size="md" icon="bar-chart-2" title="Nothing to chart" framed>
				This result has no numeric columns. Tip: wrap aggregates in CAST(... AS DOUBLE) or SUM(...) to make them
				chartable.
			</EmptyState>
		)
	}

	const patch = (next: Partial<ChartConfig>) => onChartConfigChange({ ...resolvedConfig, ...next })

	return (
		<div className="flex flex-col gap-3">
			<ChartToolbar config={resolvedConfig} classified={classified} onChange={patch} />

			<div className="flex flex-col gap-2 rounded-md border border-subtle bg-surface p-2">
				<div className="flex items-center justify-end gap-1.5">
					<ChartExportButton
						chartInstance={getChartInstance}
						chartType={resolvedConfig.chartType}
						filename="sql-chart"
					/>
				</div>
				<ChartRouter config={resolvedConfig} result={result} classified={classified} onReady={handleChartReady} />
			</div>
		</div>
	)
}
