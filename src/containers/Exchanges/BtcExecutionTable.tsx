import { createColumnHelper } from '@tanstack/react-table'
import { BasicLink } from '~/components/Link'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { letterLogoDataUri } from '~/utils/icons'
import { formatNumber, formatUsd } from '~/utils/numberFormat'
import { TierBadge } from './directoryColumns'
import type { BtcExecutionRowModel } from './models'
import { Markout, MarkoutHorizons, NA, SlippageLadder } from './ProfileExecution'

const columnHelper = createColumnHelper<BtcExecutionRowModel>()

const columns = [
	columnHelper.accessor((row) => row.name, {
		id: 'name',
		header: 'Exchange',
		cell: ({ row }) => {
			const venue = row.original
			return (
				<div className="flex min-w-0 items-center gap-2">
					{venue.tier ? <TierBadge tier={venue.tier} /> : null}
					<TokenLogo
						name={venue.exchange}
						kind="exchange"
						size={20}
						fallbackSrc={letterLogoDataUri(venue.name)}
						alt={`${venue.name} logo`}
					/>
					<BasicLink href={venue.profileHref} className="truncate label-md text-link hover:underline">
						{venue.name}
					</BasicLink>
				</div>
			)
		},
		meta: { headerClassName: 'min-w-[220px]' }
	}),
	columnHelper.accessor((row) => row.rank ?? undefined, {
		id: 'rank',
		header: 'Rank',
		sortDescFirst: false,
		cell: ({ getValue }) => (getValue() == null ? NA : `#${getValue()}`),
		meta: { align: 'end', headerClassName: 'min-w-[71px]' }
	}),
	columnHelper.accessor((row) => row.costToTradeBps ?? undefined, {
		id: 'costToTrade',
		header: 'Cost to trade',
		sortDescFirst: false,
		cell: ({ getValue }) =>
			getValue() == null
				? NA
				: (formatUsd(getValue(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'),
		meta: {
			align: 'end',
			headerClassName: 'min-w-[124px]',
			headerHelperText: 'Base-tier taker fee plus half the effective spread, on a $10k BTC market order.'
		}
	}),
	columnHelper.accessor((row) => row.effectiveSpreadBps ?? undefined, {
		id: 'effectiveSpread',
		header: 'Effective spread',
		sortDescFirst: false,
		cell: ({ getValue }) =>
			getValue() == null
				? NA
				: (formatUsd(getValue(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'),
		meta: { align: 'end', headerClassName: 'min-w-[147px]' }
	}),
	columnHelper.accessor((row) => row.quotedSpreadBps ?? undefined, {
		id: 'quotedSpread',
		header: 'Quoted spread',
		sortDescFirst: false,
		cell: ({ getValue }) =>
			getValue() == null
				? NA
				: (formatUsd(getValue(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'),
		meta: { align: 'end', headerClassName: 'min-w-[137px]' }
	}),
	columnHelper.accessor((row) => row.realizedSlippage10kBps ?? undefined, {
		id: 'slippage',
		header: 'Slippage (predicted → realized)',
		sortDescFirst: false,
		cell: ({ row, getValue }) => (getValue() == null ? NA : <SlippageLadder execution={row.original} />),
		meta: { align: 'end', headerClassName: 'min-w-[247px]' }
	}),
	columnHelper.accessor((row) => row.markout1mBps ?? undefined, {
		id: 'markout',
		header: 'Markout (1m / 5m)',
		sortDescFirst: false,
		cell: ({ row, getValue }) => (getValue() == null ? NA : <MarkoutHorizons execution={row.original} />),
		meta: { align: 'end', headerClassName: 'min-w-[159px]' }
	}),
	columnHelper.accessor((row) => row.markout1sBps ?? undefined, {
		id: 'markout1s',
		header: 'Markout (1s)',
		sortDescFirst: false,
		cell: ({ getValue }) => (getValue() == null ? NA : <Markout value={getValue() ?? null} />),
		meta: { align: 'end', headerClassName: 'min-w-[120px]' }
	}),
	columnHelper.accessor((row) => row.markout15sBps ?? undefined, {
		id: 'markout15s',
		header: 'Markout (15s)',
		sortDescFirst: false,
		cell: ({ getValue }) => (getValue() == null ? NA : <Markout value={getValue() ?? null} />),
		meta: { align: 'end', headerClassName: 'min-w-[129px]' }
	}),
	columnHelper.accessor((row) => row.takerFeeBps ?? undefined, {
		id: 'takerFee',
		header: 'Taker fee',
		sortDescFirst: false,
		cell: ({ getValue }) =>
			getValue() == null
				? NA
				: (formatUsd(getValue(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'),
		meta: {
			align: 'end',
			headerClassName: 'min-w-[102px]',
			headerHelperText: 'Base-tier taker fee measured from fills, not the advertised schedule.'
		}
	}),
	columnHelper.accessor((row) => row.hoursCovered, {
		id: 'hoursCovered',
		header: 'Hours covered',
		cell: ({ getValue }) => formatNumber(getValue(), { maximumFractionDigits: 0 }),
		meta: {
			align: 'end',
			headerClassName: 'min-w-[137px]',
			headerHelperText: 'Tick-data hours behind these figures: more hours, more confidence.'
		}
	}),
	columnHelper.accessor((row) => row.nTrades, {
		id: 'nTrades',
		header: 'Trades measured',
		cell: ({ getValue }) => formatNumber(getValue(), { maximumFractionDigits: 0 }),
		meta: { align: 'end', headerClassName: 'min-w-[155px]' }
	})
]

export function BtcExecutionTable({ rows }: { rows: Array<BtcExecutionRowModel> }) {
	return (
		<TableWithSearch<BtcExecutionRowModel>
			data={rows}
			columns={columns}
			columnToSearch="name"
			placeholder="Search exchanges..."
			header={null}
			// Auto layout sizes columns from mounted rows, so it must not be virtualized
			// (see COLUMN_WIDTHS.md); the row count here is small enough to render whole.
			skipVirtualization
			tableLayout="auto"
			csvFileName="btc-execution"
		/>
	)
}
