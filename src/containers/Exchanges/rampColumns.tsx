import { createColumnHelper } from '@tanstack/react-table'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { TextLink } from '~/ui/TextLink'
import { letterLogoDataUri } from '~/utils/icons'
import { KycRequirementValue } from './ComplianceCells'
import { CryptoRailsValue, cryptoRailSummary } from './CryptoRailsValue'
import { FiatFeesValue, fiatFeeSummary } from './FiatFeesValue'
import { RampAccessValue, RampCurrenciesValue, RampLegValue, RampRoundTripValue, RampTradeValue } from './RampCells'
import type { RampRowModel } from './rampPresentation'
import { selectVenueDestination } from './venueLinks'

const columnHelper = createColumnHelper<SearchTableFeatures, RampRowModel>()

const ROUND_TRIP_HELP = 'On-ramp plus off-ramp: what a full round trip through the venue costs.'
const ON_RAMP_HELP =
	'Fiat deposit + taker fee + slippage + BTC withdrawal. Hover for the breakdown; a blank means a leg is unpublished, never zero.'
const OFF_RAMP_HELP = 'BTC network fee in + taker fee + slippage + fiat withdrawal. Hover for the breakdown.'
const TRADE_COST_HELP =
	'Execution alone: taker fee + slippage on the venue’s BTC book at this size. No rail, no transfer.'
/** Columns present but hidden by default — reachable from the column select, and still in
 *  the CSV. Regulator is parked until the license data is filled in. Access is off because
 *  an "Available" chip beside a row with no published on/off-ramp fee reads as a promise the
 *  row does not keep; the sort still puts genuinely unavailable venues last. */
export const RAMP_HIDDEN_COLUMNS = { regulator: false, access: false }

