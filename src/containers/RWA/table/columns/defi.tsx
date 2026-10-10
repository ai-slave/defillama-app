import { Change } from '~/ui/Change'
import { formatPercent } from '~/utils/numberFormat'
import { definitions } from '../../definitions'
import { percentChange, type RWAChangePeriod } from '../change'
import type { RWATableMetrics } from '../rows'
import { columnHelper, getLeafRow, numberColumnMeta, UsdBreakdownCell } from './shared'

const PROTOCOL_BREAKDOWN_UNAVAILABLE = 'Protocol breakdown unavailable when bridge TVL is excluded.'

export function getDefiUtilization(metrics: RWATableMetrics): number | undefined {
	const { defiActiveTvl, activeMcap } = metrics
	return defiActiveTvl == null || activeMcap == null || activeMcap === 0
		? undefined
		: (defiActiveTvl / activeMcap) * 100
}

export function createDefiColumnGroup(period: RWAChangePeriod) {
	return columnHelper.group({
		id: 'defi',
		header: 'DeFi',
		columns: [
			columnHelper.accessor((row) => row.metrics.defiActiveTvl ?? undefined, {
				id: 'defiActiveTvl',
				header: 'Active TVL',
				cell: ({ row, getValue }) => {
					const leaf = getLeafRow(row.original)
					return (
						<UsdBreakdownCell
							value={getValue()}
							breakdown={leaf?.breakdowns.defiActiveTvl}
							unavailableReason={
								leaf?.asset.kind === 'spot' && leaf.breakdowns.defiActiveTvl === null
									? PROTOCOL_BREAKDOWN_UNAVAILABLE
									: undefined
							}
							description={definitions.defiActiveTvl.description}
						/>
					)
				},
				meta: numberColumnMeta('w-[150px]', definitions.defiActiveTvl.description, definitions.defiActiveTvl.label)
			}),
			columnHelper.accessor((row) => getDefiUtilization(row.metrics), {
				id: 'utilization',
				header: 'Utilization',
				cell: ({ getValue }) => (getValue() != null ? formatPercent(getValue(), { input: 'percent' }) : null),
				meta: numberColumnMeta('w-[120px]', 'DeFi Active TVL / Active AUM', 'DeFi Utilization')
			}),
			columnHelper.accessor(
				(row) =>
					percentChange(
						row.metrics.change[row.period].defiActiveTvl.current,
						row.metrics.change[row.period].defiActiveTvl.prior
					) ?? undefined,
				{
					id: 'defiActiveTvlChange',
					header: period,
					cell: ({ getValue }) => <Change value={getValue()} />,
					meta: numberColumnMeta(
						'w-[96px]',
						`Change of DeFi Active TVL against the value ${period} earlier, over the rows that have both. Under Group by Chain the prior is split by today's chain share.`,
						`DeFi Active TVL ${period} change`
					)
				}
			)
		]
	})
}
