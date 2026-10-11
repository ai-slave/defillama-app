import { Change } from '~/ui/Change'
import { Definition } from '~/ui/Tooltip'
import type { RWAFlowWindow } from '../../api.types'
import { definitions } from '../../definitions'
import { RWAFlowSummaryTooltip, RWAFlowValueShimmer, RWAFlowValueUnavailable } from '../../FlowPanelParts'
import type { RWAChangePeriod } from '../change'
import { columnHelper, getLeafRow, numberColumnMeta } from './shared'

export type RWAFlowStatus = 'loading' | 'unavailable' | 'ready'

/** Flows come in 7d and 30d windows; 1d reads unavailable. */
export function getRwaFlowWindow(period: RWAChangePeriod): RWAFlowWindow | null {
	if (period === '7d') return '7d'
	if (period === '1m') return '30d'
	return null
}

export function createFlowsColumnGroup(status: RWAFlowStatus, period: RWAChangePeriod) {
	const window = getRwaFlowWindow(period)
	const header = window === '30d' ? definitions.flows.netFlow30d : definitions.flows.netFlow7d
	const description =
		window === '30d' ? definitions.flows.assetNetFlow30d.description : definitions.flows.assetNetFlow7d.description

	return columnHelper.group({
		id: 'flows',
		header: 'Flows',
		columns: [
			columnHelper.accessor(
				(row) => {
					const rowWindow = getRwaFlowWindow(row.period)
					return (
						(rowWindow === '7d' ? row.metrics.netFlow7d : rowWindow === '30d' ? row.metrics.netFlow30d : undefined) ??
						undefined
					)
				},
				{
					id: 'netFlow',
					header: period,
					cell: ({ row, getValue }) => {
						if (window === null) return <RWAFlowValueUnavailable />
						if (status === 'loading') return <RWAFlowValueShimmer label={`Loading ${header.label}`} />
						if (status === 'unavailable') return <RWAFlowValueUnavailable />
						const value = getValue()
						const display = value == null ? '-' : <Change value={value} unit="usd" />
						const leaf = getLeafRow(row.original)
						const summary = leaf?.chainScope ? undefined : leaf?.flows[window]
						return summary ? (
							<Definition
								content={<RWAFlowSummaryTooltip description={description} summary={summary} />}
								className="justify-end"
							>
								{display}
							</Definition>
						) : (
							display
						)
					},
					meta: numberColumnMeta(
						'w-[130px]',
						window === null
							? 'Net flows are published for 7d and 30d windows, so the 1d period has none.'
							: header.description,
						window === null ? 'Net Flow (no 1d window)' : header.label
					)
				}
			)
		]
	})
}
