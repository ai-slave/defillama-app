/**
 * The venue's markets rolled up per token: one row per asset, across every segment it
 * trades here. The per-segment tables stay as they are; this is the "what can I do
 * with SOL on this venue" view.
 *
 * Columns mirror the merged listing on /exchanges, so a reader moving from the
 * directory to a venue meets the same figures under the same names.
 */
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { Tooltip } from '~/ui/Tooltip'
import { geckoTokenIconUrl, letterLogoDataUri } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import { exchangeDefinitions } from './definitions'
import { EXCHANGE_SEGMENT_LABELS, type ExchangeProfileModel } from './models'
import { executionUsd, MarkoutHorizons, NA, SlippageLadder } from './ProfileExecution'
import { exchangeTokenRows, type ExchangeTokenRow } from './profileTokens'

const columnHelper = createColumnHelper<ExchangeTokenRow>()

const money = (value: number | null | undefined) =>
	value == null ? '–' : formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })

const REPORTED_NOTE =
	'Reported volume: no order book captured for one of these markets, so there is nothing to normalize against.'

function Volume({ value, reported }: { value: number | null; reported: boolean }) {
	if (value == null) return <span className="text-tertiary">–</span>
	if (!reported) return <>{money(value)}</>
	return (
		<Tooltip content={REPORTED_NOTE} className="ms-auto w-fit underline decoration-dotted">
			{`${money(value)}*`}
		</Tooltip>
	)
}

const TOKEN_COLUMNS: ColumnDef<ExchangeTokenRow, any>[] = (() => {
	const definitions = exchangeDefinitions.directory
	return [
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
				headerHelperText:
					'Base asset, with the highest leverage its perps offer here. Hover for which segments trade it.'
			}
		}),
		columnHelper.accessor((row) => row.spotActiveLiquidity ?? undefined, {
			id: 'spotActiveLiquidity',
			header: definitions.spotActiveLiquidity.label,
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[112px]',
				align: 'end',
				headerHelperText: definitions.spotActiveLiquidity.description
			}
		}),
		columnHelper.accessor((row) => row.perpActiveLiquidity ?? undefined, {
			id: 'perpActiveLiquidity',
			header: definitions.perpActiveLiquidity.label,
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[112px]',
				align: 'end',
				headerHelperText: definitions.perpActiveLiquidity.description
			}
		}),
		columnHelper.accessor((row) => row.perpOpenInterestUsd ?? undefined, {
			id: 'perpOpenInterest',
			header: definitions.perpOpenInterest.label,
			cell: ({ getValue }) => money(getValue()),
			meta: { headerClassName: 'w-[112px]', align: 'end', headerHelperText: definitions.perpOpenInterest.description }
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
				headerClassName: 'w-[112px]',
				align: 'end',
				headerHelperText: definitions.perpNormalizedVolume.description
			}
		}),
		// Cost, slippage and markout answer different questions, so they get a column
		// each, presented exactly as the Execution tab presents them. One metric shown
		// two different ways across two surfaces is its own kind of confusion.
		columnHelper.accessor((row) => row.execution?.costToTradeBps ?? undefined, {
			id: 'perpCost',
			header: 'Perp cost',
			sortDescFirst: false,
			cell: ({ row }) => {
				const execution = row.original.execution
				return execution?.costToTradeBps == null ? NA : <>{executionUsd(execution.costToTradeBps)}</>
			},
			meta: {
				headerClassName: 'w-[112px]',
				align: 'end',
				headerHelperText:
					'All-in cost of a $10k market order on this token’s USD perp: base-tier taker fee plus half the effective spread.'
			}
		}),
		columnHelper.accessor((row) => row.execution?.realizedSlippage10kBps ?? undefined, {
			id: 'perpSlippage',
			header: 'Perp slippage',
			sortDescFirst: false,
			cell: ({ row }) => (row.original.execution ? <SlippageLadder execution={row.original.execution} /> : NA),
			meta: {
				headerClassName: 'w-[186px]',
				align: 'end',
				headerHelperText:
					'Predicted first (what walking the pre-trade book promised), then what fills actually paid, in dollars at each order size. The Execution tab adds the $1M rung.'
			}
		}),
		columnHelper.accessor((row) => row.execution?.markout1mBps ?? undefined, {
			id: 'perpMarkout',
			header: 'Perp markout',
			sortDescFirst: false,
			cell: ({ row }) => (row.original.execution ? <MarkoutHorizons execution={row.original.execution} /> : NA),
			meta: {
				headerClassName: 'w-[140px]',
				align: 'end',
				headerHelperText:
					'Where the price went after a fill, in dollars per $10k, at one and five minutes. Lower is better; positive (red) means it kept moving against the taker. The Execution tab adds the 1s and 15s horizons.'
			}
		})
	]
})()

export function ProfileTokenTable({
	profile,
	leadingControls
}: {
	profile: ExchangeProfileModel
	leadingControls?: React.ReactNode
}) {
	const rows = React.useMemo(() => exchangeTokenRows(profile), [profile])
	return (
		<TableWithSearch
			data={rows}
			columns={TOKEN_COLUMNS}
			columnToSearch="token"
			placeholder="Search tokens..."
			header={null}
			leadingControls={leadingControls}
			showColumnSelect
			csvExportAllColumns
			csvFileName={`${profile.slug}-tokens`}
			tableLayout="fixed"
			// Two-line execution cells need the taller row.
			rowSize={56}
		/>
	)
}
