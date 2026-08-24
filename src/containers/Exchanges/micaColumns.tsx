import { type CellContext, type ColumnDef, createColumnHelper, flexRender } from '@tanstack/react-table'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { letterLogoDataUri } from '~/utils/icons'
import { KycRequirementValue } from './ComplianceCells'
import { FeeValue, feeLabel } from './feePresentation'
import {
	MicaDepthValue,
	OFF_RAMP_COST_HELP,
	ON_RAMP_COST_HELP,
	PERP_DEPTH_05_HELP,
	PERP_DEPTH_2_HELP,
	PromotionGift,
	RampCostValue,
	SPOT_DEPTH_05_HELP,
	SPOT_DEPTH_2_HELP,
	supportsMicaProduct
} from './MicaCells'
import type { MicaVenueModel } from './models'
import { selectActivePromotion } from './promotions'
import { selectVenueDestination } from './venueLinks'

const columnHelper = createColumnHelper<MicaVenueModel>()

function pairTotal(bid: number | null, ask: number | null): number | null {
	return bid == null || ask == null ? null : bid + ask
}

/** Contractual placement: Bybit EU must lead the MiCA table and stay visually highlighted. */
export const PINNED_MICA_EXCHANGE = 'bybit-eu'

// Bybit EU row highlight — wraps each column's cell renderer with a full-bleed tint (and, on the
// first column, a left accent bar) instead of touching the shared table renderer, which every
// other table on the site also uses. The overlay is absolutely positioned within the cell
// (`relative` + `z-0` below make the <td> its containing block and stacking context) so it fills
// exactly the cell's padding box without needing to know the row's rendered height up front.
function withBybitRowHighlight(cols: ColumnDef<MicaVenueModel, any>[]): ColumnDef<MicaVenueModel, any>[] {
	return cols.map((column, index) => ({
		...column,
		meta: {
			...column.meta,
			cellClassName: [column.meta?.cellClassName, 'relative z-0'].filter(Boolean).join(' ')
		},
		cell: (ctx: CellContext<MicaVenueModel, any>) => {
			const content = flexRender(column.cell, ctx)
			if (ctx.row.original.exchange !== PINNED_MICA_EXCHANGE) return content
			return (
				<>
					<span
						aria-hidden="true"
						className="absolute inset-0 -z-10"
						style={{
							background: 'color-mix(in oklch, var(--success) 16%, var(--bg-surface))',
							boxShadow: index === 0 ? 'inset 3px 0 0 0 color-mix(in oklch, var(--success) 85%, black 15%)' : undefined
						}}
					/>
					{content}
				</>
			)
		}
	}))
}

