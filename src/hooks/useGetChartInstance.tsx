import type * as echarts from 'echarts/core'
import { useCallback, useMemo, useRef } from 'react'
import type { ChartExportHandle } from '~/components/ChartExport/types'

export function useGetChartInstance(): ChartExportHandle {
	const chartInstanceRef = useRef<echarts.ECharts | null>(null)

	const handleChartReady = useCallback((instance: echarts.ECharts | null) => {
		chartInstanceRef.current = instance
	}, [])

	const chartInstance = useCallback(() => chartInstanceRef.current, [])

	// One object for the component's life, so a callback or effect can list the handle as a dependency.
	return useMemo(() => ({ chartInstance, handleChartReady }), [chartInstance, handleChartReady])
}
