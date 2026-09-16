/**
 * The venue's markets rolled up per token: one row per asset, across every segment it
 * trades here. The per-segment tables stay as they are; this is the "what can I do
 * with SOL on this venue" view.
 *
 * Columns mirror the merged listing on /exchanges, so a reader moving from the
 * directory to a venue meets the same figures under the same names.
 */
import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableColumnSelect } from '~/components/Table/search/TableColumnSelect'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { searchFieldInlineWrapperStyles, searchFieldWrapperStyles } from '~/ui/Input'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { geckoTokenIconUrl, letterLogoDataUri } from '~/utils/icons'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { exchangeDefinitions, usdPerpLabel } from './definitions'
import { EXCHANGE_SEGMENT_LABELS, type ExchangeProfileModel } from './models'
import { MarkoutHorizons, NA, SlippageLadder } from './ProfileExecution'
import { exchangeTokenRows, type ExchangeTokenRow } from './profileTokens'

const columnHelper = createColumnHelper<SearchTableFeatures, ExchangeTokenRow>()

const REPORTED_NOTE =
	'Not liquidity-checked: no order book captured for one of these markets, so there is nothing to normalize against.'

function Volume({ value, reported }: { value: number | null; reported: boolean }) {
	if (value == null) return <span className="text-tertiary">–</span>
	if (!reported) return <>{formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}</>
	return (
		<Tooltip content={REPORTED_NOTE} className="ms-auto w-fit underline decoration-dotted">
			{`${formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}*`}
		</Tooltip>
	)
}

