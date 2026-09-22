import dayjs from 'dayjs'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import {
	type EChartsTooltipItem,
	getTooltipAxisValue,
	getTooltipRawYValue,
	normalizeTooltipItems
} from '~/components/ECharts/shared/tooltip'
import { formatUsd } from '~/utils/numberFormat'

const getValue = (param: EChartsTooltipItem) => {
	const raw = getTooltipRawYValue(param, param.seriesName ?? '')
	const v = typeof raw === 'number' ? raw : Number(raw)
	return Number.isFinite(v) ? v : 0
}

export const calendarChartOptions = {
	tooltip: {
		trigger: 'axis',
		formatter: (formatterParams: unknown) => {
			const params = normalizeTooltipItems(formatterParams)
			if (params.length === 0) return ''
			const ts = getTooltipAxisValue(params[0])

			const dateStr = Number.isFinite(ts) ? dayjs(ts).format('MMM D, YYYY') : ''
			let tooltipContent = `<div class="font-semibold mb-1">${dateStr}</div>`
			let totalValue = 0

			const validParams = params
				.map((param) => [param, getValue(param)] as const)
				.filter(([, v]) => v > 0)
				.toSorted((a, b) => b[1] - a[1])

			if (validParams.length === 0) {
				tooltipContent += 'No unlocks'
			} else {
				for (const [param, value] of validParams) {
					totalValue += value
					tooltipContent += `<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
					<span>${param.marker} ${param.seriesName}</span>
					<span style="font-weight: 500;">${formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</span>
				</div>`
				}
				if (validParams.length > 1) {
					tooltipContent += `<div style="border-top: 1px solid var(--border-subtle); margin-top: 4px; padding-top: 4px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
					<span><strong>Total</strong></span>
					<span style="font-weight: 600;">${formatUsd(totalValue, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</span>
				</div>`
				}
			}

			return `<div style="font-size: 0.75rem; line-height: 1rem;">${tooltipContent}</div>`
		}
	}
} satisfies MultiSeriesChartOptions
