import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Tooltip } from '~/ui/Tooltip'
import { letterLogoDataUri } from '~/utils/icons'
import { formatNumber, formatRatio, formatUsd, formatPercent, roundNumber } from '~/utils/numberFormat'
import {
	EuAvailabilityValue,
	getEuStatusPresentation,
	getMicaLicensePresentation,
	KycRequirementValue,
	MicaLicenseValue
} from './ComplianceCells'
import { exchangeDefinitions } from './definitions'
import { FeeValue, feeLabel } from './feePresentation'
import { FiatFeesValue, fiatFeeSummary } from './FiatFeesValue'
import { MiniSparkline } from './MiniSparkline'
import {
	activityForScope,
	depthMetricState,
	depthTotal,
	describeChildLiquidity,
	fractionChange,
	normalizedVolumeForScope,
	sparklineForScope,
	volumeToDepth,
	volumeToOpenInterest
} from './modelHelpers'
import type { ExchangeDirectoryRowModel, ExchangeSegment, ExchangeVenueKind } from './models'
import { EXCHANGE_SEGMENT_LABELS } from './models'
import { withCountryParam } from './queryState'
import { selectVenueDestination } from './venueLinks'

const columnHelper = createColumnHelper<ExchangeDirectoryRowModel>()
export const EXECUTION_COLUMN_IDS = ['execCostToTrade', 'execSlippage10k', 'execMarkout1m']

function money(value: number | null | undefined): string {
	return value == null
		? '–'
		: formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
}

function percentage(value: number | null | undefined, digits = 1): string {
	return value == null
		? '–'
		: `${formatPercent(value, { input: 'fraction', minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false })}`
}

function ratio(value: number | null | undefined): string {
	if (value == null) return '–'
	return `${formatRatio(value, { maximumFractionDigits: value >= 100 ? 0 : 1 })}×`
}

function Change({ value }: { value: number | undefined }) {
	if (value == null) return <span className="text-tertiary">–</span>
	return (
		<span
			className={value >= 0 ? 'text-data-up' : 'text-data-down'}
		>{`${value >= 0 ? '+' : ''}${percentage(value)}`}</span>
	)
}

function UnsupportedMetric() {
	return <span className="text-tertiary">N/A</span>
}

function KindBadge({ kind }: { kind: ExchangeVenueKind }) {
	return <span className="rounded-sm border border-subtle px-1.5 py-0.5 label-sm uppercase">{kind}</span>
}

