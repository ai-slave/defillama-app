import { definitions } from '../../definitions'
import { percentChange, type RWAChangePeriod } from '../change'
import { ChangeCell, columnHelper, getLeafRow, numberColumnMeta, UsdBreakdownCell } from './shared'

export function createMarketcapColumnGroup(period: RWAChangePeriod) {
	return columnHelper.group({
		id: 'marketcap',
		header: 'AUM',
		columns: [
			columnHelper.accessor((row) => row.metrics.activeMcap ?? undefined, {
				id: 'activeMcap',
				header: 'Active',
				cell: ({ row, getValue }) => (
					<UsdBreakdownCell
						value={getValue()}
						breakdown={getLeafRow(row.original)?.breakdowns.activeMcap}
						description={definitions.activeMcap.description}
					/>
				),
				meta: numberColumnMeta('w-[150px]', definitions.activeMcap.description, definitions.activeMcap.label)
			}),
			columnHelper.accessor((row) => row.metrics.onChainMcap ?? undefined, {
				id: 'onChainMcap',
				header: 'Onchain',
				cell: ({ row, getValue }) => (
					<UsdBreakdownCell
						value={getValue()}
						breakdown={getLeafRow(row.original)?.breakdowns.onChainMcap}
						description={definitions.onChainMcap.description}
					/>
				),
				meta: numberColumnMeta('w-[150px]', definitions.onChainMcap.description, definitions.onChainMcap.label)
			}),
			columnHelper.accessor(
				(row) =>
					percentChange(
						row.metrics.change[row.period].activeMcap.current,
						row.metrics.change[row.period].activeMcap.prior
					) ?? undefined,
				{
					id: 'activeMcapChange',
					header: period,
					cell: ({ getValue }) => <ChangeCell value={getValue()} />,
					meta: numberColumnMeta(
						'w-[96px]',
						`Change of Active AUM against the value ${period} earlier, over the rows that have both. Under Group by Chain the prior is split by today's chain share.`,
						`Active AUM ${period} change`
					)
				}
			)
		]
	})
}
