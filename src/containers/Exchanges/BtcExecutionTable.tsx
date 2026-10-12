import { createColumnHelper } from '@tanstack/react-table'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { SearchTableView } from '~/components/Table/search/SearchTableView'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { TextLink } from '~/ui/TextLink'
import { TableToolbar } from '~/ui/Toolbar'
import { letterLogoDataUri } from '~/utils/icons'
import { formatNumber, formatUsd } from '~/utils/numberFormat'
import { TierBadge } from './directoryColumns'
import type { BtcExecutionRowModel } from './models'
import { Markout, MarkoutHorizons, NA, SlippageLadder } from './ProfileExecution'

const columnHelper = createColumnHelper<SearchTableFeatures, BtcExecutionRowModel>()

const columns = columnHelper.columns([
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
					<TextLink href={venue.profileHref} truncate>
						{venue.name}
					</TextLink>
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
		meta: { align: 'end' }
	}),
	columnHelper.accessor((row) => row.costToTradeBps ?? undefined, {
		id: 'costToTrade',
		header: 'Cost to Trade',
		sortDescFirst: false,
		cell: ({ getValue }) =>
			getValue() == null
				? NA
				: (formatUsd(getValue(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'),
		meta: {
			align: 'end',
			headerHelperText: 'Base-tier taker fee plus half the effective spread, on a $10k BTC market order.'
		}
	}),
	columnHelper.accessor((row) => row.effectiveSpreadBps ?? undefined, {
		id: 'effectiveSpread',
		header: 'Effective Spread',
		sortDescFirst: false,
		cell: ({ getValue }) =>
			getValue() == null
				? NA
				: (formatUsd(getValue(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'),
		meta: { align: 'end' }
	}),
	columnHelper.accessor((row) => row.quotedSpreadBps ?? undefined, {
		id: 'quotedSpread',
		header: 'Quoted Spread',
		sortDescFirst: false,
		cell: ({ getValue }) =>
			getValue() == null
				? NA
				: (formatUsd(getValue(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'),
		meta: { align: 'end' }
	}),
	columnHelper.accessor((row) => row.realizedSlippage10kBps ?? undefined, {
		id: 'slippage',
		header: 'Slippage (predicted → realized)',
		sortDescFirst: false,
		cell: ({ row, getValue }) => (getValue() == null ? NA : <SlippageLadder execution={row.original} />),
		meta: { align: 'end' }
	}),
	columnHelper.accessor((row) => row.markout1mBps ?? undefined, {
		id: 'markout',
		header: 'Markout (1m / 5m)',
		sortDescFirst: false,
		cell: ({ row, getValue }) => (getValue() == null ? NA : <MarkoutHorizons execution={row.original} />),
		meta: { align: 'end' }
	}),
	columnHelper.accessor((row) => row.markout1sBps ?? undefined, {
		id: 'markout1s',
		header: 'Markout (1s)',
		sortDescFirst: false,
		cell: ({ getValue }) => (getValue() == null ? NA : <Markout value={getValue() ?? null} />),
		meta: { align: 'end' }
	}),
	columnHelper.accessor((row) => row.markout15sBps ?? undefined, {
		id: 'markout15s',
		header: 'Markout (15s)',
		sortDescFirst: false,
		cell: ({ getValue }) => (getValue() == null ? NA : <Markout value={getValue() ?? null} />),
		meta: { align: 'end' }
	}),
	columnHelper.accessor((row) => row.takerFeeBps ?? undefined, {
		id: 'takerFee',
		header: 'Taker Fee',
		sortDescFirst: false,
		cell: ({ getValue }) =>
			getValue() == null
				? NA
				: (formatUsd(getValue(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'),
		meta: {
			align: 'end',
			headerHelperText: 'Base-tier taker fee measured from fills, not the advertised schedule.'
		}
	}),
	columnHelper.accessor((row) => row.hoursCovered, {
		id: 'hoursCovered',
		header: 'Hours Covered',
		cell: ({ getValue }) => formatNumber(getValue(), { maximumFractionDigits: 0 }),
		meta: {
			align: 'end',
			headerHelperText: 'Tick-data hours behind these figures: more hours, more confidence.'
		}
	}),
	columnHelper.accessor((row) => row.nTrades, {
		id: 'nTrades',
		header: 'Trades Measured',
		cell: ({ getValue }) => formatNumber(getValue(), { maximumFractionDigits: 0 }),
		meta: { align: 'end' }
	})
])

export function BtcExecutionTable({ rows }: { rows: Array<BtcExecutionRowModel> }) {
	return (
		<SearchTableProvider<BtcExecutionRowModel> options={{ data: rows, columns }}>
			<Card padding="none">
				<TableToolbar>
					<TableSearchInput columnId="name" placeholder="Search exchanges…" />
					<TableCsvExport filename="btc-execution" />
				</TableToolbar>
				{/* Auto sizing needs every row mounted; this list is short. */}
				<SearchTableView columnSizing="content" />
			</Card>
		</SearchTableProvider>
	)
}
