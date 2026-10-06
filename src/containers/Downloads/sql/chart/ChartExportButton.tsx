import type * as echarts from 'echarts/core'
import { ChartPngExportButton, type PngExportProfile } from '~/components/ChartExport/ChartPngExportButton'
import type { ChartType } from '../chartConfig'

function profileFor(chartType: ChartType): PngExportProfile {
	if (chartType === 'treemap') return 'treemap'
	if (chartType === 'hbar') return 'hbar'
	if (chartType === 'scatter' || chartType === 'bubble') return 'scatterWithImageSymbols'
	return 'default'
}

interface ChartExportButtonProps {
	chartInstance: () => echarts.ECharts | null
	chartType: ChartType
	title?: string | null
	filename?: string
}

export function ChartExportButton({ chartInstance, chartType, title, filename }: ChartExportButtonProps) {
	return (
		<ChartPngExportButton
			chartInstance={chartInstance}
			pngProfile={profileFor(chartType)}
			title={title ?? undefined}
			filename={filename}
			smol
		/>
	)
}
