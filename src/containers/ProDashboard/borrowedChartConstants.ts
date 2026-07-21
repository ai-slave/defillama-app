import { CHART_ZOOM_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'

export const BORROWED_CHART_OPTIONS = {
	grid: chartGrid({ bottom: CHART_ZOOM_RESERVE })
}

export const BORROWED_CHART_TYPES = [
	{ value: 'chainsBorrowed', label: 'Borrowed by Chain' },
	{ value: 'tokenBorrowedUsd', label: 'Borrowed by Token (USD)' },
	{ value: 'tokensBorrowedPie', label: 'Borrowed Tokens Breakdown (USD)' },
	{ value: 'tokenBorrowedRaw', label: 'Borrowed by Token (Raw Quantities)' }
] as const

export const BORROWED_CHART_TYPE_LABELS: Record<string, string> = {}
for (const { value, label } of BORROWED_CHART_TYPES) {
	BORROWED_CHART_TYPE_LABELS[value] = label
}