export const formatScore = (score: number) =>
	formatNumber(score, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// 1bp of $10k = $1, so execution bps figures render as dollars at the $10k reference size.
const execUsd = (bps: number) => formatUsd(bps, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const execUsdSigned = (bps: number) =>
	formatUsd(bps, { signDisplay: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Quality tier chip — the public summary of the measured quality score.
// Fixed bands: S ≥85 (requires measured execution), A ≥70, B ≥55, C ≥40, else D.
export const TIER_COLORS: Record<string, string> = {
	S: '#c9a227',
	A: '#16a34a',
	B: '#64748b',
	C: '#c97c27',
	D: '#dc2626'
}

export function TierBadge({ tier }: { tier: string }) {
	const color = TIER_COLORS[tier] ?? 'inherit'
	return (
		<span
			className="rounded-sm border border-current px-1.5 py-0.5 text-center mono-sm-bold"
			style={{ color, minWidth: '22px' }}
		>
			{tier}
		</span>
	)
}

export const RANK_PILLAR_LABELS: Record<string, string> = {
	E: 'Execution',
	L: 'Liquidity',
	O: 'Open interest',
	V: 'Volume',
	R: 'Reserves',
	S: 'Stability',
	U: 'Reach'
}

// Pillar weights restated for the hover card only (the Information tab reads them
// live from rank-methodology.json). Must match upstream lib/rank-components.ts.
export const RANK_PILLAR_WEIGHTS: Record<string, number> = { E: 33, L: 20, O: 15, V: 10, R: 10, S: 7, U: 5 }

/** Hover card behind the tier chip: score, in-kind rank, and the pillar breakdown. */
export function QualityHover({
	quality,
	kind
}: {
	quality: NonNullable<ExchangeDirectoryRowModel['quality']>
	kind: string
}) {
	// Weight order, not the JSON's alphabetical key order.
	const pillars = Object.entries(quality.components ?? {}).sort(
		([a], [b]) => (RANK_PILLAR_WEIGHTS[b] ?? 0) - (RANK_PILLAR_WEIGHTS[a] ?? 0)
	)
	return (
		<div className="flex w-72 flex-col gap-2 py-0.5 text-left">
			<div className="flex items-center gap-2">
				{quality.tier ? <TierBadge tier={quality.tier} /> : null}
				<span className="mono-md-bold">{formatScore(quality.score)} / 100</span>
				<span className="text-tertiary">
					#{quality.rank} of {kind.toUpperCase()}s
				</span>
			</div>
			<div className="flex flex-col gap-1">
				{pillars.map(([key, score]) => {
					const measured = score != null
					return (
						<div key={key} className="flex items-center gap-2">
							<span className="w-28 shrink-0">
								{RANK_PILLAR_LABELS[key] ?? key}
								{RANK_PILLAR_WEIGHTS[key] ? <span className="text-tertiary"> {RANK_PILLAR_WEIGHTS[key]}%</span> : null}
							</span>
							<span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-elevated-2">
								<span
									className="block h-full rounded-full bg-current opacity-70"
									style={{ width: `${measured ? Math.max(2, Math.min(100, score)) : 0}%` }}
								/>
							</span>
							<span className={`w-8 shrink-0 text-right ${measured ? '' : 'text-tertiary'}`}>
								{measured ? Math.round(score) : 'n/a'}
							</span>
						</div>
					)
				})}
			</div>
			<span className="text-tertiary">
				Built only on measured or independently verifiable inputs. n/a never counts as zero; its weight redistributes.
				Tiers: S 85+ (needs measured execution), A 70+, B 55+, C 40+, else D.
			</span>
		</div>
	)
}

function linkedMetric(value: React.ReactNode, note: string | undefined) {
	return note ? (
		<Tooltip content={note} className="ms-auto w-fit underline decoration-dotted">
			{value}
		</Tooltip>
	) : (
		value
	)
}

export function buildDirectoryColumns(
	scope: ExchangeSegment,
	executionAvailable: boolean
): ColumnDef<ExchangeDirectoryRowModel, any>[] {
	const definitions = exchangeDefinitions.directory
	const columns: ColumnDef<ExchangeDirectoryRowModel, any>[] = [
		columnHelper.accessor((row) => `${row.name} ${row.slug} ${row.profile?.nativeToken ?? ''}`, {
			id: 'name',
			header: definitions.name.label,
			enableSorting: false,
			cell: ({ row }) => {
				const venue = row.original
				const profileHref = withCountryParam(venue.profileHref, venue.selectedCountry)
				const liquidityNote = row.depth > 0 ? describeChildLiquidity(venue) : null
				// Every row wears its own chip: the brand row its family's best rank,
				// each child venue its own sub-rank underneath.
				const quality = venue.quality
				return (
					<div className={`relative flex min-w-0 items-center gap-2 ${row.depth > 0 ? 'pl-12' : 'pl-6'}`}>
						{row.subRows.length > 0 ? (
							<button type="button" className="absolute -left-0.5" onClick={row.getToggleExpandedHandler()}>
								{row.getIsExpanded() ? (
									<>
										<Icon name="chevron-down" height={16} width={16} className="text-tertiary" />
										<span className="sr-only">Hide child venues</span>
									</>
								) : (
									<>
										<Icon name="chevron-right" height={16} width={16} className="text-tertiary" />
										<span className="sr-only">Show child venues</span>
									</>
								)}
							</button>
						) : null}
						<span className="vf-row-index shrink-0" aria-hidden="true" />
						{quality?.tier ? (
							// data-fullwidth lifts the tooltip surface's max-w-56 cap; the hover
							// card is a ~280px layout, not wrapping prose, and clips without it.
							<Tooltip
								content={<QualityHover quality={quality} kind={venue.kind} />}
								className="shrink-0"
								data-fullwidth={true}
							>
								<TierBadge tier={quality.tier} />
							</Tooltip>
						) : null}
						<TokenLogo
							name={venue.slug}
							kind="exchange"
							size={24}
							fallbackSrc={letterLogoDataUri(venue.name)}
							alt={`${venue.name} logo`}
						/>
						<div className="flex min-w-0 flex-1 flex-col gap-0.5">
							<div className="flex min-w-0 items-center gap-2">
								<BasicLink href={profileHref} className="truncate label-md text-link hover:underline">
									{venue.name}
								</BasicLink>
								{liquidityNote ? <QuestionHelper text={liquidityNote} /> : null}
							</div>
							{venue.tracked ? null : <span className="body-sm text-tertiary">Metadata only</span>}
						</div>
					</div>
				)
			},
			meta: {
				headerClassName: 'w-[254px] min-w-[254px]',
				headerHelperText: definitions.name.description,
				csvValue: (row) => row.name
			}
		}),
		// Lives outside the sticky name column so the venue name is not squeezed by up to
		// three shrink-0 buttons, which cost the name ~50px on a mobile viewport.
		columnHelper.display({
			id: 'venueLinks',
			header: definitions.venueLinks.label,
			enableSorting: false,
			cell: ({ row }) => {
				const venue = row.original
				const reservesHref = venue.reservesHref ? withCountryParam(venue.reservesHref, venue.selectedCountry) : null
				const defillamaPath = venue.secondaryUrl
				const venueDestination = selectVenueDestination(venue.slug, venue.referralUrl, venue.websiteUrl)
				return (
					<div className="flex items-center gap-0.5">
						{reservesHref ? (
							<Tooltip content="Open reserves">
								<BasicLink
									href={reservesHref}
									aria-label={`Open ${venue.name} reserves`}
									className={buttonStyles({ variant: 'ghost', size: 'sm', square: true })}
								>
									<Icon name="wallet" className="size-4" />
								</BasicLink>
							</Tooltip>
						) : null}
						{defillamaPath ? (
							<Tooltip content={`Open ${venue.kind.toUpperCase()} profile`}>
								<BasicLink
									href={defillamaPath}
									aria-label={`Open ${venue.name} ${venue.kind.toUpperCase()} profile`}
									className={buttonStyles({ variant: 'ghost', size: 'sm', square: true })}
								>
									<Icon name="bar-chart-2" className="size-4" />
								</BasicLink>
							</Tooltip>
						) : null}
						{venueDestination ? (
							<Tooltip content="Open venue website">
								<BasicLink
									href={venueDestination.url}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={`Open ${venue.name} website`}
									data-umami-event="exchange-website-click"
									data-umami-event-exchange={venue.name}
									data-umami-event-referral={venueDestination.kind === 'referral' ? 'true' : 'false'}
									data-umami-event-url={venueDestination.url}
									className={buttonStyles({ variant: 'ghost', size: 'sm', square: true })}
								>
									<Icon name="globe" className="size-4" />
								</BasicLink>
							</Tooltip>
						) : null}
					</div>
				)
			},
			meta: {
				headerClassName: 'w-[100px] min-w-[100px]',
				headerHelperText: definitions.venueLinks.description
			}
		}),
		columnHelper.accessor('kind', {
			id: 'kind',
			header: definitions.kind.label,
			cell: ({ getValue }) => <KindBadge kind={getValue()} />,
			meta: { headerClassName: 'w-[71px] min-w-[71px]', headerHelperText: definitions.kind.description }
		}),
		// Depth leads the activity view: it is the liquidity fact volume is judged against.
		columnHelper.accessor((row) => depthTotal(activityForScope(row, scope)) ?? undefined, {
			id: 'depth2Usd',
			header: definitions.depth2Usd.label,
			cell: ({ row, getValue }) => {
				const activity = activityForScope(row.original, scope)
				const metric = depthMetricState(activity)
				if (metric.state === 'unsupported') return <UnsupportedMetric />
				if (metric.state === 'missing') return <span className="text-tertiary">–</span>
				const note = [metric.partial ? 'Partial orderbook coverage' : null, activity?.doubleCount?.depth]
					.filter(Boolean)
					.join(' · ')
				return linkedMetric(money(getValue()), note || undefined)
			},
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.depth2Usd.description
			}
		}),
		columnHelper.accessor((row) => activityForScope(row, scope)?.volume24h ?? undefined, {
			id: 'volume24h',
			header: definitions.volume24h.label,
			cell: ({ row, getValue }) =>
				linkedMetric(money(getValue()), activityForScope(row.original, scope)?.doubleCount?.volume),
			meta: {
				headerClassName: 'w-[124px] min-w-[124px]',
				align: 'end',
				headerHelperText: definitions.volume24h.description
			}
		}),
		columnHelper.accessor(
			(row) => {
				const activity = activityForScope(row, scope)
				return fractionChange(activity?.volume24h, activity?.volumePrevious24h) ?? undefined
			},
			{
				id: 'volumeChange24h',
				header: definitions.volumeChange24h.label,
				cell: ({ getValue }) => <Change value={getValue()} />,
				meta: {
					headerClassName: 'w-[102px] min-w-[102px]',
					align: 'end',
					headerHelperText: definitions.volumeChange24h.description
				}
			}
		),
		columnHelper.accessor((row) => activityForScope(row, scope)?.openInterestUsd ?? undefined, {
			id: 'openInterestUsd',
			header: definitions.openInterestUsd.label,
			cell: ({ row, getValue }) => {
				const activity = activityForScope(row.original, scope)
				if (!activity?.supportsOpenInterest) return <UnsupportedMetric />
				return linkedMetric(money(getValue()), activity.doubleCount?.openInterest)
			},
			meta: {
				headerClassName: 'w-[129px] min-w-[129px]',
				align: 'end',
				headerHelperText: definitions.openInterestUsd.description
			}
		}),
		columnHelper.accessor(
			(row) => {
				const activity = activityForScope(row, scope)
				return fractionChange(activity?.openInterestUsd, activity?.openInterestPreviousUsd) ?? undefined
			},
			{
				id: 'openInterestChange24h',
				header: definitions.openInterestChange24h.label,
				cell: ({ row, getValue }) =>
					activityForScope(row.original, scope)?.supportsOpenInterest ? (
						<Change value={getValue()} />
					) : (
						<UnsupportedMetric />
					),
				meta: {
					headerClassName: 'w-[89px] min-w-[89px]',
					align: 'end',
					headerHelperText: definitions.openInterestChange24h.description
				}
			}
		),
		// Measured execution quality — tick-level fills on the shared perp basket, so it
		// exists for linear-perp scope only today (hidden elsewhere via scope visibility).
		// 1bp of $10k = $1, so bps figures ARE dollars per $10k trade.
		columnHelper.accessor((row) => row.execution?.costToTradeBps ?? undefined, {
			id: 'execCostToTrade',
			header: definitions.execCostToTrade.label,
			sortDescFirst: false,
			cell: ({ row, getValue }) => {
				const cost = getValue()
				if (cost == null) return <span className="text-tertiary">n/a</span>
				const execution = row.original.execution
				return (
					<Tooltip
						content={`${formatNumber(cost, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} bps, median across ${execution?.assets?.join(', ') ?? 'the measured'} perps over ${execution?.hoursCovered ?? 'n/a'}h of tick data. Base-tier taker fee plus half the effective spread; VIP tiers can lower the fee part.`}
						className="ms-auto w-fit"
					>
						<span className="underline decoration-dotted">{`${execUsd(cost)} /$10k`}</span>
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[124px] min-w-[124px]',
				align: 'end',
				headerHelperText: definitions.execCostToTrade.description,
				csvValue: (row) =>
					row.execution?.costToTradeBps == null ? '' : String(roundNumber(row.execution.costToTradeBps, 2))
			}
		}),
		columnHelper.accessor((row) => row.execution?.realizedSlippage10kBps ?? undefined, {
			id: 'execSlippage10k',
			header: definitions.execSlippage10k.label,
			sortDescFirst: false,
			cell: ({ row, getValue }) => {
				const actual = getValue()
				if (actual == null) return <span className="text-tertiary">n/a</span>
				const predicted = row.original.execution?.predictedSlippage10kBps
				return (
					<span className="flex items-center justify-end gap-1">
						{predicted == null ? null : <span className="text-tertiary">{`p ${execUsd(predicted)} →`}</span>}
						<span>{execUsd(actual)}</span>
					</span>
				)
			},
			meta: {
				headerClassName: 'w-[139px] min-w-[139px]',
				align: 'end',
				headerHelperText: definitions.execSlippage10k.description,
				csvValue: (row) =>
					row.execution?.realizedSlippage10kBps == null
						? ''
						: String(roundNumber(row.execution.realizedSlippage10kBps, 2))
			}
		}),
		columnHelper.accessor((row) => row.execution?.markout1mBps ?? undefined, {
			id: 'execMarkout1m',
			header: definitions.execMarkout1m.label,
			sortDescFirst: false,
			cell: ({ getValue }) => {
				const markout = getValue()
				if (markout == null) return <span className="text-tertiary">n/a</span>
				return <span className={markout > 0 ? 'text-data-down' : 'text-data-up'}>{execUsdSigned(markout)}</span>
			},
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.execMarkout1m.description,
				csvValue: (row) =>
					row.execution?.markout1mBps == null ? '' : String(roundNumber(row.execution.markout1mBps, 2))
			}
		}),
		columnHelper.accessor((row) => normalizedVolumeForScope(row, scope)?.normalized ?? undefined, {
			id: 'normalizedVolume',
			header: definitions.normalizedVolume.label,
			cell: ({ row, getValue }) => {
				const nvol = normalizedVolumeForScope(row.original, scope)
				return nvol ? (
					<Tooltip
						content={`${percentage(nvol.discountFraction)} below reported · ${percentage(nvol.unverifiedFraction)} unverified${nvol.flag ? ` · ${nvol.flag}` : ''}`}
						className="ms-auto w-fit"
					>
						<span className="underline decoration-dotted">{money(getValue())}</span>
					</Tooltip>
				) : (
					'–'
				)
			},
			meta: {
				headerClassName: 'w-[130px] min-w-[130px]',
				align: 'end',
				headerHelperText: definitions.normalizedVolume.description
			}
		}),
		columnHelper.accessor((row) => volumeToOpenInterest(activityForScope(row, scope)) ?? undefined, {
			id: 'volumeToOi',
			header: definitions.volumeToOi.label,
			cell: ({ row, getValue }) =>
				activityForScope(row.original, scope)?.supportsOpenInterest ? ratio(getValue()) : <UnsupportedMetric />,
			meta: {
				headerClassName: 'w-[96px] min-w-[96px]',
				align: 'end',
				headerHelperText: definitions.volumeToOi.description
			}
		}),
		columnHelper.accessor((row) => volumeToDepth(activityForScope(row, scope)) ?? undefined, {
			id: 'volumeToDepth',
			header: definitions.volumeToDepth.label,
			cell: ({ row, getValue }) =>
				activityForScope(row.original, scope)?.supportsDepth ? ratio(getValue()) : <UnsupportedMetric />,
			meta: {
				headerClassName: 'w-[110px] min-w-[110px]',
				align: 'end',
				headerHelperText: definitions.volumeToDepth.description
			}
		}),
		columnHelper.accessor((row) => activityForScope(row, scope)?.marketCount ?? undefined, {
			id: 'marketCount',
			header: definitions.marketCount.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[93px] min-w-[93px]',
				align: 'end',
				headerHelperText: definitions.marketCount.description
			}
		}),
		columnHelper.accessor((row) => activityForScope(row, scope)?.coinCount ?? undefined, {
			id: 'coinCount',
			header: definitions.coinCount.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[79px] min-w-[79px]',
				align: 'end',
				headerHelperText: definitions.coinCount.description
			}
		}),
		columnHelper.accessor((row) => sparklineForScope(row, scope), {
			id: 'sparkline',
			header: definitions.sparkline.label,
			enableSorting: false,
			cell: ({ row, getValue }) => (
				<MiniSparkline
					values={getValue()}
					label={`${row.original.name} ${EXCHANGE_SEGMENT_LABELS[scope]} volume trend`}
				/>
			),
			meta: {
				headerClassName: 'w-[124px] min-w-[124px]',
				align: 'end',
				headerHelperText: definitions.sparkline.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.totalUsd ?? undefined, {
			id: 'reservesUsd',
			header: definitions.reservesUsd.label,
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[119px] min-w-[119px]',
				align: 'end',
				headerHelperText: definitions.reservesUsd.description
			}
		}),
		columnHelper.accessor(
			(row) =>
				row.reserves?.cleanUsd != null && row.reserves.totalUsd != null && row.reserves.totalUsd > 0
					? row.reserves.cleanUsd / row.reserves.totalUsd
					: undefined,
			{
				id: 'cleanRatio',
				header: definitions.cleanRatio.label,
				cell: ({ getValue }) => percentage(getValue()),
				meta: {
					headerClassName: 'w-[114px] min-w-[114px]',
					align: 'end',
					headerHelperText: definitions.cleanRatio.description
				}
			}
		),
		columnHelper.accessor((row) => row.reserves?.inflows24hUsd ?? undefined, {
			id: 'inflows24hUsd',
			header: definitions.inflows24hUsd.label,
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[117px] min-w-[117px]',
				align: 'end',
				headerHelperText: definitions.inflows24hUsd.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.inflows7dUsd ?? undefined, {
			id: 'inflows7dUsd',
			header: definitions.inflows7dUsd.label,
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.inflows7dUsd.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.inflows1mUsd ?? undefined, {
			id: 'inflows1mUsd',
			header: definitions.inflows1mUsd.label,
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.inflows1mUsd.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.ownTokenFraction ?? undefined, {
			id: 'ownTokenFraction',
			header: definitions.ownTokenFraction.label,
			cell: ({ getValue }) => percentage(getValue()),
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.ownTokenFraction.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.auditor, {
			id: 'auditor',
			header: definitions.auditor.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[119px] min-w-[119px]',
				headerHelperText: definitions.auditor.description
			}
		}),
		columnHelper.accessor((row) => activityForScope(row, scope)?.volumeUpdatedAt, {
			id: 'freshness',
			header: definitions.freshness.label,
			cell: ({ getValue }) => getValue()?.slice(0, 10) ?? '–',
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.freshness.description
			}
		}),
		columnHelper.accessor((row) => row.warnings.length, {
			id: 'warnings',
			header: definitions.warnings.label,
			cell: ({ row, getValue }) =>
				getValue() > 0 ? (
					<Tooltip content={row.original.warnings.map((warning) => warning.text).join(' · ')}>
						<span className="underline decoration-dotted">{getValue()}</span>
					</Tooltip>
				) : (
					'–'
				),
			meta: {
				headerClassName: 'w-[102px] min-w-[102px]',
				align: 'end',
				headerHelperText: definitions.warnings.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.sourceUrl, {
			id: 'reservesSource',
			header: definitions.reservesSource.label,
			enableSorting: false,
			cell: ({ getValue }) =>
				getValue() ? (
					<BasicLink href={getValue()} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
						Verify
					</BasicLink>
				) : (
					'–'
				),
			meta: {
				headerClassName: 'w-[79px] min-w-[79px]',
				headerHelperText: definitions.reservesSource.description
			}
		}),
		columnHelper.display({
			id: 'spotFee',
			header: definitions.spotFee.label,
			cell: ({ row }) => <FeeValue fee={row.original.fees?.spot} kind="spot" />,
			meta: {
				headerClassName: 'w-[129px] min-w-[129px] whitespace-nowrap',
				align: 'end',
				headerHelperText: definitions.spotFee.description,
				csvValue: (row) => (row.fees?.spot ? feeLabel(row.fees.spot) : '–')
			}
		}),
		columnHelper.display({
			id: 'linearPerpFee',
			header: definitions.linearPerpFee.label,
			cell: ({ row }) => <FeeValue fee={row.original.fees?.linearPerp} kind="perp" />,
			meta: {
				headerClassName: 'w-[139px] min-w-[139px] whitespace-nowrap',
				align: 'end',
				headerHelperText: definitions.linearPerpFee.description,
				csvValue: (row) => (row.fees?.linearPerp ? feeLabel(row.fees.linearPerp) : '–')
			}
		}),
		columnHelper.display({
			id: 'inversePerpFee',
			header: definitions.inversePerpFee.label,
			cell: ({ row }) => <FeeValue fee={row.original.fees?.inversePerp} kind="perp" />,
			meta: {
				headerClassName: 'w-[139px] min-w-[139px] whitespace-nowrap',
				align: 'end',
				headerHelperText: definitions.inversePerpFee.description,
				csvValue: (row) => (row.fees?.inversePerp ? feeLabel(row.fees.inversePerp) : '–')
			}
		}),
		columnHelper.accessor((row) => row.fees?.feeToken?.symbol, {
			id: 'feeToken',
			header: definitions.feeToken.label,
			cell: ({ row, getValue }) => {
				const discount = row.original.fees?.feeToken?.discountFraction
				return getValue()
					? `${getValue().toUpperCase()}${discount == null ? '' : ` · ${percentage(discount)} off`}`
					: '–'
			},
			meta: { headerClassName: 'w-[130px] min-w-[130px]', headerHelperText: definitions.feeToken.description }
		}),
		columnHelper.accessor((row) => row.funding?.fiatCurrencies?.join(', '), {
			id: 'fiatCurrencies',
			header: definitions.fiatCurrencies.label,
			enableSorting: false,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: { headerClassName: 'w-[193px] min-w-[193px]', headerHelperText: definitions.fiatCurrencies.description }
		}),
		columnHelper.display({
			id: 'fiatFees',
			header: definitions.fiatFees.label,
			cell: ({ row }) => <FiatFeesValue name={row.original.name} fees={row.original.funding?.fiatFees ?? null} />,
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				headerHelperText: definitions.fiatFees.description,
				csvValue: (row) => (row.funding?.fiatFees ? fiatFeeSummary(row.funding.fiatFees) : '–')
			}
		}),
		columnHelper.accessor((row) => row.funding?.hasFiatOnramp, {
			id: 'fiatOnramp',
			header: definitions.fiatOnramp.label,
			cell: ({ getValue }) => (getValue() == null ? '–' : getValue() ? 'Yes' : 'No'),
			meta: { headerClassName: 'w-[124px] min-w-[124px]', headerHelperText: definitions.fiatOnramp.description }
		}),
		columnHelper.accessor((row) => row.funding?.rampCost?.onRamp.totalUsd ?? undefined, {
			id: 'rampCost',
			header: definitions.rampCost.label,
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[155px] min-w-[155px]',
				align: 'end',
				headerHelperText: definitions.rampCost.description
			}
		}),
		columnHelper.accessor((row) => row.compliance?.headquarters, {
			id: 'headquarters',
			header: definitions.headquarters.label,
			cell: ({ getValue }) => {
				const headquarters = getValue()
				return headquarters ? (
					<Tooltip content={headquarters} className="max-w-full">
						<span className="truncate">{headquarters}</span>
					</Tooltip>
				) : (
					<span className="text-tertiary">–</span>
				)
			},
			meta: {
				headerClassName: 'w-[199px] min-w-[199px]',
				headerHelperText: definitions.headquarters.description
			}
		}),
		columnHelper.accessor((row) => row.compliance?.euStatus, {
			id: 'euStatus',
			header: definitions.euStatus.label,
			cell: ({ row }) => (
				<EuAvailabilityValue
					status={row.original.compliance?.euStatus ?? null}
					eeaOrderbookOwnership={row.original.compliance?.eeaOrderbookOwnership ?? null}
				/>
			),
			meta: {
				headerClassName: 'w-[144px] min-w-[144px]',
				headerHelperText: definitions.euStatus.description,
				csvValue: (row) => (row.compliance?.euStatus ? getEuStatusPresentation(row.compliance.euStatus).label : '–')
			}
		}),
		columnHelper.display({
			id: 'mica',
			header: definitions.mica.label,
			cell: ({ row }) => (
				<MicaLicenseValue
					name={row.original.name}
					mica={row.original.compliance?.mica ?? null}
					licenseCount={row.original.compliance?.licenseCount ?? null}
				/>
			),
			meta: {
				headerClassName: 'w-[119px] min-w-[119px]',
				headerHelperText: definitions.mica.description,
				csvValue: (row) => {
					const mica = row.compliance?.mica
					return mica ? (getMicaLicensePresentation(mica)?.label ?? '–') : '–'
				}
			}
		}),
		columnHelper.accessor((row) => row.compliance?.kyc?.short, {
			id: 'kyc',
			header: definitions.kyc.label,
			enableSorting: false,
			cell: ({ row }) => <KycRequirementValue name={row.original.name} kyc={row.original.compliance?.kyc ?? null} />,
			meta: {
				headerClassName: 'w-[239px] min-w-[239px]',
				headerHelperText: definitions.kyc.description,
				csvValue: (row) => {
					const kyc = row.compliance?.kyc
					if (!kyc) return '–'
					return kyc.required ? (kyc.summary ?? kyc.short ?? 'Required') : 'No KYC'
				}
			}
		}),
		columnHelper.accessor((row) => row.compliance?.licenseCount ?? undefined, {
			id: 'licenseCount',
			header: definitions.licenseCount.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.licenseCount.description
			}
		}),
		columnHelper.accessor((row) => row.profile?.founded ?? undefined, {
			id: 'founded',
			header: definitions.founded.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[97px] min-w-[97px]',
				align: 'end',
				headerHelperText: definitions.founded.description
			}
		})
	]
	return executionAvailable ? columns : columns.filter((column) => !EXECUTION_COLUMN_IDS.includes(column.id ?? ''))
}
