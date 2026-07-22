import {
	getTooltipAxisValue,
	getTooltipRawYValue,
	normalizeTooltipItems,
	type EChartsTooltipItem
} from '~/components/ECharts/shared/tooltip'
import { formatNum, formattedNum } from '~/utils'

export type LiquidationsMetric = 'usd' | 'amount'

export function formatLiquidationPrice(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return '$0'
	if (value < 0.01) return formatNum(value, 5, '$') ?? '$0'
	if (value < 1) return formatNum(value, 4, '$') ?? '$0'
	if (value < 100) return formatNum(value, 2, '$') ?? '$0'
	return formattedNum(value, true)
}

export function formatLiquidationMetricValue(value: number, metric: LiquidationsMetric, tokenLabel: string): string {
	if (metric === 'usd') {
		if (!Number.isFinite(value) || value <= 0) return '$0'
		if (value < 0.01) return formatNum(value, 5, '$') ?? '$0'
		if (value < 1) return formatNum(value, 4, '$') ?? '$0'
		if (value < 100) return formatNum(value, 2, '$') ?? '$0'
		return formattedNum(value, true)
	}

	const amountLabel = !Number.isFinite(value) || value <= 0 ? '0' : formattedNum(value)
	return `${amountLabel} ${tokenLabel}`
}

function getLiquidationsTooltipValue(param: EChartsTooltipItem): number {
	const rawValue = getTooltipRawYValue(param, param.seriesName ?? '')
	if (typeof rawValue === 'number') return rawValue
	const numeric = Number(rawValue)
	return Number.isFinite(numeric) ? numeric : 0
}

export function getLiquidationsTooltipHtml(params: unknown, metric: LiquidationsMetric, tokenLabel: string): string {
	const paramList = normalizeTooltipItems(params).filter((param) => getLiquidationsTooltipValue(param) > 0)
	const axisValue = getTooltipAxisValue(paramList[0])
	const axisLabel = Number.isFinite(axisValue) ? formatLiquidationPrice(axisValue) : ''
	const total = paramList.reduce((sum, param) => sum + getLiquidationsTooltipValue(param), 0)
	const totalLabel = formatLiquidationMetricValue(total, metric, tokenLabel)
	const rows: string[] = []

	for (const param of paramList) {
		const rowValue = formatLiquidationMetricValue(getLiquidationsTooltipValue(param), metric, tokenLabel)
		rows.push(`<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:12px;">
								<span style="display:inline-flex; align-items:center; gap:6px; min-width:0;">
									${param.marker ?? ''}
									<span style="color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${param.seriesName ?? ''}</span>
								</span>
								<span style="color:var(--text-primary); text-align:right;">${rowValue}</span>
							</div>`)
	}

	return `<div style="min-width:220px; background:var(--bg-surface); border:1px solid var(--border-medium); box-shadow:0 18px 48px var(--tooltip-shadow, rgba(0, 0, 0, 0.24)); backdrop-filter:blur(10px); color:var(--text-primary); border-radius:10px; padding:12px 14px; font-size:12px; line-height:1.45;">
						<div style="margin-bottom:8px;">
							<div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.08em;">Liq Price</div>
							<div style="font-size:15px; font-weight:600; color:var(--text-primary);">${axisLabel}</div>
						</div>
						<div style="display:flex; flex-direction:column; gap:6px;">
							${rows.join('')}
						</div>
						<div style="margin-top:8px;">
							<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding-top:8px; border-top:1px solid var(--border-medium); font-size:12px;">
								<span style="color:var(--text-secondary);">Total</span>
								<span style="color:var(--text-primary); font-weight:600;">${totalLabel}</span>
							</div>
						</div>
					</div>`
}
