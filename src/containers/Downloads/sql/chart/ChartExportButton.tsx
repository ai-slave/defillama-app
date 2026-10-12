import { ChartPngExportButton, type PngExportProfile } from '~/components/ChartExport/ChartPngExportButton'
import type { ChartExportHandle } from '~/components/ChartExport/types'
import type { ChartType } from '../chartConfig'

function profileFor(chartType: ChartType): PngExportProfile {
	if (chartType === 'treemap') return 'treemap'
	if (chartType === 'hbar') return 'hbar'
	if (chartType === 'scatter' || chartType === 'bubble') return 'scatterWithImageSymbols'
	return 'default'
}

interface ChartExportButtonProps {
	chart: ChartExportHandle
	chartType: ChartType
	title?: string | null
	filename?: string
}

export function ChartExportButton({ chart, chartType, title, filename }: ChartExportButtonProps) {
	return (
		<ChartPngExportButton
			chart={chart}
			pngProfile={profileFor(chartType)}
			title={title ?? undefined}
			filename={filename}
			smol
		/>
	)
}
