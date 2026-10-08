import type * as echarts from 'echarts/core'
import { useCallback, useMemo, useRef } from 'react'
import { Icon } from '~/ui/Icon'
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
			<EmptyState
				message="No numeric columns detected in this result — nothing to chart."
				hint="Tip: wrap aggregates in CAST(... AS DOUBLE) or SUM(...) to make them chartable."
			/>
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

function EmptyState({ message, hint }: { message: string; hint?: string }) {
	return (
		<div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-subtle px-6 py-10 text-center">
			<Icon name="bar-chart-2" className="size-5 text-tertiary" />
			<p className="body-md text-secondary">{message}</p>
			{hint ? <p className="body-sm text-tertiary">{hint}</p> : null}
		</div>
	)
}