export function buildRampColumns(options: { size: number; currency: string | null; country: string | null }) {
	const { size, currency, country } = options
	return columnHelper.columns([
		columnHelper.accessor((row) => `${row.name} ${row.exchange} ${row.variant.regulator ?? ''}`, {
			id: 'name',
			enableHiding: false,
			header: 'Exchange',
			enableSorting: false,
			cell: ({ row }) => {
				const venue = row.original
				const destination = selectVenueDestination(venue.exchange, venue.referralUrl, venue.website)
				return (
					<div className="flex w-full min-w-0 items-center gap-2">
						<TokenLogo
							name={venue.exchange}
							kind="exchange"
							fallbackSrc={letterLogoDataUri(venue.name)}
							alt={`${venue.name} logo`}
						/>
						<span className="min-w-0 flex-1">
							{destination ? (
								<TextLink
									href={destination.url}
									target="_blank"
									rel="noopener noreferrer"
									data-umami-event="ramp-exchange-click"
									data-umami-event-exchange={venue.exchange}
									data-umami-event-url={destination.url}
									data-umami-event-type={destination.kind === 'referral' ? 'ref' : 'website'}
									data-umami-event-placement="name"
									truncate
									className="block"
								>
									{venue.name}
								</TextLink>
							) : (
								<span className="block truncate label-md">{venue.name}</span>
							)}
						</span>
					</div>
				)
			},
			meta: {
				headerClassName: 'min-w-[260px]',
				csvValue: (row) => `${row.name} (${row.status})`
			}
		}),
		columnHelper.accessor((row) => row.status, {
			id: 'access',
			header: 'Access',
			enableSorting: false,
			cell: ({ row }) => <RampAccessValue row={row.original} country={country} />,
			meta: {
				headerClassName: 'min-w-[110px]',
				headerHelperText: 'Whether the venue serves the selected country, plus its own note.',
				csvValue: (row) => row.status
			}
		}),
		columnHelper.accessor((row) => row.roundTripUsd ?? undefined, {
			id: 'roundTrip',
			header: 'Round Trip',
			cell: ({ row }) => <RampRoundTripValue row={row.original} size={size} />,
			meta: {
				headerClassName: 'min-w-[120px] whitespace-nowrap',
				align: 'end',
				headerHelperText: ROUND_TRIP_HELP,
				csvValue: (row) => row.roundTripUsd
			}
		}),
		columnHelper.accessor((row) => row.cost?.onRamp.totalUsd ?? undefined, {
			id: 'onRamp',
			header: 'On-Ramp',
			cell: ({ row }) => <RampLegValue row={row.original} direction="onRamp" size={size} />,
			meta: {
				headerClassName: 'min-w-[120px] whitespace-nowrap',
				align: 'end',
				headerHelperText: ON_RAMP_HELP,
				csvValue: (row) => row.cost?.onRamp.totalUsd ?? null
			}
		}),
		columnHelper.accessor((row) => row.cost?.offRamp.totalUsd ?? undefined, {
			id: 'offRamp',
			header: 'Off-Ramp',
			cell: ({ row }) => <RampLegValue row={row.original} direction="offRamp" size={size} />,
			meta: {
				headerClassName: 'min-w-[120px] whitespace-nowrap',
				align: 'end',
				headerHelperText: OFF_RAMP_HELP,
				csvValue: (row) => row.cost?.offRamp.totalUsd ?? null
			}
		}),
		columnHelper.accessor((row) => row.tradeCostUsd ?? undefined, {
			id: 'tradeCost',
			header: 'Cost to Trade',
			cell: ({ row }) => <RampTradeValue row={row.original} size={size} />,
			meta: {
				headerClassName: 'min-w-[120px] whitespace-nowrap',
				align: 'end',
				headerHelperText: TRADE_COST_HELP,
				csvValue: (row) => row.tradeCostUsd
			}
		}),
		columnHelper.display({
			id: 'rails',
			header: 'Fiat Rails',
			cell: ({ row }) => <FiatFeesValue name={row.original.name} fees={row.original.variant.rails} />,
			meta: {
				headerClassName: 'min-w-[110px] whitespace-nowrap',
				align: 'end',
				headerHelperText: 'Deposit and withdrawal routes for this region, with fees, minimums and times.',
				csvValue: (row) => (row.variant.rails ? fiatFeeSummary(row.variant.rails) : null)
			}
		}),
		columnHelper.display({
			id: 'cryptoRails',
			header: 'Crypto Rails',
			cell: ({ row }) => <CryptoRailsValue name={row.original.name} rails={row.original.variant.cryptoRails} />,
			meta: {
				headerClassName: 'min-w-[116px] whitespace-nowrap',
				align: 'end',
				headerHelperText:
					'Routes per asset and network (BTC, ETH and their L2s). Sparse today: most venues publish only the BTC withdrawal fee.',
				csvValue: (row) => (row.variant.cryptoRails ? cryptoRailSummary(row.variant.cryptoRails) : null)
			}
		}),
		columnHelper.accessor(
			(row) => (row.variant.fiatCurrencies.length > 0 ? row.variant.fiatCurrencies.length : undefined),
			{
				id: 'currencies',
				header: 'Fiat Ccy',
				cell: ({ row }) => <RampCurrenciesValue row={row.original} currency={currency} />,
				meta: {
					headerClassName: 'min-w-[90px] whitespace-nowrap',
					align: 'end',
					headerHelperText: 'Fiat currencies the venue accepts in this region; ✓ marks the selected currency.',
					csvValue: (row) => row.variant.fiatCurrencies.join(' ')
				}
			}
		),
		columnHelper.accessor((row) => row.variant.kyc?.short, {
			id: 'kyc',
			header: 'KYC',
			enableSorting: false,
			cell: ({ row }) => <KycRequirementValue name={row.original.name} kyc={row.original.variant.kyc} />,
			meta: {
				headerClassName: 'min-w-[190px]',
				headerHelperText: 'Documents and verification steps required to use the exchange.'
			}
		}),
		columnHelper.accessor((row) => row.variant.regulator ?? undefined, {
			id: 'regulator',
			header: 'Regulator',
			enableSorting: false,
			cell: ({ row }) => {
				const venue = row.original
				if (!venue.variant.regulator) return <span className="text-tertiary">–</span>
				return (
					<span className="inline-flex items-center gap-1 whitespace-nowrap">
						<span className="truncate text-secondary">{venue.variant.regulator}</span>
						{venue.variant.micaLicensed ? (
							<Icon name="clipboard-check" className="size-3.5 shrink-0 text-link" />
						) : null}
					</span>
				)
			},
			meta: {
				headerClassName: 'min-w-[150px]',
				headerHelperText: 'Lead regulator for the license covering this region; the badge marks a MiCA license.'
			}
		})
	])
}
