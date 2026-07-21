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
			className="inline-flex items-center gap-1 rounded-md border border-subtle bg-pro-app-bg/50 px-2 py-1 text-[11px] text-pro-text-secondary hover:bg-hover-row hover:text-pro-text-primary disabled:cursor-not-allowed disabled:opacity-50"
			smol
		/>
	)
}