const definitions = exchangeDefinitions.directory
const TOKEN_COLUMNS = columnHelper.columns([
	columnHelper.accessor('token', {
		id: 'token',
		header: 'Token',
		enableSorting: false,
		cell: ({ row, getValue }) => {
			const token = getValue()
			const { marketCount, segments, maxLeverage } = row.original
			return (
				<span className="flex min-w-0 items-center gap-2">
					<TokenLogo
						src={row.original.geckoId ? geckoTokenIconUrl(row.original.geckoId, 20) : null}
						size={20}
						fallbackSrc={letterLogoDataUri(token)}
						alt=""
					/>
					<Tooltip
						content={`${marketCount} market${marketCount === 1 ? '' : 's'} here: ${segments
							.map((segment) => EXCHANGE_SEGMENT_LABELS[segment])
							.join(', ')}`}
						className="min-w-0"
					>
						<BasicLink
							href={`/token/${encodeURIComponent(token)}`}
							className="truncate label-md text-link hover:underline"
						>
							{token}
						</BasicLink>
					</Tooltip>
					{/* Sibling of the link, never inside it: leverage must not become link text. */}
					{maxLeverage == null ? null : (
						<Tooltip content={`Up to ${maxLeverage}x leverage on this token's perps here`}>
							<span className="shrink-0 label-sm text-tertiary">{`${maxLeverage}x`}</span>
						</Tooltip>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[152px]',
			headerHelperText: 'Base asset, with the highest leverage its perps offer here. Hover for the segments trading it.'
		}
	}),
	// Cost, slippage and markout answer different questions, so they get a column
	// each, presented exactly as the Execution tab presents them. One metric shown
	// two different ways across two surfaces is its own kind of confusion.
	columnHelper.accessor((row) => row.execution?.costToTradeBps ?? undefined, {
		id: 'perpCost',
		// Short on purpose; the tooltip carries the USD-perp qualifier.
		header: definitions.execCostToTrade.label,
		sortDescFirst: false,
		cell: ({ row }) => {
			const execution = row.original.execution
			return execution?.costToTradeBps == null ? (
				NA
			) : (
				<>{formatUsd(execution.costToTradeBps, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'}</>
			)
		},
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText:
				'All-in cost of a $10k market order on this token’s USD perp: taker fee plus half the effective spread.'
		}
	}),
	columnHelper.accessor((row) => row.execution?.realizedSlippage10kBps ?? undefined, {
		id: 'perpSlippage',
		header: usdPerpLabel(definitions.execSlippage10k.label),
		sortDescFirst: false,
		cell: ({ row }) => (row.original.execution ? <SlippageLadder execution={row.original.execution} /> : NA),
		meta: {
			headerClassName: 'w-[186px]',
			align: 'end',
			headerHelperText:
				'What the pre-trade book promised, then what fills actually paid, at each order size. The Execution tab adds $1M.'
		}
	}),
	columnHelper.accessor((row) => row.execution?.markout1mBps ?? undefined, {
		id: 'perpMarkout',
		header: usdPerpLabel(definitions.execMarkout1m.label),
		sortDescFirst: false,
		cell: ({ row }) => (row.original.execution ? <MarkoutHorizons execution={row.original.execution} /> : NA),
		meta: {
			headerClassName: 'w-[161px]',
			align: 'end',
			headerHelperText:
				'Where the price went 1 and 5 minutes after a fill, per $10k. Lower is better; positive (red) means it kept moving against the taker. The Execution tab adds 1s and 15s.'
		}
	}),
	columnHelper.accessor((row) => row.spotActiveLiquidity ?? undefined, {
		id: 'spotActiveLiquidity',
		header: definitions.spotActiveLiquidity.label,
		cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: definitions.spotActiveLiquidity.description
		}
	}),
	columnHelper.accessor((row) => row.perpActiveLiquidity ?? undefined, {
		id: 'perpActiveLiquidity',
		header: definitions.perpActiveLiquidity.label,
		cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
		meta: {
			headerClassName: 'w-[116px]',
			align: 'end',
			headerHelperText: definitions.perpActiveLiquidity.description
		}
	}),
	columnHelper.accessor((row) => row.perpOpenInterestUsd ?? undefined, {
		id: 'perpOpenInterest',
		header: definitions.perpOpenInterest.label,
		cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: definitions.perpOpenInterest.description
		}
	}),
	columnHelper.accessor((row) => row.spotNormalizedVolume ?? undefined, {
		id: 'spotNormalizedVolume',
		header: definitions.spotNormalizedVolume.label,
		cell: ({ row }) => (
			<Volume value={row.original.spotNormalizedVolume} reported={row.original.spotVolumeIsReported} />
		),
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: definitions.spotNormalizedVolume.description
		}
	}),
	columnHelper.accessor((row) => row.perpNormalizedVolume ?? undefined, {
		id: 'perpNormalizedVolume',
		header: definitions.perpNormalizedVolume.label,
		cell: ({ row }) => (
			<Volume value={row.original.perpNormalizedVolume} reported={row.original.perpVolumeIsReported} />
		),
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: definitions.perpNormalizedVolume.description
		}
	})
])

export function ProfileTokenTable({
	profile,
	leadingControls
}: {
	profile: ExchangeProfileModel
	leadingControls?: React.ReactNode
}) {
	const rows = React.useMemo(() => exchangeTokenRows(profile), [profile])
	return (
		<SearchTableProvider options={{ data: rows, columns: TOKEN_COLUMNS }}>
			<Card padding="none">
				<TableToolbar className="w-full justify-end">
					{leadingControls ? (
						<div className="mr-auto flex items-center gap-2 overflow-x-auto">
							<div className="flex items-center overflow-x-auto">{leadingControls}</div>
						</div>
					) : null}
					<TableSearchInput
						columnId="token"
						placeholder="Search tokens..."
						className={leadingControls ? searchFieldInlineWrapperStyles : searchFieldWrapperStyles}
					/>
					<TableColumnSelect />
					<TableCsvExport filename={`${profile.slug}-tokens`} includeHiddenColumns />
				</TableToolbar>
				{/* Two-line execution cells need the taller row. */}
				<VirtualSearchTableView rowSize={56} tableLayout="fixed" />
			</Card>
		</SearchTableProvider>
	)
}