export function buildMicaColumns(asOfDate: string): ColumnDef<MicaVenueModel, any>[] {
	return withBybitRowHighlight([
		columnHelper.accessor(
			(row) => `${row.name} ${row.exchange} ${row.micaMemberState ?? ''} ${row.micaRegulator ?? ''}`,
			{
				id: 'name',
				header: 'Exchange',
				enableSorting: false,
				cell: ({ row }) => {
					const venue = row.original
					const venueDestination = selectVenueDestination(venue.exchange, venue.referralUrl, venue.website)
					return (
						<div className="flex w-full min-w-0 items-center gap-2">
							<TokenLogo
								name={venue.exchange}
								kind="exchange"
								fallbackSrc={letterLogoDataUri(venue.name)}
								alt={`${venue.name} logo`}
							/>
							<span className="min-w-0 flex-1">
								{venueDestination ? (
									<a
										href={venueDestination.url}
										target="_blank"
										rel="noopener noreferrer"
										data-umami-event="mica-exchange-click"
										data-umami-event-exchange={venue.exchange}
										data-umami-event-type={venueDestination.kind === 'referral' ? 'ref' : 'website'}
										data-umami-event-placement="name"
										data-umami-event-url={venueDestination.url}
										className="block truncate label-md text-link hover:underline"
									>
										{venue.name}
									</a>
								) : (
									<span className="block truncate label-md">{venue.name}</span>
								)}
							</span>
						</div>
					)
				},
				meta: { headerClassName: 'w-[190px] min-w-[190px]', csvValue: (row) => row.name }
			}
		),
		// The promo chip and Trade CTA sit outside the sticky name column so they cannot
		// squeeze the venue name; both stay fully visible at every viewport.
		columnHelper.display({
			id: 'venueActions',
			header: 'Trade',
			enableSorting: false,
			cell: ({ row }) => {
				const venue = row.original
				const venueDestination = selectVenueDestination(venue.exchange, venue.referralUrl, venue.website)
				const promotion = selectActivePromotion(venue.promotions, asOfDate)
				return (
					<div className="flex items-center justify-end gap-1.5">
						{promotion ? <PromotionGift promotion={promotion} venue={venue} /> : null}
						{venueDestination ? (
							<a
								href={venueDestination.url}
								target="_blank"
								rel="noopener noreferrer"
								data-umami-event="mica-exchange-click"
								data-umami-event-exchange={venue.exchange}
								data-umami-event-type={venueDestination.kind === 'referral' ? 'ref' : 'website'}
								data-umami-event-placement="trade"
								data-umami-event-url={venueDestination.url}
								className="inline-flex h-7 items-center gap-1 rounded-md border border-medium px-2.5 label-sm text-link hover:bg-hover-row"
								aria-label={`Trade on ${venue.name}`}
							>
								Trade
								<Icon name="arrow-up-right" height={13} width={13} />
							</a>
						) : null}
					</div>
				)
			},
			meta: { headerClassName: 'w-[132px] min-w-[132px]', align: 'end' }
		}),
		columnHelper.accessor((row) => pairTotal(row.depth.spotBid2Usd, row.depth.spotAsk2Usd) ?? undefined, {
			id: 'spotDepth2',
			header: 'Spot ±2%',
			cell: ({ row, getValue }) => (
				<MicaDepthValue
					row={row.original}
					product="spot"
					value={getValue()}
					bid={row.original.depth.spotBid2Usd}
					ask={row.original.depth.spotAsk2Usd}
					helperText={SPOT_DEPTH_2_HELP}
				/>
			),
			meta: {
				headerClassName: 'w-[124px] min-w-[110px] whitespace-nowrap',
				align: 'end',
				headerHelperText: SPOT_DEPTH_2_HELP
			}
		}),
		columnHelper.accessor((row) => pairTotal(row.depth.spotBid05Usd, row.depth.spotAsk05Usd) ?? undefined, {
			id: 'spotDepth05',
			header: 'Spot ±0.5%',
			cell: ({ row, getValue }) => (
				<MicaDepthValue
					row={row.original}
					product="spot"
					value={getValue()}
					bid={row.original.depth.spotBid05Usd}
					ask={row.original.depth.spotAsk05Usd}
					helperText={SPOT_DEPTH_05_HELP}
				/>
			),
			meta: {
				headerClassName: 'w-[124px] min-w-[110px] whitespace-nowrap',
				align: 'end',
				headerHelperText: SPOT_DEPTH_05_HELP
			}
		}),
		columnHelper.accessor((row) => pairTotal(row.depth.perpBid2Usd, row.depth.perpAsk2Usd) ?? undefined, {
			id: 'perpDepth2',
			header: 'Perp ±2%',
			cell: ({ row, getValue }) => (
				<MicaDepthValue
					row={row.original}
					product="perp"
					value={getValue()}
					bid={row.original.depth.perpBid2Usd}
					ask={row.original.depth.perpAsk2Usd}
					helperText={PERP_DEPTH_2_HELP}
				/>
			),
			meta: {
				headerClassName: 'w-[124px] min-w-[110px] whitespace-nowrap',
				align: 'end',
				headerHelperText: PERP_DEPTH_2_HELP
			}
		}),
		columnHelper.accessor((row) => pairTotal(row.depth.perpBid05Usd, row.depth.perpAsk05Usd) ?? undefined, {
			id: 'perpDepth05',
			header: 'Perp ±0.5%',
			cell: ({ row, getValue }) => (
				<MicaDepthValue
					row={row.original}
					product="perp"
					value={getValue()}
					bid={row.original.depth.perpBid05Usd}
					ask={row.original.depth.perpAsk05Usd}
					helperText={PERP_DEPTH_05_HELP}
				/>
			),
			meta: {
				headerClassName: 'w-[124px] min-w-[110px] whitespace-nowrap',
				align: 'end',
				headerHelperText: PERP_DEPTH_05_HELP
			}
		}),
		columnHelper.display({
			id: 'spotFee',
			header: 'Spot fees',
			cell: ({ row }) =>
				supportsMicaProduct(row.original, 'spot') ? (
					<FeeValue fee={row.original.spotFee} kind="spot" />
				) : (
					<span className="text-tertiary">N/A</span>
				),
			meta: {
				headerClassName: 'w-[108px] min-w-[100px] whitespace-nowrap',
				align: 'end',
				headerHelperText: 'Regular-tier maker / taker fees.',
				csvValue: (row) => feeLabel(row.spotFee)
			}
		}),
		columnHelper.display({
			id: 'perpFee',
			header: 'Perp fees',
			cell: ({ row }) =>
				supportsMicaProduct(row.original, 'perp') ? (
					<FeeValue fee={row.original.perpFee} kind="perp" />
				) : (
					<span className="text-tertiary">N/A</span>
				),
			meta: {
				headerClassName: 'w-[108px] min-w-[100px] whitespace-nowrap',
				align: 'end',
				headerHelperText: 'Regular-tier maker / taker fees.',
				csvValue: (row) => feeLabel(row.perpFee)
			}
		}),
		columnHelper.accessor((row) => row.rampCost?.onRamp.totalUsd ?? undefined, {
			id: 'onRampCost',
			header: '€1k on-ramp',
			cell: ({ row }) => <RampCostValue row={row.original} direction="onRamp" />,
			meta: {
				headerClassName: 'w-[124px] min-w-[124px] whitespace-nowrap',
				align: 'end',
				headerHelperText: ON_RAMP_COST_HELP
			}
		}),
		columnHelper.accessor((row) => row.rampCost?.offRamp.totalUsd ?? undefined, {
			id: 'offRampCost',
			header: '€1k off-ramp',
			cell: ({ row }) => <RampCostValue row={row.original} direction="offRamp" />,
			meta: {
				headerClassName: 'w-[124px] min-w-[124px] whitespace-nowrap',
				align: 'end',
				headerHelperText: OFF_RAMP_COST_HELP
			}
		}),
		columnHelper.accessor((row) => row.marketCount ?? undefined, {
			id: 'marketCount',
			header: 'Markets',
			cell: ({ getValue }) => getValue() ?? <span className="text-tertiary">–</span>,
			meta: {
				headerClassName: 'w-[96px] min-w-[90px] whitespace-nowrap',
				align: 'end',
				headerHelperText: 'Tracked spot and perpetual markets in the order-book dataset.'
			}
		}),
		columnHelper.accessor((row) => row.kyc?.short, {
			id: 'kyc',
			header: 'KYC',
			enableSorting: false,
			cell: ({ row }) => <KycRequirementValue name={row.original.name} kyc={row.original.kyc} />,
			meta: {
				headerClassName: 'w-[240px] min-w-[200px]',
				headerHelperText: 'Documents and verification steps required to use the exchange.'
			}
		})
	])
}
